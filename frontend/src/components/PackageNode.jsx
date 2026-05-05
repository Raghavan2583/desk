import { Handle, Position } from 'reactflow'
import { RISK_COLORS, C } from '../utils/colors'

export const NODE_WIDTH  = 160
export const NODE_HEIGHT = 64

export default function PackageNode({ data }) {
  const {
    package_name,
    risk_label,
    risk_score,
    blast_radius_count,
    trend_direction,
    isFocused,
  } = data

  const color     = RISK_COLORS[risk_label] ?? C.muted
  const trendChar = trend_direction === 'RISING' ? '↑'
                  : trend_direction === 'FALLING' ? '↓' : '→'
  const trendColor = trend_direction === 'RISING'  ? RISK_COLORS.CRITICAL
                   : trend_direction === 'FALLING' ? '#3FB950' : C.muted

  return (
    <div
      title={`${package_name} — ${risk_score}/10 — ${(blast_radius_count ?? 0).toLocaleString()} dependents`}
      style={{
        width:        NODE_WIDTH,
        background:   C.surface,
        border:       `1.5px solid ${isFocused ? '#ffffff' : color + '99'}`,
        borderRadius: 8,
        padding:      '8px 10px',
        cursor:       'pointer',
        boxShadow:    isFocused
          ? `0 0 0 2px ${color}66, 0 4px 16px ${color}33`
          : '0 2px 8px rgba(0,0,0,0.4)',
        transition:   'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ opacity: 0 }} />

      {/* Package name */}
      <div style={{
        fontSize:     11,
        fontWeight:   600,
        color:        C.text,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
        marginBottom: 6,
      }}>
        {package_name}
      </div>

      {/* Risk badge + score + trend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize:     9,
          fontWeight:   700,
          color,
          textTransform:'uppercase',
          letterSpacing:'0.04em',
          background:   color + '22',
          border:       `1px solid ${color}55`,
          borderRadius: 3,
          padding:      '1px 5px',
          flexShrink:   0,
        }}>
          {risk_label}
        </span>

        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, marginLeft: 'auto' }}>
          {risk_score}
        </span>

        <span style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>
          {trendChar}
        </span>
      </div>

      {/* Blast radius */}
      {blast_radius_count > 0 && (
        <div style={{ fontSize: 9, color: C.muted, marginTop: 4 }}>
          {blast_radius_count.toLocaleString()} dependents
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
