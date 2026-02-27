import React, { useEffect, useMemo, useState } from 'react'
import Router from 'next/router'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

type Client = { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null; favorite?: boolean }

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

export default function ClientsPage() {
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
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
    const res = await authFetch(`${API_URL}/clients`)
    if (res.status === 401) {
      Router.replace('/login')
      return
    }
    if (!res.ok) {
      setError('Erreur de chargement')
      setLoading(false)
      return
    }
    setClients(await res.json())
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
      const res = await authFetch(`${API_URL}/clients/${encodeURIComponent(queryEditId)}`)
      if (res.status === 401) {
        Router.replace('/login')
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || 'Erreur')
        return
      }

      const c = await res.json()
      setForm({
        name: c?.name || '',
        email: c?.email || '',
        phone: c?.phone || '',
        address: c?.address || '',
        notes: c?.notes || ''
      })
      setEditingId(queryEditId)
      router.replace('/clients', undefined, { shallow: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, queryEditId, API_URL])

  async function create(e: any) {
    e.preventDefault()
    setError('')
    const payload = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined
    }

    const isEditing = !!editingId
    const url = isEditing ? `${API_URL}/clients/${editingId}` : `${API_URL}/clients`
    const method = isEditing ? 'PATCH' : 'POST'
    const res = await authFetch(url, { method, body: JSON.stringify(payload) })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError('Erreur')
      return
    }

    const saved = await res.json().catch(() => null)
    const nextId = editingId || saved?.id
    setForm({ name: '', email: '', phone: '', address: '', notes: '' })
    setEditingId(null)
    await load()
    toast('success', isEditing ? 'Client mis à jour.' : 'Client créé avec succès.')
    if (isEditing && nextId) {
      Router.push(`/clients/${encodeURIComponent(nextId)}`)
    }
  }

  async function toggleFavorite(client: Client) {
    setError('')
    setBusyId(client.id)
    try {
      const res = await authFetch(`${API_URL}/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite: !client.favorite })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || 'Erreur')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell title="Clients">
      <form onSubmit={create} className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="client-name" className="block text-xs text-gray-500">Nom *</label>
            <input
              id="client-name"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              title="Nom"
              placeholder="Nom du client"
            />
          </div>

          <div>
            <label htmlFor="client-email" className="block text-xs text-gray-500">Email (optionnel)</label>
            <input
              id="client-email"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              title="Email"
              placeholder="email@exemple.com"
              type="email"
            />
          </div>

          <div>
            <label htmlFor="client-phone" className="block text-xs text-gray-500">Téléphone (optionnel)</label>
            <input
              id="client-phone"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              title="Téléphone"
              placeholder="+33 …"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="client-address" className="block text-xs text-gray-500">Adresse (optionnel)</label>
            <input
              id="client-address"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              title="Adresse"
              placeholder="Adresse"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="client-notes" className="block text-xs text-gray-500">Notes (optionnel)</label>
            <textarea
              id="client-notes"
              className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              title="Notes"
              placeholder="Infos utiles…"
              rows={2}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="px-4 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]" type="submit">
            {editingId ? 'Modifier' : 'Créer'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="px-4 py-2 bg-white border text-gray-800 rounded-lg hover:bg-gray-50 transition active:scale-[0.99]"
              onClick={() => {
                const id = editingId
                setEditingId(null)
                setForm({ name: '', email: '', phone: '', address: '', notes: '' })
                if (id) Router.push(`/clients/${encodeURIComponent(id)}`)
              }}
              title="Annuler"
            >
              Annuler
            </button>
          ) : null}
          <div className="text-xs text-gray-500">Les champs optionnels peuvent être remplis plus tard.</div>
        </div>
      </form>

      {error && <div className="mt-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Chargement…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Nom</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                <th className="p-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Téléphone</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 transition-colors"
                  onClick={() => Router.push(`/clients/${encodeURIComponent(c.id)}`)}
                >
                  <td className="p-3 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-1.5 py-1 rounded-lg border border-transparent bg-transparent hover:bg-gray-50 transition active:scale-[0.99]"
                        onClick={e => {
                          e.stopPropagation()
                          toggleFavorite(c)
                        }}
                        disabled={busyId === c.id}
                        title={c.favorite ? 'Retirer des favoris' : 'Marquer comme favori'}
                      >
                        <span className={c.favorite ? 'text-amber-600' : 'text-gray-400'}>
                          {c.favorite ? '★' : '☆'}
                        </span>
                      </button>
                      <div className="font-medium">{c.name}</div>
                    </div>
                    {(c.address || c.notes) && (
                      <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                        {c.address ? c.address : c.notes}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-700">{c.email || '—'}</td>
                  <td className="p-3 text-sm text-gray-700">{c.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  )
}
