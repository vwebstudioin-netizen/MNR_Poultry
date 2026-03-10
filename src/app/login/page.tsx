'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { GiChicken } from 'react-icons/gi'
import te from '@/lib/te'

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch {
      setError(te.auth.loginFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-500 shadow-lg mb-4">
            <GiChicken className="text-white text-4xl" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">{te.appName}</h1>
          <p className="text-gray-400 text-sm mt-1">{te.auth.tagline}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <h2 className="font-heading font-bold text-xl text-gray-900 mb-1">{te.auth.welcomeBack}</h2>
          <p className="text-xs text-gray-400 mb-6">{te.auth.accessOnly}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{te.auth.email}</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="admin@mnrpoultry.com"
                required
              />
            </div>

            <div>
              <label className="label">{te.auth.password}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-sm disabled:opacity-60 mt-2"
            >
              {loading ? te.auth.logging : te.auth.loginBtn}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">MNR పౌల్ట్రీ © 2026</p>
      </div>
    </div>
  )
}
