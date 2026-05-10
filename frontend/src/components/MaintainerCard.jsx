import { ACTIVITY_COLORS, C } from '../utils/colors'

export default function MaintainerCard({ maintainer }) {
  if (!maintainer) return null

  const { activity_label, days_since_last_commit, commit_count_90d, contributors_count, is_archived } = maintainer
  const actColor = ACTIVITY_COLORS[activity_label] ?? C.muted

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          16,
      flexWrap:     'wrap',
      background:   `linear-gradient(145deg, ${actColor}0a 0%, ${C.bg} 60%)`,
      border:       `1px solid ${actColor}44`,
      borderRadius: 10,
      padding:      '10px 16px',
      boxShadow:    `0 0 0 1px ${actColor}14, 0 0 14px 2px ${actColor}18`,
    }}>

      {/* Activity badge */}
      <span style={{
        fontSize:     11, fontWeight:700, color:actColor,
        textTransform:'uppercase', letterSpacing:'0.06em',
        background:   `${actColor}22`, border:`1px solid ${actColor}44`,
        borderRadius: 4, padding:'2px 8px', flexShrink:0,
        boxShadow:    `0 0 6px 1px ${actColor}33`,
      }}>
        {activity_label}
      </span>

      {is_archived && (
        <span style={{ fontSize:11, fontWeight:700, color:'#FF4444', background:'#FF444422', border:'1px solid #FF444444', borderRadius:4, padding:'2px 8px', flexShrink:0 }}>
          ARCHIVED
        </span>
      )}

      <div style={{ width:1, height:20, background:'rgba(255,255,255,0.08)', flexShrink:0 }} />

      <Stat label="Last commit" value={days_since_last_commit != null ? `${days_since_last_commit}d ago` : '—'} />
      <Stat label="Commits (90d)" value={commit_count_90d ?? '—'} />
      <Stat label="Contributors"  value={contributors_count ?? '—'} />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
      <span style={{ fontSize:13, fontWeight:600, color:'#E6EDF3' }}>{value}</span>
      <span style={{ fontSize:11, color:C.muted }}>{label}</span>
    </div>
  )
}
