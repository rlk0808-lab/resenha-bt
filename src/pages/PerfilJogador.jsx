import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PerfilJogador() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [jogador, setJogador] = useState(null)
  const [pontos, setPontos] = useState(0)
  const [parceiros, setParceiros] = useState([])
  const [adversarios, setAdversarios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarPerfil()
  }, [id])

  async function carregarPerfil() {
    setLoading(true)

    // Busca jogador
    const { data: jog } = await supabase
      .from('jogadores').select('*').eq('id', id).limit(1)
    const jogadorData = jog?.[0]
    if (!jogadorData) { setLoading(false); return }
    setJogador(jogadorData)

    // Busca total de pontos
    const { data: pts } = await supabase
      .from('pontuacao').select('pontos').eq('jogador_id', id)
    const totalPontos = pts?.reduce((s, p) => s + (p.pontos || 0), 0) || 0
    setPontos(totalPontos)

    // Busca todos os jogos onde este jogador participou
    const { data: jogos } = await supabase
      .from('jogos')
      .select('*')
      .or(`dupla_a_1.eq.${jogadorData.nome},dupla_a_2.eq.${jogadorData.nome},dupla_b_1.eq.${jogadorData.nome},dupla_b_2.eq.${jogadorData.nome}`)

    if (!jogos || jogos.length === 0) {
      setLoading(false)
      return
    }

    // Calcula stats de parceiros e adversários
    const statsParc = {}
    const statsAdv = {}

    for (const jogo of jogos) {
      if (jogo.placar_a === null || jogo.placar_b === null) continue

      const nomeJog = jogadorData.nome
      const estouNoA = jogo.dupla_a_1 === nomeJog || jogo.dupla_a_2 === nomeJog
      const venceuA = jogo.placar_a > jogo.placar_b
      const euVenci = estouNoA ? venceuA : !venceuA

      // Parceiro
      let parceiro = null
      if (estouNoA) {
        parceiro = jogo.dupla_a_1 === nomeJog ? jogo.dupla_a_2 : jogo.dupla_a_1
      } else {
        parceiro = jogo.dupla_b_1 === nomeJog ? jogo.dupla_b_2 : jogo.dupla_b_1
      }

      if (parceiro) {
        if (!statsParc[parceiro]) statsParc[parceiro] = { jogos: 0, vitorias: 0 }
        statsParc[parceiro].jogos++
        if (euVenci) statsParc[parceiro].vitorias++
      }

      // Adversários
      const adversariosJogo = estouNoA
        ? [jogo.dupla_b_1, jogo.dupla_b_2].filter(Boolean)
        : [jogo.dupla_a_1, jogo.dupla_a_2].filter(Boolean)

      for (const adv of adversariosJogo) {
        if (!statsAdv[adv]) statsAdv[adv] = { jogos: 0, vitorias: 0 }
        statsAdv[adv].jogos++
        if (euVenci) statsAdv[adv].vitorias++
      }
    }

    // Converte para arrays ordenados por jogos
    const parceirosList = Object.entries(statsParc)
      .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
      .sort((a, b) => b.jogos - a.jogos)

    const adversariosList = Object.entries(statsAdv)
      .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
      .sort((a, b) => b.jogos - a.jogos)

    setParceiros(parceirosList)
    setAdversarios(adversariosList)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  if (!jogador) return (
    <div>
      <button onClick={() => navigate(-1)} style={btnVoltar}>← Voltar</button>
      <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40 }}>Jogador não encontrado.</p>
    </div>
  )

  const totalJogos = parceiros.reduce((s, p) => s + p.jogos, 0)
  const totalVitorias = parceiros.reduce((s, p) => s + p.vitorias, 0)
  const totalDerrotas = totalJogos - totalVitorias
  const pctGeral = totalJogos > 0 ? Math.round(totalVitorias / totalJogos * 100) : 0

  const ouro = '#c9a227'
  const prata = '#8e9eab'
  const borda = '#2a5a3a'
  const cardBg = '#162f20'

  function BarraStats({ vitorias, jogos }) {
    const pct = jogos > 0 ? (vitorias / jogos * 100) : 0
    return (
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 50 ? '#2d7a45' : '#c0392b', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Botão voltar */}
      <button onClick={() => navigate(-1)} style={btnVoltar}>← Voltar</button>

      {/* Header do jogador */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #112918, #0d2b1a)', border: '1px solid rgba(245,197,24,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            border: '2px solid rgba(245,197,24,0.3)',
            background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {jogador.foto_url
              ? <img src={jogador.foto_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif" }}>{jogador.nome?.charAt(0)?.toUpperCase()}</span>
            }
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, lineHeight: 1, color: '#fff' }}>
              {jogador.nome}
            </div>
            <div style={{ marginTop: 6 }}>
              {jogador.chave === 'ouro'
                ? <span className="badge-ouro">Chave Ouro</span>
                : <span className="badge-prata">Chave Prata</span>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: ouro }}>{pontos}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>pontos</div>
          </div>
        </div>
      </div>

      {/* Stats gerais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Jogos', valor: totalJogos, cor: '#7fb89a' },
          { label: 'Vitórias', valor: totalVitorias, cor: '#2d7a45' },
          { label: 'Derrotas', valor: totalDerrotas, cor: '#c0392b' },
          { label: 'Aproveito.', valor: `${pctGeral}%`, cor: '#f5c518' },
        ].map(({ label, valor, cor }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: cor, lineHeight: 1 }}>{valor}</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Histórico com parceiros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 16, margin: '0 0 16px' }}>
          🤝 Histórico com Parceiros
        </h3>
        {parceiros.length === 0
          ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum dado disponível</p>
          : parceiros.map((p, i) => (
            <div key={p.nome} style={{ padding: '10px 0', borderTop: i > 0 ? `1px solid ${borda}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e9' }}>{p.nome}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#2d7a45' }}>{p.vitorias}V</span>
                  <span style={{ color: '#c0392b' }}>{p.derrotas}D</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{p.jogos} jogos</span>
                  <span style={{ color: '#f5c518', fontWeight: 700 }}>{p.pct}%</span>
                </div>
              </div>
              <BarraStats vitorias={p.vitorias} jogos={p.jogos} />
            </div>
          ))
        }
      </div>

      {/* Histórico contra adversários */}
      <div className="card">
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
          ⚔️ Histórico contra Adversários
        </h3>
        {adversarios.length === 0
          ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum dado disponível</p>
          : adversarios.map((a, i) => (
            <div key={a.nome} style={{ padding: '10px 0', borderTop: i > 0 ? `1px solid ${borda}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e9' }}>{a.nome}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#2d7a45' }}>{a.vitorias}V</span>
                  <span style={{ color: '#c0392b' }}>{a.derrotas}D</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{a.jogos} jogos</span>
                  <span style={{ color: '#f5c518', fontWeight: 700 }}>{a.pct}%</span>
                </div>
              </div>
              <BarraStats vitorias={a.vitorias} jogos={a.jogos} />
            </div>
          ))
        }
      </div>
    </div>
  )
}

const btnVoltar = {
  background: 'transparent',
  border: '1px solid #2a5a3a',
  color: '#7fb89a',
  borderRadius: 8,
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 13,
  marginBottom: 16,
  display: 'block'
}