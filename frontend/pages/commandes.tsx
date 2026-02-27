import React, { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { useRouter } from 'next/router'
import ConfirmDialog from '../components/ConfirmDialog'

type Commande = {
  id: string
  product?: string
  client?: { id: string; name: string; favorite?: boolean }
  poseur?: { id: string; name: string }
  etat?: string
  planningType?: 'AUTO' | 'CASUAL'
  date_commande?: string
  date_survey?: string
  date_production?: string
  date_expedition?: string
  date_livraison?: string
  date_pose?: string
  done_production_at?: string
  done_expedition_at?: string
  done_livraison_at?: string
  done_pose_at?: string
  lieu_pose?: string
  commentaires?: string
}

type Client = { id: string; name: string }
type Poseur = { id: string; name: string }

function authFetch(input: RequestInfo, init?: RequestInit) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || sessionStorage.getItem('token')
      : null
  const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  if (token) (headers as any).authorization = `Bearer ${token}`
  return fetch(input, { ...init, headers })
}

function authFetchMultipart(input: RequestInfo, init?: RequestInit) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || sessionStorage.getItem('token')
      : null

  const headers = { ...(init?.headers || {}) } as any
  if (token) headers.authorization = `Bearer ${token}`
  return fetch(input, { ...init, headers })
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISODate(value: string | undefined) {
  if (!value) return null
  const raw = String(value).trim()
  // Accept 'YYYY-MM-DD' and ISO strings like 'YYYY-MM-DDT00:00:00.000Z'
  // as local noon, to avoid timezone day shifting.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)
}

function dateOnly(d: Date) {
  const out = new Date(d)
  out.setHours(12, 0, 0, 0)
  return out
}

function formatISODate(d: Date | null) {
  if (!d) return ''
  const out = new Date(d)
  out.setHours(12, 0, 0, 0)
  return `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, '0')}-${String(out.getDate()).padStart(2, '0')}`
}

function isWeekend(d: Date) {
  const day = d.getDay()
  return day === 0 || day === 6
}

function toBusinessDayForward(from: Date) {
  let d = new Date(from)
  d.setHours(12, 0, 0, 0)
  while (isWeekend(d)) {
    d = new Date(d)
    d.setDate(d.getDate() + 1)
  }
  d.setHours(12, 0, 0, 0)
  return d
}

function subBusinessDays(from: Date, businessDays: number) {
  let d = new Date(from)
  d.setHours(12, 0, 0, 0)
  let remaining = Math.max(0, Math.floor(businessDays || 0))
  while (remaining > 0) {
    d = new Date(d)
    d.setDate(d.getDate() - 1)
    if (isWeekend(d)) continue
    remaining -= 1
  }
  d.setHours(12, 0, 0, 0)
  return d
}

function addBusinessDays(from: Date, businessDays: number) {
  let d = new Date(from)
  d.setHours(12, 0, 0, 0)
  let remaining = Math.max(0, Math.floor(businessDays || 0))
  while (remaining > 0) {
    d = new Date(d)
    d.setDate(d.getDate() + 1)
    if (isWeekend(d)) continue
    remaining -= 1
  }
  d.setHours(12, 0, 0, 0)
  return d
}

function businessDaysBetween(start: Date, end: Date) {
  const a = new Date(start)
  const b = new Date(end)
  a.setHours(12, 0, 0, 0)
  b.setHours(12, 0, 0, 0)
  if (b.getTime() < a.getTime()) return -businessDaysBetween(end, start)
  let cur = new Date(a)
  let count = 0
  while (cur.getTime() < b.getTime()) {
    cur = new Date(cur)
    cur.setDate(cur.getDate() + 1)
    if (isWeekend(cur)) continue
    count += 1
  }
  return count
}

function extractTaggedLine(base: string | undefined, tag: string) {
  const text = (base || '').toString()
  const re = new RegExp(`(^|\\n)\\[${tag}\\]\\s*([^\\n]*)`, 'i')
  const m = text.match(re)
  return m ? (m[2] || '').trim() : ''
}

