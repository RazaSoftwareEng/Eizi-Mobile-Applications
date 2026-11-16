import 'maplibre-gl/dist/maplibre-gl.css'

import maplibregl from 'maplibre-gl'
import { Map as MapIcon, MapPin, RefreshCw, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Avatar, Button, Card, ErrorBanner, PageHeader, Spinner, Toggle } from '../components/ui'
import { formatPrice, timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'
import { must, useLoad } from '../lib/useLoad'

const STYLE = 'https://tiles.openfreemap.org/styles/liberty' // free, no API key (OpenStreetMap data)
const DEFAULT: [number, number] = [74.3587, 31.5204] // Lahore
const PALETTE = ['#0E7A6B', '#B45309', '#4338CA', '#BE185D', '#0891B2', '#65A30D', '#9333EA', '#DC2626']

type Worker = {
  id: string
  name: string
  phone: string | null
  avatar: string | null
  rating: number
  ratings: number
  serviceId: number | null
  online: boolean
  lat: number | null
  lng: number | null
  seen: string | null
}
type Req = {
  id: number
  serviceId: number
  status: 'pending' | 'accepted'
  quote: string
  address: string
  lat: number
  lng: number
  customer: string
  worker: string | null
  fee: number
  created: string
}

async function loadLive() {
  const [services, presence, workers, bookings] = await Promise.all([
    supabase.from('services').select('id, name, sort').order('sort').then((r) => must(r) as { id: number; name: string }[]),
    supabase.from('provider_presence').select('user_id, is_online, latitude, longitude, updated_at').then(
      (r) => must(r) as { user_id: string; is_online: boolean; latitude: number | null; longitude: number | null; updated_at: string }[],
    ),
    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, rating_avg, rating_count, service_id')
      .eq('role', 'provider')
      .then((r) => must(r) as { id: string; full_name: string; phone: string | null; avatar_url: string | null; rating_avg: number; rating_count: number; service_id: number | null }[]),
    supabase
      .from('bookings')
      .select(
        'id, service_id, status, quote_status, address, latitude, longitude, visit_fee, created_at, customer:profiles!bookings_customer_id_fkey(full_name), provider:profiles!bookings_provider_id_fkey(full_name)',
      )
      .in('status', ['pending', 'accepted'])
      .not('latitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300)
      .then((r) => must(r) as unknown as {
        id: number; service_id: number; status: 'pending' | 'accepted'; quote_status: string; address: string; latitude: number; longitude: number
        visit_fee: number; created_at: string; customer: { full_name: string } | null; provider: { full_name: string } | null
      }[]),
  ])
  const pres = new Map(presence.map((p) => [p.user_id, p]))
  return {
    services,
    workers: workers.map<Worker>((w) => {
      const p = pres.get(w.id)
      return {
        id: w.id, name: w.full_name || 'Worker', phone: w.phone, avatar: w.avatar_url, rating: Number(w.rating_avg), ratings: w.rating_count,
        serviceId: w.service_id, online: !!p?.is_online, lat: p?.latitude ?? null, lng: p?.longitude ?? null, seen: p?.updated_at ?? null,
      }
    }),
    requests: bookings.map<Req>((b) => ({
      id: b.id, serviceId: b.service_id, status: b.status, quote: b.quote_status, address: b.address, lat: b.latitude, lng: b.longitude,
      customer: b.customer?.full_name || 'Customer', worker: b.provider?.full_name ?? null, fee: Number(b.visit_fee), created: b.created_at,
    })),
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function LiveMap() {
  const { data, loading, error, reload } = useLoad(loadLive)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const fitted = useRef(false)
  const [showWorkers, setShowWorkers] = useState(true)
  const [showOffline, setShowOffline] = useState(false)
  const [showRequests, setShowRequests] = useState(true)
  const [service, setService] = useState<number | 'all'>('all')

  // Auto-refresh every 30 s while the page is open.
  useEffect(() => {
    const t = setInterval(reload, 30_000)
    return () => clearInterval(t)
  }, [reload])

  const colorOf = useMemo(() => {
    const m = new Map<number, string>()
    data?.services.forEach((s, i) => m.set(s.id, PALETTE[i % PALETTE.length]))
    return (id: number | null) => (id != null ? (m.get(id) ?? '#64748B') : '#64748B')
  }, [data])
  const nameOf = useMemo(() => new Map(data?.services.map((s) => [s.id, s.name]) ?? []), [data])

  const workers = useMemo(
    () => (data?.workers ?? []).filter((w) => (showOffline || w.online) && (service === 'all' || w.serviceId === service)),
    [data, showOffline, service],
  )
  const requests = useMemo(() => (data?.requests ?? []).filter((r) => service === 'all' || r.serviceId === service), [data, service])
  const onlineCount = (data?.workers ?? []).filter((w) => w.online).length

  useEffect(() => {
    if (!box.current || map.current) return
    map.current = new maplibregl.Map({ container: box.current, style: STYLE, center: DEFAULT, zoom: 11, attributionControl: { compact: true } })
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.current.on('styleimagemissing', (e) => map.current?.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }))
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Draw markers whenever data or filters change.
  useEffect(() => {
    const m = map.current
    if (!m || !data) return
    markers.current.forEach((x) => x.remove())
    markers.current = []
    const pts: [number, number][] = []

    if (showWorkers) {
      for (const w of workers) {
        if (w.lat == null || w.lng == null) continue
        const el = document.createElement('div')
        el.className = 'eizi-worker'
        el.style.cssText = `width:30px;height:30px;border-radius:50%;background:${colorOf(w.serviceId)};border:3px solid ${w.online ? '#22C55E' : '#CBD5E1'};box-shadow:0 3px 8px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px Inter,sans-serif;cursor:pointer;${w.online ? '' : 'opacity:.6;'}`
        el.textContent = (w.name.trim()[0] || 'W').toUpperCase()
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
          `<div style="font:13px Inter,sans-serif"><b>${esc(w.name)}</b><br>${esc(nameOf.get(w.serviceId ?? -1) ?? 'No category')}<br>` +
            `<span style="color:${w.online ? '#15803D' : '#64748B'}">${w.online ? 'Online' : 'Offline'}</span> · seen ${esc(timeAgo(w.seen))}` +
            `${w.ratings ? `<br>★ ${w.rating.toFixed(1)} (${w.ratings})` : ''}${w.phone ? `<br>${esc(w.phone)}` : ''}</div>`,
        )
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([w.lng, w.lat]).setPopup(popup).addTo(m))
        pts.push([w.lng, w.lat])
      }
    }
    if (showRequests) {
      for (const r of requests) {
        const searching = r.status === 'pending'
        const el = document.createElement('div')
        el.style.cssText = `width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${searching ? '#F59E0B' : '#0284C7'};border:3px solid #fff;box-shadow:0 3px 8px rgba(15,23,42,.3);cursor:pointer`
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
          `<div style="font:13px Inter,sans-serif"><b>#${r.id} · ${esc(nameOf.get(r.serviceId) ?? '')}</b><br>${esc(r.customer)}` +
            `<br><span style="color:${searching ? '#B45309' : '#0369A1'}">${searching ? 'Finding a worker' : `Worker: ${esc(r.worker ?? '')}`}</span>` +
            `<br>${esc(r.address)}<br>Visit ${esc(formatPrice(r.fee))} · ${esc(timeAgo(r.created))}</div>`,
        )
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([r.lng, r.lat]).setPopup(popup).addTo(m))
        pts.push([r.lng, r.lat])
      }
    }
    if (!fitted.current && pts.length) {
      fitted.current = true
      const b = pts.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]))
      m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 })
    }
  }, [data, workers, requests, showWorkers, showRequests, colorOf, nameOf])

  function flyTo(lng: number | null, lat: number | null) {
    if (lng == null || lat == null) return
    map.current?.flyTo({ center: [lng, lat], zoom: 15 })
  }

  return (
    <>
      <PageHeader
        title="Live map"
        subtitle="Online workers and open requests in real time. Click a marker for details."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Toggle checked={showWorkers} onChange={setShowWorkers} label={`Workers (${onlineCount} online)`} />
        <Toggle checked={showOffline} onChange={setShowOffline} label="Include offline" />
        <Toggle checked={showRequests} onChange={setShowRequests} label={`Requests (${data?.requests.length ?? 0})`} />
        <select
          value={service}
          onChange={(e) => setService(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink"
          aria-label="Filter by service"
        >
          <option value="all">All services</option>
          {data?.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="relative overflow-hidden">
          <div ref={box} className="h-[60vh] min-h-[420px] w-full" />
          {!data && loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <Spinner />
            </div>
          ) : null}
          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl bg-white/95 p-2 text-[11px] font-semibold text-slate-600 shadow">
            {data?.services.map((s) => (
              <span key={s.id} className="flex items-center gap-1">
                <span className="size-2.5 rounded-full" style={{ background: colorOf(s.id) }} />
                {s.name}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-amber-500" /> Finding worker
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-sky-600" /> In progress
            </span>
          </div>
        </Card>

        <Card className="max-h-[60vh] min-h-[420px] overflow-y-auto">
          <p className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-sm font-bold text-ink">
            {showWorkers ? `${workers.length} worker${workers.length === 1 ? '' : 's'}` : ''}
            {showWorkers && showRequests ? ' · ' : ''}
            {showRequests ? `${requests.length} request${requests.length === 1 ? '' : 's'}` : ''}
          </p>
          {showRequests
            ? requests.map((r) => (
                <button
                  key={`r${r.id}`}
                  type="button"
                  onClick={() => flyTo(r.lng, r.lat)}
                  className="flex w-full cursor-pointer items-start gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <MapPin className={`mt-0.5 size-4 shrink-0 ${r.status === 'pending' ? 'text-amber-500' : 'text-sky-600'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      #{r.id} · {nameOf.get(r.serviceId)}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {r.customer} · {r.status === 'pending' ? 'finding worker' : r.worker}
                    </span>
                  </span>
                </button>
              ))
            : null}
          {showWorkers
            ? workers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => flyTo(w.lng, w.lat)}
                  disabled={w.lat == null}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-default"
                >
                  <Avatar name={w.name} src={w.avatar} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{w.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {nameOf.get(w.serviceId ?? -1) ?? 'No category'} · {w.lat == null ? 'no location yet' : `seen ${timeAgo(w.seen)}`}
                    </span>
                  </span>
                  <span className={`size-2.5 shrink-0 rounded-full ${w.online ? 'bg-emerald-500' : 'bg-slate-300'}`} title={w.online ? 'Online' : 'Offline'} />
                </button>
              ))
            : null}
          {data && !workers.length && !requests.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-slate-500">
              {showOffline ? <UserRound className="size-6" /> : <MapIcon className="size-6" />}
              Nothing to show yet. Workers appear when they go online in the app; requests appear when customers share a location.
            </div>
          ) : null}
        </Card>
      </div>
      <p className="mt-3 text-xs text-slate-400">Map: OpenFreeMap · © OpenStreetMap contributors. Free, no API key.</p>
    </>
  )
}
