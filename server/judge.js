const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const util = require('util');
const OutputComparator = require('./outputComparator');
const TestCaseValidator = require('./testCaseValidator');
const ReportGenerator = require('./reportGenerator');

const execFilePromise = util.promisify(execFile);
const reportGenerator = new ReportGenerator();

class CodeExecutor {
    constructor() {
        this.timeout = 5000;
        this.projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
    }

    async executeCode(language, code, input = '') {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'judge-'));

        try {
            // Valida o código antes de executar
            const validatedCode = this.validateCode(code, language);

            // Prepara os arquivos e comandos necessários para a execução
            const { command, args } = await this.prepareExecution(language, validatedCode, tempDir);
            
            // Executa o código e obtém o resultado
            const result = await this.runCode(command, args, input, tempDir);

            // Normaliza o output para comparação consistente
            const normalizedOutput = this.normalizeOutput(result.stdout);

            return {
                status: 'Success',
                output: normalizedOutput,
                error: result.stderr,
                executionTime: result.executionTime,
            };
        } catch (error) {
            // Captura erros (validação, compilação, tempo limite, erro de execução)
            return {
                status: error.status || 'Runtime Error',
                output: error.output || '',
                error: error.error || error.message,
                executionTime: error.executionTime || 0,
            };
        } finally {
            // Garante que o diretório temporário seja sempre limpo
            await this.cleanup(tempDir);
        }
    }

    async prepareExecution(language, code, tempDir) {
        switch (language) {
            case 'javascript': {
                const filePath = path.join(tempDir, 'script.js');
                await fs.writeFile(filePath, code);
                return { command: 'node', args: [filePath] };
            }
            case 'python': {
                const filePath = path.join(tempDir, 'script.py');
                await fs.writeFile(filePath, code);
                // Tenta detectar python3 primeiro, se não estiver disponível usa python
                const pythonCmd = await this.findPythonExecutable();
                return { command: pythonCmd, args: [filePath] };
            }
            case 'c': {
                const sourcePath = path.join(tempDir, 'source.c');
                await fs.writeFile(sourcePath, code);
                // Em Windows geramos executável com .exe
                const exeName = process.platform === 'win32' ? 'a.exe' : 'a.out';
                const outputPath = path.join(tempDir, exeName);
                // Compila o código C. Se falhar, um erro será lançado.
                await this.compileCode('gcc', [sourcePath, '-o', outputPath, '-lm']);
                return { command: outputPath, args: [] };
            }
            case 'cpp': {
                const sourcePath = path.join(tempDir, 'source.cpp');
                await fs.writeFile(sourcePath, code);
                const exeName = process.platform === 'win32' ? 'a.exe' : 'a.out';
                const outputPath = path.join(tempDir, exeName);
                // Compila o código C++. Se falhar, um erro será lançado.
                await this.compileCode('g++', [sourcePath, '-o', outputPath, '-std=c++17']);
                return { command: outputPath, args: [] };
            }
            default:
                throw new Error(`Linguagem '${language}' não suportada.`);
        }
    }

    async findPythonExecutable() {
        const candidates = ['python3', 'python'];
        for (const cmd of candidates) {
            try {
                await execFilePromise(cmd, ['--version']);
                return cmd;
            } catch (err) {
                // ignora e tenta o próximo
            }
        }

        // fallback para 'python' mesmo que não tenha sido detectado; o erro será tratado ao executar
        return 'python';
    }

    async compileCode(compiler, args) {
        try {
            await execFilePromise(compiler, args);
        } catch (error) {
            // Lança um erro específico de compilação para ser tratado no bloco catch principal
            throw {
                status: 'Compilation Error',
                error: error.stderr || error.message,
            };
        }
    }

    async runCode(command, args, input, cwd) {
        return new Promise((resolve, reject) => {
            const startTime = process.hrtime();
            const childProcess = execFile(command, args, {
                timeout: this.timeout,
                cwd: cwd,
                maxBuffer: 1024 * 1024 * 5 // 5MB para stdout e stderr
            }, (error, stdout, stderr) => {
                const [seconds, nanoseconds] = process.hrtime(startTime);
                const executionTime = (seconds * 1000) + (nanoseconds / 1e6);

                if (error) {
                    if (error.code === 'ENOENT') {
                        return reject({
                            status: 'Executable Not Found',
                            error: `Comando não encontrado: ${command}`,
                            executionTime
                        });
                    }

                    if (error.signal === 'SIGTERM' || error.killed) {
                        return reject({
                            status: 'Time Limit Exceeded',
                            error: `Processo excedeu ${this.timeout / 1000}s`,
                            executionTime
                        });
                    }
                    return reject({
                        status: 'Runtime Error',
                        error: stderr || error.message,
                        executionTime
                    });
                }

                resolve({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    executionTime,
                });
            });

            // Fornece a entrada (stdin) para o processo e sempre fecha o stdin
            try {
                // Se a entrada vier com sequências escapadas (por exemplo "100\\n200"),
                // converte-as para caracteres reais (\n, \r, \t) antes de escrever no stdin.
                const finalInput = this.unescapeInput(input);
                if (typeof finalInput === 'string' && finalInput.length > 0) {
                    childProcess.stdin.write(finalInput);
                }
            } catch (e) {
                // ignore write errors
            } finally {
                try { childProcess.stdin.end(); } catch (e) { /* ignore */ }
            }
        });
    }

    /**
     * Converte sequências escapadas comuns em caracteres reais.
     * Ex: "100\\n200" -> "100\n200"
     * Versão melhorada: suporta mais escapes e valida entrada
     */
    unescapeInput(input) {
        if (typeof input !== 'string') return '';
        if (input.length === 0) return '';

        // Somente executar substituições se houver padrões escapados
        if (input.indexOf('\\') === -1) {
            return input;
        }

        return input
            .replace(/\\r\\n/g, '\r\n')  // CRLF primeiro
            .replace(/\\n/g, '\n')       // LF
            .replace(/\\r/g, '\r')       // CR
            .replace(/\\t/g, '\t')       // Tab
            .replace(/\\0/g, '\0')       // Null (raro mas possível)
            .replace(/\\\\/g, '\\');     // Barra invertida literal
    }

    /**
     * Normaliza output para comparação robusta
     * Remove espaços extras, normaliza line endings
     */
    normalizeOutput(output) {
        if (typeof output !== 'string') return String(output);
        
        return output
            .replace(/\r\n/g, '\n')      // Normaliza CRLF → LF
            .replace(/\r/g, '\n')        // Normaliza CR → LF
            .trimEnd();                  // Remove espaços/quebras no final (comum em outputs)
    }

    /**
     * Valida código antes de executar
     * Previne códigos vazios, muito grandes ou suspeitos
     */
    validateCode(code, language) {
        if (!code || typeof code !== 'string') {
            throw new Error('Código inválido ou vazio');
        }

        const trimmed = code.trim();
        if (trimmed.length === 0) {
            throw new Error('Código não pode estar vazio');
        }

        if (trimmed.length > 500000) { // 500KB
            throw new Error('Código excede o tamanho máximo permitido (500KB)');
        }

        // Validações básicas por linguagem
        switch (language) {
            case 'python':
                // Python deve ter ao menos um statement válido
                if (!/^[\s\S]*[a-zA-Z_]/.test(trimmed)) {
                    throw new Error('Código Python não contém nenhum statement válido');
                }
                break;
            case 'javascript':
                // JS deve ter ao menos um identificador ou palavra-chave
                if (!/[a-zA-Z_$]/.test(trimmed)) {
                    throw new Error('Código JavaScript não contém nenhum identificador válido');
                }
                break;
            case 'c':
            case 'cpp':
                // C/C++ deve ter função main
                if (!/\bmain\s*\(/.test(trimmed)) {
                    throw new Error(`Código ${language.toUpperCase()} deve conter função main()`);
                }
                break;
        }

        return trimmed;
    }

    async cleanup(tempDir) {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Erro ao limpar diretório temporário:', error);
        }
    }
}

const codeExecutor = new CodeExecutor();
module.exports = {
    executeCode: codeExecutor.executeCode.bind(codeExecutor),
    OutputComparator,
    TestCaseValidator,
    ReportGenerator
};