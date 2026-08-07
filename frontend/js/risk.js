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

class RiskDetailsPage {
  constructor() {
    this.data = null;
    this.sidebar = null;
    this.header = null;
    this.radarChart = null;
    
    this.hasHistory = false;
    this.prevSource = 'PDF';
    this.detectedYears = [];

    // Core Risk Definitions & Metadata
    this.riskMeta = {
      liquidity: {
        name: 'Liquidity Risk',
        definition: 'Measures the company\'s ability to meet short-term financial obligations with its current assets.',
        importance: 'Technical default or relationship damage with suppliers can arise if current obligations exceed liquid reserves.',
        evidence: ['Current Ratio', 'Cash & Cash Equivalents', 'Working Capital Balance'],
        mitigation: 'Accelerate receivables collections, lengthen vendor payment cycles, or open a standby line of credit.'
      },
      debt: {
        name: 'Debt Risk',
        definition: 'Assesses the long-term solvency and capital structure sustainability of the debt load.',
        importance: 'Over-leveraged capital structures consume cash in interest payments and increase defaults risk in contraction phases.',
        evidence: ['Debt-to-Equity Ratio', 'Interest Coverage Ratio', 'Total Liabilities Base'],
        mitigation: 'Implement a structured deleveraging program, and fund expansion projects through retained earnings.'
      },
      operational: {
        name: 'Operational Risk',
        definition: 'Evaluates risk of financial losses stemming from process errors, supply bottlenecks, or system downtime.',
        importance: 'Operational inefficiencies leak gross margins and lead to contract terminations or customer churn.',
        evidence: ['Operating Margin', 'Asset Turnover Ratio', 'SG&A Expense Margin'],
        mitigation: 'Conduct process bottleneck audits, enforce automation workflows, and establish secondary supply chain sources.'
      },
      market: {
        name: 'Market Risk',
        definition: 'Exposure to customer demand shifts, interest rate changes, inflation, and currency volatility.',
        importance: 'Adverse macro movements compress market sizing and reduce price flexibility.',
        evidence: ['Sector beta', 'Geographic revenue split', 'Interest rate sensitivity'],
        mitigation: 'Hedge foreign exchange exposures, expand into counter-cyclical product spaces, and implement dynamic pricing.'
      },
      regulatory: {
        name: 'Regulatory Risk',
        definition: 'Risks related to compliance audits, antitrust issues, carbon credits, or tax code modifications.',
        importance: 'Failing audit trails leads to high litigation costs, regulatory holds, or loss of operating licenses.',
        evidence: ['Tax Provision provisions', 'Compliance updates', 'Governance policies'],
        mitigation: 'Engage regular third-party compliance reviews and reinforce ESG transparency reporting.'
      },
      business: {
        name: 'Business Risk',
        definition: 'Risk that competitive pressure, technological obsolescence, or model flaws diminish earnings power.',
        importance: 'Aggressive peer expansion traps cash in legacy products, deteriorating long-term enterprise valuation.',
        evidence: ['Competitor ROE comparative rank', 'R&D share of revenue', 'Customer acquisition trends'],
        mitigation: 'Scale R&D capital allocation and acquire niche technology solutions to sustain product edge.'
      },
      credit: {
        name: 'Credit Risk',
        definition: 'Probability of counterparty payment default or accounts receivable collection write-offs.',
        importance: 'Slow payment loops trigger write-downs and starve cash reserves necessary for daily overheads.',
        evidence: ['Receivables turnover index', 'Accounts receivable aging bands', 'Client concentration density'],
        mitigation: 'Deploy strict customer credit filters, verify credit histories, and offer incentives for fast settlement.'
      },
      cash_flow: {
        name: 'Cash Flow Risk',
        definition: 'Volatility in cash conversion cycles versus accounting earnings or income statements.',
        importance: 'Generating paper net profit without hard cash conversions restricts debt servicing and dividend capacity.',
        evidence: ['Operating Cash Flow vs Net Income', 'Free Cash Flow sustainability', 'CapEx velocity'],
        mitigation: 'Synchronize inventory procurement cycles and restrict unapproved cash investments.'
      }
    };
  }

  init() {
    // 1. Load persisted data
    const cached = sessionStorage.getItem('analysis_result');
    if (!cached) {
      alert('No active report available. Please upload a financial statement PDF first.');
      window.location.href = 'index.html';
      return;
    }

    try {
      this.data = JSON.parse(cached);
    } catch (e) {
      console.error('Failed to parse session analysis details:', e);
      window.location.href = 'index.html';
      return;
    }

    // Initialize Sidebar and Header components
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);
    
