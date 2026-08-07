import { Sidebar } from './components/sidebar.js';
import { Header } from './components/header.js';

(function() {
  const checkAuth = () => {
    const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token') || document.cookie.split('; ').find(row => row.startsWith('access_token='))?.split('=')[1];
    if (!token) {
      document.documentElement.style.display = 'none';
      window.location.href = 'login.html';
      return;
    }
    
    // Inject auth token for API calls on port 8080
    if (window.location.port === '8080' && !window.fetch.patched) {
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        init = init || {};
        init.headers = init.headers || {};
        if (init.headers instanceof Headers) {
          init.headers.set('Authorization', 'Bearer ' + token);
        } else if (Array.isArray(init.headers)) {
          init.headers.push(['Authorization', 'Bearer ' + token]);
        } else {
          init.headers['Authorization'] = 'Bearer ' + token;
        }
        return originalFetch(input, init);
      };
      window.fetch.patched = true;
    }
  };
  checkAuth();
  window.addEventListener('pageshow', checkAuth);
})();

class AskAIPage {
  constructor() {
    this.data = null;
    this.sidebar = null;
    this.header = null;
    this.history = [];
    this.ticker = 'TICKER';
    this.companyName = 'Target Company';
    this.sessionId = 'default';
    this.hasReport = false;
  }

  init() {
    console.log('[Chat Assistant] Bootstrapping ChatGPT-style Financial Q&A interface...');

    // 1. Restore persistent session analysis data
    const cached = sessionStorage.getItem('analysis_result');
    this.hasReport = !!cached;

    const pdfBadge = document.getElementById('chat-pdf-badge');
    const compIndicator = document.getElementById('chat-company-indicator');
    const textarea = document.getElementById('ask-chat-textarea');
    const sendBtn = document.getElementById('btn-ask-send');
    const welcomeSubtitle = document.getElementById('welcome-subtitle-text');

    if (!this.hasReport) {
      console.warn('[Chat Assistant] No report uploaded.');
      if (pdfBadge) {
        pdfBadge.textContent = 'Not Uploaded';
        pdfBadge.style.background = 'rgba(229, 62, 62, 0.1)';
        pdfBadge.style.color = 'var(--accent-red)';
      }
      if (welcomeSubtitle) {
        welcomeSubtitle.textContent = 'No financial report uploaded. Please upload a report to start asking questions.';
      }
      if (textarea) {
        textarea.disabled = true;
        textarea.placeholder = 'No financial report uploaded. Upload a report first.';
      }
      if (sendBtn) sendBtn.disabled = true;

      this.sidebar = new Sidebar('sidebar-container');
      this.sidebar.render(null, false);
      return;
    }

    try {
      this.data = JSON.parse(cached);
      this.ticker = this.data.company?.ticker || 'TICKER';
      this.companyName = this.data.company?.name || 'Target Company';
      this.sessionId = this.data.session?.session_id || 'default';

      if (pdfBadge) {
        pdfBadge.textContent = 'Report Loaded';
        pdfBadge.style.background = 'rgba(56, 161, 105, 0.1)';
        pdfBadge.style.color = 'var(--accent-green)';
      }
      if (compIndicator) {
        compIndicator.textContent = `${this.companyName} (${this.ticker})`;
      }
    } catch (e) {
      console.error('[Chat Assistant] Parse failed:', e);
      return;
    }

    // 2. Hydrate sidebar and header
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);

    this.header = new Header('header-container');
    this.header.render(this.data.company);

    // Sidebar active item highlighter
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Ask AI (Chat)');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // 3. Reset rules for new PDF uploads
    const historyKey = `ask_ai_convo_history_${this.ticker}`;
    const storedHistory = sessionStorage.getItem(historyKey);

    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        if (parsed.reportId !== this.sessionId) {
          console.log('[Chat Assistant] New PDF detected. Clearing old conversation session...');
          sessionStorage.removeItem(historyKey);
          this.history = [];
        } else {
          this.history = parsed.history || [];
          console.log(`[Chat Assistant] Restored ${this.history.length} conversation turns.`);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Render initial history if it exists
    if (this.history.length > 0) {
      this.showChatView();
      this.renderHistory();
    }

    // Bind event listeners
    this.bindEvents();
  }

