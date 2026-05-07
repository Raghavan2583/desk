import MaintainerCard from './MaintainerCard'
import { RISK_COLORS, TREND_COLORS, ACTIVITY_COLORS, C } from '../utils/colors'

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

function cveLink(osv_id) {
  if (osv_id?.startsWith('GHSA-')) return `https://github.com/advisories/${osv_id}`
  return `https://osv.dev/vulnerability/${osv_id}`
}

function fmtDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function CveRow({ cve }) {
  const color    = RISK_COLORS[cve.severity] ?? C.muted
  const date     = fmtDate(cve.published_at)
  const href     = cveLink(cve.osv_id)

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        padding:        '7px 0',
        borderBottom:   `1px solid ${C.border}`,
        textDecoration: 'none',
        cursor:         'pointer',
      }}
    >
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
        flexShrink:   0,
      }}>
        {cve.severity}
      </span>

      {date && (
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{date}</span>
      )}

      {cve.fixed_in_version && (
        <span style={{ fontSize: 11, color: C.accent, whiteSpace: 'nowrap' }}>
          · fixed {cve.fixed_in_version}
        </span>
      )}

      <span style={{
        fontSize:    10,
        color:       C.border,
        fontFamily:  'monospace',
        marginLeft:  'auto',
        whiteSpace:  'nowrap',
        overflow:    'hidden',
        textOverflow:'ellipsis',
        maxWidth:    120,
      }}>
        {cve.osv_id}
      </span>

      <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>↗</span>
    </a>
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

      {/* TL;DR snapshot */}
      <div style={{
        display:      'flex',
        flexWrap:     'wrap',
        gap:          6,
        padding:      '10px 12px',
        background:   C.bg,
        borderRadius: 8,
        border:       `1px solid ${C.border}`,
      }}>
        {[
          blast_radius_count > 0 && `${blast_radius_count.toLocaleString()} downstream`,
          direct_dependencies.length > 0 && `${direct_dependencies.length} deps`,
          cves.length > 0 && `${cves.length} CVE${cves.length > 1 ? 's' : ''}`,
          maintainer?.activity_label && maintainer.activity_label,
          maintainer?.days_since_last_commit != null && (
            maintainer.days_since_last_commit < 1    ? 'commit today'
            : maintainer.days_since_last_commit < 30 ? `commit ${maintainer.days_since_last_commit}d ago`
            : maintainer.days_since_last_commit < 365 ? `commit ${Math.round(maintainer.days_since_last_commit / 30)}mo ago`
            : `commit ${Math.round(maintainer.days_since_last_commit / 365)}y ago`
          ),
        ].filter(Boolean).map((item, i, arr) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize:  11,
              color:     item === maintainer?.activity_label
                           ? (ACTIVITY_COLORS[item] ?? C.muted)
                           : C.muted,
              fontWeight: item === maintainer?.activity_label ? 700 : 400,
            }}>
              {item}
            </span>
            {i < arr.length - 1 && (
              <span style={{ fontSize: 10, color: C.border }}>·</span>
            )}
          </span>
        ))}
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
          {[...cves].sort((a, b) => new Date(a.published_at) - new Date(b.published_at)).map(cve => <CveRow key={cve.osv_id} cve={cve} />)}
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
