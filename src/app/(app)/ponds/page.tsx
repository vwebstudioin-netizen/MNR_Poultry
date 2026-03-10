'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  addPond, getPonds, updatePond, deletePond,
  addPondTransaction, getPondTransactions, deletePondTransaction,
} from '@/lib/firestore'
import type { Pond, PondType, PondStatus, PondTransaction, PondTransactionType } from '@/types'
import { GiFishingBoat } from 'react-icons/gi'
import { MdDelete, MdEdit, MdClose, MdAdd } from 'react-icons/md'
import { FaFish } from 'react-icons/fa6'
import { GiShrimp } from 'react-icons/gi'
import { format } from 'date-fns'
import { clsx } from 'clsx'

// ─── Constants ───────────────────────────────────────────────────────────────
const FISH_SPECIES   = ['rohu', 'catla', 'tilapia', 'catfish', 'carp', 'milkfish', 'other']
const PRAWN_SPECIES  = ['vannamei', 'tiger-prawn', 'freshwater-prawn', 'other']
const POND_STATUSES: PondStatus[]          = ['active', 'harvested', 'fallow', 'maintenance']
const TX_TYPES: PondTransactionType[]      = ['seed-stock', 'feed-in', 'harvest', 'mortality', 'chemical']

const statusColor: Record<PondStatus, string> = {
  active:      'bg-green-100 text-green-700',
  harvested:   'bg-brand-100 text-brand-700',
  fallow:      'bg-gray-100  text-gray-500',
  maintenance: 'bg-yellow-100 text-yellow-700',
}

const txColor: Record<PondTransactionType, string> = {
  'seed-stock': 'bg-blue-100   text-blue-700',
  'feed-in':    'bg-green-100  text-green-700',
  'harvest':    'bg-brand-100  text-brand-700',
  'mortality':  'bg-red-100    text-red-700',
  'chemical':   'bg-purple-100 text-purple-700',
}

const txLabel: Record<PondTransactionType, string> = {
  'seed-stock': 'Seed Stocking',
  'feed-in':    'Feed Input',
  'harvest':    'Harvest (Sale)',
  'mortality':  'Mortality',
  'chemical':   'Chemical / Medicine',
}

