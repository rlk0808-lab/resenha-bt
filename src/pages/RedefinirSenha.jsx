import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function RedefinirSenha() {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleRedefinir(e) {
    e.preventDefault()
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres'); return }
    if (senha !== confirmar) { setErro('As senhas nao coincidem'); return }
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) setErro('Erro ao redefinir senha. Tente novamente.')
    else setSucesso(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a1f12 0%, #0d2b1a 50%, #081810 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.png" alt="Resenha BT" style={{ width: 64, height: 64, borderRadius: 14, marginBottom: 12 }} />
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color: '#c9a227' }}>RESENHA BT</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Redefinir Senha</div>
        </div>

        {sucesso ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ color: '#2ecc71', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Senha redefinida!</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>Sua senha foi alterada com sucesso.</div>
            <a href="/login" style={{ display: 'block', background: '#c9a227', color: '#0d2b1a', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' }}>
              Ir para o Login
            </a>
          </div>
        ) : (
          <form onSubmit={handleRedefinir}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nova Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Minimo 6 caracteres"
                required
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: '#e8f5e9', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Confirmar Senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                required
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', color: '#e8f5e9', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>
            {erro && <div style={{ color: '#e74c3c', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{erro}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', background: '#c9a227', color: '#0d2b1a', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
