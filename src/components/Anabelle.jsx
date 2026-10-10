// Anabelle — a fluffy, lively cartoon puppy: tufty scalloped fur everywhere, soft shading,
// big glossy eyes, floppy ears that flap, a plume tail that wags, and little props.
// Plain SVG, so she scales anywhere.
//
// Moods:   'idle' (smiling, thinking of a book), 'reading' (holding a book),
//          'studying' (book + glasses), 'cheer' (arms up, sparkles, jumping)
// Variant: 'full' (whole puppy) or 'face' (head and ears only, for small spots like the header)

import { useId } from 'react'

const OUT = '#6b3515'          // soft brown outline
const ORANGE_DARK = '#d9801a'
const CREAM = '#fff4dc'
const PINK = '#f6a3a3'
const NOSE = '#4a2410'
const EYE = '#3d1f0d'

const outline = { stroke: OUT, strokeLinejoin: 'round', strokeLinecap: 'round' }

// A rounded blob with a tufty, scalloped edge, so nothing looks like a perfect geometric shape
function fluffy(cx, cy, rx, ry, { n = 14, amp = 0.08, rot = 0 } = {}) {
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const point = (angle, k) => {
    const x = Math.cos(angle) * rx * k
    const y = Math.sin(angle) * ry * k
    return [cx + x * cos - y * sin, cy + x * sin + y * cos]
  }
  let d = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    const bump = amp * (0.65 + 0.7 * (((i * 7) % 5) / 4))
    const [x0, y0] = point(a0, 1)
    const [qx, qy] = point((a0 + a1) / 2, 1 + bump * 2)
    const [x1, y1] = point(a1, 1)
    if (i === 0) d += `M${x0.toFixed(1)} ${y0.toFixed(1)}`
    d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  return `${d} Z`
}

const HEAD = fluffy(80, 60, 43, 36, { n: 24, amp: 0.075 })
const EAR_L = fluffy(27, 53, 19.5, 28, { n: 17, amp: 0.1, rot: 0.5 })
const EAR_R = fluffy(133, 53, 19.5, 28, { n: 17, amp: 0.1, rot: -0.5 })
const EAR_L_INNER = fluffy(30, 54, 11, 19, { n: 12, amp: 0.08, rot: 0.5 })
const EAR_R_INNER = fluffy(130, 54, 11, 19, { n: 12, amp: 0.08, rot: -0.5 })
const BODY = fluffy(80, 124, 34, 35, { n: 18, amp: 0.06 })
const BELLY = fluffy(80, 131, 19, 24, { n: 14, amp: 0.05 })
const RUFF = fluffy(80, 108, 26, 14, { n: 14, amp: 0.13 })
const HIP_L = fluffy(52, 142, 20, 16, { n: 12, amp: 0.07 })
const HIP_R = fluffy(108, 142, 20, 16, { n: 12, amp: 0.07 })
const FOOT_L = fluffy(47, 157, 12.5, 7, { n: 9, amp: 0.1 })
const FOOT_R = fluffy(113, 157, 12.5, 7, { n: 9, amp: 0.1 })
const TAIL = fluffy(140, 128, 10.5, 24, { n: 13, amp: 0.1, rot: 0.55 })
const TAIL_TIP = fluffy(148.5, 107, 7.5, 7.5, { n: 8, amp: 0.12 })
const MUZZLE = fluffy(80, 77, 25.5, 16.5, { n: 16, amp: 0.06 })

function Limb({ x1, y1, x2, y2, fill, bend = 0 }) {
  // a thick stroke drawn twice (dark, then fur colour) gives a clean outlined arm; `bend` bows it sideways
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const cx = (x1 + x2) / 2 + (-dy / len) * bend
  const cy = (y1 + y2) / 2 + (dx / len) * bend
  const d = `M${x1} ${y1} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`
  return (
    <g fill="none">
      <path d={d} stroke={OUT} strokeWidth="19.5" strokeLinecap="round" />
      <path d={d} stroke={fill} strokeWidth="14" strokeLinecap="round" />
    </g>
  )
}

