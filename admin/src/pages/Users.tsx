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
import { signupClient, supabase } from '../lib/supabase'
import type { Account, Profile, Role, UserRow } from '../lib/types'
import { must, useLoad } from '../lib/useLoad'

type Filter = 'all' | 'today' | 'customer' | 'provider' | 'none'

async function loadUsers(): Promise<UserRow[]> {
  const [profiles, accounts] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, role, created_at, avatar_url, bio').order('created_at', { ascending: false }).then((r) => must(r) as Profile[]),
    supabase.rpc('admin_list_accounts').then((r) => must(r) as Account[]),
  ])
  const byId = new Map(accounts.map((a) => [a.id, a]))
  return profiles.map((p) => {
    const a = byId.get(p.id)
    return { ...p, email: a?.email ?? null, last_sign_in_at: a?.last_sign_in_at ?? null, email_confirmed_at: a?.email_confirmed_at ?? null }
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
                <Th className="hidden md:table-cell">Phone</Th>
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
                <Td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{u.phone || '—'}</Td>
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

function EditUser({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(user.full_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [role, setRole] = useState<Role | ''>(user.role ?? '')
  const [bio, setBio] = useState(user.bio ?? '')
  const [removePhoto, setRemovePhoto] = useState(false)
  const bioWords = bio.trim() ? bio.trim().split(/s+/).length : 0
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), phone: phone.trim() || null, role: role || null, bio: bio.trim(), ...(removePhoto ? { avatar_url: null } : {}) })
      .eq('id', user.id)
    if (!error && removePhoto && user.avatar_url) {
      // best effort: delete the file too (admins may delete in the avatars bucket)
      const marker = '/storage/v1/object/public/avatars/'
      const i = user.avatar_url.indexOf(marker)
      if (i >= 0) await supabase.storage.from('avatars').remove([decodeURIComponent(user.avatar_url.slice(i + marker.length))])
    }
    setBusy(false)
    if (error) return toast.error(error.message.includes('profiles_bio_500_words') ? 'Bio must be 500 words or fewer.' : error.message)
    toast.success('User updated')
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
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx xxxxxxx" />
        <RoleSelect value={role} onChange={setRole} />
        <TextArea label={`Bio (${bioWords}/500 words)`} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="No bio yet" />
        {user.avatar_url ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3">
            <Avatar name={user.full_name} src={user.avatar_url} size="lg" />
            <span className="flex-1 text-sm text-slate-600">Profile photo</span>
            <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} className="size-4 accent-red-600" />
            <span className="text-sm font-semibold text-red-600">Remove</span>
          </label>
        ) : null}
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
