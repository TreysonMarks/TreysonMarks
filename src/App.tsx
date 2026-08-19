import { Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Today from './pages/Today'
import Trends from './pages/Trends'
import ProfilePage from './pages/Profile'
import Supplements from './pages/Supplements'
import Onboarding from './pages/Onboarding'
import Spinner from './components/Spinner'

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <Onboarding />
  if (loading) return <Spinner full />
  if (!session) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/supplements" element={<Supplements />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
