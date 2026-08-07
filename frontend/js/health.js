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

class FinancialHealthPage {
  constructor() {
    this.data = null;
    this.ratiosData = {};
    
    this.ratiosMeta = {
      gross_margin: { name: 'Gross Profit Margin', category: 'profitability', benchmark: 40.0, unit: '%' },
      operating_margin: { name: 'Operating Profit Margin', category: 'profitability', benchmark: 12.0, unit: '%' },
      net_margin: { name: 'Net Profit Margin', category: 'profitability', benchmark: 8.0, unit: '%' },
      ebitda_margin: { name: 'EBITDA Margin', category: 'profitability', benchmark: 15.0, unit: '%' },
      roa: { name: 'Return on Assets (ROA)', category: 'profitability', benchmark: 6.0, unit: '%' },
      roe: { name: 'Return on Equity (ROE)', category: 'profitability', benchmark: 12.0, unit: '%' },
      roce: { name: 'Return on Capital Employed (ROCE)', category: 'profitability', benchmark: 10.0, unit: '%' },
      current_ratio: { name: 'Current Ratio', category: 'liquidity', benchmark: 1.5, unit: 'x' },
      quick_ratio: { name: 'Quick Ratio (Acid Test)', category: 'liquidity', benchmark: 1.0, unit: 'x' },
      cash_ratio: { name: 'Cash Ratio', category: 'liquidity', benchmark: 0.5, unit: 'x' },
      working_capital: { name: 'Net Working Capital', category: 'liquidity', benchmark: 0.0, unit: '' },
      asset_turnover: { name: 'Asset Turnover', category: 'efficiency', benchmark: 0.8, unit: 'x' },
      inventory_turnover: { name: 'Inventory Turnover', category: 'efficiency', benchmark: 6.0, unit: 'x' },
      receivable_turnover: { name: 'Receivables Turnover', category: 'efficiency', benchmark: 8.0, unit: 'x' },
      payable_turnover: { name: 'Payables Turnover', category: 'efficiency', benchmark: 7.0, unit: 'x' },
      working_capital_turnover: { name: 'Working Capital Turnover', category: 'efficiency', benchmark: 5.0, unit: 'x' },
      debt_to_equity: { name: 'Debt-to-Equity Ratio', category: 'solvency', benchmark: 1.0, unit: 'x' },
      debt_to_assets: { name: 'Debt-to-Assets Ratio', category: 'solvency', benchmark: 0.5, unit: 'x' },
      equity_ratio: { name: 'Equity Ratio', category: 'solvency', benchmark: 0.5, unit: 'x' },
      interest_coverage: { name: 'Interest Coverage Ratio', category: 'solvency', benchmark: 3.0, unit: 'x' },
      financial_leverage: { name: 'Financial Leverage Multiplier', category: 'solvency', benchmark: 2.0, unit: 'x' }
    };

    this.sectorBenchmarks = {
      "Technology": { gross_margin: 65.0, operating_margin: 18.0, net_margin: 15.0, ebitda_margin: 22.0, roa: 10.0, roe: 20.0, roce: 16.0, current_ratio: 2.0, quick_ratio: 1.5, cash_ratio: 0.8, working_capital: 150.0, asset_turnover: 0.7, inventory_turnover: 12.0, receivable_turnover: 9.0, payable_turnover: 8.0, working_capital_turnover: 6.0, debt_to_equity: 0.4, debt_to_assets: 0.2, equity_ratio: 0.6, interest_coverage: 15.0, financial_leverage: 1.6 },
      "Healthcare": { gross_margin: 55.0, operating_margin: 12.0, net_margin: 9.0, ebitda_margin: 16.0, roa: 6.0, roe: 12.0, roce: 10.0, current_ratio: 1.8, quick_ratio: 1.3, cash_ratio: 0.5, working_capital: 120.0, asset_turnover: 0.6, inventory_turnover: 8.0, receivable_turnover: 7.0, payable_turnover: 6.0, working_capital_turnover: 4.5, debt_to_equity: 0.6, debt_to_assets: 0.3, equity_ratio: 0.5, interest_coverage: 8.0, financial_leverage: 1.8 },
      "Consumer Discretionary": { gross_margin: 45.0, operating_margin: 9.0, net_margin: 6.0, ebitda_margin: 12.0, roa: 5.0, roe: 14.0, roce: 11.0, current_ratio: 1.4, quick_ratio: 0.8, cash_ratio: 0.3, working_capital: 80.0, asset_turnover: 1.2, inventory_turnover: 7.0, receivable_turnover: 12.0, payable_turnover: 9.0, working_capital_turnover: 8.0, debt_to_equity: 0.9, debt_to_assets: 0.4, equity_ratio: 0.4, interest_coverage: 5.0, financial_leverage: 2.2 },
      "Consumer Staples": { gross_margin: 35.0, operating_margin: 8.0, net_margin: 5.0, ebitda_margin: 11.0, roa: 6.0, roe: 16.0, roce: 13.0, current_ratio: 1.3, quick_ratio: 0.7, cash_ratio: 0.3, working_capital: 70.0, asset_turnover: 1.3, inventory_turnover: 9.0, receivable_turnover: 14.0, payable_turnover: 10.0, working_capital_turnover: 9.0, debt_to_equity: 1.1, debt_to_assets: 0.45, equity_ratio: 0.35, interest_coverage: 6.0, financial_leverage: 2.5 },
      "Automotive": { gross_margin: 18.0, operating_margin: 7.0, net_margin: 5.0, ebitda_margin: 12.0, roa: 4.0, roe: 12.0, roce: 9.0, current_ratio: 1.2, quick_ratio: 0.8, cash_ratio: 0.4, working_capital: 90.0, asset_turnover: 0.8, inventory_turnover: 6.0, receivable_turnover: 10.0, payable_turnover: 8.0, working_capital_turnover: 5.0, debt_to_equity: 1.5, debt_to_assets: 0.5, equity_ratio: 0.3, interest_coverage: 4.0, financial_leverage: 3.0 },
      "Industrials": { gross_margin: 28.0, operating_margin: 10.0, net_margin: 7.0, ebitda_margin: 14.0, roa: 5.0, roe: 13.0, roce: 11.0, current_ratio: 1.5, quick_ratio: 1.0, cash_ratio: 0.4, working_capital: 100.0, asset_turnover: 0.9, inventory_turnover: 5.5, receivable_turnover: 7.5, payable_turnover: 6.5, working_capital_turnover: 5.5, debt_to_equity: 0.8, debt_to_assets: 0.35, equity_ratio: 0.4, interest_coverage: 6.0, financial_leverage: 2.1 },
      "Energy": { gross_margin: 32.0, operating_margin: 11.0, net_margin: 8.0, ebitda_margin: 20.0, roa: 4.5, roe: 11.0, roce: 8.5, current_ratio: 1.3, quick_ratio: 0.9, cash_ratio: 0.3, working_capital: 85.0, asset_turnover: 0.5, inventory_turnover: 8.0, receivable_turnover: 8.5, payable_turnover: 7.0, working_capital_turnover: 4.0, debt_to_equity: 0.7, debt_to_assets: 0.3, equity_ratio: 0.45, interest_coverage: 5.5, financial_leverage: 2.0 }
    };
  }

