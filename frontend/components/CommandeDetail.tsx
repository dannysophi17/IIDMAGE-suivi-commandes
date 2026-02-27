import React from 'react'

function resolveUrl(apiUrl: string, url: string) {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${apiUrl}${url}`
  return `${apiUrl}/${url}`
}

export default function CommandeDetail({
  commande,
  apiUrl,
  photosHeaderRight,
  photosTop
}: {
  commande: any
  apiUrl: string
  photosHeaderRight?: React.ReactNode
  photosTop?: React.ReactNode
}) {
  if (!commande) return null

  const ETATS: Array<{ value: string; label: string }> = [
    { value: 'A_PLANIFIER', label: 'À planifier' },
    { value: 'EN_PRODUCTION', label: 'En production' },
    { value: 'A_EXPEDIER', label: 'À expédier' },
    { value: 'LIVREE', label: 'À livrer' },
    { value: 'A_POSER', label: 'À poser' },
    { value: 'POSEE', label: 'Posée' },
    { value: 'EN_RETARD', label: 'En retard' },
    { value: 'FACTURE_A_ENVOYER', label: 'Facture à envoyer' },
    { value: 'FACTUREE', label: 'Facturée' }
  ]

  function etatLabel(value: any) {
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) return 'À planifier'
    const found = ETATS.find(e => e.value === v)
    return found ? found.label : v
  }

  function parseISO(v: any) {
    if (!v) return null
    const raw = String(v).trim()
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

  function isOverdue() {
    const pose = parseISO(commande.date_pose)
    if (!pose) return false
    if (parseISO(commande.done_pose_at)) return false
    return pose.getTime() < startOfToday().getTime()
  }

  type Lateness = 'OVERDUE' | 'TODAY' | null

  function dateOnly(d: Date) {
    const out = new Date(d)
    out.setHours(12, 0, 0, 0)
    return out
  }

  function milestoneLateness(base: string): Lateness {
    if (base === 'FACTURE_A_ENVOYER' || base === 'FACTUREE') return null
    if (parseISO(commande.done_pose_at)) return null
    const today = dateOnly(startOfToday())

    function calc(dueRaw: any, doneRaw: any): Lateness {
      const due = parseISO(dueRaw)
      if (!due) return null
      const done = parseISO(doneRaw)
      if (done) return null
      const diff = Math.floor((dateOnly(due).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      if (diff < 0) return 'OVERDUE'
      if (diff === 0) return 'TODAY'
      return null
    }

    switch (base) {
      case 'EN_PRODUCTION':
        return calc(commande.date_production, commande.done_production_at)
      case 'A_EXPEDIER':
        return calc(commande.date_expedition, commande.done_expedition_at)
      case 'LIVREE':
        return calc(commande.date_livraison, commande.done_livraison_at)
      case 'A_POSER':
        return calc(commande.date_pose, commande.done_pose_at)
      default:
        return null
    }
  }

  function deriveEtatFromDates() {
    const poseDone = parseISO(commande.done_pose_at)
    if (poseDone) return 'POSEE'

    const livraisonDone = parseISO(commande.done_livraison_at)
    if (livraisonDone) return 'A_POSER'

    const expeditionDone = parseISO(commande.done_expedition_at)
    if (expeditionDone) return 'LIVREE'

    const productionDone = parseISO(commande.done_production_at)
    if (productionDone) return 'A_EXPEDIER'

    const production = parseISO(commande.date_production)
    if (production) return 'EN_PRODUCTION'

    return 'A_PLANIFIER'
  }

  function displayEtat() {
    const raw = typeof commande.etat === 'string' ? commande.etat.trim() : ''
    if (raw === 'FACTURE_A_ENVOYER' || raw === 'FACTUREE') return raw
    return deriveEtatFromDates()
  }

  const baseEtat = displayEtat()
  const lateness = milestoneLateness(baseEtat)
  const overdue = lateness === 'OVERDUE'
  const dueToday = lateness === 'TODAY'
  const completed = parseISO(commande.done_pose_at) != null

  const attachments = Array.isArray(commande.attachments) ? commande.attachments : []
  const photosByTag: Record<string, any[]> = {}
  for (const a of attachments) {
    const tag = (a?.type || 'Photos').toString().trim() || 'Photos'
    if (!photosByTag[tag]) photosByTag[tag] = []
    photosByTag[tag].push(a)
  }

  const tagEntries = Object.entries(photosByTag).sort((a, b) => a[0].localeCompare(b[0]))

  const mapQuery = String(commande.lieu_pose || commande.client?.address || '').trim()
  const mapsHref = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : ''
  const mapsEmbed = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : ''

  function fmtDate(v: any) {
    if (!v) return '—'
    try {
      return String(v).slice(0, 10)
    } catch {
      return '—'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {commande.product || 'Commande'}
          </h2>
          <div className="mt-1 text-sm text-gray-600 flex items-center gap-2 flex-wrap">
            <span>Client: {commande.client?.name || '—'}</span>
            {commande.client?.favorite ? (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-[color:var(--brand-accent-soft)] text-[color:var(--brand-ink)] border-[color:var(--brand-accent-border)]"
                title="Client prioritaire"
              >
                <span className="text-amber-600" aria-hidden>
                  ★
                </span>
                Client prioritaire
              </span>
            ) : null}
          </div>
          <div className="text-sm text-gray-600">Poseur: {commande.poseur?.name || '—'}</div>
          <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
            <span>État: {etatLabel(baseEtat)}</span>
            {overdue ? (
              <span className="inline-flex items-center border rounded-full px-2 py-0.5 text-xs bg-red-50 text-red-700 border-red-200">
                En retard
              </span>
            ) : null}
            {dueToday ? (
              <span className="inline-flex items-center border rounded-full px-2 py-0.5 text-xs border-amber-200 bg-amber-50 text-amber-900">
                Aujourd’hui
              </span>
            ) : null}
            {completed ? (
              <span className="inline-flex items-center border rounded-full px-2 py-0.5 text-xs bg-green-50 text-green-700 border-green-200">
                Complétée
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-gray-500">#{String(commande.id || '').slice(0, 8)}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="text-sm text-gray-700">
          <div><span className="text-gray-500">Date commande:</span> {fmtDate(commande.date_commande)}</div>
          <div><span className="text-gray-500">Survey:</span> {commande.date_survey ? 'Oui' : 'Non'}</div>
          <div><span className="text-gray-500">Production:</span> {fmtDate(commande.date_production)}</div>
          <div><span className="text-gray-500">Expédition:</span> {fmtDate(commande.date_expedition)}</div>
        </div>
        <div className="text-sm text-gray-700">
          <div><span className="text-gray-500">Livraison:</span> {fmtDate(commande.date_livraison)}</div>
          <div><span className="text-gray-500">Pose:</span> {fmtDate(commande.date_pose)}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span><span className="text-gray-500">Lieu de pose:</span> {commande.lieu_pose || '—'}</span>
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-gray-700 hover:text-gray-900"
                title="Ouvrir dans Google Maps"
              >
                Ouvrir dans Maps
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {mapsEmbed ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-900">Plan</h3>
          <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
            <iframe
              title="Carte"
              src={mapsEmbed}
              className="w-full h-64"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Photos</h3>
          {photosHeaderRight ? <div className="shrink-0">{photosHeaderRight}</div> : null}
        </div>
        {photosTop ? <div>{photosTop}</div> : null}
        {tagEntries.length === 0 ? (
          <div className="mt-1 text-xs text-gray-400">Aucune photo</div>
        ) : (
          <div className="mt-2 space-y-4">
            {tagEntries.map(([tag, items]) => (
              <div key={tag}>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{tag}</div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {items.map((a: any) => (
                    <a key={a.id} href={resolveUrl(apiUrl, a.url)} target="_blank" rel="noreferrer">
                      <img
                        src={resolveUrl(apiUrl, a.url)}
                        alt={tag}
                        className="rounded-lg border border-gray-200 w-full h-28 md:h-32 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-900">Commentaires</h3>
        <div className="mt-1 text-sm text-gray-700 whitespace-pre-line">
          {commande.commentaires || '—'}
        </div>
      </div>
    </div>
  )
}
