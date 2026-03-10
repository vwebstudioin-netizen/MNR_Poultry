import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { MdTrendingUp, MdTrendingDown, MdTrendingFlat } from 'react-icons/md'

interface StatsCardProps {
  title:     string
  value:     string
  sub?:      string
  icon:      ReactNode
  color:     'yellow' | 'green' | 'blue' | 'red' | 'purple'
  trendPct?: number   // e.g. 12.5 = +12.5% vs last period
  trendGood?: boolean // true = up is good (revenue), false = up is bad (cost/mortality)
}

const colorMap = {
  yellow: 'bg-brand-50 text-brand-600',
  green:  'bg-green-50  text-green-600',
  blue:   'bg-blue-50   text-blue-600',
  red:    'bg-red-50    text-red-600',
  purple: 'bg-purple-50 text-purple-600',
}

export default function StatsCard({ title, value, sub, icon, color, trendPct, trendGood = true }: StatsCardProps) {
  const hasTrend = trendPct !== undefined && trendPct !== null
  const isUp     = hasTrend && trendPct! > 0
  const isDown   = hasTrend && trendPct! < 0
  const trendPositive = (isUp && trendGood) || (isDown && !trendGood)

  return (
    <div className="card flex items-start gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0', colorMap[color])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{title}</p>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold font-heading text-gray-900 leading-none">{value}</p>
          {hasTrend && trendPct !== 0 && (
            <span className={clsx(
              'flex items-center gap-0.5 text-xs font-semibold mb-0.5 px-1.5 py-0.5 rounded-full',
              trendPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            )}>
              {isUp   ? <MdTrendingUp   className="text-sm" /> :
               isDown ? <MdTrendingDown className="text-sm" /> :
                        <MdTrendingFlat className="text-sm" />}
              {Math.abs(trendPct!).toFixed(1)}%
            </span>
          )}
          {hasTrend && trendPct === 0 && (
            <span className="flex items-center gap-0.5 text-xs font-semibold mb-0.5 px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400">
              <MdTrendingFlat className="text-sm" /> 0%
            </span>
          )}
        </div>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

