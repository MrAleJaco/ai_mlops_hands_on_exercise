/**
 * End-to-end smoke check and report evidence.
 *
 * Opens every view of the deployed stack, waits for the API data, records
 * console/page errors and writes one screenshot per view to
 * part_2/reports/screenshots/. Run it against a live `docker compose up`:
 *
 *   npm run screenshots                 # http://localhost:8080
 *   APP_URL=http://localhost:5173 npm run screenshots
 */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = process.env.APP_URL ?? 'http://localhost:8080'
const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../../reports/screenshots')

const views = [
  { name: '01-overview', path: '/', ready: 'text=High earners (>50K)' },
  { name: '02-distribution', path: '/distribution', ready: 'text=Numerical columns' },
  { name: '03-target-numeric', path: '/target', ready: 'text=Median shift' },
  {
    name: '04-target-categorical',
    path: '/target',
    ready: 'text=Numerical columns',
    action: async (page) => {
      await page.getByRole('button', { name: 'Categorical columns' }).click()
      await page.waitForSelector('text=share earning more than 50K')
    },
  },
  { name: '05-correlations-matrix', path: '/correlations', ready: 'text=Lower triangle' },
  {
    name: '06-correlations-pair',
    path: '/correlations',
    ready: 'text=Scatter matrix',
    action: async (page) => {
      await page.getByRole('button', { name: 'One pair' }).click()
      await page.waitForSelector('text=age against education-num')
    },
  },
  { name: '07-processed-data', path: '/data', ready: 'text=Encoded table' },
]

const browser = await chromium.launch()
const errors = []

await mkdir(outDir, { recursive: true })

for (const view of views) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${view.name}: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`${view.name}: ${error.message}`))

  await page.goto(`${base}${view.path}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(view.ready, { timeout: 15000 })
  if (view.action) await view.action(page)
  await page.waitForTimeout(600) // let the canvases paint
  await page.screenshot({ path: `${outDir}/${view.name}.png`, fullPage: true })
  console.log(`captured ${view.name}`)
  await page.close()
}

await browser.close()

if (errors.length) {
  console.error('\nBrowser errors:')
  for (const error of errors) console.error(` - ${error}`)
  process.exit(1)
}
console.log(`\n${views.length} views captured, no console errors.`)
