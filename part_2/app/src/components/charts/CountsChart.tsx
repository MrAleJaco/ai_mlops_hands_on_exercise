import type { EChartsOption } from 'echarts'
import type { Level } from '../../api/types'
import { boxFromValues, outliers } from '../../lib/stats'
import { colors } from '../../lib/palette'
import { Chart } from '../Chart'

/** Figure 1, categorical half: category counts as horizontal bars. */
export function countsBarOption(levels: Level[], logAxis: boolean, column: string): EChartsOption {
  return {
    animation: false,
    grid: { left: 8, right: 90, top: 16, bottom: 34, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (params) =>
        (params as unknown as { name: string; value: number }).name +
        ': ' +
        Number((params as unknown as { value: number }).value).toLocaleString('en-US') +
        ' rows',
    },
    xAxis: {
      type: logAxis ? 'log' : 'value',
      logBase: 10,
      min: logAxis ? 1 : 0,
      name: logAxis ? 'rows in category (log)' : 'rows in category',
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 9, formatter: (value: number) => value.toLocaleString('en-US') },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: 'category',
      data: levels.map((level) => level.label),
      axisTick: { show: false },
      axisLabel: { fontSize: 9, width: 110, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar' as const,
        name: column,
        barWidth: 10,
        data: levels.map((level) => ({
          value: level.count,
          itemStyle: { color: colors.categorical },
          label: {
            show: levels.length <= 20,
            position: 'right' as const,
            fontSize: 9,
            color: colors.text,
            formatter: level.count.toLocaleString('en-US'),
          },
        })),
      },
    ],
  }
}

/**
 * Figure 1 as drawn in the design: a box plot of the *category counts*, so a
 * rare level appears as a flier. Log axis where counts span 100x.
 */
export function countsBoxOption(levels: Level[], logAxis: boolean, column: string): EChartsOption {
  const counts = levels.map((level) => level.count)
  const box = boxFromValues(counts)
  const fliers = outliers(counts)

  return {
    animation: false,
    grid: { left: 60, right: 30, top: 28, bottom: 50 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const data = params as unknown as { seriesType: string; value: number[] | number }
        if (data.seriesType === 'boxplot' && Array.isArray(data.value)) {
          const [low, q1, median, q3, high] = data.value
          return [
            `<strong>${column}: ${levels.length} category counts</strong>`,
            `min ${low} · q1 ${q1}`,
            `median ${median}`,
            `q3 ${q3} · max ${high}`,
          ].join('<br/>')
        }
        return `${Number(data.value).toLocaleString('en-US')} rows in this category`
      },
    },
    xAxis: {
      type: 'category',
      data: [column],
      axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: logAxis ? 'log' : 'value',
      logBase: 10,
      min: logAxis ? 0.5 : 0,
      name: logAxis ? 'rows in category (log)' : 'rows in category',
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10, formatter: (value: number) => value.toLocaleString('en-US') },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        type: 'boxplot' as const,
        name: column,
        data: box ? [box] : [],
        itemStyle: { color: colors.categorical, borderColor: colors.categorical, opacity: 0.75 },
        boxWidth: [14, 46],
      },
      {
        type: 'scatter' as const,
        name: 'rare levels',
        data: fliers.filter((value) => value > 0).map((value) => [0, value]),
        symbolSize: 5,
        itemStyle: { color: colors.categorical, opacity: 0.7 },
      },
    ],
  }
}

export function CountsChart({
  levels,
  column,
  mode,
  logAxis,
  height = 340,
}: {
  levels: Level[]
  column: string
  mode: 'bars' | 'box'
  logAxis: boolean
  height?: number
}) {
  const option = mode === 'bars' ? countsBarOption(levels, logAxis, column) : countsBoxOption(levels, logAxis, column)
  return <Chart option={option} height={height} label={`Category counts for ${column}`} />
}
