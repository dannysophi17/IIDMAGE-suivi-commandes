import React, { useEffect, useState } from 'react'
import Router from 'next/router'
import AppShell from '../components/AppShell'

type Role = 'OWNER' | 'MANAGER' | 'POSEUR' | 'READONLY'
type Me = { id: string; email: string; name?: string | null; phone?: string | null; role: Role }

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

export default function ProfilePage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)

  const [me, setMe] = useState<Me | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)

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
        const res = await authFetch(`${API_URL}/me`)
        if (res.status === 401) {
          Router.replace('/login')
          return
        }
        if (!res.ok) throw new Error('Erreur /me')
        const j = (await res.json()) as Me
        setMe(j)
        setForm({
          name: (j.name || '').toString(),
          email: (j.email || '').toString(),
          phone: (j.phone || '').toString(),
          password: ''
        })
        setEditing(false)
      } catch (e: any) {
        setError(e?.message || 'Erreur')
      } finally {
        setLoading(false)
      }
    })()
  }, [API_URL])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        phone: form.phone
      }
      if (form.password.trim()) payload.password = form.password

      const res = await authFetch(`${API_URL}/me`, { method: 'PATCH', body: JSON.stringify(payload) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Erreur')
      }
      const updated = (await res.json()) as Me
      setMe(updated)
      setForm(s => ({ ...s, password: '' }))
      setSuccess('Profil mis à jour')
      setEditing(false)
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    setSuccess('')
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    if (!me) {
      setEditing(false)
      return
    }
    setForm({
      name: (me.name || '').toString(),
      email: (me.email || '').toString(),
      phone: (me.phone || '').toString(),
      password: ''
    })
    setEditing(false)
    setSuccess('')
    setError('')
  }

  return (
    <AppShell title="Mon profil">
      {(() => {
        const CONTROL =
          'mt-1 w-full border rounded-lg px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)] disabled:opacity-60'
        return (
      <div className="max-w-2xl">
        {loading ? (
          <p className="text-gray-700">Chargement...</p>
        ) : (
          <div className="bg-white border rounded-2xl p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm text-gray-600">
                {me ? (
                  <>
                    <div className="font-semibold text-gray-900">{me.name || me.email}</div>
                    <div className="mt-0.5">Rôle: {me.role}</div>
                  </>
                ) : null}
              </div>
              {!editing ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                  title="Éditer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                  Éditer
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-900 text-sm transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)]"
                    title="Annuler"
                    disabled={busy}
                  >
                    Annuler
                  </button>
                  <button
                    form="profile-form"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)]"
                    disabled={busy}
                    title="Enregistrer"
                  >
                    Enregistrer
                  </button>
                </div>
              )}
            </div>

            {error ? <div className="mt-4 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="mt-4 text-sm text-green-700">{success}</div> : null}

            <form id="profile-form" onSubmit={save} className="mt-5 grid gap-3">
              <div>
                <label htmlFor="profile-name" className="text-sm font-medium text-gray-700">Nom et prénom</label>
                <input
                  id="profile-name"
                  className={CONTROL}
                  value={form.name}
                  onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                  placeholder="Nom et prénom"
                  pattern=".*\\s+.*"
                  required
                  disabled={!editing}
                />
              </div>

              <div>
                <label htmlFor="profile-email" className="text-sm font-medium text-gray-700">Email</label>
                <input
                  id="profile-email"
                  className={CONTROL}
                  value={form.email}
                  onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                  type="email"
                  required
                  disabled={!editing}
                />
              </div>

              <div>
                <label htmlFor="profile-phone" className="text-sm font-medium text-gray-700">Numéro</label>
                <input
                  id="profile-phone"
                  className={CONTROL}
                  value={form.phone}
                  onChange={e => setForm(s => ({ ...s, phone: e.target.value }))}
                  placeholder="Numéro"
                  disabled={!editing}
                />
              </div>

              <div>
                <label htmlFor="profile-password" className="text-sm font-medium text-gray-700">Nouveau mot de passe</label>
                <input
                  id="profile-password"
                  className={CONTROL}
                  value={form.password}
                  onChange={e => setForm(s => ({ ...s, password: e.target.value }))}
                  type="password"
                  placeholder="(laisser vide pour ne pas changer)"
                  disabled={!editing}
                />
              </div>
            </form>
          </div>
        )}
      </div>
        )
      })()}
    </AppShell>
  )
}
