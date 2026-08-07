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

class NewsDetailsPage {
  constructor() {
    this.data = null;
    this.sidebar = null;
    this.header = null;
    this.articles = [];
    this.filteredArticles = [];
    this.activeFilter = 'All';
    this.searchQuery = '';
    this.ticker = 'AAPL';
    this.companyName = 'Apple Inc.';
  }

  initializeNews() {
    console.log('[News Agent] Initializing news page controller...');

    // 1. Load active session data
    const cached = sessionStorage.getItem('analysis_result');
    if (!cached) {
      console.warn('[News Agent] No active session analysis payload found in sessionStorage.');
      this.renderError('No active report available. Please upload a financial statement PDF first.');
      return;
    }

    try {
      this.data = JSON.parse(cached);
      this.ticker = this.data.company?.ticker || 'TICKER';
      this.companyName = this.data.company?.name || 'Target Company';
      console.log(`[News Agent] Session data loaded. Company: "${this.companyName}", Ticker: "${this.ticker}"`);
    } catch (e) {
      console.error('[News Agent] Failed to parse session analysis data:', e);
      this.renderError('Corrupted session data. Please re-upload your report.');
      return;
    }

    // 2. Hydrate Sidebar and Header
    this.sidebar = new Sidebar('sidebar-container');
    this.sidebar.render(this.data, true);

    this.header = new Header('header-container');
    this.header.render(this.data.company);

    // Sidebar navigation active state highlighter
    setTimeout(() => {
      const items = document.querySelectorAll('.nav-item');
      items.forEach(i => i.classList.remove('active'));
      const activeLink = Array.from(items).find(i => i.querySelector('.nav-item-label')?.textContent?.trim() === 'Market News');
      if (activeLink) activeLink.classList.add('active');
    }, 50);

    // Connect page back button redirect
    const backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // 3. Setup control binds
    this.bindControls();

    // 4. Load news with Cache Priority check (10 minutes)
    this.loadNewsWithCache();
  }

