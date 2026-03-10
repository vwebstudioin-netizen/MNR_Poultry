import { NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PrawnRatePoint {
  date:          string
  vannamei:      number | null  // ₹/kg (Vannamei 30-count)
  tiger:         number | null  // ₹/kg (Tiger 20-count)
  vanForecast:   number | null
  tigerForecast: number | null
}

export interface PrawnRatesResponse {
  source:        'ap-fisheries-live' | 'simulated'
  updated:       string
  market:        string
  todayVannamei: number
  todayTiger:    number
  data:          PrawnRatePoint[]
}

// ─── Seeded deterministic pseudo-random (SFC32) ───────────────────────────────
function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0
    const t = (a + b | 0) + d | 0; d = d + 1 | 0
    a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11)
    c = c + t | 0; return (t >>> 0) / 4294967296
  }
}

function makeRng(dateStr: string, salt: number) {
  const seed = dateStr.split('-').reduce((s, n) => s * 31 + parseInt(n), salt)
  return sfc32(seed, seed ^ 0xdeadbeef, seed ^ 0xcafebabe, seed ^ 0x1234567)
}

// ─── Realistic AP mandi prawn rate generators ─────────────────────────────────
// AP (Nellore / Kakinada) typical spot price ranges 2025-2026

// Vannamei 30-count (₹/kg): typical range ₹220–340
const VAN_BASE        = 265
const VAN_SEASONAL    = 22    // seasonal swing ±₹
const VAN_NOISE       = 8     // max daily noise ±₹

// Tiger 20-count (₹/kg): typical range ₹460–640
const TIGER_BASE      = 530
const TIGER_SEASONAL  = 40
const TIGER_NOISE     = 14

function generatePrawnRate(
  epochDay: number,
  noise: number,
  base: number,
  seasonalAmp: number,
  noiseRange: number,
  min: number,
  max: number,
): number {
  const seasonal  = Math.sin((epochDay / 365) * 2 * Math.PI + 0.8) * seasonalAmp
  const trend     = ((epochDay % 90) / 90) * 10 - 5
  const raw       = base + seasonal + trend + (noise - 0.5) * noiseRange * 2
  return Math.round(Math.max(min, Math.min(max, raw)))
}

function toEpochDay(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ─── Simple linear regression forecast ───────────────────────────────────────
function linearForecast(values: number[], steps: number, min: number, max: number): number[] {
  const n = values.length
  const xs = Array.from({ length: n }, (_, i) => i)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = values.reduce((a, b) => a + b, 0) / n
  const slope = xs.reduce((a, x, i) => a + (x - xMean) * (values[i] - yMean), 0)
    / xs.reduce((a, x) => a + (x - xMean) ** 2, 0)
  const intercept = yMean - slope * xMean
  return Array.from({ length: steps }, (_, i) =>
    Math.round(Math.max(min, Math.min(max, intercept + slope * (n + i)))),
  )
}

// ─── Try to fetch live AP fisheries / commodity rate ─────────────────────────
async function tryFetchLiveRates(): Promise<{ vannamei: number; tiger: number } | null> {
  try {
    // AP Fisheries Dept publishes rates; try parsing Nellore/Kakinada mandi page
    const res = await fetch('https://mmfishprice.ap.gov.in/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const html = await res.text()

    let vannamei: number | null = null
    let tiger: number | null    = null

    const vanPatterns = [
      /vannamei[^0-9]{0,80}(\d{3,4})/i,
      /L[1-5][^0-9]{0,40}(\d{3,4})/i,
    ]
    for (const re of vanPatterns) {
      const m = html.match(re)
      if (m) {
        const v = parseInt(m[1])
        if (v >= 150 && v <= 500) { vannamei = v; break }
      }
    }

    const tigerPatterns = [
      /tiger[^0-9]{0,80}(\d{3,4})/i,
      /black tiger[^0-9]{0,80}(\d{3,4})/i,
    ]
    for (const re of tigerPatterns) {
      const m = html.match(re)
      if (m) {
        const v = parseInt(m[1])
        if (v >= 300 && v <= 900) { tiger = v; break }
      }
    }

    if (vannamei && tiger) return { vannamei, tiger }
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

  const historical: PrawnRatePoint[] = []

  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const dateStr  = addDays(today, -i)
    const epochDay = toEpochDay(new Date(dateStr + 'T00:00:00Z'))

    const rng1 = makeRng(dateStr, 0xaabbcc)
    const rng2 = makeRng(dateStr, 0x998877)
    rng1(); rng1()
    rng2(); rng2()

    const vannamei = generatePrawnRate(epochDay, rng1(), VAN_BASE,   VAN_SEASONAL,   VAN_NOISE,   200, 350)
    const tiger    = generatePrawnRate(epochDay, rng2(), TIGER_BASE, TIGER_SEASONAL, TIGER_NOISE, 440, 660)

    historical.push({ date: dateStr, vannamei, tiger, vanForecast: null, tigerForecast: null })
  }

  // Try live rates — replace today if successful
  const live = await tryFetchLiveRates()
  let source: PrawnRatesResponse['source'] = 'simulated'
  if (live) {
    historical[historical.length - 1].vannamei = live.vannamei
    historical[historical.length - 1].tiger    = live.tiger
    source = 'ap-fisheries-live'
  }

  const todayVannamei = historical[historical.length - 1].vannamei!
  const todayTiger    = historical[historical.length - 1].tiger!

  // Forecast
  const last14Van   = historical.slice(-14).map(p => p.vannamei!)
  const last14Tiger = historical.slice(-14).map(p => p.tiger!)
  const vanForecasts    = linearForecast(last14Van,   FORECAST_DAYS, 200, 370)
  const tigerForecasts  = linearForecast(last14Tiger, FORECAST_DAYS, 440, 680)

  // Bridge today
  historical[historical.length - 1].vanForecast   = todayVannamei
  historical[historical.length - 1].tigerForecast = todayTiger

  const forecast: PrawnRatePoint[] = vanForecasts.map((van, i) => ({
    date:          addDays(today, i + 1),
    vannamei:      null,
    tiger:         null,
    vanForecast:   van,
    tigerForecast: tigerForecasts[i],
  }))

  const data: PrawnRatePoint[] = [...historical, ...forecast]

  const res: PrawnRatesResponse = {
    source,
    updated:       new Date().toISOString(),
    market:        'Nellore / Kakinada (AP Mandi)',
    todayVannamei,
    todayTiger,
    data,
  }

  return NextResponse.json(res, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
  })
}
