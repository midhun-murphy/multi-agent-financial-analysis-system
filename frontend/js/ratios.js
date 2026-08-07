import { Sidebar } from './components/sidebar.js';

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

class RatiosDetailsPage {
  constructor() {
    this.data = null;
    this.sidebar = null;

    // 4 Category Definitions
    this.categories = {
      profitability: {
        title: 'Profitability Analysis',
        question: 'Can this company consistently generate profit?',
        keys: ['gross_margin', 'operating_margin', 'net_margin', 'ebitda_margin', 'roa', 'roe', 'roce']
      },
      liquidity: {
        title: 'Liquidity Analysis',
        question: 'Can it pay short-term obligations?',
        keys: ['current_ratio', 'quick_ratio', 'cash_ratio', 'working_capital']
      },
      efficiency: {
        title: 'Operational Efficiency',
        question: 'Does management use assets efficiently?',
        keys: ['asset_turnover', 'inventory_turnover', 'receivable_turnover', 'payable_turnover', 'working_capital_turnover']
      },
      solvency: {
        title: 'Solvency Stability',
        question: 'Can the company survive long term?',
        keys: ['debt_to_equity', 'debt_to_assets', 'equity_ratio', 'interest_coverage', 'financial_leverage']
      }
    };

    // Core Ratios Metadata (Investor Focused)
    this.ratiosMeta = {
      gross_margin: {
        name: 'Gross Margin',
        formula: 'Gross Profit / Revenue',
        category: 'profitability',
        definition: 'Measures the efficiency of production and direct sales margins.',
        meaning: 'Higher margins indicate stronger pricing power and competitive barriers.',
        benchmark: 35.0,
        unit: '%',
        investorText: 'Higher margins indicate stronger pricing power.'
      },
      operating_margin: {
        name: 'Operating Margin',
        formula: 'Operating Income / Revenue',
        category: 'profitability',
        definition: 'Percentage of sales dollar remaining after cost of sales and overheads.',
        meaning: 'Shows operating efficiency before non-operating items, interest, and taxes.',
        benchmark: 12.0,
        unit: '%',
        investorText: 'Measures operating efficiency and raw pricing leverage before leverage or taxes.'
      },
      net_margin: {
        name: 'Net Profit Margin',
        formula: 'Net Profit / Revenue',
        category: 'profitability',
        definition: 'Measures how much net profit remains per dollar of revenue.',
        meaning: 'The ultimate bottom-line measurement of corporate profitability.',
        benchmark: 10.0,
        unit: '%',
        investorText: 'Measures how much profit remains after all expenses.'
      },
      ebitda_margin: {
        name: 'EBITDA Margin',
        formula: 'EBITDA / Revenue',
        category: 'profitability',
        definition: 'Cash flow operating margin relative to revenue.',
        meaning: 'Reflects operating profitability neutral to capital structures or non-cash charges.',
        benchmark: 18.0,
        unit: '%',
        investorText: 'Reflects clean cash operating efficiency relative to sales.'
      },
      roa: {
        name: 'Return on Assets (ROA)',
        formula: 'Net Income / Total Assets',
        category: 'profitability',
        definition: 'Efficiency of total asset utilization in generating net profit.',
        meaning: 'Evaluates the company\'s capital intensity and profit generation power.',
        benchmark: 7.0,
        unit: '%',
        investorText: 'Shows how efficiently assets produce profit.'
      },
      roe: {
        name: 'Return on Equity (ROE)',
        formula: 'Net Income / Shareholders\' Equity',
        category: 'profitability',
        definition: 'Generates profits from shareholders\' equity capital.',
        meaning: 'Key gauge of how effectively management compounds equity investor capital.',
        benchmark: 15.0,
        unit: '%',
        investorText: 'Shows how efficiently management generates shareholder returns.'
      },
      roce: {
        name: 'Return on Capital Employed (ROCE)',
        formula: 'EBIT / (Total Assets - Current Liabilities)',
        category: 'profitability',
        definition: 'Operating returns relative to total capital employed.',
        meaning: 'Clean comparison of investment returns across capital structures.',
        benchmark: 12.0,
        unit: '%',
        investorText: 'Shows the returns generated on all capital pools (debt and equity) employed.'
      },
      
      current_ratio: {
        name: 'Current Ratio',
        formula: 'Current Assets / Current Liabilities',
        category: 'liquidity',
        definition: 'Measures standard current assets against current liabilities.',
        meaning: 'Indicates the short-term safety buffer of assets relative to near-term obligations.',
        benchmark: 1.5,
        unit: '',
        investorText: 'Measures short-term debt coverage using total current asset reserves.'
      },
      quick_ratio: {
        name: 'Quick Ratio',
        formula: '(Current Assets - Inventory) / Current Liabilities',
        category: 'liquidity',
        definition: 'Measures cash-like short-term asset coverage.',
        meaning: 'Calculates immediate coverage by excluding inventory which is slower to liquidate.',
        benchmark: 1.0,
        unit: '',
        investorText: 'Measures immediate coverage without relying on inventory liquidations.'
      },
      cash_ratio: {
        name: 'Cash Ratio',
        formula: 'Cash & Equivalents / Current Liabilities',
        category: 'liquidity',
        definition: 'Most conservative short-term liquidity indicator.',
        meaning: 'Calculates immediate same-day safety buffers against defaults.',
        benchmark: 0.5,
        unit: '',
        investorText: 'Shows coverage against current debt using only immediate cash reserves.'
      },
      working_capital: {
        name: 'Working Capital',
        formula: 'Current Assets - Current Liabilities',
        category: 'liquidity',
        definition: 'The operational net current asset funding.',
        meaning: 'High working capital ensures day-to-day operations are funded without strain.',
        benchmark: 100.0,
        unit: 'M',
        investorText: 'Shows the operating cash buffer remaining to fund day-to-day operations.'
      },
      
      asset_turnover: {
        name: 'Asset Turnover',
        formula: 'Revenue / Total Assets',
        category: 'efficiency',
        definition: 'Efficiency of total asset deployment in driving top-line revenue.',
        meaning: 'Indicates sales generation activity per dollar of corporate assets.',
        benchmark: 0.8,
        unit: 'x',
        investorText: 'Shows how actively assets are utilized to generate sales volume.'
      },
      inventory_turnover: {
        name: 'Inventory Turnover',
        formula: 'Revenue / Inventory',
        category: 'efficiency',
        definition: 'Velocity of inventory sales cycles.',
        meaning: 'Higher turnover reflects strong demand and minimal cash locked in warehouse storage.',
        benchmark: 6.0,
        unit: 'x',
        investorText: 'Measures how many times inventory is cleared and restocked annually.'
      },
      receivable_turnover: {
        name: 'Receivables Turnover',
        formula: 'Revenue / Accounts Receivable',
        category: 'efficiency',
        definition: 'Velocity of credit collection cycles.',
        meaning: 'Higher indicates rapid collection from customers, minimizing bad debt risks.',
        benchmark: 8.0,
        unit: 'x',
        investorText: 'Measures efficiency in collecting client bills and cash conversion.'
      },
      payable_turnover: {
        name: 'Payables Turnover',
        formula: 'Revenue / Accounts Payable',
        category: 'efficiency',
        definition: 'Supplier credit cycle utilization.',
        meaning: 'Higher indicates faster supplier settlement; lower indicates cash preservation.',
        benchmark: 6.0,
        unit: 'x',
        investorText: 'Reflects velocity of payments to suppliers and credit negotiation terms.'
      },
      working_capital_turnover: {
        name: 'Working Capital Turnover',
        formula: 'Revenue / Working Capital',
        category: 'efficiency',
        definition: 'Sales velocity funded by working capital.',
        meaning: 'Shows efficiency of net operational assets committed to trading volume.',
        benchmark: 5.0,
        unit: 'x',
        investorText: 'Measures sales volume supported per unit of operating capital reserves.'
      },
      
      debt_to_equity: {
        name: 'Debt-to-Equity',
        formula: 'Total Liabilities / Shareholders\' Equity',
        category: 'solvency',
        definition: 'Gearing ratio reflecting liabilities against equity base.',
        meaning: 'High leverage increases capital risk and debt-servicing requirements.',
        benchmark: 0.8,
        unit: '',
        investorText: 'Measures total debt leverage obligations relative to shareholder capital.'
      },
      debt_to_assets: {
        name: 'Debt-to-Assets',
        formula: 'Total Debt / Total Assets',
        category: 'solvency',
        definition: 'Reflects total assets financed by interest-bearing debt.',
        meaning: 'High ratios suggest higher gearing and unencumbered asset constraints.',
        benchmark: 0.4,
        unit: '',
        investorText: 'Measures the proportion of company assets funded through borrowing.'
      },
      equity_ratio: {
        name: 'Equity Ratio',
        formula: 'Shareholders\' Equity / Total Assets',
        category: 'solvency',
        definition: 'The asset proportion owned directly by shareholders.',
        meaning: 'Measures solvency buffer safety levels; higher values reduce covenant risk.',
        benchmark: 0.4,
        unit: '',
        investorText: 'Shows capitalization safety buffers and shareholder asset ownership share.'
      },
      interest_coverage: {
        name: 'Interest Coverage',
        formula: 'Operating Profit / Interest Expense',
        category: 'solvency',
        definition: 'Profit margin coverage of interest expense obligations.',
        meaning: 'Higher ratios indicate operating profits easily cover debt interest payments.',
        benchmark: 3.0,
        unit: 'x',
        investorText: 'Measures profitability buffers available to cover debt interest burdens.'
      },
      financial_leverage: {
        name: 'Financial Leverage Multiplier',
        formula: 'Total Assets / Shareholders\' Equity',
        category: 'solvency',
        definition: 'Reflects assets backing per equity unit.',
        meaning: 'High multipliers reflect high gearing, amplifying both returns and solvency risks.',
        benchmark: 2.0,
        unit: 'x',
        investorText: 'Shows how much asset base is leveraged using investor equity inputs.'
      }
    };

    this.sectorBenchmarks = {
      "Technology": {
        gross_margin: 65.0,
        operating_margin: 18.0,
        net_margin: 15.0,
        ebitda_margin: 22.0,
        roa: 10.0,
        roe: 20.0,
        roce: 16.0,
        current_ratio: 2.0,
        quick_ratio: 1.5,
        cash_ratio: 0.8,
        working_capital: 150.0,
        asset_turnover: 0.7,
        inventory_turnover: 12.0,
        receivable_turnover: 9.0,
        payable_turnover: 8.0,
        working_capital_turnover: 6.0,
        debt_to_equity: 0.4,
        debt_to_assets: 0.2,
        equity_ratio: 0.6,
        interest_coverage: 15.0,
        financial_leverage: 1.6
      },
      "Healthcare": {
        gross_margin: 55.0,
        operating_margin: 12.0,
        net_margin: 9.0,
        ebitda_margin: 16.0,
        roa: 6.0,
        roe: 12.0,
        roce: 10.0,
        current_ratio: 1.8,
        quick_ratio: 1.3,
        cash_ratio: 0.5,
        working_capital: 120.0,
        asset_turnover: 0.6,
        inventory_turnover: 8.0,
        receivable_turnover: 7.0,
        payable_turnover: 6.0,
        working_capital_turnover: 4.5,
        debt_to_equity: 0.6,
        debt_to_assets: 0.3,
        equity_ratio: 0.5,
        interest_coverage: 8.0,
        financial_leverage: 1.8
      },
      "Consumer Discretionary": {
        gross_margin: 45.0,
        operating_margin: 9.0,
        net_margin: 6.0,
        ebitda_margin: 12.0,
        roa: 5.0,
        roe: 14.0,
        roce: 11.0,
        current_ratio: 1.4,
        quick_ratio: 0.8,
        cash_ratio: 0.3,
        working_capital: 80.0,
        asset_turnover: 1.2,
        inventory_turnover: 7.0,
        receivable_turnover: 12.0,
        payable_turnover: 9.0,
        working_capital_turnover: 8.0,
        debt_to_equity: 0.9,
        debt_to_assets: 0.4,
        equity_ratio: 0.4,
        interest_coverage: 5.0,
        financial_leverage: 2.2
      },
      "Consumer Staples": {
        gross_margin: 35.0,
        operating_margin: 8.0,
        net_margin: 5.0,
        ebitda_margin: 11.0,
        roa: 6.0,
        roe: 16.0,
        roce: 13.0,
        current_ratio: 1.3,
        quick_ratio: 0.7,
        cash_ratio: 0.3,
        working_capital: 70.0,
        asset_turnover: 1.3,
        inventory_turnover: 9.0,
        receivable_turnover: 14.0,
        payable_turnover: 10.0,
        working_capital_turnover: 9.0,
        debt_to_equity: 1.1,
        debt_to_assets: 0.45,
        equity_ratio: 0.35,
        interest_coverage: 6.0,
        financial_leverage: 2.5
      },
      "Automotive": {
        gross_margin: 18.0,
        operating_margin: 7.0,
        net_margin: 5.0,
        ebitda_margin: 12.0,
        roa: 4.0,
        roe: 12.0,
        roce: 9.0,
        current_ratio: 1.2,
        quick_ratio: 0.8,
        cash_ratio: 0.4,
        working_capital: 90.0,
        asset_turnover: 0.8,
        inventory_turnover: 6.0,
        receivable_turnover: 10.0,
        payable_turnover: 8.0,
        working_capital_turnover: 5.0,
        debt_to_equity: 1.5,
        debt_to_assets: 0.5,
        equity_ratio: 0.3,
        interest_coverage: 4.0,
        financial_leverage: 3.0
      },
      "Industrials": {
        gross_margin: 28.0,
        operating_margin: 10.0,
        net_margin: 7.0,
        ebitda_margin: 14.0,
        roa: 5.0,
        roe: 13.0,
        roce: 11.0,
        current_ratio: 1.5,
        quick_ratio: 1.0,
        cash_ratio: 0.4,
        working_capital: 100.0,
        asset_turnover: 0.9,
        inventory_turnover: 5.5,
        receivable_turnover: 7.5,
        payable_turnover: 6.5,
        working_capital_turnover: 5.5,
        debt_to_equity: 0.8,
        debt_to_assets: 0.35,
        equity_ratio: 0.4,
        interest_coverage: 6.0,
        financial_leverage: 2.1
      },
      "Energy": {
        gross_margin: 32.0,
        operating_margin: 11.0,
        net_margin: 8.0,
        ebitda_margin: 20.0,
        roa: 4.5,
        roe: 11.0,
        roce: 8.5,
        current_ratio: 1.3,
        quick_ratio: 0.9,
        cash_ratio: 0.3,
        working_capital: 85.0,
        asset_turnover: 0.5,
        inventory_turnover: 8.0,
        receivable_turnover: 8.5,
        payable_turnover: 7.0,
        working_capital_turnover: 4.0,
        debt_to_equity: 0.7,
        debt_to_assets: 0.3,
        equity_ratio: 0.45,
        interest_coverage: 5.5,
        financial_leverage: 2.0
      }
    };
  }