function Paw({ x, y, r = 9.5, pad = false }) {
  return (
    <g>
      <path d={fluffy(x, y, r, r * 0.9, { n: 9, amp: 0.1 })} fill={CREAM} strokeWidth="2.2" {...outline} />
      {pad && (
        <g fill={PINK}>
          <ellipse cx={x} cy={y + r * 0.28} rx={r * 0.44} ry={r * 0.36} />
          <circle cx={x - r * 0.46} cy={y - r * 0.26} r={r * 0.18} />
          <circle cx={x} cy={y - r * 0.46} r={r * 0.18} />
          <circle cx={x + r * 0.46} cy={y - r * 0.26} r={r * 0.18} />
        </g>
      )}
    </g>
  )
}

function Sparkle({ x, y, scale = 1, delay = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        className="an-sparkle"
        style={{ animationDelay: `${delay}s` }}
        d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
        fill="#ffd84a"
        stroke="#e0a800"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </g>
  )
}

function Heart({ x, y, scale = 1, delay = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        className="an-heart"
        style={{ animationDelay: `${delay}s` }}
        d="M0 -2 C-1 -5 -5 -4 -5 -1 C-5 2 0 5 0 6 C0 5 5 2 5 -1 C5 -4 1 -5 0 -2 Z"
        fill="#ff6f8e"
      />
    </g>
  )
}

function Eye({ x, cheer, irisFill }) {
  if (cheer) {
    return <path d={`M${x - 8.5} 61 Q${x} 47 ${x + 8.5} 61`} fill="none" stroke={OUT} strokeWidth="3.4" strokeLinecap="round" />
  }
  return (
    <g className="an-eye">
      <circle cx={x} cy="58" r="10" fill={irisFill} />
      <circle cx={x + 3} cy="54.2" r="3.6" fill="#fff" />
      <circle cx={x - 3.2} cy="62.2" r="1.7" fill="#fff" opacity=".95" />
      <path d={`M${x - 7} 63.6 Q${x} 68 ${x + 7} 63.6`} fill="none" stroke="rgba(255,225,180,.45)" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  )
}

