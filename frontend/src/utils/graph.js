import dagre from 'dagre'

export function nodeSize(blastRadius) {
  const min = 36, max = 80
  return min + (max - min) * Math.min((blastRadius || 0) / 200, 1) ** 0.5
}

/**
 * Returns the subset of nodes and edges visible in the current view.
 * Always includes focusedId + its direct neighbors.
 * expandedIds is a Set of additional packages whose neighbors are also shown.
 */
export function getVisibleSubgraph(graphData, focusedId, expandedIds = new Set()) {
  if (!graphData || !focusedId) return { nodes: [], edges: [] }

  const nodeMap = Object.fromEntries(graphData.nodes.map(n => [n.id, n]))
  const visible  = new Set([focusedId])

  // Collect all seeds: focused + expanded
  const seeds = [focusedId, ...expandedIds]

  for (const seed of seeds) {
    for (const edge of graphData.edges) {
      if (edge.source === seed) visible.add(edge.target)
      if (edge.target === seed) visible.add(edge.source)
    }
  }

  const nodes = [...visible]
    .filter(id => nodeMap[id])
    .map(id => nodeMap[id])

  const edges = graphData.edges.filter(
    e => visible.has(e.source) && visible.has(e.target)
  )

  return { nodes, edges }
}

/**
 * Computes dagre positions for a set of React Flow nodes and edges.
 * Returns new node array with position: {x, y} set.
 */
export function applyDagreLayout(rfNodes, rfEdges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 })

  rfNodes.forEach(node => {
    const size = node.data?.nodeSize ?? 48
    g.setNode(node.id, { width: size, height: size })
  })
  rfEdges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return rfNodes.map(node => {
    const pos  = g.node(node.id)
    const size = node.data?.nodeSize ?? 48
    return {
      ...node,
      position: {
        x: pos.x - size / 2,
        y: pos.y - size / 2,
      },
    }
  })
}
