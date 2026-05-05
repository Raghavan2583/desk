import { useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'

import PackageNode from './PackageNode'
import { getVisibleSubgraph, applyDagreLayout, nodeSize } from '../utils/graph'
import { C } from '../utils/colors'

const NODE_TYPES = { packageNode: PackageNode }

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

  const { nodes: visNodes, edges: visEdges } = useMemo(() => {
    if (!graphData || !focusedPackage) return { nodes: [], edges: [] }
    return getVisibleSubgraph(graphData, focusedPackage, expandedPackages)
  }, [graphData, focusedPackage, expandedPackages])

  useEffect(() => {
    if (!visNodes.length) return

    const rfNodes = visNodes.map(n => ({
      id:   n.id,
      type: 'packageNode',
      data: {
        ...n.data,
        isFocused: n.id === focusedPackage,
      },
      position: { x: 0, y: 0 },
    }))

    const rfEdges = visEdges.map(e => ({
      id:          e.id,
      source:      e.source,
      target:      e.target,
      type:        'smoothstep',
      style:       { stroke: C.accent + '55', strokeWidth: 1.5 },
      animated:    e.source === focusedPackage || e.target === focusedPackage,
    }))

    const laidOut = applyDagreLayout(rfNodes, rfEdges)
    setNodes(laidOut)
    setEdges(rfEdges)
  }, [visNodes, visEdges, focusedPackage, setNodes, setEdges])

  function handleNodeClick(_, node) {
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
    </ReactFlow>
  )
}
