/**
 * header.js
 * =========
 * Renders the top header row, displaying company context,
 * reporting metadata, and action buttons (including Reset Analysis).
 */

export class Header {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(companyData) {
    if (!this.container) return;

    // Sanitise any value: null / undefined / empty / known placeholders → "Not Available"
    const PLACEHOLDERS = new Set([
      '', 'n/a', 'na', 'unknown', 'general industry', 'technology',
      'nse/nasdaq', 'nasdaq/nse', 'not available', 'ticker', 'null', 'undefined'
    ]);
    const safe = (v) => {
      if (v === null || v === undefined) return 'Not Available';
      const s = String(v).trim();
      return PLACEHOLDERS.has(s.toLowerCase()) ? 'Not Available' : s;
    };

    const name     = safe(companyData.name);
    const ticker   = safe(companyData.ticker);
    const exchange = safe(companyData.exchange);
    const sector   = safe(companyData.sector);
    const industry = safe(companyData.industry);

    const decision = (companyData.overall_decision || 'HOLD').toUpperCase();
    let badgeClass = 'badge-hold';
    if (decision.includes('BUY')) badgeClass = 'badge-buy';
    else if (decision.includes('SELL')) badgeClass = 'badge-sell';

    this.container.innerHTML = `
      <div class="header-row-1">
        <div class="header-company-info">
          <h1 class="header-company-name">${name}</h1>
          <span class="badge ${badgeClass}">${decision}</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" id="btn-reset-analysis" title="Clear current analysis and upload another PDF">
            <svg class="lucide lucide-upload" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            New Report
          </button>
          <button class="btn btn-outline" id="header-btn-download">
            <svg class="lucide lucide-arrow-down-to-line" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 17V3"/>
              <path d="m6 11 6 6 6-6"/>
              <path d="M19 21H5"/>
            </svg>
            Download Report
          </button>
          <button class="btn btn-outline" id="header-btn-export">
            <svg class="lucide lucide-share-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <path d="m8.59 13.51 6.83 3.98"/>
              <path d="m15.41 6.51-6.82 3.98"/>
            </svg>
            Export
          </button>
          <button class="btn btn-filled" id="header-btn-ai">
            <svg class="lucide lucide-sparkles" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
            Ask AI
          </button>
        </div>
      </div>
      
      <div class="header-company-meta">
        <span>${exchange}: ${ticker}</span>
        <span class="header-meta-separator">|</span>
        <span>Sector: ${sector}</span>
        <span class="header-meta-separator">|</span>
        <span>Industry: ${industry}</span>
      </div>

      <div class="header-row-2">
        <div class="header-stat-item">
          <svg class="lucide lucide-calendar" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          Report Year: <span>${safe(companyData.report_year)}</span>
        </div>
        <div class="header-stat-item">
          <svg class="lucide lucide-clock" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Uploaded on: <span>${safe(companyData.uploaded_on)}</span>
        </div>
      </div>
    `;

    this.initActionHandlers();
  }

  initActionHandlers() {
    const download = this.container.querySelector('#header-btn-download');
    const exportBtn = this.container.querySelector('#header-btn-export');
    const askAi = this.container.querySelector('#header-btn-ai');

    if (download) {
      download.addEventListener('click', () => {
        download.disabled = true;
        const originalText = download.innerHTML;
        download.textContent = 'Downloading...';
        this.downloadFile('export/excel', 'financial_analysis_report.xlsx').finally(() => {
          download.disabled = false;
          download.innerHTML = originalText;
        });
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportBtn.disabled = true;
        const originalText = exportBtn.innerHTML;
        exportBtn.textContent = 'Exporting...';
        this.downloadFile('export/pdf', 'financial_analysis_report.pdf').finally(() => {
          exportBtn.disabled = false;
          exportBtn.innerHTML = originalText;
        });
      });
    }
    if (askAi) {
      askAi.addEventListener('click', () => {
        const chatPanel = document.getElementById('ask-ai-panel');
        if (chatPanel) {
          chatPanel.style.display = chatPanel.style.display === 'none' ? 'block' : 'none';
        }
      });
    }
  }

  /**
   * Reads the JWT token from sessionStorage or localStorage (set during login).
   * Falls back to null if not found (httponly cookie is not JS-readable).
   */
  _getAuthToken() {
    return sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token') || null;
  }

  /**
   * Handles a 401 Unauthorized response by clearing stored tokens
   * and redirecting to the login page with a "session expired" message.
   */
  _handleUnauthorized() {
    sessionStorage.removeItem('jwt_token');
    localStorage.removeItem('jwt_token');
    // Clear httponly cookie via server route if possible
    try { document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'; } catch(e) {}
    window.location.href = '/static/login.html?expired=true';
  }

  async downloadFile(endpoint, filename) {
    try {
      const url = window.location.port === '8080' ? `http://localhost:8000/api/${endpoint}` : `/api/${endpoint}`;
      const sessionResult = sessionStorage.getItem('analysis_result');
      if (!sessionResult) {
        alert('No active analysis session found.');
        return;
      }

      const payload = JSON.parse(sessionResult);

      // Build headers — always include Content-Type;
      // add Authorization: Bearer <token> explicitly so this works
      // regardless of whether the window.fetch override is active.
      const headers = { 'Content-Type': 'application/json' };
      const token = this._getAuthToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      // Handle 401: session expired — redirect to login
      if (response.status === 401) {
        this._handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Export failed (${response.status}): ${errText}`);
      }

      // Determine filename from Content-Disposition if present
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)\1/);
        if (match && match[2]) {
          filename = match[2].trim();
        }
      }

      // Download the binary blob
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      // Small delay before revoking to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }, 200);
    } catch (err) {
      console.error('Export error:', err);
      alert(`Export error: ${err.message}`);
    }
  }
}