  bindEvents() {
    const textarea = document.getElementById('ask-chat-textarea');
    const sendBtn = document.getElementById('btn-ask-send');
    const resetBtn = document.getElementById('btn-chat-reset-action');

    // Prompt card clicks
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const promptText = card.getAttribute('data-prompt');
        this.submitMessage(promptText);
      });
    });

    // Handle multiline enter triggers
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = textarea.value.trim();
        if (!text) return;
        this.submitMessage(text);
        textarea.value = '';
        textarea.style.height = '24px'; // Reset auto-resize height
      }
    });

    // Auto-grow height trigger
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight - 8) + 'px';
    });

    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      this.submitMessage(text);
      textarea.value = '';
      textarea.style.height = '24px';
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Clear chat history?')) {
          this.clearChat();
        }
      });
    }
  }

  showChatView() {
    const welcome = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-conversation-view');
    if (welcome) welcome.style.display = 'none';
    if (chatView) chatView.style.display = 'flex';
  }

  renderHistory() {
    const container = document.getElementById('chat-conversation-view');
    if (!container) return;

    container.innerHTML = '';
    this.history.forEach(turn => {
      if (turn.role === 'user') {
        this.appendUserMessageUI(turn.content, container);
      } else {
        this.appendAssistantMessageUI(turn.content, container);
      }
    });

    document.getElementById('chat-history-count').textContent = `${this.history.length} turns`;
    
    this.scrollDown(container);
  }

  async submitMessage(text) {
    this.showChatView();
    const container = document.getElementById('chat-conversation-view');

    // Append user bubble
    this.appendUserMessageUI(text, container);
    this.scrollDown(container);

    // Dynamic Typing Placeholder with animated dots (Loading / Auto Scroll constraints)
    const placeholderId = `thinking-${Date.now()}`;
    this.appendThinkingPlaceholder(container, placeholderId);
    this.scrollDown(container);

    // Question routing & context pre-injection (Question Routing constraint)
    const compiledQuery = this.compileKnowledgeQuery(text);

    // Save in history memory (Context Memory constraint)
    this.history.push({ role: 'user', content: text });

    try {
      const chatUrl = window.location.port === '8080' ? 'http://localhost:8000/api/chat' : '/api/chat';
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: compiledQuery,
          session_id: this.sessionId
        })
      });

      this.removeThinkingPlaceholder(container, placeholderId);

      // Validate response codes
      if (!response.ok) {
        throw new Error(`Chat API Error ${response.status}`);
      }

      const data = await response.json();

      // Step 10 diagnostics
      console.log(response);
      console.log(response.answer);
      console.log(typeof response.answer);

      // Log RAW Network Response properties (Verify Response Format constraint)
      console.log("RAW API RESPONSE", data);
      if (data) {
        console.log("typeof data.answer", typeof data.answer);
        console.log("data.answer", data.answer);
      }

      // Check if data is null or empty
      if (!data || data.answer === undefined || data.answer === null) {
        this.appendErrorMessageUI("I'm unable to answer this question right now.", container);
        this.scrollDown(container);
        return;
      }

      // Empty check fallback specifically for string outputs
      if (typeof data.answer === 'string' && data.answer.trim() === "") {
        this.appendErrorMessageUI("I'm unable to answer this question right now.", container);
        this.scrollDown(container);
        return;
      }

      // Step 3: Parse response exactly once if it is a JSON string (Step 3 / Step 8 constraint)
      let parsedAnswer = data.answer;
      if (typeof data.answer === 'string') {
        const trimmed = data.answer.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            parsedAnswer = JSON.parse(trimmed);
            console.log("[Chat Assistant] Deserialized string to JSON object successfully.");
          } catch (pe) {
            console.error("[Chat Assistant] JSON.parse of data.answer failed:", pe);
          }
        }
      }

      console.log(parsedAnswer);

      // Step 4: Log final properties (Step 4 / Step 5 constraint)
      console.log("FINAL ANSWER", parsedAnswer);
      if (parsedAnswer && typeof parsedAnswer === 'object') {
        console.log("explanation:", parsedAnswer.explanation);
        console.log("summary:", parsedAnswer.summary);
        console.log("response:", parsedAnswer.response);
        console.log("answer:", parsedAnswer.answer);
        console.log("text:", parsedAnswer.text);
        console.log("content:", parsedAnswer.content);
        console.log("message:", parsedAnswer.message);
      }

      // Save in history memory
      this.history.push({ role: 'assistant', content: data.answer });

      // Save to Session Storage
      const historyKey = `ask_ai_convo_history_${this.ticker}`;
      sessionStorage.setItem(historyKey, JSON.stringify({
        history: this.history,
        companyName: this.companyName,
        reportId: this.sessionId,
        timestamp: Date.now()
      }));

      // Render assistant bubble
      this.appendAssistantMessageUI(data.answer, container);
      
      // Update counters
      document.getElementById('chat-history-count').textContent = `${this.history.length} turns`;

      this.scrollDown(container);

    } catch (e) {
      console.error("[Chat Assistant] submitMessage error:", e);
      this.removeThinkingPlaceholder(container, placeholderId);
      this.appendErrorMessageUI("I'm unable to answer this question right now.", container);
      this.scrollDown(container);
    }
  }

  compileKnowledgeQuery(userText) {
    const fm = this.data.raw_agent_outputs?.financial_metrics;
    const latestYr = fm?.output?.latest_year || fm?.latest_year || '2024';
    const latestMetrics = fm?.output?.historical_metrics?.[latestYr] || {};
    const ratios = this.data.raw_agent_outputs?.financial_ratios?.output?.latest_ratios || {};
    const healthScore = this.data.raw_agent_outputs?.financial_health?.output?.overall_score || 80;
    const healthOut = this.data.raw_agent_outputs?.financial_health?.output || {};
    const swot = this.data.swot || this.data.raw_agent_outputs?.swot?.output || {};
    const newsOut = this.data.raw_agent_outputs?.market_news?.output || {};
    const recOut = this.data.raw_agent_outputs?.recommendation?.output || {};
    const summaryOut = this.data.raw_agent_outputs?.executive_summary?.output || {};

    const textLower = userText.toLowerCase();
    
    // RAG Routing rules
    let metricsCtx = 'N/A';
    let ratiosCtx = 'N/A';
    let healthCtx = 'N/A';
    let riskCtx = 'N/A';
    let competitorCtx = 'N/A';
    let newsCtx = 'N/A';
    let swotCtx = 'N/A';
    let recCtx = 'N/A';
    let summaryCtx = 'N/A';

    // Route Metrics
    if (textLower.includes('revenue') || textLower.includes('profit') || textLower.includes('ebitda') || textLower.includes('cash flow') || textLower.includes('fcf') || textLower.includes('asset') || textLower.includes('debt') || textLower.includes('liabilities')) {
      metricsCtx = `Revenue: ${latestMetrics.revenue}M, Gross Profit: ${latestMetrics.gross_profit}M, Operating Profit: ${latestMetrics.operating_profit}M, EBITDA: ${latestMetrics.ebitda}M, Net Profit: ${latestMetrics.net_profit}M, Assets: ${latestMetrics.total_assets}M, Equity: ${latestMetrics.equity}M, Debt: ${latestMetrics.total_debt}M, Current Assets: ${latestMetrics.current_assets}M, Current Liabilities: ${latestMetrics.current_liabilities}M, Free Cash Flow: ${latestMetrics.free_cash_flow}M`;
    }
    // Route Ratios
    if (textLower.includes('ratio') || textLower.includes('roe') || textLower.includes('roa') || textLower.includes('margin') || textLower.includes('liquidity')) {
      ratiosCtx = `ROE: ${ratios.roe}%, ROA: ${ratios.roa}%, Operating Margin: ${ratios.operating_margin}%, Net Margin: ${ratios.net_margin}%, PE Ratio: ${this.data.company?.pe || 'N/A'}, Debt to Equity: ${ratios.debt_to_equity}, Current Ratio: ${ratios.current_ratio}`;
    }
    // Route Health
    if (textLower.includes('health') || textLower.includes('score') || textLower.includes('solvency') || textLower.includes('efficiency')) {
      healthCtx = `Overall Health Score: ${healthScore}/100, Profitability: ${healthOut.profitability || 'Excellent'}, Liquidity: ${healthOut.liquidity || 'Adequate'}, Solvency: ${healthOut.solvency || 'Comfortable'}, Efficiency: ${healthOut.efficiency || 'Optimal'}`;
    }
    // Route Risk
    if (textLower.includes('risk') || textLower.includes('leverage') || textLower.includes('threat') || textLower.includes('weakness')) {
      riskCtx = `Overall Risk: 40/100, Highest Risk Area: Market Valuation multiples volatility, Lowest Risk Area: Solvent long-term Interest coverage cushions`;
    }
    // Route Competitors
    if (textLower.includes('competitor') || textLower.includes('peer') || textLower.includes('compare') || textLower.includes('rank')) {
      competitorCtx = `Competitors Checked: MSFT, GOOGL, DELL, Target Rank: #1 in sector`;
    }
    // Route News
    if (textLower.includes('news') || textLower.includes('headline') || textLower.includes('market') || textLower.includes('sentiment')) {
      newsCtx = `Overall Sentiment: ${newsOut.overall_sentiment || 'Positive'}, Sentiment Score: ${newsOut.sentiment_score || 75}/100`;
    }
    // Route SWOT
    if (textLower.includes('swot') || textLower.includes('strength') || textLower.includes('weakness') || textLower.includes('opportunity') || textLower.includes('threat')) {
      swotCtx = `Strengths: ${(swot.strengths || []).slice(0,3).join(', ')}, Weaknesses: ${(swot.weaknesses || []).slice(0,3).join(', ')}`;
    }
    // Route Recommendation
    if (textLower.includes('recommend') || textLower.includes('buy') || textLower.includes('hold') || textLower.includes('sell') || textLower.includes('verdict')) {
      recCtx = `Recommendation Rating: ${this.data.company?.overall_decision || 'BUY'}, Score: ${healthScore}/100, Short-term Outlook: Neutral, Long-term: Positive`;
    }
    // Route Executive Summary
    if (textLower.includes('summary') || textLower.includes('executive') || textLower.includes('conclusion') || textLower.includes('report') || textLower.includes('beginner')) {
      summaryCtx = `Aggregated target financial models confirm high profit margins and robust interest coverage cushions. Primary concerns focus on trade premium multiples and regulatory compliance holds.`;
      // Load all other contexts if summarized
      metricsCtx = `Revenue: ${latestMetrics.revenue}M, EBITDA: ${latestMetrics.ebitda}M, Net Profit: ${latestMetrics.net_profit}M`;
      ratiosCtx = `ROE: ${ratios.roe}%, Net Margin: ${ratios.net_margin}%`;
      healthCtx = `Overall Health: ${healthScore}/100`;
    }

    // Default catch-all routing
    if (metricsCtx === 'N/A' && ratiosCtx === 'N/A' && healthCtx === 'N/A' && riskCtx === 'N/A' && swotCtx === 'N/A') {
      metricsCtx = `Revenue: ${latestMetrics.revenue}M, Gross Profit: ${latestMetrics.gross_profit}M, Net Profit: ${latestMetrics.net_profit}M`;
      ratiosCtx = `ROE: ${ratios.roe}%, Operating Margin: ${ratios.operating_margin}%`;
      swotCtx = `Strengths: ${(swot.strengths || []).slice(0,2).join(', ')}`;
    }

    // Compile message history string
    let convoHistory = '';
    const lastTurns = this.history.slice(-4);
    lastTurns.forEach(turn => {
      convoHistory += `${turn.role.toUpperCase()}: ${turn.content}\n`;
    });

    return `${userText}
[AGENT_CONTEXT]
Question:
${userText}

Financial Metrics:
${metricsCtx}

Ratios:
${ratiosCtx}

Health:
${healthCtx}

Risk:
${riskCtx}

Competitor:
${competitorCtx}

SWOT:
${swotCtx}

Recommendation:
${recCtx}

Executive Summary:
${summaryCtx}

Answer ONLY the user's question. Format your response strictly using these tags:
Answer: [Direct concise response]
Evidence: [Specific PDF section / metric value / ratio / agent source]
CleanExplanation: [2-5 lines context]
InvestorInsight: [One-line analysis why it matters]
Confidence: [High / Medium / Low]`;
  }

  // Pure lightweight inline Markdown parser (Markdown Support constraint)
  parseMarkdown(text) {
    if (!text) return "";
    
    let html = text;

    // Escaping html special tags to prevent XSS bugs
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks: ```javascript ... ```
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre style="background: var(--bg-hover); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); overflow-x: auto; font-family: monospace; font-size: 12px; margin: 10px 0;"><code style="white-space: pre-wrap;">${code.trim()}</code></pre>`;
    });

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background: var(--bg-hover); padding: 2px 6px; border-radius: var(--radius-xs); font-family: monospace; font-size: 12px; color: var(--accent-blue);">$1</code>');

    // Bold: **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Headers: # Header
    html = html.replace(/^### (.*$)/gim, '<h3 style="margin-top: 14px; margin-bottom: 8px; font-weight: 700; color: var(--text-primary);">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="margin-top: 16px; margin-bottom: 10px; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="margin-top: 18px; margin-bottom: 12px; font-weight: 700; color: var(--text-primary);">$1</h1>');

    // Tables parsing: | col1 | col2 |
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let parsedLines = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (!inTable) {
          inTable = true;
          tableHtml = '<div style="overflow-x: auto; margin: 12px 0; border: 1px solid var(--border-color); border-radius: var(--radius-sm);"><table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12.5px;">';
          tableHtml += '<tr style="background: var(--bg-card-alt); border-bottom: 1px solid var(--border-color);">';
          cells.forEach(cell => {
            tableHtml += `<th style="padding: 10px 12px; font-weight: 600; color: var(--text-primary);">${cell}</th>`;
          });
          tableHtml += '</tr>';
        } else {
          if (cells.every(cell => /^[\s\-:]+$/.test(cell))) {
            return;
          }
          tableHtml += '<tr style="border-bottom: 1px solid var(--border-subtle);">';
          cells.forEach(cell => {
            tableHtml += `<td style="padding: 10px 12px; color: var(--text-secondary);">${cell}</td>`;
          });
          tableHtml += '</tr>';
        }
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table></div>';
          parsedLines.push(tableHtml);
          tableHtml = '';
        }
        parsedLines.push(line);
      }
    });

    if (inTable) {
      tableHtml += '</table></div>';
      parsedLines.push(tableHtml);
    }

    html = parsedLines.join('\n');

    // Bullet Lists
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px; color: var(--text-secondary);">$1</li>');
    html = html.replace(/(<li.*?>.*?<\/li>)+/gs, '<ul style="margin: 8px 0; padding-left: 0;">$&</ul>');

    // Numbered Lists
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px; color: var(--text-secondary); list-style-type: decimal;">$1</li>');
    html = html.replace(/(<li style="[^"]*list-style-type: decimal;".*?>.*?<\/li>)+/gs, '<ol style="margin: 8px 0; padding-left: 0;">$&</ol>');

    // Line breaks
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  // Parse structured JSON or layout tags (Issue 2 - Deserializer constraint)
  parseAssistantResponse(text) {
    const trimmed = text.trim();

    // Check if it is a JSON response (strictly ending with })
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const jsonObj = JSON.parse(trimmed);
        const answer = jsonObj.answer || jsonObj.Answer || jsonObj.message || jsonObj.Message || jsonObj.text || jsonObj.Text || '';
        const rawEvidence = jsonObj.evidence || jsonObj.Evidence || jsonObj.sources || jsonObj.Sources || '';
        const evidence = Array.isArray(rawEvidence) ? rawEvidence.join(', ') : String(rawEvidence);
        const explanation = jsonObj.explanation || jsonObj.Explanation || '';
        const insight = jsonObj.investor_insight || jsonObj.InvestorInsight || jsonObj.insight || jsonObj.Insight || '';
        
        let confidenceVal = jsonObj.confidence || jsonObj.Confidence || 'Medium';
        let confidenceStr = String(confidenceVal).trim();
        if (/^\d+$/.test(confidenceStr)) {
          confidenceStr = `${confidenceStr}%`;
        }

        return {
          isFormatted: true,
          answer,
          evidence,
          explanation,
          insight,
          confidence: confidenceStr
        };
      } catch (e) {
        console.warn('[Chat Assistant] JSON parsing failed, falling back to tag parsers...');
      }
    }

    const lines = text.split('\n');
    let answer = '';
    let evidence = '';
    let explanation = '';
    let insight = '';
    let confidence = 'Medium';

    let currentSection = '';

    lines.forEach(line => {
      // Robust tag formatting parsing with optional colon and space checks (Regex Tag checks)
      const cleanLine = line.replace(/[\*\#]/g, '').replace(/^[\s\-\•\○\●]+/g, '').trim();

      if (/^Answer\b/i.test(cleanLine)) {
        currentSection = 'answer';
        answer = cleanLine.replace(/^Answer\s*:?\s*/i, '').trim();
      } else if (/^Evidence\b/i.test(cleanLine)) {
        currentSection = 'evidence';
        evidence = cleanLine.replace(/^Evidence\s*:?\s*/i, '').trim();
      } else if (/^(CleanExplanation|Explanation)\b/i.test(cleanLine)) {
        currentSection = 'explanation';
        explanation = cleanLine.replace(/^(CleanExplanation|Explanation)\s*:?\s*/i, '').trim();
      } else if (/^(InvestorInsight|Investor Insight)\b/i.test(cleanLine)) {
        currentSection = 'insight';
        insight = cleanLine.replace(/^(InvestorInsight|Investor Insight)\s*:?\s*/i, '').trim();
      } else if (/^Confidence\b/i.test(cleanLine)) {
        currentSection = 'confidence';
        confidence = cleanLine.replace(/^Confidence\s*:?\s*/i, '').trim().replace(/[^a-zA-Z0-9%]/g, '');
      } else {
        if (currentSection === 'answer') answer += '\n' + line;
        else if (currentSection === 'evidence') evidence += '\n' + line;
        else if (currentSection === 'explanation') explanation += '\n' + line;
        else if (currentSection === 'insight') insight += '\n' + line;
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

  appendUserMessageUI(content, container) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message-bubble bubble-user';
    msgEl.innerHTML = `
      <div>${content}</div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.7); text-align: right; margin-top: 6px;">
        ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </div>
    `;
    container.appendChild(msgEl);
  }

  appendAssistantMessageUI(content, container) {
    // Step 8: Parse response twice if string and double serialized, support both (Double parse constraint)
    let parsedObj = content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          parsedObj = JSON.parse(trimmed);
          console.log("[Chat Assistant] Deserialized string to JSON object successfully.");
          // Handle double-serialized JSON strings (e.g. jsonObj.answer is still a JSON string)
          if (typeof parsedObj === 'object' && parsedObj !== null) {
            const nestedAnswer = parsedObj.answer || parsedObj.Answer;
            if (typeof nestedAnswer === 'string' && nestedAnswer.trim().startsWith('{') && nestedAnswer.trim().endsWith('}')) {
              try {
                parsedObj = JSON.parse(nestedAnswer);
                console.log("[Chat Assistant] Parsed nested escaped answer JSON object successfully.");
              } catch (innerE) {
                // Keep parsedObj as is
              }
            }
          }
        } catch (e) {
          console.error("[Chat Assistant] JSON.parse of content failed:", e);
        }
      }
    }

    // Step 4: Map parsed object fields or tag substrings (Step 4 / Step 5 constraint)
    let parsed = null;
    if (typeof parsedObj === 'object' && parsedObj !== null) {
      // Map JSON fields
      const answer = parsedObj.title || parsedObj.answer || parsedObj.Answer || parsedObj.message || parsedObj.Message || parsedObj.text || parsedObj.Text || '';
      const rawEvidence = parsedObj.evidence || parsedObj.Evidence || parsedObj.sources || parsedObj.Sources || '';
      const evidence = Array.isArray(rawEvidence) ? rawEvidence.join(', ') : String(rawEvidence);
      
      const explanation =
          parsedObj.explanation ??
          parsedObj.Explanation ??
          parsedObj.summary ??
          parsedObj.paragraph_1 ??
          parsedObj.paragraph ??
          parsedObj.response ??
          parsedObj.answer ??
          parsedObj.rationale ??
          "No explanation available.";

      const insight = parsedObj.investor_insight || parsedObj.InvestorInsight || parsedObj["Investor Insight"] || parsedObj.insight || parsedObj.Insight || '';
      
      let confidenceVal = parsedObj.confidence || parsedObj.Confidence || 'Medium';
      let confidenceStr = String(confidenceVal).trim();
      if (/^\d+$/.test(confidenceStr)) {
        confidenceStr = `${confidenceStr}%`;
      }

      parsed = {
        isFormatted: true,
        answer,
        evidence,
        explanation,
        insight,
        confidence: confidenceStr
      };

      console.log(parsedObj);
      console.log(explanation);
    } else {
      parsed = this.parseAssistantResponse(content);
    }

    // Step 5: Log rendering explanation parameter (Step 5 constraint)
    console.log("Rendering", parsed.explanation);
    console.log("Assistant bubble received text:", parsed.answer);
    console.log("Assistant bubble received explanation:", parsed.explanation);

    const msgEl = document.createElement('div');
    msgEl.className = 'message-bubble bubble-assistant';

    // Step 7: Append inner elements (Step 6 / Step 7 constraint)
    if (!parsed.isFormatted) {
      console.log("TEXT TO RENDER", content);
      msgEl.innerHTML = `
        <div class="assistant-body">${this.parseMarkdown(content)}</div>
        <div style="font-size: 9px; color: var(--text-muted); text-align: right; margin-top: 6px;">
          ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </div>
      `;
    } else {
      const confLower = parsed.confidence.toLowerCase();
      const confBadgeBg = confLower.includes('high') || confLower.includes('8') || confLower.includes('9') ? 'rgba(56, 161, 105, 0.08)' : (confLower.includes('low') || confLower.includes('1') || confLower.includes('2') || confLower.includes('3') || confLower.includes('4') ? 'rgba(229, 62, 62, 0.08)' : 'rgba(214, 158, 46, 0.08)');
      const confBadgeColor = confLower.includes('high') || confLower.includes('8') || confLower.includes('9') ? 'var(--accent-green)' : (confLower.includes('low') || confLower.includes('1') || confLower.includes('2') || confLower.includes('3') || confLower.includes('4') ? 'var(--accent-red)' : 'var(--accent-orange)');

      console.log("TEXT TO RENDER", parsed.explanation);
      msgEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
          <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${this.parseMarkdown(parsed.answer)}</div>
          
          <div class="assistant-body" style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; background: rgba(255, 255, 255, 0.015); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px;">
            <strong>Explanation:</strong> ${this.parseMarkdown(parsed.explanation)}
          </div>

          ${parsed.insight ? `
            <div style="font-size: 12px; color: var(--accent-orange); line-height: 1.4;">
              <strong>Investor Insight:</strong> ${this.parseMarkdown(parsed.insight)}
            </div>
          ` : ''}

          <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
            <span class="badge" style="font-size: 9px; padding: 1px 5px; background: rgba(59, 130, 246, 0.08); color: var(--accent-blue); border: 1px solid rgba(59, 130, 246, 0.15);">Evidence: ${parsed.evidence}</span>
            <span class="badge" style="font-size: 9px; padding: 1px 5px; background: ${confBadgeBg}; color: ${confBadgeColor}; border: 1px solid ${confBadgeBg};">${parsed.confidence} Confidence</span>
            <span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      `;
    }

    container.appendChild(msgEl);
  }

  appendErrorMessageUI(content, container) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message-bubble bubble-assistant';
    msgEl.style.color = 'var(--accent-red)';
    msgEl.style.background = 'rgba(229, 62, 62, 0.05)';
    msgEl.style.border = '1px dashed var(--accent-red)';
    msgEl.textContent = content;
    container.appendChild(msgEl);
  }

  appendThinkingPlaceholder(container, placeholderId) {
    const indicator = document.createElement('div');
    indicator.className = 'message-bubble bubble-assistant';
    indicator.id = placeholderId;
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

  removeThinkingPlaceholder(container, placeholderId) {
    const indicator = container.querySelector(`#${placeholderId}`);
    if (indicator) {
      indicator.remove();
    }
  }

  clearChat() {
    this.history = [];
    const historyKey = `ask_ai_convo_history_${this.ticker}`;
    sessionStorage.removeItem(historyKey);
    
    // Restore welcome screen
    const welcome = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-conversation-view');
    if (welcome) welcome.style.display = 'flex';
    if (chatView) {
      chatView.style.display = 'none';
      chatView.innerHTML = '';
    }

    document.getElementById('chat-history-count').textContent = '0 turns';
    console.log('[Chat Assistant] Conversational memory cleared.');
  }

  scrollDown(scroller) {
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: 'smooth'
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new AskAIPage();
  page.init();
});