  init() {
    const cached = sessionStorage.getItem('analysis_result');
    if (!cached) {
      alert('No active session found. Returning to dashboard.');
      window.location.href = 'index.html';
      return;
    }

    try {
      this.data = JSON.parse(cached);
    } catch (e) {
      console.error('Failed to parse session data:', e);
      window.location.href = 'index.html';
      return;
    }

    // Reconstruct raw_agent_outputs client-side if missing
    if (!this.data.raw_agent_outputs) {
      this.data.raw_agent_outputs = {};
    }
    const fm = this.data.raw_agent_outputs.financial_metrics;
    const hasFM = fm && (fm.historical_metrics || fm.output?.historical_metrics);
    if (!this.data.raw_agent_outputs.financial_metrics || !hasFM) {
      this.data.raw_agent_outputs.financial_metrics = this.reconstructFinancialMetrics();
    }
    const fr = this.data.raw_agent_outputs.financial_ratios;
    const hasFR = fr && (fr.historical_ratios || fr.output?.historical_ratios);
    if (!this.data.raw_agent_outputs.financial_ratios || !hasFR) {
      this.data.raw_agent_outputs.financial_ratios = this.reconstructFinancialRatios();
    }

    // Initialize Sidebar and Header components
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);
    
    this.header = new Header('header-container');
    this.header.render(this.data.company);

    // Highlight sidebar active item
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Financial Health');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // Run Calculations & Render sections
    this.calculateRatios();
    this.renderHealthPage();
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

  getIndustryAverage(key) {
    if (this.data.industry_ratios && this.data.industry_ratios[key] !== undefined) {
      return this.data.industry_ratios[key];
    }
    if (this.data.company?.industry_averages && this.data.company.industry_averages[key] !== undefined) {
      return this.data.company.industry_averages[key];
    }
    const sector = this.data.company?.sector || "Technology";
    const sectorMap = this.sectorBenchmarks[sector] || this.sectorBenchmarks["Technology"];
    if (sectorMap && sectorMap[key] !== undefined) {
      return sectorMap[key];
    }
    if (this.ratiosMeta[key] && this.ratiosMeta[key].benchmark !== undefined) {
      return this.ratiosMeta[key].benchmark;
    }
    return null;
  }

