import { useMemo } from 'react'
import SearchBar from './SearchBar'
import { RISK_COLORS, C } from '../utils/colors'

const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// ── Brand helpers ─────────────────────────────────────────────────────────── //

export function Wordmark({ size = 72 }) {
  return (
    <div style={{ fontSize: size, fontWeight: 900, letterSpacing: '0.16em', lineHeight: 1, display: 'inline-flex' }}>
      <span style={{ color: '#58A6FF', textShadow: '0 0 28px #58A6FF99' }}>D</span>
      <span style={{ color: '#58A6FF', textShadow: '0 0 28px #58A6FF99' }}>E</span>
      <span style={{ color: '#FF8C00', textShadow: '0 0 28px #FF8C0099' }}>S</span>
      <span style={{ color: '#FF8C00', textShadow: '0 0 28px #FF8C0099' }}>K</span>
    </div>
  )
}

export function BrandName({ size = 13 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: '0.02em' }}>
      <span style={{ color: '#58A6FF', fontWeight: 700 }}>DE</span>
      <span style={{ color: C.muted }}>pendency ri</span>
      <span style={{ color: '#FF8C00', fontWeight: 700 }}>SK</span>
    </span>
  )
}

// ── Orbital background ────────────────────────────────────────────────────── //

const RINGS = [
  { r: 80,  speed: 18, color: '#58A6FF', nodes: 4, size: 6   },
  { r: 134, speed: 34, color: '#FF8C00', nodes: 6, size: 4.5 },
  { r: 192, speed: 55, color: '#3FB950', nodes: 8, size: 3   },
]

