'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import te from './te'
import en from './en'

type Lang = 'te' | 'en'
type Translations = typeof te  // te and en share the same shape

interface LangContextValue {
  lang:       Lang
  t:          Translations
  toggleLang: () => void
}

const LangContext = createContext<LangContextValue>({
  lang:       'te',
  t:          te,
  toggleLang: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('te')

  // Hydrate from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('mnr-lang') as Lang | null
    if (saved === 'en' || saved === 'te') setLang(saved)
  }, [])

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'te' ? 'en' : 'te'
      localStorage.setItem('mnr-lang', next)
      return next
    })
  }

  const t = lang === 'te' ? (te as unknown as Translations) : (en as unknown as Translations)

  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
