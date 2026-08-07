/**
 * risk_panel.js
 * =============
 * Renders the Risk Analysis panel with animated colored progress bars.
 */

export class RiskPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(riskData) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="card-title">
        <div class="card-title-left">
          <svg class="lucide lucide-shield-alert" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px; color:var(--accent-orange);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          Risk Analysis <span class="card-subtitle">(Overall: ${riskData.overall || 'Moderate'})</span>
        </div>
      </div>
      
      <div class="risk-panel h-full">
        <div class="risk-list">
          ${this.getRiskBar('Liquidity Risk', riskData.liquidity)}
          ${this.getRiskBar('Debt Risk', riskData.debt)}
          ${this.getRiskBar('Operational Risk', riskData.operational)}
          ${this.getRiskBar('Market Risk', riskData.market)}
          ${this.getRiskBar('Regulatory Risk', riskData.regulatory)}
        </div>

        <div class="risk-footer-note">
          <svg class="lucide lucide-info" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
          <span>${riskData.summary || ''}</span>
        </div>
      </div>
    `;

    // Animate the widths after rendering
    setTimeout(() => {
      this.animateBars(riskData);
    }, 100);
  }

  getRiskBar(label, score = 50) {
    const safeId = label.toLowerCase().replace(/\s+/g, '-');
    return `
      <div class="risk-item-row">
        <div class="risk-item-info">
          <span class="risk-item-label">${label}</span>
          <span class="risk-item-score" id="risk-score-text-${safeId}">0/100</span>
        </div>
        <div class="risk-bar-track">
          <div class="risk-bar-fill" id="risk-bar-${safeId}"></div>
        </div>
      </div>
    `;
  }

  animateBars(riskData) {
    const dimensions = [
      { name: 'Liquidity Risk', val: riskData.liquidity },
      { name: 'Debt Risk', val: riskData.debt },
      { name: 'Operational Risk', val: riskData.operational },
      { name: 'Market Risk', val: riskData.market },
      { name: 'Regulatory Risk', val: riskData.regulatory }
    ];

    dimensions.forEach(dim => {
      const safeId = dim.name.toLowerCase().replace(/\s+/g, '-');
      const bar = document.getElementById(`risk-bar-${safeId}`);
      const text = document.getElementById(`risk-score-text-${safeId}`);

      if (bar && text) {
        // Set final score width
        bar.style.width = `${dim.val}%`;
        
        // Apply coloring based on threshold limits
        let colorClass = 'risk-bg-low';
        let textStyle = 'var(--risk-low)';

        if (dim.val > 65) {
          colorClass = 'risk-bg-high';
          textStyle = 'var(--risk-high)';
        } else if (dim.val > 45) {
          colorClass = 'risk-bg-moderate';
          textStyle = 'var(--risk-moderate)';
        }
        
        bar.className = `risk-bar-fill ${colorClass}`;
        text.style.color = textStyle;

        // Animate count upward
        let current = 0;
        const interval = setInterval(() => {
          if (current >= dim.val) {
            text.textContent = `${dim.val}/100`;
            clearInterval(interval);
          } else {
            current += Math.ceil((dim.val - current) / 4);
            if (current >= dim.val) current = dim.val;
            text.textContent = `${current}/100`;
          }
        }, 30);
      }
    });
  }
}
