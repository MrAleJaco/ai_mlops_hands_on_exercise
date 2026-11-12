/** Shapes returned by part_2/api - kept in sync by hand, small enough to read. */

export interface BoxStats {
  n: number
  min: number
  whisker_low: number
  q1: number
  median: number
  q3: number
  whisker_high: number
  max: number
  mean: number
  outliers: { count: number; share: number; points: number[] }
}

export interface NumericDistribution extends BoxStats {
  column: string
}

export interface Level {
  label: string
  count: number
  share: number
}

export interface CategoricalDistribution {
  column: string
  levels: Level[]
  level_count: number
  rarest: Level | null
  commonest: Level | null
  log_axis: boolean
}

export interface Distribution {
  rows: number
  numeric: NumericDistribution[]
  categorical: CategoricalDistribution[]
}

export interface DensityPoint {
  x: number
  y: number
}

export interface NumericClass {
  value: number
  label: string
  stats: BoxStats
  density: DensityPoint[]
}

export interface TargetNumeric {
  column: string
  classes: NumericClass[]
  median_shift: number | null
  overall: BoxStats
}

export interface CategoryLevel {
  label: string
  share: number
  n: number
  ci_low: number
  ci_high: number
}

export interface TargetCategorical {
  column: string
  overall_share: number
  levels: CategoryLevel[]
  hidden_below_min_n: number
  rows: number
}

export interface RelationClass {
  value: number
  label: string
  n: number
  points: number[][]
}

export interface Relation {
  x: string
  y: string
  classes: RelationClass[]
  sampled: boolean
  total_rows: number
}

export interface MatrixClass {
  value: number
  label: string
  points?: number[][]
  density?: DensityPoint[]
}

export interface MatrixPanel {
  row: number
  col: number
  kind: 'scatter' | 'density'
  classes: MatrixClass[]
}

export interface RelationMatrix {
  columns: string[]
  panels: MatrixPanel[]
  sampled: boolean
  cap_per_class: number
  total_rows: number
}

export interface TablePage {
  columns: string[]
  rows: (string | number)[][]
  total_rows: number
  page: number
  size: number
  pages: number
  target_column: string
}

export interface Claim {
  figure: string
  title: string
  claim: string
}

export interface Highlights {
  rows: number
  claims: Claim[]
}

export interface Issue {
  title: string
  detail: string
}

export interface Meta {
  rows: number
  total_rows: number
  raw_rows: number
  raw_columns: number
  duplicates_dropped: number
  encoded_shape: [number, number] | null
  unknown_rows: number
  unknown_share: number
  target: {
    name: string
    labels: Record<string, string>
    positive_share: number
    positive_rows: number
  }
  numeric_columns: string[]
  categorical_columns: string[]
  dropped_columns: string[]
  level_counts: Record<string, number>
  palette: Record<string, string>
  filters_applied: Record<string, unknown>
  rows_after_filter: number
  issues: Issue[]
}

export interface FilterOptions {
  sex: string[]
  workclass: string[]
  'native-country': { label: string; count: number }[]
  age: { min: number; max: number }
  hours: { min: number; max: number }
  income: { value: number; label: string }[]
}
