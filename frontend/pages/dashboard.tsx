import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Router from 'next/router'

type Role = 'OWNER' | 'MANAGER' | 'POSEUR' | 'READONLY'

type Commande = {
  id: string
  product?: string | null
  etat?: string | null
  date_production?: string | null
  date_expedition?: string | null
  date_livraison?: string | null
  date_pose?: string | null
  done_production_at?: string | null
  done_expedition_at?: string | null
  done_livraison_at?: string | null
  done_pose_at?: string | null
  updatedAt: string
  client: { id: string; name: string }
  poseur?: { id: string; name: string } | null
}

type Me = { id: string; email: string; name?: string | null; role: Role }

type Alert = { level: 'URGENT' | 'RISQUE'; label: string; id: string }

type KpiKey = 'EN_PRODUCTION' | 'A_EXPEDIER' | 'A_POSER' | 'EN_RETARD'

type Lateness = 'OVERDUE' | 'TODAY' | null

function isoYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstDateForKpi(c: Commande, key: KpiKey) {
  switch (key) {
    case 'EN_PRODUCTION':
      return safeDate(c.date_production)
    case 'A_EXPEDIER':
      return safeDate(c.date_expedition)
    case 'A_POSER':
      return safeDate(c.date_pose)
    case 'EN_RETARD':
      return latenessForCommande(c, startOfToday()).due
    default:
      return null
  }
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center justify-center w-5 h-5">{children}</span>
}

