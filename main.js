// ---------------------- Configuração Inicial ----------------------
const API_KEY = ""; // Insira sua chave de API aqui

let model = null;
let dadosPlanilha = [];
let casosDeTestePorQuestao = {};

async function carregarCasosTeste() {
  console.log("Tentando carregar casos de teste do backend...");
  try {
    const resp = await fetch('http://localhost:3001/cases');
    if (!resp.ok) {
      throw new Error(`O servidor respondeu com status ${resp.status}`);
    }
    const lista = await resp.json();
    const map = {};
    lista.forEach(c => {
      const qid = String(c.questao_id);
      if (!map[qid]) map[qid] = [];
      map[qid].push({
        entrada: c.entrada || '',
        saida: c.saida || '',
        tipo: c.tipo || 'gerado'
      });
    });
    console.log("Casos de teste carregados com sucesso do backend!");
    return map;
  } catch (e) {
    console.error('❌ Falha ao carregar casos de teste do backend:', e);
    addMessage("❌ Erro: Não foi possível conectar ao servidor de casos de teste. Verifique se ele está rodando.", false, true);
    return {};
  }
}

async function salvarCasosGeradosBackend(questaoId, casosGerados) {
  try {
    const payload = {
      casos: (casosGerados || []).map(c => ({
        questao_id: String(questaoId),
        entrada: String(c.entrada || ''),
        saida: String(c.saida || ''),
        tipo: c.tipo || 'gerado'
      }))
    };
    if (!payload.casos.length) {
      console.log("Nenhum caso novo para salvar.");
      return false;
    }
    const resp = await fetch('http://localhost:3001/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      let errorMsg = `Falha ao salvar (${resp.status})`;
      try {
        const errorData = await resp.json();
        errorMsg += `: ${errorData.error || 'Erro desconhecido no servidor'}`;
      } catch {
        errorMsg += `: ${resp.statusText}`;
      }
      throw new Error(errorMsg);
    }
    const data = await resp.json();
    console.log('Casos salvos com sucesso no backend:', data);
    return true;
  } catch (e) {
    console.error('Erro ao salvar casos no backend:', e.message);
    addMessage(`❌ Erro ao salvar casos permanentemente: ${e.message}`, false, true);
    return false;
  }
}

async function gerarCasosTesteLLM(questao) {
  const prompt = `You are a Programming Tutor AI specialized in helping beginners learn programming.
Your role is to generate test cases (inputs and expected outputs) for beginner-level programming problems.

**Current Problem:**
Title: ${questao.titulo}
Description: ${questao.enunciado}
Example Input: ${questao.entrada}
Example Output: ${questao.saida}

Generate 6-8 comprehensive test cases for this problem (DO NOT include the given example). Focus on:
1. Simple cases (2 cases): Basic functionality
2. Edge cases (2-3 cases): Minimum/maximum values, zero, negative numbers
3. Boundary cases (2-3 cases): Limits of the problem constraints
4. Special cases (1 case): Any unique scenarios

Format your response as a JSON array where each test case is:
{
  "entrada": "input_value_here",
  "saida": "expected_output_here",
  "tipo": "gerado"
}

Only return the JSON array, nothing else. Do not include questao_id in the objects, as it will be added automatically.`;

  try {
    addMessage("🔄 Gerando casos de teste com IA...", false);
    if (!model) {
      console.error("Modelo não inicializado");
      return [];
    }
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    const jsonMatch = text.match(/\[\s*[\s\S]*?\s*\]/);
    if (jsonMatch) {
      const casos = JSON.parse(jsonMatch[0]);
      addMessage(`✅ ${casos.length} casos de teste gerados com sucesso!`, false);
      return casos;
    } else {
      console.error("Resposta do LLM não contém JSON válido:", text);
      addMessage("⚠️ Erro ao processar casos gerados. Usando casos padrão.", false);
      return [];
    }
  } catch (error) {
    console.error("Erro ao gerar casos com LLM:", error);
    addMessage("❌ Erro ao gerar casos de teste. Usando casos padrão.", false);
    return [];
  }
}

