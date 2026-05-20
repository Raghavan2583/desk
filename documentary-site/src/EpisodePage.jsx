import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { EPISODES } from './episodes.js'

marked.setOptions({ breaks: true, gfm: true })

const ChevLeft = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 4L6 8l4 4" />
  </svg>
)
const ChevRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
)
const ArrowUp = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 12V4M4 8l4-4 4 4" />
  </svg>
)

function stripDocTitle(markdown) {
  return markdown
    .replace(/^# DESK — A Documentary Series\s*/m, '')
    .replace(/^## Episode \d+: .+\n/m, '')
    .replace(/^---\s*/m, '')
    .trim()
}

export default function EpisodePage({ episodeId, onNavigate }) {
  const ep = EPISODES.find(e => e.id === episodeId)
  const prev = EPISODES.find(e => e.id === episodeId - 1)
  const next = EPISODES.find(e => e.id === episodeId + 1)

  const [progress, setProgress] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const scrolled = el.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? (scrolled / total) * 100 : 0)
      setShowScrollTop(scrolled > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!ep) return null

  const html = marked.parse(stripDocTitle(ep.content))

  return (
    <>
      {/* Reading progress bar */}
      <div className="progress-bar" style={{ width: `${progress}%` }} />

      {/* Nav */}
      <nav className="site-nav">
        <button className="nav-back" onClick={() => onNavigate(null)}>
          <ChevLeft />
          All Episodes
        </button>
        <span className="nav-episode-title">
          Ep {String(ep.id).padStart(2, '0')} — {ep.title}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--faint)' }}>
          {ep.readTime}
        </span>
      </nav>

      <main className="episode-wrap">
        {/* Episode header */}
        <header className="episode-header">
          {/* Episode index dots */}
          <div className="ep-index-strip">
            {EPISODES.map(e => (
              <div
                key={e.id}
                className={`ep-index-dot ${e.id === ep.id ? 'active' : ''}`}
                title={`Episode ${e.id}: ${e.title}`}
                onClick={() => onNavigate(e.id)}
              >
                {e.id}
              </div>
            ))}
          </div>

          <div className="ep-num-badge">
            Episode {String(ep.id).padStart(2, '0')} of {EPISODES.length}
          </div>
          <h1 className="ep-title">{ep.title}</h1>
          <div className="ep-meta">
            <span>DESK Documentary</span>
            <span className="ep-meta-dot" />
            <span>{ep.readTime}</span>
          </div>
        </header>

        <hr className="ep-divider" />

        {/* Rendered markdown */}
        <article
          ref={contentRef}
          className="prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Prev / Next navigation */}
        <nav className="ep-nav">
          {prev ? (
            <button className="ep-nav-btn prev" onClick={() => onNavigate(prev.id)}>
              <ChevLeft />
              <div>
                <span className="ep-nav-label">Previous</span>
                <span className="ep-nav-title">{prev.title}</span>
              </div>
            </button>
          ) : <div className="ep-nav-spacer" />}

          {next ? (
            <button className="ep-nav-btn next" onClick={() => onNavigate(next.id)}>
              <div>
                <span className="ep-nav-label">Next</span>
                <span className="ep-nav-title">{next.title}</span>
              </div>
              <ChevRight />
            </button>
          ) : (
            <button className="ep-nav-btn next" onClick={() => onNavigate(null)}>
              <div>
                <span className="ep-nav-label">Done</span>
                <span className="ep-nav-title">Back to all episodes</span>
              </div>
              <ChevRight />
            </button>
          )}
        </nav>
      </main>

      {/* Scroll to top */}
      <button
        className={`scroll-top ${showScrollTop ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to top"
      >
        <ArrowUp />
      </button>
    </>
  )
}
