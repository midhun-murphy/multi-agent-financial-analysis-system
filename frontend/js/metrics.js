/**
 * metrics.js
 * ==========
 * Detailed Financial Metrics Explorer bootstrap controller.
 * Renders company header, KPI snap cards, statement exploration table,
 * multi-year trend canvas using Apache ECharts, data quality panel,
 * slide-out detail drawer panel, and triggers Excel/PDF/CSV/JSON exports.
 */

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

class DetailedMetricsPage {
  constructor() {
    this.data = null;
    this.sidebar = null;
    this.header = null;
    
    // UI state
    this.selectedMetricKey = 'revenue';
    this.selectedHorizon = '3'; // 3, 5, or 10 years
    this.statementFilter = 'all'; // all, income, balance, cashflow
    this.searchQuery = '';
    this.sortField = 'metric';
    this.sortOrder = 'asc'; // asc, desc
    
    // ECharts instance
    this.chart = null;

    // Mapping dictionary for metadata
    this.metricMeta = {
      revenue: {
        name: "Revenue",
        statement: "Income Statement",
        def: "Total revenue generated from core business operations before any deductions, returns, or expenses are subtracted.",
        meaning: "Represents top-line growth. Consistent revenue increases indicate strong market demand and business expansion.",
        rawKey: "revenue"
      },
      gross_profit: {
        name: "Gross Profit",
        statement: "Income Statement",
        def: "Net sales revenue minus the cost of sales (COGS) or cost of services.",
        meaning: "Reflects the company's core pricing power and production efficiency before operating costs.",
        rawKey: "gross_profit"
      },
      operating_profit: {
        name: "Operating Income",
        statement: "Income Statement",
        def: "Gross profit minus all operating expenses (SG&A, R&D, administrative costs). Also known as EBIT.",
        meaning: "Measures core operational profitability. Highlights how well management controls operational costs.",
        rawKey: "operating_profit"
      },
      ebitda: {
        name: "EBITDA",
        statement: "Income Statement",
        def: "Earnings Before Interest, Taxes, Depreciation, and Amortization.",
        meaning: "Used to analyze operational profitability independent of capital structure, tax rates, or asset depreciation.",
        rawKey: "ebitda"
      },
      net_profit: {
        name: "Net Profit",
        statement: "Income Statement",
        def: "Final profit remaining after subtracting all operating expenses, cost of goods, taxes, interest, and overheads.",
        meaning: "The ultimate bottom line. Shows the overall earnings power available for distribution to stockholders.",
        rawKey: "net_profit"
      },
      eps: {
        name: "EPS (Diluted)",
        statement: "Income Statement",
        def: "Net income allocated to each outstanding share of common stock, adjusting for potential dilutive convertibles.",
        meaning: "Direct driver of share price valuation metrics (P/E ratio) and stockholder earnings yields.",
        rawKey: "eps"
      },
      total_assets: {
        name: "Total Assets",
        statement: "Balance Sheet",
        def: "Sum of all current and non-current resources owned or controlled by the company that hold economic value.",
        meaning: "Reflects the scale and asset base of the firm. Asset expansion should ideally drive subsequent revenue growth.",
        rawKey: "total_assets"
      },
      current_assets: {
        name: "Current Assets",
        statement: "Balance Sheet",
        def: "Assets expected to be converted to cash, sold, or consumed within one fiscal year (e.g. inventory, receivables).",
        meaning: "Critical for financing day-to-day operations and validating short-term liquidity health.",
        rawKey: "current_assets"
      },
      cash: {
        name: "Cash & Equivalents",
        statement: "Balance Sheet",
        def: "Physical currency, deposit accounts, and highly liquid short-term instruments maturing under 90 days.",
        meaning: "The ultimate financial buffer. Higher cash reserves grant flexibility for buybacks, dividends, or acquisitions.",
        rawKey: "cash"
      },
      current_liabilities: {
        name: "Current Liabilities",
        statement: "Balance Sheet",
        def: "Debt obligations, supplier payables, and other liabilities due to be settled within one year.",
        meaning: "Must be compared against current assets to evaluate if the company can meet short-term commitments.",
        rawKey: "current_liabilities"
      },
      total_liabilities: {
        name: "Total Liabilities",
        statement: "Balance Sheet",
        def: "Sum of all short-term and long-term financial obligations owed to external creditors.",
        meaning: "Reflects the company's leverage. High liabilities relative to equity increase debt service burdens.",
        rawKey: "total_liabilities"
      },
      equity: {
        name: "Shareholders' Equity",
        statement: "Balance Sheet",
        def: "Total assets minus total liabilities. Represents stockholders' capital and accumulated retained earnings.",
        meaning: "The net worth of the company. Higher equity reduces leverage risk and shows long-term book value accumulation.",
        rawKey: "equity"
      },
      long_term_debt: {
        name: "Long-Term Debt",
        statement: "Balance Sheet",
        def: "Debt obligations with maturities extending beyond the current operating cycle or one year.",
        meaning: "Key indicator of long-term leverage. Elevated debt requires steady operating profit for interest coverage.",
        rawKey: "long_term_debt"
      },
      total_debt: {
        name: "Total Debt",
        statement: "Balance Sheet",
        def: "Total debt obligations including both short-term and long-term borrowings.",
        meaning: "Reflects total interest-bearing debt. Steady debt reduction indicates stronger financial stability.",
        rawKey: "total_debt"
      },
      operating_cash_flow: {
        name: "Operating Cash Flow",
        statement: "Cash Flow",
        def: "Net cash generated directly from the company's day-to-day business operations.",
        meaning: "Shows the true cash-generative power of operations. Should remain positive and track net profits.",
        rawKey: "operating_cash_flow"
      },
      investing_cash_flow: {
        name: "Investing Cash Flow",
        statement: "Cash Flow",
        def: "Net cash spent on capital expenditures, acquisitions, or received from asset divestments.",
        meaning: "Typically negative, representing investment in future growth capacity (e.g. buying equipment).",
        rawKey: "investing_cash_flow"
      },
      financing_cash_flow: {
        name: "Financing Cash Flow",
        statement: "Cash Flow",
        def: "Net cash flows arising from issuing debt/shares, repaying borrowing, share buybacks, and dividends.",
        meaning: "Shows capital allocation behavior. Share repurchases and dividends represent returns of capital.",
        rawKey: "financing_cash_flow"
      },
      free_cash_flow: {
        name: "Free Cash Flow",
        statement: "Cash Flow",
        def: "Net operating cash flow minus capital expenditures (CapEx).",
        meaning: "The cash surplus remaining for debt repayment, buybacks, acquisitions, or dividends. Ultimate health metric.",
        rawKey: "free_cash_flow"
      },
      capex: {
        name: "Capital Expenditures (CapEx)",
        statement: "Cash Flow",
        def: "Cash outflow utilized to purchase, upgrade, or maintain property, plant, equipment, or software.",
        meaning: "Indicates capital reinvestment rate. High CapEx is cash-intensive but supports future capacity.",
        rawKey: "capex"
      }
    };
  }