export default function Anabelle({ mood = 'idle', size = 96, variant = 'full', className = '' }) {
  const uid = useId().replace(/:/g, '')
  const cheer = mood === 'cheer'
  const withBook = mood === 'reading' || mood === 'studying'
  const glasses = mood === 'studying'
  const idle = mood === 'idle'
  const face = variant === 'face'

  const viewBox = face ? '18 0 124 124' : '0 0 160 170'
  const height = face ? size : (size * 170) / 160

  const headFill = `url(#${uid}-head)`
  const bodyFill = `url(#${uid}-body)`
  const earFill = `url(#${uid}-ear)`
  const creamFill = `url(#${uid}-cream)`
  const irisFill = `url(#${uid}-iris)`
  const fur = '#f0a028'

  return (
    <svg
      className={`an an-${mood} ${face ? 'an-face' : ''} ${className}`}
      width={size}
      height={height}
      viewBox={viewBox}
      role="img"
      aria-label="Anabelle the puppy"
    >
      <defs>
        <radialGradient id={`${uid}-head`} cx="0.42" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#ffcb6b" />
          <stop offset="0.55" stopColor="#f6a42c" />
          <stop offset="1" stopColor="#dd8416" />
        </radialGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8ac35" />
          <stop offset="1" stopColor="#df8618" />
        </linearGradient>
        <linearGradient id={`${uid}-ear`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#b26531" />
          <stop offset="1" stopColor="#7d3f19" />
        </linearGradient>
        <linearGradient id={`${uid}-cream`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#f8e4bd" />
        </linearGradient>
        <radialGradient id={`${uid}-iris`} cx="0.45" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#6a3a1c" />
          <stop offset="1" stopColor={EYE} />
        </radialGradient>
      </defs>

      <g className="an-all">
        {!face && <ellipse cx="80" cy="163" rx="46" ry="6" fill="rgba(0,0,0,.18)" />}

        {!face && (
          <>
            {/* plume tail */}
            <g className="an-tail">
              <path d={TAIL} fill={bodyFill} strokeWidth="2.4" {...outline} />
              <path d={TAIL_TIP} fill={creamFill} strokeWidth="2.2" {...outline} />
            </g>

            {/* back legs and feet */}
            <path d={HIP_L} fill={bodyFill} strokeWidth="2.4" {...outline} />
            <path d={HIP_R} fill={bodyFill} strokeWidth="2.4" {...outline} />
            <path d={FOOT_L} fill={creamFill} strokeWidth="2.2" {...outline} />
            <path d={FOOT_R} fill={creamFill} strokeWidth="2.2" {...outline} />

            {/* body */}
            <g className="an-torso">
              <path d={BODY} fill={bodyFill} strokeWidth="2.4" {...outline} />
              <path d={BELLY} fill={creamFill} />
              <g fill="none" stroke={ORANGE_DARK} strokeWidth="1.6" strokeLinecap="round" opacity=".55">
                <path d="M54 118 q-2 5 0 9" /><path d="M58 128 q-2 4 0 8" /><path d="M106 118 q2 5 0 9" /><path d="M102 128 q2 4 0 8" />
              </g>
            </g>

            {/* arms */}
            {!cheer && !withBook && (
              <>
                <Limb x1={58} y1={108} x2={58} y2={146} fill={fur} bend={5} />
                <Limb x1={102} y1={108} x2={102} y2={146} fill={fur} bend={-5} />
                <Paw x={58} y={150} r={10.5} />
                <Paw x={102} y={150} r={10.5} />
              </>
            )}
            {withBook && (
              <>
                <Limb x1={58} y1={108} x2={48} y2={146} fill={fur} />
                <Limb x1={102} y1={108} x2={112} y2={146} fill={fur} />
                <g className="an-book">
                  <path d="M42 124 L80 117 L118 124 L118 160 L80 153 L42 160 Z" fill="#4a50c8" strokeWidth="2.6" {...outline} />
                  <path d="M48 127 L78 121.5 L78 150 L48 155 Z" fill="#fffaf0" />
                  <path d="M82 121.5 L112 127 L112 155 L82 150 Z" fill="#fffaf0" />
                  <path d="M80 118 V152" stroke="rgba(60,64,150,.5)" strokeWidth="1.6" />
                  <g stroke="rgba(60,64,150,.35)" strokeWidth="1.3" strokeLinecap="round">
                    <path d="M53 134 L72 131" /><path d="M53 140 L72 137" /><path d="M53 146 L72 143" />
                    <path d="M88 131 L107 134" /><path d="M88 137 L107 140" /><path d="M88 143 L107 146" />
                  </g>
                </g>
                <Paw x={49} y={150} r={9} />
                <Paw x={111} y={150} r={9} />
              </>
            )}

            {/* chest ruff and collar */}
            <path d={RUFF} fill={creamFill} strokeWidth="2.2" {...outline} />
            <path d="M56 98 Q80 111 104 98 L104 105 Q80 119 56 105 Z" fill="#7c88ee" strokeWidth="2.2" {...outline} />
            <circle cx="80" cy="116" r="5.2" fill="#f2c14e" strokeWidth="2" {...outline} />
          </>
        )}

        {face && (
          <>
            <path d={RUFF} fill={creamFill} strokeWidth="2.2" {...outline} />
            <path d="M56 98 Q80 111 104 98 L104 105 Q80 119 56 105 Z" fill="#7c88ee" strokeWidth="2.2" {...outline} />
          </>
        )}

        <g className="an-head">
          {/* big floppy fluffy ears (behind the face) */}
          <g className="an-ear an-ear-l">
            <path d={EAR_L} fill={earFill} strokeWidth="2.4" {...outline} />
            <path d={EAR_L_INNER} fill="#c27a42" opacity=".5" />
            <g fill="none" stroke="#5b2a10" strokeWidth="1.5" strokeLinecap="round" opacity=".45">
              <path d="M16 44 q-3 7 0 14 t0 14" /><path d="M24 40 q-3 7 0 14 t0 14" />
            </g>
          </g>
          <g className="an-ear an-ear-r">
            <path d={EAR_R} fill={earFill} strokeWidth="2.4" {...outline} />
            <path d={EAR_R_INNER} fill="#c27a42" opacity=".5" />
            <g fill="none" stroke="#5b2a10" strokeWidth="1.5" strokeLinecap="round" opacity=".45">
              <path d="M144 44 q3 7 0 14 t0 14" /><path d="M136 40 q3 7 0 14 t0 14" />
            </g>
          </g>

          {/* fluffy head with cheek tufts */}
          <path d={HEAD} fill={headFill} strokeWidth="2.4" {...outline} />
          <ellipse cx="64" cy="36" rx="19" ry="7" fill="#fff" opacity=".2" transform="rotate(-18 64 36)" />
          <g fill="none" stroke={ORANGE_DARK} strokeWidth="1.6" strokeLinecap="round" opacity=".5">
            <path d="M50 40 q3 3 1 8" /><path d="M110 40 q-3 3 -1 8" /><path d="M56 32 q3 2 2 6" /><path d="M104 32 q-3 2 -2 6" />
          </g>

          {/* white blaze and muzzle */}
          <path d="M80 34 C71 42 70.5 55 74 68 L86 68 C89.5 55 89 42 80 34 Z" fill={creamFill} opacity=".95" />
          <path d={MUZZLE} fill={creamFill} strokeWidth="2.2" {...outline} />
          <ellipse cx="51" cy="78" rx="7.5" ry="5" fill={PINK} opacity=".55" />
          <ellipse cx="109" cy="78" rx="7.5" ry="5" fill={PINK} opacity=".55" />

          {/* little cream eyebrow spots */}
          <ellipse cx="62" cy="43" rx="5.5" ry="3.2" fill={CREAM} />
          <ellipse cx="98" cy="43" rx="5.5" ry="3.2" fill={CREAM} />

          {/* eyes */}
          <Eye x={62} cheer={cheer} irisFill={irisFill} />
          <Eye x={98} cheer={cheer} irisFill={irisFill} />
          {glasses && (
            <>
            <g fill="rgba(255,255,255,.07)" stroke="#2f3790" strokeWidth="2.6">
              <circle cx="62" cy="58" r="13.5" />
              <circle cx="98" cy="58" r="13.5" />
              <path d="M75.5 58 H84.5" fill="none" />
            </g>
            <g fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M53 50 Q56 46 60.5 45" /><path d="M89 50 Q92 46 96.5 45" />
            </g>
            </>
          )}

          {/* nose and mouth */}
          <path d="M73 66 Q80 62 87 66 Q87 73 80 74 Q73 73 73 66 Z" fill={NOSE} strokeWidth="1.6" {...outline} />
          <ellipse cx="77.6" cy="65.8" rx="2.4" ry="1.2" fill="#fff" opacity=".85" />
          {cheer ? (
            <>
              <path d="M67 78 Q80 101 93 78 Z" fill="#8a2f3a" strokeWidth="2.4" {...outline} />
              <ellipse cx="80" cy="92" rx="8" ry="5.5" fill="#f27a8a" />
            </>
          ) : (
            <>
              <path d="M80 74 V78" fill="none" strokeWidth="2.2" {...outline} />
              <path d="M71 79 Q75.5 86 80 79 Q84.5 86 89 79" fill="none" strokeWidth="2.4" {...outline} />
            </>
          )}
        </g>

        {/* cheering arms, in front of the ears */}
        {cheer && !face && (
          <>
            <g className="an-arm an-arm-l"><Limb x1={56} y1={106} x2={30} y2={60} fill={fur} /><Paw x={30} y={57} r={12.5} pad /></g>
            <g className="an-arm an-arm-r"><Limb x1={104} y1={106} x2={130} y2={60} fill={fur} /><Paw x={130} y={57} r={12.5} pad /></g>
          </>
        )}

        {/* extras */}
        {cheer && !face && (
          <g>
            <Sparkle x={22} y={26} scale={1.3} delay={0} />
            <Sparkle x={138} y={22} scale={1.1} delay={0.3} />
            <Sparkle x={14} y={96} scale={0.9} delay={0.6} />
            <Sparkle x={148} y={92} scale={0.9} delay={0.9} />
            <Heart x={80} y={12} scale={1.5} delay={0.2} />
          </g>
        )}
        {cheer && face && <Heart x={80} y={20} scale={1.4} delay={0.2} />}

        {idle && !face && (
          <g className="an-bubble">
            <circle cx="114" cy="40" r="3.4" fill="#fff" strokeWidth="1.8" {...outline} />
            <circle cx="120" cy="30" r="5" fill="#fff" strokeWidth="1.8" {...outline} />
            <ellipse cx="136" cy="16" rx="21" ry="14" fill="#fff" strokeWidth="2" {...outline} />
            <g strokeWidth="1.6" {...outline}>
              <path d="M127 11 L136 9 L145 11 L145 23 L136 21 L127 23 Z" fill="#7c88ee" />
              <path d="M136 9 V21" fill="none" />
            </g>
          </g>
        )}
      </g>
    </svg>
  )
}