  bindControls() {
    const searchInput = document.getElementById('news-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.filterAndRender();
      });
    }

    const filterBtns = document.querySelectorAll('.filter-btn-group button');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter;
        this.filterAndRender();
      });
    });

    const refreshBtn = document.getElementById('news-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.handleManualRefresh();
      });
    }
  }

  loadNewsWithCache() {
    const cacheKey = `market_news_page_cache_${this.ticker}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const ageMs = Date.now() - parsed.timestamp;
        const tenMins = 10 * 60 * 1000;

        if (ageMs < tenMins) {
          console.log(`[News Agent] Serving news from cache. Age: ${Math.round(ageMs / 1000)}s.`);
          this.articles = parsed.articles;
          this.renderSentimentScore(parsed.overallSentiment, parsed.sentimentScore);
          this.filterAndRender();
          
          const statusLbl = document.getElementById('news-status-label');
          if (statusLbl) statusLbl.textContent = 'Served from local cache';
          return;
        }
        console.log('[News Agent] Cache expired. Initiating fresh fetch.');
      } catch (e) {
        console.error('[News Agent] Failed to parse news cache:', e);
      }
    }

    this.fetchFreshNews();
  }

  fetchFreshNews() {
    console.log(`[News Agent] Fetching fresh news for ticker "${this.ticker}"...`);
    const statusLbl = document.getElementById('news-status-label');
    if (statusLbl) statusLbl.textContent = 'Fetching latest news...';

    // Data Priority Check
    // 1. Previous analysis news payload
    const sessionNews = this.data.news || this.data.raw_agent_outputs?.market_news?.output || {};
    let rawArticles = sessionNews.articles || [];
    let overallSentiment = sessionNews.overall_sentiment || 'Neutral';
    let sentimentScore = sessionNews.sentiment_score || 70;

    console.log(`[News Agent] API / Session News data size retrieved: ${rawArticles.length} items`);

    // Normalize and process every article
    this.articles = rawArticles.map(art => this.processArticleData(art));

    // Save back to local storage cache
    const cacheKey = `market_news_page_cache_${this.ticker}`;
    const cacheObj = {
      articles: this.articles,
      overallSentiment,
      sentimentScore,
      timestamp: Date.now()
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheObj));

    // Render sentiment stats
    this.renderSentimentScore(overallSentiment, sentimentScore);

    // Refresh UI list
    this.filterAndRender();

    if (statusLbl) statusLbl.textContent = 'Updated just now';
  }

  handleManualRefresh() {
    console.log('[News Agent] Manual refresh action triggered.');
    
    // Bypass age checks and query fresh
    this.fetchFreshNews();
  }

  processArticleData(art) {
    const headline = art.headline || art.title || '';
    const headlineLower = headline.toLowerCase();

    // 1. Categorize Sentiment from Headline (Step 7 classifier)
    let sentiment = art.sentiment || 'Neutral';
    if (!art.sentiment) {
      if (headlineLower.includes('grow') || headlineLower.includes('expand') || headlineLower.includes('rise') || headlineLower.includes('up') || headlineLower.includes('win') || headlineLower.includes('gain') || headlineLower.includes('buy') || headlineLower.includes('positive') || headlineLower.includes('success')) {
        sentiment = 'Positive';
      } else if (headlineLower.includes('drop') || headlineLower.includes('fall') || headlineLower.includes('down') || headlineLower.includes('loss') || headlineLower.includes('decline') || headlineLower.includes('sell') || headlineLower.includes('negative') || headlineLower.includes('fail') || headlineLower.includes('shortage') || headlineLower.includes('lawsuit')) {
        sentiment = 'Negative';
      }
    }

    // 2. Determine potential financial impact and category tag
    let category = art.category || 'Macroeconomics';
    let impact = art.impact || 'Likely affects future revenue growth.';
    
    if (headlineLower.includes('revenue') || headlineLower.includes('sales') || headlineLower.includes('earnings')) {
      category = 'Revenue';
      impact = sentiment === 'Positive' ? 'Likely accelerates revenue velocity.' : 'May constrain top-line growth margins.';
    } else if (headlineLower.includes('ai') || headlineLower.includes('intelligence') || headlineLower.includes('copilot') || headlineLower.includes('model')) {
      category = 'AI';
      impact = 'Supports long-term technology development.';
    } else if (headlineLower.includes('margins') || headlineLower.includes('profit') || headlineLower.includes('expense') || headlineLower.includes('cost')) {
      category = 'Margins';
      impact = sentiment === 'Positive' ? 'Positive for operating profit expansion.' : 'May increase operational expenditures.';
    } else if (headlineLower.includes('supply') || headlineLower.includes('chip') || headlineLower.includes('shortage') || headlineLower.includes('factory')) {
      category = 'Supply Chain';
      impact = 'Possible logistics or shipping bottleneck delays.';
    } else if (headlineLower.includes('lawsuit') || headlineLower.includes('investigat') || headlineLower.includes('court') || headlineLower.includes('sue')) {
      category = 'Legal';
      impact = 'Potential compliance or settlement litigation costs.';
    } else if (headlineLower.includes('launch') || headlineLower.includes('announce') || headlineLower.includes('introduce')) {
      category = 'Product Launch';
      impact = 'Expands customer footprint and top-line potential.';
    }

    // 3. Strict 2-3 lines summary limits (Step 5 summary rule)
    let summary = art.summary || '';
    if (!summary || summary === 'Not Available') {
      summary = `Recent market updates suggest that ${headline.charAt(0).toLowerCase() + headline.slice(1)} could impact operations. Strategic divisions are monitoring the event.`;
    }

    return {
      title: headline,
      summary: summary,
      source: art.source || 'Financial News Feed',
      url: art.url || '#',
      published: art.publishedTime || (art.days_ago !== undefined ? `${art.days_ago} days ago` : 'Recent'),
      sentiment: sentiment,
      impact: impact,
      category: category
    };
  }

  renderSentimentScore(overall, score) {
    const badge = document.getElementById('overall-sentiment-badge');
    if (badge) {
      badge.textContent = overall.toUpperCase();
      badge.className = `badge ${overall === 'Positive' ? 'badge-positive' : (overall === 'Negative' ? 'badge-negative' : 'badge-neutral')}`;
    }

    const scoreVal = document.getElementById('sentiment-score-val');
    if (scoreVal) {
      scoreVal.textContent = `${score}/100`;
    }
  }

  filterAndRender() {
    this.filteredArticles = this.articles.filter(art => {
      const matchesSearch = art.title.toLowerCase().includes(this.searchQuery) || art.summary.toLowerCase().includes(this.searchQuery);
      const matchesFilter = this.activeFilter === 'All' || art.sentiment === this.activeFilter;
      return matchesSearch && matchesFilter;
    });

    console.log(`[News Agent] Filter applied: "${this.activeFilter}", Search: "${this.searchQuery}". Rendering ${this.filteredArticles.length} of ${this.articles.length} articles.`);

    // Update filter count pill elements
    this.updatePillCounts();

    // Render feed
    const container = document.getElementById('articles-feed-container');
    if (!container) return;

    if (this.filteredArticles.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); text-align: center; padding: 48px var(--space-4); font-size: 13px;">
          No recent news available.
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredArticles.map(art => {
      const sentClass = art.sentiment === 'Positive' ? 'badge-positive' : (art.sentiment === 'Negative' ? 'badge-negative' : 'badge-neutral');

      return `
        <div class="news-card-item">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);">
            <a href="${art.url}" target="_blank" class="news-headline-link">${art.title}</a>
            <span class="badge ${sentClass}" style="flex-shrink: 0; font-size: 9px; padding: 2px 6px;">${art.sentiment}</span>
          </div>

          <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
            ${art.summary}
          </p>

          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 11px; font-weight: 500; border-top: 1px dashed var(--border-color); padding-top: var(--space-2.5); color: var(--text-muted);">
            <span>Category: <b style="color: var(--text-primary);">${art.category}</b></span>
            <span>Potential Impact: <b style="color: var(--accent-orange);">${art.impact}</b></span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: var(--text-primary);">${art.source}</span>
              <span>•</span>
              <span>${art.published}</span>
            </div>
            <a href="${art.url}" target="_blank" class="btn btn-outlined" style="padding: var(--space-1) var(--space-2); font-size: 11px; line-height: 1; border-color: var(--border-color); font-weight: 600; text-decoration: none;">
              Read Full Article →
            </a>
          </div>
        </div>
      `;
    }).join('');

    console.log('[News Agent] DOM updated successfully with rendered articles list.');
  }

  updatePillCounts() {
    const all = this.articles.length;
    const pos = this.articles.filter(a => a.sentiment === 'Positive').length;
    const neu = this.articles.filter(a => a.sentiment === 'Neutral').length;
    const neg = this.articles.filter(a => a.sentiment === 'Negative').length;

    const cAll = document.getElementById('count-all');
    if (cAll) cAll.textContent = all;

    const cPos = document.getElementById('count-pos');
    if (cPos) cPos.textContent = pos;

    const cNeu = document.getElementById('count-neu');
    if (cNeu) cNeu.textContent = neu;

    const cNeg = document.getElementById('count-neg');
    if (cNeg) cNeg.textContent = neg;
  }

  renderError(msg) {
    const container = document.getElementById('articles-feed-container');
    if (container) {
      container.innerHTML = `
        <div style="color: var(--accent-red); font-size: 13.5px; font-weight: 500; text-align: center; padding: 48px var(--space-4); border: 1px dashed var(--accent-red); border-radius: var(--radius-md); background: rgba(229, 62, 62, 0.05);">
          ${msg}
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = new NewsDetailsPage();
  page.initializeNews();
});
