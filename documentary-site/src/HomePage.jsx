import { EPISODES } from './episodes.js'

const ArrowRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
)

function EpisodeCard({ ep, onClick }) {
  return (
    <div className="episode-card" onClick={onClick}>
      <div className="card-top">
        <span className="episode-num">Episode {String(ep.id).padStart(2, '0')}</span>
        <span className="read-time">{ep.readTime}</span>
      </div>
      <div className="card-title">{ep.title}</div>
      <div className="card-hook">{ep.hook}</div>
      <div className="card-cta">
        Read episode <ArrowRight />
      </div>
    </div>
  )
}

export default function HomePage({ onNavigate }) {
  const totalReadTime = EPISODES.reduce((sum, ep) => {
    return sum + parseInt(ep.readTime)
  }, 0)

  return (
    <>
      <nav className="site-nav">
        <span className="nav-brand">
          <span className="de">DE</span><span className="sk">SK</span>
          <span className="label">Documentary</span>
        </span>
        <a
          href="https://frontend-sand-seven-57.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}
        >
          View Live Tool →
        </a>
      </nav>

      <main className="home-wrap">
        {/* Hero */}
        <section className="hero">
          <div className="hero-glow" />
          <div className="hero-content">
            <span className="hero-eyebrow">A Building Story</span>
            <div className="hero-wordmark">
              <span className="de">DE</span><span className="sk">SK</span>
            </div>
            <div className="hero-series-label">Documentary Series</div>
            <p className="hero-tagline">
              A complete, unfiltered story of building a production-grade
              dependency risk intelligence system from scratch —
              every decision, every failure, every lesson.
            </p>
            <div className="hero-meta">
              <span>8 Episodes</span>
              <span className="hero-meta-dot" />
              <span>~{totalReadTime} minutes total</span>
              <span className="hero-meta-dot" />
              <span>PyPI · BigQuery · dbt · React · Vercel</span>
            </div>
          </div>
        </section>

        {/* Episodes */}
        <div className="section-header">
          <span className="section-title">All Episodes</span>
          <div className="section-line" />
        </div>

        <div className="episode-grid">
          {EPISODES.map(ep => (
            <EpisodeCard
              key={ep.id}
              ep={ep}
              onClick={() => onNavigate(ep.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="home-footer">
          <p>
            Built with Python · BigQuery · dbt · React · GitHub Actions · Vercel
          </p>
          <p style={{ marginTop: 8 }}>
            <a href="https://frontend-sand-seven-57.vercel.app" target="_blank" rel="noopener noreferrer">
              View the live DESK tool
            </a>
            {' · '}
            <a href="https://github.com/Raghavan2583/desk" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </main>
    </>
  )
}
