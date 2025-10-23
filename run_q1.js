const fs = require('fs');
const path = require('path');
const http = require('http');
const csvParser = require('csv-parser');

const TEST_CASES_FILE = path.join(__dirname, 'test_cases.csv');
const LOGS_DIR = path.join(__dirname, 'logs');

const userCode = `#include <iostream>
using namespace std;
int main() {
    int X, Y;
    cin >> X >> Y;
    if (X > Y) { int temp = X; X = Y; Y = temp; }
    int soma = 0;
    for (int k = X; k <= Y; k++) {
        if (k % 13 != 0) soma += k;
    }
    cout << soma << endl;
    return 0;
}`;

function readQ1Cases() {
    return new Promise((resolve, reject) => {
        const cases = [];
        fs.createReadStream(TEST_CASES_FILE)
            .pipe(csvParser())
            .on('data', data => {
                if (String(data.questao_id) === '1') {
                    cases.push({ entrada: data.entrada, saida: data.saida, tipo: data.tipo });
                }
            })
            .on('end', () => resolve(cases))
            .on('error', err => reject(err));
    });
}

function postBatch(testCases) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            language: 'cpp',
            code: userCode,
            testCases: testCases,
            questionId: '1'
        });

        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/execute-batch',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', e => reject(e));
        req.write(postData);
        req.end();
    });
}

function findLatestBatchLog() {
    if (!fs.existsSync(LOGS_DIR)) return null;
    const files = fs.readdirSync(LOGS_DIR)
        .filter(f => f.startsWith('submission_batch_') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(LOGS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
    return files.length ? path.join(LOGS_DIR, files[0].name) : null;
}

(async () => {
    try {
        console.log('Reading test cases for question 1...');
        const cases = await readQ1Cases();
        console.log(`Found ${cases.length} cases (including generated/examples).`);
        if (!cases.length) return console.error('No test cases found for question 1.');

        let postCases = cases;
        if (cases.length > 1000) {
            console.log(`Truncating to 1000 cases because server limits batches to 1000 (was ${cases.length}).`);
            postCases = cases.slice(0, 1000);
        }

        console.log('Posting submission to /execute-batch...');
    const result = await postBatch(postCases);
        console.log('Judge response:');
        console.log(JSON.stringify(result, null, 2));

        const latestLog = findLatestBatchLog();
        if (latestLog) {
            console.log('\nLatest saved log file:', latestLog);
            const content = fs.readFileSync(latestLog, 'utf8');
            try {
                const json = JSON.parse(content);
                console.log('Log summary:', JSON.stringify({ submissionId: json.submissionId, summary: json.summary }, null, 2));
            } catch (e) {
                console.log('Raw log content:\n', content);
            }
        } else {
            console.log('No batch log file found in', LOGS_DIR);
        }
    } catch (err) {
        console.error('Error running submission:', err);
    }
})();
