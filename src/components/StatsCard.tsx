import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface StatsCardProps {
  title: string
  value: string
  sub?: string
  icon: ReactNode
  color: 'yellow' | 'green' | 'blue' | 'red' | 'purple'
  trend?: 'up' | 'down' | 'neutral'
}

const colorMap = {
  yellow: 'bg-brand-50 text-brand-600',
  green:  'bg-green-50  text-green-600',
  blue:   'bg-blue-50   text-blue-600',
  red:    'bg-red-50    text-red-600',
  purple: 'bg-purple-50 text-purple-600',
}

export default function StatsCard({ title, value, sub, icon, color }: StatsCardProps) {
  return (
    <div className="card flex items-start gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0', colorMap[color])}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{title}</p>
        <p className="text-2xl font-bold font-heading text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
