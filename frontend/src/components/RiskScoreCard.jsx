import MaintainerCard from './MaintainerCard'
import { RISK_COLORS, TREND_COLORS, ACTIVITY_COLORS, C } from '../utils/colors'

const TREND_ARROW = { RISING: '↑', FALLING: '↓', STABLE: '→' }

function Sparkline({ history, color }) {
  if (!history || history.length < 2) return null
  const values = history.map(d => d.risk_score)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const W = 160, H = 36, pad = 4
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - 2 * pad)
    const y = (H - pad) - ((v - min) / range) * (H - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ display:'block', marginTop:8 }}>
      <polyline points={points} fill="none" stroke={color ?? C.accent} strokeWidth="1.5" strokeLinejoin="round" opacity="0.7" />
    </svg>
  )
}

function cveLink(osv_id) {
  if (osv_id?.startsWith('GHSA-')) return `https://github.com/advisories/${osv_id}`
  return `https://osv.dev/vulnerability/${osv_id}`
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', { month:'short', year:'numeric' })
}

function CveRow({ cve }) {
  const color = RISK_COLORS[cve.severity] ?? C.muted
  return (
    <a href={cveLink(cve.osv_id)} target="_blank" rel="noreferrer"
      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, border:`1px solid ${color}22`, background:`${color}06`, textDecoration:'none', transition:'background 0.12s,border-color 0.12s' }}
      onMouseEnter={e=>{ e.currentTarget.style.background=`${color}10`; e.currentTarget.style.borderColor=`${color}44` }}
      onMouseLeave={e=>{ e.currentTarget.style.background=`${color}06`; e.currentTarget.style.borderColor=`${color}22` }}
    >
      <span style={{ fontSize:9, fontWeight:700, color, background:`${color}22`, border:`1px solid ${color}44`, borderRadius:3, padding:'1px 5px', textTransform:'uppercase', letterSpacing:'0.04em', flexShrink:0, boxShadow:`0 0 5px 1px ${color}33` }}>
        {cve.severity}
      </span>
      <span style={{ fontSize:11, color:C.muted, whiteSpace:'nowrap' }}>{fmtDate(cve.published_at)}</span>
      {cve.fixed_in_version && (
        <span style={{ fontSize:11, color:C.accent, whiteSpace:'nowrap', marginLeft:'auto' }}>✓ {cve.fixed_in_version}</span>
      )}
      <span style={{ fontSize:10, color:C.border, fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110, marginLeft: cve.fixed_in_version ? 0 : 'auto' }}>
        {cve.osv_id}
      </span>
    </a>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
      {children}
    </div>
  )
}

