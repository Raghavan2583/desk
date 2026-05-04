import MaintainerCard from './MaintainerCard'
import { RISK_COLORS, TREND_COLORS, C } from '../utils/colors'

const TREND_ARROW = { RISING: '↑', FALLING: '↓', STABLE: '→' }

function Sparkline({ history }) {
  if (!history || history.length < 2) return null
  const values = history.map(d => d.risk_score)
  const min    = Math.min(...values)
  const max    = Math.max(...values)
  const range  = max - min || 1
  const W = 200, H = 40, pad = 6

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - 2 * pad)
    const y = (H - pad) - ((v - min) / range) * (H - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
        12-month trend
      </div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke={C.accent}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function CveRow({ cve }) {
  const color = RISK_COLORS[cve.severity] ?? C.muted
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        8,
      padding:    '6px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{
        fontSize:     10,
        fontWeight:   700,
        color,
        textTransform:'uppercase',
        background:   color + '22',
        border:       `1px solid ${color}44`,
        borderRadius: 3,
        padding:      '1px 5px',
        whiteSpace:   'nowrap',
      }}>
        {cve.severity}
      </span>
      <span style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace' }}>
        {cve.osv_id}
      </span>
      {cve.fixed_in_version && (
        <span style={{ fontSize: 11, color: C.accent, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          fixed {cve.fixed_in_version}
        </span>
      )}
    </div>
  )
}

export default function RiskScoreCard({ packageData, onNavigate }) {
  if (!packageData) return null

  const {
    package_name, latest_version, summary,
    risk_score, risk_label, trend_direction,
    blast_radius_count, maintainer, cves = [],
    trend_history = [], direct_dependencies = [],
    direct_dependents = [],
  } = packageData

  const riskColor  = RISK_COLORS[risk_label] ?? C.muted
  const trendColor = TREND_COLORS[trend_direction] ?? C.muted
  const trendArrow = TREND_ARROW[trend_direction] ?? '→'

  return (
    <div style={{
      height:        '100%',
      overflowY:     'auto',
      padding:       '24px 20px',
      display:       'flex',
      flexDirection: 'column',
      gap:           20,
      borderLeft:    `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          {package_name}
        </div>
        {latest_version && (
          <div style={{ fontSize: 12, color: C.muted }}>v{latest_version}</div>
        )}
        {summary && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            {summary}
          </div>
        )}
      </div>

      {/* Risk score block */}
      <div>
        <div style={{
          fontSize:     14,
          fontWeight:   700,
          color:        riskColor,
          textTransform:'uppercase',
          letterSpacing:'0.08em',
          marginBottom: 4,
        }}>
          {risk_label}
        </div>
        <div style={{
          fontFamily: "'Inter Tight', 'Inter', monospace",
          fontSize:   32,
          fontWeight: 700,
          color:      C.text,
          lineHeight: 1,
          marginBottom: 8,
        }}>
          {risk_score} <span style={{ fontSize: 16, color: C.muted, fontWeight: 400 }}>/ 10</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: trendColor }}>
            {trendArrow}
          </span>
          <span style={{ fontSize: 13, color: C.muted }}>
            {(blast_radius_count ?? 0).toLocaleString()} packages depend on this
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline history={trend_history} />

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Maintainer */}
      <MaintainerCard maintainer={maintainer} />

      {/* CVEs */}
      {cves.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        marginBottom: 8 }}>
            {cves.length} {cves.length === 1 ? 'Vulnerability' : 'Vulnerabilities'}
          </div>
          {cves.map(cve => <CveRow key={cve.osv_id} cve={cve} />)}
        </div>
      )}

      {/* Dependencies */}
      {direct_dependencies.length > 0 && (
        <PackageList
          title="Depends on"
          packages={direct_dependencies}
          onNavigate={onNavigate}
        />
      )}
      {direct_dependents.length > 0 && (
        <PackageList
          title="Used by"
          packages={direct_dependents}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

function PackageList({ title, packages, onNavigate }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {packages.map(name => (
          <button
            key={name}
            onClick={() => onNavigate(name)}
            style={{
              fontSize:     12,
              color:        C.accent,
              background:   C.accent + '18',
              border:       `1px solid ${C.accent}44`,
              borderRadius: 4,
              padding:      '3px 8px',
              cursor:       'pointer',
              fontFamily:   'inherit',
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
