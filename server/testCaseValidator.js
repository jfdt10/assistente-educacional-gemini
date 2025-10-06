// server/testCaseValidator.js
const Ajv = require('ajv');
const ajv = new Ajv();

const testCaseSchema = {
    type: 'array',
    items: {
        type: 'object',
        required: ['entrada', 'saida', 'tipo'],
        properties: {
            entrada: { type: 'string' },
            saida: { type: 'string' },
            tipo: { 
                type: 'string',
                enum: ['gerado', 'exemplo', 'edge_case', 'boundary']
            },
            descricao: { type: 'string' }
        }
    }
};

const validateTestCases = ajv.compile(testCaseSchema);

class TestCaseValidator {
    static validate(testCases) {
        const isValid = validateTestCases(testCases);
        return {
            isValid,
            errors: validateTestCases.errors || []
        };
    }

    static validateSingle(testCase) {
        return this.validate([testCase]);
    }

    static getErrorMessage(errors) {
        return errors.map(err => 
            `Erro em ${err.instancePath}: ${err.message}`
        ).join('\n');
    }
}

module.exports = TestCaseValidator;