// server/reportGenerator.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

    generateReport(submission) {
        const report = {
            submissionId: uuidv4(),
            timestamp: new Date().toISOString(),
            questionId: submission.questionId,
            language: submission.language,
            code: submission.code,
            testCases: submission.testCases || [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                executionTime: 0,
                memoryUsage: 0
            },
            results: []
        };

        if (submission.results) {
            report.results = submission.results.map(result => ({
                caseId: result.caseId,
                status: result.status,
                input: result.input,
                expected: result.expected,
                actual: result.actual,
                error: result.error,
                executionTime: result.executionTime || 0,
                memoryUsage: result.memoryUsage || 0
            }));

            report.summary = {
                total: report.results.length,
                passed: report.results.filter(r => r.status === 'Accepted').length,
                failed: report.results.filter(r => r.status !== 'Accepted').length,
                executionTime: report.results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
                memoryUsage: Math.max(...report.results.map(r => r.memoryUsage || 0))
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