import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider } from 'reactflow'
import SearchBar    from './components/SearchBar'
import GraphCanvas  from './components/GraphCanvas'
import RiskScoreCard from './components/RiskScoreCard'
import HomeScreen   from './components/HomeScreen'
import { C } from './utils/colors'

export default function App() {
  const [indexData,       setIndexData]       = useState([])
  const [graphData,       setGraphData]       = useState(null)
  const [packageData,     setPackageData]     = useState(null)
  const [focusedPackage,  setFocusedPackage]  = useState(null)
  const [expandedPackages,setExpandedPackages]= useState(new Set())
  const [loading,         setLoading]         = useState(false)
  const [panelVisible,    setPanelVisible]    = useState(true)
  const [history,         setHistory]         = useState([])

  // Cache graph.json — only fetched once
  const graphCache = useRef(null)

  // Load index.json and pre-warm graph.json on mount
  useEffect(() => {
    fetch('/data/index.json')
      .then(r => r.json())
      .then(d => setIndexData(d.packages ?? []))
      .catch(err => console.error('index.json load failed:', err))
    loadGraph().then(g => setGraphData(g)).catch(() => {})
  }, [])

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

  const isExploring = focusedPackage !== null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Top bar — shown only in explore mode */}
      {isExploring && (
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        12,
          padding:    '12px 20px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          flexShrink: 0,
        }}>
          <span
            onClick={() => { setFocusedPackage(null); setHistory([]) }}
            style={{
              fontWeight:   700,
              fontSize:     15,
              color:        C.accent,
              letterSpacing:'0.04em',
              cursor:       'pointer',
            }}
          >
            DESK
          </span>
          {history.length > 0 && (
            <button
              onClick={handleBack}
              style={{
                background:   'transparent',
                border:       `1px solid ${C.border}`,
                borderRadius: 6,
                color:        C.muted,
                cursor:       'pointer',
                fontSize:     12,
                padding:      '4px 10px',
                whiteSpace:   'nowrap',
              }}
            >
              ← Back
            </button>
          )}
          <SearchBar
            packages={indexData}
            onSearch={handleSearch}
            compact
          />
          {loading && (
            <span style={{ fontSize: 12, color: C.muted }}>Loading…</span>
          )}
        </div>
      )}

      {/* Home screen */}
      {!isExploring && (
        <HomeScreen
          indexData={indexData}
          graphData={graphData}
          onSearch={handleSearch}
          loading={loading}
        />
      )}

      {/* Explore mode — graph + right panel */}
      {isExploring && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Graph canvas — expands when panel hidden */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <ReactFlowProvider>
              <GraphCanvas
                graphData={graphData}
                focusedPackage={focusedPackage}
                expandedPackages={expandedPackages}
                onNodeClick={handleNodeClick}
              />
            </ReactFlowProvider>
          </div>

          {/* Panel toggle strip */}
          <button
            onClick={() => setPanelVisible(v => !v)}
            title={panelVisible ? 'Hide panel' : 'Show panel'}
            style={{
              flexShrink:     0,
              width:          18,
              background:     C.surface,
              border:         'none',
              borderLeft:     `1px solid ${C.border}`,
              borderRight:    `1px solid ${C.border}`,
              color:          C.muted,
              cursor:         'pointer',
              fontSize:       10,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}
          >
            {panelVisible ? '›' : '‹'}
          </button>

          {/* Right panel — 30%, hideable */}
          {panelVisible && (
            <div style={{ flex: '0 0 30%', overflowY: 'auto', background: C.surface, borderLeft: `1px solid ${C.border}` }}>
              <RiskScoreCard
                packageData={packageData}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
