/**
 * radar_chart.js
 * ==============
 * Renders the ECharts Radar Chart for Financial Health Breakdowns.
 */

export class RadarChart {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.chart = null;
  }

  render(healthData, companyName = 'Company') {
    if (!this.container) return;

    if (this.chart) {
      this.chart.dispose();
    }

    this.chart = echarts.init(this.container);

    // Extract short name (first two words or full name if short)
    const shortName = companyName.split(' ').slice(0, 2).join(' ');

    const targetData = [
      healthData.liquidity || 0,
      healthData.profitability || 0,
      healthData.efficiency || 0,
      healthData.growth || 0,
      healthData.leverage || 0
    ];

    const industryData = [
      healthData.industry_avg?.liquidity || 0,
      healthData.industry_avg?.profitability || 0,
      healthData.industry_avg?.efficiency || 0,
      healthData.industry_avg?.growth || 0,
      healthData.industry_avg?.leverage || 0
    ];

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1e293b',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: {
          color: '#f8fafc',
          fontSize: 12
        }
      },
      legend: {
        data: [shortName, 'Industry Avg.'],
        bottom: 0,
        textStyle: {
          color: '#94a3b8',
          fontSize: 10
        },
        itemWidth: 12,
        itemHeight: 8
      },
      radar: {
        indicator: [
          { name: 'Liquidity', max: 100 },
          { name: 'Profitability', max: 100 },
          { name: 'Efficiency', max: 100 },
          { name: 'Growth', max: 100 },
          { name: 'Leverage', max: 100 }
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#94a3b8',
          fontSize: 10,
          fontWeight: 'medium'
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        },
        splitArea: {
          show: false
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        }
      },
      series: [
        {
          name: 'Financial Health Breakdown',
          type: 'radar',
          data: [
            {
              value: targetData,
              name: shortName,
              itemStyle: {
                color: '#3b82f6'
              },
              lineStyle: {
                width: 2
              },
              areaStyle: {
                color: 'rgba(59, 130, 246, 0.25)'
              }
            },
            {
              value: industryData,
              name: 'Industry Avg.',
              itemStyle: {
                color: '#64748b'
              },
              lineStyle: {
                type: 'dashed',
                width: 1.5
              },
              areaStyle: {
                color: 'transparent'
              }
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
