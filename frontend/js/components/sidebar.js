/**
 * sidebar.js
 * ==========
 * Manages rendering of the sidebar navigation elements
 * and the confidence scoring trackers.
 */

export class Sidebar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  /**
   * Render sidebar.
   * @param {object} data - The full dashboard data object.
   * @param {boolean} hasReport - Whether an analysis has been completed.
   */
  render(data, hasReport = false) {
    if (!this.container) return;
    const confidence = data.confidence_scores || {};

    this.container.innerHTML = `
      <!-- Logo Section -->
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <svg class="lucide lucide-trending-up" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
        </div>
        <div class="sidebar-logo-text">
          <span class="logo-title">Multi-Agent</span>
          <span class="logo-subtitle">Financial Statement Analysis</span>
        </div>
      </div>

      <!-- Navigation List -->
      <div class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-section-label">Navigation</span>
          <a href="#" class="nav-item active">
            <svg class="lucide lucide-layout-dashboard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1"/>
              <rect width="7" height="5" x="14" y="3" rx="1"/>
              <rect width="7" height="9" x="14" y="10" rx="1"/>
              <rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
            <span class="nav-item-label">Dashboard</span>
          </a>
          <a href="./upload.html" class="nav-item">
            <svg class="lucide lucide-upload-cloud" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
              <path d="M12 12v9"/>
              <path d="m16 16-4-4-4 4"/>
            </svg>
            <span class="nav-item-label">Upload Report</span>
          </a>
        </div>

        <div class="nav-section">
          <span class="nav-section-label">Analysis</span>
          <div class="nav-item">
            <svg class="lucide lucide-trending-up" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            <span class="nav-item-label">Financial Metrics</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-calculator" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><line x1="16" x2="16" y1="10" y2="10"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="12" x2="12" y1="10" y2="14"/><line x1="8" x2="12" y1="18" y2="18"/></svg>
            <span class="nav-item-label">Financial Ratios</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-heart-pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-2 2 4 1.5-2h3.28"/></svg>
            <span class="nav-item-label">Financial Health</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-shield-alert" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <span class="nav-item-label">Risk Analysis</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-users" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span class="nav-item-label">Competitor Analysis</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-newspaper" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
            <span class="nav-item-label">Market News</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-swatchbook" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18V6a4 4 0 0 1 8 0v12a4 4 0 0 1-8 0Z"/><path d="M10 12h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H10v10Z"/><path d="M10 18h12a2 2 0 0 0 2-2v-4H10v6Z"/></svg>
            <span class="nav-item-label">SWOT Analysis</span>
          </div>
        </div>

        <div class="nav-section">
          <span class="nav-section-label">Investment Decision</span>
          <div class="nav-item">
            <svg class="lucide lucide-badge-dollar-sign" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8a2 2 0 1 0 0 4h.01"/><path d="M12 12a2 2 0 1 1 0 4h.01"/><path d="M12 6v12"/></svg>
            <span class="nav-item-label">Recommendation</span>
          </div>
          <div class="nav-item">
            <svg class="lucide lucide-file-text" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
            <span class="nav-item-label">Executive Summary</span>
          </div>
        </div>

        <div class="nav-section">
          <span class="nav-section-label">AI Tools</span>
          <div class="nav-item">
            <svg class="lucide lucide-sparkles" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5 5 3Z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z"/></svg>
            <span class="nav-item-label">Ask AI (Chat)</span>
            <span class="nav-badge">New</span>
          </div>
        </div>

        <div class="nav-section">
          <span class="nav-section-label">Export</span>
          <div class="nav-item" id="sidebar-btn-export">
            <svg class="lucide lucide-download" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            <span class="nav-item-label">Export Report</span>
          </div>
        </div>
      </div>

      <!-- Confidence Scores Section (only shown when a report has been analyzed) -->
      ${hasReport ? `
      <div class="sidebar-confidence">
        <div class="confidence-title">Analysis Confidence</div>
        ${this.getConfidenceItem('Financial Metrics', confidence.financial_metrics)}
        ${this.getConfidenceItem('Risk Analysis', confidence.risk_analysis)}
        ${this.getConfidenceItem('Competitor Analysis', confidence.competitor_analysis)}
        ${this.getConfidenceItem('Market News', confidence.market_news)}
        ${this.getConfidenceItem('Recommendation', confidence.recommendation)}
      </div>
      ` : ''}

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <span class="sidebar-footer-text">© 2025 Multi-Agent AI System</span>
      </div>
    `;

    this.initScrollToSections();
  }

  getConfidenceItem(label, val = 90) {
    // Return green/yellow colors depending on score threshold
    const fillCol = val >= 90 ? 'var(--accent-green)' : (val >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)');
    return `
      <div class="confidence-item">
        <div class="confidence-item-header">
          <span class="confidence-label">${label}</span>
          <span class="confidence-value" style="color: ${fillCol};">${val}%</span>
        </div>
        <div class="confidence-bar-track">
          <div class="confidence-bar-fill" style="width: ${val}%; background-color: ${fillCol};"></div>
        </div>
      </div>
    `;
  }

  initScrollToSections() {
    const items = this.container.querySelectorAll('.nav-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        const labelEl = item.querySelector('.nav-item-label');
        const text = labelEl ? labelEl.textContent.trim() : '';

        // Check if report is loaded
        const cached = sessionStorage.getItem('analysis_result');
        const hasReport = !!cached;

        if (text === 'Upload Report') {
          e.preventDefault();
          window.location.href = 'index.html?view=upload';
          return;
        }

        if (text === 'Export Report') {
          e.preventDefault();
          const sessionResult = sessionStorage.getItem('analysis_result');
          if (!sessionResult) {
            alert('No active analysis session found. Please upload a report first.');
            return;
          }

          // Read JWT token (set during login into sessionStorage / localStorage)
          const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token') || null;
          const apiBase = window.location.port === '8080' ? 'http://localhost:8000/api' : '/api';
          const headers = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = 'Bearer ' + token;
          }

          const payload = JSON.parse(sessionResult);
          fetch(`${apiBase}/export/pdf`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          }).then(async (response) => {
            if (response.status === 401) {
              sessionStorage.removeItem('jwt_token');
              localStorage.removeItem('jwt_token');
              try { document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'; } catch(e) {}
              window.location.href = '/static/login.html?expired=true';
              return;
            }
            if (!response.ok) {
              const errText = await response.text().catch(() => response.statusText);
              throw new Error(`Export failed (${response.status}): ${errText}`);
            }
            // Determine filename from Content-Disposition if available
            let filename = 'financial_analysis_report.pdf';
            const disposition = response.headers.get('Content-Disposition');
            if (disposition) {
              const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)\1/);
              if (match && match[2]) filename = match[2].trim();
            }
            return response.blob().then((blob) => {
              const blobUrl = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = blobUrl;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
              }, 200);
            });
          }).catch((err) => {
            console.error('Sidebar export error:', err);
            alert(`Export error: ${err.message}`);
          });
          return;
        }

        if (text === 'Financial Metrics') {
          e.preventDefault();
          console.log("Navigating to metrics.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'metrics.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Competitor Analysis') {
          e.preventDefault();
          console.log("Navigating to competitor.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'competitor.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Risk Analysis') {
          e.preventDefault();
          console.log("Navigating to risk.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'risk.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Financial Ratios') {
          e.preventDefault();
          console.log("Navigating to ratios.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'ratios.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Financial Health') {
          e.preventDefault();
          console.log("Navigating to health.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'health.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Market News') {
          e.preventDefault();
          console.log("Navigating to news.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'news.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'SWOT Analysis') {
          e.preventDefault();
          console.log("Navigating to swot.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'swot.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Recommendation') {
          e.preventDefault();
          console.log("Navigating to recommendation.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'recommendation.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Executive Summary') {
          e.preventDefault();
          console.log("Navigating to summary.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'summary.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        if (text === 'Ask AI (Chat)') {
          e.preventDefault();
          console.log("Navigating to ask_ai.html. hasReport:", hasReport);
          if (hasReport) {
            window.location.href = 'ask_ai.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            window.location.href = 'index.html?view=upload';
          }
          return;
        }

        const isMainPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || (!window.location.pathname.includes('.html'));

        if (!isMainPage) {
          e.preventDefault();
          if (text === 'Dashboard') {
            window.location.href = 'index.html';
            return;
          }

          // Other sections scroll on index.html
          let targetId = '';
          if (text === 'Financial Ratios') targetId = 'competitor-comparison';
          if (text === 'Financial Health') targetId = 'health-radar-chart';
          if (text === 'Risk Analysis') targetId = 'risk-analysis-panel';
          if (text === 'Market News') targetId = 'market-news-sentiment';
          if (text === 'SWOT Analysis') targetId = 'swot-analysis-panel';
          if (text === 'Recommendation') targetId = 'investment-recommendation';
          if (text === 'Executive Summary') targetId = 'executive-summary-panel';
          if (text === 'Ask AI (Chat)') targetId = 'ask-ai-panel';

          if (targetId) {
            sessionStorage.setItem('scroll_to_target', targetId);
          }
          window.location.href = 'index.html';
          return;
        }

        // On main page (index.html)
        if (text === 'Dashboard') {
          e.preventDefault();
          const uploadView = document.getElementById('upload-view');
          if (uploadView && uploadView.style.display !== 'none') {
            if (hasReport) {
              const appContainer = document.querySelector('.app-container');
              // Let app.js show dashboard
              const dashBtn = Array.from(document.querySelectorAll('.nav-item')).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Dashboard');
              if (dashBtn) dashBtn.click();
            } else {
              alert('No active report available. Please upload a financial statement PDF first.');
            }
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }

        // Handle sections scroll on index.html
        e.preventDefault();
        items.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        let targetId = '';
        if (text === 'Financial Ratios') targetId = 'competitor-comparison';
        if (text === 'Financial Health') targetId = 'health-radar-chart'; // Adjusted to match index.html id
        if (text === 'Risk Analysis') targetId = 'risk-analysis-panel';
        if (text === 'Market News') targetId = 'market-news-sentiment';
        if (text === 'SWOT Analysis') targetId = 'swot-analysis-panel';
        if (text === 'Recommendation') targetId = 'investment-recommendation';
        if (text === 'Executive Summary') targetId = 'executive-summary-panel';
        if (text === 'Ask AI (Chat)') targetId = 'ask-ai-panel';

        if (targetId) {
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('animate-glow');
            setTimeout(() => el.classList.remove('animate-glow'), 2000);
          }
        }
      });
    });
  }
}
