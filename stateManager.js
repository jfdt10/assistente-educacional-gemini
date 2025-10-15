// stateManager.js - Gerenciador de Estados do Fluxo Educacional

/**
 * Estados possíveis do sistema - Fluxo Simplificado
 * 
 * FLUXO COMPLETO:
 * IDLE → COMPREENSAO → [CODIFICAÇÃO GUIADA] → AGUARDANDO_CODIGO → EXECUTANDO_TESTES → TESTES_DEPURACAO → FINALIZADO
 * 
 * OU (submissão direta):
 * IDLE → COMPREENSAO → AGUARDANDO_CODIGO → EXECUTANDO_TESTES → TESTES_DEPURACAO → FINALIZADO
 */
const STATES = {
    IDLE: 'idle',                                       //  Aguardando seleção de questão
    COMPREENSAO: 'compreensao',                         // Leitura e compreensão do problema
    
    // FASE 1: CODIFICAÇÃO GUIADA (3 sub-etapas)
    CODIFICACAO_VARIAVEIS: 'codificacao_variaveis',     //  Codificação: Declarando variáveis de entrada
    CODIFICACAO_PROCESSAMENTO: 'codificacao_processamento', //  Codificação: Lógica e processamento
    CODIFICACAO_SAIDA: 'codificacao_saida',             //  Codificação: Formatando saída

    AGUARDANDO_CODIGO: 'aguardando_codigo',             //  Esperando código completo do aluno

    // FASE 2: TESTES E DEPURAÇÃO
    EXECUTANDO_TESTES: 'executando_testes',             //  Executando casos de teste
    TESTES_DEPURACAO: 'testes_depuracao',               //  Analisando resultados e depurando

    FINALIZADO: 'finalizado'                            //  Questão concluída com sucesso
};

/**
 * Transições válidas entre estados
 * 
 * Duas rotas principais:
 * 1. GUIADA: COMPREENSAO → 3 passos de codificação → AGUARDANDO_CODIGO
 * 2. DIRETA: COMPREENSAO → AGUARDANDO_CODIGO (aluno submete código direto)
 */
const TRANSITIONS = {
    [STATES.IDLE]: [STATES.COMPREENSAO],
    
    // Da compreensão pode: iniciar guiado, submeter código direto, ou voltar ao menu
    [STATES.COMPREENSAO]: [STATES.CODIFICACAO_VARIAVEIS, STATES.AGUARDANDO_CODIGO, STATES.IDLE],
    
    // Sequência guiada de codificação (3 passos)
    [STATES.CODIFICACAO_VARIAVEIS]: [STATES.CODIFICACAO_PROCESSAMENTO, STATES.IDLE],
    [STATES.CODIFICACAO_PROCESSAMENTO]: [STATES.CODIFICACAO_SAIDA, STATES.IDLE],
    [STATES.CODIFICACAO_SAIDA]: [STATES.AGUARDANDO_CODIGO, STATES.IDLE],
    
    // Após receber código, executa testes
    [STATES.AGUARDANDO_CODIGO]: [STATES.EXECUTANDO_TESTES, STATES.IDLE],
    
    // Testes podem ir para depuração ou finalizar (se passou tudo)
    [STATES.EXECUTANDO_TESTES]: [STATES.TESTES_DEPURACAO, STATES.FINALIZADO, STATES.IDLE],
    
    // Na depuração pode: reenviar código, finalizar (se corrigiu), ou voltar ao menu
    [STATES.TESTES_DEPURACAO]: [STATES.AGUARDANDO_CODIGO, STATES.FINALIZADO, STATES.IDLE],
    
    // Do finalizado só volta ao menu
    [STATES.FINALIZADO]: [STATES.IDLE]
};

class StateManager {
    constructor() {
        this.currentState = STATES.IDLE;
        this.previousState = null;
        this.stateHistory = [];
        this.listeners = new Map();
        this.metadata = {};
    }

    /**
     * Obtém o estado atual
     */
    getState() {
        return this.currentState;
    }

    /**
     * Verifica se está em um estado específico
     */
    isState(state) {
        return this.currentState === state;
    }

    /**
     * Verifica se a transição é válida
     */
    canTransitionTo(newState) {
        const allowedTransitions = TRANSITIONS[this.currentState] || [];
        return allowedTransitions.includes(newState);
    }

    /**
     * Transiciona para um novo estado
     */
    transitionTo(newState, metadata = {}) {
        if (!this.canTransitionTo(newState)) {
            console.warn(`⚠️ Transição inválida: ${this.currentState} → ${newState}`);
            return false;
        }

        this.previousState = this.currentState;
        this.stateHistory.push({
            from: this.currentState,
            to: newState,
            timestamp: new Date().toISOString(),
            metadata
        });

        console.log(`🔄 Transição de estado: ${this.currentState} → ${newState}`);
        
        this.currentState = newState;
        this.metadata = { ...this.metadata, ...metadata };
        
        // Notifica listeners
        this.notifyListeners(newState, this.previousState, metadata);
        
        return true;
    }

