// server/judge.js (atualizado)
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const OutputComparator = require('./outputComparator');
const TestCaseValidator = require('./testCaseValidator');
const ReportGenerator = require('./reportGenerator');

const reportGenerator = new ReportGenerator();

class CodeExecutor {
    constructor() {
        this.timeout = 5000; // 5 segundos por padrão
        this.projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '..');
    }

    async executeCode(language, code, input = '') {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'judge-'));
        
        try {
            const { command, args } = await this.prepareExecution(language, code, tempDir);
            const result = await this.runCode(command, args, input);
            
            return {
                status: 'Success',
                output: result.stdout,
                error: result.stderr
            };
        } catch (error) {
            return {
                status: error.status || 'Runtime Error',
                output: error.output || '',
                error: error.error || error.message
            };
        } finally {
            await this.cleanup(tempDir);
        }
    }

    async prepareExecution(language, code, tempDir) {
        // ... (código existente de preparação)
    }

    async runCode(command, args, input) {
        return new Promise((resolve, reject) => {
            const startTime = process.hrtime();
            const process = execFile(command, args, { 
                timeout: this.timeout,
                cwd: this.projectRoot,
                maxBuffer: 1024 * 1024 // 1MB
            }, (error, stdout, stderr) => {
                const [seconds, nanoseconds] = process.hrtime(startTime);
                const executionTime = (seconds * 1000) + (nanoseconds / 1e6);

                if (error) {
                    if (error.signal === 'SIGTERM' || error.killed) {
                        return reject({ 
                            status: 'Time Limit Exceeded',
                            error: `Processo excedeu ${this.timeout/1000}s`,
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
                    memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024) // MB
                });
            });

            if (input) {
                process.stdin.write(input);
                process.stdin.end();
            }
        });
    }

    async cleanup(tempDir) {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Erro ao limpar diretório temporário:', error);
        }
    }
}

// Exporta uma instância para compatibilidade com código existente
const codeExecutor = new CodeExecutor();
module.exports = { 
    executeCode: codeExecutor.executeCode.bind(codeExecutor),
    OutputComparator,
    TestCaseValidator,
    ReportGenerator
};