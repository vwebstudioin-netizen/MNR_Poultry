'use client'

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import type { PrawnRatesResponse } from '@/app/api/prawn-rates/route'
import { format, parseISO } from 'date-fns'
import { GiShrimp } from 'react-icons/gi'
import { MdRefresh, MdInfoOutline } from 'react-icons/md'
import { clsx } from 'clsx'

interface Props {
  data:      PrawnRatesResponse | null
  loading:   boolean
  onRefresh?: () => void
}

function TodayDotVan(props: {
  cx?: number; cy?: number;
  payload?: { vannamei: number | null; vanForecast: number | null }
}) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  if (payload?.vannamei !== null && payload?.vanForecast !== null) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#0d9488" opacity={0.2} />
        <circle cx={cx} cy={cy} r={4} fill="#0d9488" />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill="#0d9488" />
}

function TodayDotTiger(props: {
  cx?: number; cy?: number;
  payload?: { tiger: number | null; tigerForecast: number | null }
}) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  if (payload?.tiger !== null && payload?.tigerForecast !== null) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#2563eb" opacity={0.2} />
        <circle cx={cx} cy={cy} r={4} fill="#2563eb" />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill="#2563eb" />
}

function ForecastDot(props: { cx?: number; cy?: number; color: string }) {
  const { cx, cy, color } = props
  if (!cx || !cy) return null
  return <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="#fff" strokeWidth={1} />
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?:  string
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
          <span className="font-bold text-gray-800">₹{p.value.toFixed(0)}</span>
          <span className="text-gray-400 text-xs">/ kg</span>
        </p>
      ))}
    </div>
  )
}

export default function PrawnRateChart({ data, loading, onRefresh }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const tickFormatter = (val: string) => {
    try { return format(parseISO(val), 'dd MMM') }
    catch { return val }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <GiShrimp className="text-teal-500 text-xl" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-gray-800 text-sm leading-tight">
              India Prawn Rate — AP Mandi
            </h3>
            <p className="text-xs text-gray-400">
              {data?.market ?? 'Nellore / Kakinada Zone'} · ₹ per kg
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Today badges */}
          {data && (
            <div className="flex gap-3">
              <div className="flex flex-col items-end">
                <span className="text-lg font-bold text-teal-500 font-heading leading-none">
                  ₹{data.todayVannamei}
                </span>
                <span className="text-xs text-gray-400 mt-0.5">Vannamei</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-lg font-bold text-blue-500 font-heading leading-none">
                  ₹{data.todayTiger}
                </span>
                <span className="text-xs text-gray-400 mt-0.5">Tiger</span>
              </div>
            </div>
          )}
          {/* Source badge */}
          {data && (
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              data.source === 'ap-fisheries-live'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500',
            )}>
              {data.source === 'ap-fisheries-live' ? '● LIVE' : '◎ EST'}
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
            Loading prawn rates…
          </div>
        </div>
      ) : !data ? (
        <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
          Failed to load rate data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
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
              stroke="#0d9488"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#0d9488' }}
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
              tickFormatter={(v: number) => `₹${v}`}
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

            {/* Vannamei solid */}
            <Line
              type="monotone"
              dataKey="vannamei"
              name="Vannamei (30ct)"
              stroke="#0d9488"
              strokeWidth={2.5}
              dot={<TodayDotVan />}
              activeDot={{ r: 5, fill: '#0d9488' }}
              connectNulls={false}
            />
            {/* Tiger solid */}
            <Line
              type="monotone"
              dataKey="tiger"
              name="Tiger (20ct)"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={<TodayDotTiger />}
              activeDot={{ r: 5, fill: '#2563eb' }}
              connectNulls={false}
            />
            {/* Vannamei forecast dotted */}
            <Line
              type="monotone"
              dataKey="vanForecast"
              name="Vannamei Forecast"
              stroke="#0d9488"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={(props) => <ForecastDot {...props} color="#0d9488" />}
              activeDot={{ r: 4, fill: '#0d9488' }}
              connectNulls={false}
            />
            {/* Tiger forecast dotted */}
            <Line
              type="monotone"
              dataKey="tigerForecast"
              name="Tiger Forecast"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={(props) => <ForecastDot {...props} color="#2563eb" />}
              activeDot={{ r: 4, fill: '#2563eb' }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-gray-50">
        <MdInfoOutline className="text-gray-300 text-sm mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-300 leading-relaxed">
          {data?.source === 'ap-fisheries-live'
            ? 'Live AP Fisheries mandi rate fetched. '
            : 'Live AP Fisheries fetch unavailable. Rates are estimated using typical Nellore/Kakinada mandi patterns. '}
          Vannamei 30ct &amp; Tiger 20ct. Forecast uses 14-day linear regression. Verify with your local mandi.
          {data?.updated && (
            <> · Updated {format(new Date(data.updated), 'dd MMM, HH:mm')}</>
          )}
        </p>
      </div>
    </div>
  )
}