function ChipList({ packages, onNavigate }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
      {packages.map(name => (
        <button key={name} onClick={() => onNavigate(name)}
          style={{ fontSize:11, color:C.accent, background:`${C.accent}14`, border:`1px solid ${C.accent}33`, borderRadius:4, padding:'3px 9px', cursor:'pointer', fontFamily:'inherit', transition:'background 0.12s,border-color 0.12s' }}
          onMouseEnter={e=>{ e.currentTarget.style.background=`${C.accent}28`; e.currentTarget.style.borderColor=`${C.accent}66` }}
          onMouseLeave={e=>{ e.currentTarget.style.background=`${C.accent}14`; e.currentTarget.style.borderColor=`${C.accent}33` }}
        >
          {name}
        </button>
      ))}
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

  const pills = [
    blast_radius_count > 0 && { text:`${blast_radius_count.toLocaleString()} downstream`, color:null },
    direct_dependencies.length > 0 && { text:`${direct_dependencies.length} deps`, color:null },
    cves.length > 0 && { text:`${cves.length} CVEs`, color:RISK_COLORS.MEDIUM },
    maintainer?.activity_label && { text:maintainer.activity_label, color:ACTIVITY_COLORS[maintainer.activity_label]??C.muted },
    maintainer?.days_since_last_commit != null && {
      text: maintainer.days_since_last_commit < 1    ? 'commit today'
          : maintainer.days_since_last_commit < 30   ? `${maintainer.days_since_last_commit}d ago`
          : maintainer.days_since_last_commit < 365  ? `${Math.round(maintainer.days_since_last_commit/30)}mo ago`
          : `${Math.round(maintainer.days_since_last_commit/365)}y ago`,
      color:null,
    },
  ].filter(Boolean)

  const sortedCves = [...cves].sort((a,b) => new Date(b.published_at) - new Date(a.published_at))

  return (
    <div style={{ padding:'20px 24px 32px', display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Row 1: 3-column header — fills entire width ── */}
      <div style={{ display:'flex', alignItems:'stretch', gap:16 }}>

        {/* Col 1: Package info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:22, fontWeight:700, color:C.text }}>{package_name}</span>
            {latest_version && (
              <span style={{ fontSize:11, color:C.muted, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 7px', whiteSpace:'nowrap' }}>
                v{latest_version}
              </span>
            )}
          </div>
          {summary && <div style={{ fontSize:13, color:C.muted, lineHeight:1.5, marginBottom:10 }}>{summary}</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center' }}>
            {pills.map((pill, i) => (
              <span key={i} style={{ fontSize:11, color:pill.color??C.muted, fontWeight:pill.color?700:400, background:pill.color?`${pill.color}18`:'rgba(255,255,255,0.05)', border:pill.color?`1px solid ${pill.color}33`:'1px solid rgba(255,255,255,0.07)', borderRadius:4, padding:'2px 8px' }}>
                {pill.text}
              </span>
            ))}
          </div>
        </div>

        {/* Col 2: Maintainer — fills the middle gap */}
        <div style={{ flexShrink:0, display:'flex', alignItems:'center' }}>
          <MaintainerCard maintainer={maintainer} />
        </div>

        {/* Col 3: Risk score */}
        <div style={{ flexShrink:0, textAlign:'right', background:`linear-gradient(135deg,${riskColor}10 0%,transparent 70%)`, border:`1px solid ${riskColor}33`, borderRadius:12, padding:'14px 18px', boxShadow:`0 0 20px 3px ${riskColor}14`, display:'flex', flexDirection:'column', justifyContent:'center' }}>
          <div style={{ fontSize:10, fontWeight:700, color:riskColor, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>{risk_label}</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:5, justifyContent:'flex-end', marginBottom:6 }}>
            <span style={{ fontSize:44, fontWeight:700, color:riskColor, lineHeight:1, textShadow:`0 0 30px ${riskColor}AA`, fontVariantNumeric:'tabular-nums' }}>{risk_score}</span>
            <span style={{ fontSize:15, color:C.muted }}>/ 10</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
            <span style={{ fontSize:16, fontWeight:700, color:trendColor }}>{trendArrow}</span>
            <span style={{ fontSize:11, color:C.muted }}>{(blast_radius_count??0).toLocaleString()} depend</span>
          </div>
          <Sparkline history={trend_history} color={riskColor} />
        </div>
      </div>

      {/* ── Row 3: CVEs ── */}
      {sortedCves.length > 0 && (
        <div>
          <SectionLabel>{sortedCves.length} {sortedCves.length===1?'Vulnerability':'Vulnerabilities'}</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {sortedCves.map(cve => <CveRow key={cve.osv_id} cve={cve} />)}
          </div>
        </div>
      )}

      {/* ── Row 4: Dependencies side by side ── */}
      {(direct_dependencies.length > 0 || direct_dependents.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {direct_dependencies.length > 0 && (
            <div>
              <SectionLabel>Depends on</SectionLabel>
              <ChipList packages={direct_dependencies} onNavigate={onNavigate} />
            </div>
          )}
          {direct_dependents.length > 0 && (
            <div>
              <SectionLabel>Used by</SectionLabel>
              <ChipList packages={direct_dependents} onNavigate={onNavigate} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
