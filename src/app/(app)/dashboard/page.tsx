'use client'

import { useEffect, useState, useCallback } from 'react'
import { getFeedTransactions, getEggTransactions, getSheds, getPonds, getPondTransactions } from '@/lib/firestore'
import type { FeedTransaction, EggTransaction, ChartDataPoint, Shed, Pond, PondTransaction } from '@/types'
import StatsCard from '@/components/StatsCard'
import TransactionChart from '@/components/TransactionChart'
import { FaWheatAwn } from 'react-icons/fa6'
import { MdOutlineEgg } from 'react-icons/md'
import { TbCurrencyRupee } from 'react-icons/tb'
import { BiSolidPackage } from 'react-icons/bi'
import { GiBarn, GiFishingBoat } from 'react-icons/gi'
import { format, parseISO, startOfMonth } from 'date-fns'
import Link from 'next/link'
import { clsx } from 'clsx'
import te from '@/lib/te'

function buildChartData(
  transactions: Array<{ date: string; type: string; quantityKg?: number; quantityTrays?: number }>,
  valueKey: 'quantityKg' | 'quantityTrays',
): ChartDataPoint[] {
  const map: Record<string, { import: number; export: number }> = {}
  transactions.forEach(t => {
    const key = format(parseISO(t.date), 'dd MMM')
    if (!map[key]) map[key] = { import: 0, export: 0 }
    map[key][t.type as 'import' | 'export'] += (t[valueKey] ?? 0)
  })
  return Object.entries(map)
    .map(([date, v]) => ({ date, ...v }))
    .slice(-30) // last 30 data points
}

