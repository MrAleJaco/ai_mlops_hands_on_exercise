import { BarChart, BoxplotChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

// Only the pieces the four figures need: the full `echarts` entry point is
// ~1.4 MB, this set is roughly a third of that.
echarts.use([
  BarChart,
  BoxplotChart,
  CustomChart,
  LineChart,
  ScatterChart,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
])

interface ChartProps {
  option: EChartsOption
  height?: number
  label: string
}

/**
 * One canvas per chart. ECharts is initialised once, resized with the
 * container and disposed on unmount; options are replaced (not merged) so a
 * deselected series cannot linger from a previous call.
 */
export function Chart({ option, height = 360, label }: ChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!container.current) return
    const chart = echarts.init(container.current, undefined, { renderer: 'canvas' })
    instance.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      instance.current = null
    }
  }, [])

  useEffect(() => {
    instance.current?.setOption(option, true)
  }, [option])

  return <div ref={container} className="chart" style={{ height }} role="img" aria-label={label} />
}
