// server/outputComparator.js
class OutputComparator {
    static normalizeOutput(str) {
        if (typeof str !== 'string') return String(str);
        return str
            .replace(/\r\n/g, '\n')  // Normaliza quebras de linha
            .replace(/\s+/g, ' ')     // Remove múltiplos espaços
            .trim();                  // Remove espaços no início/fim
    }

    static normalizeDecimals(str) {
        if (typeof str !== 'string') return String(str);
        
        // Formato brasileiro: 1.234,56 → 1234.56
        // 1. Remove pontos de milhar
        // 2. Substitui vírgula por ponto
        return str.replace(/(\d)\.(\d{3})/g, '$1$2')  // Remove pontos de milhar
                 .replace(/(\d),(\d)/g, '$1.$2');      // Substitui vírgula por ponto
    }

    static compareFloats(a, b, tolerance = 1e-9) {
        return Math.abs(parseFloat(a) - parseFloat(b)) <= tolerance;
    }

    static compareWithTolerance(actual, expected, options = {}) {
        const {
            floatTolerance = 1e-9,
            ignoreOrder = false,
            caseSensitive = true,
            trimWhitespace = true,
            normalizeDecimals = true
        } = options;

        let a = actual;
        let e = expected;

        // Normaliza separadores decimais ANTES de outras normalizações
        if (normalizeDecimals) {
            a = this.normalizeDecimals(a);
            e = this.normalizeDecimals(e);
        }

        if (trimWhitespace) {
            a = this.normalizeOutput(a);
            e = this.normalizeOutput(e);
        }

        if (!caseSensitive) {
            a = a.toLowerCase();
            e = e.toLowerCase();
        }

        if (ignoreOrder) {
            const aItems = a.split(/\s+/).sort();
            const eItems = e.split(/\s+/).sort();
            return aItems.join(' ') === eItems.join(' ');
        }

        return a === e;
    }

    static compare(actual, expected, options = {}) {
        try {
            const result = this.compareWithTolerance(actual, expected, options);
            return {
                match: result,
                actual: actual,
                expected: expected,
                normalized: {
                    actual: options.normalizeDecimals !== false ? this.normalizeDecimals(actual) : actual,
                    expected: options.normalizeDecimals !== false ? this.normalizeDecimals(expected) : expected
                }
            };
        } catch (error) {
            console.error('Erro na comparação:', error);
            return {
                match: false,
                error: error.message
            };
        }
    }

    static compareSimple(actual, expected, options = {}) {
        try {
            return this.compareWithTolerance(actual, expected, options);
        } catch (error) {
            console.error('Erro na comparação:', error);
            return false;
        }
    }
}

module.exports = OutputComparator;