  init() {
    // 1. Load session data
    const cached = sessionStorage.getItem('analysis_result');
    if (!cached) {
      alert('No active analysis session found. Returning to dashboard upload.');
      window.location.href = 'index.html';
      return;
    }

    try {
      this.data = JSON.parse(cached);
      console.log('Restored detailed metrics payload:', this.data);
    } catch (e) {
      console.error('Failed to parse cached session data:', e);
      window.location.href = 'index.html';
      return;
    }

    // Ensure raw_agent_outputs is populated (construct client-side if missing)
    const fmCheck = this.data.raw_agent_outputs?.financial_metrics;
    const hasFMCheck = fmCheck && (fmCheck.historical_metrics || fmCheck.output?.historical_metrics);
    if (!this.data.raw_agent_outputs || !hasFMCheck) {
      this.data.raw_agent_outputs = this.reconstructRawAgentOutputs();
    }

    // Temporary debug logs (Requirement 8)
    const metricsDict = this.data.metrics || {};
    console.log("Financial Metrics Agent Output:", metricsDict);
    console.log("Metrics passed to Excel:", metricsDict);
    console.log("Metrics passed to PDF:", metricsDict);

    // 2. Initialize Sidebar and Header
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);

    this.header = new Header('header-container');
    this.header.render(this.data.company);

    // Highlight sidebar active tab
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Financial Metrics');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // Rebuild trend select dropdown options dynamically to display the correct 10 metrics
    const metricSelect = document.getElementById('trend-metric-select');
    if (metricSelect) {
      const keys = [
        'revenue', 'gross_profit', 'operating_profit', 'ebitda', 'net_profit',
        'total_assets', 'equity', 'total_debt', 'current_assets', 'current_liabilities'
      ];
      metricSelect.innerHTML = keys.map(k => `<option value="${k}">${this.metricMeta[k]?.name || k}</option>`).join('');
    }

    // 3. Render Data Quality Panel
    this.renderDataQuality();

    // 4. Render Snapshot KPI Cards
    this.renderSnapshotCards();

    // 5. Render Exploration Table
    this.renderExplorationTable();

    // 6. Draw Multi-Year Trend Chart
    this.renderTrendChart();

