import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
import { App } from './App'

if (import.meta.env.DEV) {
  // Dev-only hook for seeding sample data from the console or UI tests:
  //   await window.__gameTracker.seedSample()
  void Promise.all([import('./state/store'), import('./dev/sampleData'), import('./domain/releaseDate')]).then(
    ([store, sample, dates]) => {
      ;(window as unknown as Record<string, unknown>).__gameTracker = {
        store: store.useStore,
        seedSample: () =>
          store.__seedForDev(sample.sampleGames(dates.todayISO()), sample.SAMPLE_TAGS),
        clear: () => store.__seedForDev([], []),
      }
    },
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
