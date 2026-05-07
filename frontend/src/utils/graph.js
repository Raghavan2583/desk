import dagre from 'dagre'
import { NODE_WIDTH, NODE_HEIGHT } from '../components/PackageNode'

const MAX_VISIBLE_NEIGHBORS = 15

export const ROW_CENTER_Y = 180   // vertical distance from focal center to each row
export const H_GAP        = 190   // horizontal center-to-center gap between nodes in a row

// nodeSize kept for any legacy callers — cards use fixed NODE_WIDTH/NODE_HEIGHT
export function nodeSize() { return NODE_WIDTH }

/**
 * Returns the subset of nodes and edges visible in the current view.
 * Always includes focusedId + its direct neighbors (capped at MAX_VISIBLE_NEIGHBORS,
 * sorted by blast_radius_count desc so the most impactful show first).
 * expandedIds is a Set of additional packages whose neighbors are also shown.
 */
export function getVisibleSubgraph(graphData, focusedId, expandedIds = new Set()) {
  if (!graphData || !focusedId) return { nodes: [], edges: [], totalNeighborCount: 0, isCapped: false }

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

  const neighborIds = [...visible].filter(id => id !== focusedId)
  const totalNeighborCount = neighborIds.length
  const sorted = neighborIds.sort((a, b) =>
    (nodeMap[b]?.data?.blast_radius_count ?? 0) - (nodeMap[a]?.data?.blast_radius_count ?? 0)
  )
  const capped = sorted.slice(0, MAX_VISIBLE_NEIGHBORS)
  const isCapped = totalNeighborCount > MAX_VISIBLE_NEIGHBORS
  const finalVisible = new Set([focusedId, ...capped])

  const nodes = [...finalVisible]
    .filter(id => nodeMap[id])
    .map(id => nodeMap[id])

  const edges = graphData.edges.filter(
    e => (e.source === focusedId || e.target === focusedId)
      && finalVisible.has(e.source) && finalVisible.has(e.target)
  )

  return { nodes, edges, totalNeighborCount, isCapped }
}

/**
 * Vertical layout: depends-on TOP | focal MIDDLE | used-by BOTTOM.
 * Focal sits at (0,0). Top/bottom rows are spread horizontally, centered at x=0.
 * Returns positioned nodes — header nodes are added by GraphCanvas.
 */
export function applyColumnLayout(rfNodes, focusedId) {
  const focal    = rfNodes.find(n => n.data?.nodeRole === 'focal')
  const deps     = rfNodes.filter(n => n.data?.nodeRole === 'dependency')
  const usedBy   = rfNodes.filter(n => n.data?.nodeRole === 'dependent')
  const extended = rfNodes.filter(n => n.data?.nodeRole === 'extended')

  const positioned = []

  if (focal) {
    positioned.push({ ...focal, position: { x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 } })
  }

  // Dependencies go TOP (upstream — what the focal depends on)
  const depSpan = Math.max(0, (deps.length - 1) * H_GAP)
  deps.forEach((n, i) => {
    positioned.push({
      ...n,
      position: {
        x: -depSpan / 2 + i * H_GAP - NODE_WIDTH / 2,
        y: -ROW_CENTER_Y - NODE_HEIGHT / 2,
      },
    })
  })

  // Dependents go BOTTOM (downstream — what uses the focal)
  const usedBySpan = Math.max(0, (usedBy.length - 1) * H_GAP)
  usedBy.forEach((n, i) => {
    positioned.push({
      ...n,
      position: {
        x: -usedBySpan / 2 + i * H_GAP - NODE_WIDTH / 2,
        y: ROW_CENTER_Y - NODE_HEIGHT / 2,
      },
    })
  })

  extended.forEach((n, i) => {
    const cols  = Math.ceil(Math.sqrt(extended.length))
    const col   = i % cols
    const row   = Math.floor(i / cols)
    positioned.push({
      ...n,
      position: {
        x: (col - (cols - 1) / 2) * (NODE_WIDTH + 16),
        y: ROW_CENTER_Y + NODE_HEIGHT + 40 + row * (NODE_HEIGHT + 20),
      },
    })
  })

  return positioned
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
