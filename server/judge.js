const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function executeCode(language, code, input) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'judge-'));
    let command;
    let args;
    // timeout padrão (ms). Para python podemos usar um timeout maior.
    let timeout = 5000;
    // Diretório de execução (pasta raiz do projeto). Permite usar dependências instaladas na raiz.
    const projectRoot = process.env.PROJECT_ROOT && process.env.PROJECT_ROOT.trim()
        ? process.env.PROJECT_ROOT.trim()
        : path.resolve(__dirname, '..');

    try {
        // Se a linguagem não for informada, tenta detectar por heurística simples
        if (!language) {
            const lc = (code || '').toLowerCase();
            if (lc.includes('console.log') || lc.includes('require(') || lc.includes('module.exports')) {
                language = 'javascript';
            } else if (lc.includes('def ') || lc.includes('import ') || lc.includes('print(')) {
                language = 'python';
            }
        }

        if (language === 'python') {
            const filePath = path.join(tempDir, 'script.py');
            await fs.writeFile(filePath, code);
            // Detectar executável Python disponível no Windows: tenta variável de ambiente PYTHON_CMD primeiro,
            // depois tenta os comandos padrão 'py', 'python', 'python3'.
            const candidates = [];
            if (process.env.PYTHON_CMD && process.env.PYTHON_CMD.trim()) {
                candidates.push(process.env.PYTHON_CMD.trim());
            }
            candidates.push('py', 'python', 'python3');
            let found = null;
            for (const c of candidates) {
                try {
                    // spawn a quick version check synchronously via execFile to test availability
                    // usamos execFile sem args para que o launcher retorne um código não-zero ou mensagem.
                    // aqui fazemos uma tentativa simples assincrona via Promise
                    await new Promise((resolve, reject) => {
                        execFile(c, ['-c', 'import sys; print(sys.version)'], { timeout: 2000, cwd: projectRoot }, (err, stdout, stderr) => {
                            if (err) return reject(err);
                            resolve(stdout);
                        });
                    });
                    found = c;
                    break;
                } catch (e) {
                    // continua tentando outros candidatos
                }
            }
            if (!found) {
                // se não encontrou, tenta usar 'py' (launcher do Windows) — mas pode falhar
                found = 'py';
            }
            console.log('Judge: usando executavel python ->', found);
            command = found;
            // usa -3 para forçar Python 3 no launcher py; se for 'python' ou 'python3', o argumento -3 pode não existir, então passamos diferente
            if (found === 'py') args = ['-3', filePath];
            else args = [filePath];
            // python costuma demorar se o código for maior — aumenta timeout
            timeout = 10000;

        } else if (language === 'javascript') {
            const filePath = path.join(tempDir, 'script.js');
            await fs.writeFile(filePath, code);
            // permite sobrescrever com NODE_CMD para usar o node da raiz do projeto
            command = process.env.NODE_CMD && process.env.NODE_CMD.trim() ? process.env.NODE_CMD.trim() : 'node';
            args = [filePath];

        } else if (language === 'c' || language === 'cpp') {
            const isCpp = language === 'cpp';
            const sourceExtension = isCpp ? '.cpp' : '.c';
            const compiler = isCpp ? 'g++' : 'gcc';
            
            const sourcePath = path.join(tempDir, `program${sourceExtension}`);
            const executablePath = path.join(tempDir, 'program.out');
            await fs.writeFile(sourcePath, code);

            await new Promise((resolve, reject) => {
                const compilerCmd = (isCpp ? (process.env.GPP_CMD && process.env.GPP_CMD.trim() ? process.env.GPP_CMD.trim() : 'g++') : (process.env.GCC_CMD && process.env.GCC_CMD.trim() ? process.env.GCC_CMD.trim() : 'gcc'));
                execFile(compilerCmd, [sourcePath, '-o', executablePath], { cwd: projectRoot }, (error, stdout, stderr) => {
                    if (error) {
                        return reject({ status: 'Compilation Error', error: stderr || error.message });
                    }
                    resolve();
                });
            });

            command = executablePath;
            args = [];
        } else {
            throw new Error(`A linguagem "${language}" não é suportada pelo executor local.`);
        }

        const { stdout, stderr } = await new Promise((resolve, reject) => {
            const process = execFile(command, args, { timeout, cwd: projectRoot }, (error, stdout, stderr) => {
                if (error) {
                    if (error.signal === 'SIGTERM' || error.killed) {
                       return reject({ status: 'Time Limit Exceeded', error: `Processo excedeu ${timeout / 1000}s` });
                    }
                    return reject({ status: 'Runtime Error', error: stderr });
                }
                resolve({ stdout, stderr });
            });

            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });

        return { status: 'Success', output: stdout, error: stderr };

    } catch (err) {
        if (err.status) {
            return { status: err.status, output: '', error: err.error || '' };
        }
        return { status: 'System Error', output: '', error: err.message };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

module.exports = { executeCode };