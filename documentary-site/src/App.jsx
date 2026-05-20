import { useState, useEffect } from 'react'
import HomePage from './HomePage.jsx'
import EpisodePage from './EpisodePage.jsx'

export default function App() {
  const [episode, setEpisode] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ep = params.get('ep')
    if (ep) setEpisode(parseInt(ep, 10))
  }, [])

  const navigate = (id) => {
    if (id === null) {
      window.history.pushState({}, '', window.location.pathname)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.history.pushState({}, '', `?ep=${id}`)
      window.scrollTo({ top: 0 })
    }
    setEpisode(id)
  }

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search)
      const ep = params.get('ep')
      setEpisode(ep ? parseInt(ep, 10) : null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return episode
    ? <EpisodePage episodeId={episode} onNavigate={navigate} />
    : <HomePage onNavigate={navigate} />
}
