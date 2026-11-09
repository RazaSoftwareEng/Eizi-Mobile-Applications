import { Archive, Inbox, Mail, MailOpen, MessageCircle, Phone, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useToast } from '../components/Toast'
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorBanner, IconButton, NewBadge, PageHeader, SearchInput, Spinner, Tabs } from '../components/ui'
import { formatDateTime, timeAgo } from '../lib/format'
import { supabase } from '../lib/supabase'
import { must, useLoad } from '../lib/useLoad'

type Msg = {
  id: number
  name: string
  contact: string
  topic: 'general' | 'app' | 'provider' | 'support' | 'business'
  message: string
  status: 'new' | 'read' | 'archived'
  created_at: string
}
type Filter = 'new' | 'read' | 'archived'

const TOPIC: Record<Msg['topic'], { label: string; cls: string }> = {
  general: { label: 'General', cls: 'bg-slate-100 text-slate-700' },
  app: { label: 'Wants the app', cls: 'bg-brand-50 text-brand-700' },
  provider: { label: 'Provider', cls: 'bg-orange-50 text-orange-700' },
  support: { label: 'Support', cls: 'bg-red-50 text-red-700' },
  business: { label: 'Business', cls: 'bg-violet-50 text-violet-700' },
}

const load = () =>
  supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
    .then((r) => must(r) as Msg[])

/** Turns "0300 1234567" into a wa.me number (92…); null if it isn't a phone number. */
function whatsappNumber(contact: string) {
  if (contact.includes('@')) return null
  let d = contact.replace(/\D/g, '')
  if (d.startsWith('0')) d = '92' + d.slice(1)
  return d.length >= 11 ? d : null
}

export function Messages() {
  const toast = useToast()
  const { data, loading, error, reload, setData } = useLoad(load)
  const [filter, setFilter] = useState<Filter>('new')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Msg | null>(null)

  const all = useMemo(() => data ?? [], [data])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((m) => m.status === filter).filter((m) => !q || [m.name, m.contact, m.message].some((v) => v.toLowerCase().includes(q)))
  }, [all, filter, query])
  const count = (s: Filter) => all.filter((m) => m.status === s).length
  const open = all.find((m) => m.id === openId) ?? null

  async function setStatus(m: Msg, status: Msg['status'], quiet = false) {
    setData((d) => d?.map((x) => (x.id === m.id ? { ...x, status } : x)) ?? d)
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', m.id)
    if (error) {
      toast.error(error.message)
      reload()
    } else if (!quiet) toast.success(status === 'archived' ? 'Message archived' : status === 'new' ? 'Marked as unread' : 'Marked as read')
  }

  function openMessage(m: Msg) {
    setOpenId(m.id)
    if (m.status === 'new') setStatus(m, 'read', true)
  }

  async function onDelete(m: Msg) {
    const { error } = await supabase.from('contact_messages').delete().eq('id', m.id)
    if (error) return toast.error(error.message)
    toast.success('Message deleted')
    setDeleting(null)
    if (openId === m.id) setOpenId(null)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Everything sent through the contact form on the Eizi website."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && !!data}>
            Refresh
          </Button>
        }
      />
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
            <Tabs<Filter>
              value={filter}
              onChange={(f) => {
                setFilter(f)
                setOpenId(null)
              }}
              options={[
                { value: 'new', label: 'New', count: count('new') },
                { value: 'read', label: 'Read', count: count('read') },
                { value: 'archived', label: 'Archived', count: count('archived') },
              ]}
            />
            <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone, email, text…" />
          </div>
          {!data && loading ? (
            <Spinner />
          ) : visible.length === 0 ? (
            <EmptyState icon={Inbox} title={filter === 'new' ? 'No new messages' : 'Nothing here'} text="Messages from the website contact form appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => openMessage(m)}
                    className={`flex w-full cursor-pointer gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 ${openId === m.id ? 'bg-brand-50/60' : ''}`}
                  >
                    <Avatar name={m.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm ${m.status === 'new' ? 'font-bold text-ink' : 'font-semibold text-slate-700'}`}>{m.name}</p>
                        {m.status === 'new' ? <NewBadge /> : null}
                        <span className="ml-auto shrink-0 text-xs text-slate-400">{timeAgo(m.created_at)}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${TOPIC[m.topic].cls}`}>{TOPIC[m.topic].label}</span>
                        <span className="truncate">{m.contact}</span>
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">{m.message}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Reading pane */}
        <Card className="h-fit xl:sticky xl:top-24">
          {!open ? (
            <EmptyState icon={MailOpen} title="Select a message" text="Click a message on the left to read it and reply." />
          ) : (
            <div className="p-6">
              <div className="flex items-start gap-3">
                <Avatar name={open.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink">{open.name}</p>
                  <p className="truncate text-sm text-slate-500">{open.contact}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(open.created_at)}</p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${TOPIC[open.topic].cls}`}>{TOPIC[open.topic].label}</span>
              </div>
              <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-[15px] leading-7 whitespace-pre-wrap text-slate-700">{open.message}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {whatsappNumber(open.contact) ? (
                  <>
                    <a
                      href={`https://wa.me/${whatsappNumber(open.contact)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                    >
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                    <a href={`tel:${open.contact.replace(/\s/g, '')}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50">
                      <Phone className="size-4" /> Call
                    </a>
                  </>
                ) : null}
                {open.contact.includes('@') ? (
                  <a
                    href={`mailto:${open.contact}?subject=${encodeURIComponent('Re: your message to Eizi')}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-brand hover:bg-brand-800"
                  >
                    <Mail className="size-4" /> Reply by email
                  </a>
                ) : null}
                <div className="ml-auto flex gap-1">
                  {open.status !== 'new' ? <IconButton icon={Mail} label="Mark as unread" onClick={() => setStatus(open, 'new')} /> : null}
                  {open.status !== 'archived' ? (
                    <IconButton icon={Archive} label="Archive" onClick={() => setStatus(open, 'archived')} />
                  ) : (
                    <IconButton icon={MailOpen} label="Move back to Read" onClick={() => setStatus(open, 'read')} />
                  )}
                  <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => setDeleting(open)} />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this message?"
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? onDelete(deleting) : undefined)}
        message="It will be removed permanently. Use Archive if you only want to hide it."
      />
    </>
  )
}