// What each tx type does to stock
const txStockEffect: Record<PondTransactionType, 'add' | 'subtract' | 'none'> = {
  'seed-stock': 'add',
  'feed-in':    'none',
  'harvest':    'subtract',
  'mortality':  'subtract',
  'chemical':   'none',
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const pondSchema = z.object({
  name:           z.string().min(1, 'Pond name required'),
  pondType:       z.enum(['fish', 'prawn']),
  species:        z.string().min(1, 'Species required'),
  areaAcres:      z.coerce.number().positive('Area must be > 0'),
  depthFt:        z.coerce.number().optional(),
  capacityKg:     z.coerce.number().positive('Capacity must be > 0'),
  currentStockKg: z.coerce.number().min(0),
  status:         z.enum(['active', 'harvested', 'fallow', 'maintenance']),
  stockingDate:   z.string().optional(),
  notes:          z.string().optional(),
})

const txSchema = z.object({
  type:           z.enum(['seed-stock', 'feed-in', 'harvest', 'mortality', 'chemical']),
  date:           z.string().min(1, 'Date required'),
  // Seed-stock
  seedCount:      z.coerce.number().optional(),
  avgWeightGrams: z.coerce.number().optional(),
  // Feed
  feedType:       z.string().optional(),
  // Chemical
  itemName:       z.string().optional(),
  unit:           z.string().optional(),
  quantity:       z.coerce.number().optional(),
  // Shared
  quantityKg:     z.coerce.number().optional(),
  pricePerUnit:   z.coerce.number().optional(),
  party:          z.string().optional(),
  invoiceNo:      z.string().optional(),
  notes:          z.string().optional(),
})

type PondFormData = z.infer<typeof pondSchema>
type TxFormData   = z.infer<typeof txSchema>

// ─── Component ───────────────────────────────────────────────────────────────
export default function PondsPage() {
  const [ponds, setPonds]             = useState<Pond[]>([])
  const [allTx, setAllTx]             = useState<PondTransaction[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  const [showPondForm, setShowPondForm] = useState(false)
  const [editingPond, setEditingPond]   = useState<Pond | null>(null)
  const [txPond, setTxPond]             = useState<Pond | null>(null)
  const [activeTab, setActiveTab]       = useState<'ponds' | 'transactions'>('ponds')
  const [filterType, setFilterType]     = useState<'all' | PondTransactionType>('all')
  const [filterPond, setFilterPond]     = useState<'all' | string>('all')

  // ── Pond form ────────────────────────────────────────────────────────────
  const {
    register: regPond,
    handleSubmit: handlePond,
    reset: resetPond,
    watch: watchPond,
    setValue: setPondVal,
    formState: { errors: pondErrors },
  } = useForm<PondFormData>({
    resolver: zodResolver(pondSchema),
    defaultValues: { pondType: 'fish', status: 'active', currentStockKg: 0 },
  })

  const pondType       = watchPond('pondType')
  const currentStockKg = watchPond('currentStockKg')
  const capacityKg     = watchPond('capacityKg')
  const utilPct        = capacityKg > 0 ? Math.min(100, Math.round((currentStockKg / capacityKg) * 100)) : 0
  const speciesList    = pondType === 'fish' ? FISH_SPECIES : PRAWN_SPECIES

  // ── Transaction form ─────────────────────────────────────────────────────
  const {
    register: regTx,
    handleSubmit: handleTx,
    reset: resetTx,
    watch: watchTx,
    formState: { errors: txErrors },
  } = useForm<TxFormData>({
    resolver: zodResolver(txSchema),
    defaultValues: { type: 'seed-stock', date: format(new Date(), 'yyyy-MM-dd') },
  })

  const txType      = watchTx('type')
  const txQtyKg     = watchTx('quantityKg')    ?? 0
  const txPriceUnit = watchTx('pricePerUnit')  ?? 0
  const txQty       = watchTx('quantity')      ?? 0
  const txSeedCount = watchTx('seedCount')     ?? 0
  const txSeedPpu   = watchTx('pricePerUnit')  ?? 0

  const derivedTotal =
    txType === 'seed-stock' ? txSeedCount * txSeedPpu :
    txType === 'feed-in'    ? txQtyKg     * txPriceUnit :
    txType === 'harvest'    ? txQtyKg     * txPriceUnit :
    txType === 'chemical'   ? txQty       * txPriceUnit :
    0

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    const [p, tx] = await Promise.all([getPonds(), getPondTransactions()])
    setPonds(p)
    setAllTx(tx)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Pond submit ───────────────────────────────────────────────────────────
  const onPondSubmit = async (data: PondFormData) => {
    setSaving(true)
    if (editingPond?.id) {
      await updatePond(editingPond.id, data)
    } else {
      await addPond(data)
    }
    resetPond({ pondType: 'fish', status: 'active', currentStockKg: 0 })
    setShowPondForm(false)
    setEditingPond(null)
    await load()
    setSaving(false)
  }

  const openEdit = (pond: Pond) => {
    setEditingPond(pond)
    setPondVal('name',           pond.name)
    setPondVal('pondType',       pond.pondType)
    setPondVal('species',        pond.species)
    setPondVal('areaAcres',      pond.areaAcres)
    setPondVal('depthFt',        pond.depthFt ?? 0)
    setPondVal('capacityKg',     pond.capacityKg)
    setPondVal('currentStockKg', pond.currentStockKg)
    setPondVal('status',         pond.status)
    setPondVal('stockingDate',   pond.stockingDate ?? '')
    setPondVal('notes',          pond.notes ?? '')
    setShowPondForm(true)
  }

  const closePondForm = () => {
    setShowPondForm(false)
    setEditingPond(null)
    resetPond({ pondType: 'fish', status: 'active', currentStockKg: 0 })
  }

  const handleDeletePond = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this pond? Transaction history will remain.')) return
    await deletePond(id)
    await load()
  }

  // ── Transaction submit ────────────────────────────────────────────────────
  const onTxSubmit = async (data: TxFormData) => {
    if (!txPond?.id) return
    setSaving(true)

    const total = derivedTotal || 0

    // Compute stock delta
    let newStock = txPond.currentStockKg
    const effect = txStockEffect[data.type]
    if (effect === 'add') {
      // for seed-stock: use quantityKg if provided, else derive from seedCount * avgWeight
      const addKg = data.quantityKg ?? ((data.seedCount ?? 0) * (data.avgWeightGrams ?? 0) / 1000)
      newStock += addKg
    }
    if (effect === 'subtract') {
      newStock = Math.max(0, newStock - (data.quantityKg ?? 0))
    }

    await Promise.all([
      addPondTransaction({
        pondId:   txPond.id,
        pondName: txPond.name,
        ...data,
        totalAmount: total,
      }),
      updatePond(txPond.id, {
        currentStockKg: newStock,
        status: newStock === 0 && data.type === 'harvest' ? 'harvested' : txPond.status,
      }),
    ])

    resetTx({ type: 'seed-stock', date: format(new Date(), 'yyyy-MM-dd') })
    setTxPond(null)
    await load()
    setSaving(false)
  }

  const handleDeleteTx = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this transaction?')) return
    await deletePondTransaction(id)
    await load()
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalPonds    = ponds.length
  const activePonds   = ponds.filter(p => p.status === 'active').length
  const totalStockKg  = ponds.reduce((a, p) => a + p.currentStockKg, 0)

  const totalHarvest  = allTx.filter(t => t.type === 'harvest')
    .reduce((a, t) => a + (t.totalAmount ?? 0), 0)
  const totalInputCost = allTx.filter(t => ['seed-stock', 'feed-in', 'chemical'].includes(t.type))
    .reduce((a, t) => a + (t.totalAmount ?? 0), 0)

  // FCR per pond helper
  const fcrForPond = (pond: Pond) => {
    const pond_tx = allTx.filter(t => t.pondId === pond.id)
    const feedUsed    = pond_tx.filter(t => t.type === 'feed-in').reduce((a, t) => a + (t.quantityKg ?? 0), 0)
    const harvested   = pond_tx.filter(t => t.type === 'harvest').reduce((a, t) => a + (t.quantityKg ?? 0), 0)
    return harvested > 0 ? (feedUsed / harvested).toFixed(2) : '—'
  }

  const filteredTx = allTx
    .filter(t => filterType === 'all' || t.type === filterType)
    .filter(t => filterPond === 'all' || t.pondId === filterPond)

  const fmt = (n: number) => n.toLocaleString('en-IN')
  const cur = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const wt  = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GiFishingBoat className="text-brand-500 text-3xl" /> Pond Management
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Fish &amp; prawn ponds — seed, feed, harvest &amp; more</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => { setEditingPond(null); setShowPondForm(true) }}>
          <MdAdd className="inline mr-1 text-base" /> Add Pond
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Ponds',    value: totalPonds,    sub: `${activePonds} active`,          color: 'text-brand-600' },
          { label: 'Live Stock',     value: wt(totalStockKg), sub: 'total estimated weight',       color: 'text-green-600' },
          { label: 'Total Harvest',  value: cur(totalHarvest),  sub: 'cumulative revenue',         color: 'text-blue-600'  },
          { label: 'Net P&L',        value: cur(totalHarvest - totalInputCost), sub: `Cost: ${cur(totalInputCost)}`, color: totalHarvest >= totalInputCost ? 'text-green-600' : 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold font-heading mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100">
        {(['ponds', 'transactions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-all -mb-px',
              activeTab === tab
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {tab === 'ponds' ? `Ponds (${totalPonds})` : `Transactions (${allTx.length})`}
          </button>
        ))}
      </div>

      {/* ── Ponds Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'ponds' && (
        loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading ponds…</div>
        ) : ponds.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
            <GiFishingBoat className="text-5xl text-gray-200" />
            <p>No ponds added yet. Click <span className="font-semibold text-brand-500">+ Add Pond</span> to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ponds.map(pond => {
              const util     = pond.capacityKg > 0 ? Math.min(100, Math.round((pond.currentStockKg / pond.capacityKg) * 100)) : 0
              const barColor = util > 90 ? 'bg-red-500' : util > 60 ? 'bg-brand-500' : 'bg-green-500'
              const pondTx   = allTx.filter(t => t.pondId === pond.id)
              const harvestRev  = pondTx.filter(t => t.type === 'harvest').reduce((a, t) => a + (t.totalAmount ?? 0), 0)
              const pondCost    = pondTx.filter(t => ['seed-stock', 'feed-in', 'chemical'].includes(t.type)).reduce((a, t) => a + (t.totalAmount ?? 0), 0)
              const pondHarvestKg = pondTx.filter(t => t.type === 'harvest').reduce((a, t) => a + (t.quantityKg ?? 0), 0)

              return (
                <div key={pond.id} className="card relative hover:shadow-md transition-shadow">
                  {/* Type & Status */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={clsx(
                      'text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1',
                      pond.pondType === 'fish' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
                    )}>
                      {pond.pondType === 'fish' ? <FaFish className="text-xs" /> : <GiShrimp className="text-xs" />}
                      {pond.pondType}
                    </span>
                    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', statusColor[pond.status])}>
                      {pond.status}
                    </span>
                  </div>

                  {/* Name & Species */}
                  <h3 className="font-heading text-lg font-bold text-gray-900 mb-0.5">{pond.name}</h3>
                  <p className="text-xs text-gray-400 capitalize mb-3">{pond.species.replace('-', ' ')} · {pond.areaAcres} acres{pond.depthFt ? ` · ${pond.depthFt} ft deep` : ''}</p>

                  {/* Stock */}
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold font-heading text-gray-800">{wt(pond.currentStockKg)}</span>
                    <span className="text-sm text-gray-400 mb-1">/ {wt(pond.capacityKg)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                    <div className={clsx('h-2 rounded-full transition-all', barColor)} style={{ width: `${util}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{util}% utilised</p>

                  {/* P&L / FCR */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-green-50 rounded-xl py-2">
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="text-sm font-bold text-green-700">{cur(harvestRev)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl py-2">
                      <p className="text-xs text-gray-400">Cost</p>
                      <p className="text-sm font-bold text-red-600">{cur(pondCost)}</p>
                    </div>
                    <div className={clsx('rounded-xl py-2', harvestRev >= pondCost ? 'bg-blue-50' : 'bg-orange-50')}>
                      <p className="text-xs text-gray-400">FCR</p>
                      <p className={clsx('text-sm font-bold', harvestRev >= pondCost ? 'text-blue-700' : 'text-orange-600')}>{fcrForPond(pond)}</p>
                    </div>
                  </div>

                  {pond.stockingDate && (
                    <p className="text-xs text-gray-400 mb-3">Stocked: {pond.stockingDate}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => { setTxPond(pond); resetTx({ type: 'seed-stock', date: format(new Date(), 'yyyy-MM-dd') }) }}
                      className="flex-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold py-2 rounded-lg transition-all"
                    >
                      Log Transaction
                    </button>
                    <button onClick={() => openEdit(pond)} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-all">
                      <MdEdit className="text-base" />
                    </button>
                    <button onClick={() => handleDeletePond(pond.id)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all">
                      <MdDelete className="text-base" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── Transactions Tab ───────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={filterPond}
              onChange={e => setFilterPond(e.target.value)}
              className="input w-auto text-sm py-1.5"
            >
              <option value="all">All Ponds</option>
              {ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-2 flex-wrap">
              {(['all', ...TX_TYPES] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f as typeof filterType)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize whitespace-nowrap',
                    filterType === f
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {f === 'all' ? 'All' : txLabel[f as PondTransactionType]}
                </button>
              ))}
            </div>
            <span className="ml-auto text-sm text-gray-400 self-center">{filteredTx.length} records</span>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
            ) : filteredTx.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400">No transactions found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Date', 'Pond', 'Type', 'Details', 'Qty/Count', 'Rate', 'Total', 'Party', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map(t => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{t.pondName}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap', txColor[t.type])}>
                            {txLabel[t.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {t.type === 'seed-stock'  && `${t.seedCount?.toLocaleString() ?? '—'} seeds`}
                          {t.type === 'feed-in'     && (t.feedType ?? 'Feed')}
                          {t.type === 'harvest'     && 'Fish / Prawn'}
                          {t.type === 'mortality'   && 'Deaths'}
                          {t.type === 'chemical'    && (t.itemName ?? 'Chemical')}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {t.type === 'seed-stock'  && (t.seedCount ? `${t.seedCount.toLocaleString()} pcs` : '—')}
                          {t.type === 'chemical'    && (t.quantity  ? `${t.quantity} ${t.unit ?? ''}` : '—')}
                          {['feed-in','harvest','mortality'].includes(t.type) && (t.quantityKg ? wt(t.quantityKg) : '—')}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {t.pricePerUnit ? `₹${t.pricePerUnit}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {t.totalAmount ? cur(t.totalAmount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{t.party ?? '—'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteTx(t.id)} className="btn-danger px-2 py-1 text-xs">
                            <MdDelete className="inline mr-1" />Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add / Edit Pond Modal ──────────────────────────────────────────── */}
      {showPondForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-heading font-bold text-gray-900">{editingPond ? 'Edit Pond' : 'Add New Pond'}</h2>
              <button onClick={closePondForm} className="text-gray-400 hover:text-gray-600"><MdClose className="text-xl" /></button>
            </div>
            <form onSubmit={handlePond(onPondSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="label">Pond Name</label>
                  <input type="text" placeholder="e.g. Pond 1" {...regPond('name')} className="input" />
                  {pondErrors.name && <p className="text-red-500 text-xs mt-1">{pondErrors.name.message}</p>}
                </div>

                {/* Type */}
                <div>
                  <label className="label">Pond Type</label>
                  <div className="flex gap-3 mt-2">
                    {(['fish', 'prawn'] as PondType[]).map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" value={t} {...regPond('pondType')} className="accent-brand-500" />
                        <span className="text-sm font-medium capitalize flex items-center gap-1">
                          {t === 'fish' ? <FaFish className="text-blue-500" /> : <GiShrimp className="text-teal-500" />}
                          {t}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Species */}
                <div>
                  <label className="label">Species</label>
                  <select {...regPond('species')} className="input">
                    {speciesList.map(s => <option key={s} value={s} className="capitalize">{s.replace('-', ' ')}</option>)}
                  </select>
                  {pondErrors.species && <p className="text-red-500 text-xs mt-1">{pondErrors.species.message}</p>}
                </div>

                {/* Area */}
                <div>
                  <label className="label">Area (Acres)</label>
                  <input type="number" step="0.01" placeholder="1.5" {...regPond('areaAcres')} className="input" />
                  {pondErrors.areaAcres && <p className="text-red-500 text-xs mt-1">{pondErrors.areaAcres.message}</p>}
                </div>

                {/* Depth */}
                <div>
                  <label className="label">Avg Depth (ft) – optional</label>
                  <input type="number" step="0.1" placeholder="4.5" {...regPond('depthFt')} className="input" />
                </div>

                {/* Capacity */}
                <div>
                  <label className="label">Capacity (kg)</label>
                  <input type="number" placeholder="500" {...regPond('capacityKg')} className="input" />
                  {pondErrors.capacityKg && <p className="text-red-500 text-xs mt-1">{pondErrors.capacityKg.message}</p>}
                </div>

                {/* Current Stock */}
                <div>
                  <label className="label">Current Stock (kg)</label>
                  <input type="number" step="0.1" placeholder="0" {...regPond('currentStockKg')} className="input" />
                  {capacityKg > 0 && <p className="text-xs text-gray-400 mt-1">{utilPct}% utilised</p>}
                </div>

                {/* Status */}
                <div>
                  <label className="label">Status</label>
                  <select {...regPond('status')} className="input">
                    {POND_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>

                {/* Stocking Date */}
                <div>
                  <label className="label">Stocking Date (optional)</label>
                  <input type="date" {...regPond('stockingDate')} className="input" />
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="label">Notes (optional)</label>
                  <textarea rows={2} {...regPond('notes')} className="input resize-none" placeholder="Any remarks" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={closePondForm}>Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                  {saving ? 'Saving…' : editingPond ? 'Update Pond' : 'Add Pond'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Log Transaction Modal ──────────────────────────────────────────── */}
      {txPond && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-heading font-bold text-gray-900">Log Transaction</h2>
                <p className="text-xs text-gray-400">{txPond.name} · Live stock: {wt(txPond.currentStockKg)}</p>
              </div>
              <button onClick={() => setTxPond(null)} className="text-gray-400 hover:text-gray-600"><MdClose className="text-xl" /></button>
            </div>

            <form onSubmit={handleTx(onTxSubmit)} className="p-6 space-y-4">
              {/* Transaction type selection */}
              <div>
                <label className="label mb-2">Transaction Type</label>
                <div className="grid grid-cols-1 gap-2">
                  {TX_TYPES.map(t => (
                    <label key={t} className="flex items-start gap-3 cursor-pointer border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-all has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50">
                      <input type="radio" value={t} {...regTx('type')} className="accent-brand-500 mt-0.5" />
                      <div>
                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', txColor[t])}>{txLabel[t]}</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t === 'seed-stock' && 'Buy fingerlings/seeds and stock into the pond'}
                          {t === 'feed-in'    && 'Feed purchased and fed to the fish/prawns'}
                          {t === 'harvest'    && 'Fish/prawns harvested and sold to buyer'}
                          {t === 'mortality'  && 'Record deaths — reduces live stock estimate'}
                          {t === 'chemical'   && 'Medicines, lime, probiotics, disinfectants'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Common: Date */}
              <div>
                <label className="label">Date</label>
                <input type="date" {...regTx('date')} className="input" />
                {txErrors.date && <p className="text-red-500 text-xs mt-1">{txErrors.date.message}</p>}
              </div>

              {/* ── Seed Stock fields ── */}
              {txType === 'seed-stock' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">No. of Seeds / Fingerlings</label>
                    <input type="number" placeholder="5000" {...regTx('seedCount')} className="input" />
                  </div>
                  <div>
                    <label className="label">Price per Piece (₹)</label>
                    <input type="number" step="0.01" placeholder="0.50" {...regTx('pricePerUnit')} className="input" />
                  </div>
                  <div>
                    <label className="label">Avg Weight per Seed (g) – optional</label>
                    <input type="number" step="0.1" placeholder="2.5" {...regTx('avgWeightGrams')} className="input" />
                  </div>
                  <div>
                    <label className="label">Stocked Weight (kg) – optional</label>
                    <input type="number" step="0.01" placeholder="12.5" {...regTx('quantityKg')} className="input" />
                    <p className="text-xs text-gray-400 mt-1">If blank, computed from count × avg weight</p>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Supplier</label>
                    <input type="text" placeholder="Supplier name" {...regTx('party')} className="input" />
                  </div>
                </div>
              )}

              {/* ── Feed In fields ── */}
              {txType === 'feed-in' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Feed Type</label>
                    <input type="text" placeholder="e.g. Pellets, Organic" {...regTx('feedType')} className="input" />
                  </div>
                  <div>
                    <label className="label">Quantity (kg)</label>
                    <input type="number" step="0.1" placeholder="200" {...regTx('quantityKg')} className="input" />
                  </div>
                  <div>
                    <label className="label">Price per kg (₹)</label>
                    <input type="number" step="0.01" placeholder="0" {...regTx('pricePerUnit')} className="input" />
                  </div>
                  <div>
                    <label className="label">Supplier</label>
                    <input type="text" placeholder="Supplier name" {...regTx('party')} className="input" />
                  </div>
                </div>
              )}

              {/* ── Harvest fields ── */}
              {txType === 'harvest' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Harvested Weight (kg)</label>
                    <input type="number" step="0.1" placeholder="150" {...regTx('quantityKg')} className="input" />
                  </div>
                  <div>
                    <label className="label">Price per kg (₹)</label>
                    <input type="number" step="0.01" placeholder="120" {...regTx('pricePerUnit')} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Buyer</label>
                    <input type="text" placeholder="Buyer / market name" {...regTx('party')} className="input" />
                  </div>
                </div>
              )}

              {/* ── Mortality fields ── */}
              {txType === 'mortality' && (
                <div>
                  <label className="label">Estimated Weight Lost (kg)</label>
                  <input type="number" step="0.1" placeholder="5" {...regTx('quantityKg')} className="input" />
                </div>
              )}

              {/* ── Chemical fields ── */}
              {txType === 'chemical' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Item Name</label>
                    <input type="text" placeholder="e.g. Lime, Probiotic XL" {...regTx('itemName')} className="input" />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <input type="text" placeholder="kg / litre / packet" {...regTx('unit')} className="input" />
                  </div>
                  <div>
                    <label className="label">Quantity</label>
                    <input type="number" step="0.1" placeholder="10" {...regTx('quantity')} className="input" />
                  </div>
                  <div>
                    <label className="label">Price per Unit (₹)</label>
                    <input type="number" step="0.01" placeholder="50" {...regTx('pricePerUnit')} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Supplier</label>
                    <input type="text" placeholder="Supplier name" {...regTx('party')} className="input" />
                  </div>
                </div>
              )}

              {/* Total preview */}
              {derivedTotal > 0 && (
                <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-brand-700">
                    {txType === 'harvest' ? 'Sale Amount' : 'Total Cost'}
                  </span>
                  <span className="text-lg font-bold font-heading text-brand-700">{cur(derivedTotal)}</span>
                </div>
              )}

              {/* Common: Invoice & Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Invoice No. (optional)</label>
                  <input type="text" placeholder="INV-001" {...regTx('invoiceNo')} className="input" />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <input type="text" placeholder="Any remarks" {...regTx('notes')} className="input" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => setTxPond(null)}>Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
