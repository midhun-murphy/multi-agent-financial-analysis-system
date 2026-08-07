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

class CompetitorDetailsPage {
  constructor() {
    this.data = null;
    this.sidebar = null;
    this.header = null;
    this.competitors = [];
  }

  init() {
    // 1. Restore persistent session analysis data
    const cached = sessionStorage.getItem('analysis_result');
    if (!cached) {
      alert('No active analysis session found. Returning to dashboard upload.');
      window.location.href = 'index.html';
      return;
    }

    try {
      this.data = JSON.parse(cached);
      console.log('Restored competitor detailed data:', this.data);
    } catch (e) {
      console.error('Failed to parse competitor session data:', e);
      window.location.href = 'index.html';
      return;
    }

    // 2. Initialize Sidebar and Header
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);
    
    this.header = new Header('header-container');
    this.header.render(this.data.company);

    // Modify active tab in sidebar
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const compLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Competitor Analysis');
      if (compLink) compLink.classList.add('active');
    }, 50);

    // 4. Back to Dashboard Button
    const backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // 5. Populate Data & Charts
    this.resolveCompetitorPipeline();
    this.renderDetails();
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

  resolveCompetitorPipeline() {
    // Retrieve metrics computed in the backend
    const rawCompetitorOut = this.data.raw_agent_outputs?.competitor?.output || {};
    
    // Set competitors list entirely from the backend, fall back to competitors list in root data
    this.competitors = rawCompetitorOut.competitors || this.data.competitors || [];
  }

  renderDetails() {
    const rawCompetitorOut = this.data.raw_agent_outputs?.competitor?.output || {};
    const targetComp = this.competitors.find(c => c.is_target);
    const peers = this.competitors.filter(c => !c.is_target);

    if (!targetComp) {
      console.error('Target company details missing in competitors payload');
      document.getElementById('competitor-overview-text').textContent = 'Error: Target company data not found.';
      return;
    }

    // Format Currency Helper
    const formatCurrency = (val, currencyCode) => {
      if (val === null || val === undefined || val === 'Not Available') return 'Not Available';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      const isINR = currencyCode === 'INR' || this.data.company?.currency === 'INR';
      const sym = isINR ? '₹' : '$';
      const suf = isINR ? 'Cr' : 'M';
      return `${sym} ${num.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suf}`;
    };

    // Format Percent Helper
    const formatPercent = (val) => {
      if (val === null || val === undefined || val === 'Not Available') return 'Not Available';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return `${num.toFixed(1)}%`;
    };

    // Format Generic Numeric values
    const formatNum = (val, suffix = '', decimals = 2) => {
      if (val === null || val === undefined || val === 'Not Available') return 'Not Available';
      const num = parseFloat(val);
      if (isNaN(num)) return val;
      return `${num.toFixed(decimals)}${suffix}`;
    };

    // Retrieve rankings, leader, strengths, and weaknesses from the backend
    const rankings = rawCompetitorOut.rankings || this.competitors.map(c => ({
      name: c.name,
      ticker: c.ticker,
      combinedScore: c.overall_score || 0,
      is_target: c.is_target
    })).sort((a, b) => b.combinedScore - a.combinedScore);

    const winner = rawCompetitorOut.leader || rankings[0] || {};
    const strengths = rawCompetitorOut.strengths || [];
    const weaknesses = rawCompetitorOut.weaknesses || [];

    // Populate narrative text from the backend
    const narrativeText = rawCompetitorOut.comparison_summary || rawCompetitorOut.rationale || 'Competitor narrative summary is not available.';
    document.getElementById('competitor-overview-text').textContent = narrativeText;

    // Detailed Table Columns
    const thead = document.querySelector('#detailed-comp-table thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th style="text-align: left; position: sticky; left: 0; background: var(--bg-card); z-index: 10;">Company</th>
          <th>Ticker</th>
          <th>Exchange</th>
          <th>Sector</th>
          <th>Industry</th>
          <th>Revenue</th>
          <th>Market Cap</th>
          <th>Net Income</th>
          <th>ROE</th>
          <th>ROA</th>
          <th>Operating Margin</th>
          <th>EBITDA Margin</th>
          <th>Net Margin</th>
          <th>P/E (x)</th>
          <th>Div Yield</th>
          <th>D/E</th>
          <th>Current Ratio</th>
          <th>Overall Score</th>
          <th>Rec</th>
        </tr>
      `;
    }

    // Populate comparison rows
    const tbody = document.querySelector('#detailed-comp-table tbody');
    if (tbody) {
      let rowsHtml = '';
      this.competitors.forEach(c => {
        const rowClass = c.is_target ? 'row-target' : '';
        const nameCell = c.is_target ? `<b>${c.name} *</b>` : c.name;
        const compScore = c.overall_score !== undefined ? c.overall_score : (c.combinedScore !== undefined ? c.combinedScore : 'Not Available');
        
        rowsHtml += `
          <tr class="${rowClass}">
            <td style="position: sticky; left: 0; background: ${c.is_target ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)'}; font-weight: ${c.is_target ? '600' : 'normal'}; border-right: 1px solid var(--border-color);">${nameCell}</td>
            <td><b>${c.ticker}</b></td>
            <td>${c.exchange || 'Not Available'}</td>
            <td>${c.sector || 'Not Available'}</td>
            <td>${c.industry || 'Not Available'}</td>
            <td>${formatCurrency(c.revenue, c.currency)}</td>
            <td>${formatCurrency(c.market_cap, c.currency)}</td>
            <td>${formatCurrency(c.net_profit, c.currency)}</td>
            <td>${formatPercent(c.roe)}</td>
            <td>${formatPercent(c.roa)}</td>
            <td>${formatPercent(c.operating_margin)}</td>
            <td>${formatPercent(c.ebitda_margin)}</td>
            <td>${formatPercent(c.net_margin)}</td>
            <td>${formatNum(c.pe, '', 1)}</td>
            <td>${formatPercent(c.dividend_yield)}</td>
            <td>${formatNum(c.debt_to_equity, '', 2)}</td>
            <td>${formatNum(c.current_ratio, '', 2)}</td>
            <td><b>${compScore}</b></td>
            <td><span class="badge ${String(c.recommendation || 'HOLD').toUpperCase().includes('BUY') ? 'badge-buy' : (String(c.recommendation || 'HOLD').toUpperCase().includes('SELL') ? 'badge-sell' : 'badge-hold')}">${c.recommendation || 'HOLD'}</span></td>
          </tr>
        `;
      });
      tbody.innerHTML = rowsHtml;
    }

    // Populate rankings table
    const rankBody = document.querySelector('#ranking-table tbody');
    if (rankBody) {
      let rankHtml = '';
      rankings.forEach((r, idx) => {
        const isTarget = r.is_target;
        rankHtml += `
          <tr class="${isTarget ? 'row-target' : ''}">
            <td><b>#${idx + 1}</b></td>
            <td>${r.name}</td>
            <td>${r.ticker}</td>
            <td><b>${r.combinedScore || r.overall_score || 'Not Available'}/100</b></td>
          </tr>
        `;
      });
      rankBody.innerHTML = rankHtml;
    }

    // Populate strengths & weaknesses
    const strengthsContainer = document.getElementById('target-strengths-list');
    const weaknessesContainer = document.getElementById('target-weaknesses-list');
    
    if (strengthsContainer) {
      strengthsContainer.innerHTML = strengths.map(s => `
        <div class="comp-strengths-box">
          <p class="body-text" style="margin: 0; font-size: 12px; font-weight: 500;">${s}</p>
        </div>
      `).join('') || `<div style="color:var(--text-muted); font-size:11px;">No strategic strengths computed.</div>`;
    }

    if (weaknessesContainer) {
      weaknessesContainer.innerHTML = weaknesses.map(w => `
        <div class="comp-weaknesses-box">
          <p class="body-text" style="margin: 0; font-size: 12px; font-weight: 500;">${w}</p>
        </div>
      `).join('') || `<div style="color:var(--text-muted); font-size:11px;">No critical weaknesses flagged.</div>`;
    }

    // Winner box explanation
    const winnerNarrative = document.getElementById('winner-narrative-text');
    if (winnerNarrative) {
      winnerNarrative.innerHTML = `🏆 <b>Comparative Sector Winner:</b> ${winner.name || 'Not Available'} (Ticker: ${winner.ticker || 'Not Available'})`;
    }

    // Render ECharts
    this.renderECharts(this.competitors, rawCompetitorOut);
  }

  renderECharts(competitors, rawCompetitorOut) {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDark ? '#E2E8F0' : '#2D3748';
    const splitLineColor = isDark ? '#2D3748' : '#E2E8F0';

    // 1. Market Share Chart (Pie) using dynamic shares
    const msDom = document.getElementById('market-share-chart');
    if (msDom) {
      const msChart = echarts.init(msDom);
      const totalRev = competitors.reduce((sum, c) => sum + (this.coerceFloat(c.revenue) || 0), 0) || 1;
      
      const pieData = competitors.map(c => ({
        name: c.name,
        value: this.coerceFloat(c.revenue) || 0
      })).filter(d => d.value > 0);
      
      const option = {
        tooltip: { 
          trigger: 'item', 
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' },
          formatter: (params) => {
            const pct = ((params.value / totalRev) * 100).toFixed(1);
            return `${params.name}: ${params.value.toLocaleString()} (${pct}%)`;
          }
        },
        series: [{
          name: 'Market Share',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#1e293b', borderWidth: 2 },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold', formatter: '{b}\n{d}%', color: textColor }
          },
          labelLine: { show: false },
          data: pieData
        }]
      };
      msChart.setOption(option);
    }

    // 2. Profitability Chart (Bar)
    const profDom = document.getElementById('profitability-compare-chart');
    if (profDom) {
      const profChart = echarts.init(profDom);
      const companies = competitors.map(c => c.ticker);
      const roeData = competitors.map(c => this.coerceFloat(c.roe) || 0);
      const ebitdaData = competitors.map(c => this.coerceFloat(c.ebitda_margin) || 0);

      const option = {
        tooltip: { 
          trigger: 'axis', 
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' },
          axisPointer: { type: 'shadow' } 
        },
        legend: { textStyle: { color: textColor } },
        xAxis: { type: 'category', data: companies, axisLabel: { color: textColor } },
        yAxis: { type: 'value', axisLabel: { color: textColor, formatter: '{value}%' }, splitLine: { lineStyle: { color: splitLineColor } } },
        series: [
          { name: 'ROE', type: 'bar', data: roeData, color: '#38A169' },
          { name: 'EBITDA Margin', type: 'bar', data: ebitdaData, color: '#3182CE' }
        ]
      };
      profChart.setOption(option);
    }

    // 3. Valuations Chart (Bar)
    const valDom = document.getElementById('valuations-compare-chart');
    if (valDom) {
      const valChart = echarts.init(valDom);
      const companies = competitors.map(c => c.ticker);
      const peData = competitors.map(c => this.coerceFloat(c.pe) || 0);
      const colors = competitors.map(c => c.is_target ? '#3182CE' : '#805AD5');

      const option = {
        tooltip: { 
          trigger: 'axis', 
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' },
          axisPointer: { type: 'shadow' } 
        },
        xAxis: { type: 'category', data: companies, axisLabel: { color: textColor } },
        yAxis: { type: 'value', axisLabel: { color: textColor, formatter: '{value}x' }, splitLine: { lineStyle: { color: splitLineColor } } },
        series: [{
          name: 'P/E Ratio',
          type: 'bar',
          data: peData,
          itemStyle: {
            color: (params) => colors[params.dataIndex]
          }
        }]
      };
      valChart.setOption(option);
    }

    // 4. Radar Index Comparison Chart
    const radarDom = document.getElementById('radar-compare-chart');
    if (radarDom && rawCompetitorOut.radar_comparison) {
      const radarChart = echarts.init(radarDom);
      const radarData = rawCompetitorOut.radar_comparison;
      const targetComp = competitors.find(c => c.is_target);
      const peers = competitors.filter(c => !c.is_target);

      const targetSeries = {
        name: targetComp.name,
        value: radarData.target,
        areaStyle: { color: 'rgba(49, 130, 206, 0.2)' },
        lineStyle: { color: '#3182CE', width: 2 },
        itemStyle: { color: '#3182CE' }
      };

      const peerSeries = [];
      const colors = ['#38A169', '#805AD5', '#DD6B20', '#E53E3E'];
      let colorIdx = 0;
      for (const [ticker, vals] of Object.entries(radarData.peers || {})) {
        const peerObj = peers.find(p => p.ticker === ticker) || {};
        const color = colors[colorIdx % colors.length];
        peerSeries.push({
          name: peerObj.name || ticker,
          value: vals,
          lineStyle: { color: color, width: 1.5 },
          itemStyle: { color: color }
        });
        colorIdx++;
      }

      const option = {
        tooltip: {
          trigger: 'item',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          textStyle: { color: '#f1f5f9' }
        },
        legend: {
          data: [targetComp.name, ...peerSeries.map(p => p.name)],
          textStyle: { color: textColor },
          bottom: 0,
          type: 'scroll'
        },
        radar: {
          indicator: radarData.categories.map(cat => ({ name: cat, max: 100 })),
          axisName: { color: textColor, fontSize: 11 },
          splitLine: { lineStyle: { color: splitLineColor } },
          splitArea: { show: false }
        },
        series: [{
          name: 'Multi-Dimensional Score Index',
          type: 'radar',
          data: [targetSeries, ...peerSeries]
        }]
      };
      radarChart.setOption(option);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new CompetitorDetailsPage();
  page.init();
});