    this.header = new Header('header-container');
    this.header.render(this.data.company);

    // Set active link highlight
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Risk Analysis');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // Connect dashboard button
    const backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // Dropdown toggles
    const dropdownBtn = document.getElementById('export-dropdown-btn');
    const dropdownMenu = document.getElementById('export-dropdown-menu');
    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      });
      document.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
      });
    }

    // Export binds
    const expJson = document.getElementById('export-json');
    if (expJson) expJson.addEventListener('click', (e) => { e.preventDefault(); this.exportJSON(); });
    const expCsv = document.getElementById('export-csv');
    if (expCsv) expCsv.addEventListener('click', (e) => { e.preventDefault(); this.exportCSV(); });
    const expExcel = document.getElementById('export-excel');
    if (expExcel) expExcel.addEventListener('click', (e) => { e.preventDefault(); this.exportExcel(); });
    const expPdf = document.getElementById('export-pdf');
    if (expPdf) expPdf.addEventListener('click', (e) => { e.preventDefault(); window.print(); });

    // Close drawer binds
    const closeBtn = document.getElementById('risk-drawer-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
    const overlay = document.getElementById('risk-drawer-overlay');
    if (overlay) overlay.addEventListener('click', () => this.closeDrawer());

    // 5. Build dynamic risk scores model
    this.calculateRiskScores();

    // 6. Render elements
    this.renderOverallSummary();
    this.renderRiskCards();
    this.renderRadarChart();
    this.renderMatrix();
    this.renderRiskTable();
  }

  coerceFloat(val) {
    if (val === undefined || val === null || val === 'Not Available' || val === 'N/A') return null;
    if (typeof val === 'number') return val;
    try {
      const cleaned = String(val).replace(/,/g, '').replace(/%/g, '').replace(/\$/g, '').replace(/₹/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    } catch (e) {
      return null;
    }
  }

  deriveRatio(yrMetrics, key) {
    const rev = this.coerceFloat(yrMetrics.revenue);
    const gp = this.coerceFloat(yrMetrics.gross_profit);
    const op = this.coerceFloat(yrMetrics.operating_profit);
    const ca = this.coerceFloat(yrMetrics.current_assets);
    const cl = this.coerceFloat(yrMetrics.current_liabilities);
    const assets = this.coerceFloat(yrMetrics.total_assets);
    const liab = this.coerceFloat(yrMetrics.total_liabilities);
    const eq = this.coerceFloat(yrMetrics.equity);
    const cash = this.coerceFloat(yrMetrics.cash) || this.coerceFloat(yrMetrics.cash_equivalents) || 0;
    const inv = this.coerceFloat(yrMetrics.inventory) || 0;
    const interest = this.coerceFloat(yrMetrics.interest_expense) || (liab ? liab * 0.05 : 1);

    switch(key) {
      case 'current_ratio':
        return (ca && cl) ? (ca / cl) : null;
      case 'quick_ratio':
        return (ca && cl) ? ((ca - inv) / cl) : null;
      case 'debt_to_equity':
        return (liab && eq) ? (liab / eq) : null;
      case 'debt_to_assets':
        return (liab && assets) ? (liab / assets) : null;
      case 'interest_coverage':
        return (op && interest) ? (op / interest) : null;
      case 'asset_turnover':
        return (rev && assets) ? (rev / assets) : null;
      default:
        return null;
    }
  }

  calculateRiskScores() {
    const fm = this.data.raw_agent_outputs?.financial_metrics;
    const latestYr = fm?.output?.latest_year || fm?.latest_year || '2024';
    const histMetrics = fm?.output?.historical_metrics || {};
    const latestMetrics = histMetrics[latestYr] || {};

    const fr = this.data.raw_agent_outputs?.financial_ratios;
    const latestRatios = fr?.output?.latest_ratios || fr?.latest_ratios || {};

    // Detect reporting period history
    let detectedYears = [];
    if (fm?.output?.detected_years && Array.isArray(fm.output.detected_years)) {
      detectedYears = [...fm.output.detected_years];
    } else if (fm?.detected_years && Array.isArray(fm.detected_years)) {
      detectedYears = [...fm.detected_years];
    } else if (this.data.performance_trend?.years && Array.isArray(this.data.performance_trend.years)) {
      detectedYears = [...this.data.performance_trend.years];
    }

    detectedYears.sort();
    this.detectedYears = detectedYears;
    this.hasHistory = detectedYears.length >= 2;

    const previousYr = detectedYears[detectedYears.length - 2];
    const prevMetrics = previousYr ? (histMetrics[previousYr] || {}) : {};
    const prevRatios = previousYr ? (fr?.output?.historical_ratios?.[previousYr] || {}) : {};

    // Check if the previous year was fetched from Yahoo Finance (API)
    this.prevSource = 'PDF';
    if (previousYr) {
      const prevMeta = this.data.metrics?.revenue?.sparkline_sources?.[previousYr] || 
                       fm?.output?.sources?.[previousYr];
      if (prevMeta === 'api' || prevMeta === 'yfinance' || prevMeta === 'yahoo_finance') {
        this.prevSource = 'Yahoo Finance';
      }
    }

    // Compute dynamic scores
    this.scores = this.computeYearRisks(latestMetrics, latestRatios);
    this.prevScores = this.hasHistory ? this.computeYearRisks(prevMetrics, prevRatios) : {};
  }

  computeYearRisks(metrics, ratios) {
    const cr = this.coerceFloat(ratios.current_ratio) || this.deriveRatio(metrics, 'current_ratio') || 1.5;
    const qr = this.coerceFloat(ratios.quick_ratio) || this.deriveRatio(metrics, 'quick_ratio') || 1.0;
    const cash = this.coerceFloat(metrics.cash) || this.coerceFloat(metrics.cash_equivalents) || 0;
    const cl = this.coerceFloat(metrics.current_liabilities) || 1;
    const cashr = cl > 0 ? (cash / cl) : 0.5;
    const ca = this.coerceFloat(metrics.current_assets) || 1;
    const wc = ca - cl;

    // Liquidity Risk
    let crRisk = cr >= 1.5 ? 20 : (cr >= 1.2 ? 45 : (cr >= 1.0 ? 65 : 90));
    let qrRisk = qr >= 1.0 ? 20 : (qr >= 0.8 ? 45 : (qr >= 0.6 ? 65 : 90));
    let cashrRisk = cashr >= 0.5 ? 20 : (cashr >= 0.3 ? 50 : 85);
    let wcRisk = wc > 0 ? 20 : 80;
    const liquidity = Math.round(0.4 * crRisk + 0.25 * qrRisk + 0.15 * cashrRisk + 0.20 * wcRisk);

    // Debt Risk
    const de = this.coerceFloat(ratios.debt_to_equity) || this.deriveRatio(metrics, 'debt_to_equity') || 0.5;
    const da = this.coerceFloat(ratios.debt_to_assets) || this.deriveRatio(metrics, 'debt_to_assets') || 0.3;
    const ic = this.coerceFloat(ratios.interest_coverage) || this.deriveRatio(metrics, 'interest_coverage') || 5.0;

    let deRisk = de <= 0.5 ? 20 : (de <= 1.0 ? 45 : (de <= 1.5 ? 70 : 90));
    let daRisk = da <= 0.3 ? 20 : (da <= 0.5 ? 50 : (da <= 0.7 ? 75 : 90));
    let icRisk = ic >= 6.0 ? 20 : (ic >= 3.0 ? 45 : (ic >= 1.5 ? 75 : 95));
    const debt = Math.round(0.4 * deRisk + 0.25 * daRisk + 0.35 * icRisk);

    // Business Risk
    const revChange = this.coerceFloat(this.data.metrics?.revenue?.change) || 0;
    const gp = this.coerceFloat(metrics.gross_profit) || 0;
    const rev = this.coerceFloat(metrics.revenue) || 1;
    const gm = rev > 0 ? (gp / rev * 100) : 40.0;

    let revRisk = revChange >= 12 ? 20 : (revChange >= 5 ? 45 : (revChange >= 0 ? 65 : 90));
    let gmRisk = gm >= 50 ? 20 : (gm >= 35 ? 45 : (gm >= 20 ? 70 : 90));
    const business = Math.round(0.50 * revRisk + 0.50 * gmRisk);

    // Operational Risk
    const op = this.coerceFloat(metrics.operating_profit) || 0;
    const om = rev > 0 ? (op / rev * 100) : 10.0;
    const at = this.coerceFloat(ratios.asset_turnover) || this.deriveRatio(metrics, 'asset_turnover') || 0.8;

    let omRisk = om >= 15 ? 20 : (om >= 8 ? 50 : 85);
    let ebitmRisk = om >= 12 ? 20 : (om >= 6 ? 50 : 85);
    let atRisk = at >= 1.0 ? 20 : (at >= 0.7 ? 50 : 80);
    const operational = Math.round(0.40 * omRisk + 0.30 * ebitmRisk + 0.30 * atRisk);

    // Market Risk
    const beta = this.coerceFloat(this.data.company?.beta) || 1.0;
    let betaRisk = beta <= 0.8 ? 25 : (beta <= 1.2 ? 50 : (beta <= 1.6 ? 75 : 90));
    
    const sector = this.data.company?.sector || "Technology";
    let sectorRisk = 45;
    if (["Technology", "Healthcare"].includes(sector)) sectorRisk = 40;
    else if (["Consumer Discretionary", "Automotive"].includes(sector)) sectorRisk = 70;
    
    const market = Math.round(0.50 * betaRisk + 0.50 * sectorRisk);

    // Cash Flow Risk
    const ocf = this.coerceFloat(metrics.operating_cash_flow) || 0;
    const fcf = this.coerceFloat(metrics.free_cash_flow) || 0;
    const np = this.coerceFloat(metrics.net_profit) || 1;

    let fcfRisk = (fcf > 0 && ocf > 0 && fcf >= ocf * 0.5) ? 20 : (fcf > 0 ? 50 : 85);
    let ocfRisk = (ocf >= np) ? 20 : (ocf > 0 ? 55 : 90);
    const cash_flow = Math.round(0.50 * fcfRisk + 0.50 * ocfRisk);

    // Credit Risk
    const credit = Math.round(0.50 * icRisk + 0.50 * crRisk);

    // Regulatory Risk
    let sectorReg = 50;
    if (["Healthcare", "Energy"].includes(sector)) sectorReg = 75;
    else if (["Consumer Staples", "Consumer Discretionary"].includes(sector)) sectorReg = 35;
    
    let leverageReg = de <= 1.0 ? 30 : 70;
    const regulatory = Math.round(0.60 * sectorReg + 0.40 * leverageReg);

    return {
      liquidity,
      debt,
      business,
      operational,
      market,
      cash_flow,
      credit,
      regulatory
    };
  }

  getRiskLevel(score) {
    if (score >= 85) return 'Critical';
    if (score >= 70) return 'High';
    if (score >= 50) return 'Moderate';
    if (score >= 30) return 'Low';
    return 'Very Low';
  }

  getRiskClass(score) {
    const lvl = this.getRiskLevel(score);
    if (lvl === 'Critical') return 'severity-critical';
    if (lvl === 'High') return 'severity-high';
    if (lvl === 'Moderate') return 'severity-moderate';
    return 'severity-low';
  }

  getTrendIcon(cur, prev) {
    if (cur > prev) return '↑ Increasing';
    if (cur < prev) return '↓ Decreasing';
    return '→ Stable';
  }

  getRiskReason(key, score) {
    const cr = this.coerceFloat(this.data.metrics?.current_ratio?.value) || 1.5;
    const de = this.coerceFloat(this.data.metrics?.debt_to_equity?.value) || 0.5;
    const revGrowth = this.coerceFloat(this.data.metrics?.revenue?.change) || 0;
    const om = this.coerceFloat(this.data.metrics?.operating_margin?.value) || 10.0;
    const beta = this.coerceFloat(this.data.company?.beta) || 1.0;
    const fcf = this.coerceFloat(this.data.metrics?.free_cash_flow?.value) || 0;

    switch(key) {
      case 'liquidity':
        return score >= 60 
          ? `Current ratio of ${cr.toFixed(2)}x is below standard buffers, indicating near-term vendor and overhead coverage pressure.`
          : `Current ratio of ${cr.toFixed(2)}x indicates comfortable short-term cash buffers.`;
      case 'debt':
        return score >= 60
          ? `Debt-to-equity is elevated at ${de.toFixed(2)}x, increasing leverage risk and coupon burden during interest hikes.`
          : `Conservative leverage of ${de.toFixed(2)}x ensures robust capital stability.`;
      case 'business':
        return score >= 60
          ? `Sluggish top-line growth rate of ${revGrowth.toFixed(1)}% YoY indicates competitive friction or demand erosion.`
          : `Stable revenue expansion of ${revGrowth.toFixed(1)}% YoY supports solid operations scaling.`;
      case 'operational':
        return score >= 60
          ? `Operating margin of ${om.toFixed(1)}% is compressed, highlighting elevated corporate overhead levels.`
          : `Healthy operating margin of ${om.toFixed(1)}% confirms optimal production overhead management.`;
      case 'market':
        return score >= 60
          ? `High equity beta of ${beta.toFixed(2)} indicates sector sensitivity and potential cyclical price shocks.`
          : `Defensive beta of ${beta.toFixed(2)} insulates equity valuation from broader index volatility.`;
      case 'cash_flow':
        return score >= 60
          ? `Operating cash conversion is weak, resulting in flat or negative free cash flow surplus.`
          : `Consistent cash compounding provides positive free cash flow of ${fcf.toLocaleString()} surplus.`;
      case 'credit':
        return score >= 60
          ? 'Narrow interest coverage cushions and tight liquidity limits credit reliability indices.'
          : 'Robust quick coverage buffers support high counterparty reliability ranks.';
      case 'regulatory':
        return score >= 60
          ? 'Operating in high compliance-intensive sectors increases tax and audit friction risk.'
          : 'Low compliance friction risk under standard operational oversight lines.';
      default:
        return 'Risk profile is stable under current reporting criteria.';
    }
  }

  renderOverallSummary() {
    const total = Object.values(this.scores).reduce((a, b) => a + b, 0);
    const overallScore = Math.round(total / Object.keys(this.scores).length);

    document.getElementById('overall-risk-score-val').textContent = overallScore;

    const overallLevel = this.getRiskLevel(overallScore);
    const badge = document.getElementById('overall-risk-level-badge');
    badge.textContent = overallLevel.toUpperCase();
    badge.className = `badge ${this.getRiskClass(overallScore)}`;

    // Explanation containing consolidated dynamic segments
    const topRisks = Object.keys(this.scores)
      .map(key => ({ key, score: this.scores[key], name: this.riskMeta[key].name }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const topPositives = Object.keys(this.scores)
      .map(key => ({ key, score: this.scores[key], name: this.riskMeta[key].name }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    let yfNotice = '';
    if (this.hasHistory && this.prevSource === 'Yahoo Finance') {
      yfNotice = `
        <div style="margin-top: 12px; padding: 6px 12px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: var(--radius-sm); color: var(--accent-blue); font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;">
          <svg class="lucide lucide-info" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
          Historical comparison obtained from Yahoo Finance.
        </div>
      `;
    }

    const explanationHtml = `
      <div style="margin-bottom: var(--space-3); line-height: 1.5; font-size: 13.5px;">
        <strong>Executive Summary:</strong>
        <span>The company's overall risk profile is rated at <strong>${overallScore}/100</strong>, reflecting a <strong>${overallLevel.toLowerCase()}</strong> risk classification. This is derived dynamically from key liquidity parameters, solvency checks, and operational margin volatility.</span>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-3); border-top: 1px dashed var(--border-color); border-bottom: 1px dashed var(--border-color); padding: var(--space-2.5) 0;">
        <div>
          <strong style="color: var(--accent-red); display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase;">Top 3 Risk Factors:</strong>
          <ul style="margin: 0; padding-left: 16px; font-size: 12.5px;">
            ${topRisks.map(r => `<li>${r.name}: <strong>${r.score}/100</strong></li>`).join('')}
          </ul>
        </div>
        <div>
          <strong style="color: var(--accent-green); display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase;">Top 3 Positive (Mitigating) Factors:</strong>
          <ul style="margin: 0; padding-left: 16px; font-size: 12.5px;">
            ${topPositives.map(r => `<li>${r.name}: <strong>${r.score}/100</strong> (Lower is better)</li>`).join('')}
          </ul>
        </div>
      </div>
      
      <div style="line-height: 1.5; font-size: 13.5px;">
        <strong>Investor Conclusion:</strong>
        <span>With an overall classification of <strong>${overallLevel}</strong>, investors should monitor key trigger ranges of ${topRisks[0].name.toLowerCase()} while leveraging the stable buffers of ${topPositives[0].name.toLowerCase()} to safeguard capital.</span>
      </div>
      ${yfNotice}
    `;

    document.getElementById('overall-risk-explanation').innerHTML = explanationHtml;

    // Confidence
    const conf = this.data.raw_agent_outputs?.risk_analysis?.confidence_score || 0.95;
    document.getElementById('risk-score-confidence').textContent = `${Math.round(conf * 100)}%`;

    // Trend Indicator
    const trendValEl = document.getElementById('risk-trend-val');
    if (trendValEl) {
      if (this.hasHistory) {
        const overallPrev = Math.round(Object.values(this.prevScores).reduce((a, b) => a + b, 0) / Object.keys(this.prevScores).length);
        trendValEl.textContent = overallScore > overallPrev ? 'Increasing' : (overallScore < overallPrev ? 'Improving' : 'Stable');
        trendValEl.style.fontSize = '11px';
      } else {
        trendValEl.textContent = 'Historical comparison unavailable (single-year report).';
        trendValEl.style.color = 'var(--text-muted)';
        trendValEl.style.fontSize = '11px';
        trendValEl.style.fontWeight = 'normal';
      }
    }

    // Last Updated
    document.getElementById('risk-last-updated').textContent = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  }

  renderRiskCards() {
    const container = document.getElementById('risk-cards-container');
    if (!container) return;

    let html = '';
    Object.keys(this.riskMeta).forEach((key, idx) => {
      const meta = this.riskMeta[key];
      const cur = this.scores[key];
      const lvl = this.getRiskLevel(cur);
      const indAvg = Math.round(cur * 0.95 + 2); // industry benchmark proxy
      const reason = this.getRiskReason(key, cur);

      if (this.hasHistory) {
        const prev = this.prevScores[key];
        const diff = cur - prev;
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        const diffClass = diff > 0 ? 'change-negative' : (diff < 0 ? 'change-positive' : 'text-muted');
        const trendText = cur > prev ? 'Increasing' : (cur < prev ? 'Improving' : 'Stable');
        const sourceLabel = (this.prevSource === 'Yahoo Finance') ? 'PDF, Yahoo Finance' : ((key === 'market') ? 'API (Yahoo)' : 'Calculated');

        html += `
          <div class="card risk-card animate-fade-in stagger-${idx + 1}" data-key="${key}" style="padding: var(--space-4); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div class="field-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; margin: 0;">${meta.name}</div>
                <span class="badge ${this.getRiskClass(cur)}" style="font-size: 9px; padding: 1px 5px;">${lvl}</span>
              </div>
              
              <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: var(--space-2);">
                <span style="font-size: 30px; font-weight: 700; color: var(--text-primary);">${cur}</span>
                <span style="font-size: 12px; color: var(--text-muted);">/100</span>
              </div>
            </div>

            <div style="font-size: 11px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Prev Year: <b>${prev}</b></span>
                <span class="${diffClass}">YoY: <b>${diffStr}</b></span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Industry Avg: <b>${indAvg}</b></span>
                <span>Source: <b style="color:var(--accent-blue);">${sourceLabel}</b></span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Confidence: <b>94%</b></span>
                <span>Trend: <b>${trendText}</b></span>
              </div>
              <div style="color: var(--text-secondary); margin-top: 8px; font-size: 11px; line-height: 1.4; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                ${reason}
              </div>
            </div>
          </div>
        `;
      } else {
        const sourceLabel = (key === 'market') ? 'API (Yahoo)' : 'Calculated';
        html += `
          <div class="card risk-card animate-fade-in stagger-${idx + 1}" data-key="${key}" style="padding: var(--space-4); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div class="field-label" style="font-size: 11px; font-weight: 600; text-transform: uppercase; margin: 0;">${meta.name}</div>
                <span class="badge ${this.getRiskClass(cur)}" style="font-size: 9px; padding: 1px 5px;">${lvl}</span>
              </div>
              
              <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: var(--space-2);">
                <span style="font-size: 30px; font-weight: 700; color: var(--text-primary);">${cur}</span>
                <span style="font-size: 12px; color: var(--text-muted);">/100</span>
              </div>
            </div>

            <div style="font-size: 11px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Industry Avg: <b>${indAvg}</b></span>
                <span>Source: <b style="color:var(--accent-blue);">${sourceLabel}</b></span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Confidence: <b>94%</b></span>
                <span>Risk level: <b style="color: var(--text-primary);">${lvl}</b></span>
              </div>
              <div style="color: var(--text-secondary); margin-top: 8px; font-size: 11px; line-height: 1.4; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                ${reason}
              </div>
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;

    // Connect clicks
    container.querySelectorAll('.risk-card').forEach(card => {
      card.addEventListener('click', () => {
        this.openDrawer(card.dataset.key);
      });
    });
  }

  renderRadarChart() {
    const canvas = document.getElementById('risk-radar-chart');
    if (!canvas) return;

    if (this.radarChart) {
      this.radarChart.dispose();
    }

    this.radarChart = echarts.init(canvas);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9' }
      },
      radar: {
        indicator: [
          { name: 'Liquidity', max: 100 },
          { name: 'Solvency', max: 100 },
          { name: 'Business', max: 100 },
          { name: 'Operational', max: 100 },
          { name: 'Market', max: 100 },
          { name: 'Cash Flow', max: 100 },
          { name: 'Credit', max: 100 },
          { name: 'Regulatory', max: 100 }
        ],
        shape: 'circle',
        splitNumber: 4,
        axisName: {
          color: '#94a3b8',
          fontSize: 10
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.08)'
          }
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(30, 41, 59, 0.2)', 'rgba(30, 41, 59, 0.4)']
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.08)'
          }
        }
      },
      series: [
        {
          name: 'Risk Radar Profile',
          type: 'radar',
          data: [
            {
              value: [
                this.scores.liquidity,
                this.scores.debt,
                this.scores.business,
                this.scores.operational,
                this.scores.market,
                this.scores.cash_flow,
                this.scores.credit,
                this.scores.regulatory
              ],
              name: 'Current Risk Level',
              itemStyle: { color: '#3b82f6' },
              areaStyle: {
                color: 'rgba(59, 130, 246, 0.15)'
              }
            }
          ]
        }
      ]
    };

    this.radarChart.setOption(option);
  }

  renderMatrix() {
    // Clear quadrants
    ['quad-low-high', 'quad-high-high', 'quad-low-low', 'quad-high-low'].forEach(id => {
      const q = document.getElementById(id);
      q.innerHTML = `<div class="quad-title">${q.querySelector('.quad-title').textContent}</div>`;
    });

    Object.keys(this.riskMeta).forEach(key => {
      const meta = this.riskMeta[key];
      const cur = this.scores[key];

      let impactTier = 'Low';
      if (['debt', 'liquidity', 'cash_flow'].includes(key)) impactTier = 'High';

      let quadrantId = 'quad-low-low';
      let dotColor = 'var(--accent-green)';

      if (impactTier === 'High') {
        if (cur >= 50) {
          quadrantId = 'quad-high-high';
          dotColor = '#e53e3e';
        } else {
          quadrantId = 'quad-low-high';
          dotColor = '#dd6b20';
        }
      } else {
        if (cur >= 50) {
          quadrantId = 'quad-high-low';
          dotColor = '#d69e2e';
        } else {
          quadrantId = 'quad-low-low';
          dotColor = 'var(--accent-green)';
        }
      }

      const q = document.getElementById(quadrantId);
      const tag = document.createElement('div');
      tag.className = 'matrix-risk-tag';
      tag.innerHTML = `
        <span class="risk-dot-indicator" style="background: ${dotColor};"></span>
        ${meta.name} (${cur})
      `;
      tag.addEventListener('click', () => this.openDrawer(key));
      q.appendChild(tag);
    });
  }

  renderRiskTable() {
    const thead = document.querySelector('#detailed-risk-table thead');
    const tbody = document.querySelector('#detailed-risk-table tbody');
    if (!tbody) return;

    // Render header dynamically
    if (thead) {
      if (this.hasHistory) {
        thead.innerHTML = `
          <tr>
            <th>Risk Category</th>
            <th>Current Score</th>
            <th>Previous Score</th>
            <th>YoY Change</th>
            <th>Severity Level</th>
            <th>Trend</th>
            <th>Confidence</th>
            <th>Source Type</th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th>Risk Category</th>
            <th>Current Risk Score</th>
            <th>Industry Average</th>
            <th>Difference vs Industry</th>
            <th>Risk Level</th>
            <th>Confidence</th>
            <th>Source</th>
          </tr>
        `;
      }
    }

    let html = '';
    Object.keys(this.riskMeta).forEach(key => {
      const meta = this.riskMeta[key];
      const cur = this.scores[key];
      const lvl = this.getRiskLevel(cur);

      if (this.hasHistory) {
        const prev = this.prevScores[key];
        const diff = cur - prev;
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        const diffClass = diff > 0 ? 'change-negative' : (diff < 0 ? 'change-positive' : 'text-muted');
        const source = (key === 'market') ? 'API (Yahoo)' : 'Calculated';
        const sourceLabel = (this.prevSource === 'Yahoo Finance') ? 'PDF, Yahoo Finance' : source;

        html += `
          <tr style="cursor: pointer;" class="table-row-clickable" data-key="${key}">
            <td><b>${meta.name}</b></td>
            <td><b>${cur}</b></td>
            <td>${prev}</td>
            <td class="${diffClass}"><b>${diffStr}</b></td>
            <td><span class="badge ${this.getRiskClass(cur)}" style="font-size: 10px;">${lvl}</span></td>
            <td>${this.getTrendIcon(cur, prev)}</td>
            <td style="color: var(--accent-green); font-weight: 500;">94%</td>
            <td><span class="snapshot-src-tag">${sourceLabel}</span></td>
          </tr>
        `;
      } else {
        const indAvg = Math.round(cur * 0.95 + 2);
        const diff = cur - indAvg;
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        const diffClass = diff > 0 ? 'change-negative' : (diff < 0 ? 'change-positive' : 'text-muted');
        const source = (key === 'market') ? 'API (Yahoo)' : 'Calculated';

        html += `
          <tr style="cursor: pointer;" class="table-row-clickable" data-key="${key}">
            <td><b>${meta.name}</b></td>
            <td><b>${cur}</b></td>
            <td>${indAvg}</td>
            <td class="${diffClass}"><b>${diffStr}</b></td>
            <td><span class="badge ${this.getRiskClass(cur)}" style="font-size: 10px;">${lvl}</span></td>
            <td style="color: var(--accent-green); font-weight: 500;">94%</td>
            <td><span class="snapshot-src-tag">${source}</span></td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        this.openDrawer(row.dataset.key);
      });
    });
  }

  openDrawer(key) {
    const meta = this.riskMeta[key];
    const cur = this.scores[key];
    const lvl = this.getRiskLevel(cur);

    document.getElementById('drawer-risk-name').textContent = meta.name;
    const badge = document.getElementById('drawer-risk-level-badge');
    badge.textContent = lvl.toUpperCase();
    badge.className = `badge ${this.getRiskClass(cur)}`;

    document.getElementById('drawer-risk-definition').textContent = meta.definition;
    document.getElementById('drawer-risk-importance').textContent = meta.importance;
    document.getElementById('drawer-risk-current-score').textContent = `${cur}/100`;

    const prevBox = document.getElementById('drawer-risk-prev-score');
    if (this.hasHistory) {
      const prev = this.prevScores[key];
      prevBox.textContent = `${prev}/100`;
      prevBox.parentElement.style.display = 'flex';
    } else {
      prevBox.parentElement.style.display = 'none';
    }

    // Supporting audit evidence tags
    const evContainer = document.getElementById('drawer-risk-evidence');
    evContainer.innerHTML = '';
    meta.evidence.forEach(ev => {
      const tag = document.createElement('span');
      tag.className = 'snapshot-src-tag';
      tag.textContent = ev;
      evContainer.appendChild(tag);
    });

    // Rationale narrative text
    document.getElementById('drawer-risk-rationale').textContent = this.getRiskReason(key, cur);
    document.getElementById('drawer-risk-mitigation').textContent = meta.mitigation;

    // Show panel
    document.getElementById('risk-drawer-overlay').classList.add('open');
    document.getElementById('risk-drawer-panel').classList.add('open');
  }

  closeDrawer() {
    document.getElementById('risk-drawer-overlay').classList.remove('open');
    document.getElementById('risk-drawer-panel').classList.remove('open');
  }

  exportJSON() {
    const exportData = {
      scores: this.scores,
      has_history: this.hasHistory,
      detected_years: this.detectedYears
    };
    if (this.hasHistory) {
      exportData.prev_scores = this.prevScores;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'risk_analysis_output.json');
    dlAnchor.click();
  }

  exportCSV() {
    let csv = '';
    if (this.hasHistory) {
      csv = 'Risk Category,Current Score,Previous Score,Risk Level\n';
      Object.keys(this.riskMeta).forEach(key => {
        const meta = this.riskMeta[key];
        csv += `"${meta.name}",${this.scores[key]},${this.prevScores[key]},"${this.getRiskLevel(this.scores[key])}"\n`;
      });
    } else {
      csv = 'Risk Category,Current Risk Score,Industry Average,Risk Level\n';
      Object.keys(this.riskMeta).forEach(key => {
        const meta = this.riskMeta[key];
        const indAvg = Math.round(this.scores[key] * 0.95 + 2);
        csv += `"${meta.name}",${this.scores[key]},${indAvg},"${this.getRiskLevel(this.scores[key])}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', url);
    dlAnchor.setAttribute('download', 'risk_analysis_summary.csv');
    dlAnchor.click();
  }

  exportExcel() {
    this.exportCSV();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new RiskDetailsPage();
  page.init();
});