async function gerarESalvarCasos(questao) {
  try {
    addMessage("🔄 Gerando casos de teste abrangentes com IA...", false);
    const casosGerados = await gerarCasosTesteLLM(questao);
    if (!casosGerados.length) {
      addMessage("⚠️ Nenhum caso de teste novo foi gerado. Usando apenas os casos existentes.", false);
      return false;
    }
    const casosNovos = casosGerados.filter(c => c.tipo === 'gerado');
    if (casosNovos.length) {
      const salvou = await salvarCasosGeradosBackend(questao.id, casosNovos);
      if (!casosDeTestePorQuestao[questao.id]) casosDeTestePorQuestao[questao.id] = [];
      casosDeTestePorQuestao[questao.id].push(...casosNovos);
      const totalCasos = casosDeTestePorQuestao[questao.id].length;
      const geradosTotal = casosDeTestePorQuestao[questao.id].filter(c => c.tipo === 'gerado').length;
      if (salvou) {
        addMessage(`✅ ${casosNovos.length} novos casos salvos! Total para a questão: ${totalCasos} (${geradosTotal} gerados).`, false);
        addMessage("🎯 Cobertura de teste ampliada com sucesso!", false);
      } else {
        addMessage(`⚠️ ${casosNovos.length} casos gerados, mas não foi possível salvá-los no servidor.`, false);
      }
    }
    return casosNovos.length > 0;
  } catch (error) {
    console.error("Erro no processo de gerar e salvar casos:", error);
    addMessage("❌ Erro crítico ao processar casos de teste.", false, true);
    return false;
  }
}

// ---------------------- Contextos para LLM ----------------------
const contexto = `You are a programming learning assistant, specialized in guiding students using an adapted version of George Polya's method. Your goal is to guide the student step by step so that they solve the problem on their own.

**Your work should focus on two main stages:**

1.  **CODING:**
    * Your mission is to help the student build the code, one piece at a time.
    * **Question Flow:**
        * First, ask about the **inputs** (variables).
        * Then, ask about the **processing** (calculations/logic).
        * Finally, ask about the **output** (displaying results).
    * **Feedback:**
        * Keep feedback short, clear, and motivating.
        * If the answer is correct or on the right track, start your response with "✅".
        * If it is incorrect, incomplete, or needs more details, start with "🤔".
        * Give **only one hint at a time**, suggesting the next step or an improvement.
        * **Never** provide the complete code or final answer.

2.  **TESTING AND DEBUGGING:**
    * Your mission is to guide the student to find and fix errors in their own code.
    * **Interaction Flow:**
        * **First Interaction:** Ask the student to run the code with a test case and paste the observed output.
        * **Analyze Student Output:**
            * **If the output is CORRECT:** Start with "✅". Praise the student, say the result is correct, and then suggest a **new test case**, focusing on edge cases (e.g., zero, negative numbers, empty text).
            * **If the output is INCORRECT or an ERROR:** Start with "🤔". Point out the discrepancy clearly ("expected X, but the code produced Y"). Provide **only one incremental hint** to help the student find the bug, like "Check line 15" or "Review the logic of your if condition".
    * **Completion:** If the student says they are done and the code works, congratulate them and instruct them to type 'finish' to choose a new challenge.

**Additional Instructions:**

* Maintain an encouraging and patient tone.
* Never answer about topics not related to solving the programming problem.
* Remember your context: you are in a chat, not a formal conversation. Respond concisely and directly.`;

const codificacaoInfo = `
    You are in the CODING stage.
    Flow:
    1. Encourage the student to propose an initial code skeleton (even if incomplete).
    2. Guide the student in small steps:
       - Declaring input variables.
       - Processing or calculations.
       - Displaying results.
    3. Always give short, motivating, and clear feedback.
    4. Suggest ONE improvement or next step at a time.
    Use simple examples and code snippets when useful.
`;

const testes_depuracaoInfo = `
    You are in the TESTING AND DEBUGGING stage. The student's complete code is below.
    Your mission is to guide the student in an interactive testing cycle until the code works correctly.

    **Conversation Flow:**
    1. **First Interaction:** On the first time entering this stage, your first message MUST ask the student to **run the code** with a test case and **paste the observed output**. Example: "Great! Now, run your code with a test case (for example, with inputs X and Y) and paste the **output you observed** here."

    2. **Analyze Student Output:** When the student provides the program output, your task is:
        * **Analyze the Output:** Compare the student's output with the expected output.
        * **If Output is CORRECT:** Praise the student ("✅ Excellent! The result is correct."). Then suggest a **new test case**, focusing on special or edge cases (e.g., inputs with zero, negative numbers, empty text, etc.) to ensure robustness. Ask them to run this new test and show the output.
        * **If Output is INCORRECT or an ERROR:** Clearly point out the discrepancy, without giving the answer. ("🤔 Hmm, the result was not as expected... For input X, the expected output was Y, but your code produced Z."). Then provide **ONE single incremental hint** to help the student find the bug. Suggest checking a variable, a specific line, or the logic of a condition. DO NOT provide the corrected code.

    3. **Completion:**
        * If the student says they are finished, that the code works, or uses words like "finish" or "conclude", congratulate them and instruct them to type **'finish'** to return to the question menu. Example: "It looks all correct! If you are satisfied, type 'finish' to return to the question menu."
`;

