'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addFeedTransaction, getFeedTransactions, deleteFeedTransaction } from '@/lib/firestore'
import type { FeedTransaction, FeedCategory } from '@/types'
import { FaWheatAwn } from 'react-icons/fa6'
import { MdDelete } from 'react-icons/md'
import { format } from 'date-fns'
import te from '@/lib/te'

const CATEGORIES: FeedCategory[] = ['corn', 'soybean', 'wheat', 'premix', 'rice-bran', 'other']

const schema = z.object({
  type:        z.enum(['import', 'export']),
  date:        z.string().min(1, 'Date required'),
  category:    z.enum(['corn', 'soybean', 'wheat', 'premix', 'rice-bran', 'other']),
  quantityKg:  z.coerce.number().positive('Must be > 0'),
  pricePerKg:  z.coerce.number().positive('Must be > 0'),
  party:       z.string().min(1, 'Supplier/Buyer required'),
  vehicleNo:   z.string().optional(),
  invoiceNo:   z.string().optional(),
  notes:       z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function FeedPage() {
  const [transactions, setTransactions] = useState<FeedTransaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [filter, setFilter]             = useState<'all' | 'import' | 'export'>('all')
  const [showForm, setShowForm]         = useState(false)

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'import',
      date: format(new Date(), 'yyyy-MM-dd'),
      category: 'corn',
    },
  })

  const qty   = watch('quantityKg')
  const price = watch('pricePerKg')
  const total = (qty && price) ? (qty * price) : 0

  const load = async () => {
    setLoading(true)
    const data = await getFeedTransactions()
    setTransactions(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    await addFeedTransaction({
      ...data,
      totalAmount: data.quantityKg * data.pricePerKg,
    })
    reset({ type: 'import', date: format(new Date(), 'yyyy-MM-dd'), category: 'corn' })
    setShowForm(false)
    await load()
    setSaving(false)
  }

  const handleDelete = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this transaction?')) return
    await deleteFeedTransaction(id)
    await load()
  }

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter)

  // Stock
  const imported = transactions.filter(t => t.type === 'import').reduce((a, t) => a + t.quantityKg, 0)
  const exported = transactions.filter(t => t.type === 'export').reduce((a, t) => a + t.quantityKg, 0)
  const stock    = imported - exported
  const cost     = transactions.filter(t => t.type === 'import').reduce((a, t) => a + t.totalAmount, 0)
  const revenue  = transactions.filter(t => t.type === 'export').reduce((a, t) => a + t.totalAmount, 0)

  const fmt = (n: number) => n.toLocaleString('en-IN')
  const cur = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaWheatAwn className="text-brand-500" /> {te.feed.title}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{te.feed.subtitle}</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? te.common.cancel : te.feed.addTx}
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: te.feed.totalImported, value: `${fmt(imported)} kg`, color: 'text-green-600' },
          { label: te.feed.totalExported, value: `${fmt(exported)} kg`, color: 'text-brand-600' },
          { label: te.feed.currentStock,  value: `${fmt(stock)} kg`,    color: 'text-blue-600' },
          { label: te.common.netPL,       value: cur(revenue - cost),   color: revenue >= cost ? 'text-green-600' : 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold font-heading mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <h3 className="font-heading font-semibold text-gray-800 border-b border-gray-100 pb-3">{te.feed.newTx}</h3>

          {/* Type */}
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
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{te.common.party}</label>
              <input type="text" placeholder="Name" {...register('party')} className="input" />
              {errors.party && <p className="text-red-500 text-xs mt-1">{errors.party.message}</p>}
            </div>
            <div>
              <label className="label">{te.feed.quantityKg}</label>
              <input type="number" step="0.01" placeholder="0" {...register('quantityKg')} className="input" />
              {errors.quantityKg && <p className="text-red-500 text-xs mt-1">{errors.quantityKg.message}</p>}
            </div>
            <div>
              <label className="label">{te.feed.pricePerKg}</label>
              <input type="number" step="0.01" placeholder="0.00" {...register('pricePerKg')} className="input" />
              {errors.pricePerKg && <p className="text-red-500 text-xs mt-1">{errors.pricePerKg.message}</p>}
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
          <div className="flex items-center justify-center h-40 text-gray-400">{te.feed.noTx}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[te.feed.tableType, te.feed.tableDate, te.feed.tableCategory, te.feed.tableParty, te.feed.tableQty, te.feed.tableRate, te.feed.tableTotal, te.feed.tableInvoice, te.feed.tableActions].map(h => (
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
                    <td className="px-4 py-3 text-gray-700 capitalize">{t.category}</td>
                    <td className="px-4 py-3 text-gray-700">{t.party}</td>
                    <td className="px-4 py-3 font-medium">{fmt(t.quantityKg)}</td>
                    <td className="px-4 py-3 text-gray-600">₹{t.pricePerKg}</td>
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
