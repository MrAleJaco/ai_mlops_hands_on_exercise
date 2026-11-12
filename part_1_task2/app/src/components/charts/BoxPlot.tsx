import type { EChartsOption } from 'echarts'
import type { BoxStats } from '../../api/types'
import { compact } from '../../lib/format'
import { colors } from '../../lib/palette'
import { Chart } from '../Chart'

export interface BoxSeries {
  label: string
  stats: BoxStats
  color: string
}

/**
 * The Figure 1 box plot: five-number summary from the API plus the outlier
 * points sent separately (capped, but the count in the tooltip is exact).
 */
export function boxPlotOption(series: BoxSeries[], logAxis = false): EChartsOption {
  return {
    animation: false,
    grid: { left: 60, right: 24, top: 28, bottom: 42 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const data = params as unknown as {
          seriesName: string
          value: number[] | number
          seriesType: string
        }
        if (data.seriesType === 'boxplot' && Array.isArray(data.value)) {
          const [low, q1, median, q3, high] = data.value
          return [
            `<strong>${data.seriesName}</strong>`,
            `min ${compact(low)} · q1 ${compact(q1)}`,
            `median ${compact(median)}`,
            `q3 ${compact(q3)} · max ${compact(high)}`,
          ].join('<br/>')
        }
        return `${data.seriesName}: ${compact(Number(data.value))}`
      },
    },
    xAxis: {
      type: 'category',
      data: series.map((item) => item.label),
      axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: logAxis ? 'log' : 'value',
      logBase: 10,
      min: logAxis ? 0.5 : undefined,
      axisLabel: { formatter: (value: number) => compact(value), fontSize: 10 },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: series.flatMap((item, index) => {
      const points = logAxis
        ? item.stats.outliers.points.filter((value) => value > 0)
        : item.stats.outliers.points
      return [
        {
          type: 'boxplot' as const,
          name: item.label,
          data: [
            [
              item.stats.whisker_low,
              item.stats.q1,
              item.stats.median,
              item.stats.q3,
              item.stats.whisker_high,
            ],
          ],
          itemStyle: { color: item.color, borderColor: item.color, opacity: 0.75 },
          boxWidth: [10, 42],
        },
        {
          type: 'scatter' as const,
          name: `${item.label} outliers`,
          data: points.map((value) => [index, value]),
          symbolSize: 3,
          itemStyle: { color: item.color, opacity: 0.35 },
          silent: true,
          z: 3,
        },
      ]
    }),
  }
}

export function BoxPlotChart({
  series,
  height = 340,
  logAxis = false,
  label,
}: {
  series: BoxSeries[]
  height?: number
  logAxis?: boolean
  label: string
}) {
  return <Chart option={boxPlotOption(series, logAxis)} height={height} label={label} />
}
