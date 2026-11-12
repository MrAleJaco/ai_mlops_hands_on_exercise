import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { distribution, filterOptions, highlights, meta, tablePage } from './fixtures'

// ECharts needs a real canvas, which jsdom does not provide; the pages are
// tested through the props they hand to the chart wrapper instead.
vi.mock('../components/Chart', () => ({
  Chart: ({ label }: { label: string }) => <div data-testid="chart" aria-label={label} />,
}))

const routes: Record<string, unknown> = {
  '/api/filters': filterOptions,
  '/api/meta': meta,
  '/api/highlights': highlights,
  '/api/distribution': distribution,
  '/api/table': tablePage,
}

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), 'http://localhost')
  const body = routes[url.pathname]
  if (body === undefined) {
    return Promise.resolve(
      new Response(JSON.stringify({ detail: `no fixture for ${url.pathname}` }), { status: 404 }),
    )
  }
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

function renderApp(entry = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Overview', () => {
  it('renders the KPIs and the four claims from the API', async () => {
    renderApp('/')

    expect(await screen.findByText('High earners (>50K)')).toBeInTheDocument()
    expect(screen.getAllByText('48,790').length).toBeGreaterThan(0)
    expect(screen.getByText('23.9%')).toBeInTheDocument()
    expect(screen.getByText('91.7% of capital-gain rows are zero.')).toBeInTheDocument()
    expect(screen.getByText('marital-status separates the classes.')).toBeInTheDocument()
  })

  it('writes the selection to the URL and refetches', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await screen.findByText('High earners (>50K)')

    await user.click(screen.getByRole('button', { name: '>50K' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes('income=1')),
      ).toBe(true)
    })
  })
})

describe('Distribution', () => {
  it('draws the selected numeric column and lists its stats', async () => {
    renderApp('/distribution')

    expect(await screen.findByLabelText('Box plot of age')).toBeInTheDocument()
    expect(screen.getAllByText('Median').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outliers').length).toBeGreaterThan(0)
  })
})

describe('Processed data', () => {
  it('renders the encoded table preview', async () => {
    renderApp('/data')

    expect(await screen.findByRole('heading', { name: 'Encoded table', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('age')).toBeInTheDocument()
    expect(await screen.findByText('39')).toBeInTheDocument()
  })
})
