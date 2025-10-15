// errorHandler.js - Sistema de Tratamento de Erros Robusto

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
    }

    /**
     * Registra um erro no log
     */
    logError(error, context = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message || String(error),
            stack: error.stack || '',
            context: context,
            type: error.name || 'Error'
        };

        this.errorLog.push(errorEntry);
        
        // Limita o tamanho do log
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        console.error('🔴 Erro capturado:', errorEntry);
        return errorEntry;
    }

    /**
     * Trata erros de requisição HTTP
     */
    async handleFetchError(response, context = '') {
        let errorMessage = `Erro ${response.status}: ${response.statusText}`;
        
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
            // Se não conseguir parsear JSON, usa o statusText
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.context = context;
        
        this.logError(error, { context, status: response.status });
        return error;
    }

    /**
     * Mensagens de erro amigáveis para o usuário
     */
    getUserFriendlyMessage(error) {
        const status = error.status || 0;
        
        const messages = {
            0: '❌ Não foi possível conectar ao servidor. Verifique se ele está rodando.',
            400: '⚠️ Dados inválidos enviados. Verifique sua entrada.',
            401: '🔒 Acesso não autorizado.',
            403: '🚫 Acesso negado.',
            404: '🔍 Recurso não encontrado.',
            500: '💥 Erro interno do servidor. Tente novamente.',
            503: '⏸️ Servidor temporariamente indisponível.'
        };

        return messages[status] || `❌ Erro: ${error.message}`;
    }

    /**
     * Wrapper para chamadas fetch com tratamento de erro
     */
    async safeFetch(url, options = {}, context = '') {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw await this.handleFetchError(response, context);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                error.message = 'Não foi possível conectar ao servidor';
                error.status = 0;
            }
            
            this.logError(error, { url, context });
            throw error;
        }
    }

    /**
     * Exibe erro na interface
     */
    displayError(error, targetElement = null) {
        const message = this.getUserFriendlyMessage(error);
        
        if (targetElement) {
            targetElement.innerHTML = `
                <div class="error-message" style="
                    background: #fee;
                    border-left: 4px solid #f44;
                    padding: 12px;
                    margin: 10px 0;
                    border-radius: 4px;
                ">
                    <strong>${message}</strong>
                    ${error.context ? `<br><small>Contexto: ${error.context}</small>` : ''}
                </div>
            `;
        }
        
        return message;
    }

    /**
     * Retorna o log de erros
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * Limpa o log de erros
     */
    clearLog() {
        this.errorLog = [];
    }

    /**
     * Exporta log para análise
     */
    exportLog() {
        return JSON.stringify(this.errorLog, null, 2);
    }
}

// Instância global
const errorHandler = new ErrorHandler();

// Captura erros não tratados
window.addEventListener('error', (event) => {
    errorHandler.logError(event.error, { 
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// Captura promessas rejeitadas não tratadas
window.addEventListener('unhandledrejection', (event) => {
    errorHandler.logError(event.reason, { 
        type: 'unhandled_promise_rejection'
    });
});

// Exporta para uso como módulo ES6
export { errorHandler };
