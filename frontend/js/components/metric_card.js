/**
 * metric_card.js
 * ==============
 * Renders individual metric cards and builds the embedded sparkline
 * charts using Apache ECharts.
 */

export class MetricCard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.charts = [];
  }

  render(metricsData) {
    if (!this.container) return;

    let html = '';
    const keys = Object.keys(metricsData);

    keys.forEach((key, idx) => {
      const metric = metricsData[key];
      const changeClass = metric.change >= 0 ? 'change-positive' : 'change-negative';
      const changeIcon = metric.change >= 0 
        ? `<svg class="lucide lucide-trending-up" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`
        : `<svg class="lucide lucide-trending-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:2px;"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;

      html += `
        <div class="card kpi-card animate-fade-in stagger-${idx + 1}">
          <div class="kpi-title">${metric.label}</div>
          <div class="kpi-value-container">
            <div class="kpi-value">${metric.formatted}</div>
            <div class="kpi-meta">
              <span class="${changeClass}">
                ${changeIcon}${metric.change_label}
              </span>
              <span class="kpi-change-period">${metric.change_period}</span>
            </div>
          </div>
          <div class="kpi-sparkline-container" id="sparkline-${key}"></div>
        </div>
      `;
    });

    this.container.innerHTML = html;

    // Wait for the next tick to ensure containers are loaded in DOM
    setTimeout(() => {
      keys.forEach(key => {
        const metric = metricsData[key];
        this.initSparkline(key, metric.sparkline, metric.color);
      });
    }, 50);
  }

  initSparkline(key, dataPoints, color) {
    const el = document.getElementById(`sparkline-${key}`);
    if (!el) return;

    // Destroy existing chart if it exists
    const existing = echarts.getInstanceByDom(el);
    if (existing) {
      existing.dispose();
    }

    const chart = echarts.init(el);
    const option = {
      grid: {
        left: 0,
        right: 0,
        top: 2,
        bottom: 2
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        show: false
      },
      yAxis: {
        type: 'value',
        show: false
      },
      series: [
        {
          data: dataPoints,
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: color || '#3b82f6',
            width: 1.5
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: color ? `${color}25` : 'rgba(59, 130, 246, 0.15)'
              },
              {
                offset: 1,
                color: 'transparent'
              }
            ])
          }
        }
      ]
    };

    chart.setOption(option);
    this.charts.push(chart);
  }

  resize() {
    this.charts.forEach(chart => {
      try {
        chart.resize();
      } catch (e) {
        // Suppress resizing errors for unmounted nodes
      }
    });
  }
}
