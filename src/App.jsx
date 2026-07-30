import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, Suspense, lazy } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'

const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha'))
const Stats = lazy(() => import('./pages/Stats'))
const Home = lazy(() => import('./pages/Home'))
const Classificacao = lazy(() => import('./pages/Classificacao'))
const Rodada = lazy(() => import('./pages/Rodada'))
const Perfil = lazy(() => import('./pages/Perfil'))
const PerfilJogador = lazy(() => import('./pages/PerfilJogador'))
const Feed = lazy(() => import('./pages/Feed'))
const Admin = lazy(() => import('./pages/Admin'))
const Confirmacao = lazy(() => import('./pages/Confirmacao'))
const Cadastro = lazy(() => import('./pages/Cadastro'))

function CarregandoPagina() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [splash, setSplash] = useState(true)

  useEffect(() => {
    setTimeout(() => setSplash(false), 2000)
  }, [])

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

  if (splash || loading) return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a1f12',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <img src="/logo.png" alt="Resenha BT" style={{ width: 120, height: 120, marginBottom: 24, borderRadius: 24 }} />
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 4, color: '#c9a227', marginBottom: 8 }}>
        RESENHA BT
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>
        Liga de Beach Tennis
      </div>
      <div style={{ marginTop: 48 }}>
        <div className="spinner" />
      </div>
    </div>
  )

  return (
    <BrowserRouter>
      <Suspense fallback={<CarregandoPagina />}>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/" element={session ? <Layout session={session} /> : <Navigate to="/login" />}>
            <Route index element={<Home />} />
            <Route path="classificacao" element={<Classificacao />} />
            <Route path="rodada" element={<Rodada />} />
            <Route path="admin" element={<Admin session={session} />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="feed" element={<Feed />} />
            <Route path="jogador/:id" element={<PerfilJogador />} />
            <Route path="confirmacao" element={<Confirmacao session={session} />} />
            <Route path="stats" element={<Stats />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
