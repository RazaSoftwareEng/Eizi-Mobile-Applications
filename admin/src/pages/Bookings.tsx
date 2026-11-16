import { CalendarCheck, MapPin, Pencil, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'
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
  SelectField,
  Spinner,
  StatusBadge,
  Table,
  Tabs,
  Td,
  TextArea,
  TextField,
  Th,
} from '../components/ui'
import { formatDateTime, formatPrice, startOfToday, toLocalInput } from '../lib/format'
import { supabase } from '../lib/supabase'
import { BOOKING_STATUSES, STATUS_LABEL, type Booking, type BookingStatus, type Profile, type Service, type ServiceTask } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type StatusFilter = 'all' | 'pending' | 'accepted' | 'completed' | 'closed'
type When = 'any' | 'today' | 'upcoming' | 'past'

const JOIN =
  '*, customer:profiles!bookings_customer_id_fkey(full_name, phone), provider:profiles!bookings_provider_id_fkey(full_name, phone), service:services(name)'

const loadBookings = () =>
  supabase
    .from('bookings')
    .select(JOIN)
    .order('scheduled_at', { ascending: false })
    .then((r) => must(r) as unknown as Booking[])

export function Bookings() {
  const toast = useToast()
  const { data, loading, error, reload, setData } = useLoad(loadBookings)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [when, setWhen] = useState<When>('any')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Booking | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Booking | null>(null)
  // Fixed at page load so filtering stays stable while the page is open; Refresh re-fetches data.
  const [now] = useState(() => new Date())

  const bookings = useMemo(() => data ?? [], [data])
  const count = (f: (b: Booking) => boolean) => bookings.filter(f).length
  const matchStatus = (b: Booking, f: StatusFilter) =>
    f === 'all' ? true : f === 'closed' ? b.status === 'cancelled' || b.status === 'rejected' : b.status === f

  const visible = useMemo(() => {
    const today = startOfToday()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const q = query.trim().toLowerCase()
    return bookings.filter((b) => {
      if (!matchStatus(b, status)) return false
      const t = new Date(b.scheduled_at)
      if (when === 'today' && !(t >= today && t < tomorrow)) return false
      if (when === 'upcoming' && t < now) return false
      if (when === 'past' && t >= now) return false
      return (
        !q ||
        String(b.id) === q.replace('#', '') ||
        [b.customer?.full_name, b.provider?.full_name, b.service?.name, b.address, ...(b.tasks ?? []).map((t) => t.name)].some((v) => v?.toLowerCase().includes(q))
      )
    })
  }, [bookings, status, when, query, now])

  async function changeStatus(b: Booking, next: BookingStatus) {
    setData((d) => d?.map((x) => (x.id === b.id ? { ...x, status: next } : x)) ?? d)
    const { error } = await supabase.from('bookings').update({ status: next }).eq('id', b.id)
    if (error) {
      toast.error(error.message)
      reload()
    } else toast.success(`Booking #${b.id} marked ${STATUS_LABEL[next].toLowerCase()}`)
  }

  async function onDelete(b: Booking) {
    const { error } = await supabase.from('bookings').delete().eq('id', b.id)
    if (error) return toast.error(error.message)
    toast.success(`Booking #${b.id} deleted`)
    setDeleting(null)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Every booking made in the app. Change status, fix details or remove test bookings."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
              Refresh
            </Button>
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New booking
            </Button>
          </>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <Tabs<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All', count: bookings.length },
                { value: 'pending', label: 'Finding worker', count: count((b) => b.status === 'pending') },
                { value: 'accepted', label: 'In progress', count: count((b) => b.status === 'accepted') },
                { value: 'completed', label: 'Completed', count: count((b) => b.status === 'completed') },
                { value: 'closed', label: 'Closed', count: count((b) => matchStatus(b, 'closed')) },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-44">
              <SelectField value={when} onChange={(e) => setWhen(e.target.value as When)} aria-label="Filter by date">
                <option value="any">Any date</option>
                <option value="today">Scheduled today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </SelectField>
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Search #id, name, service, address…" />
          </div>
        </div>

        {!data && loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="No bookings found" text="Try another filter or search." />
        ) : (
          <Table
            head={
              <tr>
                <Th>Booking</Th>
                <Th>Customer → Worker</Th>
                <Th>Scheduled</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {visible.map((b) => (
              <tr key={b.id} className="align-top transition hover:bg-slate-50/70">
                <Td>
                  <p className="font-semibold text-ink">{b.service?.name}</p>
                  <p className="font-mono text-xs text-slate-400">#{b.id}</p>
                  <p className="mt-1 line-clamp-2 max-w-60 text-xs text-slate-500" title={(b.tasks ?? []).map((t) => t.name).join(', ')}>
                    {(b.tasks ?? []).map((t) => t.name).join(', ')}
                  </p>
                </Td>
                <Td>
                  <p className="font-medium text-ink">{b.customer?.full_name || '—'}</p>
                  <p className="text-xs text-slate-500">→ {b.provider?.full_name || (b.status === 'pending' ? 'searching…' : '—')}</p>
                  <p className="mt-1 line-clamp-1 max-w-56 text-xs text-slate-400" title={b.address}>
                    {b.address}
                  </p>
                  {b.latitude != null && b.longitude != null ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <MapPin className="size-3" aria-hidden />
                      Map
                    </a>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap">
                  <p className="text-ink">{formatDateTime(b.scheduled_at)}</p>
                  {b.rating ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700" title={b.review || undefined}>
                      <Star className="size-3 fill-current" aria-hidden /> {b.rating}/5
                    </p>
                  ) : null}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <p className="font-semibold text-ink tabular-nums">{formatPrice(b.total_price)}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {b.quote_status === 'approved' || b.status === 'completed'
                      ? 'agreed price'
                      : b.quote_status === 'sent'
                        ? `quote ${formatPrice(b.quote_amount ?? 0)} waiting`
                        : b.quote_status === 'declined'
                          ? `quote ${formatPrice(b.quote_amount ?? 0)} declined`
                          : 'visiting fee'}
                  </p>
                  {b.payment_method === 'wallet' ? (
                    <span className="mt-1 inline-flex rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      Wallet · {b.payment_status === 'held' ? 'held' : b.payment_status === 'released' ? 'paid out' : b.payment_status === 'refunded' ? 'refunded' : b.payment_status}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1.5">
                    <StatusBadge status={b.status} />
                    <select
                      value={b.status}
                      onChange={(e) => changeStatus(b, e.target.value as BookingStatus)}
                      aria-label={`Change status of booking ${b.id}`}
                      className="cursor-pointer rounded-md border-0 bg-transparent py-0 pr-6 pl-0 text-xs font-medium text-brand-700 focus:ring-0"
                    >
                      {BOOKING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          Set: {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton icon={Pencil} label="Edit booking" onClick={() => setEditing(b)} />
                  <IconButton icon={Trash2} label="Delete booking" tone="danger" onClick={() => setDeleting(b)} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {data ? (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Showing {visible.length} of {bookings.length} bookings · total value {formatPrice(visible.reduce((s, b) => s + Number(b.total_price), 0))}
          </p>
        ) : null}
      </Card>

      {editing ? (
        <EditBooking
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      {creating ? (
        <CreateBooking
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete booking #${deleting?.id}?`}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? onDelete(deleting) : undefined)}
        message="The booking disappears for both the customer and the worker. To keep a record, set its status to Cancelled instead."
      />
    </>
  )
}

function EditBooking({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<BookingStatus>(booking.status)
  const [when, setWhen] = useState(toLocalInput(booking.scheduled_at))
  const [price, setPrice] = useState(String(Math.round(Number(booking.total_price))))
  const [address, setAddress] = useState(booking.address)
  const [notes, setNotes] = useState(booking.notes)
  const [busy, setBusy] = useState(false)
  const held = booking.payment_status === 'held'

  async function save() {
    const total = Number(price)
    if (!(total >= 0)) return toast.error('Enter a valid price.')
    if (!address.trim()) return toast.error('Address is required.')
    setBusy(true)
    const { error } = await supabase
      .from('bookings')
      .update({
        status,
        scheduled_at: new Date(when).toISOString(),
        ...(held ? {} : { total_price: total }),
        address: address.trim(),
        notes: notes.trim(),
      })
      .eq('id', booking.id)
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success(`Booking #${booking.id} updated`)
    onSaved()
  }

  return (
    <Modal
      open
      title={`Edit booking #${booking.id}`}
      subtitle={`${booking.service?.name} · ${booking.customer?.full_name} → ${booking.provider?.full_name ?? 'no worker yet'}`}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <TextField label="Date & time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <TextField
          label={held ? 'Price (locked: paid from wallet)' : 'Price (Rs)'}
          type="number"
          min={0}
          value={price}
          disabled={held}
          onChange={(e) => setPrice(e.target.value)}
        />
        <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          Visiting fee {formatPrice(booking.visit_fee)}
          {booking.quote_amount != null ? ` · quote ${formatPrice(booking.quote_amount)} (${booking.quote_status})` : ''}
        </div>
        <div className="sm:col-span-2">
          <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

function CreateBooking({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const { data, loading } = useLoad(async () => {
    const [customers, services, tasks] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, role, created_at').eq('role', 'customer').order('full_name').then((r) => must(r) as Profile[]),
      supabase.from('services').select('*').eq('is_active', true).order('sort').then((r) => must(r) as Service[]),
      supabase.from('service_tasks').select('*').eq('is_active', true).order('sort').then((r) => must(r) as ServiceTask[]),
    ])
    return { customers, services, tasks }
  })

  const [customerId, setCustomerId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [when, setWhen] = useState(() => toLocalInput(new Date().toISOString()))
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const service = data?.services.find((s) => String(s.id) === serviceId)
  const tasks = data?.tasks.filter((t) => String(t.service_id) === serviceId) ?? []

  async function create() {
    if (!customerId || !serviceId) return toast.error('Choose a customer and a service.')
    if (!picked.length) return toast.error('Tick at least one sub-service.')
    if (address.trim().length < 3) return toast.error('Address is required.')
    setBusy(true)
    // Fee and task names are filled in by the database; nearby online workers are notified.
    const { error } = await supabase.from('bookings').insert({
      customer_id: customerId,
      service_id: Number(serviceId),
      task_ids: picked,
      scheduled_at: new Date(when).toISOString(),
      address: address.trim(),
      notes: notes.trim(),
    })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Request created and sent to workers')
    onCreated()
  }

  return (
    <Modal
      open
      title="New request"
      subtitle="Create a request for a customer (e.g. a phone order). It goes to online workers like any app request."
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} loading={busy} disabled={!data}>
            Create request
          </Button>
        </>
      }
    >
      {!data && loading ? (
        <Spinner className="py-8" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {data?.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || 'No name'}
                  {c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="sm:col-span-2">
            <SelectField
              label="Service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value)
                setPicked([])
              }}
            >
              <option value="">Select a service…</option>
              {data?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (visit {formatPrice(s.visit_fee)})
                </option>
              ))}
            </SelectField>
          </div>
          {tasks.length ? (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {tasks.map((t) => {
                const on = picked.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                    className={`cursor-pointer rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    {on ? '✓ ' : ''}
                    {t.name}
                  </button>
                )
              })}
            </div>
          ) : null}
          <TextField label="When" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-medium text-brand-800">Visiting fee</span>
            <span className="text-lg font-bold text-brand-700 tabular-nums">{service ? formatPrice(service.visit_fee) : '—'}</span>
          </div>
          <div className="sm:col-span-2">
            <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House #, street, area, city" />
          </div>
          <div className="sm:col-span-2">
            <TextArea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  )
}