// ---------------------- Interface UI (CORRIGIDO) ----------------------
let chatWindow, chatBtn, closeBtn, messageInput, codeInput,
    toggleBtn, sendBtn, chatMessages, languageSelector, languageSelect;
let currentStep = null, questaoAtual = "", isCodeMode = false;

// Inicializa referências DOM
function initializeDOMElements() {
  chatWindow      = document.getElementById('chatWindow')   || document.querySelector('.chat-window');
  chatBtn         = document.getElementById('chatBtn')      || document.querySelector('.chat-button');
  closeBtn        = document.getElementById('closeBtn')     || document.querySelector('.close-btn');
  messageInput    = document.getElementById('messageInput');
  codeInput       = document.getElementById('codeInput');
  toggleBtn       = document.getElementById('toggleBtn');
  sendBtn         = document.getElementById('sendBtn');
  chatMessages    = document.getElementById('chatMessages');
  languageSelector= document.getElementById('languageSelector');
  languageSelect  = document.getElementById('languageSelect');
}

// Vincula os event listeners
function setupEventListeners() {
  if (chatBtn) {
    chatBtn.addEventListener('click', e => {
      e.preventDefault();
      toggleChat();
    });
  } else {
    console.error('⛔ chatBtn não encontrado no DOM.');
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.preventDefault();
      toggleChat();
    });
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (toggleBtn) toggleBtn.addEventListener('click', toggleInputMode);

  if (messageInput) {
    messageInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (codeInput) {
    codeInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (languageSelect) {
    languageSelect.addEventListener('change', e => {
      if (e.target.value && sessionContext.questaoId) {
        sessionContext.linguagem = e.target.value;
        saveSessionContext();
        addMessage(`✅ Linguagem ${e.target.value} selecionada! Agora você pode enviar seu código.`, false);
        if (!isCodeMode) toggleInputMode();
      }
    });
  }
}

// Alterna visibilidade do chat
function toggleChat() {
  if (!chatWindow) return;
  chatWindow.classList.toggle('open');
  if (chatWindow.classList.contains('open')) {
    if (isCodeMode && codeInput) codeInput.focus();
    else if (messageInput) messageInput.focus();
  }
}

// Alterna entre modo texto e código
function toggleInputMode() {
  isCodeMode = !isCodeMode;
  if (isCodeMode) {
    if (messageInput) messageInput.style.display = 'none';
    if (codeInput) codeInput.style.display = 'block';
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.title = 'Alternar para texto';
    }
    if (codeInput) codeInput.focus();
  } else {
    if (messageInput) messageInput.style.display = 'block';
    if (codeInput) codeInput.style.display = 'none';
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.title = 'Alternar para código';
    }
    if (messageInput) messageInput.focus();
  }
}

// Exibe mensagem na interface
function addMessage(content, isUser = false, isError = false) {
  if (!chatMessages) return;
  const div = document.createElement('div');
  div.className = `message ${isUser ? 'user' : isError ? 'error' : 'bot'}`;
  div.textContent = content;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  if (!chatMessages) return;
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typing';
  typingDiv.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}
