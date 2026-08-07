/**
 * trend_chart.js
 * ==============
 * Renders the ECharts Combo Chart (Bar + Line) for multi-year historical financial performance trends.
 */

export class TrendChart {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.chart = null;
  }

  render(trendData) {
    if (!this.container) return;

    if (this.chart) {
      this.chart.dispose();
    }

    this.chart = echarts.init(this.container);

    const years = trendData.years || ["2022", "2023", "2024"];
    const revenue = trendData.revenue || [];
    const profit = trendData.net_profit || [];
    const ocf = trendData.operating_cash_flow || [];

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: '#1e293b',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: {
          color: '#f8fafc',
          fontSize: 12
        }
      },
      legend: {
        data: ['Revenue', 'Net Profit', 'Operating Cash Flow'],
        bottom: 0,
        textStyle: {
          color: '#94a3b8',
          fontSize: 10
        },
        itemWidth: 12,
        itemHeight: 8
      },
      grid: {
        top: '12%',
        left: '2%',
        right: '2%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)'
          }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: function (value) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
            return value;
          }
        }
      },
      series: [
        {
          name: 'Revenue',
          type: 'bar',
          data: revenue,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 24,
          label: {
            show: true,
            position: 'top',
            color: '#cbd5e1',
            fontSize: 9,
            formatter: function (params) {
              return params.value ? params.value.toLocaleString() : '';
            }
          }
        },
        {
          name: 'Net Profit',
          type: 'bar',
          data: profit,
          itemStyle: {
            color: '#10b981',
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 24,
          label: {
            show: true,
            position: 'top',
            color: '#10b981',
            fontSize: 9,
            formatter: function (params) {
              return params.value ? params.value.toLocaleString() : '';
            }
          }
        },
        {
          name: 'Operating Cash Flow',
          type: 'line',
          data: ocf,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          itemStyle: {
            color: '#f59e0b'
          },
          lineStyle: {
            width: 2,
            shadowColor: 'rgba(245, 158, 11, 0.3)',
            shadowBlur: 8
          },
          label: {
            show: true,
            position: 'top',
            color: '#f59e0b',
            fontSize: 9,
            formatter: function (params) {
              return params.value ? params.value.toLocaleString() : '';
            }
          }
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
