import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ouro = '#c9a227'
const prata = '#8e9eab'
const borda = '#2a5a3a'

export default function PerfilJogador() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [jogador, setJogador] = useState(null)
  const [jogadorAtual, setJogadorAtual] = useState(null)
  const [pontos, setPontos] = useState(0)
  const [parceiros, setParceiros] = useState([])
  const [adversarios, setAdversarios] = useState([])
  const [jogosDetalhados, setJogosDetalhados] = useState([])
  const [badges, setBadges] = useState([])
  const [h2hAberto, setH2hAberto] = useState(null)
  const [jogadoresMap, setJogadoresMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarPerfil() }, [id])

  async function carregarPerfil() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: meJogs } = await supabase.from('jogadores').select('id, nome').eq('user_id', user?.id).limit(1)
    setJogadorAtual(meJogs?.[0] || null)

    const { data: jog } = await supabase.from('jogadores').select('*').eq('id', id).limit(1)
    const jogadorData = jog?.[0]
    if (!jogadorData) { setLoading(false); return }
    setJogador(jogadorData)

    const { data: pts } = await supabase.from('pontuacao').select('pontos').eq('jogador_id', id)
    setPontos(pts?.reduce((s, p) => s + (p.pontos || 0), 0) || 0)

    const { data: bads } = await supabase.from('badges')
      .select('tipo, rodadas(numero)').eq('jogador_id', id).order('created_at', { ascending: false })
    setBadges(bads || [])

    const { data: todosJogs } = await supabase.from('jogadores').select('id, nome')
    const mapa = {}
    for (const j of (todosJogs || [])) mapa[j.nome] = j.id
    setJogadoresMap(mapa)

    const { data: jogos } = await supabase.from('jogos').select('*')
      .or(`dupla_a_1.eq.${jogadorData.nome},dupla_a_2.eq.${jogadorData.nome},dupla_b_1.eq.${jogadorData.nome},dupla_b_2.eq.${jogadorData.nome}`)

    if (!jogos || jogos.length === 0) { setLoading(false); return }

    const jogosComPlacar = jogos.filter(j => j.placar_a !== null && j.placar_b !== null)
    setJogosDetalhados(jogosComPlacar)

    const statsParc = {}
    const statsAdv = {}

    for (const jogo of jogosComPlacar) {
      const nomeJog = jogadorData.nome
      const estouNoA = jogo.dupla_a_1 === nomeJog || jogo.dupla_a_2 === nomeJog
      const euVenci = estouNoA ? jogo.placar_a > jogo.placar_b : jogo.placar_b > jogo.placar_a
      const parceiro = estouNoA
        ? (jogo.dupla_a_1 === nomeJog ? jogo.dupla_a_2 : jogo.dupla_a_1)
        : (jogo.dupla_b_1 === nomeJog ? jogo.dupla_b_2 : jogo.dupla_b_1)

      if (parceiro) {
        if (!statsParc[parceiro]) statsParc[parceiro] = { jogos: 0, vitorias: 0 }
        statsParc[parceiro].jogos++
        if (euVenci) statsParc[parceiro].vitorias++
      }

      // Conta o jogo uma vez para cada adversário (mas o jogo é 1 só)
      const advs = estouNoA
        ? [jogo.dupla_b_1, jogo.dupla_b_2].filter(Boolean)
        : [jogo.dupla_a_1, jogo.dupla_a_2].filter(Boolean)

      // Usa um Set para evitar duplicar o jogo
      const jogoKey = jogo.id
      for (const adv of advs) {
        if (!statsAdv[adv]) statsAdv[adv] = { jogos: 0, vitorias: 0, jogoIds: new Set() }
        if (!statsAdv[adv].jogoIds.has(jogoKey)) {
          statsAdv[adv].jogoIds.add(jogoKey)
          statsAdv[adv].jogos++
          if (euVenci) statsAdv[adv].vitorias++
        }
      }
    }

    setParceiros(Object.entries(statsParc)
      .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
      .sort((a, b) => b.jogos - a.jogos))

    setAdversarios(Object.entries(statsAdv)
      .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
      .sort((a, b) => b.jogos - a.jogos))

    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
  if (!jogador) return <div><button onClick={() => navigate(-1)} style={btnVoltar}>← Voltar</button><p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40 }}>Jogador não encontrado.</p></div>

  // H2H com jogador atual
  const nomeAtual = jogadorAtual?.nome
  const nomeJogador = jogador.nome

  const totalJogos = jogosDetalhados.length
  const totalVitorias = jogosDetalhados.filter(j => {
    const estouNoA = j.dupla_a_1 === nomeJogador || j.dupla_a_2 === nomeJogador
    return estouNoA ? j.placar_a > j.placar_b : j.placar_b > j.placar_a
  }).length
  const totalDerrotas = totalJogos - totalVitorias
  const pctGeral = totalJogos > 0 ? Math.round(totalVitorias / totalJogos * 100) : 0

  // Jogos como adversários
  const jogosH2H = jogosDetalhados.filter(j => {
    if (!nomeAtual) return false
    const euNoA = j.dupla_a_1 === nomeAtual || j.dupla_a_2 === nomeAtual
    const euNoB = j.dupla_b_1 === nomeAtual || j.dupla_b_2 === nomeAtual
    const eleNoA = j.dupla_a_1 === nomeJogador || j.dupla_a_2 === nomeJogador
    const eleNoB = j.dupla_b_1 === nomeJogador || j.dupla_b_2 === nomeJogador
    return (euNoA && eleNoB) || (euNoB && eleNoA)
  })

  // Jogos como parceiros
  const jogosJuntos = jogosDetalhados.filter(j => {
    if (!nomeAtual) return false
    const euNoA = j.dupla_a_1 === nomeAtual || j.dupla_a_2 === nomeAtual
    const euNoB = j.dupla_b_1 === nomeAtual || j.dupla_b_2 === nomeAtual
    const eleNoA = j.dupla_a_1 === nomeJogador || j.dupla_a_2 === nomeJogador
    const eleNoB = j.dupla_b_1 === nomeJogador || j.dupla_b_2 === nomeJogador
    return (euNoA && eleNoA) || (euNoB && eleNoB)
  })

  const h2hStats = { vitorias: 0, derrotas: 0 }
  for (const j of jogosH2H) {
    const estouNoA = j.dupla_a_1 === nomeAtual || j.dupla_a_2 === nomeAtual
    const venci = estouNoA ? j.placar_a > j.placar_b : j.placar_b > j.placar_a
    if (venci) h2hStats.vitorias++; else h2hStats.derrotas++
  }

  const juntosStats = { vitorias: 0, derrotas: 0 }
  for (const j of jogosJuntos) {
    const estouNoA = j.dupla_a_1 === nomeAtual || j.dupla_a_2 === nomeAtual
    const venci = estouNoA ? j.placar_a > j.placar_b : j.placar_b > j.placar_a
    if (venci) juntosStats.vitorias++; else juntosStats.derrotas++
  }

  const BADGE_INFO = {
    campeao_ouro:  { emoji: '🥇', label: 'Campeão Ouro',  cor: '#c9a227' },
    campeao_prata: { emoji: '🥈', label: 'Campeão Prata', cor: '#8e9eab' },
    dia_perfeito:  { emoji: '💪', label: 'Dia Perfeito',  cor: '#2ecc71' },
    hat_trick:     { emoji: '🔥', label: 'Hat-trick',     cor: '#e74c3c' },
  artilheiro:    { emoji: '🎯', label: 'Artilheiro',    cor: '#f39c12' },
  relampago:     { emoji: '⚡', label: 'Relampago',     cor: '#f1c40f' },
  ascensao:      { emoji: '📈', label: 'Ascensao',      cor: '#1abc9c' },
  dia_negro:     { emoji: '💀', label: 'Dia Negro',     cor: '#636e72' },
  congelado:     { emoji: '🥶', label: 'Congelado',     cor: '#74b9ff' },
  pneu:          { emoji: '🍩', label: 'Pneu',          cor: '#fd79a8' },
  dormindo:      { emoji: '😴', label: 'Dormindo',      cor: '#b2bec3' },
  queda_livre:   { emoji: '📉', label: 'Queda Livre',   cor: '#d63031' },
  }

  function Barra({ pct }) {
    return (
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 50 ? '#2d7a45' : '#c0392b', borderRadius: 2 }} />
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} style={btnVoltar}>← Voltar</button>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #112918, #0d2b1a)', border: '1px solid rgba(245,197,24,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(245,197,24,0.3)', background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {jogador.foto_url
              ? <img src={jogador.foto_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif" }}>{jogador.nome?.charAt(0)?.toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, lineHeight: 1, color: '#fff' }}>{jogador.nome}</div>
            <div style={{ marginTop: 6 }}>
              {jogador.chave === 'ouro' ? <span className="badge-ouro">Chave Ouro</span> : <span className="badge-prata">Chave Prata</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: ouro }}>{pontos}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>pontos</div>
          </div>
        </div>
      </div>

      {/* Stats */}
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

      {/* H2H com jogador atual */}
      {nomeAtual && nomeAtual !== nomeJogador && jogosH2H.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(201,162,39,0.3)', background: 'linear-gradient(135deg, #1a2a1a, #0d2b1a)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ouro, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            ⚔️ Seu H2H com {nomeJogador}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#2ecc71', lineHeight: 1 }}>{h2hStats.vitorias}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Suas vitórias</div>
            </div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.2)' }}>×</div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#e74c3c', lineHeight: 1 }}>{h2hStats.derrotas}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Suas derrotas</div>
            </div>
          </div>
          {jogosH2H.map((j, ji) => {
            const estouNoA = j.dupla_a_1 === nomeAtual || j.dupla_a_2 === nomeAtual
            const venci = estouNoA ? j.placar_a > j.placar_b : j.placar_b > j.placar_a
            const meuPlacar = estouNoA ? j.placar_a : j.placar_b
            const advPlacar = estouNoA ? j.placar_b : j.placar_a
            const meuParc = estouNoA
              ? (j.dupla_a_1 === nomeAtual ? j.dupla_a_2 : j.dupla_a_1)
              : (j.dupla_b_1 === nomeAtual ? j.dupla_b_2 : j.dupla_b_1)
            const parcEle = estouNoA
              ? (j.dupla_b_1 === nomeJogador ? j.dupla_b_2 : j.dupla_b_1)
              : (j.dupla_a_1 === nomeJogador ? j.dupla_a_2 : j.dupla_a_1)
            return (
              <div key={ji} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{venci ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#e8f5e9' }}>
                      <span style={{ color: '#2ecc71', fontWeight: 600 }}>{nomeAtual}</span>
                      {meuParc ? <span style={{ color: 'rgba(255,255,255,0.5)' }}> / {meuParc}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: '#e8f5e9', marginTop: 2 }}>
                      <span style={{ color: '#e74c3c', fontWeight: 600 }}>{nomeJogador}</span>
                      {parcEle ? <span style={{ color: 'rgba(255,255,255,0.5)' }}> / {parcEle}</span> : null}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: venci ? '#2ecc71' : '#e74c3c', fontFamily: "'Bebas Neue', sans-serif" }}>
                    {meuPlacar} × {advPlacar}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Jogos juntos */}
      {nomeAtual && nomeAtual !== nomeJogador && jogosJuntos.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(46,204,113,0.3)', background: 'linear-gradient(135deg, #0d2b1a, #112918)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2ecc71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            🤝 Jogos juntos com {nomeJogador}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#2ecc71', lineHeight: 1 }}>{juntosStats.vitorias}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Vitórias juntos</div>
            </div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.2)' }}>×</div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: '#e74c3c', lineHeight: 1 }}>{juntosStats.derrotas}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Derrotas juntos</div>
            </div>
          </div>
          {jogosJuntos.map((j, ji) => {
            const estouNoA = j.dupla_a_1 === nomeAtual || j.dupla_a_2 === nomeAtual
            const venci = estouNoA ? j.placar_a > j.placar_b : j.placar_b > j.placar_a
            const meuPlacar = estouNoA ? j.placar_a : j.placar_b
            const advPlacar = estouNoA ? j.placar_b : j.placar_a
            const adv1 = estouNoA ? j.dupla_b_1 : j.dupla_a_1
            const adv2 = estouNoA ? j.dupla_b_2 : j.dupla_a_2
            return (
              <div key={ji} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{venci ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#2ecc71', fontWeight: 600 }}>{nomeAtual} / {nomeJogador}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>vs {[adv1, adv2].filter(Boolean).join(' / ')}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: venci ? '#2ecc71' : '#e74c3c', fontFamily: "'Bebas Neue', sans-serif" }}>
                    {meuPlacar} × {advPlacar}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🏅 Conquistas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {badges.map((b, i) => {
              const info = BADGE_INFO[b.tipo] || { emoji: '🏅', label: b.tipo, cor: '#7fb89a' }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: info.cor + '15', border: '1px solid ' + info.cor + '40', borderRadius: 20 }}>
                  <span style={{ fontSize: 13 }}>{info.emoji}</span>
                  <span style={{ fontSize: 11, color: info.cor, fontWeight: 700 }}>{info.label}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>R{b.rodadas?.numero}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Parceiros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
          🤝 Histórico com Parceiros
        </h3>
        {parceiros.length === 0
          ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum dado disponível</p>
          : parceiros.map((p, i) => (
            <div key={p.nome} style={{ padding: '10px 0', borderTop: i > 0 ? `1px solid ${borda}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div onClick={() => jogadoresMap[p.nome] && navigate('/jogador/' + jogadoresMap[p.nome])}
                  style={{ fontSize: 13, fontWeight: 600, color: jogadoresMap[p.nome] ? ouro : '#e8f5e9', cursor: jogadoresMap[p.nome] ? 'pointer' : 'default' }}>
                  {p.nome}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#2d7a45' }}>{p.vitorias}V</span>
                  <span style={{ color: '#c0392b' }}>{p.derrotas}D</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{p.jogos}j</span>
                  <span style={{ color: '#f5c518', fontWeight: 700 }}>{p.pct}%</span>
                </div>
              </div>
              <Barra pct={p.pct} />
            </div>
          ))}
      </div>

      {/* Adversários com H2H expandível */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
          ⚔️ Histórico contra Adversários
        </h3>
        {adversarios.length === 0
          ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum dado disponível</p>
          : adversarios.map((a, i) => {
            const aberto = h2hAberto === a.nome
            const jogosAdv = jogosDetalhados.filter(j => {
              const estouNoA = j.dupla_a_1 === nomeJogador || j.dupla_a_2 === nomeJogador
              const advs = estouNoA ? [j.dupla_b_1, j.dupla_b_2] : [j.dupla_a_1, j.dupla_a_2]
              return advs.includes(a.nome)
            })
            return (
              <div key={a.nome} style={{ borderTop: i > 0 ? `1px solid ${borda}` : 'none' }}>
                <div onClick={() => setH2hAberto(aberto ? null : a.nome)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: aberto ? ouro : 'rgba(255,255,255,0.2)', fontSize: 12 }}>{aberto ? '▾' : '▸'}</span>
                    <div onClick={(e) => { e.stopPropagation(); jogadoresMap[a.nome] && navigate('/jogador/' + jogadoresMap[a.nome]) }}
                      style={{ fontSize: 13, fontWeight: 600, color: aberto ? ouro : '#e8f5e9' }}>{a.nome}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                    <span style={{ color: '#2d7a45' }}>{a.vitorias}V</span>
                    <span style={{ color: '#c0392b' }}>{a.derrotas}D</span>
                    <span style={{ color: '#f5c518', fontWeight: 700 }}>{a.pct}%</span>
                  </div>
                </div>
                <Barra pct={a.pct} />
                {aberto && (
                  <div style={{ marginBottom: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
                    {jogosAdv.map((j, ji) => {
                      const estouNoA = j.dupla_a_1 === nomeJogador || j.dupla_a_2 === nomeJogador
                      const venci = estouNoA ? j.placar_a > j.placar_b : j.placar_b > j.placar_a
                      const meuPlacar = estouNoA ? j.placar_a : j.placar_b
                      const advPlacar = estouNoA ? j.placar_b : j.placar_a
                      const meuParc = estouNoA
                        ? (j.dupla_a_1 === nomeJogador ? j.dupla_a_2 : j.dupla_a_1)
                        : (j.dupla_b_1 === nomeJogador ? j.dupla_b_2 : j.dupla_b_1)
                      return (
                        <div key={ji} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: ji < jogosAdv.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ fontSize: 14 }}>{venci ? '✅' : '❌'}</span>
                          <div style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>c/ {meuParc || '–'}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: venci ? '#2ecc71' : '#e74c3c' }}>{meuPlacar} × {advPlacar}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

const btnVoltar = {
  background: 'transparent', border: '1px solid #2a5a3a', color: '#7fb89a',
  borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'block'
}
