import { Pencil, RefreshCw, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAuth } from '../auth/AuthProvider'
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
  NewBadge,
  PageHeader,
  RoleBadge,
  SearchInput,
  SelectField,
  Spinner,
  Table,
  Tabs,
  Td,
  TextArea,
  TextField,
  Th,
} from '../components/ui'
import { errorMessage, formatDate, isToday, timeAgo } from '../lib/format'
import { formatBytes, optimizeToWebp, type OptimizedImage } from '../lib/imageOptimize'
import { signupClient, supabase } from '../lib/supabase'
import type { Account, Profile, Role, UserRow } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type Filter = 'all' | 'today' | 'customer' | 'provider' | 'none'

async function loadUsers(): Promise<UserRow[]> {
  const [profiles, accounts, kyc, presence, services] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at, avatar_url, bio, city, service_id, rating_avg, rating_count')
      .order('created_at', { ascending: false })
      .then((r) => must(r) as Profile[]),
    supabase.rpc('admin_list_accounts').then((r) => must(r) as Account[]),
    supabase.from('provider_kyc').select('user_id, cnic').then((r) => must(r) as { user_id: string; cnic: string }[]),
    supabase.from('provider_presence').select('user_id, is_online').then((r) => must(r) as { user_id: string; is_online: boolean }[]),
    supabase.from('services').select('id, name').then((r) => must(r) as { id: number; name: string }[]),
  ])
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const cnic = new Map(kyc.map((k) => [k.user_id, k.cnic]))
  const online = new Map(presence.map((x) => [x.user_id, x.is_online]))
  const svc = new Map(services.map((x) => [x.id, x.name]))
  return profiles.map((p) => {
    const a = byId.get(p.id)
    return {
      ...p,
      email: a?.email ?? null,
      last_sign_in_at: a?.last_sign_in_at ?? null,
      email_confirmed_at: a?.email_confirmed_at ?? null,
      cnic: cnic.get(p.id) ?? null,
      online: online.get(p.id) ?? false,
      service_name: p.service_id ? (svc.get(p.service_id) ?? null) : null,
    }
  })
}

