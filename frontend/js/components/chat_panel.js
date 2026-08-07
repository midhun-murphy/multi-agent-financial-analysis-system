/**
 * chat_panel.js
 * =============
 * Manages the Ask AI interactive chat assistant widget.
 * Prepend-injects prior agent context and format rules into the prompt.
 */

export class ChatPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.history = [];
    this.hasReport = false;
  }

  render(suggestions = []) {
    if (!this.container) return;

    const cachedResult = sessionStorage.getItem('analysis_result');
    this.hasReport = !!cachedResult;

    // Use required suggestions list
    const defaultSuggestions = [
      'Summarize this report',
      'What are the biggest risks?',
      'Explain Revenue',
      'Explain Operating Cash Flow',
      'Compare with competitors',
      'Give investment conclusion',
      'Show strengths and weaknesses',
      'Explain financial health',
      'Which metric should I improve?'
    ];

    const inputPlaceholder = this.hasReport 
      ? "Ask a question about the report..." 
      : "No financial report uploaded. Upload a report to ask questions.";

    const inputDisabled = this.hasReport ? "" : "disabled";

    this.container.innerHTML = `
      <div class="card-title">Ask AI Report Assistant</div>
      
      <div class="chat-panel h-full" style="display: flex; flex-direction: column; justify-content: space-between;">
        <!-- Messages & suggestions chips container -->
        <div class="chat-body" id="chat-scroller" style="flex: 1; overflow-y: auto; max-height: 380px; padding-bottom: 8px;">
          
          ${!this.hasReport ? `
            <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 48px 16px; border: 1px dashed var(--border-color); border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.01); margin-bottom: var(--space-4);">
              No financial report uploaded. <br/>Upload a report to ask questions about the company.
            </div>
          ` : ''}

          <div class="chat-suggestions" id="chat-chips-container" style="${this.hasReport ? 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;' : 'display: none;'}">
            ${defaultSuggestions.map(s => `
              <button class="suggestion-chip" type="button" style="font-size: 11px; padding: 5px 10px; background: var(--bg-card-alt); border: 1px solid var(--border-subtle); border-radius: 12px; color: var(--text-secondary); cursor: pointer;">${s}</button>
            `).join('')}
          </div>

          <div class="chat-messages" id="chat-history-container" style="display: none; flex-direction: column; gap: 12px;">
            <!-- Appended messages dynamically go here -->
          </div>
        </div>

        <!-- Chat Input Form -->
        <form class="chat-input-container" id="chat-input-form" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px; display: flex; gap: 8px;">
          <input 
            type="text" 
            class="chat-input" 
            placeholder="${inputPlaceholder}" 
            id="chat-input-field"
            autocomplete="off"
            required
            ${inputDisabled}
            style="flex: 1; font-size: 13px; background: var(--bg-card-alt); border: 1px solid var(--border-subtle); padding: 10px 14px; border-radius: var(--radius-sm); color: var(--text-primary); outline: none;"
          />
          <button class="chat-send-btn" type="submit" aria-label="Send message" ${inputDisabled} style="padding: 10px 14px; background: var(--accent-blue); color: #fff; border: none; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg class="lucide lucide-send" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
              <line x1="22" x2="11" y1="2" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    `;

    if (this.hasReport) {
      this.initChatListeners();
    }
  }

  initChatListeners() {
    const form = this.container.querySelector('#chat-input-form');
    const input = this.container.querySelector('#chat-input-field');
    const scroller = this.container.querySelector('#chat-scroller');
    const chipsContainer = this.container.querySelector('#chat-chips-container');
    const historyContainer = this.container.querySelector('#chat-history-container');
    const chips = this.container.querySelectorAll('.suggestion-chip');

    // Clicking suggestions populate and send
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.textContent.trim();
        input.value = text;
        this.submitMessage(text, chipsContainer, historyContainer, scroller);
        input.value = '';
      });
    });

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      this.submitMessage(text, chipsContainer, historyContainer, scroller);
      input.value = '';
    });
  }

  async submitMessage(text, chipsContainer, historyContainer, scroller) {
    // Hide suggestions, show message history
    chipsContainer.style.display = 'none';
    historyContainer.style.display = 'flex';

    // Append user message
    this.appendUserMessage(text, historyContainer);
    this.scrollDown(scroller);

    // Trigger typing thinking status indicator
    this.appendThinkingIndicator(historyContainer);
    this.scrollDown(scroller);

    try {
      const chatUrl = window.location.port === '8080' ? 'http://localhost:8000/api/chat' : '/api/chat';
      const sessionResult = sessionStorage.getItem('analysis_result');
      let sessionId = 'default';
      let compiledQuery = text;

      if (sessionResult) {
        try {
          const parsed = JSON.parse(sessionResult);
          sessionId = parsed.session?.session_id || 'default';
          
          // Prepend full agent knowledge base to the prompt query (Objective / Primary Knowledge constraint)
          compiledQuery = this.compileKnowledgeQuery(text, parsed);
        } catch (e) {
          console.error(e);
        }
      }

      // Memory integration (Context Memory constraint)
      this.history.push({ role: 'user', content: text });

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: compiledQuery,
          session_id: sessionId
        })
      });

      this.removeThinkingIndicator(historyContainer);

      if (!response.ok) {
        throw new Error(`Chat API Error ${response.status}`);
      }

      const data = await response.json();
      
      // Store in memory
      this.history.push({ role: 'assistant', content: data.answer });

      // Render parsed layout
      this.appendAssistantMessage(data.answer, historyContainer);
      this.scrollDown(scroller);

    } catch (err) {
      console.error('Chat error:', err);
      this.removeThinkingIndicator(historyContainer);
      this.appendErrorMessage(`Failed to get answer: ${err.message}`, historyContainer);
      this.scrollDown(scroller);
    }
  }

  compileKnowledgeQuery(userText, data) {
    const company = data.company || {};
    const compName = company.name || 'Target Company';
    const ticker = company.ticker || 'TICKER';

    const fm = data.raw_agent_outputs?.financial_metrics;
    const latestYr = fm?.output?.latest_year || fm?.latest_year || '2024';
    const latestMetrics = fm?.output?.historical_metrics?.[latestYr] || {};
    const ratios = data.raw_agent_outputs?.financial_ratios?.output?.latest_ratios || {};
    const healthScore = data.raw_agent_outputs?.financial_health?.output?.overall_score || 80;
    const swot = data.swot || data.raw_agent_outputs?.swot?.output || {};

    const strengths = (swot.strengths || []).map(s => typeof s === 'object' ? s.title : s);
    const weaknesses = (swot.weaknesses || []).map(w => typeof w === 'object' ? w.title : w);

    // Serialize conversational turn history
    let convoHistory = '';
    const lastTurns = this.history.slice(-4);
    lastTurns.forEach(turn => {
      convoHistory += `${turn.role.toUpperCase()}: ${turn.content}\n`;
    });

    return `System: Answer ONLY questions related to the uploaded company "${compName}" (Ticker: "${ticker}").
You are a Financial Report Q&A Assistant. Use this data as your sole source of truth:

--- CORE FINANCIAL METRICS (${latestYr}) ---
Revenue: ${latestMetrics.revenue || 'N/A'} M
Gross Profit: ${latestMetrics.gross_profit || 'N/A'} M
Operating Income: ${latestMetrics.operating_profit || 'N/A'} M
EBITDA: ${latestMetrics.ebitda || 'N/A'} M
Net Profit: ${latestMetrics.net_profit || 'N/A'} M
Total Assets: ${latestMetrics.total_assets || 'N/A'} M
Equity: ${latestMetrics.equity || 'N/A'} M
Total Debt: ${latestMetrics.total_debt || 'N/A'} M
Current Assets: ${latestMetrics.current_assets || 'N/A'} M
Current Liabilities: ${latestMetrics.current_liabilities || 'N/A'} M
Free Cash Flow: ${latestMetrics.free_cash_flow || 'N/A'} M

--- CORE RATIOS (${latestYr}) ---
ROE: ${ratios.roe || 'N/A'}%
ROA: ${ratios.roa || 'N/A'}%
Operating Margin: ${ratios.operating_margin || 'N/A'}%
Net Margin: ${ratios.net_margin || 'N/A'}%
PE Ratio: ${company.pe || 'N/A'}
Debt to Equity: ${ratios.debt_to_equity || 'N/A'}
Current Ratio: ${ratios.current_ratio || 'N/A'}

--- CORE ANALYSIS ---
Health Score: ${healthScore}/100
Strengths: ${strengths.slice(0, 3).join(', ')}
Weaknesses: ${weaknesses.slice(0, 3).join(', ')}
Decision: ${company.overall_decision || 'HOLD'}

--- RECENT CHAT MEMORY ---
${convoHistory}

You must formulate your response using this exact structure (do not skip any tag):
Answer: [Concise direct answer to user's question]
Evidence: [Specific PDF section / metric value / ratio / agent source]
Explanation: [2-5 lines contextualizing the answer]
Investor Insight: [One-line analysis of why this matters for an investor]
Confidence: [High / Medium / Low]

User Question: ${userText}`;
  }

  parseAssistantResponse(text) {
    const lines = text.split('\n');
    let answer = '';
    let evidence = '';
    let explanation = '';
    let insight = '';
    let confidence = 'Medium';

    let currentSection = '';

    lines.forEach(line => {
      const lineLower = line.trim().toLowerCase();
      if (lineLower.startsWith('answer:')) {
        currentSection = 'answer';
        answer = line.substring(7).trim();
      } else if (lineLower.startsWith('evidence:')) {
        currentSection = 'evidence';
        evidence = line.substring(9).trim();
      } else if (lineLower.startsWith('explanation:')) {
        currentSection = 'explanation';
        explanation = line.substring(12).trim();
      } else if (lineLower.startsWith('investor insight:')) {
        currentSection = 'insight';
        insight = line.substring(17).trim();
      } else if (lineLower.startsWith('confidence:')) {
        currentSection = 'confidence';
        confidence = line.substring(11).trim().replace(/[^a-zA-Z]/g, '');
      } else {
        if (currentSection === 'answer') answer += ' ' + line.trim();
        else if (currentSection === 'evidence') evidence += ' ' + line.trim();
        else if (currentSection === 'explanation') explanation += ' ' + line.trim();
        else if (currentSection === 'insight') insight += ' ' + line.trim();
      }
    });

    answer = answer.trim();
    evidence = evidence.trim();
    explanation = explanation.trim();
    insight = insight.trim();

    if (!answer && !evidence && !explanation) {
      return {
        isFormatted: false,
        rawText: text
      };
    }

    return {
      isFormatted: true,
      answer,
      evidence,
      explanation,
      insight,
      confidence
    };
  }

  appendUserMessage(content, container) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message message-user';
    msgEl.innerHTML = `
      <div>${content}</div>
      <div style="font-size: 9px; color: var(--text-muted); text-align: right; margin-top: 4px;">
        ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </div>
    `;
    container.appendChild(msgEl);
  }

  appendAssistantMessage(content, container) {
    const parsed = this.parseAssistantResponse(content);
    const msgEl = document.createElement('div');
    msgEl.className = 'message message-assistant';
    msgEl.style.width = '100%';
    msgEl.style.maxWidth = '100%';

    if (!parsed.isFormatted) {
      msgEl.innerHTML = `
        <div>${content}</div>
        <div style="font-size: 9px; color: var(--text-muted); text-align: right; margin-top: 4px;">
          ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </div>
      `;
    } else {
      const confLower = parsed.confidence.toLowerCase();
      const confBadgeBg = confLower === 'high' ? 'rgba(56, 161, 105, 0.08)' : (confLower === 'low' ? 'rgba(229, 62, 62, 0.08)' : 'rgba(214, 158, 46, 0.08)');
      const confBadgeColor = confLower === 'high' ? 'var(--accent-green)' : (confLower === 'low' ? 'var(--accent-red)' : 'var(--accent-orange)');

      msgEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--space-2); text-align: left;">
          <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${parsed.answer}</div>
          
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; background: rgba(255, 255, 255, 0.015); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px;">
            <strong>Explanation:</strong> ${parsed.explanation}
          </div>

          ${parsed.insight ? `
            <div style="font-size: 12px; color: var(--accent-orange); line-height: 1.4;">
              <strong>Investor Insight:</strong> ${parsed.insight}
            </div>
          ` : ''}

          <div style="display: flex; gap: var(--space-2); align-items: center; margin-top: 4px; flex-wrap: wrap;">
            <span class="badge" style="font-size: 9px; padding: 1px 5px; background: rgba(59, 130, 246, 0.08); color: var(--accent-blue); border: 1px solid rgba(59, 130, 246, 0.15);">Evidence: ${parsed.evidence}</span>
            <span class="badge" style="font-size: 9px; padding: 1px 5px; background: ${confBadgeBg}; color: ${confBadgeColor}; border: 1px solid ${confBadgeBg};">${parsed.confidence} Confidence</span>
            <span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      `;
    }

    container.appendChild(msgEl);
  }

  appendErrorMessage(content, container) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message message-assistant';
    msgEl.style.color = 'var(--accent-red)';
    msgEl.style.background = 'rgba(229, 62, 62, 0.05)';
    msgEl.style.border = '1px dashed var(--accent-red)';
    msgEl.textContent = content;
    container.appendChild(msgEl);
  }

  appendThinkingIndicator(container) {
    const indicator = document.createElement('div');
    indicator.className = 'message message-assistant';
    indicator.id = 'chat-thinking-indicator';
    indicator.innerHTML = `
      <span style="display:inline-flex; gap:3px; align-items:center;">
        Thinking
        <span class="skeleton" style="width:4px; height:4px; border-radius:50%; display:inline-block;"></span>
        <span class="skeleton" style="width:4px; height:4px; border-radius:50%; display:inline-block; animation-delay: 200ms;"></span>
        <span class="skeleton" style="width:4px; height:4px; border-radius:50%; display:inline-block; animation-delay: 400ms;"></span>
      </span>
    `;
    container.appendChild(indicator);
  }

  removeThinkingIndicator(container) {
    const indicator = container.querySelector('#chat-thinking-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  scrollDown(scroller) {
    scroller.scrollTop = scroller.scrollHeight;
  }
}