  getRatioStatusVsIndustry(key, curVal, industryAvg) {
    if (curVal === null || curVal === undefined) return 'Weak';
    const cur = this.coerceFloat(curVal);
    if (cur === null) return 'Weak';
    const ind = industryAvg !== null ? this.coerceFloat(industryAvg) : (this.ratiosMeta[key]?.benchmark || 1.0);
    
    if (key === 'debt_to_equity' || key === 'debt_to_assets' || key === 'financial_leverage') {
      if (cur <= ind * 0.8) return 'Excellent';
      if (cur <= ind) return 'Good';
      if (cur <= ind * 1.2) return 'Average';
      return 'Weak';
    }
    
    if (cur >= ind * 1.2) return 'Excellent';
    if (cur >= ind) return 'Good';
    if (cur >= ind * 0.7) return 'Average';
    return 'Weak';
  }

  calculateRatios() {
    const fr = this.data.raw_agent_outputs?.financial_ratios;
    const fm = this.data.raw_agent_outputs?.financial_metrics;
    
    const latestYr = fm?.output?.latest_year || fm?.latest_year || '2024';
    const histMetrics = fm?.output?.historical_metrics || {};
    const latestMetrics = histMetrics[latestYr] || {};

    const detectedYears = [...(fm?.output?.detected_years || fm?.detected_years || ['2024', '2023', '2022'])];
    detectedYears.sort();
    const previousYr = detectedYears[detectedYears.length - 2] || '2023';
    const previousMetrics = histMetrics[previousYr] || {};

    const latestRatios = fr?.output?.latest_ratios || fr?.latest_ratios || {};
    const histRatios = fr?.output?.historical_ratios || fr?.historical_ratios || {};
    const prevRatios = histRatios[previousYr] || {};

    Object.keys(this.ratiosMeta).forEach(key => {
      let curVal = this.getAgentRatio(latestRatios, key);
      let priVal = this.getAgentRatio(prevRatios, key);

      if (curVal === null) {
        curVal = this.deriveRatio(latestMetrics, key);
      }
      if (priVal === null) {
        priVal = this.deriveRatio(previousMetrics, key);
      }

      this.ratiosData[key] = {
        curVal: curVal,
        priVal: priVal
      };
    });
  }

  getAgentRatio(yearRatios, key) {
    if (!yearRatios) return null;
    const map = {
      roe: ['roe', 'roe_pct'],
      roa: ['roa', 'roa_pct'],
      current_ratio: ['current_ratio'],
      quick_ratio: ['quick_ratio'],
      debt_to_equity: ['debt_to_equity'],
      ebitda_margin: ['ebitda_margin', 'ebitda_margin_pct'],
      net_margin: ['net_margin', 'net_margin_pct', 'profit_margin'],
      operating_margin: ['operating_margin', 'operating_margin_pct'],
      asset_turnover: ['asset_turnover'],
      interest_coverage: ['interest_coverage']
    };
    const list = map[key] || [key];
    for (let alt of list) {
      if (yearRatios[alt] !== undefined && yearRatios[alt] !== null && yearRatios[alt] !== 'Not Available' && yearRatios[alt] !== 'N/A') {
        return yearRatios[alt];
      }
    }
    return null;
  }

