import { CircleCheck, Eye, EyeOff, ImagePlus, Layers, ListChecks, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useToast } from '../components/Toast'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  Spinner,
  TextArea,
  TextField,
} from '../components/ui'
import { formatPrice } from '../lib/format'
import { formatBytes, optimizeToWebp, type OptimizedImage } from '../lib/imageOptimize'
import { resolveIcon, SERVICE_ICONS } from '../lib/serviceIcons'
import { supabase } from '../lib/supabase'
import type { Service, ServiceTask } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type ServiceRow = Service & { tasks: ServiceTask[]; workers: number; bookings: number }

const BUCKET = 'service-images'

/** Object path inside our bucket for a public URL we created, or null for anything else. */
function storagePath(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

async function loadServices(): Promise<ServiceRow[]> {
  const [services, tasks, workers, bookings] = await Promise.all([
    supabase.from('services').select('*').order('is_active', { ascending: false }).order('sort').order('name').then((r) => must(r) as Service[]),
    supabase.from('service_tasks').select('*').order('sort').order('id').then((r) => must(r) as ServiceTask[]),
    supabase.from('profiles').select('service_id').eq('role', 'provider').then((r) => must(r) as { service_id: number | null }[]),
    supabase.from('bookings').select('service_id').then((r) => must(r) as { service_id: number }[]),
  ])
  return services.map((s) => ({
    ...s,
    tasks: tasks.filter((t) => t.service_id === s.id),
    workers: workers.filter((w) => w.service_id === s.id).length,
    bookings: bookings.filter((b) => b.service_id === s.id).length,
  }))
}

export function Services() {
  const toast = useToast()
  const { data, loading, error, reload } = useLoad(loadServices)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ServiceRow | null>(null)
  const [tasksFor, setTasksFor] = useState<ServiceRow | null>(null)

  async function toggleActive(s: ServiceRow) {
    const { error } = await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) return toast.error(error.message)
    toast.success(s.is_active ? `${s.name} is hidden from the app` : `${s.name} is live`)
    reload()
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
  }, [data, query])

  async function onDelete(s: ServiceRow) {
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) {
      toast.error(
        error.code === '23503'
          ? `“${s.name}” has bookings, so it can’t be deleted. Hide it instead.`
          : error.message,
      )
      return
    }
    toast.success(`“${s.name}” deleted`)
    setDeleting(null)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="Categories, their sub-services and the base visiting fee customers see before requesting."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Add service
            </Button>
          </>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <div className="mb-4 flex justify-end">
        <SearchInput value={query} onChange={setQuery} placeholder="Search services…" />
      </div>

      {!data && loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title="No services" text={query ? 'Try a different search.' : 'Add your first service category.'} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => {
            const { Icon } = resolveIcon(s)
            return (
              <Card key={s.id} className={`flex flex-col overflow-hidden transition hover:shadow-pop ${s.is_active ? '' : 'opacity-60'}`}>
                {s.image_url ? (
                  <img src={s.image_url} alt="" className="h-32 w-full bg-brand-50/60 object-contain p-2" loading="lazy" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <ImagePlus className="size-5" />
                    <span className="text-xs font-semibold">No illustration yet — add one</span>
                  </button>
                )}
                <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <Icon className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">
                      {s.name}
                      {!s.is_active ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Hidden</span> : null}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{s.description || 'No description'}</p>
                  </div>
                  <div className="-mt-1 -mr-2 flex">
                    <IconButton icon={s.is_active ? EyeOff : Eye} label={s.is_active ? 'Hide from app' : 'Show in app'} onClick={() => toggleActive(s)} />
                    <IconButton icon={Pencil} label="Edit service" onClick={() => setEditing(s)} />
                    <IconButton icon={Trash2} label="Delete service" tone="danger" onClick={() => setDeleting(s)} />
                  </div>
                </div>
                <button type="button" onClick={() => setTasksFor(s)} className="-mt-1 flex cursor-pointer flex-wrap gap-1.5 text-left" title="Manage sub-services">
                  {s.tasks.length ? (
                    s.tasks.slice(0, 5).map((t) => (
                      <span key={t.id} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.is_active ? 'bg-brand-50 text-brand-800' : 'bg-slate-100 text-slate-400 line-through'}`}>
                        {t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">No sub-services yet, customers cannot request this</span>
                  )}
                  {s.tasks.length > 5 ? <span className="text-[11px] font-semibold text-slate-500">+{s.tasks.length - 5} more</span> : null}
                </button>
                <div className="mt-auto grid grid-cols-4 gap-2 border-t border-slate-100 pt-4 text-center">
                  <Metric label="Visit fee" value={formatPrice(s.visit_fee)} />
                  <Metric label="Sub-services" value={String(s.tasks.length)} />
                  <Metric label="Workers" value={String(s.workers)} />
                  <Metric label="Bookings" value={String(s.bookings)} />
                </div>
                <Button variant="secondary" icon={ListChecks} onClick={() => setTasksFor(s)}>
                  Manage sub-services
                </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing ? (
        <ServiceForm
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      {tasksFor ? (
        <TasksManager
          service={tasksFor}
          onClose={() => {
            setTasksFor(null)
            reload()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this service?"
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? onDelete(deleting) : undefined)}
        message={
          <>
            <strong className="text-ink">{deleting?.name}</strong> and its {deleting?.tasks.length ?? 0} sub-service(s) will be removed. Services
            that already have bookings can’t be deleted, hide them instead.
          </>
        }
      />
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  )
}

function ServiceForm({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(service?.name ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [icon, setIcon] = useState(service ? resolveIcon(service).value : 'toolbox-outline')
  const [fee, setFee] = useState(String(Math.round(Number(service?.visit_fee ?? 300))))
  const [sort, setSort] = useState(String(service?.sort ?? 100))
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null)
  const [optimized, setOptimized] = useState<OptimizedImage | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pickFile(f: File | null) {
    if (!f) return
    setOptimizing(true)
    try {
      // Any format in → small WebP out (resized to max 640px, compressed to ~150 KB).
      const out = await optimizeToWebp(f)
      if (preview) URL.revokeObjectURL(preview)
      setOptimized(out)
      setPreview(URL.createObjectURL(out.blob))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOptimizing(false)
    }
  }

  function removePhoto() {
    if (preview) URL.revokeObjectURL(preview)
    setOptimized(null)
    setPreview(null)
    setImageUrl(null)
  }

  async function save() {
    if (!name.trim()) return toast.error('Please enter a service name.')
    const visit_fee = Number(fee)
    if (!(visit_fee >= 0) || visit_fee > 100000) return toast.error('Enter a valid visiting fee.')
    setBusy(true)
    try {
      let image_url = imageUrl
      if (optimized) {
        const path = `${crypto.randomUUID()}.webp`
        const up = await supabase.storage
          .from(BUCKET)
          .upload(path, optimized.blob, { contentType: 'image/webp', cacheControl: '31536000' })
        if (up.error) {
          throw up.error.message.toLowerCase().includes('bucket not found')
            ? new Error('Image storage is not set up yet — run the latest supabase/schema.sql in the Supabase SQL Editor, then try again.')
            : up.error
        }
        image_url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      }
      const payload = { name: name.trim(), description: description.trim(), icon, image_url, visit_fee, sort: Number(sort) || 100 }
      const { error } = service
        ? await supabase.from('services').update(payload).eq('id', service.id)
        : await supabase.from('services').insert(payload)
      if (error) throw error
      // Clean up the old photo file if it was replaced or removed (best effort).
      const old = storagePath(service?.image_url)
      if (old && service?.image_url !== image_url) await supabase.storage.from(BUCKET).remove([old])
      toast.success(service ? 'Service updated' : 'Service added')
      onSaved()
    } catch (e) {
      const err = e as { code?: string; message?: string }
      toast.error(err.code === '23505' ? 'A service with this name already exists.' : (err.message ?? 'Could not save'))
    } finally {
      setBusy(false)
    }
  }

  const shown = preview ?? imageUrl

  return (
    <Modal
      open
      title={service ? 'Edit service' : 'Add service'}
      subtitle="Shown to customers on the app’s home screen."
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={optimizing}>
            {service ? 'Save changes' : 'Add service'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plumber" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Base visiting fee (Rs)" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
          <TextField label="Order on home screen" type="number" min={1} value={sort} onChange={(e) => setSort(e.target.value)} />
        </div>
        <TextArea label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this service include?" />

        <div>
          <p className="mb-2 text-[13px] font-semibold text-slate-700">Illustration</p>
          {optimizing ? (
            <div className="flex h-44 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600">
              <Loader2 className="size-4 animate-spin text-brand-600" /> Optimizing image…
            </div>
          ) : shown ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200">
              <img src={shown} alt="" className="h-44 w-full bg-brand-50 object-contain p-3" />
              <div className="absolute right-2 bottom-2 flex gap-2">
                <label className="cursor-pointer rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-ink shadow hover:bg-white">
                  Change
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
                </label>
                <button type="button" onClick={removePhoto} className="cursor-pointer rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 shadow hover:bg-white">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label
              className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                pickFile(e.dataTransfer.files?.[0] ?? null)
              }}
            >
              <ImagePlus className="size-6 text-brand-600" />
              <span className="text-sm font-semibold text-ink">Upload an illustration</span>
              <span className="text-xs text-slate-500">Click or drag & drop · any image (JPG, PNG, WebP, GIF…) · transparent PNG looks best · auto-converted to a small WebP</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
          {optimized ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CircleCheck className="size-3.5" />
              Optimized: {formatBytes(optimized.originalBytes)} → {formatBytes(optimized.bytes)} WebP · {optimized.width}×{optimized.height}px
              {optimized.originalBytes > optimized.bytes ? ` (${Math.round((1 - optimized.bytes / optimized.originalBytes) * 100)}% smaller)` : ''}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs text-slate-500">Shown on the service cards in the app and on the service page, on a soft coloured background. Without one, the app shows the service icon.</p>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-slate-700">Icon</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {SERVICE_ICONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={icon === value}
                onClick={() => setIcon(value)}
                className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 transition ${
                  icon === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-transparent bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="size-5" />
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Selected: {SERVICE_ICONS.find((i) => i.value === icon)?.label}</p>
        </div>
      </div>
    </Modal>
  )
}

/** Add, rename, price, reorder, hide or delete the sub-services of one category. */
function TasksManager({ service, onClose }: { service: ServiceRow; onClose: () => void }) {
  const toast = useToast()
  const [tasks, setTasks] = useState<ServiceTask[]>(service.tasks)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data } = await supabase.from('service_tasks').select('*').eq('service_id', service.id).order('sort').order('id')
    setTasks((data as ServiceTask[]) ?? [])
  }

  async function add() {
    if (name.trim().length < 2) return toast.error('Enter a sub-service name.')
    setBusy(true)
    const { error } = await supabase.from('service_tasks').insert({
      service_id: service.id,
      name: name.trim(),
      base_price: price ? Number(price) : null,
      sort: (tasks.at(-1)?.sort ?? 0) + 1,
    })
    setBusy(false)
    if (error) return toast.error(error.code === '23505' ? 'This sub-service already exists.' : error.message)
    setName('')
    setPrice('')
    refresh()
  }

  async function update(t: ServiceTask, patch: Partial<ServiceTask>) {
    const { error } = await supabase.from('service_tasks').update(patch).eq('id', t.id)
    if (error) return toast.error(error.code === '23505' ? 'This name is already used.' : error.message)
    refresh()
  }

  async function remove(t: ServiceTask) {
    const { error } = await supabase.from('service_tasks').delete().eq('id', t.id)
    if (error) return toast.error(error.message)
    refresh()
  }

  async function move(i: number, dir: -1 | 1) {
    const a = tasks[i]
    const b = tasks[i + dir]
    if (!a || !b) return
    await supabase.from('service_tasks').update({ sort: b.sort === a.sort ? a.sort + dir : b.sort }).eq('id', a.id)
    await supabase.from('service_tasks').update({ sort: a.sort }).eq('id', b.id)
    refresh()
  }

  return (
    <Modal
      open
      title={`${service.name}: sub-services`}
      subtitle="Customers tick these when requesting. Old bookings keep the names they had."
      onClose={onClose}
      width="max-w-2xl"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No sub-services yet. Add at least one so customers can request this category.</p>
        ) : null}
        {tasks.map((t, i) => (
          <TaskRow key={`${t.id}-${t.name}-${t.base_price}`} t={t} first={i === 0} last={i === tasks.length - 1} onUpdate={(p) => update(t, p)} onDelete={() => remove(t)} onMove={(d) => move(i, d)} />
        ))}
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl border border-dashed border-slate-300 p-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <TextField label="New sub-service" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Geyser Repair" />
        <TextField label="From price (optional)" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Rs" />
        <Button icon={Plus} onClick={add} loading={busy}>
          Add
        </Button>
      </div>
    </Modal>
  )
}

function TaskRow({ t, first, last, onUpdate, onDelete, onMove }: {
  t: ServiceTask
  first: boolean
  last: boolean
  onUpdate: (p: Partial<ServiceTask>) => void
  onDelete: () => void
  onMove: (d: -1 | 1) => void
}) {
  const [name, setName] = useState(t.name)
  const [price, setPrice] = useState(t.base_price != null ? String(Math.round(Number(t.base_price))) : '')
  const changed = name.trim() !== t.name || (price ? Number(price) : null) !== (t.base_price != null ? Number(t.base_price) : null)
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2 ${t.is_active ? '' : 'bg-slate-50 opacity-70'}`}>
      <div className="flex flex-col">
        <button type="button" disabled={first} onClick={() => onMove(-1)} className="cursor-pointer px-1 text-xs text-slate-400 hover:text-ink disabled:opacity-30" aria-label="Move up">
          ▲
        </button>
        <button type="button" disabled={last} onClick={() => onMove(1)} className="cursor-pointer px-1 text-xs text-slate-400 hover:text-ink disabled:opacity-30" aria-label="Move down">
          ▼
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-40 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-500"
        aria-label="Sub-service name"
      />
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
        placeholder="From Rs"
        className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-500"
        aria-label="From price"
      />
      {changed ? <Button onClick={() => onUpdate({ name: name.trim(), base_price: price ? Number(price) : null })}>Save</Button> : null}
      <IconButton icon={t.is_active ? EyeOff : Eye} label={t.is_active ? 'Hide' : 'Show'} onClick={() => onUpdate({ is_active: !t.is_active })} />
      <IconButton icon={Trash2} label="Delete" tone="danger" onClick={onDelete} />
    </div>
  )
}
