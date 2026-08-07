/**
 * recommendation.js
 * =================
 * Renders the rebuilt Multi-Factor Investment Recommendation widget with
 * overall weighted score (0-100), factor breakdown, risk level, and rationale.
 */

export class Recommendation {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(recData) {
    if (!this.container) return;

    let starsHtml = '';
    const fullStars = Math.floor(recData.stars || 0);
    const hasHalf = (recData.stars % 1) !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        starsHtml += `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        `;
      } else if (i === fullStars && hasHalf) {
        starsHtml += `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <defs>
              <linearGradient id="halfGrad">
                <stop offset="50%" stop-color="var(--accent-yellow)"/>
                <stop offset="50%" stop-color="rgba(255,255,255,0.1)"/>
              </linearGradient>
            </defs>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#halfGrad)"/>
          </svg>
        `;
      } else {
        starsHtml += `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        `;
      }
    }

    const contributing = recData.contributing_metrics || [];
    const contributingHtml = contributing.map(item => `
      <div style="display:flex; justify-content:space-between; font-size:11px; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="color:var(--text-secondary);">${item.factor}</span>
        <span style="font-weight:600; color:var(--text-primary);">${item.score}</span>
      </div>
    `).join('');

    const recommendationText = recData.recommendation || 'HOLD';
    const recColor = recommendationText.includes("BUY") ? "var(--accent-green)" : (recommendationText.includes("SELL") ? "var(--accent-red)" : "var(--accent-yellow)");

    // Clean up formats
    const targetPrice = recData.target_price_12m || 'Not Available';
    const currentPrice = recData.current_price || 'Not Available';
    const upsideVal = recData.upside_potential || 'Not Available';
    const upsideClass = upsideVal.toString().includes("-") ? "text-red" : "text-green";
    const upsidePrefix = (upsideVal === 'Not Available' || upsideVal.toString().includes("-") || upsideVal.toString().includes("+")) ? "" : "+";

    this.container.innerHTML = `
      <div class="card-title">Investment Recommendation</div>
      
      <div class="recommendation-card h-full">
        <!-- Badge, Stars, Overall Score, and Confidence -->
        <div class="rec-badge-container" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div>
            <span class="decision-value" style="color:${recColor}; font-size:22px; font-weight:700;">${recommendationText}</span>
            <div style="font-size:11px; color:var(--text-muted);">Score: <strong style="color:var(--text-primary);">${recData.overall_score || 75}/100</strong></div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <div class="rec-stars">${starsHtml}</div>
            <span class="rec-confidence text-muted" style="font-size:11px;">Confidence: <span class="text-green font-semibold">${recData.confidence || 90}%</span></span>
          </div>
        </div>

        <!-- Rationale paragraph -->
        <p class="rec-rationale" style="font-size:12px; margin:8px 0; color:var(--text-secondary);">${recData.rationale || 'Fundamentals-driven multi-factor assessment.'}</p>

        <!-- Multi-Factor Contributing Breakdown -->
        <div style="background:var(--bg-card-alt); border:1px solid var(--border-subtle); border-radius:6px; padding:8px; margin-bottom:8px;">
          <div style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Weighted Factor Breakdown</div>
          ${contributingHtml}
        </div>

        <!-- Stats Grid -->
        <div class="rec-grid">
          <div class="rec-item">
            <span class="field-label">Target Price (12M)</span>
            <span class="rec-item-val">${targetPrice}</span>
          </div>
          <div class="rec-item">
            <span class="field-label">Current Price</span>
            <span class="rec-item-val">${currentPrice}</span>
          </div>
          <div class="rec-item">
            <span class="field-label">Upside Potential</span>
            <span class="rec-item-val ${upsideClass}">${upsidePrefix}${upsideVal}</span>
          </div>
          <div class="rec-item">
            <span class="field-label">Risk Level</span>
            <span class="badge badge-hold" style="padding:2px 6px; font-size:10px;">${recData.risk_level || 'Moderate'}</span>
          </div>
        </div>

        <a class="card-link" href="#" style="margin-top:8px;">
          View detailed multi-factor recommendation
          <svg class="lucide lucide-arrow-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    `;
  }
}
