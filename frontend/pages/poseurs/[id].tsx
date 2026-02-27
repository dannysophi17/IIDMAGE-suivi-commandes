import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../components/AppShell'
import ConfirmDialog from '../../components/ConfirmDialog'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token') || sessionStorage.getItem('token')
}

function authFetch(input: RequestInfo, init?: RequestInit) {
  const token = getToken()
  const headers = { ...(init?.headers || {}) } as any
  if (token) headers.authorization = `Bearer ${token}`
  return fetch(input, { ...init, headers })
}

export default function PoseurDetailPage() {
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const id = typeof router.query.id === 'string' ? router.query.id : ''

  const [poseur, setPoseur] = useState<any>(null)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)

  function queueToast(kind: 'success' | 'error' | 'info', message: string) {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem('iidmage_toast', JSON.stringify({ kind, message }))
    } catch {
      // ignore
    }
  }

  async function reload() {
    if (!id) return
    setError('')
    const res = await authFetch(`${API_URL}/poseurs/${id}`)
    if (res.ok) {
      setPoseur(await res.json())
      return
    }
    const j = await res.json().catch(() => ({}))
    setError(j.message || 'Erreur')
  }

  useEffect(() => {
    if (!id) return
    const token = getToken()
    if (!token) {
      router.replace('/login')
      return
    }
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function deleteNow() {
    if (!id) return
    setError('')
    const res = await authFetch(`${API_URL}/poseurs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      queueToast('success', 'Poseur supprimé.')
      router.push('/poseurs')
      return
    }
    const j = await res.json().catch(() => ({}))
    setError(j.message || 'Erreur')
  }

  return (
    <AppShell title="Poseur">
      <ConfirmDialog
        open={pendingDelete}
        title="Supprimer le poseur"
        message="Confirmer la suppression de ce poseur."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onCancel={() => setPendingDelete(false)}
        onConfirm={async () => {
          setPendingDelete(false)
          await deleteNow()
        }}
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          className="w-10 h-10 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
          onClick={() => router.push('/poseurs')}
          title="Retour"
          aria-label="Retour"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 19l-7-7 7-7" />
            <path d="M3 12h18" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"
            onClick={() => router.push(`/poseurs?edit=${encodeURIComponent(id)}`)}
            title="Éditer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-red-600 hover:bg-red-700 text-white border border-red-700/20"
            onClick={() => setPendingDelete(true)}
            title="Supprimer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="mb-3 text-sm text-red-700">{error}</div>}
      {!error && !poseur && <div className="text-sm text-gray-600">Chargement…</div>}

      {poseur && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-lg font-semibold text-gray-900">{poseur.name}</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
            <div><span className="text-gray-500">Email:</span> {poseur.email || '—'}</div>
            <div><span className="text-gray-500">Téléphone:</span> {poseur.phone || '—'}</div>
            <div><span className="text-gray-500">Zone:</span> {poseur.zone || '—'}</div>
            <div><span className="text-gray-500">Statut:</span> {poseur.availability === false ? 'Indisponible' : 'Disponible'}</div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
