import { Sidebar } from './components/sidebar.js';
import { Header } from './components/header.js';
import { Swot } from './components/swot.js';

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

class SwotDetailsPage {
  constructor() {
    this.data = null;
    this.sidebar = null;
    this.header = null;
    this.swotComponent = null;
  }

  initializeSWOT() {
    console.log('[SWOT Agent] SWOT page loaded');

    // 1. Restore persistent session analysis data
    const cached = sessionStorage.getItem('analysis_result');
    if (!cached) {
      console.warn('[SWOT Agent] No active analysis session data found in sessionStorage.');
      this.renderError('No SWOT data available. Please upload a financial statement PDF first.');
      return;
    }

    try {
      this.data = JSON.parse(cached);
      const company = this.data.company || {};
      const ticker = company.ticker || 'TICKER';
      const name = company.name || 'Target Company';
      
      console.log(`[SWOT Agent] Company: "${name}", Ticker: "${ticker}"`);
      
      // Step 6: Log components received
      const metrics = this.data.raw_agent_outputs?.financial_metrics ? 'OK' : 'MISSING';
      const ratios = this.data.raw_agent_outputs?.financial_ratios ? 'OK' : 'MISSING';
      const health = this.data.raw_agent_outputs?.financial_health ? 'OK' : 'MISSING';
      const risk = this.data.raw_agent_outputs?.risk_analysis ? 'OK' : 'MISSING';
      const competitor = this.data.raw_agent_outputs?.competitor ? 'OK' : 'MISSING';
      
      console.log(`[SWOT Agent] Components status: Metrics=${metrics}, Ratios=${ratios}, Health=${health}, Risk=${risk}, Competitor=${competitor}`);
    } catch (e) {
      console.error('[SWOT Agent] Failed to parse session analysis data:', e);
      this.renderError('Failed to parse session analysis data.');
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
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'SWOT Analysis');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // Back button route
    const backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // 3. Hydrate SWOT components
    this.swotComponent = new Swot('swot-analysis-panel');
    const swotPayload = this.data.swot || this.data.raw_agent_outputs?.swot?.output || {};
    this.swotComponent.render(swotPayload);

    console.log('[SWOT Agent] SWOT generated & Render complete');
  }

  renderError(msg) {
    const container = document.getElementById('swot-analysis-panel');
    if (container) {
      container.innerHTML = `
        <div style="color: var(--accent-red); font-size: 14px; font-weight: 500; text-align: center; padding: 48px 0; border: 1px dashed var(--accent-red); border-radius: var(--radius-md); background: rgba(229, 62, 62, 0.05);">
          ${msg}
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new SwotDetailsPage();
  page.initializeSWOT();
});
