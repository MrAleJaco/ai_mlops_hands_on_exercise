import type { EChartsOption } from 'echarts'
import type { RelationMatrix } from '../../api/types'
import { classes, colors } from '../../lib/palette'
import { Chart } from '../Chart'

/**
 * Figure 4 as a single canvas: 21 panels laid out as a lower triangle.
 *
 * One ECharts instance with 21 grids, rather than 21 instances, keeps the
 * page responsive; points are sampled server-side (cap per class).
 */
export function matrixOption(data: RelationMatrix): EChartsOption {
  const columns = data.columns
  const n = columns.length
  const left = 6
  const top = 4
  const width = 13.4
  const height = 12.4
  const gapX = 15.6
  const gapY = 15.4

  const grids = data.panels.map((panel) => ({
    left: `${left + panel.col * gapX}%`,
    top: `${top + panel.row * gapY}%`,
    width: `${width}%`,
    height: `${height}%`,
  }))

  const xAxes = data.panels.map((panel, gridIndex) => ({
    type: 'value' as const,
    gridIndex,
    axisLabel: { show: panel.row === n - 1, fontSize: 8, formatter: (value: number) => Intl.NumberFormat('en-US', { notation: 'compact' }).format(value) },
    axisTick: { show: false },
    splitLine: { show: false },
    name: panel.row === n - 1 ? columns[panel.col] : '',
    nameLocation: 'middle' as const,
    nameGap: 18,
    nameTextStyle: { fontSize: 9, color: colors.axis },
  }))

  const yAxes = data.panels.map((panel, gridIndex) => ({
    type: 'value' as const,
    gridIndex,
    axisLabel: {
      show: panel.col === 0 && panel.kind === 'scatter',
      fontSize: 8,
      formatter: (value: number) => Intl.NumberFormat('en-US', { notation: 'compact' }).format(value),
    },
    axisTick: { show: false },
    splitLine: { show: false },
    name: panel.col === 0 && panel.kind === 'scatter' ? columns[panel.row] : '',
    nameLocation: 'middle' as const,
    nameGap: 30,
    nameRotate: 90,
    nameTextStyle: { fontSize: 9, color: colors.axis },
  }))

  const series = data.panels.flatMap((panel, gridIndex) =>
    panel.classes.map((item) => {
      const colour = classes.find((entry) => entry.value === item.value)?.color ?? colors.numeric
      if (panel.kind === 'density') {
        return {
          type: 'line' as const,
          name: item.label,
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          data: (item.density ?? []).map((point) => [point.x, point.y]),
          showSymbol: false,
          silent: true,
          lineStyle: { color: colour, width: 1 },
          itemStyle: { color: colour },
          areaStyle: { color: colour, opacity: 0.12 },
        }
      }
      return {
        type: 'scatter' as const,
        name: item.label,
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: item.points ?? [],
        symbolSize: 2.4,
        large: true,
        largeThreshold: 2000,
        itemStyle: { color: colour, opacity: 0.25 },
        silent: true,
      }
    }),
  )

  return {
    animation: false,
    legend: { top: 0, icon: 'circle', itemWidth: 8, data: ['<=50K', '>50K'] },
    xAxis: xAxes,
    yAxis: yAxes,
    grid: grids,
    series,
  }
}

export function ScatterMatrixChart({ data, height = 760 }: { data: RelationMatrix; height?: number }) {
  return <Chart option={matrixOption(data)} height={height} label="Scatter matrix of the numeric columns" />
}
