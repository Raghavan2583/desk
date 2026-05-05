import dagre from 'dagre'
import { NODE_WIDTH, NODE_HEIGHT } from '../components/PackageNode'

// nodeSize kept for any legacy callers — cards use fixed NODE_WIDTH/NODE_HEIGHT
export function nodeSize() { return NODE_WIDTH }

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
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 80 })

  rfNodes.forEach(node => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  rfEdges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return rfNodes.map(node => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH  / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}
