// ---------------------- Configuração Inicial ----------------------
const API_KEY = "KEY"; // <- cole sua chave aqui

// Link CSV da planilha
const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSdy74VMFCuowXzxgtAcYPDLmU6cj4crafrcd5DrvbltDRYN-_2JbaJZonYOK710n8sVUOhwS5bf9Tl/pub?output=csv";
let dadosPlanilha = [];

async function lerCSV(url) {
  const resp = await fetch(url);
  const text = await resp.text();
  const linhas = text.trim().split("\n").map(l => l.split(","));
  return linhas;
}

const contexto = `Você é um assistente de aprendizado de programação, especializado em orientar alunos utilizando uma versão adaptada do método de George Polya. Seu objetivo é guiar o aluno passo a passo para que ele resolva o problema sozinho.

**Sua atuação deve ser focada em duas etapas principais:**

1.  **CODIFICAÇÃO:**
    * Sua missão é ajudar o aluno a construir o código, um pedaço de cada vez.
    * **Fluxo de Perguntas:**
        * Primeiro, pergunte sobre as **entradas** (variáveis).
        * Depois, pergunte sobre o **processamento** (cálculos/lógica).
        * Por fim, pergunte sobre a **saída** (exibição do resultado).
    * **Feedback:**
        * Mantenha o feedback curto, claro e motivador.
        * Se a resposta do aluno estiver correta ou no caminho certo, comece a sua resposta com "✅".
        * Se estiver incorreta, incompleta ou precisar de mais detalhes, comece com "🤔".
        * Dê **apenas uma dica** por vez, sugerindo o próximo passo ou uma melhoria.
        * **Nunca** forneça o código completo ou a resposta final.

2.  **TESTES E DEPURAÇÃO:**
    * Sua missão é guiar o aluno a encontrar e corrigir erros em seu próprio código.
    * **Fluxo de Interação:**
        * **Primeira Interação:** Peça ao aluno para executar o código com um caso de teste e colar a saída observada.
        * **Análise da Saída do Aluno:**
            * **Se a saída estiver CORRETA:** Comece a resposta com "✅". Elogie o aluno, diga que o resultado está correto e, em seguida, sugira um **novo caso de teste**, focando em situações-limite (ex: zero, números negativos, texto vazio).
            * **Se a saída estiver INCORRETA ou for um ERRO:** Comece a resposta com "🤔". Aponte a discrepância de forma clara ("o esperado era X, mas o código produziu Y"). Forneça **apenas uma dica pontual e incremental** para ajudar o aluno a encontrar o bug, como "Olhe para a linha 15" ou "Verifique a lógica da sua condição if".
    * **Finalização:** Se o aluno disser que terminou e o código está funcionando, parabenize-o e instrua-o a digitar 'finalizar' para escolher um novo desafio.

**Instruções Adicionais:**

* Mantenha um tom encorajador e paciente.
* Nunca responda sobre tópicos que não sejam relacionados à resolução do problema de programação.
* Lembre-se do seu contexto: você está em um chat, não em uma conversa formal. Responda de forma concisa e direta.`;

// ---------------------- Prompts das Etapas ----------------------

const codificacaoInfo = `
    Você está na etapa de CODIFICAÇÃO.
    Fluxo:
    1. Incentivar o aluno a propor um esqueleto inicial de código (mesmo que incompleto).
    2. Conduzir o aluno em pequenas etapas:
       - Declaração das variáveis de entrada.
       - Processamento ou cálculos.
       - Exibição dos resultados.
    3. Sempre dar feedback curto, motivador e claro.
    4. Sugerir UMA melhoria ou próximo passo por vez.
    Use exemplos simples e trechos de código quando for útil.
`;