    // 7. Initialize Listeners
    this.initEventListeners();
  }

  // Reconstruct raw_agent_outputs client-side from this.data.metrics and performance_trend as a fallback for mock data
  reconstructRawAgentOutputs() {
    const trend = this.data.performance_trend || {};
    const reportYearStr = this.data.company?.report_year || 'FY 2024';
    const matchYear = reportYearStr.match(/\d{4}/);
    let extractedYear = matchYear ? matchYear[0] : '2024';
    if (reportYearStr.includes('-')) {
      const parts = reportYearStr.split('-');
      const lastPart = parts[parts.length - 1].replace(/\D/g, '');
      if (lastPart.length === 2) {
        extractedYear = '20' + lastPart;
      } else if (lastPart.length === 4) {
        extractedYear = lastPart;
      }
    }
    
    let years = [...(trend.years || [])];
    if (years.length === 0) {
      years = [extractedYear, String(parseInt(extractedYear) - 1), String(parseInt(extractedYear) - 2)];
    }
    years.sort((a, b) => b - a); // descending
    const latestYr = years[0] || extractedYear;

    const histMetrics = {};
    years.forEach(yr => {
      histMetrics[yr] = {};
    });

    const trendYears = trend.years || [];
    years.forEach(yr => {
      const idx = trendYears.indexOf(yr);
      if (idx !== -1) {
        if (trend.revenue && trend.revenue[idx] !== undefined) {
          histMetrics[yr].revenue = trend.revenue[idx];
        }
        if (trend.net_profit && trend.net_profit[idx] !== undefined) {
          histMetrics[yr].net_profit = trend.net_profit[idx];
        }
        if (trend.operating_cash_flow && trend.operating_cash_flow[idx] !== undefined) {
          histMetrics[yr].operating_cash_flow = trend.operating_cash_flow[idx];
        }
      }
    });

    const yearsAsc = [...years].reverse(); // ascending order for sparklines
    const metricsMap = {
      revenue: 'revenue',
      net_profit: 'net_profit',
      ebitda: 'ebitda',
      free_cash_flow: 'free_cash_flow',
      operating_cash_flow: 'operating_cash_flow',
      ebitda_margin: 'ebitda_margin_pct',
      roe: 'roe_pct',
      debt_to_equity: 'debt_to_equity'
    };

    Object.keys(metricsMap).forEach(mKey => {
      const rawKey = metricsMap[mKey];
      const metricObj = this.data.metrics?.[mKey];
      if (metricObj) {
        if (metricObj.value !== undefined && metricObj.value !== null) {
          histMetrics[latestYr][rawKey] = metricObj.value;
        }
        const spark = metricObj.sparkline || [];
        if (spark.length > 0) {
          const offset = yearsAsc.length - spark.length;
          spark.forEach((val, sIdx) => {
            const yrIdx = sIdx + offset;
            if (yrIdx >= 0 && yrIdx < yearsAsc.length) {
              const yr = yearsAsc[yrIdx];
              if (histMetrics[yr]) {
                histMetrics[yr][rawKey] = val;
              }
            }
          });
        }
      }
    });

    return {
      financial_metrics: {
        output: {
          latest_year: latestYr,
          detected_years: years,
          latest_metrics: histMetrics[latestYr] || {},
          historical_metrics: histMetrics
        }
      }
    };
  }

  // Helper to fetch a metric value from year data with alias mapping
  getMetricValue(yrData, key) {
    if (!yrData) return null;
    if (yrData[key] !== undefined && yrData[key] !== null) {
      const v = yrData[key];
      if (v !== 'Not Available' && v !== 'N/A') return v;
    }
    
    // Normalization map for key aliases
    const aliases = {
      revenue: ['revenue', 'Revenue', 'Revenue From Operations', 'revenue_from_operations', 'Net Sales', 'net_sales', 'Sales', 'sales'],
      gross_profit: ['gross_profit', 'Gross Profit', 'gross_margins', 'Gross Profit / (Loss)'],
      operating_profit: ['operating_profit', 'operating_income', 'Operating Income', 'EBIT', 'ebit'],
      ebitda: ['ebitda', 'EBITDA', 'ebitda_value'],
      net_profit: ['net_profit', 'Net Profit', 'net_income', 'Net Income', 'profit_after_tax', 'Profit After Tax', 'pat', 'PAT'],
      eps: ['eps', 'EPS', 'diluted_eps', 'Diluted EPS'],
      total_assets: ['total_assets', 'Total Assets', 'assets', 'Assets'],
      current_assets: ['current_assets', 'Current Assets'],
      cash: ['cash', 'Cash', 'cash_equivalents', 'Cash & Equivalents', 'Cash and Cash Equivalents'],
      current_liabilities: ['current_liabilities', 'Current Liabilities'],
      total_liabilities: ['total_liabilities', 'Total Liabilities', 'liabilities', 'Liabilities'],
      equity: ['equity', 'Shareholders Equity', 'Shareholders\' Equity', 'shareholders_equity', 'net_worth', 'Net Worth'],
      long_term_debt: ['long_term_debt', 'Long-Term Debt', 'long_term_borrowings', 'Long Term Borrowings'],
      total_debt: ['total_debt', 'Total Debt', 'borrowings', 'Borrowings', 'debt', 'Debt', 'total_debt_value'],
      operating_cash_flow: ['operating_cash_flow', 'Operating Cash Flow', 'cash_flow_from_operations', 'Cash Flow from Operations', 'ocf', 'OCF'],
      investing_cash_flow: ['investing_cash_flow', 'Investing Cash Flow', 'cash_flow_from_investing', 'Cash Flow from Investing', 'icf', 'ICF'],
      financing_cash_flow: ['financing_cash_flow', 'Financing Cash Flow', 'cash_flow_from_financing', 'Cash Flow from Financing', 'fcf_financing', 'FCF_financing'],
      free_cash_flow: ['free_cash_flow', 'Free Cash Flow', 'fcf', 'FCF'],
      capex: ['capex', 'CapEx', 'capital_expenditures', 'Capital Expenditures']
    };

    const list = aliases[key] || [key];
    for (let alt of list) {
      if (yrData[alt] !== undefined && yrData[alt] !== null) {
        const val = yrData[alt];
        if (val !== 'Not Available' && val !== 'N/A') return val;
      }
    }
    return null;
  }

  // Coerces mixed metrics values (formatted strings/numbers) into numbers
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

  // Validate if a metric value is meaningful
  isValValid(v) {
    return v !== null && v !== undefined && v !== 'Not Available' && v !== 'N/A' && v !== '—' && v !== '';
  }

  // Helper to retrieve only the 10 core metrics that contain valid historical or current data
  getDisplayedMetrics() {
    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const histMetrics = metricsAgentOut.historical_metrics || {};
    const detectedYears = metricsAgentOut.detected_years || [];
    const currentYr = metricsAgentOut.latest_year || (detectedYears[0] || '2024');
    const prevYr = detectedYears[1];

    const targetKeys = [
      'revenue', 'gross_profit', 'operating_profit', 'ebitda', 'net_profit',
      'total_assets', 'equity', 'total_debt', 'current_assets', 'current_liabilities'
    ];

    const displayed = [];
    targetKeys.forEach(key => {
      const curValRaw = this.getMetricValue(histMetrics[currentYr], key);
      const priValRaw = prevYr ? this.getMetricValue(histMetrics[prevYr], key) : null;
      
      const curVal = this.coerceFloat(curValRaw);
      const priVal = this.coerceFloat(priValRaw);

      const hasCur = this.isValValid(curValRaw) || this.isValValid(curVal);
      const hasPri = this.isValValid(priValRaw) || this.isValValid(priVal);

      if (hasCur || hasPri) {
        displayed.push({
          key,
          curVal: curVal !== null ? curVal : curValRaw,
          priVal: priVal !== null ? priVal : priValRaw,
          hasCur,
          hasPri
        });
      }
    });
    return displayed;
  }

  // Determine source of value dynamically
  getSource(metricKey, year) {
    const fmGetSrc = this.data.raw_agent_outputs?.financial_metrics;
    const tracker = fmGetSrc?.output?.sources || fmGetSrc?.sources || {};
    const yrTracker = tracker[year] || {};
    const src = yrTracker[metricKey];
    if (src) return src;

    // Fallbacks
    const derived = ['net_margin', 'net_margin_pct', 'operating_margin', 'operating_margin_pct', 
                     'ebitda_margin', 'ebitda_margin_pct', 'roe', 'roe_pct', 'roa', 'roa_pct', 
                     'debt_to_equity', 'current_ratio', 'quick_ratio', 'asset_turnover', 'interest_coverage', 'free_cash_flow'];
    if (derived.includes(metricKey)) return 'Calculated';

    return 'PDF (Report)';
  }

  // Renders Row 2 Data Quality Panel based dynamically on active displayed metrics
  renderDataQuality() {
    const displayed = this.getDisplayedMetrics();
    const confidence = this.data.confidence_scores?.financial_metrics || 95;
    
    document.getElementById('quality-conf-val').textContent = `${confidence}%`;
    const statusBadge = document.getElementById('quality-conf-status');
    statusBadge.textContent = confidence >= 90 ? 'Verified' : (confidence >= 80 ? 'Accurate' : 'Low Confidence');
    statusBadge.className = confidence >= 90 ? 'badge badge-buy' : (confidence >= 80 ? 'badge badge-hold' : 'badge badge-sell');

    // Count states
    let validatedCount = 0;
    let missingCount = 0;
    let calculatedCount = 0;

    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const detectedYears = metricsAgentOut.detected_years || [];
    const latestYr = metricsAgentOut.latest_year || (detectedYears[0] || '2024');

    displayed.forEach(item => {
      const key = item.key;
      const curVal = item.curVal;
      if (curVal === undefined || curVal === null || curVal === 'Not Available' || curVal === 'N/A') {
        missingCount++;
      } else {
        const src = this.getSource(key, latestYr);
        if (src === 'Calculated' || src === 'Derived') {
          calculatedCount++;
        } else {
          validatedCount++;
        }
      }
    });

    document.getElementById('quality-val-fields').textContent = validatedCount;
    document.getElementById('quality-missing-fields').textContent = missingCount;
    document.getElementById('quality-calc-fields').textContent = calculatedCount;
  }

  // Renders clickable snap KPI cards (Requirement 2)
  renderSnapshotCards() {
    const container = document.getElementById('snapshot-grid-container');
    if (!container) return;

    const displayed = this.getDisplayedMetrics();
    const suffix = this.data.company?.currency === 'INR' ? 'Cr' : 'M';
    const sym = this.data.company?.currency === 'INR' ? '₹' : '$';

    let html = '';
    displayed.forEach((item, idx) => {
      const key = item.key;
      const meta = this.metricMeta[key];
      const curVal = this.coerceFloat(item.curVal);
      const priVal = this.coerceFloat(item.priVal);

      // Compute YoY %
      let yoyPct = null;
      let yoyLabel = 'N/A';
      let isPos = true;
      if (curVal !== null && priVal !== null && priVal !== 0) {
        yoyPct = ((curVal - priVal) / Math.abs(priVal)) * 100;
        const sign = yoyPct >= 0 ? '+' : '';
        yoyLabel = `${sign}${yoyPct.toFixed(2)}%`;
        isPos = yoyPct >= 0;
      }

      const trendArrow = yoyPct !== null ? (yoyPct >= 0 ? '↑' : '↓') : '';
      const changeClass = yoyPct !== null ? (yoyPct >= 0 ? 'change-positive' : 'change-negative') : 'text-muted';

      // Format values
      const formatVal = (v, raw) => {
        if (v === null) {
          if (raw !== undefined && raw !== null && raw !== 'Not Available' && raw !== 'N/A') return raw;
          return 'N/A';
        }
        return `${sym} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${suffix}`;
      };

      const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
      const detectedYears = metricsAgentOut.detected_years || [];
      const currentYr = metricsAgentOut.latest_year || (detectedYears[0] || '2024');
      const source = this.getSource(key, currentYr);

      html += `
        <div class="card snapshot-card animate-fade-in stagger-${idx + 1}" data-metric="${key}">
          <div class="field-label" style="font-size: 10px;">${meta.name}</div>
          <div style="font-size: 16px; font-weight: var(--font-weight-bold); margin-top: 4px;">
            ${formatVal(curVal, item.curVal)}
          </div>
          <div class="snapshot-meta">
            <span class="${changeClass}" style="font-size: 11px;">
              ${trendArrow} ${yoyLabel}
            </span>
            <span class="snapshot-src-tag">${source}</span>
          </div>
          <div style="font-size: 9.5px; color: var(--text-muted); margin-top: 6px;">
            Prev: ${formatVal(priVal, item.priVal)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Renders the Detailed Exploration Table (Requirement 3)
  renderExplorationTable() {
    const tbody = document.querySelector('#explore-metrics-table tbody');
    if (!tbody) return;

    const displayed = this.getDisplayedMetrics();
    const suffix = this.data.company?.currency === 'INR' ? 'Cr' : 'M';
    const sym = this.data.company?.currency === 'INR' ? '₹' : '$';

    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const detectedYears = metricsAgentOut.detected_years || [];
    const currentYr = metricsAgentOut.latest_year || (detectedYears[0] || '2024');

    // 1. Build List of Metrics Rows
    const rows = [];
    displayed.forEach(item => {
      const key = item.key;
      const meta = this.metricMeta[key];
      const curVal = this.coerceFloat(item.curVal);
      const priVal = this.coerceFloat(item.priVal);

      let diff = 'N/A';
      let growthPct = 'N/A';
      let growthNum = -999999;
      let diffNum = 0;
      let isPos = true;

      if (curVal !== null && priVal !== null) {
        const d = curVal - priVal;
        diffNum = d;
        const sign = d >= 0 ? '+' : '';
        diff = `${sign}${d.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suffix}`;
        
        if (priVal !== 0) {
          const g = (d / Math.abs(priVal)) * 100;
          growthNum = g;
          growthPct = `${g >= 0 ? '+' : ''}${g.toFixed(2)}%`;
          isPos = g >= 0;
        }
      }

      const trend = curVal !== null && priVal !== null ? (curVal >= priVal ? '↑' : '↓') : '—';
      const source = this.getSource(key, currentYr);

      rows.push({
        key,
        name: meta.name,
        statement: meta.statement,
        curVal: curVal !== null ? curVal : item.curVal,
        priVal: priVal !== null ? priVal : item.priVal,
        diff,
        diffNum,
        growthPct,
        growthNum,
        trend,
        source
      });
    });

    // 2. Filter rows
    let filteredRows = rows.filter(row => {
      // Search match
      const nameMatch = row.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      // Statement type match
      let statementMatch = true;
      if (this.statementFilter === 'income') statementMatch = row.statement === 'Income Statement';
      else if (this.statementFilter === 'balance') statementMatch = row.statement === 'Balance Sheet';
      else if (this.statementFilter === 'cashflow') statementMatch = row.statement === 'Cash Flow';

      return nameMatch && statementMatch;
    });

    // 3. Sort rows
    filteredRows.sort((a, b) => {
      let aVal, bVal;
      if (this.sortField === 'metric') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (this.sortField === 'current') {
        aVal = typeof a.curVal === 'number' ? a.curVal : -99999999;
        bVal = typeof b.curVal === 'number' ? b.curVal : -99999999;
      } else if (this.sortField === 'previous') {
        aVal = typeof a.priVal === 'number' ? a.priVal : -99999999;
        bVal = typeof b.priVal === 'number' ? b.priVal : -99999999;
      } else if (this.sortField === 'diff') {
        aVal = a.diffNum;
        bVal = b.diffNum;
      } else if (this.sortField === 'growth') {
        aVal = a.growthNum;
        bVal = b.growthNum;
      } else if (this.sortField === 'source') {
        aVal = a.source.toLowerCase();
        bVal = b.source.toLowerCase();
      } else {
        aVal = a.statement.toLowerCase();
        bVal = b.statement.toLowerCase();
      }

      if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 4. Render Rows HTML
    const format = (val, isPercentage = false) => {
      if (val === undefined || val === null || val === 'Not Available' || val === 'N/A') return 'Not Available';
      if (typeof val === 'number') {
        if (isPercentage) return `${val.toFixed(2)}%`;
        return `${sym} ${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suffix}`;
      }
      return val;
    };

    let html = '';
    if (filteredRows.length === 0) {
      html = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: var(--space-5);">No matching metrics found.</td></tr>`;
    } else {
      filteredRows.forEach(row => {
        const diffClass = row.diffNum >= 0 ? 'diff-positive' : 'diff-negative';
        const growthClass = row.growthNum >= 0 ? 'diff-positive' : 'diff-negative';
        const trendClass = row.trend === '↑' ? 'diff-positive' : (row.trend === '↓' ? 'diff-negative' : 'text-muted');

        // Check if value is margin or percentage ratio
        const isRatio = row.key.endsWith('_pct') || row.key === 'eps';

        html += `
          <tr data-metric="${row.key}">
            <td style="font-weight: var(--font-weight-medium); color: var(--text-primary);">${row.name}</td>
            <td>${format(row.curVal, isRatio)}</td>
            <td>${format(row.priVal, isRatio)}</td>
            <td class="${diffClass}">${isRatio ? '—' : row.diff}</td>
            <td class="${growthClass}">${row.growthPct}</td>
            <td class="${trendClass}">${row.trend}</td>
            <td><span class="snapshot-src-tag">${row.source}</span></td>
            <td style="color: var(--text-muted); font-size: 11px;">${row.statement}</td>
          </tr>
        `;
      });
    }

    tbody.innerHTML = html;
  }

  // Renders Multi-Year Trend Chart using ECharts (Requirement 5)
  renderTrendChart() {
    const canvas = document.getElementById('metrics-trend-canvas');
    if (!canvas) return;

    // Destroy existing instance
    if (this.chart) {
      this.chart.dispose();
    }

    this.chart = echarts.init(canvas);

    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const histMetrics = metricsAgentOut.historical_metrics || {};
    const detectedYears = [...(metricsAgentOut.detected_years || [])];
    detectedYears.sort(); // Ascending for chart

    const limit = parseInt(this.selectedHorizon);
    const yearsToShow = detectedYears.slice(-limit);

    const key = this.selectedMetricKey;
    const meta = this.metricMeta[key];

    // Data lists
    const values = [];
    const growthRates = [];

    yearsToShow.forEach((yr, idx) => {
      const valRaw = this.getMetricValue(histMetrics[yr], key);
      const val = this.coerceFloat(valRaw) || 0;
      values.push(val);

      // YoY calculation
      if (idx > 0) {
        const prevYr = yearsToShow[idx - 1];
        const prevValRaw = this.getMetricValue(histMetrics[prevYr], key);
        const prevVal = this.coerceFloat(prevValRaw) || 0;
        if (val !== null && prevVal !== null && prevVal !== 0) {
          const rate = ((val - prevVal) / Math.abs(prevVal)) * 100;
          growthRates.push(parseFloat(rate.toFixed(2)));
        } else {
          growthRates.push(0);
        }
      } else {
        // Find previous year outside the horizon to compute first growth rate if possible
        const prevYrIdx = detectedYears.indexOf(yr) - 1;
        if (prevYrIdx >= 0) {
          const prevYr = detectedYears[prevYrIdx];
          const prevValRaw = this.getMetricValue(histMetrics[prevYr], key);
          const prevVal = this.coerceFloat(prevValRaw) || 0;
          if (val !== null && prevVal !== null && prevVal !== 0) {
            const rate = ((val - prevVal) / Math.abs(prevVal)) * 100;
            growthRates.push(parseFloat(rate.toFixed(2)));
          } else {
            growthRates.push(0);
          }
        } else {
          growthRates.push(0);
        }
      }
    });

    const suffix = this.data.company?.currency === 'INR' ? 'Cr' : 'M';
    const sym = this.data.company?.currency === 'INR' ? '₹' : '$';

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          let res = `<div style="font-family: var(--font-family); font-size: 12px; color: #fff;">`;
          res += `<b>${params[0].name}</b><br/>`;
          params.forEach(p => {
            const dot = p.marker;
            if (p.seriesName.includes('YoY')) {
              res += `${dot} YoY Growth: <b>${p.value >= 0 ? '+' : ''}${p.value}%</b><br/>`;
            } else {
              res += `${dot} ${meta.name}: <b>${sym} ${p.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suffix}</b><br/>`;
            }
          });
          res += `</div>`;
          return res;
        }
      },
      legend: {
        data: [meta.name, 'YoY Growth Rate'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '5%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: yearsToShow,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: (v) => `${sym}${v.toLocaleString()}`
          },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } }
        },
        {
          type: 'value',
          axisLabel: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: '{value}%'
          },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: meta.name,
          type: 'bar',
          barWidth: '35%',
          data: values,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1d4ed8' }
            ]),
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: 'YoY Growth Rate',
          type: 'line',
          yAxisIndex: 1,
          data: growthRates,
          symbolSize: 8,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 3 }
        }
      ]
    };

    this.chart.setOption(option);
  }

  // Generate dinamical AI analysis explanation based on financial metrics value changes (Requirement 6)
  getAIExplanation(metricKey, curVal, priVal, label) {
    if (curVal === undefined || curVal === null || curVal === 'Not Available') {
      return `Detailed trend analyst explanation is currently unavailable for ${label} as the data is missing from the uploaded statement.`;
    }

    if (priVal === undefined || priVal === null || priVal === 'Not Available') {
      return `Our AI analysis tool registers ${label} at ${curVal.toLocaleString()} for this period. As prior year baseline statements are not fully indexed, YoY change trends are currently pending validation.`;
    }

    const diff = curVal - priVal;
    const gPct = priVal !== 0 ? (diff / Math.abs(priVal)) * 100 : 0;
    const isIncrease = diff >= 0;

    const companyName = this.data.company?.name || 'the company';
    const absVal = Math.abs(curVal).toLocaleString();
    const absDiff = Math.abs(diff).toLocaleString();
    const absPct = Math.abs(gPct).toFixed(2);
    const suffix = this.data.company?.currency === 'INR' ? 'Cr' : 'M';
    const sym = this.data.company?.currency === 'INR' ? '₹' : '$';

    if (metricKey === 'revenue') {
      return isIncrease
        ? `AI Analyst View: ${companyName}'s top-line revenue expanded by +${absPct}% YoY, adding ${sym} ${absDiff} ${suffix} in sales. This highlights strong organic demand and robust client retention pipelines during the fiscal period.`
        : `AI Analyst View: ${companyName}'s top-line revenue contracted by -${absPct}% YoY (a drop of ${sym} ${absDiff} ${suffix}). This signifies potential headwinds, demand softening, or a strategic business restructuring toward higher-margin streams.`;
    }
    
    if (metricKey === 'net_profit') {
      return isIncrease
        ? `AI Analyst View: Bottom-line profitability grew by +${absPct}% YoY, reflecting strong operational leverage and effective cost-control adjustments implemented by management.`
        : `AI Analyst View: Net margins compressed by -${absPct}% YoY. This profit drop suggests rising overheads, tax adjustments, or non-operating asset write-downs during the period.`;
    }
    
    if (metricKey === 'free_cash_flow') {
      return isIncrease
        ? `AI Analyst View: FCF surged by +${absPct}% YoY. The company is generating clean surplus capital, indicating low intensity of capital lockups and healthy capacity to self-fund expansion, pay down debt, or pay dividends.`
        : `AI Analyst View: Free cash flow declined by -${absPct}% YoY. This contraction was driven by cash conversion delays or capital intensive reinvestments (high CapEx requirements) that limit current liquidity.`;
    }

    // Default template
    return isIncrease
      ? `AI Analyst View: ${label} increased by +${absPct}% YoY, indicating positive operational trajectory and expansion in line with the target model's core goals.`
      : `AI Analyst View: ${label} decreased by -${absPct}% YoY. Management may need to audit operational leakages or capital inefficiencies within this statement category.`;
  }

  // Opens Slide-over metric detail drawer panel (Requirement 6)
  openDetailDrawer(metricKey) {
    const meta = this.metricMeta[metricKey];
    if (!meta) return;

    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const histMetrics = metricsAgentOut.historical_metrics || {};
    const detectedYears = metricsAgentOut.detected_years || [];
    const currentYr = metricsAgentOut.latest_year || (detectedYears[0] || '2024');
    const prevYr = detectedYears[1];

    const curVal = histMetrics[currentYr]?.[metricKey];
    const priVal = prevYr ? histMetrics[prevYr]?.[metricKey] : null;

    const suffix = this.data.company?.currency === 'INR' ? 'Cr' : 'M';
    const sym = this.data.company?.currency === 'INR' ? '₹' : '$';

    // Populate drawer elements
    document.getElementById('drawer-metric-name').textContent = meta.name;
    document.getElementById('drawer-metric-statement').textContent = meta.statement;
    document.getElementById('drawer-metric-definition').textContent = meta.def;
    document.getElementById('drawer-metric-meaning').textContent = meta.meaning;

    // Formatting helper
    const isRatio = metricKey.endsWith('_pct') || metricKey === 'eps';
    const format = (v) => {
      if (v === undefined || v === null || v === 'Not Available') return 'N/A';
      if (typeof v === 'number') {
        if (isRatio) return `${v.toFixed(2)}%`;
        return `${sym} ${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suffix}`;
      }
      return v;
    };

    document.getElementById('drawer-lbl-current').textContent = `FY ${currentYr} Value`;
    document.getElementById('drawer-val-current').textContent = format(curVal);
    
    document.getElementById('drawer-lbl-prev').textContent = prevYr ? `FY ${prevYr} Value` : 'Previous Year Value';
    document.getElementById('drawer-val-prev').textContent = prevYr ? format(priVal) : 'N/A';

    // Compute YoY
    let yoyText = 'N/A';
    if (typeof curVal === 'number' && typeof priVal === 'number' && priVal !== 0) {
      const change = ((curVal - priVal) / Math.abs(priVal)) * 100;
      yoyText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    }
    document.getElementById('drawer-val-yoy').textContent = yoyText;

    // Confidence
    const confidence = this.data.confidence_scores?.financial_metrics || 95;
    document.getElementById('drawer-val-confidence').textContent = `${confidence}%`;

    // AI Explanation
    const aiExplanation = this.getAIExplanation(metricKey, curVal, priVal, meta.name);
    document.getElementById('drawer-ai-explanation-text').textContent = aiExplanation;

    // Source audit trail (Requirement 7)
    const sourceVal = this.getSource(metricKey, currentYr);
    document.getElementById('drawer-audit-source').textContent = sourceVal;
    document.getElementById('drawer-audit-statement').textContent = meta.statement;
    
    const fmA = this.data.raw_agent_outputs?.financial_metrics;
    const trackerDetails = fmA?.output?.extraction_details || fmA?.extraction_details || {};
    const rawMatch = trackerDetails[metricKey]?.raw_match || 'N/A';
    document.getElementById('drawer-audit-raw').textContent = rawMatch;
    
    const extractionType = trackerDetails[metricKey]?.type || (sourceVal === 'Calculated' ? 'Rule Engine Formula' : 'LLM Extraction');
    document.getElementById('drawer-audit-type').textContent = extractionType;

    // Open drawer panel
    document.getElementById('detail-drawer-overlay').classList.add('open');
    document.getElementById('detail-drawer-panel').classList.add('open');
  }

  closeDetailDrawer() {
    document.getElementById('detail-drawer-overlay').classList.remove('open');
    document.getElementById('detail-drawer-panel').classList.remove('open');
  }

  // Trigger file download helper
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Small delay before revoking to ensure download dialog triggers
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 200);
  }

  // Excel/PDF Backend Call Reuse (Requirement 9)
  async exportBackendFile(endpoint, filename, buttonEl) {
    buttonEl.disabled = true;
    const originalText = buttonEl.innerHTML;
    buttonEl.textContent = 'Processing...';

    try {
      const url = window.location.port === '8080' ? `http://localhost:8000/api/${endpoint}` : `/api/${endpoint}`;

      // Explicitly attach JWT token from sessionStorage / localStorage
      // so the request is authorized regardless of window.fetch override state.
      const token = sessionStorage.getItem('jwt_token') || localStorage.getItem('jwt_token') || null;
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(this.data)
      });

      // Handle 401: session expired — redirect to login
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

      // Prefer filename from Content-Disposition header if present
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)\1/);
        if (match && match[2]) {
          filename = match[2].trim();
        }
      }

      const blob = await response.blob();
      this.downloadBlob(blob, filename);
    } catch (err) {
      console.error('Export error:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalText;
    }
  }

  // Client-Side CSV Exporter
  exportCSV() {
    const metricsAgentOut = this.data.raw_agent_outputs?.financial_metrics?.output || this.data.raw_agent_outputs?.financial_metrics || {};
    const histMetrics = metricsAgentOut.historical_metrics || {};
    const detectedYears = [...(metricsAgentOut.detected_years || [])];
    detectedYears.sort((a,b) => b-a); // Descending

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header row
    const headers = ["Metric Name", "Statement Type", ...detectedYears.map(y => `FY ${y}`), "Unit"];
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    const suffix = this.data.company?.currency === 'INR' ? 'Cr' : 'M';

    Object.keys(this.metricMeta).forEach(key => {
      const meta = this.metricMeta[key];
      const rowData = [meta.name, meta.statement];
      
      detectedYears.forEach(yr => {
        const val = histMetrics[yr]?.[key];
        rowData.push(val !== undefined && val !== null ? val : 'N/A');
      });

      rowData.push(suffix);
      csvContent += rowData.map(val => `"${val}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const ticker = this.data.company?.ticker || 'TICKER';
    this.downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${ticker}_financial_metrics.csv`);
  }

  // Client-Side JSON Exporter
  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const ticker = this.data.company?.ticker || 'TICKER';
    this.downloadBlob(new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' }), `${ticker}_financial_analysis.json`);
  }

  initEventListeners() {
    // Search listener
    const searchBox = document.getElementById('metrics-search');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderExplorationTable();
      });
    }

    // Tabs filter listeners
    const tabBtns = document.querySelectorAll('.statement-tabs .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.statementFilter = btn.dataset.filter;
        this.renderExplorationTable();
      });
    });

    // Table Header Sorting listeners
    const ths = document.querySelectorAll('#explore-metrics-table th');
    ths.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (this.sortField === field) {
          this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = field;
          this.sortOrder = 'asc';
        }
        this.renderExplorationTable();
      });
    });

    // KPI Snapshot Card Click Listener (detail drawer trigger)
    document.addEventListener('click', (e) => {
      const snapCard = e.target.closest('.snapshot-card');
      if (snapCard) {
        const key = snapCard.dataset.metric;
        this.openDetailDrawer(key);
      }
    });

    // Exploration Table Row Click Listener (detail drawer trigger)
    const tbody = document.querySelector('#explore-metrics-table tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        if (tr && tr.dataset.metric) {
          const key = tr.dataset.metric;
          this.openDetailDrawer(key);
        }
      });
    }

    // Drawer Close listeners
    const closeBtn = document.getElementById('drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDetailDrawer());
    }
    const overlay = document.getElementById('detail-drawer-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeDetailDrawer());
    }

    // Trend Chart controls
    const metricSelect = document.getElementById('trend-metric-select');
    if (metricSelect) {
      metricSelect.addEventListener('change', (e) => {
        this.selectedMetricKey = e.target.value;
        this.renderTrendChart();
      });
    }

    const horizonBtns = document.querySelectorAll('.time-horizon-group .horizon-btn');
    horizonBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        horizonBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedHorizon = btn.dataset.horizon;
        this.renderTrendChart();
      });
    });

    // Export buttons mapping
    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportJSON());
    }

    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportCSV());
    }

    const exportExcelBtn = document.getElementById('btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        const ticker = this.data.company?.ticker || 'TICKER';
        this.exportBackendFile('export/excel', `${ticker}_financial_metrics.xlsx`, exportExcelBtn);
      });
    }

    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        const ticker = this.data.company?.ticker || 'TICKER';
        this.exportBackendFile('export/pdf', `${ticker}_financial_metrics.pdf`, exportPdfBtn);
      });
    }

    // Handle global resize for ECharts scaling
    window.addEventListener('resize', () => {
      if (this.chart) {
        this.chart.resize();
      }
    });
  }
}

// Initializing the Detailed Metrics page controller
document.addEventListener('DOMContentLoaded', () => {
  const page = new DetailedMetricsPage();
  page.init();
});
