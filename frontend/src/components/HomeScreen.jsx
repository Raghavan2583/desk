import { useMemo, useRef, useState, useEffect } from 'react'
import SearchBar from './SearchBar'
import { RISK_COLORS, C } from '../utils/colors'

const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const DE_COLOR = '#3FB950'
const SK_COLOR = '#E63946'
const DE_GLOW  = '#3FB95099'
const SK_GLOW  = '#E6394699'

// ── Brand helpers ─────────────────────────────────────────────────────────── //

export function Wordmark({ size = 72 }) {
  return (
    <div style={{ fontSize: size, fontWeight: 900, letterSpacing: '0.16em', lineHeight: 1, display: 'inline-flex' }}>
      <span style={{ color: DE_COLOR, textShadow: `0 0 28px ${DE_GLOW}` }}>D</span>
      <span style={{ color: DE_COLOR, textShadow: `0 0 28px ${DE_GLOW}` }}>E</span>
      <span style={{ color: SK_COLOR, textShadow: `0 0 28px ${SK_GLOW}` }}>S</span>
      <span style={{ color: SK_COLOR, textShadow: `0 0 28px ${SK_GLOW}` }}>K</span>
    </div>
  )
}

export function BrandName({ size = 13 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: '0.02em' }}>
      <span style={{ color: DE_COLOR, fontWeight: 700 }}>DE</span>
      <span style={{ color: C.muted }}>pendency ri</span>
      <span style={{ color: SK_COLOR, fontWeight: 700 }}>SK</span>
    </span>
  )
}

// ── Orbital ───────────────────────────────────────────────────────────────── //

const RINGS = [
  { r: 80,  speed: 18, color: DE_COLOR, nodes: 4, size: 8   },
  { r: 134, speed: 34, color: SK_COLOR, nodes: 6, size: 6   },
  { r: 192, speed: 55, color: DE_COLOR, nodes: 8, size: 4.5 },
]

