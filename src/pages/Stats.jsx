import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const BADGE_INFO = {
  campeao_ouro:  { emoji: '🥇', label: 'Campeao Ouro',  cor: '#c9a227', positivo: true },
  campeao_prata: { emoji: '🥈', label: 'Campeao Prata', cor: '#8e9eab', positivo: true },
  dia_perfeito:  { emoji: '💪', label: 'Dia Perfeito',  cor: '#2ecc71', positivo: true },
  hat_trick:     { emoji: '🔥', label: 'Hat-trick',     cor: '#e74c3c', positivo: true },
  artilheiro:    { emoji: '🎯', label: 'Artilheiro',    cor: '#f39c12', positivo: true },
  relampago:     { emoji: '⚡', label: 'Relampago',     cor: '#f1c40f', positivo: true },
  ascensao:      { emoji: '📈', label: 'Ascensao',      cor: '#1abc9c', positivo: true },
  dia_negro:     { emoji: '💀', label: 'Dia Negro',     cor: '#636e72', positivo: false },
  congelado:     { emoji: '🥶', label: 'Congelado',     cor: '#74b9ff', positivo: false },
  pneu:          { emoji: '🍩', label: 'Pneu',          cor: '#fd79a8', positivo: false },
  dormindo:      { emoji: '😴', label: 'Dormindo',      cor: '#b2bec3', positivo: false },
  queda_livre:   { emoji: '📉', label: 'Queda Livre',   cor: '#d63031', positivo: false },
}

export default function Stats() {
  const [badges, setBadges] = useState([])
  const [pontuacao, setPontuacao] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('badges')

  useEffect(() => {
    async function carregar() {
      const { data: b } = await supabase
        .from('badges')
        .select('tipo, jogadores(nome, foto_url)')
      setBadges(b || [])

      const { data: p } = await supabase
        .from('pontuacao')
        .select('jogador_id, vitorias, jogadores(nome, foto_url)')
      setPontuacao(p || [])

      setLoading(false)
    }
    carregar()
  }, [])

  // Agrupa badges por tipo
  const rankingBadges = Object.entries(BADGE_INFO).map(([tipo, info]) => {
    const jogadoresComBadge = {}
    badges.filter(b => b.tipo === tipo).forEach(b => {
      const nome = b.jogadores?.nome
      if (!nome) return
      if (!jogadoresComBadge[nome]) jogadoresComBadge[nome] = { nome, foto: b.jogadores?.foto_url, count: 0 }
      jogadoresComBadge[nome].count++
    })
    const ranking = Object.values(jogadoresComBadge).sort((a,b) => b.count - a.count).slice(0, 3)
    return { tipo, info, ranking }
  }).filter(r => r.ranking.length > 0)

  // Stats gerais
  const statsJogadores = {}
  pontuacao.forEach(p => {
    const nome = p.jogadores?.nome
    if (!nome) return
    if (!statsJogadores[nome]) statsJogadores[nome] = { nome, foto: p.jogadores?.foto_url, vitorias: 0, rodadas: 0 }
    statsJogadores[nome].vitorias += p.vitorias || 0
    statsJogadores[nome].rodadas++
  })
  const rankingVitorias = Object.values(statsJogadores).sort((a,b) => b.vitorias - a.vitorias).slice(0, 10)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, color: '#c9a227', marginBottom: 16 }}>
        📊 ESTATÍSTICAS
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ key: 'badges', label: '🏅 Badges' }, { key: 'vitorias', label: '🏆 Vitórias' }].map(({ key, label }) => (
          <button key={key} onClick={() => setAba(key)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: aba === key ? '#c9a227' : 'rgba(255,255,255,0.06)',
            color: aba === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
          }}>{label}</button>
        ))}
      </div>

      {aba === 'badges' && (
        <div>
          {rankingBadges.map(({ tipo, info, ranking }) => (
            <div key={tipo} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${info.cor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{info.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: info.cor }}>{info.label}</span>
              </div>
              {ranking.map((j, idx) => (
                <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: idx === 0 ? info.cor : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                  {j.foto ? (
                    <img src={j.foto} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: info.cor + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: info.cor }}>
                      {j.nome[0]}
                    </div>
                  )}
                  <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: info.cor }}>{j.count}x</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {aba === 'vitorias' && (
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            🏆 Mais Vitórias no Torneio
          </div>
          {rankingVitorias.map((j, idx) => (
            <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < rankingVitorias.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width: 24, fontSize: 13, fontWeight: 700, color: idx < 3 ? '#c9a227' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}
              </div>
              {j.foto ? (
                <img src={j.foto} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(201,162,39,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#c9a227' }}>
                  {j.nome[0]}
                </div>
              )}
              <div style={{ flex: 1, fontSize: 14, color: '#e8f5e9' }}>{j.nome}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2ecc71' }}>{j.vitorias}V</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{j.rodadas} rodadas</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
