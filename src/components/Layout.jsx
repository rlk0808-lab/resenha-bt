import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Home, Trophy, Calendar, User, LogOut, Settings, ClipboardList, MessageCircle } from 'lucide-react'

const ADMINS = [
  'a60b3e0f-5528-400c-8e0f-8fb3f9226070', // Robson
  '118a0596-1e11-4943-b8f2-9e49bd234dcf', // Celso
  'a506b568-7183-4aab-b86f-5adbb5f435a6', // Marcel
];

export default function Layout({ session }) {
  const navigate = useNavigate()
  const isAdmin = ADMINS.includes(session?.user?.id)
  const [temaClaro, setTemaClaro] = useState(() => localStorage.getItem('tema') === 'light')

  useEffect(() => {
    if (temaClaro) {
      document.body.classList.add('light')
      localStorage.setItem('tema', 'light')
    } else {
      document.body.classList.remove('light')
      localStorage.setItem('tema', 'dark')
    }
  }, [temaClaro])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/', icon: Home, label: 'Início' },
    { to: '/feed', icon: MessageCircle, label: 'Feed' },
    { to: '/classificacao', icon: Trophy, label: 'Classificação' },
    { to: '/rodada', icon: Calendar, label: 'Rodada' },
    { to: '/perfil', icon: User, label: 'Perfil' },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Admin' }] : []),
    { to: '/confirmacao', icon: ClipboardList, label: 'Presença' },
    { to: '/stats', icon: TrendingUp, label: 'Stats' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'linear-gradient(90deg, #0d2b1a, #112918)',
        borderBottom: '1px solid #1e4030',
        padding: '0 16px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)'
      }}>
        {/* Logo no header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1.5px solid rgba(201,162,39,0.5)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            flexShrink: 0,
          }}>
            <img
              src="/logo.png"
              alt="Resenha BT"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '22px',
            letterSpacing: '3px',
            background: 'linear-gradient(135deg, #f5c518, #ffffff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>RESENHA BT</span>
        </div>

        <button
          onClick={() => setTemaClaro(!temaClaro)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'rgba(255,255,255,0.7)',
            marginRight: '6px',
          }}
        >
          {temaClaro ? '🌙' : '☀️'}
        </button>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '7px 12px',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
            e.currentTarget.style.color = '#ffffff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
          }}
        >
          <LogOut size={14} />
          Sair
        </button>
      </header>

      <main style={{
        flex: 1,
        padding: '24px 20px',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%'
      }}>
        <Outlet />
      </main>

      <nav style={{
        position: 'sticky',
        bottom: 0,
        background: 'linear-gradient(0deg, #0d2b1a, #112918)',
        borderTop: '1px solid #1e4030',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0',
        zIndex: 100
      }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 16px',
              borderRadius: '10px',
              textDecoration: 'none',
              color: isActive ? '#f5c518' : 'rgba(255,255,255,0.4)',
              background: isActive ? 'rgba(245,197,24,0.08)' : 'transparent',
              transition: 'all 0.2s',
              minWidth: '64px'
            })}
          >
            <Icon size={20} />
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              fontFamily: "'Barlow Condensed', sans-serif"
            }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
