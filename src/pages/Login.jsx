import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [resetando, setResetando] = useState(false)
  const [msgReset, setMsgReset] = useState('')

  async function handleReset() {
    if (!email) { setErro('Digite seu email para resetar a senha'); return }
    setResetando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://resenha-bt.vercel.app/redefinir-senha'
    })
    if (error) setErro('Erro ao enviar email. Verifique o email digitado.')
    else setMsgReset('Email enviado! Verifique sua caixa de entrada.')
    setResetando(false)
  }

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
          {/* Logo principal */}
          <div style={{
            width: '160px',
            height: '160px',
            margin: '0 auto 24px',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 3px rgba(201,162,39,0.3)',
          }}>
            <img
              src="/logo.png"
              alt="Resenha BT"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
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
            {msgReset && (
              <div style={{ color: '#2ecc71', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{msgReset}</div>
            )}
            <button type="button" onClick={handleReset} disabled={resetando} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', marginTop: 8, textDecoration: 'underline', width: '100%', textAlign: 'center' }}>
              {resetando ? 'Enviando...' : 'Esqueci minha senha'}
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
