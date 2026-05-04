import { useState, useRef, useEffect } from 'react'
import { RISK_COLORS, C } from '../utils/colors'

export default function SearchBar({ packages, onSearch, compact = false }) {
  const [query,     setQuery]     = useState('')
  const [open,      setOpen]      = useState(false)
  const [cursor,    setCursor]    = useState(-1)
  const inputRef  = useRef(null)
  const listRef   = useRef(null)

  const results = query.trim().length > 0
    ? packages
        .filter(p => p.name.startsWith(query.trim().toLowerCase()))
        .slice(0, 8)
    : []

  useEffect(() => {
    setOpen(results.length > 0)
    setCursor(-1)
  }, [results.length])

  function select(pkg) {
    setQuery(pkg.name)
    setOpen(false)
    onSearch(pkg.name)
  }

  function handleKey(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && cursor >= 0) {
      select(results[cursor])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (inputRef.current && !inputRef.current.closest('.search-root')?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="search-root" style={{ position: 'relative', width: compact ? 280 : 520 }}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search a PyPI package…"
        autoComplete="off"
        spellCheck={false}
        style={{
          width:        '100%',
          padding:      compact ? '8px 14px' : '14px 20px',
          fontSize:     compact ? 14 : 16,
          background:   C.surface,
          border:       `1px solid ${C.border}`,
          borderRadius: 8,
          color:        C.text,
          outline:      'none',
          fontFamily:   'inherit',
        }}
        onFocusCapture={e => { e.target.style.borderColor = C.accent }}
        onBlurCapture={e => { e.target.style.borderColor = C.border }}
      />

      {open && (
        <ul
          ref={listRef}
          style={{
            position:   'absolute',
            top:        '100%',
            left:       0,
            right:      0,
            marginTop:  4,
            background: C.surface,
            border:     `1px solid ${C.border}`,
            borderRadius: 8,
            listStyle:  'none',
            zIndex:     100,
            overflow:   'hidden',
          }}
        >
          {results.map((pkg, i) => (
            <li
              key={pkg.name}
              onMouseDown={() => select(pkg)}
              onMouseEnter={() => setCursor(i)}
              style={{
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding:    '10px 14px',
                cursor:     'pointer',
                background: i === cursor ? C.border : 'transparent',
              }}
            >
              <span style={{ color: C.text, fontWeight: 500 }}>{pkg.name}</span>
              <span style={{
                fontSize:     11,
                fontWeight:   700,
                color:        RISK_COLORS[pkg.risk_label] ?? C.muted,
                textTransform:'uppercase',
                letterSpacing:'0.05em',
              }}>
                {pkg.risk_label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
