import type { EChartsOption } from 'echarts'
import type { Relation } from '../../api/types'
import { classes, colors } from '../../lib/palette'
import { Chart } from '../Chart'

/** Figure 4, one enlarged pair: every row, coloured by class. */
export function scatterOption(data: Relation, logX = false, logY = false): EChartsOption {
  return {
    animation: false,
    grid: { left: 64, right: 24, top: 34, bottom: 58 },
    legend: { top: 0, icon: 'circle', itemWidth: 8 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const item = params as unknown as { seriesName: string; value: number[] }
        return `${item.seriesName}<br/>${data.x}: ${item.value[0]}<br/>${data.y}: ${item.value[1]}`
      },
    },
    dataZoom: [
      { type: 'inside', filterMode: 'none' },
      { type: 'slider', height: 18, bottom: 10, filterMode: 'none' },
    ],
    xAxis: {
      type: logX ? 'log' : 'value',
      logBase: 10,
      name: data.x,
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 10 },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: logY ? 'log' : 'value',
      logBase: 10,
      name: data.y,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 10 },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: data.classes.map((item) => {
      const colour = classes.find((entry) => entry.value === item.value)?.color ?? colors.numeric
      return {
        type: 'scatter' as const,
        name: item.label,
        data: item.points,
        symbolSize: 4,
        large: true,
        largeThreshold: 2000,
        itemStyle: { color: colour, opacity: 0.22 },
        emphasis: { itemStyle: { opacity: 0.7 } },
      }
    }),
  }
}

export function ScatterChart({
  data,
  logX = false,
  logY = false,
  height = 440,
}: {
  data: Relation
  logX?: boolean
  logY?: boolean
  height?: number
}) {
  return <Chart option={scatterOption(data, logX, logY)} height={height} label={`Scatter plot of ${data.x} against ${data.y}`} />
}
