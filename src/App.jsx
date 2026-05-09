import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ReaderPage from './pages/ReaderPage'
import VocabPage from './pages/VocabPage'
import SpeakPage from './pages/SpeakPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <BrowserRouter basename="/bookspeak">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="reader" element={<ReaderPage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="speak" element={<SpeakPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