// ---------------------- Fim da Seção de UI ----------------------

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
    **Current Question:** ${sessionContext.question}

    **Student Progress Summary:**
    - **Defined Inputs:** ${sessionContext.understanding.inputs || "Not yet defined."}
    - **Defined Outputs:** ${sessionContext.understanding.outputs || "Not yet defined."}
    - **Defined Constraints:** ${sessionContext.understanding.constraints || "Not yet defined."}
    - **Code Snippets Provided:** ${sessionContext.coding.snippets.length > 0 ? sessionContext.coding.snippets.map(s => `\`\`\`\`\n${s}\n\`\`\`\``).join('\n') : "None."}
    - **Test History:** ${sessionContext.testing.history.slice(-5).join('|') || "None."}

    **Current Task (Stage: ${currentStep}):**
    The student is trying to solve this stage. Their message is:
    "${userMessage}"

    **Your Mission (Instructions for AI):**
    Based on the complete summary above, analyze the student's response to the **Current Task**.
    - If the answer to the current task is correct, start with "✅ Great!".
    - If it's incomplete or incorrect, start with "🤔 Let's think a bit more..." and give a constructive hint without giving away the answer.
    - Keep focus strictly on the **Student's Current Task**. Don't deviate.
  `;
  return context;
}

function updateSessionContext(step, userMessage, aiResponse) {
  try {
    if (!step) return;
    if (step && step.startsWith("codificacao_")) {
      if (userMessage && userMessage.trim()) sessionContext.coding.snippets.push(userMessage);
    } else if (step === "testes_depuracao") {
      sessionContext.testing.history.push(`Student: ${userMessage}|AI: ${aiResponse || ""}`);
      if (sessionContext.testing.history.length > 20) {
        sessionContext.testing.history.shift();
      }
    }
    saveSessionContext();
  } catch (e) {
    console.warn("Erro ao atualizar contexto:", e);
  }
}

// ---------------------- API ----------------------
async function sendToAPI(message, extraContext = "") {
  showTyping();
  try {
    let text = "Resposta simulada - configure o modelo corretamente.";
    if (model) {
      const sessionBlock = buildApiContext(currentStep, message);
      const prompt = `${contexto}\n\n${sessionBlock}\n\nAdditional context: ${extraContext}\n\nQuestion: ${questaoAtual || sessionContext.question || '---'}\n\nStudent: ${message}`;

      const result = await model.generateContent(prompt);
      if (result && result.response) {
        text = await result.response.text();
      } else {
        text = "Erro ao processar resposta da IA.";
      }
    }
    hideTyping();
    addMessage(text);
    return text;
  } catch (error) {
    console.error("Erro na API:", error);
    hideTyping();
    addMessage("Erro ao consultar a API. Verifique a conexão.", false, true);
    return "";
  }
}

// ---------------------- Sistema de Avaliação de Código ----------------------
async function executarCodigoLocalmente(codigo, linguagem, entrada = '', saidaEsperada = '') {
  try {
    const payload = {
      language: linguagem,
      code: codigo,
      input: entrada,
      expected_output: saidaEsperada
    };

    const response = await fetch('http://localhost:3001/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na execução: ${response.status} - ${errorText}`);
    }

    const resultado = await response.json();

    return {
      saida: resultado.output || '',
      erro: resultado.error || '',
      status: resultado.verdict || 'Erro Desconhecido',
      feedbackIA: resultado.ai_feedback || null
    };

  } catch (error) {
    console.error('Erro ao chamar o backend de execução:', error);
    return {
      saida: '',
      erro: `Erro de conexão com o servidor de execução: ${error.message}`,
      status: 'Erro de Conexão com Juiz',
      feedbackIA: null
    };
  }
}

async function avaliarCodigoEstudante(codigo, linguagem, questaoId) {
  const casosTeste = casosDeTestePorQuestao[questaoId] || [];
  if (casosTeste.length === 0) {
    addMessage("⚠️ Nenhum caso de teste encontrado para esta questão.", false, true);
    return { totalCasos: 0, acertos: 0, taxaAcerto: 0, resultados: [] };
  }

  const resultados = [];
  let acertos = 0;

  for (const [index, caso] of casosTeste.entries()) {
    const resultado = await executarCodigoLocalmente(codigo, linguagem, caso.entrada, caso.saida);
    const passou = resultado.status === 'Accepted';

    if (passou) acertos++;

    resultados.push({
      caso: index + 1,
      entrada: caso.entrada,
      esperado: caso.saida,
      obtido: resultado.saida,
      passou,
      erro: resultado.erro,
      status: resultado.status,
      tipo: caso.tipo
    });

    if (resultado.status !== 'Accepted' && resultado.status !== 'Wrong Answer') {
        break; 
    }
  }

  return {
    totalCasos: casosTeste.length,
    acertos,
    taxaAcerto: (acertos / casosTeste.length) * 100,
    resultados
  };
}

