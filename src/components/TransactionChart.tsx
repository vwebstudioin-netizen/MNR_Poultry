'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ChartDataPoint } from '@/types'

interface Props {
  data: ChartDataPoint[]
  title: string
  unit?: string
  importColor?: string
  exportColor?: string
}

export default function TransactionChart({
  data,
  title,
  unit = '',
  importColor = '#0cbf82',
  exportColor  = '#d8900f',
}: Props) {
  return (
    <div className="card">
      <h3 className="font-heading font-semibold text-gray-800 mb-4">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No data available yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`importGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={importColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={importColor} stopOpacity={0}    />
              </linearGradient>
              <linearGradient id={`exportGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={exportColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={exportColor} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit={unit ? ` ${unit}` : ''} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              formatter={(val: number) => [`${val}${unit ? ' ' + unit : ''}`, undefined]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="import"
              name="Import"
              stroke={importColor}
              fill={`url(#importGrad-${title})`}
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="export"
              name="Export"
              stroke={exportColor}
              fill={`url(#exportGrad-${title})`}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
