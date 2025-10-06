// server/outputComparator.js
class OutputComparator {
    static normalizeOutput(str) {
        if (typeof str !== 'string') return String(str);
        return str
            .replace(/\r\n/g, '\n')  // Normaliza quebras de linha
            .replace(/\s+/g, ' ')     // Remove múltiplos espaços
            .trim();                  // Remove espaços no início/fim
    }

    static compareFloats(a, b, tolerance = 1e-9) {
        return Math.abs(parseFloat(a) - parseFloat(b)) <= tolerance;
    }

    static compareWithTolerance(actual, expected, options = {}) {
        const {
            floatTolerance = 1e-9,
            ignoreOrder = false,
            caseSensitive = true,
            trimWhitespace = true
        } = options;

        let a = actual;
        let e = expected;

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

        if (floatTolerance > 0) {
            const aNums = a.split(/\s+/).map(Number);
            const eNums = e.split(/\s+/).map(Number);
            
            if (aNums.length === eNums.length && 
                aNums.every((num, i) => !isNaN(num) && !isNaN(eNums[i]))) {
                return aNums.every((num, i) => 
                    Math.abs(num - eNums[i]) <= floatTolerance
                );
            }
        }

        return a === e;
    }

    static compare(actual, expected, options = {}) {
        try {
            return this.compareWithTolerance(actual, expected, options);
        } catch (error) {
            console.error('Erro na comparação:', error);
            return false;
        }
    }
}

module.exports = OutputComparator;