    /**
     * Força uma transição (use com cuidado)
     */
    forceTransitionTo(newState, metadata = {}) {
        console.warn(`⚠️ Forçando transição: ${this.currentState} → ${newState}`);
        
        this.previousState = this.currentState;
        this.currentState = newState;
        this.metadata = { ...this.metadata, ...metadata };
        
        this.stateHistory.push({
            from: this.previousState,
            to: newState,
            timestamp: new Date().toISOString(),
            metadata,
            forced: true
        });
        
        this.notifyListeners(newState, this.previousState, metadata);
        return true;
    }

    /**
     * Reseta para o estado inicial
     */
    reset() {
        this.previousState = this.currentState;
        this.currentState = STATES.IDLE;
        this.metadata = {};
        
        console.log('🔄 Estado resetado para IDLE');
        this.notifyListeners(STATES.IDLE, this.previousState, { reset: true });
    }

    /**
     * Adiciona um listener para mudanças de estado
     */
    addListener(name, callback) {
        this.listeners.set(name, callback);
    }

    /**
     * Remove um listener
     */
    removeListener(name) {
        this.listeners.delete(name);
    }

    /**
     * Notifica todos os listeners
     */
    notifyListeners(newState, oldState, metadata) {
        this.listeners.forEach((callback, name) => {
            try {
                callback(newState, oldState, metadata);
            } catch (error) {
                console.error(`Erro no listener ${name}:`, error);
            }
        });
    }

    /**
     * Obtém metadados do estado atual
     */
    getMetadata(key) {
        return key ? this.metadata[key] : this.metadata;
    }

    /**
     * Define metadados
     */
    setMetadata(key, value) {
        this.metadata[key] = value;
    }

    /**
     * Obtém histórico de estados
     */
    getHistory() {
        return [...this.stateHistory];
    }

    /**
     * Verifica se está em fase de codificação guiada (3 sub-passos)
     * NÃO inclui AGUARDANDO_CODIGO (que é após o guiado)
     */
    isInCodingPhase() {
        return [
            STATES.CODIFICACAO_VARIAVEIS,
            STATES.CODIFICACAO_PROCESSAMENTO,
            STATES.CODIFICACAO_SAIDA
        ].includes(this.currentState);
    }

    /**
     * Verifica se está em fase de testes e depuração
     * Inclui AGUARDANDO_CODIGO pois o aluno pode estar corrigindo
     */
    isInTestingPhase() {
        return [
            STATES.AGUARDANDO_CODIGO,
            STATES.EXECUTANDO_TESTES,
            STATES.TESTES_DEPURACAO
        ].includes(this.currentState);
    }

    /**
     * Obtém o próximo estado na sequência de codificação guiada
     */
    getNextCodingState() {
        const sequence = [
            STATES.CODIFICACAO_VARIAVEIS,
            STATES.CODIFICACAO_PROCESSAMENTO,
            STATES.CODIFICACAO_SAIDA,
            STATES.AGUARDANDO_CODIGO
        ];
        
        const currentIndex = sequence.indexOf(this.currentState);
        if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
            return sequence[currentIndex + 1];
        }
        
        return null;
    }

    /**
     * Retorna descrição legível do estado atual
     */
    getStateDescription() {
        const descriptions = {
            [STATES.IDLE]: '🏁 Aguardando seleção de questão',
            [STATES.COMPREENSAO]: '📖 Compreendendo o problema',
            [STATES.CODIFICACAO_VARIAVEIS]: '🔤 Codificação: Declarando variáveis de entrada',
            [STATES.CODIFICACAO_PROCESSAMENTO]: '⚙️ Codificação: Implementando lógica e processamento',
            [STATES.CODIFICACAO_SAIDA]: '📋 Codificação: Formatando saída do programa',
            [STATES.AGUARDANDO_CODIGO]: '⌨️ Aguardando código completo do aluno',
            [STATES.EXECUTANDO_TESTES]: '🔄 Executando casos de teste',
            [STATES.TESTES_DEPURACAO]: '🐛 Analisando resultados e auxiliando na depuração',
            [STATES.FINALIZADO]: '✅ Questão concluída com sucesso'
        };
        return descriptions[this.currentState] || this.currentState;
    }

    /**
     * Exporta estado para debug
     */
    exportState() {
        return {
            currentState: this.currentState,
            previousState: this.previousState,
            metadata: this.metadata,
            history: this.stateHistory,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Importa estado (para restauração)
     */
    importState(stateData) {
        if (stateData.currentState) {
            this.currentState = stateData.currentState;
        }
        if (stateData.previousState) {
            this.previousState = stateData.previousState;
        }
        if (stateData.metadata) {
            this.metadata = stateData.metadata;
        }
        if (stateData.history) {
            this.stateHistory = stateData.history;
        }
    }
}

// Exporta constantes e classe
export { STATES, StateManager };
