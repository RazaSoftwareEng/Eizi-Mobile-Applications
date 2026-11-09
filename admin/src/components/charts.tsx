import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { CHART } from '../lib/chartTheme'


/** Width of an element, kept in sync with resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function niceMax(v: number) {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * pow
}

/** Whole-number ticks (counts are never fractional): pick a step count that divides the max evenly. */
function ticks(max: number) {
  const count = [4, 5, 2].find((c) => Number.isInteger(max / c)) ?? 4
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i)
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n * 10) / 10)

/* ------------------------------------------------------------------ Tooltip */

type Tip = { x: number; y: number; title: string; rows: { color: string; name: string; value: string }[] } | null

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null
  const left = Math.min(Math.max(tip.x, 70), width - 70)
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-32 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop"
      style={{ left, top: tip.y - 10 }}
    >
      <p className="mb-1 font-medium text-slate-500">{tip.title}</p>
      {tip.rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 whitespace-nowrap">
          <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />
          <span className="text-sm font-bold text-ink tabular-nums">{r.value}</span>
          <span className="text-slate-500">{r.name}</span>
        </p>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ Bar chart (single series) */

export function BarChart({ data, name, format = compact, height = 240 }: {
  data: { label: string; short: string; value: number }[]
  name: string
  format?: (n: number) => string
  height?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip>(null)
  const [active, setActive] = useState<number | null>(null)

  const pad = { top: 12, right: 8, bottom: 28, left: 40 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const band = data.length ? innerW / data.length : 0
  const barW = Math.max(4, Math.min(36, band - 2 - band * 0.28))
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 48)))
  const y = (v: number) => pad.top + innerH - (v / max) * innerH

  const show = useCallback(
    (i: number) => {
      const d = data[i]
      setActive(i)
      setTip({ x: pad.left + band * i + band / 2, y: y(d.value), title: d.label, rows: [{ color: CHART.brand, name, value: format(d.value) }] })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, band, max, name, format],
  )
  const hide = () => {
    setActive(null)
    setTip(null)
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`${name} bar chart`}>
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.muted} className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.left + band * i + band / 2
            const h = Math.max(0, y(0) - y(d.value))
            const r = Math.min(4, h, barW / 2)
            const x0 = cx - barW / 2
            const top = y(d.value)
            const path = h > 0 ? `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z` : ''
            return (
              <g key={d.label}>
                {path ? <path d={path} fill={CHART.brand} opacity={active === null || active === i ? 1 : 0.45} style={{ transition: 'opacity 120ms' }} /> : null}
                {(data.length - 1 - i) % labelEvery === 0 ? (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART.muted}>
                    {d.short}
                  </text>
                ) : null}
                {/* hit target: whole column, bigger than the mark */}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${format(d.value)} ${name}`}
                  onPointerEnter={() => show(i)}
                  onPointerLeave={hide}
                  onFocus={() => show(i)}
                  onBlur={hide}
                  className="cursor-default outline-none"
                />
              </g>
            )
          })}
        </svg>
      ) : null}
      <Tooltip tip={tip} width={width} />
    </div>
  )
}

/* ------------------------------------------------------------------ Line chart (multi series, one axis) */

export type Series = { name: string; color: string; values: number[] }

export function LineChart({ labels, shortLabels, series, height = 240 }: {
  labels: string[]
  shortLabels: string[]
  series: Series[]
  height?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [idx, setIdx] = useState<number | null>(null)

  const pad = { top: 14, right: 84, bottom: 28, left: 40 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0))
  const n = labels.length
  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (innerW / (n - 1)) * i)
  const y = (v: number) => pad.top + innerH - (v / max) * innerH
  const labelEvery = Math.ceil(n / Math.max(1, Math.floor(innerW / 52)))

  // Direct end labels, nudged apart when they would collide.
  const ends = series
    .map((s) => ({ s, y: y(s.values[n - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - box.left
    const i = n <= 1 ? 0 : Math.round((rel / innerW) * (n - 1))
    setIdx(Math.max(0, Math.min(n - 1, i)))
  }

  const tip: Tip =
    idx === null
      ? null
      : {
          x: x(idx),
          y: Math.min(...series.map((s) => y(s.values[idx] ?? 0))),
          title: labels[idx],
          rows: series.map((s) => ({ color: s.color, name: s.name, value: compact(s.values[idx] ?? 0) })),
        }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`${series.map((s) => s.name).join(' and ')} line chart`}>
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.axis : CHART.grid} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.muted} className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {shortLabels.map((l, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART.muted}>
                {l}
              </text>
            ) : null,
          )}
          {idx !== null ? <line x1={x(idx)} x2={x(idx)} y1={pad.top} y2={pad.top + innerH} stroke={CHART.axis} strokeWidth={1} /> : null}
          {series.map((s) => (
            <path
              key={s.name}
              d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* end markers + direct labels (text in ink, colour carried by the marker) */}
          {ends.map(({ s, y: ly }) => (
            <g key={s.name}>
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke={CHART.surface} strokeWidth={2} />
              <text x={x(n - 1) + 10} y={ly} dy="0.32em" fontSize={12} fontWeight={600} fill={CHART.ink}>
                {s.name}
              </text>
            </g>
          ))}
          {idx !== null
            ? series.map((s) => <circle key={s.name} cx={x(idx)} cy={y(s.values[idx] ?? 0)} r={5} fill={s.color} stroke={CHART.surface} strokeWidth={2} />)
            : null}
          <rect
            x={pad.left - 10}
            y={pad.top}
            width={innerW + 20}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            aria-label="Move with arrow keys to read daily values"
            onPointerMove={onMove}
            onPointerLeave={() => setIdx(null)}
            onFocus={() => setIdx(n - 1)}
            onBlur={() => setIdx(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, (i ?? n - 1) - 1))
              if (e.key === 'ArrowRight') setIdx((i) => Math.min(n - 1, (i ?? 0) + 1))
            }}
            className="outline-none"
          />
        </svg>
      ) : null}
      <Tooltip tip={tip} width={width} />
    </div>
  )
}

/* ------------------------------------------------------------------ Horizontal bars (labelled, single colour) */

export function HBarList({ items, format = compact, empty }: {
  items: { label: ReactNode; key: string; value: number; note?: string }[]
  format?: (n: number) => string
  empty?: ReactNode
}) {
  const max = Math.max(...items.map((i) => i.value), 0)
  if (!items.length || max === 0) return <>{empty}</>
  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-700">{i.label}</span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">
              {format(i.value)}
              {i.note ? <span className="ml-1.5 text-xs font-normal text-slate-500">{i.note}</span> : null}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full transition-[width] duration-500" style={{ width: `${(i.value / max) * 100}%`, background: CHART.brand, minWidth: i.value ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ Legend & card */

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  )
}

/** Card with title, optional legend, and a chart ⇄ table toggle so every value is reachable without hovering. */
export function ChartCard({ title, subtitle, legend, table, children, className = '' }: {
  title: string
  subtitle?: string
  legend?: ReactNode
  table?: { head: string[]; rows: (string | number)[][] }
  children: ReactNode
  className?: string
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={`rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {legend && !asTable ? legend : null}
          {table ? (
            <button
              onClick={() => setAsTable((v) => !v)}
              className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              aria-pressed={asTable}
            >
              {asTable ? 'Chart' : 'Table'}
            </button>
          ) : null}
        </div>
      </div>
      {asTable && table ? (
        <div className="max-h-64 overflow-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-semibold ${i ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className={`px-3 py-1.5 ${ci ? 'text-right tabular-nums' : 'text-slate-600'}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
