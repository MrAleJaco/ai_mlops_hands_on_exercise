import type {
  BoxStats,
  Distribution,
  FilterOptions,
  Highlights,
  Meta,
  TablePage,
} from '../api/types'

const stats = (n: number): BoxStats => ({
  n,
  min: 0,
  whisker_low: 0,
  q1: 1,
  median: 2,
  q3: 3,
  whisker_high: 4,
  max: 5,
  mean: 2.5,
  outliers: { count: 0, share: 0, points: [] },
})

export const meta: Meta = {
  rows: 48790,
  total_rows: 48790,
  raw_rows: 48842,
  raw_columns: 15,
  duplicates_dropped: 52,
  encoded_shape: [48790, 93],
  unknown_rows: 3615,
  unknown_share: 7.41,
  target: { name: 'income', labels: { '0': '<=50K', '1': '>50K' }, positive_share: 23.94, positive_rows: 11687 },
  numeric_columns: ['age', 'fnlwgt', 'education-num', 'capital-gain', 'capital-loss', 'hours-per-week'],
  categorical_columns: ['workclass', 'marital-status', 'occupation', 'relationship', 'race', 'sex', 'native-country'],
  dropped_columns: ['education'],
  level_counts: { workclass: 9, 'marital-status': 7, occupation: 15, relationship: 6, race: 5, sex: 2, 'native-country': 42 },
  palette: { low: '#2E6F9E', high: '#C0392B' },
  filters_applied: {},
  rows_after_filter: 48790,
  issues: [{ title: 'Padded headers and cells', detail: 'All 15 raw columns except age start with a space.' }],
}

export const filterOptions: FilterOptions = {
  sex: ['Female', 'Male'],
  workclass: ['Private', 'Self-emp-not-inc'],
  'native-country': [{ label: 'United-States', count: 43782 }],
  age: { min: 17, max: 90 },
  hours: { min: 1, max: 99 },
  income: [
    { value: 0, label: '<=50K' },
    { value: 1, label: '>50K' },
  ],
}

export const highlights: Highlights = {
  rows: 48790,
  claims: [
    { figure: '01_distribution.png', title: 'Distribution', claim: '91.7% of capital-gain rows are zero.' },
    { figure: '02_target_vs_numeric.png', title: 'Target vs numeric', claim: 'education-num shifts most.' },
    { figure: '03_target_vs_categorical.png', title: 'Target vs categorical', claim: 'marital-status separates the classes.' },
    { figure: '04_relation_numeric.png', title: 'Relations', claim: 'capital-gain sits on a hard cap.' },
  ],
}

export const distribution: Distribution = {
  rows: 48790,
  numeric: ['age', 'fnlwgt', 'education-num', 'capital-gain', 'capital-loss', 'hours-per-week'].map((column) => ({
    column,
    ...stats(48790),
  })),
  categorical: [
    {
      column: 'sex',
      levels: [
        { label: 'Male', count: 32650, share: 66.9 },
        { label: 'Female', count: 16140, share: 33.1 },
      ],
      level_count: 2,
      rarest: { label: 'Female', count: 16140, share: 33.1 },
      commonest: { label: 'Male', count: 32650, share: 66.9 },
      log_axis: false,
    },
  ],
}

export const tablePage: TablePage = {
  columns: ['age', 'income'],
  rows: [
    [39, 0],
    [50, 1],
  ],
  total_rows: 48790,
  page: 1,
  size: 25,
  pages: 1952,
  target_column: 'income',
}
