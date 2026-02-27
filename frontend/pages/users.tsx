import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AppShell from '../components/AppShell'
import ConfirmDialog from '../components/ConfirmDialog'
import Toast, { ToastKind } from '../components/Toast'

type Role = 'OWNER' | 'MANAGER' | 'POSEUR' | 'READONLY'
type Me = { id: string; email: string; name?: string | null; role: Role }
type User = { id: string; email: string; name?: string | null; phone?: string | null; role: Role }
type UsersResponse = { items: User[]; total: number; page: number; limit: number; totalPages: number }

function authFetch(input: RequestInfo, init?: RequestInit) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || sessionStorage.getItem('token')
      : null
  const headers = { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  if (token) (headers as any).authorization = `Bearer ${token}`
  return fetch(input, { ...init, headers })
}

export default function UsersPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const LIMIT = 8

  const [me, setMe] = useState<Me | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [newUser, setNewUser] = useState({ email: '', name: '', phone: '', password: '', role: 'READONLY' as Role })
  const [editDraft, setEditDraft] = useState<Record<string, { email: string; name: string; phone: string; role: Role }>>({})
  const [saveBusy, setSaveBusy] = useState<Record<string, boolean>>({})

  const [pwDraft, setPwDraft] = useState<Record<string, string>>({})
  const [pwBusy, setPwBusy] = useState<Record<string, boolean>>({})

  const [toast, setToast] = useState<{ open: boolean; kind: ToastKind; message: string }>({
    open: false,
    kind: 'info',
    message: ''
  })
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function showToast(kind: ToastKind, message: string) {
    setToast({ open: true, kind, message })
  }

  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    for (let i = 1; i <= totalPages; i++) pages.push(i)
    return pages
  }, [totalPages])

  async function load(nextPage: number) {
    setLoading(true)
    setError('')
    try {
      const meRes = await authFetch(`${API_URL}/me`)
      if (!meRes.ok) throw new Error('No autorizado')
      const meJson = (await meRes.json()) as Me
      setMe(meJson)

      if (meJson.role !== 'OWNER') {
        setUsers([])
        setTotalPages(1)
        return
      }

      const usersRes = await authFetch(`${API_URL}/users?page=${encodeURIComponent(String(nextPage))}&limit=${LIMIT}`)
      if (!usersRes.ok) throw new Error('No autorizado o error')
      const j = (await usersRes.json()) as UsersResponse
      setUsers(j.items || [])
      setPage(j.page || nextPage)
      setTotalPages(j.totalPages || 1)
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!me || me.role !== 'OWNER') return
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    if (!users.length) return
    setEditDraft(d => {
      const next = { ...d }
      let changed = false
      for (const u of users) {
        if (!next[u.id]) {
          next[u.id] = {
            email: u.email || '',
            name: (u.name || '').toString(),
            phone: (u.phone || '').toString(),
            role: u.role
          }
          changed = true
        }
      }
      return changed ? next : d
    })
  }, [users])

  async function saveUser(id: string) {
    const draft = editDraft[id]
    if (!draft) return
    setSaveBusy(s => ({ ...s, [id]: true }))
    try {
      const res = await authFetch(`${API_URL}/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ email: draft.email, name: draft.name, phone: draft.phone, role: draft.role })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast('error', j.error || 'Erreur')
        return
      }
      await load(page)
      showToast('success', 'Utilisateur mis à jour')
    } finally {
      setSaveBusy(s => ({ ...s, [id]: false }))
    }
  }

  async function removeUser(id: string) {
    setPendingDeleteId(id)
  }

  async function removeUserNow(id: string) {
    const res = await authFetch(`${API_URL}/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('success', 'Utilisateur supprimé')
      load(page)
    } else {
      const j = await res.json().catch(() => ({}))
      showToast('error', j.error || 'Erreur')
    }
  }

  async function resetPassword(id: string) {
    const password = (pwDraft[id] || '').trim()
    if (!password) return
    setPwBusy(s => ({ ...s, [id]: true }))
    try {
      const res = await authFetch(`${API_URL}/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast('error', j.error || 'Erreur')
        return
      }
      setPwDraft(s => ({ ...s, [id]: '' }))
      showToast('success', 'Mot de passe mis à jour')
    } finally {
      setPwBusy(s => ({ ...s, [id]: false }))
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    const res = await authFetch(`${API_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone || undefined,
        password: newUser.password,
        role: newUser.role
      })
    })
    if (res.ok) {
      setNewUser({ email: '', name: '', phone: '', password: '', role: 'READONLY' })
      load(page)
      showToast('success', 'Utilisateur créé')
    } else {
      const j = await res.json().catch(() => ({}))
      showToast('error', j.error || 'Error')
    }
  }

  return (
    <AppShell title="Administration">
      <Toast open={toast.open} kind={toast.kind} message={toast.message} onClose={() => setToast(s => ({ ...s, open: false }))} />

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Supprimer l’utilisateur"
        message="Confirmer la suppression de cet utilisateur."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          const id = pendingDeleteId
          setPendingDeleteId(null)
          if (!id) return
          await removeUserNow(id)
        }}
      />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="mt-4">Chargement...</p>
      ) : me?.role !== 'OWNER' ? (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="font-semibold text-gray-900">Accès refusé</div>
          <div className="mt-1 text-sm text-gray-600">Seul le rôle OWNER peut gérer les utilisateurs.</div>
          <Link href="/profile" className="inline-flex items-center gap-2 mt-4 px-3 py-2 rounded-lg text-sm transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]">Modifier mon profil</Link>
        </div>
      ) : (
        <>
          <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left text-gray-700">Email</th>
                    <th className="p-2 text-left text-gray-700">Nom</th>
                    <th className="p-2 text-left text-gray-700">Numéro</th>
                    <th className="p-2 text-left text-gray-700">Rôle</th>
                    <th className="p-2 text-left text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-gray-100">
                      <td className="p-2 align-top">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={(editDraft[u.id]?.email ?? u.email) || ''}
                          onChange={e =>
                            setEditDraft(s => ({
                              ...s,
                              [u.id]: {
                                ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                                email: e.target.value
                              }
                            }))
                          }
                          title="Email"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={(editDraft[u.id]?.name ?? (u.name || '')) as string}
                          onChange={e =>
                            setEditDraft(s => ({
                              ...s,
                              [u.id]: {
                                ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                                name: e.target.value
                              }
                            }))
                          }
                          title="Nom et prénom"
                          placeholder="Nom et prénom"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={(editDraft[u.id]?.phone ?? (u.phone || '')) as string}
                          onChange={e =>
                            setEditDraft(s => ({
                              ...s,
                              [u.id]: {
                                ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                                phone: e.target.value
                              }
                            }))
                          }
                          title="Numéro"
                          placeholder="Numéro"
                        />
                      </td>
                      <td className="p-2 align-top">
                        <select
                          className="w-full border rounded px-2 py-1"
                          value={(editDraft[u.id]?.role ?? u.role) as any}
                          onChange={e =>
                            setEditDraft(s => ({
                              ...s,
                              [u.id]: {
                                ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                                role: e.target.value as Role
                              }
                            }))
                          }
                          title="Rôle utilisateur"
                        >
                          <option>OWNER</option>
                          <option>MANAGER</option>
                          <option>POSEUR</option>
                          <option>READONLY</option>
                        </select>
                      </td>
                      <td className="p-2 align-top">
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            className="px-3 py-2 rounded disabled:opacity-50 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                            onClick={() => saveUser(u.id)}
                            disabled={!!saveBusy[u.id]}
                            title="Enregistrer"
                            type="button"
                          >
                            {saveBusy[u.id] ? '…' : 'Enregistrer'}
                          </button>

                          <input
                            className="border p-2 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
                            placeholder="Nouveau mot de passe"
                            type="password"
                            value={pwDraft[u.id] || ''}
                            onChange={e => setPwDraft(s => ({ ...s, [u.id]: e.target.value }))}
                            title="Nouveau mot de passe"
                          />
                          <button
                            className="px-3 py-2 rounded disabled:opacity-50 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                            onClick={() => resetPassword(u.id)}
                            disabled={pwBusy[u.id] || !(pwDraft[u.id] || '').trim()}
                            type="button"
                          >
                            {pwBusy[u.id] ? '…' : 'Réinitialiser'}
                          </button>
                          <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition active:scale-95" onClick={() => removeUser(u.id)} type="button">
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {users.map(u => (
                <div key={u.id} className="p-4">
                  <div className="text-xs text-gray-500">{u.id}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Email</div>
                      <input
                        className="mt-1 w-full border rounded px-3 py-2"
                        value={(editDraft[u.id]?.email ?? u.email) || ''}
                        onChange={e =>
                          setEditDraft(s => ({
                            ...s,
                            [u.id]: {
                              ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                              email: e.target.value
                            }
                          }))
                        }
                        title="Email"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Nom</div>
                      <input
                        className="mt-1 w-full border rounded px-3 py-2"
                        value={(editDraft[u.id]?.name ?? (u.name || '')) as string}
                        onChange={e =>
                          setEditDraft(s => ({
                            ...s,
                            [u.id]: {
                              ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                              name: e.target.value
                            }
                          }))
                        }
                        title="Nom et prénom"
                        placeholder="Nom et prénom"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Numéro</div>
                      <input
                        className="mt-1 w-full border rounded px-3 py-2"
                        value={(editDraft[u.id]?.phone ?? (u.phone || '')) as string}
                        onChange={e =>
                          setEditDraft(s => ({
                            ...s,
                            [u.id]: {
                              ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                              phone: e.target.value
                            }
                          }))
                        }
                        title="Numéro"
                        placeholder="Numéro"
                      />
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Rôle</div>
                      <select
                        className="mt-1 w-full border rounded px-3 py-2"
                        value={(editDraft[u.id]?.role ?? u.role) as any}
                        onChange={e =>
                          setEditDraft(s => ({
                            ...s,
                            [u.id]: {
                              ...(s[u.id] || { email: u.email, name: u.name || '', phone: u.phone || '', role: u.role }),
                              role: e.target.value as Role
                            }
                          }))
                        }
                        title="Rôle utilisateur"
                      >
                        <option>OWNER</option>
                        <option>MANAGER</option>
                        <option>POSEUR</option>
                        <option>READONLY</option>
                      </select>
                    </div>

                    <div className="pt-1 flex flex-col gap-2">
                      <button
                        className="px-3 py-2 rounded disabled:opacity-50 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                        onClick={() => saveUser(u.id)}
                        disabled={!!saveBusy[u.id]}
                        type="button"
                      >
                        {saveBusy[u.id] ? '…' : 'Enregistrer'}
                      </button>

                      <input
                        className="border p-2 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
                        placeholder="Nouveau mot de passe"
                        type="password"
                        value={pwDraft[u.id] || ''}
                        onChange={e => setPwDraft(s => ({ ...s, [u.id]: e.target.value }))}
                        title="Nouveau mot de passe"
                      />
                      <button
                        className="px-3 py-2 rounded disabled:opacity-50 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                        onClick={() => resetPassword(u.id)}
                        disabled={pwBusy[u.id] || !(pwDraft[u.id] || '').trim()}
                        type="button"
                      >
                        {pwBusy[u.id] ? '…' : 'Réinitialiser'}
                      </button>

                      <button
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition active:scale-[0.99]"
                        onClick={() => removeUser(u.id)}
                        type="button"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {pageNumbers.map(p => (
              <button
                key={p}
                className={`px-3 py-1.5 rounded border text-sm transition ${
                  p === page
                    ? 'bg-[color:var(--brand-btn-bg)] text-[color:var(--brand-btn-fg)] border-[color:var(--brand-btn-border)]'
                    : 'bg-white hover:bg-gray-50 border-gray-200'
                }`}
                onClick={() => setPage(p)}
                type="button"
              >
                {p}
              </button>
            ))}
          </div>

          <section className="mt-6">
            <h2 className="font-semibold text-gray-900">Créer un utilisateur (OWNER)</h2>
            <form onSubmit={createUser} className="mt-2 flex flex-wrap gap-2">
              <input
                required
                placeholder="Email"
                value={newUser.email}
                onChange={e => setNewUser(s => ({ ...s, email: e.target.value }))}
                className="border p-2 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              />
              <input
                required
                placeholder="Nom et prénom"
                value={newUser.name}
                onChange={e => setNewUser(s => ({ ...s, name: e.target.value }))}
                className="border p-2 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
                title="Nom et prénom"
                pattern=".*\\s+.*"
              />
              <input
                placeholder="Numéro"
                value={newUser.phone}
                onChange={e => setNewUser(s => ({ ...s, phone: e.target.value }))}
                className="border p-2 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              />
              <input
                required
                placeholder="Mot de passe"
                type="password"
                value={newUser.password}
                onChange={e => setNewUser(s => ({ ...s, password: e.target.value }))}
                className="border p-2 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
              />
              <select
                value={newUser.role}
                onChange={e => setNewUser(s => ({ ...s, role: e.target.value as Role }))}
                className="border p-2 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
                title="Rôle nouvel utilisateur"
              >
                <option>MANAGER</option>
                <option>POSEUR</option>
                <option>READONLY</option>
              </select>
              <button className="px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]">Créer</button>
            </form>
          </section>
        </>
      )}
    </AppShell>
  )
}
