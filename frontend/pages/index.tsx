import React, { useEffect } from 'react'
import Router from 'next/router'

export default function Home() {
  useEffect(() => {
    Router.replace('/login')
  }, [])

  return (
    <main className="h-screen overflow-hidden flex items-center justify-center bg-[color:var(--brand-ink)]">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 text-white shadow-2xl">
        <div className="text-xs text-white/70">iiDmage</div>
        <div className="mt-3 flex items-center" role="status" aria-label="Chargement">
          <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" aria-hidden />
          <span className="sr-only">Chargement…</span>
        </div>
      </div>
    </main>
  )
}
