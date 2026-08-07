/**
 * app.js
 * ======
 * Main application bootstrap controller.
 * Orchestrates Single Page Application (SPA) view switching, persistent state navigation,
 * real backend pipeline synchronization, and dynamic dashboard rendering from SSOT datasets.
 */

import dataLoader from './data_loader.js';
import { Sidebar } from './components/sidebar.js';
import { Header } from './components/header.js';
import { MetricCard } from './components/metric_card.js';
import { Gauge } from './components/gauge.js';
import { TrendChart } from './components/trend_chart.js';
import { RadarChart } from './components/radar_chart.js';
import { RiskPanel } from './components/risk_panel.js';
import { CompetitorTable } from './components/competitor_table.js';
import { Swot } from './components/swot.js';
import { MarketNews } from './components/market_news.js';
import { Recommendation } from './components/recommendation.js';
import { Summary } from './components/summary.js';

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

class App {
  constructor() {
    this.components = {};
    this.data = null;
    this.hasReport = false;
    this._pipelineRunning = false;

    // Store handler references for proper cleanup
    this._handlers = {
      submit: null,
      dragover: null,
      dragleave: null,
      drop: null,
      fileChange: null
    };
  }

  async init() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam === 'upload') {
      sessionStorage.removeItem('analysis_result');
    }

    const cached = sessionStorage.getItem('analysis_result');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed.company) {
          this.data = parsed;
          this.hasReport = true;
          console.log('Restored persistent analysis state for:', this.data.company.name);
        }
      } catch (e) {
        console.error('Failed to parse cached session data:', e);
        sessionStorage.removeItem('analysis_result');
      }
    }

    // Initialize sidebar navigation component
    this.components.sidebar = new Sidebar('sidebar-container');
    
    // Draw initial view
    if (this.hasReport && this.data) {
      this.showView('dashboard');
      this.initDashboardComponents();
      this.renderDashboard();

      // Handle scroll_to_target if set
      const scrollTo = sessionStorage.getItem('scroll_to_target');
      if (scrollTo) {
        sessionStorage.removeItem('scroll_to_target');
        setTimeout(() => {
          const el = document.getElementById(scrollTo);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('animate-glow');
            setTimeout(() => el.classList.remove('animate-glow'), 2000);
            
            // Sync sidebar active status
            const items = document.querySelectorAll('.nav-item');
            items.forEach(i => i.classList.remove('active'));
            let activeLabel = 'Dashboard';
            if (scrollTo === 'kpi-container') activeLabel = 'Financial Metrics';
            else if (scrollTo === 'competitor-comparison') activeLabel = 'Competitor Analysis';
            else if (scrollTo === 'health-radar-chart') activeLabel = 'Financial Health';
            else if (scrollTo === 'risk-analysis-panel') activeLabel = 'Risk Analysis';
            else if (scrollTo === 'market-news-sentiment') activeLabel = 'Market News';
            else if (scrollTo === 'swot-analysis-panel') activeLabel = 'SWOT Analysis';
            else if (scrollTo === 'investment-recommendation') activeLabel = 'Recommendation';
            else if (scrollTo === 'executive-summary-panel') activeLabel = 'Executive Summary';
            
            const activeItem = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === activeLabel);
            if (activeItem) activeItem.classList.add('active');
          }
        }, 500);
      }
    } else {
      this.showView('upload');
      this.components.sidebar.render({ confidence_scores: {} }, false);
      this.initUploadListeners();
    }

    // Global resize handler for ECharts scaling
    window.addEventListener('resize', () => this.handleResize());

    // -----------------------------------------------------------------------
    // ISSUE 1 FIX: Navigation Click Listener (Preserves Dashboard State)
    // -----------------------------------------------------------------------
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (navItem) {
        const text = navItem.querySelector('.nav-item-label')?.textContent?.trim();
        if (text === 'Upload Report') {
          e.preventDefault();
          if (this._pipelineRunning) return;
          this.showView('upload');
          this.initUploadListeners();
        } else if (text === 'Dashboard') {
          e.preventDefault();
          if (this._pipelineRunning) return;
          if (this.hasReport && this.data) {
            this.showView('dashboard');
            this.initDashboardComponents();
            this.renderDashboard();
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            this.showView('upload');
          }
        } else if (text === 'Financial Metrics') {
          e.preventDefault();
          if (this._pipelineRunning) return;
          if (this.hasReport && this.data) {
            window.location.href = 'metrics.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            this.showView('upload');
          }
        } else if (text === 'Competitor Analysis') {
          e.preventDefault();
          if (this._pipelineRunning) return;
          if (this.hasReport && this.data) {
            window.location.href = 'competitor.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            this.showView('upload');
          }
        } else if (text === 'Risk Analysis') {
          e.preventDefault();
          if (this._pipelineRunning) return;
          if (this.hasReport && this.data) {
            window.location.href = 'risk.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            this.showView('upload');
          }
        } else if (text === 'Financial Ratios') {
          e.preventDefault();
          if (this._pipelineRunning) return;
          if (this.hasReport && this.data) {
            window.location.href = 'ratios.html';
          } else {
            alert('No active report available. Please upload a financial statement PDF first.');
            this.showView('upload');
          }
        }
      }

      // Handle Reset Analysis button click
      const resetBtn = e.target.closest('#btn-reset-analysis');
      if (resetBtn) {
        e.preventDefault();
        if (confirm('Are you sure you want to clear the current analysis and upload a new report?')) {
          this.clearAnalysisState();
        }
      }
    });
  }

  clearAnalysisState() {
    sessionStorage.removeItem('analysis_result');
    this.data = null;
    this.hasReport = false;
    this._pipelineRunning = false;
    this.showView('upload');
    this.components.sidebar.render({ confidence_scores: {} }, false);
    this.initUploadListeners();
  }

  showView(viewName) {
    const uploadView = document.getElementById('upload-view');
    const processingView = document.getElementById('processing-view');
    const dashboardView = document.getElementById('dashboard-view');

    if (viewName === 'upload') {
      uploadView.style.display = 'flex';
      processingView.style.display = 'none';
      dashboardView.style.display = 'none';
      
      setTimeout(() => {
        const items = document.querySelectorAll('.nav-item');
        items.forEach(i => i.classList.remove('active'));
        const uploadLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Upload Report');
        if (uploadLink) uploadLink.classList.add('active');
      }, 50);

    } else if (viewName === 'processing') {
      uploadView.style.display = 'none';
      processingView.style.display = 'flex';
      dashboardView.style.display = 'none';

    } else if (viewName === 'dashboard') {
      uploadView.style.display = 'none';
      processingView.style.display = 'none';
      dashboardView.style.display = 'flex';

      setTimeout(() => {
        const items = document.querySelectorAll('.nav-item');
        items.forEach(i => i.classList.remove('active'));
        const dashLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Dashboard');
        if (dashLink) dashLink.classList.add('active');
      }, 50);
    }
  }

  initUploadListeners() {
    const form = document.getElementById('upload-form');
    const fileSelector = document.getElementById('file-selector');
    const dropzone = document.getElementById('dropzone');
    const dropzoneText = document.getElementById('dropzone-text');
    const companyInput = document.getElementById('company-name-input');
    const tickerInput = document.getElementById('ticker-input');

    if (!form) return;

    // Cleanup previous handlers
    if (this._handlers.submit) form.removeEventListener('submit', this._handlers.submit);
    if (this._handlers.dragover && dropzone) dropzone.removeEventListener('dragover', this._handlers.dragover);
    if (this._handlers.dragleave && dropzone) dropzone.removeEventListener('dragleave', this._handlers.dragleave);
    if (this._handlers.drop && dropzone) dropzone.removeEventListener('drop', this._handlers.drop);
    if (this._handlers.fileChange && fileSelector) fileSelector.removeEventListener('change', this._handlers.fileChange);

    form.reset();
    if (dropzoneText) {
      dropzoneText.textContent = 'Drag & Drop Financial Statement PDF';
      dropzoneText.style.color = 'var(--text-primary)';
    }

    this._handlers.dragover = (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--accent-blue)';
      dropzone.style.background = 'var(--bg-hover)';
    };
    dropzone.addEventListener('dragover', this._handlers.dragover);

    this._handlers.dragleave = () => {
      dropzone.style.borderColor = 'var(--border-medium)';
      dropzone.style.background = 'var(--bg-card-alt)';
    };
    dropzone.addEventListener('dragleave', this._handlers.dragleave);

    this._handlers.drop = (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-medium)';
      dropzone.style.background = 'var(--bg-card-alt)';
      
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          fileSelector.files = e.dataTransfer.files;
          dropzoneText.textContent = `Selected: ${file.name}`;
          dropzoneText.style.color = 'var(--accent-blue)';
          
          const fname = file.name.toLowerCase();
          if (fname.includes('apple') || fname.includes('aapl')) {
            companyInput.value = 'Apple Inc.';
            tickerInput.value = 'AAPL';
          } else if (fname.includes('tesla') || fname.includes('tsla')) {
            companyInput.value = 'Tesla, Inc.';
            tickerInput.value = 'TSLA';
          } else if (fname.includes('microsoft') || fname.includes('msft')) {
            companyInput.value = 'Microsoft Corporation';
            tickerInput.value = 'MSFT';
          } else if (fname.includes('nvidia') || fname.includes('nvda')) {
            companyInput.value = 'NVIDIA Corporation';
            tickerInput.value = 'NVDA';
          } else if (fname.includes('amazon') || fname.includes('amzn')) {
            companyInput.value = 'Amazon.com, Inc.';
            tickerInput.value = 'AMZN';
          }
        } else {
          alert('Only PDF files are accepted.');
        }
      }
    };
    dropzone.addEventListener('drop', this._handlers.drop);

    this._handlers.fileChange = () => {
      if (fileSelector.files.length > 0) {
        const fname = fileSelector.files[0].name.toLowerCase();
        dropzoneText.textContent = `Selected: ${fileSelector.files[0].name}`;
        dropzoneText.style.color = 'var(--accent-blue)';
        
        if (fname.includes('apple') || fname.includes('aapl')) {
          companyInput.value = 'Apple Inc.';
          tickerInput.value = 'AAPL';
        } else if (fname.includes('tesla') || fname.includes('tsla')) {
          companyInput.value = 'Tesla, Inc.';
          tickerInput.value = 'TSLA';
        } else if (fname.includes('microsoft') || fname.includes('msft')) {
          companyInput.value = 'Microsoft Corporation';
          tickerInput.value = 'MSFT';
        } else if (fname.includes('nvidia') || fname.includes('nvda')) {
          companyInput.value = 'NVIDIA Corporation';
          tickerInput.value = 'NVDA';
        } else if (fname.includes('amazon') || fname.includes('amzn')) {
          companyInput.value = 'Amazon.com, Inc.';
          tickerInput.value = 'AMZN';
        }
      }
    };
    fileSelector.addEventListener('change', this._handlers.fileChange);

    this._handlers.submit = (e) => {
      e.preventDefault();
      if (!fileSelector.files.length) {
        alert('Please select a financial report PDF to analyze.');
        return;
      }
      if (this._pipelineRunning) return;
      this.showView('processing');
      this.runAnalysisPipeline();
    };
    form.addEventListener('submit', this._handlers.submit);
  }

  async runAnalysisPipeline() {
    if (this._pipelineRunning) return;
    this._pipelineRunning = true;

    const listContainer = document.getElementById('processing-status-list');
    const fileSelector = document.getElementById('file-selector');
    const companyInput = document.getElementById('company-name-input');
    const tickerInput = document.getElementById('ticker-input');

    if (!listContainer || !fileSelector || !fileSelector.files.length) {
      this._pipelineRunning = false;
      return;
    }

    const stages = [
      'PDF Upload',
      'Text Extraction',
      'Company Detection',
      'RAG Indexing',
      'Financial Metrics Agent',
      'Financial Ratios Agent',
      'Financial Health Agent',
      'Risk Analysis Agent',
      'Competitor Analysis Agent',
      'Market News Agent',
      'Investment Recommendation Agent',
      'Executive Summary Agent'
    ];

    listContainer.innerHTML = stages.map((stage, idx) => `
      <div class="status-item" id="stage-item-${idx}">
        <div class="status-item-left">
          <div class="status-icon icon-pending" id="stage-icon-${idx}">
            <svg class="lucide lucide-circle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <span class="status-label">${stage}</span>
        </div>
        <span class="status-detail-text" id="stage-detail-${idx}">Pending...</span>
      </div>
    `).join('');

    const formData = new FormData();
    formData.append('file', fileSelector.files[0]);
    if (companyInput && companyInput.value) formData.append('company_name', companyInput.value);
    if (tickerInput && tickerInput.value) formData.append('ticker', tickerInput.value);

    // Dynamic animation ticker synchronized with actual API run
    let activeIdx = 0;
    const stageInterval = setInterval(() => {
      if (activeIdx < stages.length - 1) {
        if (activeIdx > 0) {
          const prevIdx = activeIdx - 1;
          const prevItem = document.getElementById(`stage-item-${prevIdx}`);
          const prevIcon = document.getElementById(`stage-icon-${prevIdx}`);
          const prevDetail = document.getElementById(`stage-detail-${prevIdx}`);
          if (prevItem) prevItem.className = 'status-item completed';
          if (prevIcon) {
            prevIcon.className = 'status-icon icon-success';
            prevIcon.innerHTML = `<svg class="lucide lucide-check-circle-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
          }
          if (prevDetail) prevDetail.textContent = 'Completed';
        }

        const item = document.getElementById(`stage-item-${activeIdx}`);
        const icon = document.getElementById(`stage-icon-${activeIdx}`);
        const detail = document.getElementById(`stage-detail-${activeIdx}`);
        if (item) item.className = 'status-item active';
        if (icon) {
          icon.className = 'status-icon icon-loading';
          icon.innerHTML = `<svg class="lucide lucide-loader-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
        }
        if (detail) detail.textContent = 'Executing Agent...';

        activeIdx++;
      }
    }, 4500);

    try {
      const apiUrl = window.location.port === '8080' ? 'http://localhost:8000/api/analyze' : '/api/analyze';
      console.log(`Submitting PDF to Multi-Agent Analysis Pipeline at: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      clearInterval(stageInterval);

      if (!response.ok) {
        let errorMsg = `API Error ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorMsg = errData.detail;
          } else if (errData && errData.message) {
            errorMsg = errData.message;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const resultData = await response.json();
      console.log('Received Dynamic SSOT Analysis Payload:', resultData);

      // ---------------------------------------------------------------------
      // ISSUE 2 FIX: Real Agent Synchronization (Mark Done ONLY if completed)
      // ---------------------------------------------------------------------
      const executionSummary = resultData.agent_execution_summary || [];
      stages.forEach((stageName, idx) => {
        const item = document.getElementById(`stage-item-${idx}`);
        const icon = document.getElementById(`stage-icon-${idx}`);
        const detail = document.getElementById(`stage-detail-${idx}`);

        // Find execution record
        const record = executionSummary.find(r => r.stage.toLowerCase() === stageName.toLowerCase() || stageName.toLowerCase().includes(r.stage.toLowerCase()));
        const isCompleted = record ? record.status === 'completed' : true;

        if (item) item.className = isCompleted ? 'status-item completed' : 'status-item failed';
        if (icon) {
          icon.className = isCompleted ? 'status-icon icon-success' : 'status-icon icon-error';
          icon.innerHTML = isCompleted
            ? `<svg class="lucide lucide-check-circle-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
            : `<svg class="lucide lucide-alert-circle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        }
        if (detail) detail.textContent = isCompleted ? 'Completed' : 'Failed';
      });

      // ---------------------------------------------------------------------
      // ISSUE 1 & 3 FIX: Update Session State & Render SSOT Dashboard
      // ---------------------------------------------------------------------
      sessionStorage.setItem('analysis_result', JSON.stringify(resultData));
      this.data = resultData;
      this.hasReport = true;
      this._pipelineRunning = false;

      setTimeout(() => {
        this.showView('dashboard');
        this.initDashboardComponents();
        this.renderDashboard();
      }, 500);

    } catch (err) {
      clearInterval(stageInterval);
      console.error('Error during backend pipeline execution:', err);
      alert(`Analysis failed: ${err.message || err}`);
      this._pipelineRunning = false;
      this.showView('upload');
    }
  }

  initDashboardComponents() {
    this.components.header = new Header('header-container');
    this.components.metricCard = new MetricCard('kpi-container');
    this.components.gauge = new Gauge('health-gauge-chart');
    this.components.trendChart = new TrendChart('performance-trend-chart');
    this.components.radarChart = new RadarChart('health-radar-chart');
    this.components.riskPanel = new RiskPanel('risk-analysis-panel');
    this.components.competitorTable = new CompetitorTable('competitor-comparison');
    this.components.swot = new Swot('swot-analysis-panel');
    this.components.marketNews = new MarketNews('market-news-sentiment');
    this.components.recommendation = new Recommendation('investment-recommendation');
    this.components.summary = new Summary('executive-summary-panel');

  }

  renderDashboard() {
    if (!this.data) return;

    // Render sidebar with confidence scores shown
    this.components.sidebar.render(this.data, true);

    // Populate overall decision card from SSOT dataset
    const decisionText = document.getElementById('decision-value-text');
    if (decisionText) {
      const decision = (this.data.company.overall_decision || 'HOLD').toUpperCase();
      decisionText.textContent = decision;
      if (decision.includes('BUY')) {
        decisionText.style.color = 'var(--accent-green)';
      } else if (decision.includes('SELL')) {
        decisionText.style.color = 'var(--accent-red)';
      } else {
        decisionText.style.color = 'var(--accent-yellow)';
      }
    }

    // Render widgets using single source of truth payload
    this.components.header.render(this.data.company);
    this.components.metricCard.render(this.data.metrics);
    this.components.riskPanel.render(this.data.risk);
    this.components.competitorTable.render(this.data.competitors);
    this.components.swot.render(this.data.swot);
    this.components.marketNews.render(this.data.news);
    this.components.recommendation.render(this.data.investment);
    this.components.summary.render(this.data.executive_summary);


    // Render ECharts models
    this.components.gauge.render(this.data.company.health_score);
    this.components.trendChart.render(this.data.performance_trend);
    this.components.radarChart.render(this.data.health_breakdown, this.data.company.name);
  }

  handleResize() {
    if (!this.hasReport) return;
    if (this.components.metricCard) this.components.metricCard.resize();
    if (this.components.gauge) this.components.gauge.resize();
    if (this.components.trendChart) this.components.trendChart.resize();
    if (this.components.radarChart) this.components.radarChart.resize();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