async function gerarFeedbackIncremental(questao, codigo, resultadosAvaliacao) {
  const { totalCasos, acertos, resultados } = resultadosAvaliacao;
  const casosFalhos = resultados.filter(r => !r.passou);

  let prompt = `You are a programming tutor helping a beginner student. 

Problem: ${questao.titulo}
Description: ${questao.enunciado}

Student's code:
\`\`\`
${codigo}
\`\`\`

Test Results: ${acertos}/${totalCasos} test cases passed.

`;

  if (casosFalhos.length > 0) {
    prompt += `Failed test cases:\n`;
    casosFalhos.slice(0, 3).forEach((caso, idx) => {
      prompt += `\nTest ${caso.caso} (${caso.tipo}):\n`;
      prompt += `Input: ${caso.entrada}\n`;
      prompt += `Expected: ${caso.esperado}\n`;
      prompt += `Got: ${caso.obtido || 'No output'}\n`;
      if (caso.erro) {
        prompt += `Error: ${caso.erro}\n`;
      }
    });
  }

  prompt += `\nProvide incremental feedback following these rules:
1. DO NOT provide the complete solution
2. Give specific hints about how to improve the code
3. Point out logical errors found
4. If there are syntax errors, explain how to fix them
5. Use encouraging and didactic language
6. Focus on ONE main issue at a time
7. If the code is mostly correct, suggest minor improvements

Respond in Portuguese. Start with ✅ if mostly correct, or 🤔 if needs improvement.

Feedback:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao gerar feedback:", error);
    return "Não foi possível gerar feedback no momento.";
  }
}

async function processarCodigoEstudante(codigo, linguagem, questaoId) {
  addMessage("🔍 Analisando seu código...", false, false);

  try {
    const avaliacao = await avaliarCodigoEstudante(codigo, linguagem, questaoId);

    const questao = dadosPlanilha.find(q => q.id === questaoId);
    const feedback = await gerarFeedbackIncremental(questao, codigo, avaliacao);

    addMessage(feedback, false);

    if (avaliacao.acertos === avaliacao.totalCasos) {
      addMessage("🎉 Parabéns! Seu código passou em todos os testes!", false);
    } else {
      const stats = `📊 Estatísticas: ${avaliacao.acertos}/${avaliacao.totalCasos} casos de teste passaram (${avaliacao.taxaAcerto.toFixed(1)}%)`;
      addMessage(stats, false);
    }

  } catch (error) {
    console.error("Erro ao processar código:", error);
    addMessage("❌ Ocorreu um erro ao processar seu código.", false, true);
  }
}

// ---------------------- Fluxo Principal  ----------------------
async function sendMessage() {
  const inputElement = isCodeMode ? codeInput : messageInput;
  const message = inputElement ? inputElement.value.trim() : '';
  if (!message) return;

  addMessage(message, true);
  if (inputElement) inputElement.value = '';

  if (!sessionContext.question) {
      await handleQuestionSelection(message);
  } else if (isCodeMode) {
      await handleCodeSubmission(message);
  } else {
      await handleGuidedFlow(message);
  }
}

// ---------------------- Seleção da Questão  ----------------------
async function handleQuestionSelection(message) {
  const numero = parseInt(message);
  const questao = dadosPlanilha.find(q => parseInt(q.id) === numero);

  if (!isNaN(numero) && questao) {
      resetSessionContext();
      sessionContext.question = `Questão ${numero}: ${questao.titulo}`;
      sessionContext.questaoId = questao.id;
      saveSessionContext();
      questaoAtual = questao.titulo;

      addMessage(`📚 ${sessionContext.question}`);
      addMessage(`📝 ${questao.enunciado}`);
      addMessage(`Exemplo de entrada:\n${questao.entrada}`);
      addMessage(`Saída esperada:\n${questao.saida}`);

      await gerarESalvarCasos(questao);

      addMessage("Agora você pode enviar seu código (use o ícone </> para alternar) ou seguir o método guiado por texto.");

      if (languageSelector) languageSelector.style.display = 'block';
      currentStep = "codificacao_variaveis";
  } else {
      addMessage("Digite um número de questão válido.", false, true);
  }
}

// ---------------------- Submissão de Código  ----------------------
async function handleCodeSubmission(code) {
  const linguagemSelecionada = languageSelect ? languageSelect.value : '';

  if (!linguagemSelecionada) {
      addMessage("🤔 Por favor, selecione uma linguagem de programação no menu acima antes de enviar o código.", false);
      return;
  }

  sessionContext.linguagem = linguagemSelecionada;
  saveSessionContext();

  await processarCodigoEstudante(code, linguagemSelecionada, sessionContext.questaoId);
}

// ---------------------- Fluxo Guiado  ----------------------
async function handleGuidedFlow(message) {
  const cmd = message.toLowerCase().trim();

  if (['finish', 'complete', 'menu', 'new', 'exit'].includes(cmd)) {
      addMessage('🎉 Parabéns! Você concluiu o desafio com sucesso!');
      resetSessionContext(); 
      currentStep = null;     
      questaoAtual = "";
      if (languageSelector) languageSelector.style.display = 'none';
      addMessage("🎓 Você pode escolher uma nova questão na lista.");
      return;
  }

  if (currentStep === "codificacao_variaveis") {
      const feedback = await sendToAPI(message, codificacaoInfo + "\nO aluno declarou as variáveis. Se estiver correto, peça o processamento.");
      updateSessionContext("codificacao_variaveis", message, feedback);
      if (feedback && feedback.includes("✅")) {
          currentStep = "codificacao_processamento";
          addMessage("⚙️ Ótimo! E como seria o PROCESSAMENTO (os cálculos ou a lógica principal) do programa?");
      }
  } else if (currentStep === "codificacao_processamento") {
      const feedback = await sendToAPI(message, codificacaoInfo + "\nO aluno escreveu o processamento. Se estiver correto, peça a saída.");
      updateSessionContext("codificacao_processamento", message, feedback);
      if (feedback && feedback.includes("✅")) {
          currentStep = "codificacao_saida";
          addMessage("📋 Perfeito! Agora, como você mostraria a SAÍDA (o resultado final)?");
      }
  } else if (currentStep === "codificacao_saida") {
      const feedback = await sendToAPI(message, codificacaoInfo + "\nO aluno sugeriu a saída. Se estiver correto, parabenize e avance para os testes.");
      updateSessionContext("codificacao_saida", message, feedback);
      if (feedback && feedback.includes("✅")) {
          currentStep = "testes_depuracao";
          addMessage("🧪 Fantástico, a lógica está completa! Agora vamos para a fase de TESTES E DEPURAÇÃO.");
          const feedbackTestes = await sendToAPI("Meu código está pronto para testar.", testes_depuracaoInfo);
          updateSessionContext('testes_depuracao', "Meu código está pronto para testar.", feedbackTestes);
      }
  } else if (currentStep === "testes_depuracao") {
      const extraContext = `O aluno está na fase de testes. A mensagem/saída dele é: "${message}"`;
      const feedback = await sendToAPI(message, extraContext);
      updateSessionContext('testes_depuracao', message, feedback);
  } else {
      await sendToAPI(message);
  }
}

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
          console.log("✅ API Gemini carregada com sucesso.");
      } catch (error) {
          console.error("❌ Erro ao carregar a API Gemini:", error);
          addMessage("❌ Erro ao conectar com a API. Verifique a chave e conexão.", false, true);
      }
  }

  try {
      const questoesResponse = await fetch('http://localhost:3001/questoes');
      if (!questoesResponse.ok) {
          throw new Error(`Falha ao buscar questões: ${questoesResponse.statusText}`);
      }
      dadosPlanilha = await questoesResponse.json();

      if (dadosPlanilha.length === 0) {
          throw new Error("Backend não retornou nenhuma questão.");
      }

      casosDeTestePorQuestao = await carregarCasosTeste();

      addMessage("🎓 Bem-vindo ao Assistente Educacional!");
      addMessage("Questões disponíveis:");

      let listaQuestoes = "";
      dadosPlanilha.forEach(questao => {
          listaQuestoes += `${questao.id}. ${questao.titulo}\n`;
      });
      addMessage(listaQuestoes);
      addMessage("Digite o número da questão que deseja resolver:");

  } catch (error) {
      console.error("❌ Erro ao carregar dados do backend:", error);
      addMessage("❌ Erro ao carregar questões e casos de teste. Verifique se o servidor backend está rodando corretamente.", false, true);
  }
}

// ---------------------- Inicialização Principal com DOM ----------------------
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM carregado, iniciando aplicação...");
    loadSessionContext();
    initializeDOMElements();
    setupEventListeners();
    await initAPI();
});
