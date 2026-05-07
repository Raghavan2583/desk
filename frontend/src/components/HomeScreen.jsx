import { useMemo } from 'react'
import SearchBar from './SearchBar'
import { RISK_COLORS, C } from '../utils/colors'

const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

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
    const seg = { label, frac, cum, color: RISK_COLORS[label], count: dist[label] }
    cum += frac
    return seg
  })

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: C.muted, textTransform: 'uppercase', marginBottom: 20 }}>
        Ecosystem Health
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={180} height={180} style={{ flexShrink: 0 }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {segments.map(({ label, frac, cum, color }) => {
              const visible = Math.max(0, frac - GAP) * circ
              const offset  = -cum * circ
              return (
                <circle
                  key={label}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={sw}
                  strokeDasharray={`${visible} ${circ}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  style={{ filter: label === 'CRITICAL' ? `drop-shadow(0 0 8px ${color}99)` : 'none' }}
                />
              )
            })}
          </g>
          {/* Centre */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill={C.text} fontSize={20} fontWeight={800} fontFamily="inherit">
            {total.toLocaleString()}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily="inherit">
            packages
          </text>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {segments.map(({ label, color, count }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 9, height: 9, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 5px ${color}88`,
              }} />
              <span style={{ fontSize: 11, color: C.muted, width: 58, letterSpacing: '0.04em' }}>
                {label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Tile({ rank, node, onClick }) {
  const { package_name, risk_label, risk_score, blast_radius_count, trend_direction } = node.data
  const rc    = RISK_COLORS[risk_label] ?? C.muted
  const trend = trend_direction === 'RISING' ? '↑' : trend_direction === 'FALLING' ? '↓' : '→'
  const tc    = trend_direction === 'RISING' ? RISK_COLORS.CRITICAL : trend_direction === 'FALLING' ? RISK_COLORS.LOW : C.muted
  const top3  = rank <= 3

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
        transition:   'transform 0.12s, box-shadow 0.12s',
        boxShadow:    rank === 1 ? `0 0 24px ${rc}33, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform   = 'translateY(-2px)'
        e.currentTarget.style.boxShadow   = `0 0 20px ${rc}44, 0 6px 16px rgba(0,0,0,0.5)`
        e.currentTarget.style.borderColor = rc + '88'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform   = 'translateY(0)'
        e.currentTarget.style.boxShadow   = rank === 1 ? `0 0 24px ${rc}33, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)'
        e.currentTarget.style.borderColor = top3 ? rc + '55' : C.border
      }}
    >
      {/* Rank watermark */}
      <div style={{
        position:      'absolute',
        right:         6,
        top:           2,
        fontSize:      34,
        fontWeight:    900,
        color:         top3 ? rc + '1a' : C.border + '55',
        lineHeight:    1,
        userSelect:    'none',
        pointerEvents: 'none',
      }}>
        {rank}
      </div>

      <div style={{
        fontSize:     12,
        fontWeight:   700,
        color:        C.text,
        marginBottom: 8,
        paddingRight: 28,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {package_name}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: rc,
          background: rc + '22', border: `1px solid ${rc}55`,
          borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {risk_label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{risk_score}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: tc, marginLeft: 2 }}>{trend}</span>
      </div>

      <div style={{ fontSize: 10, color: C.muted }}>
        {(blast_radius_count ?? 0).toLocaleString()} dependents
      </div>
    </div>
  )
}

function StatPill({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

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
    <div style={{
      flex:          1,
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      padding:       '52px 48px 40px',
      overflowY:     'auto',
      background:    `radial-gradient(ellipse 80% 40% at 50% 0%, ${C.accent}0d 0%, transparent 70%)`,
    }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontSize:      58,
          fontWeight:    900,
          color:         C.text,
          letterSpacing: '0.14em',
          lineHeight:    1,
          marginBottom:  12,
          textShadow:    `0 0 60px ${C.accent}55, 0 0 20px ${C.accent}33`,
        }}>
          DESK
        </div>
        <div style={{ fontSize: 13, color: C.muted, letterSpacing: '0.06em', marginBottom: 28 }}>
          Dependency Risk Intelligence — PyPI Ecosystem
        </div>
        <SearchBar packages={indexData} onSearch={onSearch} />
        {loading && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Loading…</div>
        )}
      </div>

      {/* Stats bar */}
      <div style={{
        display:         'flex',
        gap:             48,
        marginBottom:    36,
        padding:         '20px 40px',
        background:      C.surface,
        border:          `1px solid ${C.border}`,
        borderRadius:    12,
      }}>
        <StatPill value="1,000"          label="Packages Tracked" />
        <div style={{ width: 1, background: C.border }} />
        <StatPill value={criticalCount}  label="Critical Risk" />
        <div style={{ width: 1, background: C.border }} />
        <StatPill value="Daily"          label="Data Refresh" />
      </div>

      {/* Body */}
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Leaderboard */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              color: C.muted, textTransform: 'uppercase', marginBottom: 4,
            }}>
              Blast Radius Leaderboard
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              If these packages fail, the most downstream breaks
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 13, padding: '20px 0' }}>Loading data…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {leaderboard.map((node, i) => (
                <Tile key={node.id} rank={i + 1} node={node} onClick={onSearch} />
              ))}
            </div>
          )}
        </div>

        {/* Health Ring */}
        <div style={{
          flexShrink:   0,
          width:        260,
          background:   C.surface,
          border:       `1px solid ${C.border}`,
          borderRadius: 12,
          padding:      '20px 24px',
        }}>
          <HealthRing graphData={graphData} />
        </div>
      </div>
    </div>
  )
}