export default function DashboardPage() {
  const [feedTx, setFeedTx]       = useState<FeedTransaction[]>([])
  const [eggTx, setEggTx]         = useState<EggTransaction[]>([])
  const [sheds, setSheds]         = useState<Shed[]>([])
  const [ponds, setPonds]         = useState<Pond[]>([])
  const [pondTx, setPondTx]       = useState<PondTransaction[]>([])
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [feed, eggs, shedData, pondData, pondTxData] = await Promise.all([
      getFeedTransactions(), getEggTransactions(), getSheds(), getPonds(), getPondTransactions(),
    ])
    setFeedTx(feed)
    setEggTx(eggs)
    setSheds(shedData)
    setPonds(pondData)
    setPondTx(pondTxData)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Computed stats ──────────────────────────────────────────────────────
  const feedImported   = feedTx.filter(t => t.type === 'import').reduce((a, t) => a + t.quantityKg, 0)
  const feedExported   = feedTx.filter(t => t.type === 'export').reduce((a, t) => a + t.quantityKg, 0)
  const feedStock      = feedImported - feedExported
  const feedCost       = feedTx.filter(t => t.type === 'import').reduce((a, t) => a + t.totalAmount, 0)
  const feedRevenue    = feedTx.filter(t => t.type === 'export').reduce((a, t) => a + t.totalAmount, 0)

  const eggImported    = eggTx.filter(t => t.type === 'import').reduce((a, t) => a + t.quantityTrays, 0)
  const eggExported    = eggTx.filter(t => t.type === 'export').reduce((a, t) => a + t.quantityTrays, 0)
  const eggStock       = eggImported - eggExported
  const eggCost        = eggTx.filter(t => t.type === 'import').reduce((a, t) => a + t.totalAmount, 0)
  const eggRevenue     = eggTx.filter(t => t.type === 'export').reduce((a, t) => a + t.totalAmount, 0)

  const netProfit      = (feedRevenue + eggRevenue) - (feedCost + eggCost)

  // ── Shed stats ──────────────────────────────────────────────────────────
  const totalCapacity  = sheds.reduce((a, s) => a + s.capacity, 0)
  const totalChickens  = sheds.reduce((a, s) => a + s.currentCount, 0)
  const overallUtil    = totalCapacity > 0 ? Math.round((totalChickens / totalCapacity) * 100) : 0

  // ── Pond stats ──────────────────────────────────────────────────────────
  const totalPondStock    = ponds.reduce((a, p) => a + p.currentStockKg, 0)
  const pondHarvestRev    = pondTx.filter(t => t.type === 'harvest').reduce((a, t) => a + (t.totalAmount ?? 0), 0)
  const pondInputCost     = pondTx.filter(t => ['seed-stock', 'feed-in', 'chemical'].includes(t.type)).reduce((a, t) => a + (t.totalAmount ?? 0), 0)

  const feedChart = buildChartData(feedTx, 'quantityKg')
  const eggChart  = buildChartData(eggTx,  'quantityTrays')

  const fmt = (n: number) => n.toLocaleString('en-IN')
  const cur = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const recentFeed = feedTx.slice(0, 5)
  const recentEggs = eggTx.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">{te.dashboard.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{te.dashboard.subtitle}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/ponds" className="btn-secondary text-sm">{te.dashboard.addPondEntry}</Link>
          <Link href="/feed" className="btn-secondary text-sm">{te.dashboard.addFeedEntry}</Link>
          <Link href="/eggs" className="btn-primary text-sm">{te.dashboard.addEggEntry}</Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">{te.dashboard.loadingData}</div>
      ) : (
        <>
          {/* Stats Row 0 — Sheds */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{te.dashboard.shedOverview}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title={te.stats.totalSheds}    value={String(sheds.length)}        icon={<GiBarn />}        color="yellow"  sub={`${sheds.filter(s => s.status === 'active').length} ${te.shed.active}`} />
              <StatsCard title={te.stats.totalChickens} value={fmt(totalChickens)}           icon={<GiBarn />}        color="green"   sub={`of ${fmt(totalCapacity)} ${te.shed.capacity}`} />
              <StatsCard title={te.stats.utilisation}   value={`${overallUtil}%`}            icon={<BiSolidPackage />} color={overallUtil > 80 ? 'red' : 'blue'} sub={te.stats.fillRate} />
              <StatsCard title={te.stats.emptySheds}    value={String(sheds.filter(s => s.status === 'empty').length)} icon={<GiBarn />} color="purple" sub={te.stats.available} />
            </div>

            {/* Shed quick cards */}
            {sheds.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {sheds.map(shed => {
                  const u = shed.capacity > 0 ? Math.min(100, Math.round((shed.currentCount / shed.capacity) * 100)) : 0
                  const barColor = u > 90 ? 'bg-red-400' : u > 60 ? 'bg-brand-400' : 'bg-green-400'
                  return (
                    <Link key={shed.id} href="/sheds" className="card hover:shadow-md transition-shadow">
                      <p className="font-heading font-bold text-gray-800 text-sm truncate">{shed.name}</p>
                      <p className="text-xs text-gray-400 capitalize mb-2">{shed.shedType}</p>
                      <p className="text-lg font-bold text-gray-900">{fmt(shed.currentCount)}</p>
                      <p className="text-xs text-gray-400 mb-2">/ {fmt(shed.capacity)}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={clsx('h-1.5 rounded-full', barColor)} style={{ width: `${u}%` }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Stats Row 0b — Ponds */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{te.dashboard.pondOverview}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title={te.stats.totalPonds}    value={String(ponds.length)}              icon={<GiFishingBoat />} color="blue"   sub={`${ponds.filter(p => p.status === 'active').length} ${te.pond.active}`} />
              <StatsCard title={te.stats.liveStock}      value={`${totalPondStock.toFixed(1)} kg`} icon={<GiFishingBoat />} color="green"  sub={te.pond.estimatedWt} />
              <StatsCard title={te.stats.harvestRev}     value={cur(pondHarvestRev)}               icon={<TbCurrencyRupee />} color="yellow" sub={te.pond.cumulative} />
              <StatsCard title={te.stats.pondPL}         value={cur(pondHarvestRev - pondInputCost)} icon={<TbCurrencyRupee />} color={pondHarvestRev >= pondInputCost ? 'green' : 'red'} sub={`${te.common.cost}: ${cur(pondInputCost)}`} />
            </div>

            {/* Pond quick cards */}
            {ponds.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {ponds.map(pond => {
                  const u = pond.capacityKg > 0 ? Math.min(100, Math.round((pond.currentStockKg / pond.capacityKg) * 100)) : 0
                  const barColor = u > 90 ? 'bg-red-400' : u > 60 ? 'bg-brand-400' : 'bg-teal-400'
                  return (
                    <Link key={pond.id} href="/ponds" className="card hover:shadow-md transition-shadow">
                      <p className="font-heading font-bold text-gray-800 text-sm truncate">{pond.name}</p>
                      <p className="text-xs text-gray-400 capitalize mb-2">{pond.pondType} · {pond.species.replace('-', ' ')}</p>
                      <p className="text-lg font-bold text-gray-900">{pond.currentStockKg.toFixed(1)} kg</p>
                      <p className="text-xs text-gray-400 mb-2">/ {pond.capacityKg} kg</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={clsx('h-1.5 rounded-full', barColor)} style={{ width: `${u}%` }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Stats Row 1 — Feed */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{te.dashboard.feedOverview}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title={te.stats.feedImported}  value={`${fmt(feedImported)} kg`} icon={<FaWheatAwn />} color="green"  sub={te.stats.totalReceived} />
              <StatsCard title={te.stats.feedExported}  value={`${fmt(feedExported)} kg`} icon={<FaWheatAwn />} color="yellow" sub={te.stats.totalDispatched} />
              <StatsCard title={te.stats.feedStock}     value={`${fmt(feedStock)} kg`}    icon={<BiSolidPackage />} color="blue" sub={te.stats.currentInventory} />
              <StatsCard title={te.stats.feedPL}        value={cur(feedRevenue - feedCost)} icon={<TbCurrencyRupee />} color={feedRevenue >= feedCost ? 'green' : 'red'} sub={`${te.common.cost}: ${cur(feedCost)}`} />
            </div>
          </section>

          {/* Stats Row 2 — Eggs */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{te.dashboard.eggOverview}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard title={te.stats.eggImported}  value={`${fmt(eggImported)} ట్రేలు`}  icon={<MdOutlineEgg />} color="green"  sub={`${fmt(eggImported * 30)} గుడ్లు`} />
              <StatsCard title={te.stats.eggExported}  value={`${fmt(eggExported)} ట్రేలు`}  icon={<MdOutlineEgg />} color="yellow" sub={`${fmt(eggExported * 30)} గుడ్లు`} />
              <StatsCard title={te.stats.eggStock}      value={`${fmt(eggStock)} ట్రేలు`}      icon={<BiSolidPackage />} color="blue" sub={`${fmt(eggStock * 30)} గుడ్లు`} />
              <StatsCard title={te.stats.eggRevenue}    value={cur(eggRevenue)}               icon={<TbCurrencyRupee />} color="purple" sub={`${te.common.cost}: ${cur(eggCost)}`} />
            </div>
          </section>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TransactionChart data={feedChart} title="Feed Transactions (kg)" unit="kg" />
            <TransactionChart data={eggChart}  title="Egg Transactions (trays)" unit="trays" importColor="#7c3aed" exportColor="#d8900f" />
          </div>

          {/* Net P&L */}
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{te.dashboard.overallPL}</p>
              <p className={`text-3xl font-bold font-heading mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {cur(netProfit)}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500 space-y-1">
              <p>{te.dashboard.totalRevenue}: <span className="font-semibold text-gray-800">{cur(feedRevenue + eggRevenue)}</span></p>
              <p>{te.dashboard.totalCost}:    <span className="font-semibold text-gray-800">{cur(feedCost + eggCost)}</span></p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Feed */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-gray-800">{te.dashboard.recentFeed}</h3>
                <Link href="/feed" className="text-sm text-brand-500 hover:underline">{te.common.viewAll}</Link>
              </div>
              {recentFeed.length === 0 ? (
                <p className="text-sm text-gray-400">{te.common.noData}</p>
              ) : (
                <div className="space-y-2">
                  {recentFeed.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <span className={t.type === 'import' ? 'badge-import' : 'badge-export'}>{t.type}</span>
                        <span className="ml-2 text-sm text-gray-700">{t.party}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800">{fmt(t.quantityKg)} kg</p>
                        <p className="text-xs text-gray-400">{t.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Eggs */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-gray-800">{te.dashboard.recentEggs}</h3>
                <Link href="/eggs" className="text-sm text-brand-500 hover:underline">{te.common.viewAll}</Link>
              </div>
              {recentEggs.length === 0 ? (
                <p className="text-sm text-gray-400">{te.common.noData}</p>
              ) : (
                <div className="space-y-2">
                  {recentEggs.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <span className={t.type === 'import' ? 'badge-import' : 'badge-export'}>{t.type}</span>
                        <span className="ml-2 text-sm text-gray-700">{t.party}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800">{fmt(t.quantityTrays)} trays</p>
                        <p className="text-xs text-gray-400">{t.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
