import React, { useEffect, useMemo, useState } from 'react'
import Router from 'next/router'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import ConfirmDialog from '../components/ConfirmDialog'

type Poseur = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  zone?: string | null
  availability?: boolean | null
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

export default function PoseursPage() {
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const [poseurs, setPoseurs] = useState<Poseur[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [zone, setZone] = useState('')
  const [availability, setAvailability] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  function toast(kind: 'success' | 'error' | 'info', message: string) {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('iidmage-toast', { detail: { kind, message } }))
  }

  const queryEditId = useMemo(() => {
    const q = router.query.edit
    return typeof q === 'string' ? q : ''
  }, [router.query.edit])

  async function load() {
    const token = getToken()
    if (!token) {
      Router.replace('/login')
      return
    }
    setLoading(true)
    setError('')
    const res = await authFetch(`${API_URL}/poseurs`)
    if (res.status === 401) {
      Router.replace('/login')
      return
    }
    if (!res.ok) {
      setError('Erreur de chargement')
      setLoading(false)
      return
    }
    setPoseurs(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    if (!queryEditId) return
    const token = getToken()
    if (!token) {
      Router.replace('/login')
      return
    }

    ;(async () => {
      setError('')
      const res = await authFetch(`${API_URL}/poseurs/${encodeURIComponent(queryEditId)}`)
      if (res.status === 401) {
        Router.replace('/login')
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || 'Erreur')
        return
      }
      const p = await res.json()
      setName(p?.name || '')
      setEmail(p?.email || '')
      setPhone(p?.phone || '')
      setZone(p?.zone || '')
      setAvailability(p?.availability !== false)
      setEditingId(queryEditId)
      router.replace('/poseurs', undefined, { shallow: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, queryEditId, API_URL])

  async function create(e: any) {
    e.preventDefault()
    setError('')
    const payload = {
      name,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      zone: zone.trim() || undefined,
      availability
    }
    const isEditing = !!editingId
    const url = isEditing ? `${API_URL}/poseurs/${editingId}` : `${API_URL}/poseurs`
    const method = isEditing ? 'PATCH' : 'POST'
    const res = await authFetch(url, {
      method,
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError('Erreur')
      return
    }

    const saved = await res.json().catch(() => null)
    const nextId = editingId || saved?.id
    setName('')
    setEmail('')
    setPhone('')
    setZone('')
    setAvailability(true)
    setEditingId(null)
    await load()
    toast('success', isEditing ? 'Poseur mis à jour.' : 'Poseur créé avec succès.')
    if (isEditing && nextId) {
      Router.push(`/poseurs/${encodeURIComponent(nextId)}`)
    }
  }

  async function removeNow(id: string) {
    setError('')
    const res = await authFetch(`${API_URL}/poseurs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      load()
      toast('success', 'Poseur supprimé.')
      return
    }
    const j = await res.json().catch(() => ({}))
    setError(j.message || 'Erreur')
  }

  return (
    <AppShell title="Poseurs">
      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Supprimer le poseur"
        message="Confirmer la suppression de ce poseur."
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

      {error ? (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <form onSubmit={create} className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label htmlFor="poseur-name" className="block text-xs text-gray-500">Nom</label>
            <input
              id="poseur-name"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              title="Nom"
              placeholder="Nom du poseur"
            />
          </div>

          <div>
            <label htmlFor="poseur-email" className="block text-xs text-gray-500">Email (optionnel)</label>
            <input
              id="poseur-email"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={email}
              onChange={e => setEmail(e.target.value)}
              title="Email"
              type="email"
              placeholder="nom@exemple.com"
            />
          </div>

          <div>
            <label htmlFor="poseur-phone" className="block text-xs text-gray-500">Téléphone (optionnel)</label>
            <input
              id="poseur-phone"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              title="Téléphone"
              placeholder="+33 ..."
            />
          </div>

          <div>
            <label htmlFor="poseur-zone" className="block text-xs text-gray-500">Zone (optionnel)</label>
            <input
              id="poseur-zone"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={zone}
              onChange={e => setZone(e.target.value)}
              title="Zone"
              placeholder="Paris / Île-de-France"
            />
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-start">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 select-none">
              <input type="checkbox" checked={availability} onChange={e => setAvailability(e.target.checked)} />
              Disponible
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button
                className="px-4 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]"
                type="submit"
              >
                {editingId ? 'Modifier' : 'Créer'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="px-4 py-2 bg-white border text-gray-800 rounded-lg hover:bg-gray-50 transition active:scale-[0.99]"
                  onClick={() => {
                    const id = editingId
                    setEditingId(null)
                    setName('')
                    setEmail('')
                    setPhone('')
                    setZone('')
                    setAvailability(true)
                    if (id) Router.push(`/poseurs/${encodeURIComponent(id)}`)
                  }}
                  title="Annuler"
                >
                  Annuler
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </form>

      <div className="mt-6 bg-white border rounded-xl overflow-x-auto overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Chargement…</div>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Nom</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Téléphone</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Zone</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody>
              {poseurs.map(p => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t hover:bg-gray-50 transition-colors"
                  onClick={() => Router.push(`/poseurs/${encodeURIComponent(p.id)}`)}
                >
                  <td className="p-3 text-sm text-gray-800">{p.name}</td>
                  <td className="p-3 text-sm text-gray-700">{p.email || '—'}</td>
                  <td className="p-3 text-sm text-gray-700">{p.phone || '—'}</td>
                  <td className="p-3 text-sm text-gray-700">{p.zone || '—'}</td>
                  <td className="p-3 text-sm text-gray-700">{p.availability === false ? 'Indisponible' : 'Disponible'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  )
}
