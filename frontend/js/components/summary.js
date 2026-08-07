/**
 * summary.js
 * ==========
 * Renders the Executive Summary narrative widget.
 */

export class Summary {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(summaryData) {
    if (!this.container) return;

    const paragraphsHtml = (summaryData.paragraphs || []).map(p => {
      return `<p class="summary-paragraph">${p}</p>`;
    }).join('');

    this.container.innerHTML = `
      <div class="card-title">Executive Summary</div>
      
      <div class="summary-card h-full">
        <div class="summary-content">
          ${paragraphsHtml}
        </div>
        
        <a class="card-link" href="#">
          View full executive summary
          <svg class="lucide lucide-arrow-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    `;
  }
}