  deriveRatio(yrMetrics, key) {
    if (this.data.metrics?.[key]) {
      const mObj = this.data.metrics[key];
      const fm = this.data.raw_agent_outputs?.financial_metrics;
      const latestYr = fm?.output?.latest_year || fm?.latest_year || '2024';
      const yr = yrMetrics.year || latestYr || '2024';
      if (yr === latestYr) {
        if (mObj.value !== undefined && mObj.value !== null) {
          return mObj.value;
        }
      }
    }

    const rev = this.coerceFloat(yrMetrics.revenue);
    const gp = this.coerceFloat(yrMetrics.gross_profit);
    const op = this.coerceFloat(yrMetrics.operating_profit);
    const ebitda = this.coerceFloat(yrMetrics.ebitda);
    const np = this.coerceFloat(yrMetrics.net_profit);
    const ca = this.coerceFloat(yrMetrics.current_assets);
    const cl = this.coerceFloat(yrMetrics.current_liabilities);
    const assets = this.coerceFloat(yrMetrics.total_assets);
    const liab = this.coerceFloat(yrMetrics.total_liabilities);
    const eq = this.coerceFloat(yrMetrics.equity);
    const cash = this.coerceFloat(yrMetrics.cash) || this.coerceFloat(yrMetrics.cash_equivalents) || 0;
    const inv = this.coerceFloat(yrMetrics.inventory) || 0;
    const interest = this.coerceFloat(yrMetrics.interest_expense) || (liab ? liab * 0.05 : 1);

    switch(key) {
      case 'gross_margin':
        return (gp && rev) ? (gp / rev * 100) : null;
      case 'operating_margin':
        return (op && rev) ? (op / rev * 100) : null;
      case 'net_margin':
        return (np && rev) ? (np / rev * 100) : null;
      case 'ebitda_margin':
        return (ebitda && rev) ? (ebitda / rev * 100) : null;
      case 'roa':
        return (np && assets) ? (np / assets * 100) : null;
      case 'roe':
        return (np && eq) ? (np / eq * 100) : null;
      case 'current_ratio':
        return (ca && cl) ? (ca / cl) : null;
      case 'quick_ratio':
        return (ca && cl) ? ((ca - inv) / cl) : null;
      case 'cash_ratio':
        return (cash && cl) ? (cash / cl) : null;
      case 'debt_to_equity':
        return (liab && eq) ? (liab / eq) : null;
      case 'asset_turnover':
        return (rev && assets) ? (rev / assets) : null;
      case 'interest_coverage':
        return (op && interest) ? (op / interest) : null;
      default:
        return null;
    }
  }