const testes_depuracaoInfo = `
    Você está na etapa de TESTES E DEPURAÇÃO. O código completo do aluno está abaixo.
    Sua missão é guiar o aluno em um ciclo interativo de testes até que o código funcione corretamente.

    **Seu Fluxo de Conversa:**
    1.  **Primeira Interação:** Na primeira vez que entrar nesta etapa, sua primeira mensagem DEVE ser para pedir ao aluno que **execute o código** com um caso de teste e **cole a saída observada**. Exemplo: "Ótimo! Agora, execute seu código com um caso de teste (por exemplo, com as entradas X e Y) e cole a **saída que você observou** aqui."

    2.  **Análise da Saída do Aluno:** Quando o aluno fornecer a saída do programa, sua tarefa é:
        *   **Analisar a Saída:** Compare a saída fornecida pelo aluno com a saída esperada para o problema.
        *   **Se a Saída estiver CORRETA:** Elogie o aluno ("✅ Excelente! O resultado está correto."). Em seguida, sugira um **novo caso de teste**, focando em casos especiais ou limites (ex: entradas com zero, números negativos, texto vazio, etc.) para garantir que o código é robusto. Peça a ele para rodar este novo teste e mostrar a saída.
        *   **Se a Saída estiver INCORRETA ou for um ERRO:** Aponte a discrepância de forma clara, mas sem dar a resposta. ("🤔 Hmm, o resultado não foi o esperado... Para a entrada X, o esperado seria Y, mas seu código produziu Z."). Em seguida, forneça **UMA ÚNICA dica pontual e incremental** para ajudar o aluno a encontrar o bug. Sugira olhar para uma variável, uma linha específica ou a lógica de uma condição. NÃO entregue o código corrigido.
    
    3.  **Finalização:**
        *   Se o aluno disser que terminou, que o código está funcionando, ou usar palavras como "finalizar" ou "concluir", parabenize-o e instrua-o a digitar **'finalizar'** para escolher um novo desafio. Ex: "Parece que está tudo certo! Se você estiver satisfeito, digite 'finalizar' para voltar ao menu de questões."
`;

// ---------------------- Interface UI ----------------------
const chatWindow = document.getElementById('chatWindow');
const chatBtn = document.getElementById('chatBtn');
const closeBtn = document.getElementById('closeBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');

let model = null;
let currentStep = null;
let questaoAtual = "";

// ---------------------- Contexto da Sessão ----------------------
let sessionContext = {};

function resetSessionContext() {
    sessionContext = {
        question: "",
        understanding: { inputs: "", outputs: "", constraints: "" },
        planning: { plan: "" },
        coding: { snippets: [] },
        testing: { history: [] }
    };
    saveSessionContext();
}

function sessionStorageKey() {
  const keyId = questaoAtual || sessionContext.question || 'global';
  return `contexto_session_${keyId}`;
}

function loadSessionContext() {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      sessionContext = Object.assign({
        question: "",
        understanding: { inputs: "", outputs: "", constraints: "" },
        planning: { plan: "" },
        coding: { snippets: [] },
        testing: { history: [] }
      }, parsed);
    } else {
      resetSessionContext();
    }
  } catch (e) {
    console.error("Erro ao carregar contexto da sessão:", e);
    resetSessionContext();
  }
}

function saveSessionContext() {
  try {
    sessionStorage.setItem(sessionStorageKey(), JSON.stringify(sessionContext));
  } catch (e) {
    console.warn("Erro ao salvar contexto:", e);
  }
}

