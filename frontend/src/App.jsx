import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider } from 'reactflow'
import SearchBar    from './components/SearchBar'
import GraphCanvas  from './components/GraphCanvas'
import RiskScoreCard from './components/RiskScoreCard'
import { C } from './utils/colors'

export default function App() {
  const [indexData,       setIndexData]       = useState([])
  const [graphData,       setGraphData]       = useState(null)
  const [packageData,     setPackageData]     = useState(null)
  const [focusedPackage,  setFocusedPackage]  = useState(null)
  const [expandedPackages,setExpandedPackages]= useState(new Set())
  const [loading,         setLoading]         = useState(false)

  // Cache graph.json — only fetched once
  const graphCache = useRef(null)

  // Load index.json on mount
  useEffect(() => {
    fetch('/data/index.json')
      .then(r => r.json())
      .then(d => setIndexData(d.packages ?? []))
      .catch(err => console.error('index.json load failed:', err))
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
      setPackageData(pkg)
      setExpandedPackages(prev => new Set([...prev, packageName]))
      setFocusedPackage(packageName)
    } catch (err) {
      console.error('Node click failed:', err)
    } finally {
      setLoading(false)
    }
  }, [focusedPackage])

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
          gap:        16,
          padding:    '12px 20px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          flexShrink: 0,
        }}>
          <span style={{
            fontWeight:   700,
            fontSize:     15,
            color:        C.accent,
            letterSpacing:'0.04em',
          }}>
            DESK
          </span>
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

      {/* Empty state — centered search */}
      {!isExploring && (
        <div style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            24,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize:     28,
              fontWeight:   700,
              color:        C.text,
              letterSpacing:'0.04em',
              marginBottom: 8,
            }}>
              DESK
            </div>
            <div style={{ fontSize: 14, color: C.muted }}>
              Dependency risk across the PyPI ecosystem
            </div>
          </div>
          <SearchBar packages={indexData} onSearch={handleSearch} />
          {loading && (
            <span style={{ fontSize: 13, color: C.muted }}>Loading…</span>
          )}
        </div>
      )}

      {/* Explore mode — graph + right panel */}
      {isExploring && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Graph canvas — 70% */}
          <div style={{ flex: '0 0 70%', position: 'relative' }}>
            <ReactFlowProvider>
              <GraphCanvas
                graphData={graphData}
                focusedPackage={focusedPackage}
                expandedPackages={expandedPackages}
                onNodeClick={handleNodeClick}
              />
            </ReactFlowProvider>
          </div>

          {/* Right panel — 30% */}
          <div style={{ flex: '0 0 30%', overflowY: 'auto', background: C.surface }}>
            <RiskScoreCard
              packageData={packageData}
              onNavigate={handleNavigate}
            />
          </div>
        </div>
      )}
    </div>
  )
}
