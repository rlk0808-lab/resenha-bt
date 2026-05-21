import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('Email ou senha incorretos')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a1f12 0%, #0d2b1a 50%, #081810 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'
      }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(45,122,69,0.15) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(245,197,24,0.08) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '100px', height: '100px',
            background: 'linear-gradient(135deg, #1a4d2e, #0d2b1a)',
            borderRadius: '20px',
            border: '2px solid rgba(245,197,24,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <ellipse cx="20" cy="22" rx="10" ry="13" fill="#f5c518" transform="rotate(-25 20 22)" />
              <ellipse cx="20" cy="22" rx="7" ry="10" fill="#c9a010" transform="rotate(-25 20 22)" />
              <line x1="26" y1="33" x2="14" y2="52" stroke="#f5c518" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="44" cy="22" rx="10" ry="13" fill="#f5c518" transform="rotate(25 44 22)" />
              <ellipse cx="44" cy="22" rx="7" ry="10" fill="#c9a010" transform="rotate(25 44 22)" />
              <line x1="38" y1="33" x2="50" y2="52" stroke="#f5c518" strokeWidth="3" strokeLinecap="round" />
              <circle cx="32" cy="32" r="8" fill="#e8621a" />
              <path d="M26 28 Q32 22 38 28" stroke="#2d7a45" strokeWidth="1.5" fill="none" />
              <path d="M26 36 Q32 42 38 36" stroke="#2d7a45" strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '48px',
            letterSpacing: '4px',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #f5c518, #ffffff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>RESENHA BT</h1>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px',
            letterSpacing: '4px',
            color: '#2d7a45',
            marginTop: '4px'
          }}>BEACH TENNIS</p>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '24px',
            textAlign: 'center'
          }}>ENTRAR NA LIGA</h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '8px'
              }}>Email</label>
              <input
                className="input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '8px'
              }}>Senha</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
            </div>

            {erro && (
              <div style={{
                background: 'rgba(232,98,26,0.1)',
                border: '1px solid rgba(232,98,26,0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '14px',
                color: '#e8621a',
                textAlign: 'center'
              }}>{erro}</div>
            )}

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.3)'
        }}>
          Não tem acesso? Fale com o administrador
        </p>
      </div>
    </div>
  )
}