function buildApiContext(currentStep, userMessage) {
  let context = `
    **Questão Atual:** ${sessionContext.question}

    **Resumo do Progresso do Aluno:**
    - **Entradas Definidas:** ${sessionContext.understanding.inputs || "Ainda não definido."}
    - **Saídas Definidas:** ${sessionContext.understanding.outputs || "Ainda não definido."}
    - **Restrições Definidas:** ${sessionContext.understanding.constraints || "Ainda não definido."}
    - **Trechos de Código Fornecidos:** ${sessionContext.coding.snippets.length > 0 ? sessionContext.coding.snippets.map(s => `\`\`\`\n${s}\n\`\`\``).join('\n') : "Nenhum."}
    - **Histórico de Testes:** ${sessionContext.testing.history.slice(-5).join('|') || "Nenhum."}

    **Tarefa Atual (Etapa: ${currentStep}):**
    O aluno está tentando resolver esta etapa. A mensagem dele é:
    "${userMessage}"

    **Sua Missão (Instruções para a IA):**
    Com base no resumo completo acima, analise a resposta do aluno para a **Tarefa Atual**.
    - Se a resposta para a tarefa atual estiver correta, comece com "✅ Legal!".
    - Se estiver incompleta ou incorreta, comece com "🤔 Vamos pensar mais um pouco..." e dê uma dica construtiva sem entregar a resposta.
    - Mantenha o foco estritamente na **Tarefa Atual do Aluno**. Não se desvie.
  `;
  return context;
}

function updateSessionContext(step, userMessage, aiResponse) {
  try {
    if (!step) return;
    if (step && step.startsWith("codificacao_")) {
      if (userMessage && userMessage.trim()) sessionContext.coding.snippets.push(userMessage);
    } else if (step === "testes_depuracao") {
      sessionContext.testing.history.push(`Aluno: ${userMessage}|IA: ${aiResponse || ""}`);
      if (sessionContext.testing.history.length > 20) {
        sessionContext.testing.history.shift();
      }
    }
    saveSessionContext();
  } catch (e) {
    console.warn("Erro ao atualizar contexto:", e);
  }
}

loadSessionContext();

// ---------------------- Funções de UI ----------------------
function toggleChat() {
  chatWindow.classList.toggle('open');
  if (chatWindow.classList.contains('open')) {
    messageInput.focus();
  }
}

function addMessage(content, isUser = false, isError = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : isError ? 'error' : 'bot'}`;
  messageDiv.textContent = content;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typing';
  typingDiv.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById('typing');
  if (typing) typing.remove();
}

// ---------------------- API ----------------------
async function sendToAPI(message, extraContext = "") {
  showTyping();
  try {
    let text = "Resposta simulada.";
    if (model) {
      const sessionBlock = buildApiContext(currentStep, message);
      const prompt = `${contexto}\n\n${sessionBlock}\n\nContexto adicional: ${extraContext}\n\nQuestão: ${questaoAtual || sessionContext.question || '---'}\n\nAluno: ${message}`;
      const result = await model.generateContent(prompt);
      if (result && result.response) {
        text = await result.response.text();
      } else {
        text = JSON.stringify(result);
      }
    }
    hideTyping();
    addMessage(text);
    return text;
  } catch (error) {
    console.error("Erro:", error);
    hideTyping();
    addMessage("Erro ao consultar a API.", false, true);
  }
}