  renderHealthPage() {
    // Four pillars score mappings
    const pillars = {
      profitability: ['gross_margin', 'net_margin', 'roe'],
      liquidity: ['current_ratio', 'quick_ratio'],
      efficiency: ['asset_turnover'],
      solvency: ['debt_to_equity', 'interest_coverage']
    };

    const pillarScores = {};
    Object.keys(pillars).forEach(pil => {
      let sum = 0;
      let count = 0;
      pillars[pil].forEach(key => {
        const val = this.ratiosData[key]?.curVal;
        if (val !== null && val !== undefined) {
          const indAvg = this.getIndustryAverage(key);
          const status = this.getRatioStatusVsIndustry(key, val, indAvg);
          let score = 55;
          if (status === 'Excellent') score = 95;
          else if (status === 'Good') score = 80;
          else if (status === 'Average') score = 65;
          else if (status === 'Weak') score = 40;
          
          sum += score;
          count++;
        }
      });
      pillarScores[pil] = count > 0 ? Math.round(sum / count) : 60;
    });

    // Populate pillar score elements
    Object.keys(pillarScores).forEach(pil => {
      const score = pillarScores[pil];
      document.getElementById(`pillar-score-${pil}`).textContent = `${score}/100`;
      
      const badge = document.getElementById(`pillar-badge-${pil}`);
      const status = score >= 80 ? 'Excellent' : (score >= 60 ? 'Good' : 'Weak');
      badge.textContent = status.toUpperCase();
      badge.className = `badge ${score >= 80 ? 'badge-buy' : (score >= 60 ? 'badge-hold' : 'badge-sell')}`;
    });

    // Calculate Overall Health Score
    const overallScore = Math.round((pillarScores.profitability + pillarScores.liquidity + pillarScores.efficiency + pillarScores.solvency) / 4);
    document.getElementById('health-overall-score').textContent = `${overallScore}/100`;
    
    const overallStatus = overallScore >= 80 ? 'Excellent' : (overallScore >= 60 ? 'Good' : 'Weak');
    const overallStatusEl = document.getElementById('health-overall-status');
    overallStatusEl.textContent = overallStatus.toUpperCase();
    
    const overallBadgeClass = overallScore >= 80 ? 'badge-buy' : (overallScore >= 60 ? 'badge-hold' : 'badge-sell');
    overallStatusEl.className = `badge ${overallBadgeClass}`;

    // Dynamic Strengths & Weaknesses
    const strengths = [];
    const weaknesses = [];

    const latestMetrics = this.data.raw_agent_outputs?.financial_metrics?.output?.latest_metrics || {};
    const historicalMetrics = this.data.raw_agent_outputs?.financial_metrics?.output?.historical_metrics || {};
    const detectedYears = [...(this.data.raw_agent_outputs?.financial_metrics?.output?.detected_years || ['2024', '2023', '2022'])];
    detectedYears.sort();
    const prevYr = detectedYears[detectedYears.length - 2] || '2023';
    const prevMetrics = historicalMetrics[prevYr] || {};

    const revGrowth = this.coerceFloat(this.data.metrics?.revenue?.change) || 0;
    const fcf = this.coerceFloat(this.data.metrics?.free_cash_flow?.value) || this.coerceFloat(latestMetrics.free_cash_flow) || 0;
    const roe = this.coerceFloat(this.ratiosData.roe?.curVal) || 0;
    const netMargin = this.coerceFloat(this.ratiosData.net_margin?.curVal) || 0;
    const currentRatio = this.coerceFloat(this.ratiosData.current_ratio?.curVal) || 1.0;
    const debtToEquity = this.coerceFloat(this.ratiosData.debt_to_equity?.curVal) || 0;
    const interestCoverage = this.coerceFloat(this.ratiosData.interest_coverage?.curVal) || 1.0;

    // Check strengths
    if (revGrowth >= 10.0) strengths.push(`Strong revenue growth of ${revGrowth.toFixed(1)}% YoY indicates solid top-line business velocity.`);
    else if (revGrowth >= 0) strengths.push(`Stable revenue expansion of ${revGrowth.toFixed(1)}% YoY indicates operational consistency.`);
    
    if (roe >= 15.0) strengths.push(`High return on equity of ${roe.toFixed(1)}% demonstrates highly efficient shareholder compounding.`);
    else if (roe >= 10.0) strengths.push(`Healthy return on equity of ${roe.toFixed(1)}% aligned with average corporate yields.`);
    
    if (netMargin >= 10.0) strengths.push(`Robust net margin of ${netMargin.toFixed(1)}% provides buffer against cost increases.`);
    if (fcf > 0) strengths.push(`Positive free cash flow generation ensures ongoing liquidity to fund operations without debt reliance.`);
    if (debtToEquity <= 0.6) strengths.push(`Low leverage with a Debt-to-Equity of ${debtToEquity.toFixed(2)}x lowers insolvency risks.`);
    if (interestCoverage >= 6.0) strengths.push(`Robust interest coverage ratio of ${interestCoverage.toFixed(1)}x reduces financing distress risks.`);
    
    // Check weaknesses
    if (revGrowth < 0.0) weaknesses.push(`Top-line revenue contraction of ${revGrowth.toFixed(1)}% YoY indicates declining business velocity.`);
    if (roe < 8.0) weaknesses.push(`Return on equity of ${roe.toFixed(1)}% is low, indicating weaker capital utilization.`);
    if (netMargin < 6.0) weaknesses.push(`Narrow net profit margin of ${netMargin.toFixed(1)}% leaves company vulnerable to supply chain hikes.`);
    if (currentRatio < 1.0) weaknesses.push(`Tight liquidity buffer with Current Ratio of ${currentRatio.toFixed(2)}x indicates potential vendor payment delays.`);
    if (debtToEquity >= 1.5) weaknesses.push(`High leverage with Debt-to-Equity of ${debtToEquity.toFixed(2)}x elevates solvency exposure.`);
    if (interestCoverage < 2.0) weaknesses.push(`Weak interest coverage of ${interestCoverage.toFixed(1)}x indicates low safety cushion for financing costs.`);
    if (fcf <= 0) weaknesses.push("Negative or flat free cash flow implies substantial capital expenditure or operational cash lockups.");

    // Populate lists with 1.7 line height
    const strengthsContainer = document.getElementById('health-strengths-container');
    strengthsContainer.innerHTML = strengths.map(s => `
      <div class="bullet-item">
        <svg class="lucide lucide-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${s}</span>
      </div>
    `).join('') || `<div style="color:var(--text-muted); font-size:12px;">No notable strengths computed.</div>`;

    const weaknessesContainer = document.getElementById('health-weaknesses-container');
    weaknessesContainer.innerHTML = weaknesses.map(w => `
      <div class="bullet-item">
        <svg class="lucide lucide-alert-triangle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
        <span>${w}</span>
      </div>
    `).join('') || `<div style="color:var(--text-muted); font-size:12px;">No critical weaknesses flagged.</div>`;

    // 5. Financial Stability Matrix Table formatting
    const stabilityData = [
      {
        metric: "Revenue Stability",
        status: revGrowth > 10 ? "Strong" : (revGrowth >= 0 ? "Moderate" : "Weak"),
        reason: revGrowth > 0 ? `Top-line grew by ${revGrowth.toFixed(1)}% YoY` : `Revenue declined by ${Math.abs(revGrowth).toFixed(1)}%`
      },
      {
        metric: "Profit Stability",
        status: netMargin >= 10 ? "Strong" : (netMargin >= 5 ? "Moderate" : "Weak"),
        reason: `Net Profit Margin of ${netMargin.toFixed(1)}%`
      },
      {
        metric: "Cash Flow Stability",
        status: fcf > 0 ? "Strong" : "Weak",
        reason: fcf > 0 ? `Generates positive cash surplus` : "Negative cash conversion cycles"
      },
      {
        metric: "Debt Stability",
        status: debtToEquity <= 0.6 ? "Strong" : (debtToEquity < 1.2 ? "Moderate" : "Weak"),
        reason: `Leverage multiplier of ${debtToEquity.toFixed(2)}x`
      },
      {
        metric: "Liquidity",
        status: currentRatio >= 1.5 ? "Strong" : (currentRatio >= 1.0 ? "Moderate" : "Weak"),
        reason: `Current obligations covered ${currentRatio.toFixed(2)}x`
      }
    ];

    const stabilityTbody = document.getElementById('stability-tbody');
    stabilityTbody.innerHTML = stabilityData.map(row => `
      <tr>
        <td style="text-align: left; font-weight: 600;">${row.metric}</td>
        <td style="text-align: center;"><span class="badge ${row.status === 'Strong' ? 'badge-buy' : (row.status === 'Moderate' ? 'badge-hold' : 'badge-sell')}">${row.status}</span></td>
        <td style="text-align: left;">${row.reason}</td>
      </tr>
    `).join('');

    // Area Trend Summary Table formatting
    const revTrend = revGrowth > 5 ? "Improving" : (revGrowth >= 0 ? "Stable" : "Declining");
    
    const prevMargin = this.coerceFloat(this.ratiosData.net_margin?.priVal) || netMargin;
    const marginTrend = (netMargin - prevMargin) > 1.0 ? "Improving" : (Math.abs(netMargin - prevMargin) <= 1.0 ? "Stable" : "Declining");
    
    const prevDebt = this.coerceFloat(this.ratiosData.debt_to_equity?.priVal) || debtToEquity;
    const debtTrend = (debtToEquity - prevDebt) < -0.05 ? "Improving" : (Math.abs(debtToEquity - prevDebt) <= 0.05 ? "Stable" : "Declining");
    
    const prevOcf = this.coerceFloat(prevMetrics.operating_cash_flow) || 0;
    const ocf = this.coerceFloat(latestMetrics.operating_cash_flow) || 0;
    const cashTrend = (ocf - prevOcf) > 0 ? "Improving" : ((ocf - prevOcf) === 0 ? "Stable" : "Declining");

    const prevAssets = this.coerceFloat(prevMetrics.total_assets) || 0;
    const assets = this.coerceFloat(latestMetrics.total_assets) || 0;
    const assetsTrend = (assets - prevAssets) > 0 ? "Stable" : "Declining";

    const trendData = [
      { area: "Revenue", trend: revTrend },
      { area: "Margins", trend: marginTrend },
      { area: "Debt", trend: debtTrend },
      { area: "Cash Flow", trend: cashTrend },
      { area: "Assets", trend: assetsTrend }
    ];

    const trendTbody = document.getElementById('trend-tbody');
    trendTbody.innerHTML = trendData.map(row => {
      let badgeClass = 'badge-hold';
      if (row.trend === 'Improving') badgeClass = 'badge-buy';
      else if (row.trend === 'Declining') badgeClass = 'badge-sell';
      
      return `
        <tr>
          <td style="text-align: left; font-weight: 600;">${row.area}</td>
          <td style="text-align: center;"><span class="badge ${badgeClass}">${row.trend}</span></td>
        </tr>
      `;
    }).join('');

    // Health Checklist 2 responsive columns
    const ocfVal = this.coerceFloat(latestMetrics.operating_cash_flow) || 0;
    const npVal = this.coerceFloat(latestMetrics.net_profit) || 0;
    const ebitdaVal = this.coerceFloat(latestMetrics.ebitda) || 0;
    const equityVal = this.coerceFloat(latestMetrics.equity) || 0;

    const checklistItems = [
      { label: "Positive Operating Cash Flow", pass: ocfVal > 0 },
      { label: "Positive Net Income", pass: npVal > 0 },
      { label: "EBITDA Positive", pass: ebitdaVal > 0 },
      { label: "Revenue Growing", pass: revGrowth > 0 },
      { label: "Healthy Equity", pass: equityVal > 0 },
      { label: "Debt Under Control", pass: debtToEquity < 1.5 },
      { label: "Positive Free Cash Flow", pass: fcf > 0 },
      { label: "Acceptable Liquidity", pass: currentRatio >= 1.0 }
    ];

    const checklistContainer = document.getElementById('checklist-grid-container');
    checklistContainer.innerHTML = checklistItems.map(item => `
      <div class="checklist-item ${item.pass ? 'checklist-pass' : 'checklist-fail'}">
        ${item.pass ? `
          <svg class="lucide lucide-check-circle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        ` : `
          <svg class="lucide lucide-x-circle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
        `}
        <span>${item.label}</span>
      </div>
    `).join('');

    // Investor Watchlist with alert box formatting
    const watchlist = [];
    if (currentRatio < 1.3) {
      watchlist.push({ type: "Monitor", desc: "Monitor working capital cycles closely as liquidity buffers are narrow." });
    } else {
      watchlist.push({ type: "Positive", desc: "Working capital and short-term buffers are within acceptable levels." });
    }

    if (debtToEquity >= 1.2) {
      watchlist.push({ type: "Monitor", desc: "Leverage levels are relatively high; monitor debt interest coverage ratios quarterly." });
    } else {
      watchlist.push({ type: "Positive", desc: "Long-term leverage metrics are conservative and manageable." });
    }

    if (netMargin >= 10.0) {
      watchlist.push({ type: "Observation", desc: "Pricing power is robust; net margins outperform average peer margins." });
    }
    if (fcf <= 0) {
      watchlist.push({ type: "Monitor", desc: "Negative free cash flow requires scrutiny regarding inventory or cash flow conversions." });
    }

    const watchlistContainer = document.getElementById('watchlist-container');
    watchlistContainer.innerHTML = watchlist.map(item => {
      let typeIcon = '🟢';
      let typeTitle = 'Positive';
      let borderColor = 'rgba(16, 185, 129, 0.2)';
      let titleColor = 'var(--accent-green)';
      
      if (item.type === 'Monitor') {
        typeIcon = '🟡';
        typeTitle = 'Monitor';
        borderColor = 'rgba(245, 158, 11, 0.2)';
        titleColor = 'var(--accent-orange)';
      } else if (item.type === 'Observation') {
        typeIcon = '🔵';
        typeTitle = 'Observation';
        borderColor = 'rgba(59, 130, 246, 0.2)';
        titleColor = 'var(--accent-blue)';
      }

      return `
        <div class="watchlist-alert-card" style="border-color: ${borderColor};">
          <span class="watchlist-alert-icon">${typeIcon}</span>
          <div class="watchlist-alert-body">
            <span class="watchlist-alert-title" style="color: ${titleColor};">${typeTitle}</span>
            <span class="watchlist-alert-desc">${item.desc}</span>
          </div>
        </div>
      `;
    }).join('');

    // Executive Health Summary paragraphs
    const compName = this.data.company?.name || "The company";
    const reportYr = this.data.company?.report_year || "the latest fiscal period";
    const p1 = `${compName} demonstrates a ${overallStatus.toLowerCase()} financial health profile for ${reportYr}, supported by an overall rating of ${overallScore}/100. This score is derived through dynamic analysis of key performance metrics, profit conversion ratios, and long-term capital structural stability.`;
    const p2 = `Operating profitability is characterized by a net profit margin of ${netMargin.toFixed(1)}% and a return on equity of ${roe.toFixed(1)}%. These returns suggest ${roe >= 15 ? 'highly productive compounding of shareholder capital' : 'moderate efficiency in converting capital input into earnings'}, while liquidity displays a Current Ratio of ${currentRatio.toFixed(2)}x, indicating ${currentRatio >= 1.5 ? 'sufficient coverage' : 'relatively tight margins'} against current liabilities.`;
    const p3 = `From a structural risk perspective, debt leverage of ${debtToEquity.toFixed(2)}x and interest coverage of ${interestCoverage.toFixed(1)}x show that long-term solvency remains ${debtToEquity <= 0.8 ? 'conservative' : 'manageable'}. Continued optimization of operating cash flows and working capital turnover will help insulate the company from macro fluctuations.`;
    document.getElementById('health-summary-paragraphs').innerHTML = `<p style="margin-bottom:var(--space-2.5);">${p1}</p><p style="margin-bottom:var(--space-2.5);">${p2}</p><p>${p3}</p>`;

    // AI Opinion
    document.getElementById('ai-opinion-text').textContent = `The company's financial health score of ${overallScore}/100 supports a ${overallScore >= 80 ? 'bullish long-term outlook' : (overallScore >= 60 ? 'stable holding outlook' : 'cautious investment stance')}. Robust operating returns and manageable solvency parameters outweigh any near-term liquidity constraints.`;

    // Recommendation Banner
    let recText = '';
    let recImpact = '';
    let recClass = '';
    
    if (overallScore >= 80) {
      recText = "Strong Financial Health - Suitable for Long-Term Investors";
      recImpact = "Bullish";
      recClass = "badge-buy";
    } else if (overallScore >= 70) {
      recText = "Healthy but Monitor Liquidity";
      recImpact = "Neutral";
      recClass = "badge-hold";
    } else if (overallScore >= 60) {
      recText = "Wait for Better Cash Flow";
      recImpact = "Neutral";
      recClass = "badge-hold";
    } else {
      recText = "High Financial Risk - Requires Deeper Analysis";
      recImpact = "Bearish";
      recClass = "badge-sell";
    }

    document.getElementById('action-recommendation-box').innerHTML = `
      <div style="flex: 1; color: var(--text-primary); font-weight: 600;">${recText}</div>
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <span class="field-label" style="font-size: 9px; margin-top: 1px;">Impact</span>
        <span class="badge ${recClass}">${recImpact}</span>
      </div>
    `;
  }