function Orbital() {
  return (
    <>
      <style>{`
        @keyframes d-orb  { to { transform: rotate(360deg);  } }
        @keyframes d-ctr  { to { transform: rotate(-360deg); } }
        @keyframes d-pls  { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes d-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
        @keyframes aurora-a { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(70px,50px) scale(1.18)} 66%{transform:translate(-40px,25px) scale(0.88)} }
        @keyframes aurora-b { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-55px,-35px) scale(1.12)} 66%{transform:translate(35px,55px) scale(0.93)} }
        @keyframes d-float-a { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-14px)} }
        @keyframes d-float-b { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-20px)} }
        @keyframes d-float-c { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-11px)} }
      `}</style>
      <div style={{ position:'absolute', top:'36%', left:'50%', transform:'translate(-50%,-50%)', width:430, height:430, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle,${DE_COLOR}2a 0%,${SK_COLOR}18 42%,transparent 70%)`, animation:'d-pls 4.5s ease-in-out infinite' }}/>
        {RINGS.map((ring, ri) => (
          <div key={ri}>
            <div style={{ position:'absolute', top:'50%', left:'50%', width:ring.r*2, height:ring.r*2, marginTop:-ring.r, marginLeft:-ring.r, border:`1px solid ${ring.color}38`, borderRadius:'50%', boxShadow:`0 0 12px 1px ${ring.color}18` }}/>
            {Array.from({length:ring.nodes}).map((_,ni)=>{
              const dur=`${ring.speed}s`, dly=`${-(ni/ring.nodes)*ring.speed}s`
              return (
                <div key={ni} style={{ position:'absolute', top:'50%', left:'50%', width:0, height:0, animation:`d-orb ${dur} linear infinite`, animationDelay:dly }}>
                  <div style={{ position:'absolute', width:ring.size, height:ring.size, borderRadius:'50%', background:ring.color, top:-(ring.size/2), left:ring.r-ring.size/2, boxShadow:`0 0 ${ring.size*2.5}px ${ring.color}dd,0 0 ${ring.size*5}px ${ring.color}44`, animation:`d-ctr ${dur} linear infinite`, animationDelay:dly }}/>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Aurora background ─────────────────────────────────────────────────────── //

function AuroraBg() {
  const blob = (style) => (
    <div style={{ position:'absolute', borderRadius:'50%', pointerEvents:'none', ...style }}/>
  )
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
      {blob({ top:'-15%', left:'-8%',   width:780, height:780, background:`radial-gradient(circle, ${DE_COLOR}30 0%, ${DE_COLOR}10 44%, transparent 70%)`, filter:'blur(72px)', animation:'aurora-a 22s ease-in-out infinite' })}
      {blob({ top:'5%',   right:'-12%', width:680, height:680, background:`radial-gradient(circle, ${SK_COLOR}28 0%, ${SK_COLOR}0e 42%, transparent 68%)`, filter:'blur(80px)', animation:'aurora-b 28s ease-in-out infinite' })}
    </div>
  )
}

// ── CLI health ────────────────────────────────────────────────────────────── //

const CLI_DOT = { CRITICAL: SK_COLOR, HIGH: '#FF8C00', MEDIUM: '#FFD700', LOW: DE_COLOR }

function CLIHealth({ graphData }) {
  const dist = useMemo(() => {
    if (!graphData?.nodes) return null
    const counts = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 }
    for (const n of graphData.nodes) { const l=n.data?.risk_label; if(l in counts) counts[l]++ }
    return counts
  }, [graphData])

  return (
    <div style={{ background:'#0F0C0B', border:`1px solid ${SK_COLOR}44`, borderRadius:10, padding:'16px 18px', fontFamily:"'Courier New',Courier,monospace", fontSize:12, boxShadow:`0 0 28px ${SK_COLOR}22,0 4px 20px #00000066` }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>
        {[SK_COLOR,'#FF8C00',DE_COLOR].map((col,i)=>(
          <span key={i} style={{ width:8, height:8, borderRadius:'50%', background:col, display:'inline-block' }}/>
        ))}
        <span style={{ marginLeft:8, color:C.muted, fontSize:10 }}>desk — health</span>
      </div>
      <div style={{ marginBottom:8 }}>
        <span style={{ color:SK_COLOR }}>$</span>
        <span style={{ color:DE_COLOR }}> desk health</span>
      </div>
      <div style={{ color:C.border, marginBottom:8, fontSize:10 }}>────────────────</div>
      {dist ? ORDER.map(label=>(
        <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:CLI_DOT[label], display:'inline-block', boxShadow:`0 0 5px ${CLI_DOT[label]}`, flexShrink:0 }}/>
            <span style={{ color:CLI_DOT[label], fontWeight:700, fontSize:11, letterSpacing:'0.04em' }}>{label}</span>
          </div>
          <span style={{ color:C.text, fontVariantNumeric:'tabular-nums' }}>{dist[label]}</span>
        </div>
      )) : <div style={{ color:C.muted }}>loading...</div>}
      <div style={{ color:C.border, marginTop:8, marginBottom:6, fontSize:10 }}>────────────────</div>
      <div style={{ fontSize:10, color:C.muted }}>refresh: <span style={{ color:C.beige }}>daily · 02:07 UTC</span></div>
    </div>
  )
}

// ── Floating stat cards (replace chess pieces) ────────────────────────────── //

