'use client'

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import type { EggRatesResponse } from '@/app/api/egg-rates/route'
import { format, parseISO } from 'date-fns'
import { MdOutlineEgg, MdRefresh, MdInfoOutline } from 'react-icons/md'
import { clsx } from 'clsx'

interface Props {
  data: EggRatesResponse | null
  loading: boolean
  onRefresh?: () => void
}

// Custom dot — highlight today (where both rate & forecast are set) with a ring
function TodayDot(props: {
  cx?: number; cy?: number; payload?: { rate: number | null; forecast: number | null }
}) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  if (payload?.rate !== null && payload?.forecast !== null) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7}  fill="#f59e0b" opacity={0.25} />
        <circle cx={cx} cy={cy} r={4}  fill="#f59e0b" />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill="#f59e0b" />
}

function ForecastDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props
  if (!cx || !cy) return null
  return <circle cx={cx} cy={cy} r={2.5} fill="#8b5cf6" stroke="#fff" strokeWidth={1} />
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">
        {label ? format(parseISO(label), 'EEE, dd MMM yyyy') : ''}
      </p>
      {payload.map(p => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">₹{p.value.toFixed(2)}</span>
          <span className="text-gray-400 text-xs">/ egg</span>
        </p>
      ))}
    </div>
  )
}

export default function EggRateChart({ data, loading, onRefresh }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // X-axis tick: show date label only every ~5 days
  const tickFormatter = (val: string) => {
    try { return format(parseISO(val), 'dd MMM') }
    catch { return val }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <MdOutlineEgg className="text-amber-500 text-xl" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-gray-800 text-sm leading-tight">
              India Egg Rate — NECC
            </h3>
            <p className="text-xs text-gray-400">
              {data?.market ?? 'Hyderabad Zone'} · ₹ per egg
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Today badge */}
          {data && (
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold text-amber-500 font-heading leading-none">
                ₹{data.today.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 mt-0.5">today</span>
            </div>
          )}
          {/* Source badge */}
          {data && (
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              data.source === 'necc-live'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500',
            )}>
              {data.source === 'necc-live' ? '● LIVE' : '◎ EST'}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              title="Refresh"
            >
              <MdRefresh className={clsx('text-lg', loading && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-56 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <MdRefresh className="animate-spin text-xl" />
            Loading egg rates…
          </div>
        </div>
      ) : !data ? (
        <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
          Failed to load rate data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data.data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

            {/* Forecast shaded zone */}
            <ReferenceArea
              x1={today}
              x2={data.data[data.data.length - 1].date}
              fill="#8b5cf6"
              fillOpacity={0.04}
            />

            {/* Today marker */}
            <ReferenceLine
              x={today}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#f59e0b' }}
            />

            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `₹${v.toFixed(2)}`}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="plainline"
              iconSize={20}
              formatter={(value: string) => (
                <span className="text-xs text-gray-500">{value}</span>
              )}
            />

            {/* Historical solid line */}
            <Line
              type="monotone"
              dataKey="rate"
              name="NECC Rate"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={<TodayDot />}
              activeDot={{ r: 5, fill: '#f59e0b' }}
              connectNulls={false}
            />

            {/* Forecast dotted line */}
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast (7d)"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={<ForecastDot />}
              activeDot={{ r: 4, fill: '#8b5cf6' }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-gray-50">
        <MdInfoOutline className="text-gray-300 text-sm mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-300 leading-relaxed">
          {data?.source === 'necc-live'
            ? 'Live NECC rate fetched. Forecast uses 14-day linear regression. Rates are indicative — verify with your local NECC centre.'
            : 'Live NECC fetch unavailable. Rates are estimated using NECC historical pattern for Hyderabad zone. Forecast uses 14-day linear regression.'}
          {data?.updated && (
            <> · Updated {format(new Date(data.updated), 'dd MMM, HH:mm')}</>
          )}
        </p>
      </div>
    </div>
  )
}
