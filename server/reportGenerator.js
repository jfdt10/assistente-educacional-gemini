// server/reportGenerator.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OutputComparator = require('./outputComparator');

class ReportGenerator {
    constructor(logsDir = path.join(__dirname, 'logs')) {
        this.logsDir = logsDir;
        this.ensureLogsDir();
    }

    async ensureLogsDir() {
        try {
            await fs.mkdir(this.logsDir, { recursive: true });
        } catch (error) {
            console.error('Erro ao criar diretório de logs:', error);
        }
    }

    generateDiff(actual, expected) {
        if (actual === expected) return [];
        
        const diff = [];
        const maxLength = Math.max(actual.length, expected.length);
        
        for (let i = 0; i < maxLength; i++) {
            if (actual[i] !== expected[i]) {
                diff.push({
                    position: i,
                    expected: expected[i] || '',
                    actual: actual[i] || ''
                });
                // Mostrar apenas as primeiras 3 diferenças para não poluir o relatório
                if (diff.length >= 3) break;
            }
        }
        
        return diff;
    }

    getErrorType(actual, expected) {
        if (actual === expected) return 'none';
        
        const actualNormalized = OutputComparator.normalizeDecimals(actual);
        const expectedNormalized = OutputComparator.normalizeDecimals(expected);
        
        // Verifica se a diferença está apenas em espaços em branco
        if (actualNormalized.trim() === expectedNormalized.trim()) {
            return 'whitespace';
        }
        
        // Verifica se a diferença está apenas em maiúsculas/minúsculas
        if (actualNormalized.toLowerCase() === expectedNormalized.toLowerCase()) {
            return 'case_sensitive';
        }
        
        // Verifica se a diferença está apenas em números decimais
        const numActual = parseFloat(actualNormalized.replace(/[^0-9.-]+/g, ''));
        const numExpected = parseFloat(expectedNormalized.replace(/[^0-9.-]+/g, ''));
        
        if (!isNaN(numActual) && !isNaN(numExpected)) {
            const diff = Math.abs(numActual - numExpected);
            if (diff < 0.0001) return 'floating_point';
            return 'numeric_value';
        }
        
        return 'content_mismatch';
    }

    generateReport(submission) {
        const report = {
            submissionId: submission.submissionId || uuidv4(),
            timestamp: submission.timestamp || new Date().toISOString(),
            questionId: submission.questionId,
            language: submission.language,
            code: submission.code,
            testCases: submission.testCases || [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                executionTime: 0,
                memoryUsage: 0,
                byErrorType: {}
            },
            results: []
        };

        if (submission.results) {
            report.results = submission.results.map(result => {
                const errorType = result.status === 'Success' && result.verdict !== 'Accepted'
                    ? this.getErrorType(result.actual, result.expected)
                    : 'none';
                
                return {
                    caseId: result.caseId,
                    status: result.status,
                    verdict: result.verdict || (result.status === 'Success' ? 'Accepted' : 'Error'),
                    input: result.input,
                    expected: result.expected,
                    actual: result.actual,
                    error: result.error,
                    errorType,
                    diff: errorType !== 'none' 
                        ? this.generateDiff(
                            String(result.actual || ''), 
                            String(result.expected || '')
                          ) 
                        : [],
                    executionTime: result.executionTime || 0,
                    memoryUsage: result.memoryUsage || 0,
                    timestamp: new Date().toISOString()
                };
            });

            // Conta ocorrências por tipo de erro
            const errorTypes = report.results
                .filter(r => r.errorType !== 'none')
                .reduce((acc, curr) => {
                    acc[curr.errorType] = (acc[curr.errorType] || 0) + 1;
                    return acc;
                }, {});

            report.summary = {
                total: report.results.length,
                passed: report.results.filter(r => r.verdict === 'Accepted').length,
                failed: report.results.filter(r => r.verdict !== 'Accepted').length,
                executionTime: report.results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
                memoryUsage: Math.max(...report.results.map(r => r.memoryUsage || 0)),
            };
        }

        return report;
    }

    async saveReport(report) {
        try {
            const filename = `submission_${report.submissionId}.json`;
            const filepath = path.join(this.logsDir, filename);
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            return filepath;
        } catch (error) {
            console.error('Erro ao salvar relatório:', error);
            return null;
        }
    }
}

module.exports = ReportGenerator;