function FloatCard({ value, label, color, floatAnim, mb }) {
  return (
    <div style={{ animation: `${floatAnim} ease-in-out infinite`, marginBottom: mb, flexShrink: 0 }}>
      <div style={{
        background:   `linear-gradient(145deg, ${color}22 0%, ${C.surface} 55%)`,
        border:       `1px solid ${color}77`,
        borderRadius:  18,
        padding:      '22px 30px',
        textAlign:    'center',
        minWidth:      140,
        boxShadow:    `0 0 50px ${color}55, 0 24px 48px #00000088, inset 0 1px 0 ${color}44`,
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize:38, fontWeight:900, color, lineHeight:1, textShadow:`0 0 30px ${color}99`, fontVariantNumeric:'tabular-nums' }}>
          {value}
        </div>
        <div style={{ fontSize:10, color:C.muted, letterSpacing:'0.12em', textTransform:'uppercase', marginTop:9, lineHeight:1.4 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function FloatingCards({ criticalCount }) {
  return (
    <div style={{ position:'absolute', bottom:65, left:0, right:0, display:'flex', justifyContent:'center', alignItems:'flex-end', gap:36, height:210, zIndex:4, pointerEvents:'none' }}>
      {/* Spotlight glow on panel behind cards */}
      <div style={{ position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)', width:640, height:220, background:`radial-gradient(ellipse 65% 75% at 50% 90%, ${SK_COLOR}55 0%, ${DE_COLOR}33 38%, transparent 68%)`, filter:'blur(24px)', pointerEvents:'none' }}/>

      <FloatCard value="1,000"        label="Packages Tracked" color={SK_COLOR}             floatAnim="d-float-a 5.5s" mb={22} />
      <FloatCard value={criticalCount} label="Critical Risk"    color={RISK_COLORS.CRITICAL}  floatAnim="d-float-b 6.8s" mb={52} />
      <FloatCard value="Daily"         label="Data Refresh"     color={DE_COLOR}              floatAnim="d-float-c 5.2s" mb={8}  />
    </div>
  )
}

// ── Leaderboard tile ──────────────────────────────────────────────────────── //

function Tile({ rank, node, onClick }) {
  const { package_name, risk_label, risk_score, blast_radius_count, trend_direction } = node.data
  const rc   = RISK_COLORS[risk_label] ?? C.muted
  const trnd = trend_direction==='RISING'?'↑':trend_direction==='FALLING'?'↓':'→'
  const tc   = trend_direction==='RISING'?RISK_COLORS.CRITICAL:trend_direction==='FALLING'?RISK_COLORS.LOW:C.muted
  const baseGlow  = `0 0 0 1px ${rc}55, 0 0 8px 2px ${rc}44, 0 0 24px 4px ${rc}22, 0 2px 12px rgba(0,0,0,.6)`
  const hoverGlow = `0 0 0 1px ${rc}88, 0 0 14px 3px ${rc}66, 0 0 40px 6px ${rc}33, 0 0 80px 10px ${rc}18, 0 8px 24px rgba(0,0,0,.65)`
  return (
    <div onClick={()=>onClick(package_name)}
      style={{ background:`linear-gradient(145deg,${rc}0d 0%,${C.surface} 58%)`, border:`1px solid ${rc}66`, borderRadius:12, padding:'16px 18px', cursor:'pointer', position:'relative', overflow:'hidden', transition:'transform 0.15s,box-shadow 0.15s,border-color 0.15s', boxShadow:baseGlow }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=hoverGlow; e.currentTarget.style.borderColor=`${rc}99` }}
      onMouseLeave={e=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=baseGlow; e.currentTarget.style.borderColor=`${rc}66` }}
    >
      <div style={{ position:'absolute', right:6, top:2, fontSize:34, fontWeight:900, lineHeight:1, color:`${rc}1a`, userSelect:'none', pointerEvents:'none' }}>{rank}</div>
      <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8, paddingRight:28, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{package_name}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <span style={{ fontSize:9, fontWeight:700, color:rc, background:`${rc}22`, border:`1px solid ${rc}55`, borderRadius:3, padding:'1px 5px', textTransform:'uppercase', letterSpacing:'0.04em' }}>{risk_label}</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{risk_score}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:10, color:C.muted }}>{(blast_radius_count??0).toLocaleString()} dependents</div>
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ fontSize:13, fontWeight:700, color:tc }}>{trnd}</span>
          <span style={{ fontSize:9, fontWeight:700, color:tc, letterSpacing:'0.04em', textTransform:'uppercase' }}>
            {trend_direction==='RISING'?'Rising':trend_direction==='FALLING'?'Falling':'Stable'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Stat pill row ─────────────────────────────────────────────────────────── //

function StatRow({ criticalCount }) {
  const items = [
    { value: '1,000', label: 'packages tracked', color: C.text },
    { value: criticalCount, label: 'critical risk', color: RISK_COLORS.CRITICAL },
    { value: 'Daily', label: 'data refresh', color: DE_COLOR },
  ]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:20 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6, padding:'0 24px' }}>
            <span style={{ fontSize:22, fontWeight:800, color:item.color, fontVariantNumeric:'tabular-nums' }}>{item.value}</span>
            <span style={{ fontSize:11, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' }}>{item.label}</span>
          </div>
          {i < items.length - 1 && (
            <span style={{ color:C.border, fontSize:18, lineHeight:1 }}>·</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Home screen ───────────────────────────────────────────────────────────── //

export default function HomeScreen({ indexData, graphData, onSearch, loading }) {
  const containerRef    = useRef(null)
  const leaderboardRef  = useRef(null)
  const heroContentRef  = useRef(null)
  const [leaderboardVisible, setLeaderboardVisible] = useState(false)
  const [sortBy,            setSortBy]            = useState('blast_radius')

  function handleScroll(e) {
    const p = Math.min(e.currentTarget.scrollTop / (window.innerHeight * 0.65), 1)
    if (heroContentRef.current) {
      heroContentRef.current.style.transform = `scale(${(1 - p * 0.2).toFixed(4)})`
      heroContentRef.current.style.opacity   = Math.max(0, 1 - p * 1.6).toFixed(4)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    const target    = leaderboardRef.current
    if (!container || !target) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setLeaderboardVisible(true) },
      { root: container, threshold: 0.05 },
    )
    obs.observe(target)
    return () => obs.disconnect()
  }, [])

  const leaderboard = useMemo(() => {
    if (!graphData?.nodes) return []
    return [...graphData.nodes]
      .filter(n => (n.data?.blast_radius_count ?? 0) > 0)
      .sort((a, b) =>
        sortBy === 'risk_score'
          ? (b.data.risk_score ?? 0) - (a.data.risk_score ?? 0)
          : (b.data.blast_radius_count ?? 0) - (a.data.blast_radius_count ?? 0)
      )
      .slice(0, 20)
  }, [graphData, sortBy])

  const quickPicks = useMemo(() => {
    if (!graphData?.nodes) return []
    return [...graphData.nodes]
      .filter(n => n.data?.risk_label === 'CRITICAL')
      .sort((a, b) => (b.data.risk_score ?? 0) - (a.data.risk_score ?? 0))
      .slice(0, 4)
      .map(n => n.data.package_name)
  }, [graphData])

  const criticalCount = useMemo(() => {
    if (!graphData?.nodes) return '—'
    return graphData.nodes.filter(n => n.data?.risk_label === 'CRITICAL').length
  }, [graphData])

  return (
    <div ref={containerRef} style={{ flex:1, overflowY:'auto', background:C.bg }} onScroll={handleScroll}>

      {/* ══════════════════════════════════════════
          HERO — sticky, zooms out on scroll
          ══════════════════════════════════════════ */}
      <div style={{ height:'100vh', position:'sticky', top:0, overflow:'hidden', background:'#070B14', zIndex:1 }}>

        {/* Aurora atmosphere */}
        <AuroraBg />

        {/* Orbital */}
        <Orbital />

        {/* ── Content zone: pushed up to make room for floating cards ── */}
        <div ref={heroContentRef} style={{
          position:      'absolute',
          inset:          0,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          textAlign:     'center',
          padding:       '0 48px 260px',
          zIndex:         2,
          gap:            0,
          transformOrigin:'center center',
          willChange:    'transform, opacity',
        }}>
          <Wordmark size={88} />

          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14 }}>
            <BrandName size={13}/>
            <span style={{ color:C.border }}>·</span>
            <span style={{ fontSize:12, color:C.muted, letterSpacing:'0.04em' }}>PyPI Ecosystem Intelligence</span>
          </div>

          <h1 style={{ fontSize:74, fontWeight:900, lineHeight:1.08, letterSpacing:'-0.03em', color:C.text, margin:'28px 0 0', maxWidth:780 }}>
            Every dependency is a bet.{' '}
            <span style={{ color:SK_COLOR, textShadow:`0 0 80px ${SK_GLOW}, 0 0 140px ${SK_GLOW}` }}>Know the odds.</span>
          </h1>

          <p style={{ fontSize:18, color:C.muted, lineHeight:1.65, maxWidth:480, margin:'20px 0 0' }}>
            Map the blast radius across 1,000 PyPI packages.<br/>See what breaks before it does.
          </p>

          {/* Search — gradient border wrapper */}
          <div style={{ marginTop:32, position:'relative', borderRadius:13, padding:1, background:`linear-gradient(135deg, ${DE_COLOR}55, ${SK_COLOR}55, #8B5CF655)` }}>
            <div style={{ borderRadius:12, overflow:'hidden' }}>
              <SearchBar packages={indexData} onSearch={onSearch}/>
            </div>
          </div>

          {quickPicks.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14 }}>
              <span style={{ fontSize:11, color:C.muted, letterSpacing:'0.04em', flexShrink:0 }}>Try:</span>
              {quickPicks.map(name => (
                <button key={name} onClick={() => onSearch(name)}
                  style={{ fontSize:12, color:RISK_COLORS.CRITICAL, background:`${RISK_COLORS.CRITICAL}14`, border:`1px solid ${RISK_COLORS.CRITICAL}33`, borderRadius:6, padding:'4px 12px', cursor:'pointer', fontFamily:'inherit', fontWeight:600, transition:'background 0.12s,border-color 0.12s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background=`${RISK_COLORS.CRITICAL}28`; e.currentTarget.style.borderColor=`${RISK_COLORS.CRITICAL}66` }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=`${RISK_COLORS.CRITICAL}14`; e.currentTarget.style.borderColor=`${RISK_COLORS.CRITICAL}33` }}
                >{name}</button>
              ))}
            </div>
          )}

          {loading && <div style={{ fontSize:12, color:C.muted, marginTop:10 }}>Loading…</div>}
        </div>

        {/* ── Floating stat cards at bottom ── */}
        <FloatingCards criticalCount={criticalCount} />

        {/* ── Scroll hint ── */}
        <div style={{ position:'absolute', bottom:22, left:0, right:0, display:'flex', justifyContent:'center', zIndex:5, pointerEvents:'none' }}>
          <span style={{ fontSize:18, color:'#fff', animation:'d-bounce 2.2s ease-in-out infinite', textShadow:'0 0 8px #FF4444, 0 0 18px #FF444488, 0 0 36px #FF444433' }}>↓</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          LEADERBOARD — exact replica of reference
          dark navy bg + blue-purple ambient glow
          ══════════════════════════════════════════ */}
      <div ref={leaderboardRef} style={{ position:'relative', zIndex:2, background:'#070B14', padding:'72px 72px 88px', transform:leaderboardVisible?'translateY(0)':'translateY(60px)', opacity:leaderboardVisible?1:0, transition:'transform 0.85s cubic-bezier(0.16,1,0.3,1),opacity 0.7s ease' }}>

        {/* Floating window */}
        <div style={{ position:'relative', zIndex:1, maxWidth:1140, margin:'0 auto', background:'#13131E', borderRadius:14, border:'1px solid rgba(255,255,255,0.09)', boxShadow:'0 36px 100px rgba(0,0,0,0.88), 0 0 0 3px #0D1117, 0 0 0 5px rgba(110,80,220,0.70), 0 0 20px 6px rgba(100,70,210,0.55), 0 0 50px 12px rgba(90,60,200,0.30), 0 0 100px 22px rgba(80,50,190,0.15), 0 0 200px 40px rgba(70,45,180,0.07)', overflow:'hidden' }}>

          {/* Title bar */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 20px', background:'linear-gradient(90deg,#1A1A2E 0%,#16162A 100%)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            {/* Title + subtitle */}
            <div style={{ display:'flex', alignItems:'baseline', gap:10, minWidth:0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:sortBy==='blast_radius' ? '#FF2D9A' : '#E63946', letterSpacing:'0.04em', transition:'color 0.2s', textShadow: sortBy==='blast_radius' ? '0 0 18px #FF2D9A66' : '0 0 18px #E6394666', whiteSpace:'nowrap' }}>
                {sortBy === 'blast_radius' ? 'Blast Radius Leaderboard' : 'Risk Score Leaderboard'}
              </span>
              <span style={{ fontSize:11, color:'rgba(160,140,255,0.55)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {sortBy === 'blast_radius' ? '— packages that break the most if they fail' : '— packages with the highest risk scores'}
              </span>
            </div>

            {/* Sort toggle — segmented pill */}
            <div style={{ marginLeft:'auto', display:'flex', flexShrink:0, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:3, gap:2 }}>
              {[
                { mode:'blast_radius', label:'Blast Radius', color:'#FF2D9A' },
                { mode:'risk_score',   label:'Risk Score',   color:'#E63946' },
              ].map(({ mode, label, color }) => {
                const active = sortBy === mode
                return (
                  <button key={mode} onClick={() => setSortBy(mode)}
                    style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', fontFamily:'inherit', cursor:'pointer', borderRadius:6, padding:'5px 14px', transition:'all 0.18s',
                      color:      active ? color              : 'rgba(255,255,255,0.45)',
                      background: active ? `${color}22`       : 'transparent',
                      border:     active ? `1px solid ${color}55` : '1px solid transparent',
                      boxShadow:  active ? `0 0 14px 3px ${color}44, inset 0 0 8px ${color}18` : 'none',
                    }}
                  >{label}</button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding:'22px 26px 30px' }}>
            {leaderboard.length===0 ? (
              <div style={{ color:C.muted, fontSize:13 }}>Loading…</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {leaderboard.map((node,i)=>(
                  <Tile key={node.id} rank={i+1} node={node} onClick={onSearch}/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
