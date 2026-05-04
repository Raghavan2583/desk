import { ACTIVITY_COLORS, C } from '../utils/colors'

export default function MaintainerCard({ maintainer }) {
  if (!maintainer) return null

  const {
    activity_label,
    days_since_last_commit,
    commit_count_90d,
    contributors_count,
    is_archived,
  } = maintainer

  const actColor = ACTIVITY_COLORS[activity_label] ?? C.muted

  return (
    <div style={{
      background:    C.surface,
      border:        `1px solid ${C.border}`,
      borderRadius:  6,
      padding:       '12px 14px',
      display:       'flex',
      flexDirection: 'column',
      gap:           8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize:     11,
          fontWeight:   700,
          color:        actColor,
          textTransform:'uppercase',
          letterSpacing:'0.06em',
          background:   actColor + '22',
          border:       `1px solid ${actColor}44`,
          borderRadius: 4,
          padding:      '2px 7px',
        }}>
          {activity_label}
        </span>
        {is_archived && (
          <span style={{
            fontSize:  11,
            fontWeight: 700,
            color:     '#FF4444',
            background:'#FF444422',
            border:    '1px solid #FF444444',
            borderRadius: 4,
            padding:   '2px 7px',
          }}>
            ARCHIVED
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
        <Stat label="Last commit" value={`${days_since_last_commit ?? '—'} days ago`} />
        <Stat label="Commits (90d)"  value={commit_count_90d ?? '—'} />
        <Stat label="Contributors"   value={contributors_count ?? '—'} />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8B949E', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
