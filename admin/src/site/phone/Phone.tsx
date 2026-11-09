import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

const DESIGN_W = 260

/**
 * Realistic phone frame rendered in CSS 3D. Tilts toward the pointer (interactive) and/or floats gently.
 * Motion is disabled automatically for users with "reduce motion" turned on (see index.css).
 */
export function Phone({
  children,
  width = 280,
  tilt = { x: 6, y: -14 },
  interactive = false,
  float = false,
  floatDelay = 0,
  className = '',
  style,
  label,
}: {
  children: ReactNode
  width?: number
  tilt?: { x: number; y: number }
  interactive?: boolean
  float?: boolean
  floatDelay?: number
  className?: string
  style?: CSSProperties
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const height = Math.round(width * 2.05)
  const radius = Math.round(width * 0.155)
  const bezel = Math.round(width * 0.035)
  const scale = (width - bezel * 2) / DESIGN_W

  const rx = pointer ? tilt.x - pointer.y * 10 : tilt.x
  const ry = pointer ? tilt.y + pointer.x * 14 : tilt.y

  return (
    <div
      ref={ref}
      className={`phone-scene ${className}`}
      style={{ perspective: 1400, ...style }}
      onPointerMove={
        interactive
          ? (e) => {
              const r = ref.current?.getBoundingClientRect()
              if (!r) return
              setPointer({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
            }
          : undefined
      }
      onPointerLeave={interactive ? () => setPointer(null) : undefined}
      role="img"
      aria-label={label}
    >
      <div className={float ? 'phone-float' : ''} style={{ animationDelay: `${floatDelay}ms` }}>
        <div
          className="phone-body relative"
          style={{
            width,
            height,
            borderRadius: radius,
            transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
            transformStyle: 'preserve-3d',
            transition: pointer ? 'transform 80ms linear' : 'transform 600ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {/* frame */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-900 to-black"
            style={{
              borderRadius: radius,
              boxShadow:
                'inset 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 0 9px #0b0f17, 0 2px 2px rgba(0,0,0,.25), 0 30px 60px -12px rgba(8,59,54,.45), 0 18px 36px -18px rgba(0,0,0,.55)',
            }}
          />
          {/* side buttons */}
          <span className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-slate-700" />
          <span className="absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-r bg-slate-700" />
          {/* screen */}
          <div className="absolute overflow-hidden bg-surface" style={{ inset: bezel, borderRadius: radius - bezel }}>
            {/* screens are designed at DESIGN_W px wide and scaled to fit any phone size */}
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{ width: DESIGN_W, height: (height - bezel * 2) / scale, transform: `scale(${scale})` }}
            >
              {children}
            </div>
            {/* glass reflection */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.06) 100%)',
              }}
            />
          </div>
          {/* camera notch */}
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black" style={{ top: Math.round(width * 0.05), width: width * 0.28, height: width * 0.075 }} />
        </div>
      </div>
      {/* floor shadow — stays on the ground and shrinks as the phone floats up */}
      <div
        className="phone-shadow mx-auto mt-6 h-6 rounded-[50%] bg-slate-900/25 blur-xl"
        style={{ width: width * 0.8, animationDelay: `${floatDelay}ms` }}
      />
    </div>
  )
}
