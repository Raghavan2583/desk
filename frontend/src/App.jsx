import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider } from 'reactflow'
import SearchBar     from './components/SearchBar'
import GraphCanvas   from './components/GraphCanvas'
import RiskScoreCard from './components/RiskScoreCard'
import HomeScreen, { Wordmark } from './components/HomeScreen'
import { RISK_COLORS, C } from './utils/colors'

export default function App() {
  const [indexData,        setIndexData]        = useState([])
  const [graphData,        setGraphData]        = useState(null)
  const [packageData,      setPackageData]      = useState(null)
  const [focusedPackage,   setFocusedPackage]   = useState(null)
  const [expandedPackages, setExpandedPackages] = useState(new Set())
  const [loading,          setLoading]          = useState(false)
  const [history,          setHistory]          = useState([])
  const [copied,           setCopied]           = useState(false)

  const graphCache    = useRef(null)
  const graphContentRef = useRef(null)

  useEffect(() => {
    fetch('/data/index.json')
      .then(r => r.json())
      .then(d => setIndexData(d.packages ?? []))
      .catch(err => console.error('index.json load failed:', err))
    loadGraph().then(g => setGraphData(g)).catch(() => {})

    const pkg = new URLSearchParams(window.location.search).get('pkg')
    if (pkg) handleSearch(pkg)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusedPackage) {
      window.history.replaceState(null, '', `?pkg=${encodeURIComponent(focusedPackage)}`)
    } else {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [focusedPackage])

  async function loadGraph() {
    if (graphCache.current) return graphCache.current
    const r = await fetch('/data/graph.json')
    const d = await r.json()
    graphCache.current = d
    return d
  }

  async function loadPackage(name) {
    const r = await fetch(`/data/package/${name}.json`)
    if (!r.ok) throw new Error(`package not found: ${name}`)
    return r.json()
  }

  const handleSearch = useCallback(async (packageName) => {
    setLoading(true)
    setHistory([])
    // Reset graph zoom when switching packages
    if (graphContentRef.current) {
      graphContentRef.current.style.transform = 'scale(1)'
      graphContentRef.current.style.opacity   = '1'
    }
    try {
      const [graph, pkg] = await Promise.all([loadGraph(), loadPackage(packageName)])
      setGraphData(graph)
      setPackageData(pkg)
      setFocusedPackage(packageName)
      setExpandedPackages(new Set())
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleNodeClick = useCallback(async (packageName) => {
    if (packageName === focusedPackage) return
    setLoading(true)
    if (graphContentRef.current) {
      graphContentRef.current.style.transform = 'scale(1)'
      graphContentRef.current.style.opacity   = '1'
    }
    try {
      const pkg = await loadPackage(packageName)
      setHistory(prev => [...prev, { name: focusedPackage, data: packageData }])
      setPackageData(pkg)
      setExpandedPackages(new Set())
      setFocusedPackage(packageName)
    } catch (err) {
      console.error('Node click failed:', err)
    } finally {
      setLoading(false)
    }
  }, [focusedPackage, packageData])

  const handleBack = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setPackageData(prev.data)
    setFocusedPackage(prev.name)
    setExpandedPackages(new Set())
  }, [history])

  const handleNavigate = useCallback((packageName) => {
    handleSearch(packageName)
  }, [handleSearch])

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Scroll handler — graph zooms out as risk panel rises (same mechanic as home page)
  function handleExploreScroll(e) {
    const p = Math.min(e.currentTarget.scrollTop / (window.innerHeight * 0.65), 1)
    if (graphContentRef.current) {
      graphContentRef.current.style.transform = `scale(${(1 - p * 0.2).toFixed(4)})`
      graphContentRef.current.style.opacity   = Math.max(0, 1 - p * 1.6).toFixed(4)
    }
  }

  const isExploring = focusedPackage !== null

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background: isExploring ? '#0D1117' : C.bg }}>

      {/* ── Top bar ── */}
      {isExploring && (
        <div style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#0D1117', flexShrink:0 }}>
          <div onClick={() => { setFocusedPackage(null); setHistory([]); if (graphContentRef.current) { graphContentRef.current.style.transform='scale(1)'; graphContentRef.current.style.opacity='1' } }} style={{ cursor:'pointer', lineHeight:1, flexShrink:0 }}>
            <Wordmark size={20} />
          </div>

          {focusedPackage && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'rgba(255,255,255,0.18)', fontSize:16 }}>/</span>
              <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{focusedPackage}</span>
              {packageData?.latest_version && (
                <span style={{ fontSize:11, color:C.muted, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 7px' }}>
                  v{packageData.latest_version}
                </span>
              )}
              {packageData?.risk_label && (() => {
                const rc = RISK_COLORS[packageData.risk_label] ?? C.muted
                return (
                  <span style={{ fontSize:11, fontWeight:700, color:rc, background:`${rc}22`, border:`1px solid ${rc}44`, borderRadius:4, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.05em', boxShadow:`0 0 6px 1px ${rc}33` }}>
                    {packageData.risk_label}
                  </span>
                )
              })()}
            </div>
          )}

          {history.length > 0 && (
            <button onClick={handleBack}
              style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.55)', borderRadius:6, color:'#00D4FF', cursor:'pointer', fontSize:12, fontWeight:700, padding:'5px 14px', fontFamily:'inherit', whiteSpace:'nowrap', boxShadow:'0 0 10px rgba(0,212,255,0.28), 0 0 22px rgba(0,212,255,0.12)', transition:'all 0.15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='rgba(0,212,255,0.16)'; e.currentTarget.style.borderColor='rgba(0,212,255,0.85)'; e.currentTarget.style.boxShadow='0 0 16px rgba(0,212,255,0.5), 0 0 36px rgba(0,212,255,0.22)' }}
              onMouseLeave={e=>{ e.currentTarget.style.background='rgba(0,212,255,0.08)'; e.currentTarget.style.borderColor='rgba(0,212,255,0.55)'; e.currentTarget.style.boxShadow='0 0 10px rgba(0,212,255,0.28), 0 0 22px rgba(0,212,255,0.12)' }}
            >
              ← Back
            </button>
          )}

          <div style={{ flex:1, maxWidth:300, marginLeft:'auto' }}>
            <SearchBar packages={indexData} onSearch={handleSearch} compact />
          </div>

          <button onClick={handleCopyLink} style={{ flexShrink:0, fontSize:12, fontWeight:600, color: copied ? C.accent : C.muted, background: copied ? `${C.accent}14` : 'rgba(255,255,255,0.04)', border:`1px solid ${copied ? `${C.accent}44` : 'rgba(255,255,255,0.1)'}`, borderRadius:6, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', whiteSpace:'nowrap' }}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {loading && <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>Loading…</span>}
        </div>
      )}

      {/* ── Home screen ── */}
      {!isExploring && (
        <HomeScreen
          indexData={indexData}
          graphData={graphData}
          onSearch={handleSearch}
          loading={loading}
        />
      )}

      {/* ── Explore mode: graph zooms out, risk panel rises up ── */}
      {isExploring && (
        <div style={{ flex:1, overflowY:'auto', position:'relative', background:'#0D1117' }} onScroll={handleExploreScroll}>

          {/* Sticky graph — full screen, scales out as panel rises */}
          <div style={{ position:'sticky', top:0, height:'100vh', overflow:'hidden', zIndex:1, background:'#0D1117' }}>

            <div ref={graphContentRef} style={{ position:'absolute', inset:0, zIndex:1, willChange:'transform,opacity', transformOrigin:'center center' }}>
              <ReactFlowProvider>
                <GraphCanvas
                  graphData={graphData}
                  focusedPackage={focusedPackage}
                  expandedPackages={expandedPackages}
                  onNodeClick={handleNodeClick}
                  packageData={packageData}
                />
              </ReactFlowProvider>
            </div>

            {/* Scroll hint */}
            <div style={{ position:'absolute', bottom:64, left:0, right:0, display:'flex', flexDirection:'column', alignItems:'center', gap:6, zIndex:3, pointerEvents:'none' }}>
              <span style={{ fontSize:11, color:'#fff', letterSpacing:'0.08em', textTransform:'uppercase', textShadow:'0 0 6px #FF4444, 0 0 14px #FF444488, 0 0 28px #FF444444, -2px 0 8px #FF444455, 2px 0 8px #FF444455' }}>Scroll for risk analysis</span>
              <span style={{ fontSize:18, color:'#fff', animation:'d-bounce 2.2s ease-in-out infinite', textShadow:'0 0 8px #FF4444, 0 0 18px #FF444488, 0 0 36px #FF444433' }}>↓</span>
            </div>
          </div>

          {/* Risk panel — side gaps + floating window */}
          <div style={{ position:'relative', zIndex:2, background:'#0D1117', padding:'0 72px' }}>
            <div style={{
              background:   '#13131E',
              borderRadius: '20px 20px 0 0',
              border:       '1px solid rgba(255,255,255,0.08)',
              boxShadow:    '0 0 0 3px #0D1117, 0 0 0 5px rgba(110,80,220,0.65), 0 0 20px 6px rgba(100,70,210,0.50), 0 0 50px 12px rgba(90,60,200,0.28), 0 0 100px 22px rgba(80,50,190,0.14)',
              minHeight:    '100vh',
            }}>

              {/* Sticky title bar — no traffic lights */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 24px', background:'#1A1A2C', borderBottom:'1px solid rgba(255,255,255,0.06)', borderRadius:'20px 20px 0 0', position:'sticky', top:0, zIndex:1 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.45)', letterSpacing:'0.04em' }}>Risk Analysis</span>
                {packageData && <span style={{ fontSize:12, color:'rgba(255,255,255,0.22)' }}>— {packageData.package_name}</span>}
              </div>

              <RiskScoreCard packageData={packageData} onNavigate={handleNavigate} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
