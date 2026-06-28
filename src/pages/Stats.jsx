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
  const [jogos, setJogos] = useState([])
  const [pontuacao, setPontuacao] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('badges')

  useEffect(() => {
    async function carregar() {
      const { data: b } = await supabase
        .from('badges')
        .select('tipo, jogadores(nome, foto_url)')
      setBadges(b || [])

      const { data: jogos } = await supabase
        .from('jogos')
        .select('dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, placar_a, placar_b, chave')
      setJogos(jogos || [])

      const { data: p } = await supabase
        .from('pontuacao')
        .select('pontos, jogadores(nome)')
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

  // Stats gerais - calcula vitórias por chave direto dos jogos
  const statsJogadores = {}
  jogos.forEach(j => {
    const venceuA = j.placar_a > j.placar_b
    const vencedores = venceuA ? [j.dupla_a_1, j.dupla_a_2] : [j.dupla_b_1, j.dupla_b_2]
    vencedores.filter(Boolean).forEach(nome => {
      if (!statsJogadores[nome]) statsJogadores[nome] = { nome, vitoriasOuro: 0, vitoriasPrata: 0 }
      if (j.chave === 'ouro') statsJogadores[nome].vitoriasOuro++
      else statsJogadores[nome].vitoriasPrata++
    })
  })
  const rankingVitorias = Object.values(statsJogadores).map(j => ({
    ...j,
    total: j.vitoriasOuro + j.vitoriasPrata
  })).sort((a,b) => b.total - a.total).slice(0, 10)

  // Função auxiliar para calcular stats por chave
  const calcPorChave = (chave) => {
    const jogosChave = chave === 'todos' ? jogos : jogos.filter(j => j.chave === chave)

    // % de vitórias
    const pctMap = {}
    jogosChave.forEach(j => {
      const todos = [j.dupla_a_1, j.dupla_a_2, j.dupla_b_1, j.dupla_b_2].filter(Boolean)
      const venc = j.placar_a > j.placar_b ? [j.dupla_a_1, j.dupla_a_2] : [j.dupla_b_1, j.dupla_b_2]
      todos.forEach(n => {
        if (!pctMap[n]) pctMap[n] = { nome: n, vitorias: 0, total: 0 }
        pctMap[n].total++
        if (venc.includes(n)) pctMap[n].vitorias++
      })
    })
    const rankPct = Object.values(pctMap).filter(j => j.total >= 8)
      .map(j => ({ ...j, pct: Math.round(j.vitorias / j.total * 100) }))
      .sort((a,b) => b.pct - a.pct).slice(0, 10)

    // Saldo
    const saldoMap = {}
    jogosChave.forEach(j => {
      const saldo = j.placar_a - j.placar_b
      ;[j.dupla_a_1, j.dupla_a_2].filter(Boolean).forEach(n => { saldoMap[n] = (saldoMap[n] || 0) + saldo })
      ;[j.dupla_b_1, j.dupla_b_2].filter(Boolean).forEach(n => { saldoMap[n] = (saldoMap[n] || 0) - saldo })
    })
    const rankSaldo = Object.entries(saldoMap).map(([nome, saldo]) => ({ nome, saldo }))
      .sort((a,b) => b.saldo - a.saldo).slice(0, 10)

    // Duplas
    const duplaMap = {}
    jogosChave.forEach(j => {
      const venceuA = j.placar_a > j.placar_b
      const duplaA = [j.dupla_a_1, j.dupla_a_2].filter(Boolean)
      const duplaB = [j.dupla_b_1, j.dupla_b_2].filter(Boolean)
      ;[duplaA, duplaB].forEach((d, idx) => {
        if (d.length === 2) {
          const key = d.sort().join(' / ')
          if (!duplaMap[key]) duplaMap[key] = { dupla: key, vitorias: 0, jogos: 0 }
          duplaMap[key].jogos++
          if ((idx === 0 && venceuA) || (idx === 1 && !venceuA)) duplaMap[key].vitorias++
        }
      })
    })
    const rankDuplas = Object.values(duplaMap).filter(d => d.jogos >= 3)
      .sort((a,b) => b.vitorias - a.vitorias).slice(0, 8)

    // Carrasco
    const carrascoMap = {}
    jogosChave.forEach(j => {
      const venc = j.placar_a > j.placar_b ? [j.dupla_a_1, j.dupla_a_2] : [j.dupla_b_1, j.dupla_b_2]
      const perd = j.placar_a > j.placar_b ? [j.dupla_b_1, j.dupla_b_2] : [j.dupla_a_1, j.dupla_a_2]
      venc.filter(Boolean).forEach(v => {
        perd.filter(Boolean).forEach(p => {
          const key = v + '>' + p
          if (!carrascoMap[key]) carrascoMap[key] = { vencedor: v, perdedor: p, count: 0 }
          carrascoMap[key].count++
        })
      })
    })
    const rankCarrasco = Object.values(carrascoMap).filter(c => c.count >= 2)
      .sort((a,b) => b.count - a.count).slice(0, 8)

    return { rankPct, rankSaldo, rankDuplas, rankCarrasco }
  }

  const [chaveExtra, setChaveExtra] = useState('ouro')
  const { rankPct, rankSaldo, rankDuplas, rankCarrasco } = calcPorChave(chaveExtra)

  // Média de pontos por rodada (da tabela pontuacao — geral)
  const mediaPontos = {}
  pontuacao.forEach(p => {
    const nome = p.jogadores?.nome
    if (!nome) return
    if (!mediaPontos[nome]) mediaPontos[nome] = { nome, total: 0, rodadas: 0 }
    mediaPontos[nome].total += p.pontos || 0
    mediaPontos[nome].rodadas++
  })
  const rankingMedia = Object.values(mediaPontos)
    .filter(j => j.rodadas >= 3)
    .map(j => ({ ...j, media: Math.round(j.total / j.rodadas) }))
    .sort((a,b) => b.media - a.media).slice(0, 10)

  // Pneu — conta quantas vezes cada jogador tomou 6x0
  const pneuCount = {}
  jogos.forEach(j => {
    const perdeuA = j.placar_a === 0 && j.placar_b === 6
    const perdeuB = j.placar_b === 0 && j.placar_a === 6
    if (perdeuA) [j.dupla_a_1, j.dupla_a_2].filter(Boolean).forEach(n => { pneuCount[n] = (pneuCount[n] || 0) + 1 })
    if (perdeuB) [j.dupla_b_1, j.dupla_b_2].filter(Boolean).forEach(n => { pneuCount[n] = (pneuCount[n] || 0) + 1 })
  })

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
        {[{ key: 'badges', label: '🏅 Badges' }, { key: 'vitorias', label: '🏆 Vitórias' }, { key: 'extra', label: '📊 Mais Stats' }].map(({ key, label }) => (
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

      {aba === 'badges' && Object.keys(pneuCount).length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid #fd79a8', marginTop: -4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>🍩</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fd79a8' }}>Pneu — Contador de 6x0</span>
          </div>
          {Object.entries(pneuCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([nome, count], idx) => (
            <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#fd79a8', textAlign: 'center' }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{nome}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fd79a8' }}>{count}x 🍩</div>
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
              <div style={{ flex: 1, fontSize: 14, color: '#e8f5e9' }}>{j.nome}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#c9a227' }}>Ouro</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a227' }}>{j.vitoriasOuro}V</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#8e9eab' }}>Prata</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8e9eab' }}>{j.vitoriasPrata}V</div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 8 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2ecc71' }}>{j.total}V</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {aba === 'extra' && (
        <div>
          {/* Seletor Ouro/Prata */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ key: 'ouro', label: '🥇 Ouro', cor: '#c9a227' }, { key: 'prata', label: '🥈 Prata', cor: '#8e9eab' }, { key: 'todos', label: '🌐 Todos', cor: '#7fb89a' }].map(({ key, label, cor }) => (
              <button key={key} onClick={() => setChaveExtra(key)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                background: chaveExtra === key ? cor : 'rgba(255,255,255,0.06)',
                color: chaveExtra === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
              }}>{label}</button>
            ))}
          </div>

          {/* % de vitórias */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2ecc71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🎯 % de Vitórias (mín. 8 jogos)</div>
            {rankPct.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Nenhum jogador com mínimo de jogos</div>}
            {rankPct.map((j, idx) => (
              <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < rankPct.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 20, fontSize: 12, color: idx < 3 ? '#2ecc71' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{j.vitorias}V/{j.total}J</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2ecc71' }}>{j.pct}%</div>
              </div>
            ))}
          </div>

          {/* Saldo de games */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f39c12', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🎯 Saldo de Games Acumulado</div>
            {rankSaldo.map((j, idx) => (
              <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < rankSaldo.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 20, fontSize: 12, color: idx < 3 ? '#f39c12' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: j.saldo >= 0 ? '#f39c12' : '#e74c3c' }}>{j.saldo > 0 ? '+' : ''}{j.saldo}</div>
              </div>
            ))}
          </div>

          {/* Média de pontos — sempre geral */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>📈 Média de Pontos por Rodada (mín. 3)</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Considera todas as rodadas disputadas</div>
            {rankingMedia.map((j, idx) => (
              <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < rankingMedia.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 20, fontSize: 12, color: idx < 3 ? '#c9a227' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{j.rodadas} rod.</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#c9a227' }}>{j.media}pts</div>
              </div>
            ))}
          </div>

          {/* Duplas mais vitoriosas */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1abc9c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🤝 Duplas Mais Vitoriosas (mín. 3 jogos)</div>
            {rankDuplas.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Nenhuma dupla com mínimo de jogos</div>}
            {rankDuplas.map((d, idx) => (
              <div key={d.dupla} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < rankDuplas.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 20, fontSize: 12, color: idx < 3 ? '#1abc9c' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}</div>
                <div style={{ flex: 1, fontSize: 12, color: '#e8f5e9' }}>{d.dupla}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{d.vitorias}V/{d.jogos}J</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1abc9c' }}>{Math.round(d.vitorias/d.jogos*100)}%</div>
              </div>
            ))}
          </div>

          {/* Carrasco */}
          {rankCarrasco.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e74c3c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>💀 Carrasco (mín. 2 vitórias sobre o mesmo)</div>
              {rankCarrasco.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < rankCarrasco.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: 20, fontSize: 12, color: '#e74c3c', textAlign: 'center' }}>{c.count}x</div>
                  <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{c.vencedor} <span style={{ color: 'rgba(255,255,255,0.3)' }}>vs</span> {c.perdedor}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
