'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addEggTransaction, getEggTransactions, deleteEggTransaction } from '@/lib/firestore'
import type { EggTransaction, EggCategory } from '@/types'
import { MdOutlineEgg, MdDelete } from 'react-icons/md'
import { format } from 'date-fns'
import { useLang } from '@/lib/lang-context'

const CATEGORIES: EggCategory[] = ['white-egg', 'brown-egg', 'country-egg', 'broken-egg', 'other']

const schema = z.object({
  type:           z.enum(['import', 'export']),
  date:           z.string().min(1, 'Date required'),
  category:       z.enum(['white-egg', 'brown-egg', 'country-egg', 'broken-egg', 'other']),
  quantityTrays:  z.coerce.number().positive('Must be > 0'),
  pricePerTray:   z.coerce.number().positive('Must be > 0'),
  party:          z.string().min(1, 'Supplier/Buyer required'),
  vehicleNo:      z.string().optional(),
  invoiceNo:      z.string().optional(),
  notes:          z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function EggsPage() {
  const { t: te } = useLang()
  const [transactions, setTransactions] = useState<EggTransaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [filter, setFilter]             = useState<'all' | 'import' | 'export'>('all')
  const [showForm, setShowForm]         = useState(false)

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'export',
      date: format(new Date(), 'yyyy-MM-dd'),
      category: 'white-egg',
    },
  })

  const qty   = watch('quantityTrays')
  const price = watch('pricePerTray')
  const total = (qty && price) ? (qty * price) : 0

  const load = async () => {
    setLoading(true)
    const data = await getEggTransactions()
    setTransactions(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    await addEggTransaction({
      ...data,
      eggs: data.quantityTrays * 30,
      totalAmount: data.quantityTrays * data.pricePerTray,
    })
    reset({ type: 'export', date: format(new Date(), 'yyyy-MM-dd'), category: 'white-egg' })
    setShowForm(false)
    await load()
    setSaving(false)
  }

  const handleDelete = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this transaction?')) return
    await deleteEggTransaction(id)
    await load()
  }

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter)

  const imported  = transactions.filter(t => t.type === 'import').reduce((a, t) => a + t.quantityTrays, 0)
  const exported  = transactions.filter(t => t.type === 'export').reduce((a, t) => a + t.quantityTrays, 0)
  const stock     = imported - exported
  const cost      = transactions.filter(t => t.type === 'import').reduce((a, t) => a + t.totalAmount, 0)
  const revenue   = transactions.filter(t => t.type === 'export').reduce((a, t) => a + t.totalAmount, 0)

  const fmt = (n: number) => n.toLocaleString('en-IN')
  const cur = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlineEgg className="text-brand-500 text-3xl" /> {te.eggs.title}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{te.eggs.subtitle}</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? te.common.cancel : te.eggs.addTx}
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: te.eggs.eggsImported,   value: `${fmt(imported)} ట్రేలు`, sub: `${fmt(imported * 30)} గుడ్లు`, color: 'text-green-600' },
          { label: te.eggs.eggsExported,   value: `${fmt(exported)} ట్రేలు`, sub: `${fmt(exported * 30)} గుడ్లు`, color: 'text-brand-600' },
          { label: te.eggs.currentStock,   value: `${fmt(stock)} ట్రేలు`,   sub: `${fmt(stock * 30)} గుడ్లు`,   color: 'text-blue-600' },
          { label: te.eggs.netRevenue,     value: cur(revenue - cost),         sub: `ఖర్చు ${cur(cost)}`,          color: revenue >= cost ? 'text-green-600' : 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold font-heading mt-1 ${s.color}`}>{s.value}</p>
            {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <h3 className="font-heading font-semibold text-gray-800 border-b border-gray-100 pb-3">{te.eggs.newTx}</h3>

          <div className="flex gap-4">
            {(['import', 'export'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={t} {...register('type')} className="accent-brand-500" />
                <span className="text-sm font-medium capitalize">{t}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="label">{te.common.date}</label>
              <input type="date" {...register('date')} className="input" />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <label className="label">{te.common.category}</label>
              <select {...register('category')} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{te.common.party}</label>
              <input type="text" placeholder="Name" {...register('party')} className="input" />
              {errors.party && <p className="text-red-500 text-xs mt-1">{errors.party.message}</p>}
            </div>
            <div>
              <label className="label">{te.eggs.quantityTrays}</label>
              <input type="number" step="1" placeholder="0" {...register('quantityTrays')} className="input" />
              <p className="text-xs text-gray-400 mt-1">{qty ? `= ${(qty * 30).toLocaleString()} గుడ్లు` : te.eggs.trayInfo}</p>
              {errors.quantityTrays && <p className="text-red-500 text-xs mt-1">{errors.quantityTrays.message}</p>}
            </div>
            <div>
              <label className="label">{te.eggs.pricePerTray}</label>
              <input type="number" step="0.01" placeholder="0.00" {...register('pricePerTray')} className="input" />
              {errors.pricePerTray && <p className="text-red-500 text-xs mt-1">{errors.pricePerTray.message}</p>}
            </div>
            <div>
              <label className="label">{te.common.totalAmount}</label>
              <div className="input bg-gray-50 font-semibold text-gray-700">{cur(total)}</div>
            </div>
            <div>
              <label className="label">{te.common.vehicleNo} ({te.common.optional})</label>
              <input type="text" placeholder="ABC-1234" {...register('vehicleNo')} className="input" />
            </div>
            <div>
              <label className="label">{te.common.invoiceNo} ({te.common.optional})</label>
              <input type="text" placeholder="INV-001" {...register('invoiceNo')} className="input" />
            </div>
            <div>
              <label className="label">{te.common.notes} ({te.common.optional})</label>
              <input type="text" placeholder="Any remarks" {...register('notes')} className="input" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowForm(false)}>{te.common.cancel}</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">
              {saving ? te.common.saving : te.common.save}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'import', 'export'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
              filter === f ? 'bg-brand-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400 self-center">{filtered.length} {te.common.records}</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">{te.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">{te.eggs.noTx}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[te.common.type, te.common.date, te.common.category, te.common.party, te.eggs.tableTrays, te.eggs.tableEggs, te.eggs.tableRate, te.common.totalAmount, te.common.invoiceNo, te.common.actions].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={t.type === 'import' ? 'badge-import' : 'badge-export'}>{t.type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{t.category.replace('-', ' ')}</td>
                    <td className="px-4 py-3 text-gray-700">{t.party}</td>
                    <td className="px-4 py-3 font-medium">{fmt(t.quantityTrays)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(t.quantityTrays * 30)}</td>
                    <td className="px-4 py-3 text-gray-600">₹{t.pricePerTray}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{cur(t.totalAmount)}</td>
                    <td className="px-4 py-3 text-gray-500">{t.invoiceNo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(t.id)} className="btn-danger px-2 py-1 text-xs">
                        <MdDelete className="inline mr-1" /> {te.common.delete}
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
  )
}
