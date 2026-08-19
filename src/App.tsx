import { Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Today from './pages/Today'
import Trends from './pages/Trends'
import ProfilePage from './pages/Profile'
import SetupNeeded from './pages/SetupNeeded'
import Spinner from './components/Spinner'

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <SetupNeeded />
  if (loading) return <Spinner full />
  if (!session) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
