const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const csvParser = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { executeCode, TestCaseValidator, ReportGenerator } = require('./judge');

const app = express();
const PORT = process.env.PORT || 3001;

const TEST_CASES_FILE = path.join(__dirname, 'test_cases.csv');
const LOGS_DIR = path.join(__dirname, 'logs');
const CSV_HEADER = [
    { id: 'questao_id', title: 'questao_id' },
    { id: 'entrada', title: 'entrada' },
    { id: 'saida', title: 'saida' },
    { id: 'tipo', title: 'tipo' },
];

// Garante que o diretório de logs existe
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const reportGenerator = new ReportGenerator(LOGS_DIR);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Rota de saúde
app.get('/health', (req, res) => res.json({ 
    ok: true, 
    pid: process.pid,
    uptime: process.uptime()
}));

// Lista casos de teste
app.get('/cases', (req, res) => {
    if (!fs.existsSync(TEST_CASES_FILE)) {
        return res.json([]);
    }

    const { questao_id } = req.query;
    const results = [];

    fs.createReadStream(TEST_CASES_FILE)
        .pipe(csvParser())
        .on('data', data => {
            if (!questao_id || String(data.questao_id) === String(questao_id)) {
                results.push(data);
            }
        })
        .on('end', () => res.json(results))
        .on('error', err => {
            console.error('Erro ao ler CSV:', err);
            res.status(500).json({ error: 'Erro ao processar casos de teste' });
        });
});

// Lista questões
const QUESTOES_FILE = path.join(__dirname, 'questoes.csv');
app.get('/questoes', (req, res) => {
    if (!fs.existsSync(QUESTOES_FILE)) {
        return res.status(404).json({ error: 'Arquivo de questões não encontrado.' });
    }

    const results = [];
    fs.createReadStream(QUESTOES_FILE)
        .pipe(csvParser())
        .on('data', data => results.push(data))
        .on('end', () => res.json(results))
        .on('error', err => {
            console.error('Erro ao ler questões:', err);
            res.status(500).json({ error: 'Erro ao processar as questões' });
        });
});

// Cria casos de teste
app.post('/cases', async (req, res) => {
    const { casos } = req.body;
    
    if (!Array.isArray(casos) || !casos.length) {
        return res.status(400).json({ error: 'Envie um array "casos" válido.' });
    }

    // Valida os casos de teste
    const validation = TestCaseValidator.validate(casos);
    if (!validation.isValid) {
        return res.status(400).json({
            error: 'Casos de teste inválidos',
            details: TestCaseValidator.getErrorMessage(validation.errors)
        });
    }

    const csvWriter = createObjectCsvWriter({
        path: TEST_CASES_FILE,
        header: CSV_HEADER,
        append: fs.existsSync(TEST_CASES_FILE),
    });

    try {
        await csvWriter.writeRecords(casos);
        res.status(201).json({ 
            ok: true, 
            count: casos.length,
            message: `Casos de teste salvos com sucesso em ${TEST_CASES_FILE}`
        });
    } catch (err) {
        console.error('Erro ao escrever CSV:', err);
        res.status(500).json({ error: 'Erro ao salvar casos de teste' });
    }
});

// Executa um único caso de teste
app.post('/execute', async (req, res) => {
    const { language, code, input, expected_output } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Campo "code" é obrigatório.' });
    }

    try {
        const startTime = process.hrtime();
        const result = await executeCode(language, code, input);
        const [seconds, ns] = process.hrtime(startTime);
        const executionTime = (seconds * 1000) + (ns / 1e6); // ms

        const response = {
            ...result,
            executionTime,
            memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024), // MB
            timestamp: new Date().toISOString()
        };

        if (result.status === 'Success' && expected_output !== undefined) {
            response.verdict = result.output.trim() === expected_output.trim() 
                ? 'Accepted' 
                : 'Wrong Answer';
        }

        // Salva o log da execução
        await reportGenerator.saveReport({
            submissionId: `single_${Date.now()}`,
            timestamp: new Date().toISOString(),
            language,
            code,
            testCases: [{
                input,
                expected: expected_output,
                actual: result.output,
                status: response.verdict || result.status,
                executionTime
            }],
            results: [response]
        });

        res.json(response);
    } catch (error) {
        console.error('Erro na execução:', error);
        res.status(500).json({ 
            status: 'Error', 
            error: error.message || 'Erro desconhecido',
            timestamp: new Date().toISOString()
        });
    }
});

// Executa múltiplos casos de teste
app.post('/execute-batch', async (req, res) => {
    const { language, code, testCases = [], questionId } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Campo "code" é obrigatório.' });
    }

    // Valida os casos de teste
    const validation = TestCaseValidator.validate(testCases);
    if (!validation.isValid) {
        return res.status(400).json({
            error: 'Casos de teste inválidos',
            details: TestCaseValidator.getErrorMessage(validation.errors)
        });
    }

    const results = [];
    const startTime = process.hrtime();

    try {
        // Executa cada caso de teste
        for (const [index, testCase] of testCases.entries()) {
            const caseStartTime = process.hrtime();
            const result = await executeCode(language, code, testCase.entrada);
            const [seconds, ns] = process.hrtime(caseStartTime);
            const executionTime = (seconds * 1000) + (ns / 1e6); // ms

            const testResult = {
                caseId: testCase.id || `case_${index + 1}`,
                input: testCase.entrada,
                expected: testCase.saida,
                actual: result.output,
                status: result.status,
                executionTime,
                memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024), // MB
                verdict: result.status === 'Success' && result.output.trim() === testCase.saida.trim()
                    ? 'Accepted'
                    : result.status === 'Success' ? 'Wrong Answer' : result.status
            };

            results.push(testResult);

            // Se falhar em um caso que não é de exemplo, para a execução
            if (testResult.verdict !== 'Accepted' && testCase.tipo !== 'exemplo') {
                break;
            }
        }

        const [totalSeconds, totalNs] = process.hrtime(startTime);
        const totalExecutionTime = (totalSeconds * 1000) + (totalNs / 1e6);

        // Gera relatório
        const report = reportGenerator.generateReport({
            submissionId: `batch_${Date.now()}`,
            timestamp: new Date().toISOString(),
            questionId,
            language,
            code,
            testCases,
            results,
            summary: {
                total: results.length,
                passed: results.filter(r => r.verdict === 'Accepted').length,
                failed: results.filter(r => r.verdict !== 'Accepted').length,
                executionTime: totalExecutionTime
            }
        });

        await reportGenerator.saveReport(report);

        res.json({
            status: 'Completed',
            total: results.length,
            passed: results.filter(r => r.verdict === 'Accepted').length,
            executionTime: totalExecutionTime,
            results
        });

    } catch (error) {
        console.error('Erro na execução em lote:', error);
        res.status(500).json({ 
            status: 'Error', 
            error: error.message || 'Erro desconhecido',
            timestamp: new Date().toISOString()
        });
    }
});

// Rota para visualizar logs
app.get('/logs/:submissionId', async (req, res) => {
    try {
        const filePath = path.join(LOGS_DIR, `submission_${req.params.submissionId}.json`);
        const data = await fs.promises.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ error: 'Log não encontrado' });
    }
});

// Inicia o servidor
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
        console.log(`📊 Painel de logs: http://localhost:${PORT}/logs`);
    });
}

module.exports = app;