function NavLink({
  href,
  label,
  sidebarOpen,
  ready,
  icon,
  title
}: {
  href: string
  label: string
  sidebarOpen: boolean
  ready: boolean
  icon: React.ReactNode
  title?: string
}) {
  return (
    <Link
      href={href}
      title={title || label}
      className={`flex items-center ${sidebarOpen ? 'justify-start px-3 gap-3' : 'justify-center px-2 gap-0'} py-2 rounded-lg transition text-gray-800 hover:bg-gray-100`}
    >
      <span className="shrink-0">{icon}</span>
      <span
        className={`overflow-hidden whitespace-nowrap ${ready ? 'transition-all duration-300' : ''} ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}
      >
        <span className="truncate">{label}</span>
      </span>
    </Link>
  )
}

function BellIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17H9" />
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token') || sessionStorage.getItem('token')
}

function authFetch(input: RequestInfo, init?: RequestInit) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  if (token) (headers as any).authorization = `Bearer ${token}`
  return fetch(input, { ...init, headers })
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function addDays(d: Date, days: number) {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function safeDate(value?: string | null) {
  if (!value) return null
  const raw = String(value).trim()
  // Parse YYYY-MM-DD *and* ISO strings that start with YYYY-MM-DD as local noon
  // to prevent timezone shifting the day.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function dateOnly(d: Date) {
  const out = new Date(d)
  out.setHours(12, 0, 0, 0)
  return out
}

function deriveEtat(c: Commande) {
  const poseDone = safeDate(c.done_pose_at)
  if (poseDone) return 'POSEE'

  const livraisonDone = safeDate(c.done_livraison_at)
  if (livraisonDone) return 'A_POSER'

  const expeditionDone = safeDate(c.done_expedition_at)
  if (expeditionDone) return 'LIVREE'

  const productionDone = safeDate(c.done_production_at)
  if (productionDone) return 'A_EXPEDIER'

  const production = safeDate(c.date_production)
  if (production) return 'EN_PRODUCTION'

  return 'A_PLANIFIER'
}

function displayEtat(c: Commande) {
  const raw = (c.etat || '').trim()
  if (raw === 'FACTURE_A_ENVOYER' || raw === 'FACTUREE') return raw
  return deriveEtat(c)
}

function latenessForCommande(c: Commande, today: Date): { lateness: Lateness; kindLabel: string | null; due: Date | null } {
  const base = displayEtat(c)
  if (base === 'FACTURE_A_ENVOYER' || base === 'FACTUREE') return { lateness: null, kindLabel: null, due: null }
  if (safeDate(c.done_pose_at)) return { lateness: null, kindLabel: null, due: null }

  function calc(dueRaw: string | null | undefined, doneRaw: string | null | undefined, kindLabel: string): { lateness: Lateness; kindLabel: string | null; due: Date | null } {
    const due = safeDate(dueRaw)
    if (!due) return { lateness: null, kindLabel: null, due: null }
    const done = safeDate(doneRaw)
    if (done) return { lateness: null, kindLabel: null, due }
    const diff = Math.floor((dateOnly(due).getTime() - dateOnly(today).getTime()) / (24 * 60 * 60 * 1000))
    if (diff < 0) return { lateness: 'OVERDUE', kindLabel, due }
    if (diff === 0) return { lateness: 'TODAY', kindLabel, due }
    return { lateness: null, kindLabel: null, due }
  }

  switch (base) {
    case 'EN_PRODUCTION':
      return calc(c.date_production, c.done_production_at, 'Production')
    case 'A_EXPEDIER':
      return calc(c.date_expedition, c.done_expedition_at, 'Expédition')
    case 'LIVREE':
      return calc(c.date_livraison, c.done_livraison_at, 'Livraison')
    case 'A_POSER':
      return calc(c.date_pose, c.done_pose_at, 'Pose')
    default:
      return { lateness: null, kindLabel: null, due: null }
  }
}

function badge(level: Alert['level']) {
  if (level === 'URGENT') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-orange-100 text-orange-700 border-orange-200'
}

function etatDisplay(value: string) {
  const map: Record<string, { label: string; cls: string }> = {
    A_PLANIFIER: { label: 'À planifier', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    EN_PRODUCTION: { label: 'En production', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    A_EXPEDIER: { label: 'À expédier', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    LIVREE: { label: 'À livrer', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    A_POSER: { label: 'À poser', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    POSEE: { label: 'Posée', cls: 'bg-green-50 text-green-700 border-green-200' },
    FACTURE_A_ENVOYER: { label: 'Facture à envoyer', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    FACTUREE: { label: 'Facturée', cls: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
  return map[value] || { label: value, cls: 'bg-gray-100 text-gray-700 border-gray-200' }
}

export default function DashboardPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const [me, setMe] = useState<Me | null>(null)
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({})
  const [favoriteCommandes, setFavoriteCommandes] = useState<Record<string, boolean>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarInitialized, setSidebarInitialized] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false)
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [openKpi, setOpenKpi] = useState<KpiKey | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('iidmage_dismissed_alerts')
      const arr = raw ? (JSON.parse(raw) as any) : []
      const ids = Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
      const map: Record<string, boolean> = {}
      for (const id of ids) map[id] = true
      setDismissedAlerts(map)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    function load() {
      try {
        const raw = localStorage.getItem('iidmage_favorite_commandes')
        const arr = raw ? (JSON.parse(raw) as any) : []
        const ids = Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
        const map: Record<string, boolean> = {}
        for (const id of ids) map[id] = true
        setFavoriteCommandes(map)
      } catch {
        // ignore
      }
    }

    load()
    function onStorage(e: StorageEvent) {
      if (e.key === 'iidmage_favorite_commandes') load()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function dismissAlert(id: string) {
    setDismissedAlerts(prev => {
      if (prev[id]) return prev
      const next = { ...prev, [id]: true }
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('iidmage_dismissed_alerts', JSON.stringify(Object.keys(next)))
        }
      } catch {
        // ignore
      }
      return next
    })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('iidmage_sidebar_open')
      if (raw === '0') setSidebarOpen(false)
      else setSidebarOpen(true)
      if (raw !== '0' && raw !== '1') {
        localStorage.setItem('iidmage_sidebar_open', '1')
      }
    } catch {
      // ignore
    }
    window.requestAnimationFrame(() => setSidebarInitialized(true))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!sidebarInitialized) return
    try {
      localStorage.setItem('iidmage_sidebar_open', sidebarOpen ? '1' : '0')
    } catch {
      // ignore
    }
  }, [sidebarOpen, sidebarInitialized])

  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuMounted(true)
      setMobileMenuClosing(false)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      Router.replace('/login')
      return
    }
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [meRes, cmdRes] = await Promise.all([
          authFetch(`${API_URL}/me`),
          authFetch(`${API_URL}/commandes`)
        ])
        if (meRes.status === 401 || cmdRes.status === 401) {
          Router.replace('/login')
          return
        }
        if (!meRes.ok) throw new Error('Erreur /me')
        if (!cmdRes.ok) throw new Error('Erreur /commandes')
        setMe(await meRes.json())
        setCommandes(await cmdRes.json())
      } catch (e: any) {
        setError(e?.message || 'Erreur')
      } finally {
        setLoading(false)
      }
    })()
  }, [API_URL])

  const computed = useMemo(() => {
    const today = startOfToday()
    const in7 = addDays(today, 7)
    const in2 = addDays(today, 2)

    const enProductionList = commandes.filter(c => safeDate(c.date_production) && !safeDate(c.date_expedition))
    const enProduction = enProductionList.length

    const aExpedier7jList = commandes.filter(c => {
      const d = safeDate(c.date_expedition)
      return d != null && d >= today && d <= in7
    })
    const aExpedier7j = aExpedier7jList.length

    const aPoser7jList = commandes.filter(c => {
      const d = safeDate(c.date_pose)
      return d != null && d >= today && d <= in7
    })
    const aPoser7j = aPoser7jList.length

    const enRetardList = commandes.filter(c => latenessForCommande(c, today).lateness === 'OVERDUE')
    const enRetard = enRetardList.length

    const urgentesAll: Alert[] = commandes
      .map(c => ({ c, info: latenessForCommande(c, today) }))
      .filter(x => x.info.lateness === 'OVERDUE' && x.info.due != null && x.info.kindLabel)
      .map(x => {
        const days = Math.max(1, Math.ceil((today.getTime() - (x.info.due as Date).getTime()) / (1000 * 60 * 60 * 24)))
        return {
          level: 'URGENT' as const,
          label: `${x.info.kindLabel} dépassée: ${x.c.client?.name || ''} (${days}j)`,
          id: x.c.id
        }
      })

    const risquesAll: Alert[] = commandes
      .map(c => ({ c, pose: safeDate(c.date_pose), done: safeDate(c.done_pose_at) }))
      .filter(x => x.pose != null && x.pose >= today && x.pose <= in2)
      .filter(x => !x.done)
      .filter(x => !safeDate(x.c.date_livraison) || !safeDate(x.c.date_production))
      .map(x => ({
        level: 'RISQUE' as const,
        label: `Pose < 48h: ${x.c.client?.name || ''} (livraison/production manquante)`,
        id: x.c.id
      }))

    const allAlerts = [...urgentesAll, ...risquesAll].filter(a => !dismissedAlerts[a.id])
    const alertsCount = allAlerts.length
    const alerts = allAlerts

    const favoriteList = commandes.filter(c => !!favoriteCommandes[c.id])
    const favoriteItems = favoriteList
      .slice()
      .sort((a, b) => {
        const la = latenessForCommande(a, today).lateness
        const lb = latenessForCommande(b, today).lateness
        const ra = la === 'OVERDUE' ? 2 : la === 'TODAY' ? 1 : 0
        const rb = lb === 'OVERDUE' ? 2 : lb === 'TODAY' ? 1 : 0
        if (rb !== ra) return rb - ra
        return (a.client?.name || '').localeCompare(b.client?.name || '')
      })
      .slice(0, 5)

    const dernieresModifs = commandes
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)

    return {
      enProduction,
      aExpedier7j,
      aPoser7j,
      enRetard,
      enProductionList,
      aExpedier7jList,
      aPoser7jList,
      enRetardList,
      alertsCount,
      alerts,
      favoriteItems,
      dernieresModifs
    }
  }, [commandes, dismissedAlerts, favoriteCommandes])

  const kpiPanel = useMemo(() => {
    if (!openKpi) return null
    const items =
      openKpi === 'EN_PRODUCTION'
        ? computed.enProductionList
        : openKpi === 'A_EXPEDIER'
          ? computed.aExpedier7jList
          : openKpi === 'A_POSER'
            ? computed.aPoser7jList
              : computed.enRetardList

    const title =
      openKpi === 'EN_PRODUCTION'
        ? 'En production'
        : openKpi === 'A_EXPEDIER'
          ? 'À expédier (prochains 7 jours)'
          : openKpi === 'A_POSER'
            ? 'À poser (prochains 7 jours)'
            : 'En retard'

    return { title, items }
  }, [openKpi, computed])

  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
    }
    Router.replace('/login')
  }

  function closeOverlays() {
    if (mobileMenuMounted) {
      setMobileMenuClosing(true)
      setTimeout(() => {
        setMobileMenuOpen(false)
        setMobileMenuMounted(false)
        setMobileMenuClosing(false)
      }, 220)
    } else {
      setMobileMenuOpen(false)
    }
    setNotificationsOpen(false)
  }

  function openNotifications() {
    setNotificationsOpen(v => !v)
    setMobileMenuOpen(false)
  }

  function navigateAndClose(path: string) {
    closeOverlays()
    Router.push(path)
  }

  const iconBtnClass =
    'inline-flex items-center justify-center min-w-[44px] min-h-[44px] h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]'

  const sidebarToggleClass =
    'inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-gray-700 hover:text-gray-900 rounded transition border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]'

  return (
    <div className="h-screen overflow-hidden bg-[color:var(--brand-ink)]">
      <div className="h-screen bg-transparent overflow-hidden">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside
            className={`hidden md:flex flex-col overflow-hidden ${sidebarInitialized ? 'transition-all duration-300 ease-out' : ''} ${sidebarOpen ? 'w-72' : 'w-20'} bg-white border-r border-gray-200`}
          >
            <div className={`p-4 flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
              {sidebarOpen && (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gray-900/5 border border-gray-200" title="iiDmage" />
                  <div
                    className={`font-extrabold tracking-tight text-gray-900 text-xl overflow-hidden whitespace-nowrap ${sidebarInitialized ? 'transition-all duration-300' : ''} ${sidebarOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'}`}
                  >
                    iiDmage
                  </div>
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className={sidebarToggleClass}
                title={sidebarOpen ? 'Réduire' : 'Ouvrir'}
                aria-label={sidebarOpen ? 'Réduire' : 'Ouvrir'}
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 4v16" />
                  {sidebarOpen ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
                </svg>
              </button>
            </div>

            <nav className="px-2 pb-4 space-y-1">
              <NavLink
                href="/dashboard"
                label="Dashboard"
                sidebarOpen={sidebarOpen}
                ready={sidebarInitialized}
                icon={
                  <Icon>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 13V6a2 2 0 012-2h12a2 2 0 012 2v7" />
                      <path d="M4 13a2 2 0 002 2h3" />
                      <path d="M20 13a2 2 0 01-2 2h-3" />
                      <path d="M9 22v-6a3 3 0 013-3h0a3 3 0 013 3v6" />
                      <path d="M10 8h4" />
                    </svg>
                  </Icon>
                }
              />
              <NavLink
                href="/commandes?view=list"
                label="Commandes"
                sidebarOpen={sidebarOpen}
                ready={sidebarInitialized}
                icon={
                  <Icon>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </Icon>
                }
              />
              <NavLink
                href="/calendrier"
                label="Calendrier"
                sidebarOpen={sidebarOpen}
                ready={sidebarInitialized}
                icon={
                  <Icon>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2v3" />
                      <path d="M16 2v3" />
                      <path d="M3 9h18" />
                      <path d="M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                    </svg>
                  </Icon>
                }
              />
              <NavLink
                href="/clients"
                label="Clients"
                sidebarOpen={sidebarOpen}
                ready={sidebarInitialized}
                icon={
                  <Icon>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7h18" />
                      <path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2" />
                      <path d="M6 7v14a2 2 0 002 2h8a2 2 0 002-2V7" />
                      <path d="M10 11h4" />
                      <path d="M10 15h4" />
                    </svg>
                  </Icon>
                }
              />
              <NavLink
                href="/poseurs"
                label="Poseurs"
                sidebarOpen={sidebarOpen}
                ready={sidebarInitialized}
                icon={
                  <Icon>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 6V5a2 2 0 012-2h0a2 2 0 012 2v1" />
                      <path d="M4 7h16" />
                      <path d="M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7" />
                      <path d="M9 13h6" />
                    </svg>
                  </Icon>
                }
              />
              <NavLink
                href="/profile"
                label="Mon profil"
                sidebarOpen={sidebarOpen}
                ready={sidebarInitialized}
                icon={
                  <Icon>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
                      <path d="M6 20v-1a6 6 0 0112 0v1" />
                      <path d="M8 20h8" />
                    </svg>
                  </Icon>
                }
              />
              {me?.role === 'OWNER' && (
                <NavLink
                  href="/users"
                  label="Administration"
                  sidebarOpen={sidebarOpen}
                  ready={sidebarInitialized}
                  icon={
                    <Icon>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01A1.65 1.65 0 009 3.09V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                      </svg>
                    </Icon>
                  }
                />
              )}
            </nav>

            <div className="mt-auto p-4 border-t border-gray-200">
              {sidebarOpen ? (
                <>
                  <div className="text-sm font-semibold text-gray-900 truncate">{me?.name || me?.email || '—'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{me?.role || '—'}</div>
                  <button
                    onClick={logout}
                    className="mt-3 w-full px-3 py-2 rounded-lg text-sm transition hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                    title="Déconnexion"
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center h-10 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                    title="Déconnexion"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 h-screen overflow-hidden relative bg-[color:var(--color-bg)]">
            {/* Topbar (mobile/compact) */}
            <div className="md:hidden px-4 py-3 flex items-center justify-between relative bg-white/80 border-b border-gray-200">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={iconBtnClass}
                title="Menu"
                aria-label="Menu"
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>
              <div className="font-extrabold tracking-tight text-gray-900">iiDmage</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openNotifications}
                  className={`relative ${iconBtnClass} ${computed.alertsCount > 0 ? 'animate-pulse' : ''}`}
                  title="Notifications"
                  aria-label="Notifications"
                  type="button"
                >
                  <BellIcon className="w-5 h-5" />
                  {computed.alertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-1 rounded-full bg-red-600 text-white">
                      {computed.alertsCount > 99 ? '99+' : computed.alertsCount}
                    </span>
                  )}
                </button>
                <button onClick={logout} className={iconBtnClass} title="Déconnexion" aria-label="Déconnexion" type="button">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile drawer */}
            {(mobileMenuOpen || mobileMenuMounted) && (
              <div className="md:hidden fixed inset-0 z-50">
                <div
                  className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${mobileMenuClosing ? 'opacity-0' : 'opacity-100 anim-overlay-in'}`}
                  onClick={closeOverlays}
                />
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[84%] max-w-xs bg-white border-r border-gray-200 p-4 will-change-transform shadow-2xl ${
                    mobileMenuClosing ? 'anim-drawer-out' : 'anim-drawer-in'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold tracking-tight text-gray-900">iiDmage</div>
                    <button onClick={closeOverlays} className={iconBtnClass} title="Fermer" aria-label="Fermer" type="button">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-4 space-y-1">
                    <button onClick={() => navigateAndClose('/dashboard')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Dashboard</button>
                    <button onClick={() => navigateAndClose('/commandes?view=list')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Commandes</button>
                    <button onClick={() => navigateAndClose('/calendrier')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Calendrier</button>
                    <button onClick={() => navigateAndClose('/clients')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Clients</button>
                    <button onClick={() => navigateAndClose('/poseurs')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Poseurs</button>
                      <button onClick={() => navigateAndClose('/profile')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Mon profil</button>
                    {me?.role === 'OWNER' && (
                      <button onClick={() => navigateAndClose('/users')} className="w-full text-left px-3 py-2 rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]">Administration</button>
                    )}
                  </div>
                  <div className="mt-6 border-t border-gray-200 pt-4">
                    <div className="text-sm font-semibold text-gray-900 truncate">{me?.name || me?.email || '—'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{me?.role || '—'}</div>
                    <button
                      onClick={logout}
                      className="mt-3 w-full px-3 py-2 rounded-lg text-sm transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                      type="button"
                    >
                      Déconnexion
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 md:p-10 h-[calc(100vh-56px)] md:h-screen overflow-hidden">
              <div className="shadow-2xl border h-full overflow-hidden bg-white border-gray-200">
                <div className="p-6 md:p-8 h-full overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-1">
                        {me?.name || me?.email || '—'}
                      </h1>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={openNotifications}
                          className={`relative ${iconBtnClass} ${computed.alertsCount > 0 ? 'animate-pulse' : ''}`}
                          title="Notifications"
                          aria-label="Notifications"
                          type="button"
                        >
                          <BellIcon className="w-5 h-5" />
                          {computed.alertsCount > 0 && (
                            <span className="absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-1 rounded-full bg-red-600 text-white">
                              {computed.alertsCount > 99 ? '99+' : computed.alertsCount}
                            </span>
                          )}
                        </button>

                        {notificationsOpen && (
                          <div className="fixed md:absolute z-40 inset-x-3 top-[72px] md:inset-auto md:right-0 md:top-12 md:w-[92vw] md:max-w-md">
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-96px)] md:max-h-none">
                              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                <div className="font-semibold text-gray-900">Notifications</div>
                                <button className={iconBtnClass} onClick={() => setNotificationsOpen(false)} title="Fermer" aria-label="Fermer" type="button">
                                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              {loading ? (
                                <div className="p-4 text-sm text-gray-600 bg-gray-50 animate-pulse">Chargement…</div>
                              ) : (
                                <div className="overflow-auto max-h-[calc(100vh-180px)] md:max-h-[60vh]">
                                  {computed.favoriteItems.length > 0 ? (
                                    <div className="border-b border-gray-100">
                                      <div className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">
                                        Favoris
                                      </div>
                                      <ul className="divide-y">
                                        {computed.favoriteItems.map(c => {
                                          const base = displayEtat(c)
                                          const baseInfo = etatDisplay(base)
                                          const info = latenessForCommande(c, startOfToday())
                                          return (
                                            <li key={`fav-${c.id}`}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setNotificationsOpen(false)
                                                  Router.push(`/commandes/${encodeURIComponent(c.id)}`)
                                                }}
                                                className="w-full p-4 hover:bg-gray-50 transition text-left"
                                                title="Ouvrir la commande"
                                              >
                                                <div className="flex items-start justify-between gap-3">
                                                  <div className="min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">{c.client?.name || '—'}</div>
                                                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                      <span className={`inline-flex text-xs border rounded-full px-2 py-1 ${baseInfo.cls}`}>{baseInfo.label}</span>
                                                      {info.lateness === 'OVERDUE' ? (
                                                        <span className="inline-flex text-xs border rounded-full px-2 py-1 border-red-200 bg-red-50 text-red-700">En retard</span>
                                                      ) : info.lateness === 'TODAY' ? (
                                                        <span className="inline-flex text-xs border rounded-full px-2 py-1 border-amber-200 bg-amber-50 text-amber-900">Aujourd’hui</span>
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                  <svg
                                                    className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden
                                                  >
                                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                                                  </svg>
                                                </div>
                                              </button>
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {computed.alerts.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-500">Aucune notification.</div>
                                  ) : (
                                    <ul className="divide-y">
                                      {computed.alerts.map(a => (
                                        <li key={`${a.level}-${a.id}`}>
                                          <div className="w-full p-4 hover:bg-gray-50 transition flex items-start gap-3">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setNotificationsOpen(false)
                                                Router.push(`/commandes/${encodeURIComponent(a.id)}`)
                                              }}
                                              className="flex-1 text-left min-w-0 flex items-start gap-3"
                                              title="Ouvrir la commande"
                                            >
                                              <span
                                                className={`mt-1 h-2.5 w-2.5 rounded-full ${a.level === 'URGENT' ? 'bg-red-600' : 'bg-orange-500'}`}
                                                aria-hidden
                                              />
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate">{a.label}</div>
                                                <div className="mt-1">
                                                  <span className={`inline-flex text-xs border rounded-full px-2 py-1 ${badge(a.level)}`}>{a.level}</span>
                                                </div>
                                              </div>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => dismissAlert(a.id)}
                                              className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                              title="Marquer comme vu"
                                              aria-label="Marquer comme vu"
                                            >
                                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <path d="M18 6L6 18" />
                                                <path d="M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <Link
                        href="/commandes?view=list"
                        className="px-4 py-2 rounded-lg font-semibold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]"
                      >
                        Ouvrir commandes
                      </Link>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}

                  {/* 1) KPI */}
                  <section className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-700">Indicateurs</h2>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => setOpenKpi(k => (k === 'EN_PRODUCTION' ? null : 'EN_PRODUCTION'))}
                        className="text-left bg-white border border-gray-200 rounded-xl p-4 transition hover:shadow-sm active:scale-[0.99]"
                        title="Voir les commandes"
                      >
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v18h18" />
                            <path d="M7 14l3-3 4 4 6-6" />
                          </svg>
                          En production
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-2">{loading ? '—' : computed.enProduction}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenKpi(k => (k === 'A_EXPEDIER' ? null : 'A_EXPEDIER'))}
                        className="text-left bg-white border border-gray-200 rounded-xl p-4 transition hover:shadow-sm active:scale-[0.99]"
                        title="Voir les commandes"
                      >
                            <div className="text-xs text-gray-500 flex items-start gap-2">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7h13v10H3z" />
                            <path d="M16 10h4l1 2v5h-5V10z" />
                            <path d="M7 17a2 2 0 104 0" />
                            <path d="M16 17a2 2 0 104 0" />
                          </svg>
                              <div className="leading-tight">
                                <div>À expédier</div>
                                <div className="text-[11px] text-gray-400">Prochains 7 jours</div>
                              </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-2">{loading ? '—' : computed.aExpedier7j}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenKpi(k => (k === 'A_POSER' ? null : 'A_POSER'))}
                        className="text-left bg-white border border-gray-200 rounded-xl p-4 transition hover:shadow-sm active:scale-[0.99]"
                        title="Voir les commandes"
                      >
                            <div className="text-xs text-gray-500 flex items-start gap-2">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 7V3h8v4" />
                            <path d="M12 14v7" />
                            <path d="M8 21h8" />
                            <path d="M3 11h18" />
                          </svg>
                              <div className="leading-tight">
                                <div>À poser</div>
                                <div className="text-[11px] text-gray-400">Prochains 7 jours</div>
                              </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-2">{loading ? '—' : computed.aPoser7j}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenKpi(k => (k === 'EN_RETARD' ? null : 'EN_RETARD'))}
                        className="text-left bg-white border border-gray-200 rounded-xl p-4 transition hover:shadow-sm active:scale-[0.99]"
                        title="Voir les commandes"
                      >
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 8v5l3 3" />
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          En retard
                        </div>
                        <div className={`text-2xl font-bold mt-2 ${!loading && computed.enRetard > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                          {loading ? '—' : computed.enRetard}
                        </div>
                      </button>
                    </div>

                    {kpiPanel && !loading && (
                      <div className="mt-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900">{kpiPanel.title}</div>
                          <button
                            type="button"
                            className="text-sm text-gray-600 hover:text-gray-900"
                            onClick={() => setOpenKpi(null)}
                            title="Fermer"
                          >
                            Fermer
                          </button>
                        </div>
                        {kpiPanel.items.length === 0 ? (
                          <div className="p-4 text-sm text-gray-500">Aucune commande.</div>
                        ) : (
                          <ul className="divide-y">
                            {kpiPanel.items.slice(0, 20).map(c => {
                              const d = firstDateForKpi(c, openKpi)
                              const ymd = d ? isoYmd(d) : null
                              return (
                                <li key={c.id} className="p-4 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{c.client?.name || '—'}</div>
                                    <div className="mt-0.5 text-xs text-gray-500 truncate">{c.product || '—'}{ymd ? ` • ${ymd}` : ''}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {ymd ? (
                                      <Link
                                        href={`/calendrier?date=${encodeURIComponent(ymd)}`}
                                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition"
                                        title="Ouvrir dans le calendrier"
                                      >
                                        Calendrier
                                      </Link>
                                    ) : null}
                                    <Link
                                      href={`/commandes/${encodeURIComponent(c.id)}`}
                                      className="px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]"
                                      title="Ouvrir la commande"
                                    >
                                      Ouvrir
                                    </Link>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </section>

                  {/* 2) Alertes */}
                  <section className="mt-8" id="priorites">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-700">Priorités</h2>
                      <Link href="/commandes?view=list" className="text-sm text-gray-700 hover:text-gray-900 hover:underline">Voir commandes</Link>
                    </div>
                    <div className="mt-3 bg-white border border-gray-200 rounded-xl">
                      {loading ? (
                        <div className="p-4 text-sm text-gray-600 bg-gray-50 animate-pulse">Chargement…</div>
                      ) : (
                        <div className="max-h-[60vh] overflow-auto">
                          {computed.favoriteItems.length > 0 ? (
                            <div className="border-b border-gray-100">
                              <div className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50">
                                Favoris
                              </div>
                              <ul className="divide-y">
                                {computed.favoriteItems.map(c => {
                                  const base = displayEtat(c)
                                  const baseInfo = etatDisplay(base)
                                  const info = latenessForCommande(c, startOfToday())
                                  return (
                                    <li key={`priorite-fav-${c.id}`}>
                                      <Link href={`/commandes/${encodeURIComponent(c.id)}`} className="block p-4 hover:bg-gray-50 transition">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-sm text-gray-900 truncate">{c.client?.name || '—'}</div>
                                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                              <span className={`inline-flex text-xs border rounded-full px-2 py-1 ${baseInfo.cls}`}>{baseInfo.label}</span>
                                              {info.lateness === 'OVERDUE' ? (
                                                <span className="inline-flex text-xs border rounded-full px-2 py-1 border-red-200 bg-red-50 text-red-700">En retard</span>
                                              ) : info.lateness === 'TODAY' ? (
                                                <span className="inline-flex text-xs border rounded-full px-2 py-1 border-amber-200 bg-amber-50 text-amber-900">Aujourd’hui</span>
                                              ) : null}
                                            </div>
                                          </div>
                                          <svg
                                            className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden
                                          >
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                                          </svg>
                                        </div>
                                      </Link>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          ) : null}

                          {computed.alerts.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500">Aucune alerte. Tout est sous contrôle.</div>
                          ) : (
                            <ul className="divide-y">
                              {computed.alerts.map(a => (
                                <li key={`${a.level}-${a.id}`}>
                                  <div className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition">
                                    <Link href={`/commandes/${encodeURIComponent(a.id)}`} className="flex-1 min-w-0">
                                      <div className="text-sm text-gray-900 truncate">{a.label}</div>
                                      <div className="mt-1">
                                        <span className={`inline-flex text-xs border rounded-full px-2 py-1 ${badge(a.level)}`}>{a.level}</span>
                                      </div>
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => dismissAlert(a.id)}
                                      className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                                      title="Marquer comme vu"
                                      aria-label="Marquer comme vu"
                                    >
                                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M18 6L6 18" />
                                        <path d="M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* 3) Vue rapide */}
                  <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h2 className="text-sm font-semibold text-gray-700">Dernières mises à jour</h2>
                      {loading ? (
                        <div className="mt-3 text-sm text-gray-500">—</div>
                      ) : computed.dernieresModifs.length === 0 ? (
                        <div className="mt-3 text-sm text-gray-500">Aucune donnée.</div>
                      ) : (
                        <ul className="mt-3 divide-y">
                          {computed.dernieresModifs.map(c => (
                            <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                              <div className="text-sm text-gray-900">{c.client?.name}</div>
                              <div className="text-xs text-gray-500">{new Date(c.updatedAt).toLocaleString()}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <h2 className="text-sm font-semibold text-gray-700">Accès rapides</h2>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Link href="/commandes" className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition">
                          <div className="text-xs text-gray-500">Ouvrir</div>
                          <div className="font-semibold text-gray-900 mt-1">Commandes</div>
                        </Link>
                        <Link href="/clients" className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition">
                          <div className="text-xs text-gray-500">Ouvrir</div>
                          <div className="font-semibold text-gray-900 mt-1">Clients</div>
                        </Link>
                        <Link href="/poseurs" className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition">
                          <div className="text-xs text-gray-500">Ouvrir</div>
                          <div className="font-semibold text-gray-900 mt-1">Poseurs</div>
                        </Link>
                        <Link href="/calendrier" className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition">
                          <div className="text-xs text-gray-500">À venir</div>
                          <div className="font-semibold text-gray-900 mt-1">Calendrier</div>
                        </Link>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