  getIndustryAverage(key) {
    // Priority 1: Financial API industry ratios if available
    if (this.data.industry_ratios && this.data.industry_ratios[key] !== undefined) {
      return this.data.industry_ratios[key];
    }
    // Priority 2: yfinance data if available
    if (this.data.company?.industry_averages && this.data.company.industry_averages[key] !== undefined) {
      return this.data.company.industry_averages[key];
    }
    // Priority 3: Sector benchmark mapping
    const sector = this.data.company?.sector || "Technology";
    const sectorMap = this.sectorBenchmarks[sector] || this.sectorBenchmarks["Technology"];
    if (sectorMap && sectorMap[key] !== undefined) {
      return sectorMap[key];
    }
    // Priority 4: Fallback to the meta benchmark if available
    if (this.ratiosMeta[key] && this.ratiosMeta[key].benchmark !== undefined) {
      return this.ratiosMeta[key].benchmark;
    }
    return null;
  }

  getRatioDifferenceStr(key, curVal, industryAvg) {
    if (curVal === null || industryAvg === null) return 'N/A';
    const cur = this.coerceFloat(curVal);
    const ind = this.coerceFloat(industryAvg);
    if (cur === null || ind === null) return 'N/A';

    const diff = cur - ind;
    const meta = this.ratiosMeta[key] || {};
    const unit = meta.unit || '';

    // Solvency/Leverage (Lower is better)
    if (key === 'debt_to_equity' || key === 'debt_to_assets' || key === 'financial_leverage') {
      return cur <= ind ? 'Better' : 'Higher';
    }

    // Liquidity (Higher is better)
    if (key === 'current_ratio' || key === 'quick_ratio' || key === 'cash_ratio') {
      return cur >= ind ? 'Above Avg' : 'Below Avg';
    }

    // Default (Higher is better, showing difference value with unit)
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}${unit}`;
  }

  getRatioStatusVsIndustry(key, curVal, industryAvg) {
    if (curVal === null || curVal === undefined) return 'Weak';
    const cur = this.coerceFloat(curVal);
    if (cur === null) return 'Weak';
    
    // Default to the standard benchmark if industry avg is unavailable
    const ind = industryAvg !== null ? this.coerceFloat(industryAvg) : (this.ratiosMeta[key]?.benchmark || 1.0);
    
    // Leverage / Solvency (lower is better)
    if (key === 'debt_to_equity' || key === 'debt_to_assets' || key === 'financial_leverage') {
      if (cur <= ind * 0.8) return 'Excellent';
      if (cur <= ind) return 'Good';
      if (cur <= ind * 1.2) return 'Average';
      return 'Weak';
    }
    
    // Liquidity / Profitability / Efficiency (higher is better)
    if (cur >= ind * 1.2) return 'Excellent';
    if (cur >= ind) return 'Good';
    if (cur >= ind * 0.7) return 'Average';
    return 'Weak';
  }

  getTrendAndBenchmarkAnalysis(key) {
    const data = this.ratiosData[key];
    const indAvg = this.getIndustryAverage(key);
    if (!data || data.curVal === null || data.curVal === 'Not Available') {
      return null;
    }
    const cur = this.coerceFloat(data.curVal);
    const prev = this.coerceFloat(data.priVal);
    const ind = indAvg !== null ? this.coerceFloat(indAvg) : null;
    
    if (cur === null) return null;
    
    let trend = 'stable';
    if (prev !== null) {
      if (cur > prev) trend = 'improved';
      else if (cur < prev) trend = 'declined';
    }
    
    let comparison = 'in line with';
    if (ind !== null) {
      if (key === 'debt_to_equity' || key === 'debt_to_assets' || key === 'financial_leverage') {
        // Lower is better
        if (cur < ind) comparison = 'better than (lower leverage)';
        else if (cur > ind) comparison = 'higher than';
      } else {
        // Higher is better
        if (cur > ind) comparison = 'above';
        else if (cur < ind) comparison = 'below';
      }
    }
    
    return { trend, comparison, cur, prev, ind };
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

    // Initialize Sidebar Navigation
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);
    
    // Highlight ratios page
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Financial Ratios');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // Populate Header Info
    const comp = this.data.company || {};
    document.getElementById('target-company-name-title').textContent = `Financial Ratios: ${comp.name || 'Target Company'}`;
    document.getElementById('target-company-ticker-exchange').textContent = `${comp.exchange || 'EXCHANGE'}: ${comp.ticker || 'TICKER'} | Sector: ${comp.sector || 'N/A'}`;
    
    const decisionBadge = document.getElementById('target-company-decision');
    if (decisionBadge) {
      const dec = (comp.overall_decision || 'HOLD').toUpperCase();
      decisionBadge.textContent = dec;
      if (dec.includes('BUY')) {
        decisionBadge.className = 'badge badge-buy';
      } else if (dec.includes('SELL')) {
        decisionBadge.className = 'badge badge-sell';
      } else {
        decisionBadge.className = 'badge badge-hold';
      }
    }

    // Connect dashboard back and exports
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    const exportBtn = document.getElementById('export-dropdown-btn');
    const exportMenu = document.getElementById('export-dropdown-menu');
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      exportMenu.classList.remove('show');
    });

    document.getElementById('export-json').addEventListener('click', (e) => {
      e.preventDefault();
      this.exportJSON();
    });
    document.getElementById('export-csv').addEventListener('click', (e) => {
      e.preventDefault();
      this.exportCSV();
    });
    document.getElementById('export-excel').addEventListener('click', (e) => {
      e.preventDefault();
      this.exportExcel();
    });
    document.getElementById('export-pdf').addEventListener('click', (e) => {
      e.preventDefault();
      window.print();
    });

    // Close drawers binds
    document.getElementById('ratios-drawer-close-btn').addEventListener('click', () => this.closeDrawer());
    document.getElementById('ratios-drawer-overlay').addEventListener('click', () => this.closeDrawer());

    // Collapsible cards toggle handler
    const headers = document.querySelectorAll('.category-header');
    headers.forEach(h => {
      h.addEventListener('click', () => {
        h.parentElement.classList.toggle('collapsed');
      });
    });

    // Compute ratios
    this.calculateRatios();

    // Render cards details
    Object.keys(this.categories).forEach(cat => {
      this.renderCategoryDetails(cat);
      this.renderCategoryTable(cat);
      this.renderCategoryConclusions(cat);
    });
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
      interest_coverage: ['interest_coverage'],
      long_term_debt_ratio: ['long_term_debt_ratio']
    };
    const list = map[key] || [key];
    for (let alt of list) {
      if (yearRatios[alt] !== undefined && yearRatios[alt] !== null && yearRatios[alt] !== 'Not Available' && yearRatios[alt] !== 'N/A') {
        return yearRatios[alt];
      }
    }
    return null;
  }

  deriveRatio(yrMetrics, key, stockPrice, totalShares) {
    // Priority Fallback: check if the SSOT metrics dictionary has this ratio directly!
    if (this.data.metrics?.[key]) {
      const mObj = this.data.metrics[key];
      const fm = this.data.raw_agent_outputs?.financial_metrics;
      const latestYr = fm?.output?.latest_year || fm?.latest_year || '2024';
      const yr = yrMetrics.year || latestYr || '2024';
      if (yr === latestYr) {
        if (mObj.value !== undefined && mObj.value !== null && mObj.value !== 'Not Available') {
          return mObj.value;
        }
      }
      const spark = mObj.sparkline || [];
      if (spark.length > 0) {
        const fm = this.data.raw_agent_outputs?.financial_metrics;
        const detectedYears = [...(fm?.output?.detected_years || fm?.detected_years || [])];
        detectedYears.sort();
        const offset = detectedYears.length - spark.length;
        const yrIdx = detectedYears.indexOf(yr) - offset;
        if (yrIdx >= 0 && yrIdx < spark.length) {
          return spark[yrIdx];
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
    const eps = this.coerceFloat(yrMetrics.eps);
    const cash = this.coerceFloat(yrMetrics.cash) || this.coerceFloat(yrMetrics.cash_equivalents) || 0;
    const inv = this.coerceFloat(yrMetrics.inventory) || 0;
    const ar = this.coerceFloat(yrMetrics.accounts_receivable) || this.coerceFloat(yrMetrics.receivables) || 0;
    const ap = this.coerceFloat(yrMetrics.accounts_payable) || this.coerceFloat(yrMetrics.payables) || 0;
    const interest = this.coerceFloat(yrMetrics.interest_expense) || (liab ? liab * 0.05 : 1);
    const debt = this.coerceFloat(yrMetrics.long_term_debt) || this.coerceFloat(yrMetrics.total_debt) || (liab ? liab * 0.6 : 0);
    const ltd = this.coerceFloat(yrMetrics.long_term_debt);

    switch(key) {
      case 'gross_margin':
        return (gp && rev) ? (gp / rev * 100) : null;
      case 'operating_margin':
        return (op && rev) ? (op / rev * 100) : null;
      case 'net_margin':
        return (np && rev) ? (np / rev * 100) : null;
      case 'ebitda_margin':
        return (ebitda && rev) ? (ebitda / rev * 100) : null;
      case 'roce':
        return (op && assets && cl) ? (op / (assets - cl) * 100) : null;
      case 'debt_ratio':
        return (liab && assets) ? (liab / assets) : null;
      case 'debt_to_assets':
        return (debt && assets) ? (debt / assets) : null;
      case 'pe_ratio':
        return (stockPrice && eps) ? (stockPrice / eps) : null;
      case 'pb_ratio':
        return (stockPrice && eq && totalShares) ? (stockPrice / (eq / totalShares)) : null;
      case 'dividend_yield':
        return this.data.company?.dividend_yield || this.data.company?.dividendYield || 1.8;
      case 'inventory_turnover':
        return (rev && inv) ? (rev / inv) : null;
      case 'cash_ratio':
        return (cash && cl) ? (cash / cl) : null;
      case 'working_capital':
        return (ca && cl) ? (ca - cl) : null;
      case 'working_capital_ratio':
        return (ca && cl && assets) ? ((ca - cl) / assets) : null;
      case 'equity_ratio':
        return (eq && assets) ? (eq / assets) : null;
      case 'financial_leverage':
        return (assets && eq) ? (assets / eq) : null;
      case 'receivable_turnover':
        return (rev && ar) ? (rev / ar) : null;
      case 'payable_turnover':
        return (rev && ap) ? (rev / ap) : null;
      case 'working_capital_turnover':
        return (rev && ca && cl && ca !== cl) ? (rev / (ca - cl)) : null;
      case 'long_term_debt_ratio':
        return (ltd && assets) ? (ltd / assets) : null;
      default:
        return null;
    }
  }

  calculateRatios() {
    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const histMetrics = metricsAgentOut.historical_metrics || {};
    const detectedYears = [...(metricsAgentOut.detected_years || [])];
    detectedYears.sort();

    const ratiosAgentOut = this.data.raw_agent_outputs?.financial_ratios?.output || this.data.raw_agent_outputs?.financial_ratios || {};
    const latestRatios = ratiosAgentOut.latest_ratios || {};
    const histRatios = ratiosAgentOut.historical_ratios || {};

    const stockPrice = this.data.company?.close_price || 150.0;
    const totalShares = this.data.company?.shares_outstanding || 1000000;

    this.ratiosData = {};
    this.detectedYears = detectedYears;

    const keys = Object.keys(this.ratiosMeta);
    keys.forEach(key => {
      const yearlyValues = {};
      detectedYears.forEach(yr => {
        let valRaw = null;
        if (histRatios[yr]) {
          valRaw = this.getAgentRatio(histRatios[yr], key);
        } else if (yr === metricsAgentOut.latest_year) {
          valRaw = this.getAgentRatio(latestRatios, key);
        }

        if (valRaw === null && histMetrics[yr]) {
          valRaw = this.deriveRatio(histMetrics[yr], key, stockPrice, totalShares);
        }

        const val = this.coerceFloat(valRaw);
        if (val !== null) {
          yearlyValues[yr] = val;
        } else if (valRaw !== null && valRaw !== undefined && valRaw !== 'Not Available' && valRaw !== 'N/A') {
          yearlyValues[yr] = valRaw;
        }
      });

      if (Object.keys(yearlyValues).length > 0) {
        const currentYr = metricsAgentOut.latest_year || detectedYears[detectedYears.length - 1];
        const prevYr = detectedYears[detectedYears.indexOf(currentYr) - 1];

        this.ratiosData[key] = {
          curVal: yearlyValues[currentYr] !== undefined ? yearlyValues[currentYr] : null,
          priVal: prevYr && yearlyValues[prevYr] !== undefined ? yearlyValues[prevYr] : null,
          history: yearlyValues
        };
      }
    });
  }

  getRatioSource(key) {
    if (['pe_ratio', 'pb_ratio', 'dividend_yield', 'market_cap', 'enterprise_value'].includes(key)) {
      return '📈 Yahoo Finance';
    }

    const ratiosAgentOut = this.data.raw_agent_outputs?.financial_ratios?.output || this.data.raw_agent_outputs?.financial_ratios || {};
    const latestRatios = ratiosAgentOut.latest_ratios || {};
    if (latestRatios[key] !== undefined && latestRatios[key] !== 'Not Available' && latestRatios[key] !== null) {
      return '🧮 Calculated';
    }

    return '📄 PDF';
  }

  getRatioStatus(key, val) {
    if (val === null || val === undefined) return 'Average';
    
    switch(key) {
      case 'current_ratio':
      case 'quick_ratio':
        if (val >= 2.0) return 'Excellent';
        if (val >= 1.5) return 'Good';
        if (val >= 1.0) return 'Average';
        return 'Weak';
      case 'debt_to_equity':
      case 'debt_ratio':
      case 'debt_to_assets':
        if (val <= 0.4) return 'Excellent';
        if (val <= 0.8) return 'Good';
        if (val <= 1.5) return 'Average';
        return 'Weak';
      case 'roe':
      case 'roce':
        if (val >= 22) return 'Excellent';
        if (val >= 15) return 'Good';
        if (val >= 8) return 'Average';
        return 'Weak';
      case 'roa':
        if (val >= 10) return 'Excellent';
        if (val >= 6) return 'Good';
        if (val >= 3) return 'Average';
        return 'Weak';
      case 'net_margin':
      case 'operating_margin':
      case 'gross_margin':
      case 'ebitda_margin':
        if (val >= 25) return 'Excellent';
        if (val >= 15) return 'Good';
        if (val >= 8) return 'Average';
        return 'Weak';
      case 'interest_coverage':
        if (val >= 6) return 'Excellent';
        if (val >= 3) return 'Good';
        if (val >= 1.5) return 'Average';
        return 'Weak';
      default:
        if (val >= 1.0) return 'Good';
        return 'Average';
    }
  }

  getRatioBadge(status) {
    if (status === 'Excellent' || status === 'Good') return 'badge badge-buy';
    if (status === 'Average') return 'badge badge-hold';
    return 'badge badge-sell';
  }

  renderCategoryDetails(cat) {
    const config = this.categories[cat];

    let sum = 0;
    let count = 0;

    config.keys.forEach(k => {
      const data = this.ratiosData[k];
      if (data && data.curVal !== null && data.curVal !== 'Not Available') {
        const indAvg = this.getIndustryAverage(k);
        const status = this.getRatioStatusVsIndustry(k, data.curVal, indAvg);
        let score = 55;
        if (status === 'Excellent') score = 95;
        else if (status === 'Good') score = 80;
        else if (status === 'Average') score = 65;
        else if (status === 'Weak') score = 40;

        sum += score;
        count++;
      }
    });

    const categoryScore = count >= 2 ? Math.round(sum / count) : null;
    const scoreElement = document.getElementById(`score-${cat}`);
    const statusBadge = document.getElementById(`badge-${cat}`);
    
    if (categoryScore !== null) {
      scoreElement.textContent = `${categoryScore}/100`;
      const quality = categoryScore >= 80 ? 'EXCELLENT' : (categoryScore >= 60 ? 'GOOD' : 'WEAK');
      statusBadge.textContent = quality;
      statusBadge.className = `badge ${categoryScore >= 80 ? 'severity-low' : (categoryScore >= 60 ? 'severity-moderate' : 'severity-high')}`;
    } else {
      scoreElement.textContent = 'Insufficient Data';
      statusBadge.textContent = 'N/A';
      statusBadge.className = 'badge badge-hold';
    }

    // Dynamic 2-3 line AI summary generated from actual calculated ratios & benchmarks
    let summary = '';
    if (count === 0) {
      summary = `No data available in the uploaded report to calculate ${cat} indicators. Please verify the uploaded financial statement fields.`;
    } else {
      const sector = this.data.company?.sector || "Technology";
      if (cat === 'profitability') {
        const roe = this.getTrendAndBenchmarkAnalysis('roe');
        const margin = this.getTrendAndBenchmarkAnalysis('net_margin');
        const gross = this.getTrendAndBenchmarkAnalysis('gross_margin');
        
        if (roe && margin) {
          summary = `The company maintains ${roe.cur >= 15 ? 'outstanding profitability' : 'stable profitability'} in the ${sector} sector. ROE stands at ${roe.cur.toFixed(1)}% (exceeding peer average of ${roe.ind.toFixed(1)}%), while net margin of ${margin.cur.toFixed(1)}% reflects ${margin.comparison} average competitor profitability.`;
        } else {
          summary = `The company's profitability indicators align with standard ${sector} sector return expectations, based on available operating results.`;
        }
      } else if (cat === 'liquidity') {
        const curr = this.getTrendAndBenchmarkAnalysis('current_ratio');
        const quick = this.getTrendAndBenchmarkAnalysis('quick_ratio');
        
        if (curr && quick) {
          summary = `Short-term liquidity coverage is ${curr.cur >= curr.ind ? 'robust' : 'relatively tight'} compared to peers. The Current Ratio of ${curr.cur.toFixed(2)}x is ${curr.comparison} the sector average of ${curr.ind.toFixed(2)}x, while quick ratio stands at ${quick.cur.toFixed(2)}x.`;
        } else if (curr) {
          summary = `Liquidity is characterized by a Current Ratio of ${curr.cur.toFixed(2)}x, placing the company ${curr.comparison} the sector average of ${curr.ind.toFixed(2)}x.`;
        } else {
          summary = "Short-term obligations coverage and operational liquidity buffers remain stable compared to standard sector guidelines.";
        }
      } else if (cat === 'efficiency') {
        const asset = this.getTrendAndBenchmarkAnalysis('asset_turnover');
        
        if (asset) {
          summary = `Asset utilization efficiency is ${asset.cur >= asset.ind ? 'highly optimal' : 'sluggish'} compared to peer averages. The company generates sales at an asset turnover of ${asset.cur.toFixed(2)}x, which is ${asset.comparison} the industry benchmark of ${asset.ind.toFixed(2)}x.`;
        } else {
          summary = "Operational asset velocity matches standard industry processing times, ensuring capital resources are turned over consistently.";
        }
      } else if (cat === 'solvency') {
        const de = this.getTrendAndBenchmarkAnalysis('debt_to_equity');
        
        if (de) {
          summary = `Long-term capitalization analysis shows ${de.cur <= de.ind ? 'conservative gearing' : 'elevated leverage'}. Debt-to-Equity of ${de.cur.toFixed(2)}x is ${de.comparison} the industry average of ${de.ind.toFixed(2)}x, suggesting a ${de.cur <= de.ind ? 'lower' : 'higher'} default profile.`;
        } else {
          summary = "Long-term debt indicators and operational cash buffers represent normal leverage margins relative to total sector capitalization.";
        }
      }
    }

    document.getElementById(`overview-${cat}`).textContent = summary;
  }

  renderCategoryTable(cat) {
    const config = this.categories[cat];
    const tbody = document.querySelector(`#table-${cat} tbody`);
    if (!tbody) return;

    let html = '';
    let count = 0;
    config.keys.forEach(key => {
      const data = this.ratiosData[key];
      if (!data || data.curVal === null || data.curVal === 'Not Available') return;

      count++;
      const cur = data.curVal;
      const meta = this.ratiosMeta[key];
      const source = this.getRatioSource(key);
      const indAvg = this.getIndustryAverage(key);
      const diffStr = this.getRatioDifferenceStr(key, cur, indAvg);
      const status = this.getRatioStatusVsIndustry(key, cur, indAvg);
      const badgeClass = this.getRatioBadge(status);

      let diffClass = 'text-muted';
      if (diffStr.startsWith('+') || diffStr === 'Better' || diffStr === 'Above Avg') {
        diffClass = 'change-positive';
      } else if (diffStr.startsWith('-') || diffStr === 'Higher' || diffStr === 'Below Avg') {
        diffClass = 'change-negative';
      }

      const formatVal = (v) => {
        if (typeof v === 'number') return `${v.toFixed(2)}${meta.unit}`;
        return v || 'N/A';
      };

      const formatInd = (v) => {
        if (typeof v === 'number') return `${v.toFixed(2)}${meta.unit}`;
        return v || 'N/A';
      };

      html += `
        <tr style="cursor: pointer;" class="table-row-clickable" data-key="${key}">
          <td><b>${meta.name}</b></td>
          <td>${formatVal(cur)}</td>
          <td>${formatInd(indAvg)}</td>
          <td class="${diffClass}">${diffStr}</td>
          <td><span class="${badgeClass}" style="font-size: 9px; padding: 2px 6px;">${status.toUpperCase()}</span></td>
          <td><span class="snapshot-src-tag">${source}</span></td>
        </tr>
      `;
    });

    const requiredMetricsMap = {
      profitability: ["Revenue", "Gross Profit", "EBIT", "Net Income", "Total Assets", "Shareholders Equity"],
      liquidity: ["Current Assets", "Current Liabilities"],
      efficiency: ["Revenue", "Total Assets"],
      solvency: ["Total Assets", "Total Liabilities"]
    };

    const fr = this.data.raw_agent_outputs?.financial_ratios;
    const validationReport = fr?.output?.validation_report || fr?.validation_report || {};
    const missingMetrics = validationReport.missing_source_metrics || [];
    const requiredMetrics = requiredMetricsMap[cat] || [];
    const isGenuinelyAbsent = requiredMetrics.some(m => missingMetrics.includes(m));

    const tableEl = document.getElementById(`table-${cat}`);
    if (count > 0) {
      tbody.innerHTML = html;
      tableEl.style.display = 'table';
      const warn = document.getElementById(`warn-${cat}`);
      if (warn) warn.remove();
    } else {
      tableEl.style.display = 'none';
      if (isGenuinelyAbsent) {
        let warn = document.getElementById(`warn-${cat}`);
        if (!warn) {
          warn = document.createElement('div');
          warn.id = `warn-${cat}`;
          warn.className = 'body-text';
          warn.style.padding = 'var(--space-3)';
          warn.style.background = 'rgba(239, 68, 68, 0.05)';
          warn.style.border = '1px solid rgba(239, 68, 68, 0.15)';
          warn.style.borderRadius = 'var(--radius-sm)';
          warn.style.color = '#f87171';
          warn.style.fontSize = '12px';
          tableEl.parentNode.insertBefore(warn, tableEl);
        }
        const label = cat === 'solvency' ? 'solvency' : (cat === 'profitability' ? 'profitability' : (cat === 'liquidity' ? 'liquidity' : 'efficiency'));
        warn.textContent = `Insufficient financial statement data to calculate ${label} ratios.`;
      } else {
        const warn = document.getElementById(`warn-${cat}`);
        if (warn) warn.remove();
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); font-size: 12px;">No ratios calculated for this category.</td></tr>`;
        tableEl.style.display = 'table';
      }
    }

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      row.addEventListener('click', () => {
        this.openDrawer(row.dataset.key);
      });
    });
  }

  renderCategoryConclusions(cat) {
    const config = this.categories[cat];
    const interpretationsContainer = document.getElementById(`interpretations-${cat}`);
    const conclusionContainer = document.getElementById(`conclusion-${cat}`);
    const actionContainer = document.getElementById(`action-${cat}`);

    if (!interpretationsContainer || !conclusionContainer || !actionContainer) return;

    // 1. Populate Investor Interpretation
    let interpretationsHtml = '';
    config.keys.forEach(k => {
      const data = this.ratiosData[k];
      if (data && data.curVal !== null && data.curVal !== 'Not Available') {
        const analysis = this.getTrendAndBenchmarkAnalysis(k);
        const meta = this.ratiosMeta[k];
        let text = meta.investorText;
        if (analysis && analysis.ind !== null) {
          const diff = Math.abs(analysis.cur - analysis.ind);
          if (k === 'gross_margin') {
            text = analysis.cur >= analysis.ind 
              ? `Company exceeds the industry average by ${diff.toFixed(1)}%, indicating stronger pricing power.`
              : `Below industry average, suggesting relatively weaker pricing power.`;
          } else if (k === 'net_margin') {
            text = analysis.cur >= analysis.ind
              ? `Bottom-line conversion exceeds the industry average by ${diff.toFixed(1)}%, showing superior pricing power.`
              : `Below industry average, indicating weaker bottom-line conversion after operating overheads.`;
          } else if (k === 'roe') {
            text = analysis.cur >= analysis.ind
              ? `Exceeds industry average by ${diff.toFixed(1)}%, indicating highly efficient shareholder compounding.`
              : `Below industry average, suggesting less efficient shareholder capital utilization.`;
          } else if (k === 'current_ratio') {
            text = analysis.cur >= analysis.ind
              ? `Above industry average, indicating robust liquidity coverage.`
              : `Below industry average, suggesting relatively weaker short-term liquidity.`;
          } else if (k === 'debt_to_equity') {
            text = analysis.cur <= analysis.ind
              ? `Lower than industry average, indicating conservative leverage.`
              : `Higher than industry average, indicating aggressive financial gearing.`;
          } else if (k === 'asset_turnover') {
            text = analysis.cur >= analysis.ind
              ? `Exceeds peers, reflecting highly efficient revenue generation per asset unit.`
              : `Slightly below peers, suggesting room for operational efficiency improvement.`;
          }
        }
        interpretationsHtml += `
          <div class="interpretation-item">
            <span style="font-weight: 600; color: var(--text-primary); min-width: 150px;">${meta.name}</span>
            <span style="color: var(--text-secondary); text-align: right; line-height: 1.3;">${text}</span>
          </div>
        `;
      }
    });
    interpretationsContainer.innerHTML = interpretationsHtml || `<div style="color:var(--text-muted); font-size:11px;">No interpretation metrics available.</div>`;

    // 2. Fetch or Calculate Score
    let sum = 0;
    let count = 0;
    config.keys.forEach(k => {
      const data = this.ratiosData[k];
      if (data && data.curVal !== null && data.curVal !== 'Not Available') {
        const indAvg = this.getIndustryAverage(k);
        const status = this.getRatioStatusVsIndustry(k, data.curVal, indAvg);
        let score = 55;
        if (status === 'Excellent') score = 95;
        else if (status === 'Good') score = 80;
        else if (status === 'Average') score = 65;
        else if (status === 'Weak') score = 40;
        sum += score;
        count++;
      }
    });

    const categoryScore = count >= 2 ? Math.round(sum / count) : null;
    
    let conclusionText = '';
    let actionText = '';
    let impactText = '';
    let impactClass = '';
    let conclusionBg = '';
    let conclusionBorder = '';
    let conclusionColor = '';

    if (categoryScore === null || count === 0) {
      conclusionText = "Unable to formulate a conclusion due to missing or insufficient financial statement data.";
      actionText = "✔ Upload a complete annual financial report first";
      impactText = "Neutral";
      impactClass = "badge-hold";
      conclusionBg = "rgba(255, 255, 255, 0.02)";
      conclusionBorder = "1px solid var(--border-color)";
      conclusionColor = "var(--text-secondary)";
    } else {
      if (cat === 'profitability') {
        const roe = this.getTrendAndBenchmarkAnalysis('roe') || { cur: 10, ind: 12, trend: 'stable', comparison: 'below' };
        
        conclusionText = `Although profitability returns ${roe.trend} compared with last year, the company's return on equity remains ${roe.comparison} the industry average.`;
        if (categoryScore >= 80) {
          actionText = "✔ Significant competitive advantage";
          impactText = "Bullish";
          impactClass = "badge-buy";
          conclusionBg = "rgba(46, 204, 113, 0.04)";
          conclusionBorder = "1px solid rgba(46, 204, 113, 0.15)";
          conclusionColor = "var(--accent-green)";
        } else if (categoryScore >= 60) {
          actionText = "✔ In line with peers";
          impactText = "Neutral";
          impactClass = "badge-hold";
          conclusionBg = "rgba(241, 196, 15, 0.03)";
          conclusionBorder = "1px solid rgba(241, 196, 15, 0.1)";
          conclusionColor = "var(--accent-orange)";
        } else {
          actionText = "✔ Requires monitoring";
          impactText = "Bearish";
          impactClass = "badge-sell";
          conclusionBg = "rgba(231, 76, 60, 0.04)";
          conclusionBorder = "1px solid rgba(231, 76, 60, 0.15)";
          conclusionColor = "var(--accent-red)";
        }
      } else if (cat === 'liquidity') {
        const current = this.getTrendAndBenchmarkAnalysis('current_ratio') || { cur: 1.2, ind: 1.5, trend: 'stable', comparison: 'below' };
        
        conclusionText = `Although liquidity ${current.trend} compared with last year, it remains ${current.comparison} the industry average.`;
        if (categoryScore >= 80) {
          actionText = "✔ Better than industry";
          impactText = "Bullish";
          impactClass = "badge-buy";
          conclusionBg = "rgba(46, 204, 113, 0.04)";
          conclusionBorder = "1px solid rgba(46, 204, 113, 0.15)";
          conclusionColor = "var(--accent-green)";
        } else if (categoryScore >= 60) {
          actionText = "✔ In line with peers";
          impactText = "Neutral";
          impactClass = "badge-hold";
          conclusionBg = "rgba(241, 196, 15, 0.03)";
          conclusionBorder = "1px solid rgba(241, 196, 15, 0.1)";
          conclusionColor = "var(--accent-orange)";
        } else {
          actionText = "✔ Requires monitoring";
          impactText = "Bearish";
          impactClass = "badge-sell";
          conclusionBg = "rgba(231, 76, 60, 0.04)";
          conclusionBorder = "1px solid rgba(231, 76, 60, 0.15)";
          conclusionColor = "var(--accent-red)";
        }
      } else if (cat === 'efficiency') {
        const asset = this.getTrendAndBenchmarkAnalysis('asset_turnover') || { cur: 0.8, ind: 0.8, trend: 'stable', comparison: 'in line with' };
        
        conclusionText = `Although asset utilization speed ${asset.trend} compared with last year, operational efficiency remains ${asset.comparison} the industry average.`;
        if (categoryScore >= 80) {
          actionText = "✔ Better than industry";
          impactText = "Bullish";
          impactClass = "badge-buy";
          conclusionBg = "rgba(46, 204, 113, 0.04)";
          conclusionBorder = "1px solid rgba(46, 204, 113, 0.15)";
          conclusionColor = "var(--accent-green)";
        } else if (categoryScore >= 60) {
          actionText = "✔ In line with peers";
          impactText = "Neutral";
          impactClass = "badge-hold";
          conclusionBg = "rgba(241, 196, 15, 0.03)";
          conclusionBorder = "1px solid rgba(241, 196, 15, 0.1)";
          conclusionColor = "var(--accent-orange)";
        } else {
          actionText = "✔ Slightly below competitors";
          impactText = "Bearish";
          impactClass = "badge-sell";
          conclusionBg = "rgba(231, 76, 60, 0.04)";
          conclusionBorder = "1px solid rgba(231, 76, 60, 0.15)";
          conclusionColor = "var(--accent-red)";
        }
      } else if (cat === 'solvency') {
        const de = this.getTrendAndBenchmarkAnalysis('debt_to_equity') || { cur: 0.9, ind: 0.8, trend: 'stable', comparison: 'higher than' };
        
        conclusionText = `Although long-term gearing ${de.trend === 'improved' ? 'decreased' : 'increased'} compared with last year, long-term solvency remains ${de.comparison} the industry average.`;
        if (categoryScore >= 80) {
          actionText = "✔ Better than industry";
          impactText = "Bullish";
          impactClass = "badge-buy";
          conclusionBg = "rgba(46, 204, 113, 0.04)";
          conclusionBorder = "1px solid rgba(46, 204, 113, 0.15)";
          conclusionColor = "var(--accent-green)";
        } else if (categoryScore >= 60) {
          actionText = "✔ In line with peers";
          impactText = "Neutral";
          impactClass = "badge-hold";
          conclusionBg = "rgba(241, 196, 15, 0.03)";
          conclusionBorder = "1px solid rgba(241, 196, 15, 0.1)";
          conclusionColor = "var(--accent-orange)";
        } else {
          actionText = "✔ Requires monitoring";
          impactText = "Bearish";
          impactClass = "badge-sell";
          conclusionBg = "rgba(231, 76, 60, 0.04)";
          conclusionBorder = "1px solid rgba(231, 76, 60, 0.15)";
          conclusionColor = "var(--accent-red)";
        }
      }
    }

    conclusionContainer.style.background = conclusionBg;
    conclusionContainer.style.border = conclusionBorder;
    conclusionContainer.style.color = conclusionColor;
    conclusionContainer.textContent = conclusionText;

    actionContainer.innerHTML = `
      <div style="flex: 1; color: var(--text-primary); font-weight: 600;">${actionText}</div>
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <span class="field-label" style="font-size: 9px; margin-top: 1px;">Impact</span>
        <span class="badge ${impactClass}">${impactText}</span>
      </div>
    `;
  }

  getCalculationSupporting(key) {
    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const histMetrics = metricsAgentOut.historical_metrics || {};
    const latestYr = metricsAgentOut.latest_year || '2024';
    const yrMetrics = histMetrics[latestYr] || {};

    const sym = this.data.company?.currency === 'INR' ? '₹' : '$';
    const suf = this.data.company?.currency === 'INR' ? 'Cr' : 'M';

    const f = (val) => {
      const num = this.coerceFloat(val);
      if (num === null) return 'N/A';
      return `${sym} ${num.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suf}`;
    };

    switch(key) {
      case 'roe':
        return `Net Income: ${f(yrMetrics.net_profit)} / Shareholders' Equity: ${f(yrMetrics.equity)}`;
      case 'roa':
        return `Net Income: ${f(yrMetrics.net_profit)} / Total Assets: ${f(yrMetrics.total_assets)}`;
      case 'current_ratio':
        return `Current Assets: ${f(yrMetrics.current_assets)} / Current Liabilities: ${f(yrMetrics.current_liabilities)}`;
      case 'quick_ratio':
        const inv = this.coerceFloat(yrMetrics.inventory) || 0;
        return `(Current Assets: ${f(yrMetrics.current_assets)} - Inventory: ${f(inv)}) / Current Liabilities: ${f(yrMetrics.current_liabilities)}`;
      case 'debt_to_equity':
        return `Total Liabilities: ${f(yrMetrics.total_liabilities)} / Shareholders' Equity: ${f(yrMetrics.equity)}`;
      case 'net_margin':
        return `Net Profit: ${f(yrMetrics.net_profit)} / Revenue: ${f(yrMetrics.revenue)}`;
      case 'operating_margin':
        return `Operating Profit: ${f(yrMetrics.operating_profit)} / Revenue: ${f(yrMetrics.revenue)}`;
      case 'gross_margin':
        return `Gross Profit: ${f(yrMetrics.gross_profit)} / Revenue: ${f(yrMetrics.revenue)}`;
      case 'ebitda_margin':
        return `EBITDA: ${f(yrMetrics.ebitda)} / Revenue: ${f(yrMetrics.revenue)}`;
      default:
        return 'Calculated using annual financial statement disclosures.';
    }
  }

  openDrawer(key) {
    const meta = this.ratiosMeta[key];
    const data = this.ratiosData[key];
    if (!data) return;

    const cur = data.curVal;
    const prev = data.priVal;
    const indAvg = this.getIndustryAverage(key);
    const status = this.getRatioStatusVsIndustry(key, cur, indAvg);
    const source = this.getRatioSource(key);

    document.getElementById('drawer-ratio-name').textContent = meta.name;
    document.getElementById('drawer-ratio-category').textContent = `${meta.category.toUpperCase()} (Source: ${source})`;
    document.getElementById('drawer-ratio-definition').textContent = meta.definition;
    document.getElementById('drawer-ratio-formula').textContent = meta.formula;

    const formatVal = (v) => {
      if (typeof v === 'number') return `${v.toFixed(2)}${meta.unit}`;
      return v || 'N/A';
    };

    document.getElementById('drawer-ratio-current').textContent = formatVal(cur);
    document.getElementById('drawer-ratio-prev').textContent = formatVal(prev);
    document.getElementById('drawer-ratio-benchmark').textContent = formatVal(indAvg);

    const statusBadge = document.getElementById('drawer-ratio-status');
    statusBadge.textContent = status.toUpperCase();
    statusBadge.className = this.getRatioBadge(status);

    document.getElementById('drawer-ratio-meaning').textContent = meta.meaning;
    document.getElementById('drawer-ratio-interpretation').textContent = `${meta.investorText} Calculation Details: ${this.getCalculationSupporting(key)}`;

    document.getElementById('ratios-drawer-overlay').classList.add('open');
    document.getElementById('ratios-drawer-panel').classList.add('open');
  }

  closeDrawer() {
    document.getElementById('ratios-drawer-overlay').classList.remove('open');
    document.getElementById('ratios-drawer-panel').classList.remove('open');
  }

  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.ratiosData, null, 2)], { type: 'application/json' });
    const ticker = this.data.company?.ticker || 'company';
    this.downloadBlob(blob, `${ticker}_financial_ratios.json`);
  }

  exportCSV() {
    let csv = 'Financial Ratio,Current Value,Previous Value,Benchmark,Quality Status,Source\n';
    Object.keys(this.ratiosMeta).forEach(key => {
      const meta = this.ratiosMeta[key];
      const data = this.ratiosData[key];
      if (!data) return;

      const formatVal = (v) => {
        if (typeof v === 'number') return `${v.toFixed(2)}${meta.unit}`;
        return v || 'N/A';
      };

      const source = this.getRatioSource(key);
      csv += `"${meta.name}","${formatVal(data.curVal)}","${formatVal(data.priVal)}","${meta.benchmark}","${this.getRatioStatus(key, data.curVal)}","${source}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const ticker = this.data.company?.ticker || 'company';
    this.downloadBlob(blob, `${ticker}_financial_ratios.csv`);
  }

  exportExcel() {
    let csv = 'Financial Ratio,Current Value,Previous Value,Benchmark,Quality Status,Source\n';
    Object.keys(this.ratiosMeta).forEach(key => {
      const meta = this.ratiosMeta[key];
      const data = this.ratiosData[key];
      if (!data) return;

      const formatVal = (v) => {
        if (typeof v === 'number') return `${v.toFixed(2)}${meta.unit}`;
        return v || 'N/A';
      };

      const source = this.getRatioSource(key);
      csv += `"${meta.name}","${formatVal(data.curVal)}","${formatVal(data.priVal)}","${meta.benchmark}","${this.getRatioStatus(key, data.curVal)}","${source}"\n`;
    });

    const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const ticker = this.data.company?.ticker || 'company';
    this.downloadBlob(blob, `${ticker}_financial_ratios.xls`);
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
        gross_margin: null,
        operating_margin: null,
        net_margin: null,
        ebitda_margin: null,
        roa: null,
        roe: null,
        roce: null,

        current_ratio: null,
        quick_ratio: null,
        cash_ratio: null,
        working_capital: null,

        asset_turnover: null,
        inventory_turnover: null,
        receivable_turnover: null,
        payable_turnover: null,
        working_capital_turnover: null,

        debt_to_equity: null,
        debt_to_assets: null,
        equity_ratio: null,
        interest_coverage: null,
        financial_leverage: null
      };
    });

    const metricsKeys = {
      gross_margin: 'gross_margin',
      operating_margin: 'operating_margin',
      net_margin: 'net_margin',
      ebitda_margin: 'ebitda_margin',
      roa: 'roa',
      roe: 'roe',
      roce: 'roce',

      current_ratio: 'current_ratio',
      quick_ratio: 'quick_ratio',
      cash_ratio: 'cash_ratio',
      working_capital: 'working_capital',

      asset_turnover: 'asset_turnover',
      inventory_turnover: 'inventory_turnover',
      receivable_turnover: 'receivable_turnover',
      payable_turnover: 'payable_turnover',
      working_capital_turnover: 'working_capital_turnover',

      debt_to_equity: 'debt_to_equity',
      debt_to_assets: 'debt_to_assets',
      equity_ratio: 'equity_ratio',
      interest_coverage: 'interest_coverage',
      financial_leverage: 'financial_leverage'
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

  reconstructFinancialMetrics() {
    const trend = this.data.performance_trend || {};
    const years = [...(trend.years || ['2024', '2023', '2022'])];
    years.sort((a, b) => b - a); // descending
    const latestYr = years[0] || '2024';

    const histMetrics = {};
    years.forEach(yr => {
      histMetrics[yr] = {};
    });

    const metricsKeys = [
      'revenue', 'revenue_from_operations', 'net_sales', 'cost_of_goods_sold', 'cost_of_revenue', 'gross_profit',
      'operating_expenses', 'selling_expenses', 'administrative_expenses', 'research_and_development', 'depreciation',
      'amortization', 'ebit', 'ebitda', 'finance_cost', 'interest_expense', 'other_income', 'pre_tax_income',
      'income_tax', 'net_income', 'net_profit', 'eps', 'diluted_eps', 'shares_outstanding',
      'cash_and_cash_equivalents', 'short_term_investments', 'accounts_receivable', 'inventory', 'current_assets',
      'property_plant_equipment', 'goodwill', 'intangible_assets', 'long_term_investments', 'total_assets',
      'accounts_payable', 'short_term_debt', 'current_liabilities', 'long_term_debt', 'lease_liabilities',
      'total_debt', 'total_liabilities', 'share_capital', 'retained_earnings', 'total_equity', 'shareholders_equity',
      'book_value', 'operating_cash_flow', 'capital_expenditure', 'free_cash_flow', 'investing_cash_flow',
      'financing_cash_flow', 'dividend_paid', 'stock_buyback', 'net_change_in_cash',
      'operating_profit', 'equity', 'cash', 'capex'
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
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new RatiosDetailsPage();
  page.init();
});
