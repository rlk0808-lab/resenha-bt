import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import Classificacao from './pages/Classificacao'
import Rodada from './pages/Rodada'
import Perfil from './pages/Perfil'
import Admin from './pages/Admin'
import Layout from './components/Layout'
import Confirmacao from './pages/Confirmacao'


export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: '#0a1628',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div className="spinner" />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Layout session={session} /> : <Navigate to="/login" />}>
          <Route index element={<Home />} />
          <Route path="classificacao" element={<Classificacao />} />
          <Route path="rodada" element={<Rodada />} />
          <Route path="admin" element={<Admin session={session} />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="confirmacao" element={<Confirmacao session={session} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
