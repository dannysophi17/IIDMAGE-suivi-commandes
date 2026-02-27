import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../components/AppShell'
import CommandeDetail from '../../components/CommandeDetail'
import ConfirmDialog from '../../components/ConfirmDialog'

function authFetch(input: RequestInfo, init?: RequestInit) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('token') || sessionStorage.getItem('token')
      : null

  const headers = { ...(init?.headers || {}) } as any
  if (token) headers.authorization = `Bearer ${token}`
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

export default function CommandeDetailPage() {
  const router = useRouter()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const id = typeof router.query.id === 'string' ? router.query.id : ''

  const [commande, setCommande] = useState<any>(null)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [tag, setTag] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [showUploader, setShowUploader] = useState(false)
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
    const res = await authFetch(`${API_URL}/commandes/${id}`)
    if (res.ok) {
      setCommande(await res.json())
    }
  }

  useEffect(() => {
    if (!id) return
    setError('')
    ;(async () => {
      const res = await authFetch(`${API_URL}/commandes/${id}`)
      if (res.ok) {
        setCommande(await res.json())
      } else {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Erreur')
      }
    })()
  }, [id])

  async function uploadNow() {
    if (!id) return
    setUploadError('')
    const normalizedTag = (tag || '').trim() || 'Photos'
    if (!files.length) {
      setUploadError('Aucun fichier choisi')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('tag', normalizedTag)
      for (const f of files) fd.append('files', f)
      const res = await authFetchMultipart(`${API_URL}/commandes/${id}/attachments`, {
        method: 'POST',
        body: fd
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setUploadError(j.error || 'Erreur upload')
        return
      }
      setFiles([])
      setTag('')
      setFileKey(k => k + 1)
      await reload()
    } finally {
      setUploading(false)
    }
  }

  async function deleteNow() {
    if (!id) return
    const res = await authFetch(`${API_URL}/commandes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      queueToast('success', 'Commande supprimée.')
      router.push('/commandes?view=list')
      return
    }
    const j = await res.json().catch(() => ({}))
    setError(j.error || 'Erreur suppression')
  }

  return (
    <AppShell title="Commande" hideSidebarToggle>
      <ConfirmDialog
        open={pendingDelete}
        title="Supprimer la commande"
        message="Confirmer la suppression de cette commande."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
        onCancel={() => setPendingDelete(false)}
        onConfirm={async () => {
          setPendingDelete(false)
          await deleteNow()
        }}
      />

      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
            onClick={() => router.push('/commandes?view=list')}
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
              className="w-10 h-10 inline-flex items-center justify-center rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"
              onClick={() => router.push(`/commandes?view=form&edit=${id}`)}
              title="Éditer"
              aria-label="Éditer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="w-10 h-10 inline-flex items-center justify-center bg-red-600 text-white rounded-lg hover:bg-red-700 transition active:scale-[0.99]"
              onClick={() => setPendingDelete(true)}
              title="Supprimer"
              aria-label="Supprimer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!error && !commande && (
        <div className="text-sm text-gray-600">Chargement…</div>
      )}

      {commande && (
        <>
          <CommandeDetail
            commande={commande}
            apiUrl={API_URL}
            photosHeaderRight={
              <button
                type="button"
                className="w-8 h-8 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                onClick={() => setShowUploader(v => !v)}
                title="Ajouter des photos"
              >
                +
              </button>
            }
            photosTop={
              showUploader ? (
                <div className="mt-2 bg-white border border-gray-200 rounded-xl p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:border-[color:var(--brand-btn-border)]"
                      value={tag}
                      onChange={e => setTag(e.target.value)}
                      placeholder="Tag (ex: avant, après, chantier…)"
                      title="Tag"
                    />
                    <div className="md:col-span-2 flex items-center gap-2">
                      <label
                        className="px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)] cursor-pointer"
                        title="Choisir des fichiers"
                      >
                        Choisir des fichiers
                        <input
                          key={fileKey}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => setFiles(Array.from(e.target.files || []))}
                        />
                      </label>
                      <div className="text-sm text-gray-700">
                        {files.length ? `${files.length} fichier(s) sélectionné(s)` : 'Aucun fichier choisi'}
                      </div>
                      <button
                        type="button"
                        className="ml-auto px-3 py-2 rounded-lg transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-gray-900 border border-[color:var(--brand-accent-border)] disabled:opacity-60"
                        onClick={uploadNow}
                        disabled={uploading || files.length === 0}
                        title="Uploader"
                      >
                        {uploading ? '…' : 'Uploader'}
                      </button>
                    </div>
                  </div>
                  {uploadError && (
                    <div className="mt-2 text-sm text-red-700">{uploadError}</div>
                  )}
                </div>
              ) : null
            }
          />
        </>
      )}
    </AppShell>
  )
}
