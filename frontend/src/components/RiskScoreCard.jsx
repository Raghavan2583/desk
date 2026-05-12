import { useState } from 'react'
import MaintainerCard from './MaintainerCard'
import Tooltip from './Tooltip'
import { RISK_COLORS, TREND_COLORS, ACTIVITY_COLORS, C } from '../utils/colors'

const TREND_ARROW = { RISING: '↑', FALLING: '↓', STABLE: '→' }

const SCORE_FACTORS = [
  { label:'Vulnerabilities',   weight:'50%', color:RISK_COLORS.CRITICAL, desc:'Known security flaws (CVEs) weighted by severity. Unpatched critical CVEs carry the most weight. A single unpatched critical CVE can push a package to CRITICAL risk.' },
  { label:'Maintainer Health', weight:'20%', color:RISK_COLORS.HIGH,     desc:'How recently the maintainer has released code updates. Packages with no commits in 2+ years are treated as potentially abandoned and score highest risk.' },
  { label:'Blast Radius',      weight:'20%', color:'#00D4FF',            desc:'How many other packages depend on this one. A widely-used package that goes bad affects a much larger part of the ecosystem.' },
  { label:'Trend',             weight:'10%', color:RISK_COLORS.LOW,      desc:'Whether the risk score has been rising, falling, or holding steady over the past 12 months. A consistently rising score signals a package that is getting harder to trust.' },
]

