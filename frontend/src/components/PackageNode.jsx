import { useEffect, useRef } from 'react'
import { Handle, Position } from 'reactflow'
import { RISK_COLORS, C } from '../utils/colors'

export const NODE_WIDTH  = 172
export const NODE_HEIGHT = 72

export default function PackageNode({ data }) {
  const {
    package_name,
    risk_label,
    risk_score,
    blast_radius_count,
    trend_direction,
    nodeRole = 'extended',
  } = data

  const isFocal    = nodeRole === 'focal'
  const rc         = RISK_COLORS[risk_label] ?? C.muted
  const trendChar  = trend_direction === 'RISING' ? '↑' : trend_direction === 'FALLING' ? '↓' : '→'
  const trendColor = trend_direction === 'RISING' ? RISK_COLORS.CRITICAL : trend_direction === 'FALLING' ? '#3FB950' : C.muted

  const nodeRef = useRef(null)

  // Focal node: slow breathing pulse
  useEffect(() => {
    if (!isFocal || !nodeRef.current) return
    const lo = `0 0 0 1px ${rc}88, 0 0 12px 3px ${rc}55, 0 0 30px 7px ${rc}2a, 0 0 60px 14px ${rc}16`
    const hi = `0 0 0 1px ${rc}CC, 0 0 20px 5px ${rc}88, 0 0 50px 11px ${rc}44, 0 0 100px 22px ${rc}22`
    let on = false
    nodeRef.current.style.boxShadow = lo
    const id = setInterval(() => {
      if (nodeRef.current) nodeRef.current.style.boxShadow = on ? hi : lo
      on = !on
    }, 1600)
    return () => clearInterval(id)
  }, [isFocal, rc])

  const baseShadow = isFocal
    ? `0 0 0 1px ${rc}88, 0 0 12px 3px ${rc}55, 0 0 30px 7px ${rc}2a, 0 0 60px 14px ${rc}16`
    : `0 0 0 1px ${rc}44, 0 0 6px 1px ${rc}22, 0 2px 6px rgba(0,0,0,0.5)`

  const hoverShadow = isFocal ? baseShadow
    : `0 0 0 1px ${rc}88, 0 0 12px 3px ${rc}44, 0 4px 14px rgba(0,0,0,0.7)`

  return (
    <div
      ref={nodeRef}
      title={`${package_name} — ${risk_score}/10 — ${(blast_radius_count ?? 0).toLocaleString()} dependents`}
      style={{
        width:        NODE_WIDTH,
        borderRadius: isFocal ? 12 : 9,
        overflow:     'hidden',
        cursor:       'pointer',
        boxShadow:    baseShadow,
        transition:   isFocal ? 'box-shadow 1.6s ease-in-out' : 'box-shadow 0.14s',
        border:       `1px solid ${isFocal ? rc + 'AA' : rc + '44'}`,
      }}
      onMouseEnter={e => { if (!isFocal) e.currentTarget.style.boxShadow = hoverShadow }}
      onMouseLeave={e => { if (!isFocal) e.currentTarget.style.boxShadow = baseShadow }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />

      {/* Top colour bar */}
      <div style={{
        height:     3,
        background: isFocal
          ? `linear-gradient(90deg, ${rc}00 0%, ${rc} 40%, ${rc} 60%, ${rc}00 100%)`
          : `linear-gradient(90deg, ${rc}00, ${rc}99, ${rc}00)`,
      }} />

      {/* Card body */}
      <div style={{
        padding:    isFocal ? '10px 12px 10px' : '7px 10px 8px',
        background: isFocal
          ? `linear-gradient(160deg, ${rc}16 0%, ${C.surface} 55%)`
          : `linear-gradient(160deg, ${rc}0a 0%, ${C.surface} 60%)`,
      }}>
        {/* Package name */}
        <div style={{
          fontSize:     isFocal ? 13 : 11,
          fontWeight:   isFocal ? 700 : 600,
          color:        C.text,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          marginBottom: isFocal ? 7 : 5,
          letterSpacing: '-0.01em',
        }}>
          {package_name}
        </div>

        {/* Bottom row: badge + score + trend */}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{
            fontSize:     isFocal ? 9 : 8,
            fontWeight:   700,
            color:        rc,
            textTransform:'uppercase',
            letterSpacing:'0.05em',
            background:   `${rc}18`,
            border:       `1px solid ${rc}44`,
            borderRadius: 4,
            padding:      '1px 5px',
            flexShrink:   0,
          }}>
            {risk_label}
          </span>

          <span style={{
            fontSize:   isFocal ? 16 : 12,
            fontWeight: 700,
            color:      isFocal ? rc : C.text,
            marginLeft: 'auto',
            fontVariantNumeric: 'tabular-nums',
            textShadow: isFocal ? `0 0 14px ${rc}CC` : 'none',
          }}>
            {risk_score}
          </span>

          <span style={{ fontSize: isFocal ? 12 : 10, fontWeight: 700, color: trendColor }}>
            {trendChar}
          </span>
        </div>

        {/* Blast radius — focal only */}
        {isFocal && blast_radius_count > 0 && (
          <div style={{ fontSize:10, color:C.muted, marginTop:5 }}>
            {blast_radius_count.toLocaleString()} dependents
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
