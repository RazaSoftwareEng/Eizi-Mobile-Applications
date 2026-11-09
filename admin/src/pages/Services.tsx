import { Layers, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
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
import { resolveIcon, SERVICE_ICONS } from '../lib/serviceIcons'
import { supabase } from '../lib/supabase'
import type { Service } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type ServiceRow = Service & { listings: number; active: number; bookings: number; from: number | null }

async function loadServices(): Promise<ServiceRow[]> {
  const [services, listings, bookings] = await Promise.all([
    supabase.from('services').select('*').order('name').then((r) => must(r) as Service[]),
    supabase.from('provider_services').select('service_id, is_active, hourly_rate').then((r) => must(r) as { service_id: number; is_active: boolean; hourly_rate: number }[]),
    supabase.from('bookings').select('service_id').then((r) => must(r) as { service_id: number }[]),
  ])
  return services.map((s) => {
    const mine = listings.filter((l) => l.service_id === s.id)
    const active = mine.filter((l) => l.is_active)
    return {
      ...s,
      listings: mine.length,
      active: active.length,
      bookings: bookings.filter((b) => b.service_id === s.id).length,
      from: active.length ? Math.min(...active.map((l) => Number(l.hourly_rate))) : null,
    }
  })
}

export function Services() {
  const toast = useToast()
  const { data, loading, error, reload } = useLoad(loadServices)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ServiceRow | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
  }, [data, query])

  async function onDelete(s: ServiceRow) {
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) {
      toast.error(
        error.code === '23503'
          ? `“${s.name}” has bookings, so it can’t be deleted. Rename it or remove its listings instead.`
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
        subtitle="The categories customers can book in the app."
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
              <Card key={s.id} className="flex flex-col p-5 transition hover:shadow-pop">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <Icon className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{s.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{s.description || 'No description'}</p>
                  </div>
                  <div className="-mt-1 -mr-2 flex">
                    <IconButton icon={Pencil} label="Edit service" onClick={() => setEditing(s)} />
                    <IconButton icon={Trash2} label="Delete service" tone="danger" onClick={() => setDeleting(s)} />
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                  <Metric label="Providers" value={`${s.active}/${s.listings}`} />
                  <Metric label="Bookings" value={String(s.bookings)} />
                  <Metric label="From / hr" value={s.from !== null ? formatPrice(s.from) : '—'} />
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
      <ConfirmDialog
        open={!!deleting}
        title="Delete this service?"
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? onDelete(deleting) : undefined)}
        message={
          <>
            <strong className="text-ink">{deleting?.name}</strong> and its {deleting?.listings ?? 0} provider listing(s) will be removed. Services
            that already have bookings can’t be deleted.
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
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return toast.error('Please enter a service name.')
    setBusy(true)
    const payload = { name: name.trim(), description: description.trim(), icon }
    const { error } = service
      ? await supabase.from('services').update(payload).eq('id', service.id)
      : await supabase.from('services').insert(payload)
    setBusy(false)
    if (error) return toast.error(error.code === '23505' ? 'A service with this name already exists.' : error.message)
    toast.success(service ? 'Service updated' : 'Service added')
    onSaved()
  }

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
          <Button onClick={save} loading={busy}>
            {service ? 'Save changes' : 'Add service'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plumber" />
        <TextArea label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this service include?" />
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
