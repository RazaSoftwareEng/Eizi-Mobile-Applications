import { BriefcaseBusiness, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useToast } from '../components/Toast'
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  SelectField,
  Spinner,
  Table,
  Tabs,
  Td,
  TextArea,
  TextField,
  Th,
  Toggle,
} from '../components/ui'
import { formatDate, formatPrice } from '../lib/format'
import { resolveIcon } from '../lib/serviceIcons'
import { supabase } from '../lib/supabase'
import type { Listing, Profile, Service } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type Filter = 'all' | 'active' | 'paused'

async function loadListings() {
  const [listings, services, providers] = await Promise.all([
    supabase
      .from('provider_services')
      .select('*, provider:profiles(id, full_name), service:services(id, name)')
      .order('created_at', { ascending: false })
      .then((r) => must(r) as unknown as Listing[]),
    supabase.from('services').select('*').order('name').then((r) => must(r) as Service[]),
    supabase.from('profiles').select('id, full_name, phone, role, created_at').eq('role', 'provider').order('full_name').then((r) => must(r) as Profile[]),
  ])
  return { listings, services, providers }
}

export function Listings() {
  const toast = useToast()
  const { data, loading, error, reload, setData } = useLoad(loadListings)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [editing, setEditing] = useState<Listing | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Listing | null>(null)

  const listings = useMemo(() => data?.listings ?? [], [data])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listings.filter((l) => {
      if (filter === 'active' && !l.is_active) return false
      if (filter === 'paused' && l.is_active) return false
      if (serviceId && String(l.service_id) !== serviceId) return false
      return !q || [l.provider?.full_name, l.service?.name, l.description].some((v) => v?.toLowerCase().includes(q))
    })
  }, [listings, filter, query, serviceId])

  async function toggle(l: Listing, value: boolean) {
    setData((d) => (d ? { ...d, listings: d.listings.map((x) => (x.id === l.id ? { ...x, is_active: value } : x)) } : d))
    const { error } = await supabase.from('provider_services').update({ is_active: value }).eq('id', l.id)
    if (error) {
      toast.error(error.message)
      reload()
    } else toast.success(`${l.provider?.full_name}’s ${l.service?.name} is now ${value ? 'live' : 'paused'}`)
  }

  async function onDelete(l: Listing) {
    const { error } = await supabase.from('provider_services').delete().eq('id', l.id)
    if (error) return toast.error(error.message)
    toast.success('Listing deleted')
    setDeleting(null)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Provider listings"
        subtitle="Which provider offers which service, and at what hourly rate."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setEditing('new')} disabled={!data}>
              Add listing
            </Button>
          </>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: listings.length },
              { value: 'active', label: 'Live', count: listings.filter((l) => l.is_active).length },
              { value: 'paused', label: 'Paused', count: listings.filter((l) => !l.is_active).length },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-48">
              <SelectField value={serviceId} onChange={(e) => setServiceId(e.target.value)} aria-label="Filter by service">
                <option value="">All services</option>
                {data?.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Search provider or service…" />
          </div>
        </div>

        {!data && loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No listings found" text="Providers add listings from the app, or you can add one here." />
        ) : (
          <Table
            head={
              <tr>
                <Th>Provider</Th>
                <Th>Service</Th>
                <Th className="text-right">Rate / hour</Th>
                <Th className="hidden lg:table-cell">Added</Th>
                <Th>Live</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {visible.map((l) => {
              const svc = data?.services.find((s) => s.id === l.service_id)
              const Icon = svc ? resolveIcon(svc).Icon : BriefcaseBusiness
              return (
                <tr key={l.id} className={`transition hover:bg-slate-50/70 ${l.is_active ? '' : 'text-slate-400'}`}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={l.provider?.full_name} />
                      <span className="font-semibold text-ink">{l.provider?.full_name || 'Unnamed'}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-brand-600" />
                      <div>
                        <p className="font-medium text-ink">{l.service?.name}</p>
                        {l.description ? <p className="line-clamp-1 max-w-xs text-xs text-slate-500">{l.description}</p> : null}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-right font-semibold whitespace-nowrap text-ink tabular-nums">{formatPrice(l.hourly_rate)}</Td>
                  <Td className="hidden whitespace-nowrap text-slate-500 lg:table-cell">{formatDate(l.created_at)}</Td>
                  <Td>
                    <Toggle checked={l.is_active} onChange={(v) => toggle(l, v)} label="Visible to customers" />
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <IconButton icon={Pencil} label="Edit listing" onClick={() => setEditing(l)} />
                    <IconButton icon={Trash2} label="Delete listing" tone="danger" onClick={() => setDeleting(l)} />
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>

      {editing && data ? (
        <ListingForm
          listing={editing === 'new' ? null : editing}
          services={data.services}
          providers={data.providers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this listing?"
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? onDelete(deleting) : undefined)}
        message={
          <>
            <strong className="text-ink">{deleting?.provider?.full_name}</strong> will stop offering <strong className="text-ink">{deleting?.service?.name}</strong>.
            Bookings made through this listing will also be deleted. To hide it temporarily, switch it off instead.
          </>
        }
      />
    </>
  )
}

function ListingForm({ listing, services, providers, onClose, onSaved }: {
  listing: Listing | null
  services: Service[]
  providers: Profile[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [providerId, setProviderId] = useState(listing?.provider_id ?? '')
  const [serviceId, setServiceId] = useState(listing ? String(listing.service_id) : '')
  const [rate, setRate] = useState(listing ? String(Number(listing.hourly_rate)) : '')
  const [description, setDescription] = useState(listing?.description ?? '')
  const [active, setActive] = useState(listing?.is_active ?? true)
  const [busy, setBusy] = useState(false)

  async function save() {
    const value = Number(rate)
    if (!providerId || !serviceId) return toast.error('Choose a provider and a service.')
    if (!(value > 0)) return toast.error('Enter a valid hourly rate.')
    setBusy(true)
    const payload = { provider_id: providerId, service_id: Number(serviceId), hourly_rate: value, description: description.trim(), is_active: active }
    const { error } = listing
      ? await supabase.from('provider_services').update(payload).eq('id', listing.id)
      : await supabase.from('provider_services').insert(payload)
    setBusy(false)
    if (error) return toast.error(error.code === '23505' ? 'This provider already offers that service.' : error.message)
    toast.success(listing ? 'Listing updated' : 'Listing added')
    onSaved()
  }

  return (
    <Modal
      open
      title={listing ? 'Edit listing' : 'Add listing'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {listing ? 'Save changes' : 'Add listing'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Provider" value={providerId} onChange={(e) => setProviderId(e.target.value)} disabled={!!listing}>
          <option value="">Select a provider…</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.id}
            </option>
          ))}
        </SelectField>
        {providers.length === 0 ? <p className="-mt-2 text-xs text-amber-700">No users have the provider role yet — change a user’s role on the Users page.</p> : null}
        <SelectField label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!!listing}>
          <option value="">Select a service…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Hourly rate (Rs)" type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="500" />
        <TextArea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Visible to customers</span>
          <Toggle checked={active} onChange={setActive} label="Visible to customers" />
        </label>
      </div>
    </Modal>
  )
}