export function Users() {
  const toast = useToast()
  const { session } = useAuth()
  const { data, loading, error, reload } = useLoad(loadUsers)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<UserRow | null>(null)

  const users = useMemo(() => data ?? [], [data])
  const counts = useMemo(
    () => ({
      all: users.length,
      today: users.filter((u) => isToday(u.created_at)).length,
      customer: users.filter((u) => u.role === 'customer').length,
      provider: users.filter((u) => u.role === 'provider').length,
      none: users.filter((u) => !u.role).length,
    }),
    [users],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'today' && !isToday(u.created_at)) return false
      if (filter === 'customer' && u.role !== 'customer') return false
      if (filter === 'provider' && u.role !== 'provider') return false
      if (filter === 'none' && u.role) return false
      if (!q) return true
      return [u.full_name, u.email, u.phone].some((v) => v?.toLowerCase().includes(q))
    })
  }, [users, filter, query])

  async function onDelete(u: UserRow) {
    const { error } = await supabase.rpc('admin_delete_user', { target: u.id })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`${u.full_name || u.email} was deleted`)
    setDeleting(null)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone who has signed up — customers and service providers."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
              Refresh
            </Button>
            <Button icon={UserPlus} onClick={() => setCreating(true)}>
              Add user
            </Button>
          </>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'today', label: 'New today', count: counts.today },
                { value: 'customer', label: 'Customers', count: counts.customer },
                { value: 'provider', label: 'Providers', count: counts.provider },
                { value: 'none', label: 'No role', count: counts.none },
              ]}
            />
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search name, email or phone…" />
        </div>

        {!data && loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found" text={query ? 'Try a different search.' : 'Nobody matches this filter yet.'} />
        ) : (
          <Table
            head={
              <tr>
                <Th>User</Th>
                <Th className="hidden md:table-cell">Contact</Th>
                <Th className="hidden lg:table-cell">Work / city</Th>
                <Th>Role</Th>
                <Th className="hidden lg:table-cell">Joined</Th>
                <Th className="hidden xl:table-cell">Last sign-in</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            }
          >
            {visible.map((u) => (
              <tr key={u.id} className="transition hover:bg-slate-50/70">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.full_name || u.email} src={u.avatar_url} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        <span className="truncate">{u.full_name || 'No name'}</span>
                        {isToday(u.created_at) ? <NewBadge /> : null}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {u.email ?? '—'}
                        {u.email && !u.email_confirmed_at ? <span className="ml-1.5 text-amber-600">(unconfirmed)</span> : null}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td className="hidden whitespace-nowrap text-slate-600 md:table-cell">
                  <p>{u.phone || '—'}</p>
                  {u.cnic ? <p className="font-mono text-xs text-slate-400">CNIC {u.cnic.slice(0, 5)}-{u.cnic.slice(5, 12)}-{u.cnic.slice(12)}</p> : null}
                </Td>
                <Td className="hidden text-slate-600 lg:table-cell">
                  {u.role === 'provider' ? (
                    <>
                      <p className="font-medium text-ink">{u.service_name || 'No category'}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`inline-flex items-center gap-1 ${u.online ? 'text-emerald-700' : ''}`}>
                          <span className={`size-1.5 rounded-full ${u.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {u.online ? 'Online' : 'Offline'}
                        </span>
                        {u.rating_count ? <span>★ {Number(u.rating_avg).toFixed(1)} ({u.rating_count})</span> : null}
                      </p>
                    </>
                  ) : (
                    <p>{u.city || '—'}</p>
                  )}
                </Td>
                <Td>
                  <RoleBadge role={u.role} />
                </Td>
                <Td className="hidden whitespace-nowrap text-slate-600 lg:table-cell">{formatDate(u.created_at)}</Td>
                <Td className="hidden whitespace-nowrap text-slate-500 xl:table-cell">{timeAgo(u.last_sign_in_at)}</Td>
                <Td className="text-right whitespace-nowrap">
                  <IconButton icon={Pencil} label="Edit user" onClick={() => setEditing(u)} />
                  {u.id !== session?.user.id ? (
                    <IconButton icon={Trash2} label="Delete user" tone="danger" onClick={() => setDeleting(u)} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {data ? (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Showing {visible.length} of {users.length} users
          </p>
        ) : null}
      </Card>

      {editing ? (
        <EditUser
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      {creating ? (
        <CreateUser
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        title="Delete this user?"
        confirmLabel="Delete user"
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? onDelete(deleting) : undefined)}
        message={
          <>
            <strong className="text-ink">{deleting?.full_name || deleting?.email}</strong> will be permanently removed, along with their login,
            service listings and all of their bookings. This cannot be undone.
          </>
        }
      />
    </>
  )
}

function RoleSelect({ value, onChange }: { value: Role | ''; onChange: (v: Role | '') => void }) {
  return (
    <SelectField label="Role" value={value} onChange={(e) => onChange(e.target.value as Role | '')}>
      <option value="">Not chosen yet</option>
      <option value="customer">Customer</option>
      <option value="provider">Service provider</option>
    </SelectField>
  )
}

const AVATARS = 'avatars'

function photoHint(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('bucket not found')) return 'Run the latest supabase/schema.sql to create photo storage.'
  if (m.includes('row-level security') || m.includes('unauthorized')) return 'Admin photo permission missing: run the latest supabase/schema.sql.'
  if (m.includes('mime')) return 'This image type is not allowed by the bucket.'
  if (m.includes('size')) return 'The photo is too big, try another one.'
  return ''
}

async function removeStoredAvatar(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${AVATARS}/`
  const i = url?.indexOf(marker) ?? -1
  if (url && i >= 0) await supabase.storage.from(AVATARS).remove([decodeURIComponent(url.slice(i + marker.length))])
}

function EditUser({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(user.full_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [role, setRole] = useState<Role | ''>(user.role ?? '')
  const [bio, setBio] = useState(user.bio ?? '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photo, setPhoto] = useState<OptimizedImage | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const bioWords = bio.trim() ? bio.trim().split(/\s+/).length : 0
  const [busy, setBusy] = useState(false)

  async function pickPhoto(f: File | null) {
    if (!f) return
    setPhotoError(null)
    setPhotoBusy(true)
    try {
      // Any image in → small square-ish WebP out (max 400px, ~60 KB) — same size the app uploads.
      const out = await optimizeToWebp(f, { maxSide: 400, targetBytes: 60 * 1024 })
      if (preview) URL.revokeObjectURL(preview)
      setPhoto(out)
      setPreview(URL.createObjectURL(out.blob))
      setRemovePhoto(false)
    } catch (e) {
      setPhotoError(`Step: Processing — ${(e as Error).message}`)
    } finally {
      setPhotoBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setPhotoError(null)
    let avatar_url: string | null | undefined
    if (photo) {
      const path = `${user.id}/avatar-${Date.now()}.webp`
      const up = await supabase.storage.from(AVATARS).upload(path, photo.blob, { contentType: 'image/webp', cacheControl: '31536000' })
      if (up.error) {
        setBusy(false)
        setPhotoError(`Step: Upload — ${up.error.message}. ${photoHint(up.error.message)}`)
        return
      }
      avatar_url = supabase.storage.from(AVATARS).getPublicUrl(path).data.publicUrl
      const check = await fetch(avatar_url, { headers: { Range: 'bytes=0-15' } }).then((r) => r.status).catch(() => 0)
      if (check >= 400) {
        setBusy(false)
        setPhotoError(`Step: Check — uploaded but the photo cannot be opened (HTTP ${check}). Make sure the "avatars" bucket is Public (run the latest schema.sql).`)
        return
      }
    } else if (removePhoto) avatar_url = null

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        role: role || null,
        bio: bio.trim(),
        ...(avatar_url !== undefined ? { avatar_url } : {}),
      })
      .eq('id', user.id)
    if (!error && avatar_url !== undefined) await removeStoredAvatar(user.avatar_url) // old file, best effort
    if (error && avatar_url) await removeStoredAvatar(avatar_url)
    setBusy(false)
    if (error) {
      if (photo) setPhotoError(`Step: Saving — ${error.message}`)
      return toast.error(error.message.includes('profiles_bio_500_words') ? 'Bio must be 500 words or fewer.' : error.message)
    }
    toast.success(photo ? 'User updated with new photo' : 'User updated')
    onSaved()
  }

  return (
    <Modal
      open
      title="Edit user"
      subtitle={user.email ?? undefined}
      onClose={onClose}
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
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} src={removePhoto ? null : (preview ?? user.avatar_url)} size="lg" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Profile photo</p>
              <p className="text-xs text-slate-500">
                {photoBusy
                  ? 'Optimizing…'
                  : photo
                    ? `New photo ready · ${formatBytes(photo.originalBytes)} → ${formatBytes(photo.bytes)} WebP. Saved when you click Save.`
                    : removePhoto
                      ? 'Photo will be removed when you save.'
                      : 'JPG, PNG, WebP… auto-resized to a small WebP.'}
              </p>
            </div>
            <label className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm hover:bg-brand-50">
              {user.avatar_url || photo ? 'Change' : 'Upload'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
            </label>
            {user.avatar_url || photo ? (
              <button
                type="button"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview)
                  setPhoto(null)
                  setPreview(null)
                  setRemovePhoto(!!user.avatar_url)
                }}
                className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            ) : null}
          </div>
          {photoError ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{photoError}</p> : null}
        </div>
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" />
        <RoleSelect value={role} onChange={setRole} />
        <TextArea label={`Bio (${bioWords}/500 words)`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="No bio yet" />
      </div>
    </Modal>
  )
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role | ''>('customer')
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.error('Name, email and a password of at least 6 characters are required.')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await signupClient().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), phone: phone.trim() || null, role: role || null } },
      })
      if (error) throw error
      if (!data.user || data.user.identities?.length === 0) throw new Error('An account with this email already exists.')
      toast.success(
        data.session ? `${name.trim()} can now log in to the app` : `Account created — ${email.trim()} must confirm their email before logging in`,
      )
      onCreated()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title="Add a user"
      subtitle="Creates a login for the Eizi mobile app."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={UserPlus} onClick={create} loading={busy}>
            Create user
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ali Raza" />
        </div>
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" />
        <TextField
          label="Temporary password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          hint="Share it with the user privately."
        />
        <RoleSelect value={role} onChange={setRole} />
      </div>
    </Modal>
  )
}
