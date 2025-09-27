const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const csvParser = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { executeCode } = require('./judge.js');

const app = express();
const PORT = process.env.PORT || 3001;

const TEST_CASES_FILE = path.join(__dirname, 'test_cases.csv');
const CSV_HEADER = [
    { id: 'questao_id', title: 'questao_id' },
    { id: 'entrada', title: 'entrada' },
    { id: 'saida', title: 'saida' },
    { id: 'tipo', title: 'tipo' },
];


app.use(cors());
app.use(express.json({ limit: '2mb' }));



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

    // O csv-writer cria o arquivo com cabeçalho se ele não existir,
    // ou apenas anexa os dados se já existir.
    const csvWriter = createObjectCsvWriter({
        path: TEST_CASES_FILE,
        header: CSV_HEADER,
        append: true,
    });

    try {
        await csvWriter.writeRecords(casos);
        res.status(201).json({ ok: true, count: casos.length });
    } catch (err) {
        console.error('Erro ao escrever CSV:', err);
        res.status(500).json({ error: 'Erro ao salvar casos.' });
    }
});

// Executa código do aluno
app.post('/execute', async (req, res) => {
    const { language, code, input, expected_output } = req.body;
    console.log('Executando:', { language: language || '<auto>', code: code ? (code.length > 60 ? code.slice(0, 60) + '...' : code) : '', input, expected_output });
    if (!code) {
        return res.status(400).json({ error: 'Campo "code" é obrigatório.' });
    }

    try {
        const result = await executeCode(language, code, input);
        console.log('Resultado do judge:', result);
        let verdict = result.status;

        if (result.status === 'Success') {
            verdict = expected_output && result.output.trim() !== expected_output.trim()
                ? 'Wrong Answer'
                : 'Accepted';
        }

        const finalResponse = {
            verdict,
            output: result.output,
            error: result.error,
        };

        console.log('Resposta final:', finalResponse);
        res.json(finalResponse);
    } catch (err) {
        console.error('Erro no /execute:', err);
        if (err && err.status) {
            return res.json({ verdict: err.status, output: err.output || '', error: err.error || err.message || '' });
        }
        res.status(500).json({ error: 'Erro interno no servidor', details: err && err.message ? err.message : '' });
    }
});

app.get('/health', (req, res) => res.json({ ok: true, pid: process.pid }));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    });
}

module.exports = app;