  reconstructFinancialMetrics() {
    const trend = this.data.performance_trend || {};
    const years = [...(trend.years || ['2024', '2023', '2022'])];
    years.sort((a, b) => b - a);
    const latestYr = years[0] || '2024';

    const histMetrics = {};
    years.forEach(yr => {
      histMetrics[yr] = {};
    });

    const metricsKeys = [
      'revenue', 'gross_profit', 'operating_profit', 'ebitda', 'net_profit', 'eps',
      'current_assets', 'total_assets', 'current_liabilities', 'long_term_debt',
      'total_debt', 'total_liabilities', 'equity', 'operating_cash_flow', 'free_cash_flow'
    ];

    years.forEach(yr => {
      metricsKeys.forEach(mKey => {
        let val = null;
        if (this.data.metrics?.[mKey]) {
          const mObj = this.data.metrics[mKey];
          if (yr === latestYr && mObj.value !== undefined && mObj.value !== null) {
            val = mObj.value;
          }
          const spark = mObj.sparkline || [];
          if (spark.length > 0) {
            const yearsAsc = [...years].reverse();
            const offset = yearsAsc.length - spark.length;
            const yrIdx = yearsAsc.indexOf(yr);
            if (yrIdx >= offset) {
              val = spark[yrIdx - offset];
            }
          }
        }
        if (val !== null && val !== undefined) {
          histMetrics[yr][mKey] = val;
        }
      });
    });

    return {
      output: {
        latest_year: latestYr,
        detected_years: years,
        latest_metrics: histMetrics[latestYr] || {},
        historical_metrics: histMetrics
      }
    };
  }