function upsertTaggedLine(base: string | undefined, tag: string, value: string) {
  const text = (base || '').toString()
  const cleaned = text
    .replace(new RegExp(`(^|\\n)\\[${tag}\\]\\s*[^\\n]*`, 'ig'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const v = value.trim()
  if (!v) return cleaned
  const next = cleaned ? `${cleaned}\n\n[${tag}] ${v}` : `[${tag}] ${v}`
  return next.trim()
}

export default function CommandesPage() {
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [poseurs, setPoseurs] = useState<Poseur[]>([])
  const [form, setForm] = useState<any>({ planningType: 'AUTO' })
  const [editing, setEditing] = useState<string|null>(null)
  const [error, setError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoTag, setPhotoTag] = useState<string>('')
  const [photoBatches, setPhotoBatches] = useState<Array<{ tag: string; files: File[] }>>([])
  const [photoInputKey, setPhotoInputKey] = useState(0)

  const [favoriteCommandes, setFavoriteCommandes] = useState<Record<string, boolean>>({})

  const [view, setView] = useState<'form' | 'list'>('form')
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
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
  }, [])

  function toggleFavoriteCommande(id: string) {
    setFavoriteCommandes(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = true
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('iidmage_favorite_commandes', JSON.stringify(Object.keys(next)))
        }
      } catch {
        // ignore
      }
      return next
    })
  }

  function toast(kind: 'success' | 'error' | 'info', message: string) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('iidmage-toast', { detail: { kind, message } }))
  }

  function queueToast(kind: 'success' | 'error' | 'info', message: string) {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem('iidmage_toast', JSON.stringify({ kind, message }))
    } catch {
      // ignore
    }
  }

  const computed = useMemo(() => {
    const pose = parseISODate(form.date_pose)
    if (!pose) return null

    const commande = parseISODate(form.date_commande) || subBusinessDays(pose, 15)
    const livraison = subBusinessDays(pose, 1)
    const expedition = subBusinessDays(pose, 2)

    // If there is more lead time than the minimal process (~15 jours ouvrés),
    // start production as early as possible (from date_commande), while keeping
    // expedition/livraison close to pose.
    const earliestProduction = toBusinessDayForward(addBusinessDays(commande, 1))
    const production = earliestProduction

    return {
      date_commande: formatISODate(commande),
      date_production: formatISODate(production),
      date_expedition: formatISODate(expedition),
      date_livraison: formatISODate(livraison)
    }
  }, [form.date_pose, form.date_commande])

  useEffect(() => {
    if (manualOpen) return
    if (!computed) return
    setForm((prev: any) => {
      const next: any = { ...prev }
      let changed = false

      if (!next.date_commande) {
        next.date_commande = computed.date_commande
        changed = true
      }

      for (const k of ['date_production', 'date_expedition', 'date_livraison'] as const) {
        if (next[k] !== (computed as any)[k]) {
          next[k] = (computed as any)[k]
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [computed, manualOpen])

  const CONTROL =
    'w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]'

  const ETATS: Array<{ value: string; label: string; cls: string }> = [
    {
      value: 'A_PLANIFIER',
      label: 'À planifier',
      cls: 'bg-gray-100 text-gray-700 border-gray-200'
    },
    {
      value: 'EN_PRODUCTION',
      label: 'En production',
      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
      value: 'A_EXPEDIER',
      label: 'À expédier',
      cls: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      value: 'LIVREE',
      label: 'À livrer',
      cls: 'bg-teal-50 text-teal-700 border-teal-200'
    },
    {
      value: 'A_POSER',
      label: 'À poser',
      cls: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      value: 'POSEE',
      label: 'Posée',
      cls: 'bg-green-50 text-green-700 border-green-200'
    }
  ]

  const ETATS_DISPLAY: Array<{ value: string; label: string; cls: string }> = [
    ...ETATS,
    {
      value: 'EN_RETARD',
      label: 'En retard',
      cls: 'bg-red-50 text-red-700 border-red-200'
    },
    {
      value: 'FACTURE_A_ENVOYER',
      label: 'Facture à envoyer',
      cls: 'bg-gray-100 text-gray-700 border-gray-200'
    },
    {
      value: 'FACTUREE',
      label: 'Facturée',
      cls: 'bg-gray-100 text-gray-700 border-gray-200'
    }
  ]

  type Lateness = 'OVERDUE' | 'TODAY' | null

  function milestoneLateness(c: Commande): Lateness {
    const base = displayEtat(c)
    if (base === 'FACTURE_A_ENVOYER' || base === 'FACTUREE') return null
    if (parseISODate(c.done_pose_at)) return null

    const today = dateOnly(startOfToday())

    function calc(dueRaw: string | undefined, doneRaw: string | undefined): Lateness {
      const due = parseISODate(dueRaw)
      if (!due) return null
      const done = parseISODate(doneRaw)
      if (done) return null
      const diff = Math.floor((dateOnly(due).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      if (diff < 0) return 'OVERDUE'
      if (diff === 0) return 'TODAY'
      return null
    }

    switch (base) {
      case 'EN_PRODUCTION':
        return calc(c.date_production, c.done_production_at)
      case 'A_EXPEDIER':
        return calc(c.date_expedition, c.done_expedition_at)
      case 'LIVREE':
        return calc(c.date_livraison, c.done_livraison_at)
      case 'A_POSER':
        return calc(c.date_pose, c.done_pose_at)
      default:
        return null
    }
  }

  function deriveEtat(c: Commande) {
    // IMPORTANT: l’état affiché doit rester cohérent avec le calendrier.
    // On ne "termine" pas une étape uniquement parce que la date est passée.
    // Les validations se font via les timestamps done_*.

    const poseDone = parseISODate(c.done_pose_at)
    if (poseDone) return 'POSEE'

    const livraisonDone = parseISODate(c.done_livraison_at)
    if (livraisonDone) return 'A_POSER'

    const expeditionDone = parseISODate(c.done_expedition_at)
    if (expeditionDone) return 'LIVREE'

    const productionDone = parseISODate(c.done_production_at)
    if (productionDone) return 'A_EXPEDIER'

    const production = parseISODate(c.date_production)
    if (production) return 'EN_PRODUCTION'

    return 'A_PLANIFIER'
  }

  function displayEtat(c: Commande) {
    const raw = (c.etat || '').trim()
    // Keep billing states explicit, but otherwise follow milestones.
    if (raw === 'FACTURE_A_ENVOYER' || raw === 'FACTUREE') return raw
    return deriveEtat(c)
  }

  function etatLabel(value?: string) {
    if (!value) return 'À planifier'
    const found = ETATS_DISPLAY.find(e => e.value === value)
    return found ? found.label : value
  }

  function etatClass(value?: string) {
    if (!value) {
      const found = ETATS_DISPLAY.find(e => e.value === 'A_PLANIFIER')
      return found ? found.cls : 'bg-gray-50 text-gray-700 border-gray-200'
    }
    const found = ETATS_DISPLAY.find(e => e.value === value)
    return found ? found.cls : 'bg-gray-50 text-gray-700 border-gray-200'
  }

  async function load() {
    const res = await authFetch(`${API_URL}/commandes`)
    if (res.ok) setCommandes(await res.json())
    // fetch clients/poseurs for select
    const c = await authFetch(`${API_URL}/clients`)
    if (c.ok) setClients(await c.json())
    const p = await authFetch(`${API_URL}/poseurs`)
    if (p.ok) setPoseurs(await p.json())
  }
  useEffect(()=>{ load() },[])

  useEffect(() => {
    if (!router.isReady) return
    const qView = typeof router.query.view === 'string' ? router.query.view : ''
    const qEdit = typeof router.query.edit === 'string' ? router.query.edit : ''
    if (qView === 'list') setView('list')
    if (qEdit) setView('form')
  }, [router.isReady, router.query.view, router.query.edit])

  useEffect(() => {
    const id = typeof router.query.id === 'string' ? router.query.id : null
    if (!id) return
    const el = document.getElementById(`commande-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [router.query.id, commandes.length])

  async function submit(e:any) {
    e.preventDefault()
    setError('')

    const nextForm: any = { ...form }
    if (nextForm.poseurId === '') delete nextForm.poseurId
    nextForm.commentaires = upsertTaggedLine(nextForm.commentaires, 'PROD_NOTE', nextForm.production_note || '')
    delete nextForm.production_note

    const method = editing ? 'PUT' : 'POST'
    const url = editing ? `${API_URL}/commandes/${editing}` : `${API_URL}/commandes`
    const res = await authFetch(url, { method, body: JSON.stringify(nextForm) })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError('Erreur')
      return
    }

    const saved = await res.json().catch(() => null)
    const commandeId = editing || saved?.id

    async function uploadPhotos(tag: string, files: File[]) {
      if (!commandeId) return
      if (!files.length) return
      const fd = new FormData()
      fd.append('tag', tag)
      for (const f of files) fd.append('files', f)
      const up = await authFetchMultipart(`${API_URL}/commandes/${commandeId}/attachments`, {
        method: 'POST',
        body: fd
      })
      if (!up.ok) {
        const j = await up.json().catch(() => ({}))
        throw new Error(j.error || 'Erreur upload')
      }
    }

    try {
      const batches = [...photoBatches]
      if (photoFiles.length) {
        batches.push({ tag: (photoTag || '').trim() || 'Photos', files: photoFiles })
      }
      for (const b of batches) {
        await uploadPhotos((b.tag || '').trim() || 'Photos', b.files)
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur upload')
    }

    setPhotoFiles([])
    setPhotoTag('')
    setPhotoBatches([])
    setPhotoInputKey(k => k + 1)
    setManualOpen(false)
    setForm({ planningType: 'AUTO' })
    const wasEditing = editing
    setEditing(null)
    load()
    if (commandeId) {
      const msg = wasEditing ? 'Commande mise à jour.' : 'Commande créée avec succès.'
      if (wasEditing) queueToast('success', msg)
      else toast('success', msg)
    }
    if (wasEditing && commandeId) {
      router.push(`/commandes/${commandeId}`)
    }
  }

  async function removeNow(id:string) {
    const res = await authFetch(`${API_URL}/commandes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('success', 'Commande supprimée.')
      load()
    }
  }

  function edit(c:Commande) {
    setForm({
      clientId: c.client?.id,
      poseurId: c.poseur?.id,
      product: c.product,
      etat: c.etat,
      planningType: c.planningType || 'AUTO',
      date_commande: c.date_commande?.slice(0,10),
      date_survey: c.date_survey?.slice(0,10),
      date_production: c.date_production?.slice(0,10),
      date_expedition: c.date_expedition?.slice(0,10),
      date_livraison: c.date_livraison?.slice(0,10),
      date_pose: c.date_pose?.slice(0,10),
      lieu_pose: c.lieu_pose
      ,commentaires: c.commentaires
      ,production_note: extractTaggedLine(c.commentaires, 'PROD_NOTE')
    })
    setPhotoFiles([])
    setPhotoTag('')
    setPhotoBatches([])
    setPhotoInputKey(k => k + 1)
    setManualOpen(false)
    setEditing(c.id)
  }

  useEffect(() => {
    if (!router.isReady) return
    const qEdit = typeof router.query.edit === 'string' ? router.query.edit : ''
    if (!qEdit) return
    const found = commandes.find(c => c.id === qEdit)
    if (!found) return
    edit(found)
    // keep the url clean once the form is ready
    router.replace('/commandes?view=form', undefined, { shallow: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.edit, commandes])

  return (
    <AppShell title="Commandes">
      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Supprimer la commande"
        message="Confirmer la suppression de cette commande."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          const id = pendingDeleteId
          setPendingDeleteId(null)
          if (!id) return
          await removeNow(id)
        }}
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm transition active:scale-[0.99] ${view === 'form' ? 'bg-[color:var(--brand-accent-soft)] text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            onClick={() => setView('form')}
            title="Formulaire"
          >
            Formulaire
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm transition active:scale-[0.99] border-l border-gray-200 ${view === 'list' ? 'bg-[color:var(--brand-accent-soft)] text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            onClick={() => setView('list')}
            title="Voir les commandes"
          >
            Voir commandes
          </button>
        </div>
      </div>

      {view === 'form' && (
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900">Retroplanning</div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"
            onClick={() => setManualOpen(v => !v)}
            title="Mode manuel"
          >
            {manualOpen ? 'Fermer manuel' : 'Ouvrir manuel'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500">Client *</label>
            <select value={form.clientId||''} onChange={e=>setForm((f:any)=>({...f,clientId:e.target.value}))} required title="Client" className={CONTROL}>
              <option value="">Client</option>
              {clients.map(c=>(<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">Poseur</label>
            <select value={form.poseurId||''} onChange={e=>setForm((f:any)=>({...f,poseurId:e.target.value}))} title="Poseur" className={CONTROL}>
              <option value="">— (Aucun)</option>
              {poseurs.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">Produit</label>
            <input className={CONTROL} placeholder="Produit" title="Produit" value={form.product||''} onChange={e=>setForm((f:any)=>({...f,product:e.target.value}))} />
          </div>

          <div>
            <label className="block text-xs text-gray-500">Date commande *</label>
            <input className={CONTROL} type="date" title="Date commande" value={form.date_commande||''} onChange={e=>setForm((f:any)=>({...f,date_commande:e.target.value}))} required />
            {computed?.date_commande && !manualOpen && !form.date_commande ? (
              <button
                type="button"
                className="mt-2 px-3 py-1.5 rounded-lg text-sm transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                onClick={() => setForm((f:any)=>({ ...f, date_commande: computed.date_commande }))}
                title="Auto remplir"
              >
                Auto: {computed.date_commande}
              </button>
            ) : null}
          </div>

          <div>
            <label className="block text-xs text-gray-500">Date pose (final) *</label>
            <input className={CONTROL} type="date" title="Date pose" value={form.date_pose||''} onChange={e=>setForm((f:any)=>({...f,date_pose:e.target.value}))} required />
            {(() => {
              const a = parseISODate(form.date_commande)
              const b = parseISODate(form.date_pose)
              if (!a || !b) return <div className="mt-1 text-[11px] text-gray-500">Cible: 15 jours ouvrés au total</div>
              const days = businessDaysBetween(a, b)
              return <div className="mt-1 text-[11px] text-gray-500">Durée (jours ouvrés): {days} (cible: 15)</div>
            })()}
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Mise en production</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{computed?.date_production || '—'}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Expédition</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{computed?.date_expedition || '—'}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Livraison</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{computed?.date_livraison || '—'}</div>
            </div>
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-900 select-none">
              <input type="checkbox" checked={!!form.date_survey} onChange={e => setForm((f:any)=>({ ...f, date_survey: e.target.checked ? todayISO() : '' }))} />
              Survey (oui/non)
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500">Lieu de pose</label>
            <input className={CONTROL} placeholder="Lieu de pose" title="Lieu de pose" value={form.lieu_pose||''} onChange={e=>setForm((f:any)=>({...f,lieu_pose:e.target.value}))} />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs text-gray-500">Commentaires</label>
            <textarea className={CONTROL} placeholder="Commentaires" title="Commentaires" value={form.commentaires||''} onChange={e=>setForm((f:any)=>({...f,commentaires:e.target.value}))} rows={2} />
          </div>

          {manualOpen && (
            <div className="md:col-span-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-gray-900">Mode manuel</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500">État</label>
                  <select
                    className={CONTROL}
                    title="État"
                    value={form.etat||''}
                    onChange={e=>setForm((f:any)=>({...f,etat:e.target.value}))}
                  >
                    <option value="">—</option>
                    {ETATS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500">Mise en production (date)</label>
                  <input className={CONTROL} type="date" title="Date production" value={form.date_production||''} onChange={e=>setForm((f:any)=>({...f,date_production:e.target.value}))} />
                </div>

                <div>
                  <label className="block text-xs text-gray-500">Expédition (date)</label>
                  <input className={CONTROL} type="date" title="Date expédition" value={form.date_expedition||''} onChange={e=>setForm((f:any)=>({...f,date_expedition:e.target.value}))} />
                </div>

                <div>
                  <label className="block text-xs text-gray-500">Livraison (date)</label>
                  <input className={CONTROL} type="date" title="Date livraison" value={form.date_livraison||''} onChange={e=>setForm((f:any)=>({...f,date_livraison:e.target.value}))} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500">Note production</label>
                  <input
                    className={CONTROL}
                    placeholder="Note production (optionnel)"
                    title="Note production"
                    value={form.production_note||''}
                    onChange={e=>setForm((f:any)=>({...f,production_note:e.target.value}))}
                  />
                </div>
              </div>
            </div>
          )}

          {!editing && (
            <div className="md:col-span-3">
              <div className="text-xs text-gray-500">Photos</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className={CONTROL}
                  placeholder="Tag (ex: chantier, avant, après, livraison…)"
                  title="Tag photos"
                  value={photoTag}
                  onChange={e => setPhotoTag(e.target.value)}
                />
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <label
                      className="px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)] cursor-pointer"
                      title="Choisir des fichiers"
                    >
                      Choisir des fichiers
                      <input
                        key={photoInputKey}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => setPhotoFiles(Array.from(e.target.files || []))}
                      />
                    </label>
                    <div className="text-sm text-gray-700">
                      {photoFiles.length ? `${photoFiles.length} fichier(s) sélectionné(s)` : 'Aucun fichier choisi'}
                    </div>
                    <button
                      type="button"
                      className="ml-auto px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"
                      onClick={() => {
                        if (!photoFiles.length) return
                        const tag = (photoTag || '').trim() || 'Photos'
                        setPhotoBatches(prev => [...prev, { tag, files: photoFiles }])
                        setPhotoFiles([])
                        setPhotoTag('')
                        setPhotoInputKey(k => k + 1)
                      }}
                      title="Ajouter ce lot"
                      disabled={!photoFiles.length}
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {photoBatches.length > 0 && (
                <div className="mt-2 space-y-1">
                  {photoBatches.map((b, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-semibold">{b.tag}</span> — {b.files.length} fichier(s)
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50"
                        onClick={() => setPhotoBatches(prev => prev.filter((_, i) => i !== idx))}
                        title="Retirer"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="px-4 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]">{editing ? 'Modifier' : 'Créer'}</button>
          {editing && (
            <button
              type="button"
              className="px-4 py-2 bg-white border text-gray-800 rounded-lg hover:bg-gray-50 transition active:scale-[0.99]"
              onClick={()=>{setEditing(null);setManualOpen(false);setForm({ planningType: 'AUTO' })}}
            >
              Annuler
            </button>
          )}
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
      </form>
      )}

      {view === 'list' && (
      <div className="mt-0 bg-white border border-gray-200 rounded-xl overflow-x-auto overflow-hidden">
      <table className="w-full min-w-[980px]">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Client</th>
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Produit</th>
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Poseur</th>
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">État</th>
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Commande</th>
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Pose</th>
            <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Lieu</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map(c=>(
            <tr
              key={c.id}
              id={`commande-${c.id}`}
              className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 transition-colors ${c.client?.favorite ? 'bg-[color:var(--brand-accent-soft)]' : ''} ${typeof router.query.id === 'string' && router.query.id === c.id ? 'bg-yellow-50' : ''}`}
              onClick={() => router.push(`/commandes/${c.id}`)}
            >
              <td className="p-3 text-sm text-gray-900">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleFavoriteCommande(c.id)
                    }}
                    className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md bg-white hover:bg-gray-50 border border-gray-200 transition"
                    title={favoriteCommandes[c.id] ? 'Retirer la priorité' : 'Mettre en priorité'}
                    aria-label={favoriteCommandes[c.id] ? 'Retirer la priorité' : 'Mettre en priorité'}
                  >
                    <svg
                      className={`w-4 h-4 ${favoriteCommandes[c.id] ? 'text-amber-600' : 'text-gray-300'}`}
                      viewBox="0 0 24 24"
                      fill={favoriteCommandes[c.id] ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  <span className="truncate">{c.client?.name}</span>
                </div>
              </td>
              <td className="p-3 text-sm text-gray-900">{c.product}</td>
              <td className="p-3 text-sm text-gray-900">{c.poseur?.name}</td>
              <td className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center border rounded-full px-2 py-1 text-xs ${etatClass(displayEtat(c))}`}>
                    {etatLabel(displayEtat(c))}
                  </span>
                  {milestoneLateness(c) === 'TODAY' ? (
                    <span className="inline-flex items-center border rounded-full px-2 py-1 text-xs border-amber-200 bg-amber-50 text-amber-900">
                      Aujourd’hui
                    </span>
                  ) : milestoneLateness(c) === 'OVERDUE' ? (
                    <span className={`inline-flex items-center border rounded-full px-2 py-1 text-xs ${etatClass('EN_RETARD')}`}>
                      {etatLabel('EN_RETARD')}
                    </span>
                  ) : null}
                  {parseISODate(c.done_pose_at) ? (
                    <span className="inline-flex items-center border rounded-full px-2 py-1 text-xs bg-green-50 text-green-700 border-green-200">
                      Complétée
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="p-3 text-sm text-gray-700">{c.date_commande?.slice(0,10) || '—'}</td>
              <td className="p-3 text-sm text-gray-700">{c.date_pose?.slice(0,10) || '—'}</td>
              <td className="p-3 text-sm text-gray-900">{c.lieu_pose}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}
    </AppShell>
  )
}