function ScoreModal({ onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:9998, backdropFilter:'blur(3px)' }}/>
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:9999, background:'#13131E', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'28px 32px', width:440, boxShadow:'0 24px 64px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:15, fontWeight:700, color:C.text }}>How DESK calculates risk</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:20, lineHeight:1, padding:0, fontFamily:'inherit' }}>×</button>
        </div>
        <p style={{ fontSize:12, color:C.muted, lineHeight:1.65, marginBottom:22, margin:'0 0 22px' }}>
          Each package gets a score from 0–10. Four factors contribute, each weighted by how much it actually predicts real-world risk.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {SCORE_FACTORS.map(f => (
            <div key={f.label} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <div style={{ flexShrink:0, width:8, height:8, borderRadius:'50%', background:f.color, marginTop:4, boxShadow:`0 0 6px 2px ${f.color}88` }}/>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{f.label}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:f.color }}>{f.weight}</span>
                </div>
                <p style={{ fontSize:11, color:C.muted, lineHeight:1.6, margin:0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function getPrimaryRiskDriver({ cves = [], maintainer, trend_direction, trend_history = [], blast_radius_count, risk_label }) {
  const criticalCves = cves.filter(c => c.severity === 'CRITICAL')
  const highCves     = cves.filter(c => c.severity === 'HIGH')

  if (criticalCves.length > 0) {
    const sv       = safeVersion(cves)
    const fixable  = cves.filter(c => c.fixed_in_version).length
    const leftover = cves.length - fixable
    if (sv && fixable > 0) {
      return leftover > 0
        ? { label:'UPGRADE', text:`Upgrade to v${sv} — fixes ${fixable} of ${cves.length} CVEs · ${leftover} have no patch yet` }
        : { label:'UPGRADE', text:`Upgrade to v${sv} — fixes all ${cves.length} CVEs including ${criticalCves.length} critical` }
    }
    const unpatchedCrit = criticalCves.filter(c => !c.fixed_in_version).length
    return unpatchedCrit > 0
      ? { label:'CRITICAL', text:`${unpatchedCrit} critical ${unpatchedCrit === 1 ? 'vulnerability' : 'vulnerabilities'} — no patch released yet` }
      : { label:'CRITICAL', text:`${criticalCves.length} critical ${criticalCves.length === 1 ? 'vulnerability' : 'vulnerabilities'} — upgrade recommended` }
  }

  if (maintainer?.activity_label === 'ABANDONED') {
    if (maintainer.days_since_last_commit) {
      const years  = Math.floor(maintainer.days_since_last_commit / 365)
      const months = Math.floor((maintainer.days_since_last_commit % 365) / 30)
      const time   = years >= 1 ? `${years}+ year${years > 1 ? 's' : ''}` : `${months}+ months`
      return { label:'ABANDONED', text:`No code updates in ${time} — this package may no longer be maintained` }
    }
    return { label:'ABANDONED', text:'No active maintainer detected — this package may no longer be maintained' }
  }

  if (maintainer?.activity_label === 'STALE' && (risk_label === 'CRITICAL' || risk_label === 'HIGH')) {
    const months = maintainer.days_since_last_commit ? Math.floor(maintainer.days_since_last_commit / 30) : null
    return months
      ? { label:'STALE', text:`No code updates in ${months}+ months — development has stalled` }
      : { label:'STALE', text:'Development has stalled' }
  }

  if (highCves.length > 0 || cves.length > 0) {
    const sv       = safeVersion(cves)
    const fixable  = cves.filter(c => c.fixed_in_version).length
    const leftover = cves.length - fixable
    if (sv && fixable > 0) {
      return leftover > 0
        ? { label:'UPGRADE', text:`Upgrade to v${sv} — fixes ${fixable} of ${cves.length} CVEs · ${leftover} have no patch yet` }
        : { label:'UPGRADE', text:`Upgrade to v${sv} — fixes all ${cves.length} CVEs` }
    }
    return { label:'MONITOR', text:`${cves.length} ${cves.length === 1 ? 'vulnerability' : 'vulnerabilities'} — no patches available yet` }
  }

  if (trend_direction === 'RISING' && trend_history.length >= 3) {
    const oldest = trend_history[0]?.risk_score
    const newest = trend_history[trend_history.length - 1]?.risk_score
    if (oldest != null && newest != null && newest > oldest) {
      const delta = (newest - oldest).toFixed(1)
      return { label:'RISING', text:`Risk score has climbed ${delta} points over the past ${trend_history.length} months` }
    }
  }

  if (blast_radius_count > 1000 && (risk_label === 'CRITICAL' || risk_label === 'HIGH')) {
    return { label:'EXPOSURE', text:`${blast_radius_count.toLocaleString()} packages depend on this — a security issue here would spread widely` }
  }

  return null
}

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

function compareSemver(a, b) {
  const pa = (a || '').split('.').map(Number)
  const pb = (b || '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

function safeVersion(cves) {
  return cves
    .map(c => c.fixed_in_version)
    .filter(Boolean)
    .reduce((best, v) => (best === null || compareSemver(v, best) > 0) ? v : best, null)
}

function CveRow({ cve }) {
  const color     = RISK_COLORS[cve.severity] ?? C.muted
  const isPatched = !!cve.fixed_in_version
  const fixColor  = isPatched ? '#3FB950' : RISK_COLORS.CRITICAL
  return (
    <a href={cveLink(cve.osv_id)} target="_blank" rel="noreferrer"
      style={{ display:'flex', flexDirection:'column', gap:5, padding:'9px 11px', borderRadius:7, border:`1px solid ${color}22`, background:`${color}06`, textDecoration:'none', transition:'background 0.12s,border-color 0.12s' }}
      onMouseEnter={e=>{ e.currentTarget.style.background=`${color}10`; e.currentTarget.style.borderColor=`${color}44` }}
      onMouseLeave={e=>{ e.currentTarget.style.background=`${color}06`; e.currentTarget.style.borderColor=`${color}22` }}
    >
      {/* Line 1 — CVE ID + severity */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
        <span style={{ fontSize:10, color:C.text, fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>
          {cve.osv_id}
        </span>
        <span style={{ fontSize:9, fontWeight:700, color, background:`${color}22`, border:`1px solid ${color}44`, borderRadius:3, padding:'1px 5px', textTransform:'uppercase', letterSpacing:'0.04em', flexShrink:0, boxShadow:`0 0 5px 1px ${color}33` }}>
          {cve.severity}
        </span>
      </div>
      {/* Line 2 — fix version (prominent) + date */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
        <span style={{ fontSize:12, fontWeight:700, color:fixColor, whiteSpace:'nowrap', letterSpacing:'0.01em' }}>
          {isPatched ? `→ Fixed in v${cve.fixed_in_version}` : 'No fix available'}
        </span>
        <span style={{ fontSize:10, color:C.muted, whiteSpace:'nowrap', flexShrink:0 }}>{fmtDate(cve.published_at)}</span>
      </div>
    </a>
  )
}

function SectionLabel({ children, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
      {color && <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block', boxShadow:`0 0 6px 2px ${color}88`, flexShrink:0 }}/>}
      <span style={{ fontSize:10, fontWeight:700, color: color ?? C.muted, textTransform:'uppercase', letterSpacing:'0.1em', textShadow: color ? `0 0 10px ${color}66` : 'none' }}>
        {children}
      </span>
    </div>
  )
}

function ChipList({ packages, onNavigate, color }) {
  const c = color ?? C.accent
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
      {packages.map(name => (
        <button key={name} onClick={() => onNavigate(name)}
          style={{ fontSize:11, color:c, background:`${c}18`, border:`1px solid ${c}44`, borderRadius:5, padding:'3px 10px', cursor:'pointer', fontFamily:'inherit', fontWeight:600, transition:'background 0.12s,border-color 0.12s,box-shadow 0.12s' }}
          onMouseEnter={e=>{ e.currentTarget.style.background=`${c}30`; e.currentTarget.style.borderColor=`${c}88`; e.currentTarget.style.boxShadow=`0 0 8px 1px ${c}44` }}
          onMouseLeave={e=>{ e.currentTarget.style.background=`${c}18`; e.currentTarget.style.borderColor=`${c}44`; e.currentTarget.style.boxShadow='none' }}
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

  const [showModal, setShowModal] = useState(false)
  const riskColor  = RISK_COLORS[risk_label] ?? C.muted
  const trendColor = TREND_COLORS[trend_direction] ?? C.muted
  const trendArrow = TREND_ARROW[trend_direction] ?? '→'
  const riskDriver = getPrimaryRiskDriver({ cves, maintainer, trend_direction, trend_history, blast_radius_count, risk_label })

  const commitColor = maintainer?.days_since_last_commit == null ? C.muted
    : maintainer.days_since_last_commit < 30  ? '#3FB950'
    : maintainer.days_since_last_commit < 365 ? '#FFD700'
    : RISK_COLORS.HIGH

  const pills = [
    blast_radius_count > 0 && { text:`${blast_radius_count.toLocaleString()} downstream`, color:'#FF2D9A', tooltip:`${blast_radius_count.toLocaleString()} other packages depend on this one. If it fails or is compromised, all of them are potentially affected.` },
    direct_dependencies.length > 0 && { text:`${direct_dependencies.length} deps`, color:'#00D4FF', tooltip:`This package relies on ${direct_dependencies.length} other librar${direct_dependencies.length===1?'y':'ies'} to function.` },
    cves.length > 0 && { text:`${cves.length} CVEs`, color:RISK_COLORS.MEDIUM, tooltip:`${cves.length} Common Vulnerabilit${cves.length===1?'y':'ies'} and Exposure${cves.length===1?'':'s'} — publicly known security flaws found in this package.` },
    maintainer?.activity_label && { text:maintainer.activity_label, color:ACTIVITY_COLORS[maintainer.activity_label]??C.muted, tooltip:'How actively this package is being maintained. ABANDONED means no code updates in 2+ years.' },
    maintainer?.days_since_last_commit != null && {
      text: maintainer.days_since_last_commit < 1    ? 'commit today'
          : maintainer.days_since_last_commit < 30   ? `${maintainer.days_since_last_commit}d ago`
          : maintainer.days_since_last_commit < 365  ? `${Math.round(maintainer.days_since_last_commit/30)}mo ago`
          : `${Math.round(maintainer.days_since_last_commit/365)}y ago`,
      color: commitColor,
      tooltip:'Time since the maintainer last published a code update.',
    },
  ].filter(Boolean)

  const sortedCves    = [...cves].sort((a,b) => new Date(b.published_at) - new Date(a.published_at))
  const patchedCves   = sortedCves.filter(c =>  c.fixed_in_version)
  const unpatchedCves = sortedCves.filter(c => !c.fixed_in_version)
  const sv            = safeVersion(cves)

  return (
    <div style={{ padding:'20px 24px 32px', display:'flex', flexDirection:'column', gap:20 }}>

      <style>{`@keyframes white-breathe{0%,100%{box-shadow:0 0 10px 2px rgba(255,255,255,0.10),0 0 24px 4px rgba(255,255,255,0.05)}50%{box-shadow:0 0 22px 7px rgba(255,255,255,0.22),0 0 44px 12px rgba(255,255,255,0.09)}}`}</style>

      {/* ── Risk driver ── */}
      {riskDriver && (
        <div style={{ padding:'11px 16px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:9, display:'flex', alignItems:'center', gap:12, animation:'white-breathe 2.8s ease-in-out infinite' }}>
          <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.30)', borderRadius:4, padding:'3px 8px', textTransform:'uppercase', letterSpacing:'0.1em', flexShrink:0, boxShadow:'0 0 8px 2px rgba(255,255,255,0.18)' }}>
            {riskDriver.label}
          </span>
          <span style={{ fontSize:13, fontWeight:600, color:'#fff', letterSpacing:'0.02em', lineHeight:1.4 }}>{riskDriver.text}</span>
        </div>
      )}

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
              <Tooltip key={i} text={pill.tooltip}>
                <span style={{ fontSize:11, color:pill.color??C.muted, fontWeight:pill.color?700:400, background:pill.color?`${pill.color}18`:'rgba(255,255,255,0.05)', border:pill.color?`1px solid ${pill.color}33`:'1px solid rgba(255,255,255,0.07)', borderRadius:4, padding:'2px 8px', cursor:'default' }}>
                  {pill.text}
                </span>
              </Tooltip>
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
          <button onClick={() => setShowModal(true)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:10, padding:'6px 0 0', textAlign:'right', textDecoration:'underline', fontFamily:'inherit', letterSpacing:'0.03em', display:'block', width:'100%' }}>
            How is this scored?
          </button>
        </div>
      </div>

      {showModal && <ScoreModal onClose={() => setShowModal(false)} />}

      {/* ── Row 3: Dependencies side by side — above CVEs ── */}
      {(direct_dependencies.length > 0 || direct_dependents.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {direct_dependencies.length > 0 && (
            <div>
              <SectionLabel color="#00D4FF">Depends on</SectionLabel>
              <ChipList packages={direct_dependencies} onNavigate={onNavigate} color="#00D4FF" />
            </div>
          )}
          {direct_dependents.length > 0 && (
            <div>
              <SectionLabel color="#FF2D9A">Used by</SectionLabel>
              <ChipList packages={direct_dependents} onNavigate={onNavigate} color="#FF2D9A" />
            </div>
          )}
        </div>
      )}

      {/* ── Row 4: CVEs ── */}
      {sortedCves.length > 0 && (
        <div>
          {/* Breathing safe-version badge */}
          {sv && patchedCves.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:9, marginBottom:14, animation:'white-breathe 2.8s ease-in-out infinite' }}>
              <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.30)', borderRadius:4, padding:'3px 8px', textTransform:'uppercase', letterSpacing:'0.1em', flexShrink:0, boxShadow:'0 0 8px 2px rgba(255,255,255,0.18)' }}>SAFE VERSION</span>
              <span style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'0.02em' }}>v{sv}+</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginLeft:2 }}>
                {patchedCves.length === sortedCves.length
                  ? `fixes all ${sortedCves.length} CVEs`
                  : `fixes ${patchedCves.length} of ${sortedCves.length} CVEs`}
              </span>
            </div>
          )}

          {/* Section label */}
          <div style={{ marginBottom:10 }}>
            <SectionLabel>{sortedCves.length} {sortedCves.length===1?'Vulnerability':'Vulnerabilities'}</SectionLabel>
          </div>

          {/* Patched CVEs */}
          {patchedCves.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom: unpatchedCves.length > 0 ? 12 : 0 }}>
              {patchedCves.map(cve => <CveRow key={cve.osv_id} cve={cve} />)}
            </div>
          )}

          {/* Unpatched divider + rows */}
          {unpatchedCves.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0 8px' }}>
                <span style={{ flex:1, height:1, background:`${RISK_COLORS.CRITICAL}22` }}/>
                <span style={{ fontSize:9, fontWeight:700, color:RISK_COLORS.CRITICAL, textTransform:'uppercase', letterSpacing:'0.08em', flexShrink:0 }}>no patch released</span>
                <span style={{ flex:1, height:1, background:`${RISK_COLORS.CRITICAL}22` }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {unpatchedCves.map(cve => <CveRow key={cve.osv_id} cve={cve} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