// ---------------------- Fluxo Principal ----------------------
async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage(message, true);
  messageInput.value = '';

  // ---------------------- Seleção da Questão ----------------------
  if (!sessionContext.question) {
    const numero = parseInt(message);
    if (!isNaN(numero) && numero >= 2 && numero <= 42) {
      resetSessionContext();
      sessionContext.question = `Questão ${numero}: ${dadosPlanilha[numero - 1][0]}`;
      saveSessionContext();
      questaoAtual = dadosPlanilha[numero - 1][0];
      addMessage(`📚 ${sessionContext.question}`);
      addMessage("Vamos começar pela etapa de CODIFICAÇÃO.\n\n❓ Quais são as ENTRADAS (dados de entrada) que o programa receberá?");
      currentStep = "codificacao_variaveis";
    } else {
      addMessage("Digite um número de questão válido (2 a 42).", false, true);
    }
    return;
  }

  // ---------------------- ETAPA 1: CODIFICAÇÃO ----------------------
  
  // Variáveis
  if (currentStep === "codificacao_variaveis") {
    const feedback = await sendToAPI(message, codificacaoInfo + "\nO aluno declarou as variáveis. Se estiver correto, pergunte sobre o processamento.");
    updateSessionContext("codificacao_variaveis", message, feedback);
    
    if (feedback && feedback.includes("✅")) {
      currentStep = "codificacao_processamento";
      addMessage("⚙️ Como ficaria o PROCESSAMENTO (cálculos/lógica) do programa?");
    }
    return;
  }

  // Processamento
  if (currentStep === "codificacao_processamento") {
    const feedback = await sendToAPI(message, codificacaoInfo + "\nO aluno escreveu o processamento. Se estiver correto, pergunte sobre a saída.");
    updateSessionContext("codificacao_processamento", message, feedback);
    
    if (feedback && feedback.includes("✅")) {
      currentStep = "codificacao_saida";
      addMessage("📋 Como você exibiria a SAÍDA/resultado?");
    }
    return;
  }

  // Saída
  if (currentStep === "codificacao_saida") {
    const feedback = await sendToAPI(message, codificacaoInfo + "\nO aluno sugeriu a saída. Se estiver correto, elogie e avance para testes.");
    updateSessionContext("codificacao_saida", message, feedback);
    
    if (feedback && feedback.includes("✅")) {
      currentStep = "testes_depuracao";
      sessionContext.testing = sessionContext.testing || { history: [] };
      sessionContext.testing.awaitingTests = true;
      saveSessionContext();
      addMessage("🧪 Código completo! Etapa de CODIFICAÇÃO concluída!\n\n🔍 ETAPA 4: TESTES E DEPURAÇÃO\nForneça casos de teste (formato: entrada => saída esperada).");
    }
    return;
  }

    // ---------------------- ETAPA 2: TESTES E DEPURAÇÃO ----------------------
  if (currentStep === "testes_depuracao") {
    const cmd = message.toLowerCase().trim();

    // Comando explícito para finalizar a etapa e escolher um novo problema
    if (['finalizar', 'concluir', 'menu', 'novo', 'sair'].includes(cmd)) {
        addMessage('🎉 Parabéns! Você completou o desafio com sucesso!');
        
        // Prepara para a próxima questão
        resetSessionContext(); 
        currentStep = null;      
        questaoAtual = "";
        
        addMessage("🎓 Você pode escolher uma nova questão. Digite o número de 2 a 42.");
        return;
    }

    // O contexto para a IA agora é simples. O prompt principal fará o trabalho pesado.
    const extraContext = `O aluno está na etapa de testes. A mensagem/saída dele é: "${message}"`;
    
    const feedback = await sendToAPI(message, extraContext);
    updateSessionContext('testes_depuracao', message, feedback);
    
    return;
  }


  // ---------------------- Fallback ----------------------
  await sendToAPI(message);
}

// ---------------------- Event Listeners ----------------------
chatBtn.addEventListener('click', toggleChat);
closeBtn.addEventListener('click', toggleChat);
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ---------------------- Inicialização ----------------------
async function initAPI() {
  if (!API_KEY) {
    console.warn("Nenhuma chave definida. Usando modo simulado.");
    addMessage("⚠️ Modo simulado - configure uma API key válida", false, true);
  } else {
    try {
      const { GoogleGenerativeAI } = await import("https://esm.run/@google/generative-ai");
      const genAI = new GoogleGenerativeAI(API_KEY);
      model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", 
        systemInstruction: contexto
      });
      console.log("✅ API carregada com sucesso.");
    } catch (error) {
      console.error("❌ Erro ao carregar a API:", error);
      addMessage("❌ Erro ao conectar com a API", false, true);
    }
  }

  try {
    dadosPlanilha = await lerCSV(URL_CSV);
    addMessage("🎓 Bem-vindo! Digite o número da questão que você quer ajuda (2 a 42).");
  } catch (error) {
    console.error("❌ Erro ao carregar questões:", error);
    addMessage("❌ Não consegui carregar o banco de questões.", false, true);
  }
}

// ---------------------- Iniciar Aplicação ----------------------
initAPI();
