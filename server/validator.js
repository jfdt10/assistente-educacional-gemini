// server/validator.js - Sistema de Validação de Dados

class Validator {
    /**
     * Valida dados de execução de código
     */
    static validateExecuteRequest(data) {
        const errors = [];

        // Validar código
        if (!data.code || typeof data.code !== 'string') {
            errors.push('Campo "code" é obrigatório e deve ser uma string');
        } else if (data.code.trim().length === 0) {
            errors.push('Campo "code" não pode estar vazio');
        } else if (data.code.length > 50000) {
            errors.push('Campo "code" excede o tamanho máximo (50KB)');
        }

        // Validar linguagem
        const validLanguages = ['python', 'javascript', 'c', 'cpp', 'java'];
        if (data.language && !validLanguages.includes(data.language)) {
            errors.push(`Linguagem "${data.language}" não suportada. Use: ${validLanguages.join(', ')}`);
        }

        // Validar entrada (opcional, mas se fornecida deve ser string)
        if (data.input !== undefined && typeof data.input !== 'string') {
            errors.push('Campo "input" deve ser uma string');
        }

        // Validar saída esperada (opcional)
        if (data.expected_output !== undefined && typeof data.expected_output !== 'string') {
            errors.push('Campo "expected_output" deve ser uma string');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida dados de execução em lote
     */
    static validateBatchRequest(data) {
        const errors = [];

        // Validar linguagem
        if (!data.language || typeof data.language !== 'string' || data.language.trim().length === 0) {
            errors.push('Campo "language" é obrigatório e deve ser uma string');
        }

        // Validar código
        if (!data.code || typeof data.code !== 'string') {
            errors.push('Campo "code" é obrigatório e deve ser uma string');
        }

        // Validar casos de teste
        if (!Array.isArray(data.testCases) || data.testCases.length === 0) {
            errors.push('Campo "testCases" deve ser um array não vazio');
        } else {
            if (data.testCases.length > 1000) {
                errors.push('Número máximo de casos de teste é 1000');
            }

            data.testCases.forEach((testCase, index) => {
                if (testCase.entrada === undefined || testCase.entrada === null) {
                    errors.push(`Caso de teste ${index + 1}: campo "entrada" é obrigatório`);
                }
                if (testCase.saida === undefined || testCase.saida === null) {
                    errors.push(`Caso de teste ${index + 1}: campo "saida" é obrigatório`);
                }
                if (testCase.entrada !== undefined && testCase.entrada !== null && typeof testCase.entrada !== 'string') {
                    errors.push(`Caso de teste ${index + 1}: campo "entrada" deve ser string`);
                }
                if (testCase.saida !== undefined && testCase.saida !== null && typeof testCase.saida !== 'string') {
                    errors.push(`Caso de teste ${index + 1}: campo "saida" deve ser string`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida dados de casos de teste
     */
    static validateTestCases(data) {
        const errors = [];

        if (!data.casos || !Array.isArray(data.casos)) {
            errors.push('Campo "casos" é obrigatório e deve ser um array');
            return { valid: false, errors };
        }

        if (data.casos.length === 0) {
            errors.push('Campo "casos" não pode estar vazio');
        }

        if (data.casos.length > 1000) {
            errors.push('Número máximo de casos é 1000');
        }

        data.casos.forEach((caso, index) => {
            if (!caso.questao_id) {
                errors.push(`Caso ${index + 1}: campo "questao_id" é obrigatório`);
            }
            if (caso.entrada === undefined || caso.entrada === null) {
                errors.push(`Caso ${index + 1}: campo "entrada" é obrigatório`);
            }
            if (caso.saida === undefined || caso.saida === null) {
                errors.push(`Caso ${index + 1}: campo "saida" é obrigatório`);
            }
            if (typeof caso.entrada !== 'string') {
                errors.push(`Caso ${index + 1}: campo "entrada" deve ser string`);
            }
            if (typeof caso.saida !== 'string') {
                errors.push(`Caso ${index + 1}: campo "saida" deve ser string`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitiza entrada de código
     */
    static sanitizeCode(code) {
        if (typeof code !== 'string') return '';
        
        // Remove caracteres de controle perigosos, mas mantém quebras de linha
        return code
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim();
    }

    /**
     * Sanitiza entrada de dados
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    /**
     * Middleware Express para validação
     */
    static createMiddleware(validatorFn) {
        return (req, res, next) => {
            const validation = validatorFn(req.body);
            
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Dados inválidos',
                    details: validation.errors
                });
            }

            // Sanitiza os dados
            if (req.body.code) {
                req.body.code = this.sanitizeCode(req.body.code);
            }
            if (req.body.input) {
                req.body.input = this.sanitizeInput(req.body.input);
            }

            next();
        };
    }
}

module.exports = Validator;