  reconstructFinancialRatios() {
    const trend = this.data.performance_trend || {};
    const fm = this.data.raw_agent_outputs?.financial_metrics;
    const detectedYears = [...(fm?.output?.detected_years || fm?.detected_years || trend.years || ['2024', '2023', '2022'])];
    detectedYears.sort();
    const latestYear = fm?.output?.latest_year || fm?.latest_year || detectedYears[detectedYears.length - 1] || '2024';

    const historical = {};
    detectedYears.forEach(yr => {
      historical[yr] = {
        gross_margin: null, operating_margin: null, net_margin: null, ebitda_margin: null,
        roa: null, roe: null, current_ratio: null, quick_ratio: null,
        debt_to_equity: null, asset_turnover: null, interest_coverage: null
      };
    });

    const metricsKeys = {
      gross_margin: 'gross_margin', operating_margin: 'operating_margin', net_margin: 'net_margin', ebitda_margin: 'ebitda_margin',
      roa: 'roa', roe: 'roe', current_ratio: 'current_ratio', quick_ratio: 'quick_ratio',
      debt_to_equity: 'debt_to_equity', asset_turnover: 'asset_turnover', interest_coverage: 'interest_coverage'
    };

    detectedYears.forEach(yr => {
      Object.keys(metricsKeys).forEach(rKey => {
        let val = null;
        if (this.data.metrics?.[rKey]) {
          const mObj = this.data.metrics[rKey];
          if (yr === latestYear && mObj.value !== undefined && mObj.value !== null) {
            val = mObj.value;
          }
          const spark = mObj.sparkline || [];
          if (spark.length > 0) {
            const yearsAsc = [...detectedYears].sort();
            const offset = yearsAsc.length - spark.length;
            const yrIdx = yearsAsc.indexOf(yr) - offset;
            if (yrIdx >= 0 && yrIdx < spark.length) {
              val = spark[yrIdx];
            }
          }
        }
        if (val !== null && val !== undefined) {
          historical[yr][rKey] = val;
        }
      });
    });

    return {
      output: {
        latest_year: latestYear,
        latest_ratios: historical[latestYear] || {},
        historical_ratios: historical
      }
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new FinancialHealthPage();
  page.init();
});
