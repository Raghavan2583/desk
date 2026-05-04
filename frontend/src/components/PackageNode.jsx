import { Handle, Position } from 'reactflow'
import { RISK_COLORS } from '../utils/colors'
import { nodeSize } from '../utils/graph'

export default function PackageNode({ data }) {
  const {
    package_name,
    risk_label,
    risk_score,
    blast_radius_count,
    isFocused,
  } = data

  const size   = nodeSize(blast_radius_count ?? 0)
  const color  = RISK_COLORS[risk_label] ?? '#8B949E'
  const label  = package_name?.length > 14
    ? package_name.slice(0, 13) + '…'
    : package_name

  return (
    <div
      title={`${package_name} — ${risk_score}/10 — ${blast_radius_count ?? 0} dependents`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
    >
      <Handle type="target" position={Position.Left}  style={{ opacity: 0 }} />

      <div style={{
        width:        size,
        height:       size,
        borderRadius: '50%',
        background:   color + 'cc',        /* 80% opacity */
        border:       `2px solid ${color}`,
        outline:      isFocused ? '3px solid #fff' : 'none',
        outlineOffset: 3,
        cursor:       'pointer',
        transition:   'outline 0.15s',
      }} />

      <span style={{
        fontSize:   11,
        color:      '#E6EDF3',
        whiteSpace: 'nowrap',
        textAlign:  'center',
        maxWidth:   90,
        overflow:   'hidden',
      }}>
        {label}
      </span>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
