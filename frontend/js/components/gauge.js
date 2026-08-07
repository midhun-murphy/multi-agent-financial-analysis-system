/**
 * gauge.js
 * ========
 * Renders the Financial Health Score radial gauge using Apache ECharts.
 */

export class Gauge {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.chart = null;
  }

  render(score = 72) {
    if (!this.container) return;

    // Destroy existing instance to prevent memory leaks
    if (this.chart) {
      this.chart.dispose();
    }

    this.chart = echarts.init(this.container);

    const option = {
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          splitNumber: 5,
          center: ['50%', '55%'],
          radius: '95%',
          pointer: {
            icon: 'path://M12.8,.7l12,85.3c.2,1.3-.7,2.5-2,2.5H1.2c-1.3,0-2.2-1.2-2-2.5L11.2,.7c.4-2.5,4-2.5,4.4,0z',
            length: '75%',
            width: 4,
            offsetCenter: [0, '5%'],
            itemStyle: {
              color: '#f8fafc'
            }
          },
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.35, '#ef4444'], // Red (0-35)
                [0.65, '#f59e0b'], // Yellow (35-65)
                [1.00, '#10b981']  // Green (65-100)
              ]
            }
          },
          axisTick: {
            distance: 2,
            length: 4,
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.2)',
              width: 1
            }
          },
          splitLine: {
            distance: 2,
            length: 8,
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.4)',
              width: 1.5
            }
          },
          axisLabel: {
            color: '#64748b',
            fontSize: 9,
            distance: 10
          },
          anchor: {
            show: true,
            showAbove: true,
            size: 12,
            itemStyle: {
              color: '#334155',
              borderColor: '#f8fafc',
              borderWidth: 2
            }
          },
          title: {
            show: false
          },
          detail: {
            valueAnimation: true,
            fontSize: 22,
            fontWeight: 'bold',
            color: '#f8fafc',
            offsetCenter: [0, '35%'],
            formatter: '{value}'
          },
          data: [
            {
              value: score,
              name: 'Health Score'
            }
          ]
        }
      ]
    };

    this.chart.setOption(option);
  }

  resize() {
    if (this.chart) {
      this.chart.resize();
    }
  }
}
