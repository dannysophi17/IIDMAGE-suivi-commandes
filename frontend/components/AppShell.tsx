import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Router from 'next/router'
import Toast, { ToastKind } from './Toast'

type Role = 'OWNER' | 'MANAGER' | 'POSEUR' | 'READONLY'

type Me = { id: string; email: string; name?: string | null; role: Role }

type AppShellProps = {
  title: string
  children: React.ReactNode
  hideSidebarToggle?: boolean
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

export default function AppShell({ title, children, hideSidebarToggle = false }: AppShellProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  const [me, setMe] = useState<Me | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarInitialized, setSidebarInitialized] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false)
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false)
  const [pageMounted, setPageMounted] = useState(false)

  const [toastOpen, setToastOpen] = useState(false)
  const [toastKind, setToastKind] = useState<ToastKind>('info')
  const [toastMessage, setToastMessage] = useState('')

  function showToast(kind: ToastKind, message: string) {
    setToastKind(kind)
    setToastMessage(message)
    setToastOpen(true)
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
    const t = setTimeout(() => setPageMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const readQueuedToast = () => {
      try {
        const raw = sessionStorage.getItem('iidmage_toast')
        if (!raw) return
        sessionStorage.removeItem('iidmage_toast')
        const parsed = JSON.parse(raw)
        const kind = (parsed?.kind || 'info') as ToastKind
        const message = String(parsed?.message || '').trim()
        if (message) showToast(kind, message)
      } catch {
        // ignore
      }
    }

    const onEvent = (ev: any) => {
      const kind = (ev?.detail?.kind || 'info') as ToastKind
      const message = String(ev?.detail?.message || '').trim()
      if (message) showToast(kind, message)
    }

    readQueuedToast()
    window.addEventListener('iidmage-toast', onEvent)
    Router.events?.on('routeChangeComplete', readQueuedToast)
    return () => {
      window.removeEventListener('iidmage-toast', onEvent)
      Router.events?.off('routeChangeComplete', readQueuedToast)
    }
  }, [])

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
      const res = await authFetch(`${API_URL}/me`)
      if (res.status === 401) {
        Router.replace('/login')
        return
      }
      if (!res.ok) return
      setMe((await res.json()) as Me)
    })()
  }, [API_URL])

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
  }

  function navigateAndClose(path: string) {
    closeOverlays()
    Router.push(path)
  }

  const showSidebarLogo = sidebarOpen || hideSidebarToggle

  const iconBtnClass =
    'inline-flex items-center justify-center min-w-[44px] min-h-[44px] h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]'

  const sidebarToggleClass =
    'inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-gray-700 hover:text-gray-900 rounded transition border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]'

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <Toast open={toastOpen} kind={toastKind} message={toastMessage} onClose={() => setToastOpen(false)} />
      <div className="h-screen bg-transparent overflow-hidden">
        <div className="flex h-screen overflow-hidden">
          <aside
            className={`hidden md:flex flex-col overflow-hidden ${sidebarInitialized ? 'transition-all duration-300 ease-out' : ''} ${sidebarOpen ? 'w-72' : 'w-20'} bg-white border-r border-gray-200`}
          >
            <div className={`p-4 flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
              {showSidebarLogo && (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gray-900/5 border border-gray-200" title="iiDmage" />
                  {sidebarOpen && (
                    <div
                      className={`font-extrabold tracking-tight text-gray-900 text-xl overflow-hidden whitespace-nowrap ${sidebarInitialized ? 'transition-all duration-300' : ''} ${sidebarOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'}`}
                    >
                      iiDmage
                    </div>
                  )}
                </div>
              )}

              {!hideSidebarToggle && (
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
              )}
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
                    type="button"
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
                    type="button"
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

          <main className="flex-1 h-screen overflow-hidden relative">
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
                <button onClick={logout} className={iconBtnClass} title="Déconnexion" aria-label="Déconnexion" type="button">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>

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
              <div
                className={`rounded-2xl shadow-2xl border h-full overflow-hidden transition-all duration-500 ${
                  pageMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                } bg-white border-gray-200`}
              >
                <div className="p-6 md:p-8 h-full overflow-y-auto">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs text-gray-500">{me?.name || me?.email || '—'}</div>
                      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-1">{title}</h1>
                    </div>
                    <Link
                      href="/dashboard"
                      className="w-10 h-10 inline-flex items-center justify-center rounded-lg border transition active:scale-[0.99] hover:-translate-y-px bg-white hover:bg-gray-50 text-gray-800 border-gray-200"
                      title="Retour au dashboard"
                      aria-label="Retour au dashboard"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M10 19l-7-7 7-7" />
                        <path d="M3 12h18" />
                      </svg>
                    </Link>
                  </div>

                  <div className="mt-6">{children}</div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
