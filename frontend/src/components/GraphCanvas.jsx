import { useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Panel,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'

import PackageNode from './PackageNode'
import { NODE_WIDTH, NODE_HEIGHT } from './PackageNode'
import { getVisibleSubgraph, applyColumnLayout, ROW_CENTER_Y } from '../utils/graph'
import { RISK_COLORS, C } from '../utils/colors'

const EDGE_COLOR = { dep: '#00D4FF', usedBy: '#FF2D9A' }

function GroupHeaderNode({ data }) {
  return (
    <div style={{
      width:         NODE_WIDTH,
      textAlign:     'center',
      pointerEvents: 'none',
      userSelect:    'none',
    }}>
      <span style={{
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color:         data.color,
        opacity:       0.75,
      }}>
        {data.label}
      </span>
    </div>
  )
}

const NODE_TYPES = { packageNode: PackageNode, groupHeader: GroupHeaderNode }

function LayoutController({ rfNodes, focusedPackage }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    if (rfNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.22, duration: 300 }), 50)
    }
  }, [focusedPackage, rfNodes.length, fitView])
  return null
}

export default function GraphCanvas({
  graphData,
  focusedPackage,
  expandedPackages,
  onNodeClick,
  packageData,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { nodes: visNodes, edges: visEdges, totalNeighborCount, isCapped } = useMemo(() => {
    if (!graphData || !focusedPackage) return { nodes: [], edges: [], totalNeighborCount: 0, isCapped: false }
    return getVisibleSubgraph(graphData, focusedPackage, expandedPackages)
  }, [graphData, focusedPackage, expandedPackages])

  // Stats for the info bar
  const { depsCount, usedByCount } = useMemo(() => {
    const depSet = new Set(), usedBySet = new Set()
    for (const e of visEdges) {
      if (e.source === focusedPackage) depSet.add(e.target)
      if (e.target === focusedPackage) usedBySet.add(e.source)
    }
    return { depsCount: depSet.size, usedByCount: usedBySet.size }
  }, [visEdges, focusedPackage])

  useEffect(() => {
    if (!visNodes.length) return

    const depSet    = new Set()
    const usedBySet = new Set()
    for (const e of visEdges) {
      if (e.source === focusedPackage) depSet.add(e.target)
      if (e.target === focusedPackage) usedBySet.add(e.source)
    }

    const rfNodes = visNodes.map(n => ({
      id:   n.id,
      type: 'packageNode',
      data: {
        ...n.data,
        nodeRole: n.id === focusedPackage ? 'focal'
                : depSet.has(n.id)         ? 'dependency'
                : usedBySet.has(n.id)      ? 'dependent'
                : 'extended',
      },
      position: { x: 0, y: 0 },
    }))

    const rfEdges = visEdges.map(e => {
      const isDepEdge = e.source === focusedPackage
      const color     = isDepEdge ? EDGE_COLOR.dep : EDGE_COLOR.usedBy
      return {
        id:        e.id,
        source:    e.target,
        target:    e.source,
        type:      'smoothstep',
        style:     { stroke: color, strokeWidth: 2, filter:`drop-shadow(0 0 4px ${color}) drop-shadow(0 0 10px ${color}88)` },
        animated:  true,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      }
    })

    const laidOut = applyColumnLayout(rfNodes, focusedPackage)

    const headerNodes = []
    if (depSet.size > 0) {
      headerNodes.push({
        id: '__header_deps', type: 'groupHeader',
        data: { label: '↑ Depends on', color: EDGE_COLOR.dep },
        position: { x: -NODE_WIDTH / 2, y: -ROW_CENTER_Y - NODE_HEIGHT / 2 - 40 },
        draggable: false, selectable: false, focusable: false,
      })
    }
    if (usedBySet.size > 0) {
      headerNodes.push({
        id: '__header_used_by', type: 'groupHeader',
        data: { label: 'Used by ↓', color: EDGE_COLOR.usedBy },
        position: { x: -NODE_WIDTH / 2, y: ROW_CENTER_Y - NODE_HEIGHT / 2 - 40 },
        draggable: false, selectable: false, focusable: false,
      })
    }

    setNodes([...laidOut, ...headerNodes])
    setEdges(rfEdges)
  }, [visNodes, visEdges, focusedPackage, setNodes, setEdges])

  function handleNodeClick(_, node) {
    if (node.id.startsWith('__')) return
    onNodeClick(node.id)
  }

  const riskColor = RISK_COLORS[packageData?.risk_label] ?? C.muted

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.2}
      maxZoom={3}
      zoomOnScroll={false}
      preventScrolling={false}
      style={{ background: '#0D1117' }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="rgba(255,255,255,0.05)" gap={36} size={1.2} />


      {/* ── Stats bar — top center ── */}
      {packageData && (
        <Panel position="top-center">
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           16,
            padding:       '8px 18px',
            marginTop:     12,
            background:    'rgba(19,19,30,0.88)',
            border:        '1px solid rgba(255,255,255,0.08)',
            borderRadius:  8,
            backdropFilter:'blur(8px)',
            fontSize:      12,
          }}>
            <StatChip value={depsCount} label="deps" color={EDGE_COLOR.dep} />
            <Sep />
            <StatChip value={usedByCount} label="dependents" color={EDGE_COLOR.usedBy} />
            <Sep />
            <StatChip value={(packageData.blast_radius_count ?? 0).toLocaleString()} label="blast radius" color={riskColor} />
            {packageData.cves?.length > 0 && (
              <>
                <Sep />
                <StatChip value={packageData.cves.length} label="CVEs" color={RISK_COLORS.CRITICAL} />
              </>
            )}
            {isCapped && (
              <>
                <Sep />
                <span style={{ fontSize:11, color:C.muted }}>showing 15 of {totalNeighborCount}</span>
              </>
            )}
          </div>
        </Panel>
      )}

      {/* ── Fit-to-screen button — bottom right ── */}
      <Panel position="bottom-right">
        <FitButton />
      </Panel>

      <LayoutController rfNodes={nodes} focusedPackage={focusedPackage} />
    </ReactFlow>
  )
}

function FitButton() {
  const { fitView } = useReactFlow()
  return (
    <button
      onClick={() => fitView({ padding: 0.22, duration: 400 })}
      title="Fit graph to screen"
      style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: '#1E1A2E',
        border: '1px solid rgba(110,80,220,0.45)',
        color: 'rgba(255,255,255,0.8)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 72, marginRight: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.6), 0 0 8px 1px rgba(110,80,220,0.2)',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background  = 'rgba(110,80,220,0.3)'
        e.currentTarget.style.borderColor = 'rgba(110,80,220,0.8)'
        e.currentTarget.style.color       = '#fff'
        e.currentTarget.style.boxShadow   = '0 0 16px 3px rgba(110,80,220,0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background  = '#1E1A2E'
        e.currentTarget.style.borderColor = 'rgba(110,80,220,0.45)'
        e.currentTarget.style.color       = 'rgba(255,255,255,0.8)'
        e.currentTarget.style.boxShadow   = '0 2px 12px rgba(0,0,0,0.6), 0 0 8px 1px rgba(110,80,220,0.2)'
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4"/>
      </svg>
    </button>
  )
}

function StatChip({ value, label, color }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
      <span style={{ fontWeight:700, color, fontSize:13 }}>{value}</span>
      <span style={{ color:C.muted, fontSize:11 }}>{label}</span>
    </div>
  )
}

function Sep() {
  return <span style={{ color:'rgba(255,255,255,0.12)', fontSize:14 }}>·</span>
}

