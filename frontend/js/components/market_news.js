/**
 * market_news.js
 * ==============
 * Renders the Market News & Sentiment widget with search,
 * sentiment filters, dynamic impact analysis, and 15-minute caching.
 */

export class MarketNews {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.articles = [];
    this.currentTicker = 'TICKER';
    this.activeFilter = 'All';
    this.searchQuery = '';
  }

  render(newsData) {
    if (!this.container) return;

    // Detect current ticker from session state to manage cache keys
    const cachedResult = sessionStorage.getItem('analysis_result');
    if (cachedResult) {
      try {
        const parsed = JSON.parse(cachedResult);
        this.currentTicker = parsed.company?.ticker || 'TICKER';
      } catch (e) {
        console.error(e);
      }
    }

    // Process and normalize articles
    const rawArticles = newsData?.articles || [];
    this.articles = rawArticles.map(art => this.processArticleData(art));

    // Store in cache (15 minutes)
    const cacheKey = `market_news_cache_${this.currentTicker}`;
    const cacheObj = {
      articles: this.articles,
      overall_sentiment: newsData?.overall_sentiment || 'Neutral',
      sentiment_score: newsData?.sentiment_score || 75,
      timestamp: Date.now()
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheObj));

    // Initial render of panel structure
    this.renderPanelStructure(cacheObj);
    this.bindEvents();
    this.filterAndRenderArticles();
  }

  processArticleData(art) {
    const headline = art.headline || '';
    const headlineLower = headline.toLowerCase();
    
    // 1. Determine Sentiment
    let sentiment = art.sentiment || 'Neutral';
    if (!art.sentiment) {
      if (headlineLower.includes('grow') || headlineLower.includes('expand') || headlineLower.includes('rise') || headlineLower.includes('up') || headlineLower.includes('win') || headlineLower.includes('gain') || headlineLower.includes('buy') || headlineLower.includes('positive') || headlineLower.includes('success')) {
        sentiment = 'Positive';
      } else if (headlineLower.includes('drop') || headlineLower.includes('fall') || headlineLower.includes('down') || headlineLower.includes('loss') || headlineLower.includes('decline') || headlineLower.includes('sell') || headlineLower.includes('negative') || headlineLower.includes('fail') || headlineLower.includes('shortage') || headlineLower.includes('lawsuit')) {
        sentiment = 'Negative';
      }
    }
    
    // 2. Determine Category & Impact
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

    // 3. Summary (2-3 lines)
    let summary = art.summary || '';
    if (!summary || summary === 'Not Available') {
      summary = `Recent market updates suggest that ${headline.charAt(0).toLowerCase() + headline.slice(1)} could impact operations. Strategic divisions are monitoring the event.`;
    }

    return {
      headline: art.headline,
      source: art.source || 'Financial News',
      publishedTime: art.days_ago !== undefined ? `${art.days_ago} days ago` : (art.time || 'Recent'),
      sentiment: sentiment,
      category: category,
      summary: summary,
      impact: impact,
      url: art.url || '#'
    };
  }

  renderPanelStructure(cacheObj) {
    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
        <div class="card-title" style="margin-bottom: 0;">Market News & Sentiment</div>
        <button id="news-refresh-btn" class="btn btn-outlined" style="padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
          <svg class="lucide lucide-refresh-cw" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
          Refresh
        </button>
      </div>
      
      <div class="news-panel h-full" style="display: flex; flex-direction: column;">
        <!-- Sentiment Meta Stats Header -->
        <div class="news-header-meta" style="margin-bottom: var(--space-3);">
          <div>
            <span class="text-muted" style="margin-right: 4px;">Overall Sentiment:</span>
            <span class="badge ${cacheObj.overall_sentiment === 'Positive' ? 'badge-positive' : 'badge-neutral'}">${cacheObj.overall_sentiment}</span>
          </div>
          <div>
            <span class="text-muted" style="margin-right: 4px;">Sentiment Score:</span>
            <span class="text-green font-semibold">${cacheObj.sentiment_score}/100</span>
          </div>
        </div>

        <!-- Search and Filters row -->
        <div class="news-controls" style="display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-3.5);">
          <input type="text" id="news-search-input" placeholder="Search headlines..." style="width: 100%; font-size: 12px; background: var(--bg-card-alt); border: 1px solid var(--border-subtle); padding: 6px 10px; border-radius: 4px; color: var(--text-primary); outline: none;">
          <div class="filter-btn-group" style="display: flex; gap: var(--space-1.5);">
            <button class="btn btn-outline active" data-filter="All" style="font-size: 10px; padding: 3px 6px; flex: 1;">All</button>
            <button class="btn btn-outline" data-filter="Positive" style="font-size: 10px; padding: 3px 6px; flex: 1; color: var(--accent-green);">Pos</button>
            <button class="btn btn-outline" data-filter="Neutral" style="font-size: 10px; padding: 3px 6px; flex: 1;">Neu</button>
            <button class="btn btn-outline" data-filter="Negative" style="font-size: 10px; padding: 3px 6px; flex: 1; color: var(--accent-red);">Neg</button>
          </div>
        </div>

        <!-- Articles list -->
        <div class="news-list" id="filtered-news-list" style="flex: 1; overflow-y: auto; max-height: 400px; display: flex; flex-direction: column; gap: var(--space-3); padding-right: 4px;">
          <!-- Dynamically filtered articles -->
        </div>
      </div>
    `;
  }

  bindEvents() {
    const searchInput = document.getElementById('news-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.filterAndRenderArticles();
      });
    }

    const filterBtns = this.container.querySelectorAll('.filter-btn-group button');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.activeFilter = e.target.dataset.filter;
        this.filterAndRenderArticles();
      });
    });

    const refreshBtn = document.getElementById('news-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.handleManualRefresh();
      });
    }
  }

  handleManualRefresh() {
    const cacheKey = `market_news_cache_${this.currentTicker}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const diff = Date.now() - parsed.timestamp;
        const remaining = 15 * 60 * 1000 - diff;
        
        if (remaining > 0) {
          const secs = Math.ceil(remaining / 1000);
          const mins = Math.floor(secs / 60);
          const remSecs = secs % 60;
          alert(`News feed is up-to-date. Cache refreshes in ${mins}m ${remSecs}s.`);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Refresh content (re-draw and update cache timestamp)
    alert('Refreshing company news feed...');
    const resultStr = sessionStorage.getItem('analysis_result');
    if (resultStr) {
      try {
        const parsed = JSON.parse(resultStr);
        this.render(parsed.news);
      } catch (e) {
        console.error(e);
      }
    }
  }

  filterAndRenderArticles() {
    const listContainer = document.getElementById('filtered-news-list');
    if (!listContainer) return;

    const filtered = this.articles.filter(art => {
      const matchSearch = art.headline.toLowerCase().includes(this.searchQuery);
      const matchFilter = this.activeFilter === 'All' || art.sentiment === this.activeFilter;
      return matchSearch && matchFilter;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 24px 0;">
          No recent news available for this company.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(art => {
      let badgeClass = 'badge-neutral';
      if (art.sentiment === 'Positive') badgeClass = 'badge-positive';
      else if (art.sentiment === 'Negative') badgeClass = 'badge-negative';

      return `
        <div class="news-card-item" style="background: var(--bg-card-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <a class="news-item-headline" href="${art.url}" target="_blank" style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); text-decoration: none; line-height: 1.4; flex: 1;">${art.headline}</a>
            <span class="badge ${badgeClass}" style="font-size: 9px; padding: 2px 6px; flex-shrink: 0;">${art.sentiment}</span>
          </div>
          
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${art.summary}
          </div>

          <div style="font-size: 11px; font-weight: 500; color: var(--accent-orange); border-top: 1px dashed var(--border-subtle); padding-top: 6px; display: flex; justify-content: space-between;">
            <span>Category: <b>${art.category}</b></span>
            <span>Impact: <b>${art.impact}</b></span>
          </div>

          <div class="news-item-meta" style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); margin-top: 2px;">
            <div class="news-meta-left" style="display: flex; align-items: center; gap: 6px;">
              <span class="news-source" style="font-weight: 600;">${art.source}</span>
              <span>•</span>
              <span>${art.publishedTime}</span>
            </div>
            <a href="${art.url}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 2px;">
              Read More
              <svg class="lucide lucide-arrow-up-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }
}
