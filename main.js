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

const contexto =  contexto = `You are a programming learning assistant, specialized in guiding students using an adapted version of George Polya's method. Your goal is to guide the student step by step so that they solve the problem on their own.

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

// ---------------------- Prompts das Etapas ----------------------

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
    **Current Question:** ${sessionContext.question}

    **Student Progress Summary:**
    - **Defined Inputs:** ${sessionContext.understanding.inputs || "Not yet defined."}
    - **Defined Outputs:** ${sessionContext.understanding.outputs || "Not yet defined."}
    - **Defined Constraints:** ${sessionContext.understanding.constraints || "Not yet defined."}
    - **Code Snippets Provided:** ${sessionContext.coding.snippets.length > 0 ? sessionContext.coding.snippets.map(s => `\`\`\`\n${s}\n\`\`\``).join('\n') : "None."}
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
    let text = "Simulated response.";
    if (model) {
      const sessionBlock = buildApiContext(currentStep, message);
      const prompt = `${contexto}\n\n${sessionBlock}\n\nAdditional context: ${extraContext}\n\nQuestion: ${questaoAtual || sessionContext.question || '---'}\n\nStudent: ${message}`;
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
    addMessage("Error consulting the API.", false, true);
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
      sessionContext.question = `Question ${numero}: ${dadosPlanilha[numero - 1][0]}`;
      saveSessionContext();
      questaoAtual = dadosPlanilha[numero - 1][0];
      addMessage(`📚 ${sessionContext.question}`);
      addMessage("Let's start with the CODING stage.\n\n❓ What are the INPUTS (input data) that the program will receive?");
      currentStep = "codificacao_variaveis";
    } else {
      addMessage("Enter a valid question number (2 to 42).", false, true);
    }
    return;
  }

  // ---------------------- ETAPA 1: CODIFICAÇÃO ----------------------
  
  // Variáveis
  if (currentStep === "codificacao_variaveis") {
    const feedback = await sendToAPI(message, codificacaoInfo + "\nThe student declared the variables. If correct, ask about processing.");
    updateSessionContext("codificacao_variaveis", message, feedback);
    
    if (feedback && feedback.includes("✅")) {
      currentStep = "codificacao_processamento";
      addMessage("⚙️ How would the PROCESSING (calculations/logic) of the program look?");
    }
    return;
  }

  // Processamento
  if (currentStep === "codificacao_processamento") {
    const feedback = await sendToAPI(message, codificacaoInfo + "\nThe student wrote the processing. If correct, ask about output.");
    updateSessionContext("codificacao_processamento", message, feedback);
    
    if (feedback && feedback.includes("✅")) {
      currentStep = "codificacao_saida";
      addMessage("📋 How would you display the OUTPUT/result?");
    }
    return;
  }

  // Saída
  if (currentStep === "codificacao_saida") {
    const feedback = await sendToAPI(message, codificacaoInfo + "\nThe student suggested the output. If correct, praise and advance to tests.");
    updateSessionContext("codificacao_saida", message, feedback);
    
    if (feedback && feedback.includes("✅")) {
      currentStep = "testes_depuracao";
      sessionContext.testing = sessionContext.testing || { history: [] };
      sessionContext.testing.awaitingTests = true;
      saveSessionContext();
      addMessage("🧪 Complete code! CODING stage completed!\n\n🔍 STAGE 4: TESTING AND DEBUGGING\nProvide test cases (format: input => expected output).");
    }
    return;
  }

    // ---------------------- ETAPA 2: TESTES E DEPURAÇÃO ----------------------
  if (currentStep === "testes_depuracao") {
    const cmd = message.toLowerCase().trim();

    // Comando explícito para finalizar a etapa e escolher um novo problema
    if (['finish', 'complete', 'menu', 'new', 'exit'].includes(cmd)) {
        addMessage('🎉 Congratulations! You have successfully completed the challenge!');
        
        // Prepara para a próxima questão
        resetSessionContext(); 
        currentStep = null;      
        questaoAtual = "";
        
        addMessage("🎓 You can choose a new question. Enter a number from 2 to 42.");
        return;
    }

    // O contexto para a IA agora é simples. O prompt principal fará o trabalho pesado.
    const extraContext = `The student is in the testing stage. Their message/output is: "${message}"`;
    
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
    addMessage("⚠️ Simulated mode - configure a valid API key", false, true);
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
      addMessage("❌ Error connecting to the API", false, true);
    }
  }

  try {
    dadosPlanilha = await lerCSV(URL_CSV);
    addMessage("🎓 Welcome! Enter the question number you want help with (2 to 42).");
  } catch (error) {
    console.error("❌ Erro ao carregar questões:", error);
    addMessage("❌ Could not load the question bank.", false, true);
  }
}

// ---------------------- Iniciar Aplicação ----------------------
initAPI();
