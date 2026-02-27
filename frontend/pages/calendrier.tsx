import React, { useEffect, useMemo, useState } from 'react'
import Router from 'next/router'
import AppShell from '../components/AppShell'

type Commande = {
  id: string
  product?: string | null
  etat?: string | null
  date_commande?: string | null
  date_pose?: string | null
  date_production?: string | null
  date_expedition?: string | null
  date_livraison?: string | null
  done_production_at?: string | null
  done_expedition_at?: string | null
  done_livraison_at?: string | null
  done_pose_at?: string | null
  updatedAt?: string
  client: { id: string; name: string }
  poseur?: { id: string; name: string } | null
}

type CalendarEvent = {
  kind: 'COMMANDE' | 'PRODUCTION' | 'EXPEDITION' | 'LIVRAISON' | 'POSE'
  commande: Commande
}

type CalendarDay = {
  date: Date
  inMonth: boolean
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function safeDate(value?: string | null) {
  if (!value) return null
  const raw = String(value).trim()
  // IMPORTANT: 'YYYY-MM-DD' and ISO strings like 'YYYY-MM-DDT00:00:00.000Z'
  // can be parsed as UTC by JS Date, which shifts the day in local time.
  // Parse anything that starts with YYYY-MM-DD as local noon to keep the intended calendar day.
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

type MilestoneStatus = 'DONE' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'PLANNED'

function statusLabel(s: MilestoneStatus) {
  switch (s) {
    case 'DONE':
      return 'Fait'
    case 'OVERDUE':
      return 'En retard'
    case 'DUE_TODAY':
      return 'Aujourd’hui'
    case 'UPCOMING':
      return 'Proche'
    default:
      return 'Planifié'
  }
}

function statusClass(s: MilestoneStatus) {
  switch (s) {
    case 'DONE':
      return 'border-green-200 bg-green-50 text-green-800'
    case 'OVERDUE':
      return 'border-red-200 bg-red-50 text-red-800'
    case 'DUE_TODAY':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'UPCOMING':
      return 'border-blue-200 bg-blue-50 text-blue-800'
    default:
      // Keep consistent with the calendar dot for "planned".
      return 'border-blue-200 bg-blue-50 text-blue-800'
  }
}

function dotClass(s: MilestoneStatus) {
  switch (s) {
    case 'DONE':
      return 'bg-green-500'
    case 'OVERDUE':
      return 'bg-red-500'
    case 'DUE_TODAY':
      return 'bg-amber-500'
    case 'UPCOMING':
      return 'bg-blue-500'
    default:
      return 'bg-blue-300'
  }
}

type DayDotStatus = MilestoneStatus | 'COMMANDE'

function dayDotClass(s: DayDotStatus) {
  if (s === 'COMMANDE') return 'bg-[color:var(--brand-ink)]'
  return dotClass(s)
}

function milestoneDueDate(ev: CalendarEvent) {
  const c = ev.commande
  switch (ev.kind) {
    case 'COMMANDE':
      return safeDate(c.date_commande)
    case 'PRODUCTION':
      return safeDate(c.date_production)
    case 'EXPEDITION':
      return safeDate(c.date_expedition)
    case 'LIVRAISON':
      return safeDate(c.date_livraison)
    case 'POSE':
      return safeDate(c.date_pose)
    default:
      return null
  }
}

function milestoneDoneAt(ev: CalendarEvent) {
  const c = ev.commande
  switch (ev.kind) {
    case 'PRODUCTION':
      return safeDate(c.done_production_at)
    case 'EXPEDITION':
      return safeDate(c.done_expedition_at)
    case 'LIVRAISON':
      return safeDate(c.done_livraison_at)
    case 'POSE':
      return safeDate(c.done_pose_at)
    default:
      return null
  }
}

function milestoneDueForKind(c: Commande, kind: CalendarEvent['kind']) {
  switch (kind) {
    case 'PRODUCTION':
      return safeDate(c.date_production)
    case 'EXPEDITION':
      return safeDate(c.date_expedition)
    case 'LIVRAISON':
      return safeDate(c.date_livraison)
    case 'POSE':
      return safeDate(c.date_pose)
    default:
      return null
  }
}

function milestoneDoneForKind(c: Commande, kind: CalendarEvent['kind']) {
  switch (kind) {
    case 'PRODUCTION':
      return safeDate(c.done_production_at)
    case 'EXPEDITION':
      return safeDate(c.done_expedition_at)
    case 'LIVRAISON':
      return safeDate(c.done_livraison_at)
    case 'POSE':
      return safeDate(c.done_pose_at)
    default:
      return null
  }
}

function prerequisiteKinds(kind: CalendarEvent['kind']): Array<CalendarEvent['kind']> {
  switch (kind) {
    case 'EXPEDITION':
      return ['PRODUCTION']
    case 'LIVRAISON':
      return ['PRODUCTION', 'EXPEDITION']
    case 'POSE':
      return ['PRODUCTION', 'EXPEDITION', 'LIVRAISON']
    default:
      return []
  }
}

function hasOverduePrerequisite(c: Commande, kind: CalendarEvent['kind'], now: Date) {
  const today = dateOnly(now)
  for (const prereq of prerequisiteKinds(kind)) {
    const due = milestoneDueForKind(c, prereq)
    const done = milestoneDoneForKind(c, prereq)
    if (!due) continue
    if (done) continue
    if (dateOnly(due).getTime() < today.getTime()) return true
  }
  return false
}

function computeStatus(ev: CalendarEvent, now: Date): MilestoneStatus {
  if (ev.kind === 'COMMANDE') return 'PLANNED'
  const due = milestoneDueDate(ev)
  if (!due) return 'PLANNED'
  const done = milestoneDoneAt(ev)
  if (done) return 'DONE'
  const a = dateOnly(now)
  const b = dateOnly(due)
  const diffDays = Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))

  // Only propagate overdue prerequisites when the milestone is due today or already due.
  // Otherwise we'd mark far-future milestones as "En retard" just because production was planned earlier.
  if (diffDays < 0 && hasOverduePrerequisite(ev.commande, ev.kind, now)) return 'OVERDUE'

  if (diffDays < 0) return 'OVERDUE'
  if (diffDays === 0) return 'DUE_TODAY'
  if (diffDays <= 2) return 'UPCOMING'
  return 'PLANNED'
}

function isoDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function easterSunday(year: number) {
  const f = Math.floor
  const a = year % 19
  const b = f(year / 100)
  const c = year % 100
  const d = f(b / 4)
  const e = b % 4
  const g = f((8 * b + 13) / 25)
  const h = (19 * a + b - d - g + 15) % 30
  const i = f(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = f((a + 11 * h + 22 * l) / 451)
  const month = f((h + l - 7 * m + 114) / 31) // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function isoYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getFrenchHolidays(year: number) {
  const map = new Map<string, string>()
  ;[
    { m: 0, d: 1, name: "Jour de l'an" },
    { m: 4, d: 1, name: 'Fête du Travail' },
    { m: 4, d: 8, name: 'Victoire 1945' },
    { m: 6, d: 14, name: 'Fête nationale' },
    { m: 7, d: 15, name: 'Assomption' },
    { m: 10, d: 1, name: 'Toussaint' },
    { m: 10, d: 11, name: 'Armistice 1918' },
    { m: 11, d: 25, name: 'Noël' }
  ].forEach(h => {
    const dt = new Date(year, h.m, h.d, 12, 0, 0, 0)
    map.set(isoYmd(dt), h.name)
  })

  const easter = easterSunday(year)
  const add = (days: number, name: string) => {
    const dt = new Date(easter)
    dt.setDate(dt.getDate() + days)
    dt.setHours(12, 0, 0, 0)
    map.set(isoYmd(dt), name)
  }
  add(1, 'Lundi de Pâques')
  add(39, 'Ascension')
  add(50, 'Lundi de Pentecôte')

  return map
}

function holidayName(d: Date) {
  return getFrenchHolidays(d.getFullYear()).get(isoYmd(d)) || ''
}

function isWeekend(d: Date) {
  const day = d.getDay()
  return day === 0 || day === 6
}

function kindLabel(kind: CalendarEvent['kind']) {
  switch (kind) {
    case 'COMMANDE':
      return 'Commande'
    case 'PRODUCTION':
      return 'Production'
    case 'EXPEDITION':
      return 'Expédition'
    case 'LIVRAISON':
      return 'Livraison'
    case 'POSE':
      return 'Pose'
    default:
      return kind
  }
}

export default function CalendrierPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commandes, setCommandes] = useState<Commande[]>([])

  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<Date>(() => new Date())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search).get('date')
    if (!q) return
    const d = safeDate(q)
    if (!d) return
    setSelected(d)
    setMonth(startOfMonth(d))
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      Router.replace('/login')
      return
    }

    const refresh = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await authFetch(`${API_URL}/commandes`)
        if (res.status === 401) {
          Router.replace('/login')
          return
        }
        if (!res.ok) throw new Error('Erreur /commandes')
        setCommandes((await res.json()) as Commande[])
      } catch (e: any) {
        setError(e?.message || 'Erreur')
      } finally {
        setLoading(false)
      }
    }

    ;(async () => {
      await refresh()
    })()
  }, [API_URL])

  async function setMilestoneDone(commandeId: string, kind: CalendarEvent['kind'], done: boolean) {
    if (kind === 'COMMANDE') return
    const current = commandes.find(c => c.id === commandeId)
    const poseDone = current ? safeDate(current.done_pose_at) != null : false
    if (!done && poseDone && kind !== 'POSE') {
      setError('Impossible: la pose est déjà marquée comme faite. Annulez la pose d\'abord si nécessaire.')
      return
    }
    const token = getToken()
    if (!token) {
      Router.replace('/login')
      return
    }

    const res = await authFetch(
      `${API_URL}/commandes/${encodeURIComponent(commandeId)}/milestones/${encodeURIComponent(kind)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ done })
      }
    )

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(typeof (j as any)?.error === 'string' && (j as any).error.trim() ? String((j as any).error) : 'Erreur')
      return
    }

    // Reload to keep nested client/poseur data intact
    try {
      const list = await authFetch(`${API_URL}/commandes`)
      if (list.ok) setCommandes((await list.json()) as Commande[])
    } catch {
      // ignore
    }
  }

  const days = useMemo(() => {
    const first = startOfMonth(month)
    const start = new Date(first)
    // monday as first day
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)

    const grid: CalendarDay[] = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      grid.push({ date, inMonth: date.getMonth() === month.getMonth() })
    }
    return grid
  }, [month])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()

    function add(kind: CalendarEvent['kind'], c: Commande, raw: string | null | undefined) {
      const d = safeDate(raw)
      if (!d) return
      const key = isoDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
      const arr = map.get(key) || []
      arr.push({ kind, commande: c })
      map.set(key, arr)
    }

    for (const c of commandes) {
      add('COMMANDE', c, c.date_commande)
      add('PRODUCTION', c, c.date_production)
      add('EXPEDITION', c, c.date_expedition)
      add('LIVRAISON', c, c.date_livraison)
      add('POSE', c, c.date_pose)
    }
    return map
  }, [commandes])

  const selectedKey = isoDayKey(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()))
  const selectedEvents = eventsByDay.get(selectedKey) || []

  const monthValue = month.getMonth()
  const yearValue = month.getFullYear()

  const yearOptions = useMemo(() => {
    const start = yearValue - 7
    return Array.from({ length: 15 }, (_, i) => start + i)
  }, [yearValue])

  const selectedLabel = useMemo(() => {
    return selected.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [selected])

  const monthLabel = useMemo(() => {
    return month.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
  }, [month])

  return (
    <AppShell title="Calendrier">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border rounded-xl p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-500">À venir</div>
                <div className="text-lg font-semibold text-gray-900 capitalize truncate">{monthLabel}</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const now = startOfMonth(new Date())
                  setMonth(now)
                  setSelected(new Date())
                }}
                className="shrink-0 px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                title="Aller à aujourd’hui"
              >
                <span className="hidden sm:inline">Aujourd’hui</span>
                <span className="sm:hidden">Auj.</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonth(m => addMonths(m, -1))}
                  className="px-3 py-2 bg-white border rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]"
                  title="Mois précédent"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setMonth(m => addMonths(m, 1))}
                  className="px-3 py-2 bg-white border rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99]"
                  title="Mois suivant"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                <select
                  className="w-full sm:w-auto px-3 py-2 bg-white border rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]"
                  title="Mois"
                  value={monthValue}
                  onChange={e => {
                    const nextMonth = Number(e.target.value)
                    setMonth(new Date(yearValue, nextMonth, 1))
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i).map(i => (
                    <option key={i} value={i}>
                      {new Date(2000, i, 1).toLocaleString('fr-FR', { month: 'long' })}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full sm:w-auto px-3 py-2 bg-white border rounded-lg text-gray-800 hover:bg-gray-50 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]"
                  title="Année"
                  value={yearValue}
                  onChange={e => {
                    const nextYear = Number(e.target.value)
                    setMonth(new Date(nextYear, monthValue, 1))
                  }}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-gray-500">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
              <div key={d} className="px-1">{d}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {days.map(({ date, inMonth }) => {
              const key = isoDayKey(date)
              const events = eventsByDay.get(key) || []
              const isSelected = sameDay(date, selected)
              const isToday = sameDay(date, new Date())
              const holiday = holidayName(date)
              const weekend = isWeekend(date)

              const now = new Date()
              const worst = (() => {
                if (!events.length) return 'PLANNED' as DayDotStatus
                const rank: Record<MilestoneStatus, number> = {
                  OVERDUE: 5,
                  DUE_TODAY: 4,
                  UPCOMING: 3,
                  PLANNED: 2,
                  DONE: 1
                }
                // Do not let the informational "COMMANDE" event force a neutral/planned color.
                // Calendar dot should reflect actionable milestones.
                const actionable = events.filter(e => e.kind !== 'COMMANDE')
                if (!actionable.length) {
                  const hasCommande = events.some(e => e.kind === 'COMMANDE')
                  return hasCommande ? ('COMMANDE' as const) : ('PLANNED' as const)
                }
                return actionable
                  .map(ev => computeStatus(ev, now))
                  .sort((a, b) => rank[b] - rank[a])[0]
              })()

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(date)}
                  aria-pressed={isSelected}
                  className={`text-left rounded-xl border p-1.5 sm:p-2 transition active:scale-[0.99] ${
                    isSelected
                      ? 'border-[color:var(--brand-ink)] ring-2 ring-gray-200 bg-gray-50/50'
                      : 'border-gray-200 hover:bg-gray-50'
                  } ${(weekend || holiday) && !isSelected ? 'bg-gray-100 border-gray-300' : ''} ${!inMonth ? 'opacity-60' : ''}`}
                  title={`${holiday ? `Férié: ${holiday} • ` : ''}${weekend ? 'Week-end • ' : ''}${events.length ? `${events.length} événement(s)` : 'Aucun événement'}`}
                  aria-label={`${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • ${holiday ? `Férié: ${holiday} • ` : ''}${weekend ? 'Week-end • ' : ''}${events.length ? `${events.length} événement(s)` : 'Aucun événement'}`}
                >
                  <div className={`flex items-center justify-between gap-2 ${weekend || holiday ? 'bg-gray-50 rounded-lg px-1 py-0.5 -mx-1 -my-0.5' : ''}`}>
                    <div className={`text-sm font-semibold ${inMonth ? 'text-gray-900' : 'text-gray-700'}`}>{date.getDate()}</div>
                    {isToday && (
                      <div className="hidden sm:block text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full border bg-white text-gray-700 border-gray-200 max-w-[64px] sm:max-w-none truncate">
                        Aujourd’hui
                      </div>
                    )}
                  </div>

                  {holiday ? (
                    <div className="hidden sm:block mt-1 text-[10px] text-gray-700 truncate" title={holiday}>
                      {holiday}
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center gap-2">
                    {events.length > 0 ? (
                      <>
                        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${dayDotClass(worst)}`} aria-hidden />
                        <span className="hidden lg:inline text-xs text-gray-700">{events.length} événement{events.length > 1 ? 's' : ''}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Couleurs: rouge (en retard), orange (aujourd’hui), bleu (planifié/proche), vert (fait).
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-gray-500">Sélection</div>
              <div className="font-semibold text-gray-900 capitalize">{selectedLabel}</div>
              {holidayName(selected) ? (
                <div className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border bg-amber-50 text-amber-900 border-amber-200">
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Férié: {holidayName(selected)}
                </div>
              ) : isWeekend(selected) ? (
                <div className="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border bg-gray-50 text-gray-800 border-gray-200">
                  Week-end
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Chargement…</div>
          ) : selectedEvents.length === 0 ? (
            <div className="mt-4 text-sm text-gray-500">Aucun événement prévu ce jour.</div>
          ) : (
            <ul className="mt-4 space-y-2">
              {selectedEvents
                .slice()
                .sort((a, b) => (a.commande.client?.name || '').localeCompare(b.commande.client?.name || ''))
                .map(ev => {
                  const s = computeStatus(ev, new Date())
                  const poseDone = safeDate(ev.commande.done_pose_at) != null
                  const lockUndoReason = (() => {
                    if (ev.kind === 'COMMANDE' || ev.kind === 'POSE') return null
                    const c = ev.commande
                    const expeditionDone = safeDate(c.done_expedition_at) != null
                    const livraisonDone = safeDate(c.done_livraison_at) != null
                    if (poseDone) return 'Bloqué: la pose est déjà faite'
                    if (ev.kind === 'PRODUCTION' && (expeditionDone || livraisonDone)) {
                      return 'Bloqué: une étape suivante est déjà faite'
                    }
                    if (ev.kind === 'EXPEDITION' && livraisonDone) {
                      return 'Bloqué: une étape suivante est déjà faite'
                    }
                    return null
                  })()
                  const lockUndo = lockUndoReason != null
                  const canComplete = ev.kind !== 'COMMANDE' && s !== 'DONE'
                  const canUndo = ev.kind !== 'COMMANDE' && s === 'DONE' && !lockUndo
                  return (
                  <li key={`${ev.kind}-${ev.commande.id}`} className="border rounded-xl p-3 hover:bg-gray-50 transition">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{ev.commande.client?.name}</div>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        {ev.kind !== 'COMMANDE' ? (
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] px-1.5 sm:px-2 py-1 rounded-full border ${statusClass(s)}`}
                            title={statusLabel(s)}
                          >
                            <span className={`inline-flex h-2 w-2 rounded-full ${dotClass(s)}`} aria-hidden />
                            <span className="hidden sm:inline">{statusLabel(s)}</span>
                            <span className="sm:hidden sr-only">{statusLabel(s)}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">{ev.commande.product || '—'}{ev.commande.poseur?.name ? ` • ${ev.commande.poseur.name}` : ''}</div>
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className={`text-sm font-semibold ${ev.kind === 'COMMANDE' ? 'text-gray-700' : 'text-gray-900'} truncate`}>{kindLabel(ev.kind)}</span>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {s === 'DONE' && ev.kind !== 'COMMANDE' ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (lockUndo) return
                              setMilestoneDone(ev.commande.id, ev.kind, false)
                            }}
                            disabled={lockUndo}
                            className={`w-9 h-9 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white text-gray-900 border border-gray-200 ${lockUndo ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                            title={lockUndoReason || 'Annuler (marqué fait)'}
                            aria-label={lockUndoReason || 'Annuler (marqué fait)'}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M18 6L6 18" />
                              <path d="M6 6l12 12" />
                            </svg>
                          </button>
                        ) : null}
                        {canComplete ? (
                          <button
                            type="button"
                            onClick={() => setMilestoneDone(ev.commande.id, ev.kind, true)}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-green-600 hover:bg-green-700 text-white border border-green-700/20"
                              title="Marquer comme fait"
                              aria-label="Marquer comme fait"
                          >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => Router.push(`/commandes/${encodeURIComponent(ev.commande.id)}`)}
                          className="px-3 py-1.5 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)] whitespace-nowrap"
                          title="Voir la commande"
                        >
                          Voir
                        </button>
                      </div>
                    </div>
                  </li>
                )})}
            </ul>
          )}

          {selectedEvents.length > 0 ? (
            <div className="mt-4 text-xs text-gray-500">Cliquez sur un élément pour ouvrir la commande complète.</div>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
