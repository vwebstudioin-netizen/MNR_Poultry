'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  addShed, getSheds, updateShed, deleteShed,
  addChickenMovement, getChickenMovements,
} from '@/lib/firestore'
import type { Shed, ShedType, ShedStatus, ChickenMovement } from '@/types'
import { GiBarn } from 'react-icons/gi'
import { MdDelete, MdEdit, MdClose, MdAdd } from 'react-icons/md'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { useLang } from '@/lib/lang-context'

// ─── Constants ───────────────────────────────────────────────────────────────
const SHED_TYPES: ShedType[]     = ['broiler', 'layer', 'breeder', 'chick', 'other']
const SHED_STATUSES: ShedStatus[] = ['active', 'empty', 'maintenance']
const MOVE_TYPES: ChickenMovement['type'][] = ['placement', 'harvest', 'mortality', 'transfer']

const statusColor: Record<ShedStatus, string> = {
  active:      'bg-green-100 text-green-700',
  empty:       'bg-gray-100 text-gray-500',
  maintenance: 'bg-yellow-100 text-yellow-700',
}
const typeColor: Record<ShedType, string> = {
  broiler: 'bg-orange-100 text-orange-700',
  layer:   'bg-purple-100 text-purple-700',
  breeder: 'bg-blue-100 text-blue-700',
  chick:   'bg-pink-100 text-pink-700',
  other:   'bg-gray-100 text-gray-600',
}
const moveTypeColor: Record<ChickenMovement['type'], string> = {
  placement: 'bg-green-100 text-green-700',
  harvest:   'bg-brand-100 text-brand-700',
  mortality: 'bg-red-100 text-red-700',
  transfer:  'bg-blue-100 text-blue-700',
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const shedSchema = z.object({
  name:         z.string().min(1, 'Shed name required'),
  shedType:     z.enum(['broiler', 'layer', 'breeder', 'chick', 'other']),
  capacity:     z.coerce.number().int().positive('Capacity must be > 0'),
  currentCount: z.coerce.number().int().min(0, 'Count must be ≥ 0'),
  breed:        z.string().optional(),
  placement:    z.string().optional(),
  status:       z.enum(['active', 'empty', 'maintenance']),
  notes:        z.string().optional(),
})

const movementSchema = z.object({
  type:   z.enum(['placement', 'harvest', 'mortality', 'transfer']),
  count:  z.coerce.number().int().positive('Count must be > 0'),
  date:   z.string().min(1, 'Date required'),
  notes:  z.string().optional(),
})

type ShedFormData     = z.infer<typeof shedSchema>
type MovementFormData = z.infer<typeof movementSchema>

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShedsPage() {
  const { t: te } = useLang()
  const [sheds, setSheds]         = useState<Shed[]>([])
  const [movements, setMovements] = useState<ChickenMovement[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  // Modal states
  const [showShedForm, setShowShedForm]         = useState(false)
  const [editingShed, setEditingShed]           = useState<Shed | null>(null)
  const [movingShed, setMovingShed]             = useState<Shed | null>(null)
  const [activeTab, setActiveTab]               = useState<'sheds' | 'movements'>('sheds')
  const [filterMoveType, setFilterMoveType]     = useState<'all' | ChickenMovement['type']>('all')

  // Shed form
  const {
    register: regShed,
    handleSubmit: handleShed,
    reset: resetShed,
    formState: { errors: shedErrors },
    setValue: setShedVal,
    watch: watchShed,
  } = useForm<ShedFormData>({ resolver: zodResolver(shedSchema), defaultValues: { shedType: 'broiler', status: 'active', currentCount: 0 } })

  // Movement form
  const {
    register: regMove,
    handleSubmit: handleMove,
    reset: resetMove,
    formState: { errors: moveErrors },
  } = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'placement', date: format(new Date(), 'yyyy-MM-dd') },
  })

  const currentCount = watchShed('currentCount')
  const capacity     = watchShed('capacity')
  const utilisation  = capacity > 0 ? Math.min(100, Math.round((currentCount / capacity) * 100)) : 0

  const load = async () => {
    setLoading(true)
    const [s, m] = await Promise.all([getSheds(), getChickenMovements()])
    setSheds(s)
    setMovements(m)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Submit shed form ───────────────────────────────────────────────────────
  const onShedSubmit = async (data: ShedFormData) => {
    setSaving(true)
    if (editingShed?.id) {
      await updateShed(editingShed.id, data)
    } else {
      await addShed(data)
    }
    resetShed({ shedType: 'broiler', status: 'active', currentCount: 0 })
    setShowShedForm(false)
    setEditingShed(null)
    await load()
    setSaving(false)
  }

  const openEdit = (shed: Shed) => {
    setEditingShed(shed)
    setShedVal('name',         shed.name)
    setShedVal('shedType',     shed.shedType)
    setShedVal('capacity',     shed.capacity)
    setShedVal('currentCount', shed.currentCount)
    setShedVal('breed',        shed.breed ?? '')
    setShedVal('placement',    shed.placement ?? '')
    setShedVal('status',       shed.status)
    setShedVal('notes',        shed.notes ?? '')
    setShowShedForm(true)
  }

  const closeShedForm = () => {
    setShowShedForm(false)
    setEditingShed(null)
    resetShed({ shedType: 'broiler', status: 'active', currentCount: 0 })
  }

  const handleDeleteShed = async (id?: string) => {
    if (!id) return
    if (!confirm(te.shed.confirmDelete)) return
    await deleteShed(id)
    await load()
  }

  // ── Submit movement ────────────────────────────────────────────────────────
  const onMovementSubmit = async (data: MovementFormData) => {
    if (!movingShed?.id) return
    setSaving(true)

    // Update shed currentCount based on movement type
    let newCount = movingShed.currentCount
    if (data.type === 'placement') newCount += data.count
    if (data.type === 'harvest' || data.type === 'mortality') newCount = Math.max(0, newCount - data.count)
    // transfer doesn't change this shed's count here (manual adjust)

    await Promise.all([
      addChickenMovement({
        shedId:   movingShed.id,
        shedName: movingShed.name,
        type:     data.type,
        count:    data.count,
        date:     data.date,
        notes:    data.notes,
      }),
      updateShed(movingShed.id, {
        currentCount: newCount,
        status: newCount === 0 ? 'empty' : 'active',
      }),
    ])

    resetMove({ type: 'placement', date: format(new Date(), 'yyyy-MM-dd') })
    setMovingShed(null)
    await load()
    setSaving(false)
  }

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalCapacity    = sheds.reduce((a, s) => a + s.capacity, 0)
  const totalChickens    = sheds.reduce((a, s) => a + s.currentCount, 0)
  const totalSheds       = sheds.length
  const activeSheds      = sheds.filter(s => s.status === 'active').length
  const overallUtil      = totalCapacity > 0 ? Math.round((totalChickens / totalCapacity) * 100) : 0

  const filteredMovements = filterMoveType === 'all'
    ? movements
    : movements.filter(m => m.type === filterMoveType)

  const fmt = (n: number) => n.toLocaleString('en-IN')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GiBarn className="text-brand-500 text-3xl" /> {te.shed.title}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{te.shed.subtitle}</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => { setEditingShed(null); setShowShedForm(true) }}>
          <MdAdd className="inline mr-1 text-base" /> {te.shed.addShed}
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: te.shed.totalSheds,    value: totalSheds,         sub: `${activeSheds} ${te.shed.active}`,                  color: 'text-brand-600' },
          { label: te.shed.totalChickens, value: fmt(totalChickens), sub: `of ${fmt(totalCapacity)} ${te.shed.capacity}`,      color: 'text-gray-800' },
          { label: te.shed.utilisation,   value: `${overallUtil}%`,  sub: te.stats.fillRate,                                   color: overallUtil > 80 ? 'text-red-500' : overallUtil > 50 ? 'text-brand-500' : 'text-green-600' },
          { label: te.shed.emptySheds,    value: sheds.filter(s => s.status === 'empty').length, sub: te.shed.available,     color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold font-heading mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {(['sheds', 'movements'] as const).map(tab => (
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
            {tab === 'sheds' ? `${te.shed.sheds} (${totalSheds})` : `${te.shed.movementLog} (${movements.length})`}
          </button>
        ))}
      </div>

      {/* ── Sheds Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'sheds' && (
        loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">{te.common.loading}</div>
        ) : sheds.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
            <GiBarn className="text-5xl text-gray-200" />
            <p>{te.shed.noSheds}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sheds.map(shed => {
              const util = shed.capacity > 0 ? Math.min(100, Math.round((shed.currentCount / shed.capacity) * 100)) : 0
              const barColor = util > 90 ? 'bg-red-500' : util > 70 ? 'bg-brand-500' : 'bg-green-500'
              return (
                <div key={shed.id} className="card relative group hover:shadow-md transition-shadow">
                  {/* Status & type badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', typeColor[shed.shedType])}>
                      {shed.shedType}
                    </span>
                    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', statusColor[shed.status])}>
                      {shed.status}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="font-heading text-lg font-bold text-gray-900 mb-1">{shed.name}</h3>
                  {shed.breed && <p className="text-xs text-gray-400 mb-3">{shed.breed}</p>}

                  {/* Chicken count */}
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold font-heading text-gray-800">{fmt(shed.currentCount)}</span>
                    <span className="text-sm text-gray-400 mb-1">/ {fmt(shed.capacity)} {te.shed.birdsNow.split(' ')[0]}</span>
                  </div>

                  {/* Utilisation bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                    <div
                      className={clsx('h-2 rounded-full transition-all', barColor)}
                      style={{ width: `${util}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mb-4">{util}% {te.shed.utilised.replace('% ', '')}</p>

                  {/* Placement date */}
                  {shed.placement && (
                    <p className="text-xs text-gray-400 mb-3">{te.shed.placementDate}: {shed.placement}</p>
                  )}
                  {shed.notes && (
                    <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">{shed.notes}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => { setMovingShed(shed); resetMove({ type: 'placement', date: format(new Date(), 'yyyy-MM-dd') }) }}
                      className="flex-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold py-2 rounded-lg transition-all"
                    >
                      {te.shed.logMovement}
                    </button>
                    <button
                      onClick={() => openEdit(shed)}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-all"
                    >
                      <MdEdit className="text-base" />
                    </button>
                    <button
                      onClick={() => handleDeleteShed(shed.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-all"
                    >
                      <MdDelete className="text-base" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── Movements Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'placement', 'harvest', 'mortality', 'transfer'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterMoveType(f)}
                className={clsx(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize',
                  filterMoveType === f
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                )}
              >
                {f}
              </button>
            ))}
                <span className="ml-auto text-sm text-gray-400 self-center">{filteredMovements.length} {te.common.records}</span>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">{te.common.loading}</div>
            ) : filteredMovements.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400">{te.shed.noSheds}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {[te.common.date, te.shed.sheds, te.common.type, te.shed.birdCount, te.common.notes].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{m.shedName}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', moveTypeColor[m.type])}>
                            {m.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{fmt(m.count)}</td>
                        <td className="px-4 py-3 text-gray-500">{m.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add/Edit Shed Modal ───────────────────────────────────────────── */}
      {showShedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-heading font-bold text-gray-900">{editingShed ? te.shed.editShed : te.shed.addShedTitle}</h2>
              <button onClick={closeShedForm} className="text-gray-400 hover:text-gray-600">
                <MdClose className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleShed(onShedSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">{te.shed.shedName}</label>
                  <input type="text" placeholder={te.shed.shedPlaceholder} {...regShed('name')} className="input" />
                  {shedErrors.name && <p className="text-red-500 text-xs mt-1">{shedErrors.name.message}</p>}
                </div>
                <div>
                  <label className="label">{te.shed.shedType}</label>
                  <select {...regShed('shedType')} className="input">
                    {SHED_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{te.shed.capacity}</label>
                  <input type="number" placeholder="5000" {...regShed('capacity')} className="input" />
                  {shedErrors.capacity && <p className="text-red-500 text-xs mt-1">{shedErrors.capacity.message}</p>}
                </div>
                <div>
                  <label className="label">{te.shed.currentCount}</label>
                  <input type="number" placeholder="0" {...regShed('currentCount')} className="input" />
                  {shedErrors.currentCount && <p className="text-red-500 text-xs mt-1">{shedErrors.currentCount.message}</p>}
                  {capacity > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{utilisation}% {te.shed.utilised.replace('% ', '')}</p>
                  )}
                </div>
                <div>
                  <label className="label">{te.common.status}</label>
                  <select {...regShed('status')} className="input">
                    {SHED_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{te.shed.breed} ({te.common.optional})</label>
                  <input type="text" placeholder={te.shed.breedPlaceholder} {...regShed('breed')} className="input" />
                </div>
                <div>
                  <label className="label">{te.shed.placementDate} ({te.common.optional})</label>
                  <input type="date" {...regShed('placement')} className="input" />
                </div>
                <div className="col-span-2">
                  <label className="label">{te.common.notes} ({te.common.optional})</label>
                  <textarea rows={2} placeholder={te.shed.notesPlaceholder} {...regShed('notes')} className="input resize-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={closeShedForm}>{te.common.cancel}</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                  {saving ? te.common.saving : editingShed ? te.shed.updateShed : te.shed.addShed}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Log Chicken Movement Modal ────────────────────────────────────── */}
      {movingShed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-heading font-bold text-gray-900">{te.shed.logMovement}</h2>
                <p className="text-xs text-gray-400">{movingShed.name} — {fmt(movingShed.currentCount)} {te.shed.birdsNow}</p>
              </div>
              <button onClick={() => setMovingShed(null)} className="text-gray-400 hover:text-gray-600">
                <MdClose className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleMove(onMovementSubmit)} className="p-6 space-y-4">
              {/* Movement type radios */}
              <div>
                <label className="label mb-2">{te.shed.movementType}</label>
                <div className="grid grid-cols-2 gap-2">
                  {MOVE_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-all has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50">
                      <input type="radio" value={t} {...regMove('type')} className="accent-brand-500" />
                      <div>
                        <span className="text-sm font-medium capitalize">{t}</span>
                        <p className="text-xs text-gray-400">
                          {t === 'placement' && te.shed.placementDesc}
                          {t === 'harvest'   && te.shed.harvestDesc}
                          {t === 'mortality' && te.shed.mortalityDesc}
                          {t === 'transfer'  && te.shed.transferDesc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {moveErrors.type && <p className="text-red-500 text-xs mt-1">{moveErrors.type.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{te.common.date}</label>
                  <input type="date" {...regMove('date')} className="input" />
                  {moveErrors.date && <p className="text-red-500 text-xs mt-1">{moveErrors.date.message}</p>}
                </div>
                <div>
                  <label className="label">{te.shed.birdCount}</label>
                  <input type="number" min="1" placeholder="0" {...regMove('count')} className="input" />
                  {moveErrors.count && <p className="text-red-500 text-xs mt-1">{moveErrors.count.message}</p>}
                </div>
              </div>

              <div>
                <label className="label">{te.common.notes} ({te.common.optional})</label>
                <input type="text" placeholder="e.g. Batch #5, local market" {...regMove('notes')} className="input" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => setMovingShed(null)}>{te.common.cancel}</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">
                  {saving ? te.common.saving : te.shed.logMovement}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
