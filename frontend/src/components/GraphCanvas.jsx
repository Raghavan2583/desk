import { useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
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
import { C } from '../utils/colors'

const EDGE_COLOR = { dep: '#FF8C00', usedBy: '#3FB950' }

function GroupHeaderNode({ data }) {
  return (
    <div style={{
      width:         NODE_WIDTH,
      textAlign:     'center',
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color:         data.color,
      opacity:       0.75,
      pointerEvents: 'none',
      userSelect:    'none',
    }}>
      {data.label}
    </div>
  )
}

const NODE_TYPES = { packageNode: PackageNode, groupHeader: GroupHeaderNode }

function LayoutController({ rfNodes, rfEdges, focusedPackage }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    if (rfNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
    }
  }, [focusedPackage, rfNodes.length, fitView])
  return null
}

export default function GraphCanvas({
  graphData,
  focusedPackage,
  expandedPackages,
  onNodeClick,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { nodes: visNodes, edges: visEdges, totalNeighborCount, isCapped } = useMemo(() => {
    if (!graphData || !focusedPackage) return { nodes: [], edges: [], totalNeighborCount: 0, isCapped: false }
    return getVisibleSubgraph(graphData, focusedPackage, expandedPackages)
  }, [graphData, focusedPackage, expandedPackages])

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
      // e.source===focal → focal depends on e.target → e.target is TOP row (dep)
      // e.target===focal → e.source depends on focal → e.source is BOTTOM row (usedBy)
      // Swap source/target so all arrows flow top → bottom
      const isDepEdge = e.source === focusedPackage
      const color     = isDepEdge ? EDGE_COLOR.dep : EDGE_COLOR.usedBy
      return {
        id:        e.id,
        source:    e.target,   // left-column node (dep or focal)
        target:    e.source,   // right-column node (focal or usedBy)
        type:      'smoothstep',
        style:     { stroke: color, strokeWidth: 2 },
        animated:  true,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      }
    })

    const laidOut = applyColumnLayout(rfNodes, focusedPackage)

    // Floating column headers — positioned just above the top node of each column
    const depsCount   = depSet.size
    const usedByCount = usedBySet.size
    const headerNodes = []

    if (depsCount > 0) {
      headerNodes.push({
        id: '__header_deps', type: 'groupHeader',
        data: { label: '↑ Depends on', color: EDGE_COLOR.dep },
        position: { x: -NODE_WIDTH / 2, y: -ROW_CENTER_Y - NODE_HEIGHT / 2 - 40 },
        draggable: false, selectable: false, focusable: false,
      })
    }
    if (usedByCount > 0) {
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={3}
      style={{ background: C.bg }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color={C.border} gap={32} size={1} />
      <Controls showInteractive={false} />
      <LayoutController
        rfNodes={nodes}
        rfEdges={edges}
        focusedPackage={focusedPackage}
      />

      {/* Edge color legend — bottom left, pushed above zoom controls */}
      <Panel position="bottom-left">
        <div style={{
          background:   C.surface + 'ee',
          border:       `1px solid ${C.border}`,
          borderRadius: 8,
          padding:      '9px 12px',
          fontSize:     11,
          lineHeight:   1.9,
          marginBottom: 100,
        }}>
          {[
            { color: EDGE_COLOR.dep,    label: 'Depends on (top)'    },
            { color: EDGE_COLOR.usedBy, label: 'Used by (bottom)'    },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block',
                width: 18, height: 2, borderRadius: 1,
                background: color, flexShrink: 0,
              }} />
              <span style={{ color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Neighbor cap notice — top center */}
      {isCapped && (
        <Panel position="top-center">
          <div style={{
            background:   C.surface + 'ee',
            border:       `1px solid ${C.border}`,
            borderRadius: 6,
            padding:      '6px 12px',
            fontSize:     11,
            color:        C.muted,
            marginTop:    8,
          }}>
            Showing top 15 of {totalNeighborCount} connections — click any node to focus on it
          </div>
        </Panel>
      )}
    </ReactFlow>
  )
}
