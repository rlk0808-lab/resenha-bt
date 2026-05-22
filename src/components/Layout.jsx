import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Home, Trophy, Calendar, User, LogOut, Settings } from 'lucide-react'

export default function Layout({ session }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/', icon: Home, label: 'Início' },
    { to: '/classificacao', icon: Trophy, label: 'Classificação' },
    { to: '/rodada', icon: Calendar, label: 'Rodada' },
    { to: '/perfil', icon: User, label: 'Perfil' },
    { to: '/admin', icon: Settings, label: 'Admin' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'linear-gradient(90deg, #0d2b1a, #112918)',
        borderBottom: '1px solid #1e4030',
        padding: '0 20px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #1a4d2e, #0d2b1a)',
            borderRadius: '8px',
            border: '1px solid rgba(245,197,24,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
              <ellipse cx="20" cy="22" rx="10" ry="13" fill="#f5c518" transform="rotate(-25 20 22)" />
              <line x1="26" y1="33" x2="14" y2="52" stroke="#f5c518" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="44" cy="22" rx="10" ry="13" fill="#f5c518" transform="rotate(25 44 22)" />
              <line x1="38" y1="33" x2="50" y2="52" stroke="#f5c518" strokeWidth="3" strokeLinecap="round" />
              <circle cx="32" cy="32" r="8" fill="#e8621a" />
            </svg>
          </div>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '24px',
            letterSpacing: '3px',
            background: 'linear-gradient(135deg, #f5c518, #ffffff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>RESENHA BT</span>
        </div>

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