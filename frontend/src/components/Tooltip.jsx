import { useState, useRef, useCallback } from 'react'

export default function Tooltip({ text, children }) {
  const [rect, setRect] = useState(null)
  const ref = useRef(null)

  const show = useCallback(() => {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
  }, [])

  const hide = useCallback(() => setRect(null), [])

  if (!text) return children

  return (
    <>
      <span ref={ref} style={{ display:'inline-flex', alignItems:'center' }}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>

      {rect && (
        <span style={{
          position:      'fixed',
          top:            rect.top - 8,
          left:           rect.left + rect.width / 2,
          transform:     'translate(-50%, -100%)',
          background:    '#1C1C2E',
          border:        '1px solid rgba(255,255,255,0.14)',
          borderRadius:   7,
          padding:       '7px 11px',
          fontSize:       11,
          color:         '#C8C3BE',
          lineHeight:     1.5,
          zIndex:         9999,
          pointerEvents: 'none',
          boxShadow:     '0 6px 20px rgba(0,0,0,0.6)',
          width:          210,
          whiteSpace:    'normal',
          textAlign:     'center',
        }}>
          {text}
          <span style={{
            position:    'absolute',
            top:         '100%',
            left:        '50%',
            transform:   'translateX(-50%)',
            borderLeft:  '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop:   '5px solid #1C1C2E',
          }}/>
        </span>
      )}
    </>
  )
}
