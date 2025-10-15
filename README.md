# 📚 Documentação Completa - Assistente Educacional Gemini

**Versão:** 2.0.0  
**Última atualização:** 14/10/2025

---

## 1. Visão Geral

Este documento é o guia central para o Assistente Educacional Gemini, um sistema interativo projetado para auxiliar no aprendizado de programação. A plataforma combina uma interface de chat, um backend robusto para execução de código e a inteligência da IA Gemini para fornecer tutoria personalizada.

**Principais Funcionalidades:**
- **Frontend Interativo:** Interface de chat para interação com o usuário.
- **Backend com Judge:** API REST em Node.js que utiliza o Judge(máquina do usuário-deve ter instalado os compiladores/interpretadores das linguagens suportadas) para executar código local.
- **Tutoria com IA:** O Gemini guia os estudantes através de um fluxo pedagógico, desde a compreensão do problema até a depuração do código.
- **Validação e Segurança:** Múltiplas camadas de validação para garantir a integridade e a segurança dos dados.
- **Feedback Visual:** Componentes visuais que mostram o progresso da execução dos testes em tempo real.

---

## 2. Guia de Início Rápido

Siga estes passos para configurar e executar o ambiente de desenvolvimento local.

### 2.1. Pré-requisitos
- **Node.js:** Versão 14 ou superior.

Verifique as instalações:
```bash
node --version
docker --version
```

### 2.2. Instalação das Dependências
Navegue até a pasta do servidor e instale os pacotes NPM.
```bash
cd server
npm install
```


### 2.4. Inicialização do Backend
Com o Judge rodando, inicie o servidor da aplicação.
```bash
cd server
node server.js
```
O servidor estará disponível em `http://localhost:3001`.

### 2.5. Acesso ao Frontend
Abra o arquivo `index.html` em um navegador. Para evitar problemas com políticas de CORS, é recomendado usar um servidor web local.

**Opção 1: Live Server (Extensão do VS Code)**
- Clique com o botão direito em `index.html` e selecione "Open with Live Server".

**Opção 2: Python**
```bash
python -m http.server 8000
```

**Opção 3: Node.js**
```bash
npx http-server
```

---

## 3. Arquitetura e Padrões de Projeto

O sistema foi construído com base em princípios de modularidade e separação de responsabilidades.

### 3.1. Estrutura de Arquivos
```
jfdt10-fork/
├── index.html              # Interface principal
├── style.css               # Estilos
├── main.js                 # Lógica do frontend (orquestração)
├── errorHandler.js         # Módulo de tratamento de erros
├── feedbackVisual.js       # Módulo de feedback visual dos testes
├── stateManager.js         # Módulo de gerenciamento de estados
│
└── server/
    ├── server.js           # API REST principal (endpoints)
    ├── judge.js            # Lógica de execução de código (Judge feito rodando máquina pessoal)
    ├── validator.js        # Validação de dados de entrada
    ├── outputComparator.js # Comparação de saídas (esperada vs. real)
    ├── reportGenerator.js  # Geração de relatórios de submissão
    ├── questoes.csv        # Banco de dados de questões
    └── test_cases.csv      # Banco de dados de casos de teste
```

### 3.2. Padrões de Engenharia Aplicados
- **State Machine:** O `stateManager.js` controla o fluxo da aplicação, garantindo que as transições entre etapas (ex: `COMPREENSAO` -> `CODIFICACAO`) sejam válidas.
- **Observer:** O `stateManager` permite que outros módulos "escutem" as mudanças de estado e reajam a elas.
- **Facade:** O `errorHandler.safeFetch()` simplifica a complexidade de fazer requisições `fetch`, adicionando tratamento de erro e logging de forma transparente.
- **Middleware (Backend):** O `validator.js` atua como um middleware no Express, interceptando requisições para validar e sanitizar os dados antes que cheguem à lógica de negócio.
- **Singleton:** Módulos como `stateManager`, `errorHandler` e `feedbackVisual` são instanciados uma única vez e compartilhados por toda a aplicação.

---

## 4. Referência da API

A API REST é o cérebro do sistema, responsável por gerenciar questões, casos de teste e a execução de código.

### `GET /questoes`
- **Descrição:** Lista todas as questões disponíveis.
- **Resposta `200 OK`:**
  ```json
  [
    {
      "id": "1",
      "titulo": "Soma de Dois Números",
      "enunciado": "Escreva um programa que leia dois números...",
      "entrada": "5 3",
      "saida": "8"
    }
  ]
  ```

### `POST /cases`
- **Descrição:** Salva novos casos de teste no banco de dados (`test_cases.csv`).
- **Validações:** `casos` deve ser um array não vazio; cada caso deve ter `questao_id`, `entrada`, `saida`.
- **Body:**
  ```json
  {
    "casos": [
      { "questao_id": "1", "entrada": "10 20", "saida": "30", "tipo": "gerado" }
    ]
  }
  ```
