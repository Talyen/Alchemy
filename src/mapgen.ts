import type { MapNode, MapNodeType, MapState } from './types'

const COLS = 7
const MAX_ROWS = 3

function pickType(col: number): MapNodeType {
  if (col === 0) return 'enemy'
  if (col === COLS - 1) return 'boss'
  if (col === 1) return Math.random() < 0.65 ? 'enemy' : 'rest'
  const r = Math.random()
  if (r < 0.42) return 'enemy'
  if (r < 0.58) return 'elite'
  if (r < 0.76) return 'rest'
  if (r < 0.9) return 'shop'
  return 'mystery'
}

export function generateMap(): MapState {
  // Determine which rows are active per column
  const colRows: number[][] = [[1]] // col 0: always middle
  for (let c = 1; c < COLS - 1; c++) {
    const roll = Math.random()
    const count = roll < 0.25 ? 1 : roll < 0.75 ? 2 : MAX_ROWS
    const rows = ([0, 1, 2] as number[])
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .sort((a, b) => a - b)
    colRows.push(rows)
  }
  colRows.push([1]) // boss: always middle

  const nodes: MapNode[] = []
  for (let c = 0; c < COLS; c++) {
    for (const r of colRows[c]) {
      nodes.push({
        id: `${c}-${r}`,
        type: pickType(c),
        col: c,
        row: r,
        connections: [],
        visited: false,
      })
    }
  }

  // Create connections
  for (let c = 0; c < COLS - 1; c++) {
    const from = nodes.filter(n => n.col === c).sort((a, b) => a.row - b.row)
    const to   = nodes.filter(n => n.col === c + 1).sort((a, b) => a.row - b.row)

    for (const f of from) {
      const sorted = [...to].sort((a, b) =>
        Math.abs(a.row - f.row) - Math.abs(b.row - f.row)
      )
      f.connections.push(sorted[0].id)
      // 45% chance of a second connection to keep branching interesting
      if (sorted.length > 1 && Math.random() < 0.45) {
        f.connections.push(sorted[1].id)
      }
    }

    // Ensure every to-node has at least one incoming connection
    for (const t of to) {
      if (!from.some(f => f.connections.includes(t.id))) {
        const closest = [...from].sort((a, b) =>
          Math.abs(a.row - t.row) - Math.abs(b.row - t.row)
        )[0]
        if (!closest.connections.includes(t.id)) {
          closest.connections.push(t.id)
        }
      }
    }
  }

  return { nodes }
}

export function getAvailableNodes(map: MapState): Set<string> {
  const visited = map.nodes.filter(n => n.visited)
  if (visited.length === 0) {
    return new Set(map.nodes.filter(n => n.col === 0).map(n => n.id))
  }
  const maxCol = Math.max(...visited.map(n => n.col))
  const inMaxCol = visited.filter(n => n.col === maxCol)
  const result = new Set<string>()
  for (const v of inMaxCol) {
    for (const id of v.connections) {
      result.add(id)
    }
  }
  return result
}
