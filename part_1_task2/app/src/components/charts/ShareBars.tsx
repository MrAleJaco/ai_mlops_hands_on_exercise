import type { EChartsOption } from 'echarts'
import type { CategoryLevel } from '../../api/types'
import { colors } from '../../lib/palette'
import { Chart } from '../Chart'

/**
 * Figure 3: share of high earners inside every category.
 *
 * The 95% Wilson interval is drawn as a custom series because a bar alone
 * hides the thin categories (France: 42.1% on 38 rows). The bar label keeps
 * the n, as in the PNG.
 */
export function shareBarsOption(levels: CategoryLevel[], overall: number): EChartsOption {
  const highest = Math.max(...levels.map((level) => level.share), overall, 10)
  const max = Math.ceil((highest * 1.3) / 5) * 5
  const reference = {
    xAxis: overall,
    label: { formatter: `overall ${overall.toFixed(1)}%`, fontSize: 10, color: colors.reference },
  }

  return {
    animation: false,
    grid: { left: 8, right: 110, top: 16, bottom: 30, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const item = params as unknown as { name: string; dataIndex: number }
        const level = levels[item.dataIndex]
        if (!level) return ''
        return [
          `<strong>${level.label}</strong>`,
          `${level.share.toFixed(1)}% earn more than 50K`,
          `n = ${level.n.toLocaleString('en-US')}`,
          `95% interval ${level.ci_low.toFixed(1)}% – ${level.ci_high.toFixed(1)}%`,
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'value',
      max,
      axisLabel: { formatter: '{value}%', fontSize: 10 },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      type: 'category',
      data: levels.map((level) => level.label),
      axisTick: { show: false },
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        type: 'bar' as const,
        name: 'share above 50K',
        barWidth: 12,
        data: levels.map((level) => ({
          value: Number(level.share.toFixed(2)),
          itemStyle: { color: colors.numeric },
          label: {
            show: true,
            position: 'right' as const,
            fontSize: 9.5,
            color: colors.text,
            formatter: `${level.share.toFixed(0)}% (n=${level.n.toLocaleString('en-US')})`,
          },
        })),
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: { color: colors.reference, type: 'dashed' as const, width: 1 },
          data: [reference],
        },
      },
      {
        type: 'custom' as const,
        name: '95% interval',
        silent: true,
        z: 5,
        encode: { x: [1, 2], y: 0 },
        data: levels.map((level, index) => [index, level.ci_low, level.ci_high]),
        renderItem: (_params, api) => {
          const low = api.coord([api.value(1) as number, api.value(0) as number])
          const high = api.coord([api.value(2) as number, api.value(0) as number])
          const y = api.coord([0, api.value(0) as number])[1]
          return {
            type: 'line',
            shape: { x1: low[0], y1: y, x2: high[0], y2: y },
            style: { stroke: '#6B7280', lineWidth: 1.5 },
          }
        },
      },
    ],
  }
}

export function ShareBarsChart({
  levels,
  overall,
  height,
  label,
}: {
  levels: CategoryLevel[]
  overall: number
  height: number
  label: string
}) {
  return <Chart option={shareBarsOption(levels, overall)} height={height} label={label} />
}