- **Resposta `201 OK`:**
  ```json
  { "ok": true, "count": 1, "message": "Casos de teste salvos com sucesso" }
  ```

### `POST /execute`
- **Descrição:** Executa um único trecho de código com uma entrada específica.
- **Validações:** `code` não pode ser vazio (máx 50KB); `language` deve ser suportada (`python`, `javascript`, `c`, `cpp`).
- **Body:**
  ```json
  {
    "language": "python",
    "code": "print(int(input()) + int(input()))",
    "input": "5\n3",
    "expected_output": "8"
  }
  ```
- **Resposta `200 OK`:**
  ```json
  {
    "output": "8\n",
    "error": "",
    "status": "Success",
    "verdict": "Accepted",
    "executionTime": 45.2,
    "memoryUsage": 12.5
  }
  ```

### `POST /execute-batch`
- **Descrição:** Executa um código contra múltiplos casos de teste.
- **Validações:** Mesmas do `/execute`; `testCases` deve ser um array não vazio (máx 100 casos).
- **Body:**
  ```json
  {
    "language": "python",
    "code": "print(int(input()) + int(input()))",
    "testCases": [
      { "entrada": "5\n3", "saida": "8" },
      { "entrada": "10\n20", "saida": "30" }
    ]
  }
  ```
- **Resposta `200 OK`:**
  ```json
  {
    "status": "Completed",
    "total": 2,
    "passed": 2,
    "results": [
      { "caseId": "case_1", "verdict": "Accepted", "executionTime": 45.2, "...": "..." }
    ]
  }
  ```

---

## 5. Histórico de Melhorias e Correções

Esta seção documenta as principais otimizações e correções de bugs implementadas.

### 5.1. Melhorias de Robustez (Judge e Validação)
- **Normalização de Saídas:** O `outputComparator.js` agora normaliza quebras de linha (`CRLF` vs. `LF`) e espaços em branco antes de comparar as saídas, evitando falsos negativos.
- **Tratamento de Caracteres de Escape:** O `judge.js` converte sequências de escape (ex: `"100\\n200"`) para seus caracteres reais (ex: `"100\n200"`), corrigindo `ValueErrors` em códigos Python.
- **Validação Pré-execução:** Código vazio ou que excede o limite de tamanho é rejeitado antes de ser enviado ao judge, economizando recursos.

| Aspecto | Antes | Depois |
|---|---|---|
| **Inputs com `\n`** | `ValueError` no Python | Funciona (unescape automático) |
| **Saídas com `\r\n`** | `Wrong Answer` inconsistente | Normalizado (sempre `Accepted`) |
| **Código vazio** | Erro obscuro do compilador | Rejeição clara com erro 400 |

### 5.2. Correções de Fluxo e UX (Frontend)
- **Fluxo de Confirmação:** Ao selecionar uma questão, o sistema agora **sempre** exibe botões de "Confirmar" e "Cancelar", garantindo que o usuário não inicie uma sessão acidentalmente.
- **Reset Imediato do Menu:** Ao digitar `nova` ou `finish`, o menu de questões é exibido **imediatamente**, sem `setTimeout`, e todo o contexto da sessão anterior é limpo.
- **Cancelamento de Seleção:** Clicar em "Cancelar" agora limpa o estado da sessão, permitindo que o usuário selecione outra questão corretamente.
- **Bloqueio de Comandos Globais:** Comandos como `nova` são desativados durante etapas críticas (como a confirmação de uma questão) para evitar fluxos inesperados.

---

## 6. Guia de Testes e Troubleshooting

### 6.1. Como Testar o Fluxo Corrigido
1. **Confirmação:** Inicie o chat e digite `1`. A mensagem de confirmação com botões deve aparecer.
2. **Cancelamento:** Digite `2`, e quando os botões aparecerem, clique em "Cancelar". O sistema deve informar o cancelamento e aguardar um novo número.
3. **Finalização:** Selecione e confirme uma questão. Envie um código qualquer. Digite `nova`. O menu de questões deve reaparecer instantaneamente.

### 6.2. Troubleshooting
- **"Não foi possível conectar ao servidor"**:
  1. Verifique se o backend está rodando (`node server/server.js`).
  2. Teste a saúde da API com `curl http://localhost:3001/health`.
- **Erros de execução de código (ex: "No such file or directory")**:
  1. Verifique se não há arquivos faltantes.
- **O fluxo do chat parece "preso" ou inconsistente**:
  1. Limpe o cache do navegador e o `sessionStorage`. Atalho: `Ctrl+Shift+R`.
  2. Abra o console do desenvolvedor (F12) e verifique se há erros ou logs de `stateManager`.
- **Casos de teste não salvam**:
  1. Verifique as permissões de escrita na pasta `server/`.
  2. Confira os logs do servidor para erros relacionados à escrita de arquivos CSV.
