// feedbackVisual.js - Sistema de Feedback Visual Incremental

class FeedbackVisual {
    constructor() {
        this.feedbackContainer = null;
        this.progressBar = null;
        this.testResultsContainer = null;
    }

    /**
     * Inicializa o sistema de feedback visual
     */
    init() {
        this.createFeedbackContainer();
        this.injectStyles();
    }

    /**
     * Cria o container de feedback
     */
    createFeedbackContainer() {
        // Remove container existente se houver
        const existing = document.getElementById('feedback-visual-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = 'feedback-visual-container';
        container.innerHTML = `
            <div class="feedback-header">
                <h3>📊 Progresso da Execução</h3>
                <button class="feedback-close" aria-label="Fechar">✕</button>
            </div>
            <div class="progress-section">
                <div class="progress-bar-container">
                    <div class="progress-bar" id="feedback-progress-bar"></div>
                </div>
                <div class="progress-text" id="feedback-progress-text">0 / 0 testes</div>
            </div>
            <div class="test-results" id="feedback-test-results"></div>
            <div class="summary-section" id="feedback-summary" style="display: none;"></div>
        `;

        document.body.appendChild(container);
        
        this.feedbackContainer = container;
        this.progressBar = document.getElementById('feedback-progress-bar');
        this.progressText = document.getElementById('feedback-progress-text');
        this.testResultsContainer = document.getElementById('feedback-test-results');
        this.summarySection = document.getElementById('feedback-summary');

        const closeBtn = this.feedbackContainer.querySelector('.feedback-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('feedback-visual-styles')) return;

        const style = document.createElement('style');
        style.id = 'feedback-visual-styles';
        style.textContent = `
            #feedback-visual-container {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                padding: 24px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10000;
                display: none;
                animation: slideIn 0.3s ease-out;
            }

            #feedback-visual-container.show {
                display: block;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -45%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }

            .feedback-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 2px solid #e0e0e0;
            }

            .feedback-header h3 {
                margin: 0;
                color: #333;
                font-size: 1.2em;
            }

            .feedback-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                transition: all 0.2s;
            }

            .feedback-close:hover {
                background: #f0f0f0;
                color: #333;
            }

            .progress-section {
                margin-bottom: 24px;
            }

            .progress-bar-container {
                width: 100%;
                height: 24px;
                background: #e0e0e0;
                border-radius: 12px;
                overflow: hidden;
                margin-bottom: 8px;
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                width: 0%;
                transition: width 0.5s ease-out;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                padding-right: 8px;
                color: white;
                font-weight: bold;
                font-size: 12px;
            }

            .progress-bar.error {
                background: linear-gradient(90deg, #f44336, #e91e63);
            }

            .progress-text {
                text-align: center;
                color: #666;
                font-size: 14px;
            }

            .test-results {
                margin-bottom: 16px;
            }

            .test-case-item {
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 8px;
                border-left: 4px solid #ccc;
                background: #f9f9f9;
                animation: fadeIn 0.3s ease-out;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .test-case-item.passed {
                border-left-color: #4CAF50;
                background: #f1f8f4;
            }

            .test-case-item.failed {
                border-left-color: #f44336;
                background: #fef1f1;
            }

            .test-case-item.running {
                border-left-color: #2196F3;
                background: #e3f2fd;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .test-case-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .test-case-title {
                font-weight: bold;
                color: #333;
            }

            .test-case-status {
                font-size: 20px;
            }

            .test-case-details {
                font-size: 13px;
                color: #666;
                margin-top: 4px;
            }

            .test-case-time {
                color: #999;
                font-size: 12px;
            }

            .summary-section {
                padding: 16px;
                background: #f5f5f5;
                border-radius: 8px;
                margin-top: 16px;
            }

            .summary-section.success {
                background: #f1f8f4;
                border: 2px solid #4CAF50;
            }

            .summary-section.partial {
                background: #fff8e1;
                border: 2px solid #FFC107;
            }

            .summary-section.failure {
                background: #fef1f1;
                border: 2px solid #f44336;
            }

            .summary-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 12px;
            }

            .summary-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 12px;
            }

            .stat-item {
                text-align: center;
                padding: 8px;
                background: white;
                border-radius: 6px;
            }

            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #333;
            }

            .stat-label {
                font-size: 12px;
                color: #666;
                margin-top: 4px;
            }

            .spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 3px solid rgba(0,0,0,0.1);
                border-radius: 50%;
                border-top-color: #2196F3;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Mostra o container de feedback
     */
    show() {
        if (!this.feedbackContainer) this.init();
        this.feedbackContainer.classList.add('show');
    }

    /**
     * Esconde o container de feedback
     */
    hide() {
        if (this.feedbackContainer) {
            this.feedbackContainer.classList.remove('show');
        }
    }

    /**
     * Inicia uma nova sessão de testes
     */
    startTestSession(totalTests) {
        this.show();
        this.testResultsContainer.innerHTML = '';
        this.summarySection.style.display = 'none';
        this.updateProgress(0, totalTests);
    }

    /**
     * Atualiza a barra de progresso
     */
    updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        this.progressBar.style.width = `${percentage}%`;
        this.progressText.textContent = `${current} / ${total} testes`;
        
        if (percentage > 0) {
            this.progressBar.textContent = `${Math.round(percentage)}%`;
        }
    }

    /**
     * Adiciona resultado de um teste
     */
    addTestResult(testCase, result, index) {
        const item = document.createElement('div');
        item.className = `test-case-item ${result.verdict === 'Accepted' ? 'passed' : 'failed'}`;
        
        const statusIcon = result.verdict === 'Accepted' ? '✅' : '❌';
        const statusText = result.verdict === 'Accepted' ? 'Passou' : 'Falhou';
        
        item.innerHTML = `
            <div class="test-case-header">
                <span class="test-case-title">Caso de Teste ${index + 1}</span>
                <span class="test-case-status">${statusIcon}</span>
            </div>
            <div class="test-case-details">
                <strong>Status:</strong> ${statusText}
                ${result.executionTime ? `<span class="test-case-time"> • ${result.executionTime.toFixed(2)}ms</span>` : ''}
            </div>
            ${result.verdict !== 'Accepted' ? `
                <div class="test-case-details" style="margin-top: 8px; color: #d32f2f;">
                    <strong>Erro:</strong> ${result.erro || result.error || result.verdict || 'Saída incorreta'}
                </div>
            ` : ''}
        `;
        
        this.testResultsContainer.appendChild(item);
        
        // Scroll para o último resultado
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Mostra teste em execução
     */
    showRunningTest(index) {
        const item = document.createElement('div');
        item.className = 'test-case-item running';
        item.id = `test-running-${index}`;
        
        item.innerHTML = `
            <div class="test-case-header">
                <span class="test-case-title">Caso de Teste ${index + 1}</span>
                <span class="spinner"></span>
            </div>
            <div class="test-case-details">Executando...</div>
        `;
        
        this.testResultsContainer.appendChild(item);
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Remove indicador de teste em execução
     */
    removeRunningTest(index) {
        const item = document.getElementById(`test-running-${index}`);
        if (item) item.remove();
    }

    /**
     * Mostra resumo final
     */
    showSummary(results, totalTime) {
        const total = results.length;
        const passed = results.filter(r => r.verdict === 'Accepted').length;
        const failed = total - passed;
        const percentage = total > 0 ? (passed / total) * 100 : 0;
        
        let summaryClass = 'failure';
        let summaryIcon = '❌';
        let summaryTitle = 'Alguns testes falharam';
        
        if (passed === total) {
            summaryClass = 'success';
            summaryIcon = '🎉';
            summaryTitle = 'Todos os testes passaram!';
        } else if (passed > 0) {
            summaryClass = 'partial';
            summaryIcon = '⚠️';
        }
        
        this.summarySection.className = `summary-section ${summaryClass}`;
        this.summarySection.innerHTML = `
            <div class="summary-title">${summaryIcon} ${summaryTitle}</div>
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-value" style="color: #4CAF50;">${passed}</div>
                    <div class="stat-label">Passou</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: #f44336;">${failed}</div>
                    <div class="stat-label">Falhou</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: #2196F3;">${Math.round(percentage)}%</div>
                    <div class="stat-label">Taxa de Acerto</div>
                </div>
            </div>
            ${totalTime ? `<div style="text-align: center; color: #666; font-size: 13px;">Tempo total: ${totalTime.toFixed(2)}ms</div>` : ''}
        `;
        this.summarySection.style.display = 'block';
        
        // Atualiza cor da barra de progresso
        if (failed > 0) {
            this.progressBar.classList.add('error');
        }
    }

    /**
     * Mostra erro geral
     */
    showError(message) {
        this.show();
        this.testResultsContainer.innerHTML = `
            <div class="test-case-item failed">
                <div class="test-case-header">
                    <span class="test-case-title">❌ Erro</span>
                </div>
                <div class="test-case-details">${message}</div>
            </div>
        `;
    }
}

// Instância global
const feedbackVisual = new FeedbackVisual();

// Exporta para uso como módulo
export { feedbackVisual };
