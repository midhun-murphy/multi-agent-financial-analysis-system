/**
 * competitor_table.js
 * ===================
 * Renders the competitor comparison table widget using canonical normalized values.
 */

export class CompetitorTable {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(competitors) {
    if (!this.container) return;

    let rowsHtml = '';

    (competitors || []).forEach(comp => {
      const rowClass = comp.is_target ? 'row-target' : '';
      const nameCell = comp.is_target 
        ? `<a href="#">${comp.name} *</a>`
        : comp.name;

      const revDisplay = typeof comp.revenue === 'number' ? comp.revenue.toLocaleString() : (comp.revenue || 'N/A');
      const roeDisplay = typeof comp.roe === 'number' ? `${comp.roe.toFixed(2)}%` : (comp.roe || 'N/A');
      const marginDisplay = typeof comp.ebitda_margin === 'number' ? `${comp.ebitda_margin.toFixed(2)}%` : (comp.ebitda_margin || 'N/A');

      rowsHtml += `
        <tr class="${rowClass}">
          <td>${nameCell}</td>
          <td>${revDisplay}</td>
          <td>${roeDisplay}</td>
          <td>${marginDisplay}</td>
          <td>${comp.pe || 'N/A'}</td>
        </tr>
      `;
    });

    this.container.innerHTML = `
      <div class="card-title">Competitor Comparison</div>
      <div class="competitor-table-container">
        <table class="competitor-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Revenue</th>
              <th>ROE</th>
              <th>EBITDA Margin</th>
              <th>P/E (x)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <a class="card-link" href="competitor.html">
        View detailed competitor analysis
        <svg class="lucide lucide-arrow-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
    `;
  }
}
