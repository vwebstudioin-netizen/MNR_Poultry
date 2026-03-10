import { NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EggRatePoint {
  date:     string        // ISO date yyyy-MM-dd
  rate:     number | null // historical NECC ₹/egg
  forecast: number | null // forecast ₹/egg (null for past)
}

export interface EggRatesResponse {
  source:  'necc-live' | 'simulated'
  updated: string
  market:  string
  today:   number
  data:    EggRatePoint[]
}

// ─── Seeded deterministic pseudo-random (SFC32) ───────────────────────────────
function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0; d = d + 1 | 0
    a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11)
    c = c + t | 0; return (t >>> 0) / 4294967296
  }
}

function makeRng(dateStr: string) {
  const seed = dateStr.split('-').reduce((s, n) => s * 31 + parseInt(n), 0)
  return sfc32(seed, seed ^ 0xdeadbeef, seed ^ 0xcafebabe, seed ^ 0x1234567)
}

// ─── Realistic NECC-style rate generator ────────────────────────────────────
// Major AP/Telangana market (Hyderabad NECC zone) typical range 2025-2026
const BASE_RATE       = 5.85  // ₹ per egg as of early 2026
const SEASONAL_AMP    = 0.40  // seasonal swing ±
const DAILY_NOISE_MAX = 0.15  // max daily noise in ₹

function generateRate(epochDay: number, noise: number): number {
  // Gentle sine-wave seasonality (peak ~winter, trough ~summer)
  const seasonal = Math.sin((epochDay / 365) * 2 * Math.PI - 1.2) * SEASONAL_AMP
  // Slow trending drift
  const trend    = (epochDay % 60) / 60 * 0.10 - 0.05
  const raw      = BASE_RATE + seasonal + trend + (noise - 0.5) * DAILY_NOISE_MAX * 2
  return Math.round(Math.max(4.50, Math.min(8.00, raw)) * 100) / 100
}

function toEpochDay(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ─── Simple linear regression for forecast ───────────────────────────────────
function linearForecast(values: number[], steps: number): number[] {
  const n = values.length
  const xs = Array.from({ length: n }, (_, i) => i)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = values.reduce((a, b) => a + b, 0) / n
  const slope = xs.reduce((a, x, i) => a + (x - xMean) * (values[i] - yMean), 0)
    / xs.reduce((a, x) => a + (x - xMean) ** 2, 0)
  const intercept = yMean - slope * xMean

  return Array.from({ length: steps }, (_, i) =>
    Math.round(Math.max(4.50, Math.min(8.50, intercept + slope * (n + i))) * 100) / 100,
  )
}

// ─── Try to fetch live NECC rate ─────────────────────────────────────────────
async function tryFetchLiveRate(): Promise<number | null> {
  try {
    // NECC publishes rates at e2necc.com — try to parse the today rate
    const res = await fetch('https://www.e2necc.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal:  AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Look for rate pattern like "5.82" or "582 paise" near "Hyderabad" or "Telangana"
    const patterns = [
      /Hyderabad[^0-9]{0,80}(\d+\.?\d*)\s*(?:paise|₹)?/i,
      /Telangana[^0-9]{0,80}(\d+\.?\d*)/i,
      /NECC.*?(\d+\.\d{2})/i,
    ]
    for (const re of patterns) {
      const m = html.match(re)
      if (m) {
        let v = parseFloat(m[1])
        if (v > 100) v = v / 100  // paise → rupees
        if (v >= 4 && v <= 10)  return Math.round(v * 100) / 100
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────
export async function GET() {
  const today         = new Date().toISOString().slice(0, 10)
  const HISTORY_DAYS  = 30
  const FORECAST_DAYS = 7

  // Build 30-day historical data using seeded generator
  const historical: EggRatePoint[] = []
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const dateStr  = addDays(today, -i)
    const epochDay = toEpochDay(new Date(dateStr + 'T00:00:00Z'))
    const rng      = makeRng(dateStr)
    rng(); rng() // burn-in
    const rate     = generateRate(epochDay, rng())
    historical.push({ date: dateStr, rate, forecast: null })
  }

  // Try live rate for today — if success, replace today's simulated value
  const liveRate = await tryFetchLiveRate()
  let source: EggRatesResponse['source'] = 'simulated'
  if (liveRate !== null) {
    historical[historical.length - 1].rate = liveRate
    source = 'necc-live'
  }

  const todayRate = historical[historical.length - 1].rate!

  // Forecast based on last 14 days trend
  const last14 = historical.slice(-14).map(p => p.rate!)
  const forecastValues = linearForecast(last14, FORECAST_DAYS)

  // Bridge: today also gets a forecast = its actual value (so line is connected)
  historical[historical.length - 1].forecast = todayRate

  const forecast: EggRatePoint[] = forecastValues.map((val, i) => ({
    date: addDays(today, i + 1),
    rate: null,
    forecast: val,
  }))

  const data: EggRatePoint[] = [...historical, ...forecast]

  const res: EggRatesResponse = {
    source,
    updated: new Date().toISOString(),
    market: 'Hyderabad (NECC Zone)',
    today:  todayRate,
    data,
  }

  return NextResponse.json(res, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}