function Orbital() {
  return (
    <>
      <style>{`
        @keyframes d-orb { to { transform: rotate(360deg);  } }
        @keyframes d-ctr { to { transform: rotate(-360deg); } }
        @keyframes d-pls { 0%,100% { opacity:.5 } 50% { opacity:1 } }
      `}</style>

      <div style={{
        position:      'absolute',
        top: '50%',    left: '50%',
        transform:     'translate(-50%, -50%)',
        width:          430, height: 430,
        pointerEvents: 'none',
        userSelect:    'none',
      }}>
        {/* Ambient core glow */}
        <div style={{
          position:   'absolute',
          inset:      0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #58A6FF1a 0%, #FF8C000a 42%, transparent 70%)',
          animation:  'd-pls 4.5s ease-in-out infinite',
        }} />

        {RINGS.map((ring, ri) => (
          <div key={ri}>
            {/* Ring track */}
            <div style={{
              position:     'absolute',
              top: '50%',   left: '50%',
              width:        ring.r * 2,
              height:       ring.r * 2,
              marginTop:   -ring.r,
              marginLeft:  -ring.r,
              border:      `1px solid ${ring.color}20`,
              borderRadius: '50%',
            }} />

            {/* Nodes */}
            {Array.from({ length: ring.nodes }).map((_, ni) => {
              const dur = `${ring.speed}s`
              const dly = `${-(ni / ring.nodes) * ring.speed}s`
              return (
                <div key={ni} style={{
                  position:        'absolute',
                  top: '50%',      left: '50%',
                  width: 0,        height: 0,
                  animation:       `d-orb ${dur} linear infinite`,
                  animationDelay:  dly,
                }}>
                  <div style={{
                    position:       'absolute',
                    width:          ring.size,
                    height:         ring.size,
                    borderRadius:   '50%',
                    background:     ring.color,
                    top:           -(ring.size / 2),
                    left:           ring.r - ring.size / 2,
                    boxShadow:     `0 0 ${ring.size * 2.5}px ${ring.color}dd,
                                    0 0 ${ring.size * 5}px   ${ring.color}55`,
                    animation:      `d-ctr ${dur} linear infinite`,
                    animationDelay: dly,
                  }} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Ecosystem health ring ─────────────────────────────────────────────────── //

function HealthRing({ graphData }) {
  const dist = useMemo(() => {
    if (!graphData?.nodes) return null
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const n of graphData.nodes) {
      const l = n.data?.risk_label
      if (l in counts) counts[l]++
    }
    return counts
  }, [graphData])

  if (!dist) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: C.muted, fontSize: 12 }}>
        Loading…
      </div>
    )
  }

  const total = ORDER.reduce((s, k) => s + dist[k], 0)
  const cx = 90, cy = 90, r = 62, sw = 20
  const circ = 2 * Math.PI * r
  const GAP = 3 / 360

  let cum = 0
  const segments = ORDER.map(label => {
    const frac = dist[label] / total
    const seg  = { label, frac, cum, color: RISK_COLORS[label], count: dist[label] }
    cum += frac
    return seg
  })

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: C.muted, textTransform: 'uppercase', marginBottom: 20,
      }}>
        Ecosystem Health
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={180} height={180} style={{ flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map(({ label, frac, cum, color }) => {
              const visible = Math.max(0, frac - GAP) * circ
              const offset  = -cum * circ
              return (
                <circle key={label} cx={cx} cy={cy} r={r}
                  fill="none" stroke={color} strokeWidth={sw}
                  strokeDasharray={`${visible} ${circ}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  style={{ filter: label === 'CRITICAL' ? `drop-shadow(0 0 8px ${color}99)` : 'none' }}
                />
              )
            })}
          </g>
          <text x={cx} y={cy - 8}  textAnchor="middle" fill={C.text}  fontSize={20} fontWeight={800} fontFamily="inherit">{total.toLocaleString()}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily="inherit">packages</text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {segments.map(({ label, color, count }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}88` }} />
              <span style={{ fontSize: 11, color: C.muted, width: 58, letterSpacing: '0.04em' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Leaderboard tile ──────────────────────────────────────────────────────── //

function Tile({ rank, node, onClick }) {
  const { package_name, risk_label, risk_score, blast_radius_count, trend_direction } = node.data
  const rc   = RISK_COLORS[risk_label] ?? C.muted
  const trnd = trend_direction === 'RISING' ? '↑' : trend_direction === 'FALLING' ? '↓' : '→'
  const tc   = trend_direction === 'RISING' ? RISK_COLORS.CRITICAL : trend_direction === 'FALLING' ? RISK_COLORS.LOW : C.muted
  const top3 = rank <= 3

  return (
    <div
      onClick={() => onClick(package_name)}
      style={{
        background:   C.surface,
        border:       `1px solid ${top3 ? rc + '55' : C.border}`,
        borderRadius: 10,
        padding:      '14px 16px',
        cursor:       'pointer',
        position:     'relative',
        overflow:     'hidden',
        transition:   'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
        boxShadow:    rank === 1 ? `0 0 24px ${rc}33, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform   = 'translateY(-2px)'
        e.currentTarget.style.boxShadow   = `0 0 20px ${rc}44, 0 8px 20px rgba(0,0,0,0.5)`
        e.currentTarget.style.borderColor = rc + '99'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform   = 'translateY(0)'
        e.currentTarget.style.boxShadow   = rank === 1 ? `0 0 24px ${rc}33, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)'
        e.currentTarget.style.borderColor = top3 ? rc + '55' : C.border
      }}
    >
      <div style={{
        position: 'absolute', right: 6, top: 2,
        fontSize: 34, fontWeight: 900, lineHeight: 1,
        color: top3 ? rc + '1a' : C.border + '55',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {rank}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, paddingRight: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {package_name}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: rc,
          background: rc + '22', border: `1px solid ${rc}55`,
          borderRadius: 3, padding: '1px 5px',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {risk_label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{risk_score}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: tc, marginLeft: 2 }}>{trnd}</span>
      </div>

      <div style={{ fontSize: 10, color: C.muted }}>
        {(blast_radius_count ?? 0).toLocaleString()} dependents
      </div>
    </div>
  )
}

// ── Home screen ───────────────────────────────────────────────────────────── //

export default function HomeScreen({ indexData, graphData, onSearch, loading }) {
  const leaderboard = useMemo(() => {
    if (!graphData?.nodes) return []
    return [...graphData.nodes]
      .filter(n => (n.data?.blast_radius_count ?? 0) > 0)
      .sort((a, b) => (b.data.blast_radius_count ?? 0) - (a.data.blast_radius_count ?? 0))
      .slice(0, 10)
  }, [graphData])

  const criticalCount = useMemo(() => {
    if (!graphData?.nodes) return '—'
    return graphData.nodes.filter(n => n.data?.risk_label === 'CRITICAL').length
  }, [graphData])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: C.bg }}>

      {/* ── Hero ── */}
      <div style={{
        position:        'relative',
        minHeight:        460,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
        background:      `radial-gradient(ellipse 70% 90% at 50% 50%, #091525 0%, ${C.bg} 68%)`,
        borderBottom:    `1px solid ${C.border}`,
      }}>
        <Orbital />

        <div style={{
          position:      'relative',
          zIndex:         1,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          textAlign:     'center',
          gap:            12,
          padding:       '64px 32px 56px',
        }}>
          <Wordmark size={78} />

          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandName size={14} />
            <span style={{ color: C.border }}>·</span>
            <span style={{ fontSize: 13, color: C.muted, letterSpacing: '0.04em' }}>
              PyPI Ecosystem Intelligence
            </span>
          </div>

          <div style={{ marginTop: 16, width: '100%', maxWidth: 580 }}>
            <SearchBar packages={indexData} onSearch={onSearch} />
          </div>

          {loading && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Loading…</div>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{
        display:      'flex',
        justifyContent:'center',
        background:   C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {[
          { value: '1,000',       label: 'Packages Tracked', color: C.accent           },
          { value: criticalCount, label: 'Critical Risk',     color: RISK_COLORS.CRITICAL },
          { value: 'Daily',       label: 'Data Refresh',      color: RISK_COLORS.LOW    },
        ].map((s, i) => (
          <div key={i} style={{
            flex:        '0 0 220px',
            textAlign:   'center',
            padding:     '22px 0',
            borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{
              fontSize:    26,
              fontWeight:  800,
              color:       s.color,
              lineHeight:  1,
              marginBottom: 6,
              textShadow:  `0 0 20px ${s.color}44`,
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize:      10,
              color:         C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{
        flex:           1,
        display:        'flex',
        justifyContent: 'center',
        padding:        '40px 48px 52px',
      }}>
        <div style={{ width: '100%', maxWidth: 1100, display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          {/* Leaderboard */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display:       'flex',
              alignItems:    'baseline',
              gap:            10,
              marginBottom:  20,
              paddingBottom: 14,
              borderBottom:  `1px solid ${C.border}`,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: C.text,
              }}>
                Blast Radius Leaderboard
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>
                — packages that break the most if they fail
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, padding: '20px 0' }}>Loading…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {leaderboard.map((node, i) => (
                  <Tile key={node.id} rank={i + 1} node={node} onClick={onSearch} />
                ))}
              </div>
            )}
          </div>

          {/* Health ring */}
          <div style={{
            flexShrink:   0,
            width:        260,
            background:   C.surface,
            border:       `1px solid ${C.border}`,
            borderRadius: 12,
            padding:      '24px',
          }}>
            <HealthRing graphData={graphData} />
          </div>

        </div>
      </div>
    </div>
  )
}
