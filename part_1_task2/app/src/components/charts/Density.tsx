import type { EChartsOption } from 'echarts'
import type { DensityPoint } from '../../api/types'
import { Chart } from '../Chart'

interface DensitySeries {
  label: string
  color: string
  density: DensityPoint[]
}

/** Per-class density, so the 3:1 class imbalance cannot fool the eye. */
export function densityOption(series: DensitySeries[], xName: string): EChartsOption {
  return {
    animation: false,
    grid: { left: 20, right: 20, top: 34, bottom: 40, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    legend: { top: 0, data: series.map((item) => item.label), icon: 'roundRect', itemWidth: 12, itemHeight: 3 },
    xAxis: {
      type: 'value',
      name: xName,
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: 'value', name: 'density', nameTextStyle: { fontSize: 10 }, axisLabel: { show: false }, splitLine: { show: false } },
    series: series.map((item) => ({
      type: 'line' as const,
      name: item.label,
      data: item.density.map((point) => [point.x, point.y]),
      showSymbol: false,
      lineStyle: { color: item.color, width: 1.6 },
      itemStyle: { color: item.color },
      areaStyle: { color: item.color, opacity: 0.16 },
    })),
  }
}

export function DensityChart({ series, xName, height = 260 }: { series: DensitySeries[]; xName: string; height?: number }) {
  return <Chart option={densityOption(series, xName)} height={height} label={`Density of ${xName} by income class`} />
}
