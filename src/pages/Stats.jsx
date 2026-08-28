import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BADGE_INFO } from '../lib/badges'
import { buscarVitoriasGerais, buscarClassificacaoTemporadaAtual, buscarRodadaIdsLigaAtual, listarLigas } from '../lib/temporada'
import { acessivelClique } from '../lib/a11y'
import SeletorLiga, { HISTORICO_TOTAL } from '../components/SeletorLiga'

// Agrega jogos por jogador (jogos/vitórias/saldo), casando preferencialmente
// por dupla_x_id (ver migration 20260816120000_jogos_jogador_id.sql) e caindo
// pro nome só em jogos antigos sem essa coluna preenchida.
function calcJogosPorJogador(lista, nomeParaId) {
  const map = {}
  for (const j of lista) {
    if (j.placar_a === null || j.placar_b === null) continue
    const venceuA = j.placar_a > j.placar_b
    const saldo = j.placar_a - j.placar_b
    const slots = [
      ['dupla_a_1', venceuA, saldo], ['dupla_a_2', venceuA, saldo],
      ['dupla_b_1', !venceuA, -saldo], ['dupla_b_2', !venceuA, -saldo],
    ]
    for (const [pos, venceu, saldoJogador] of slots) {
      const nome = j[pos]
      if (!nome) continue
      const id = j[pos + '_id'] || nomeParaId[nome]
      if (!id) continue
      if (!map[id]) map[id] = { jogos: 0, vitorias: 0, saldo: 0 }
      map[id].jogos++
      if (venceu) map[id].vitorias++
      map[id].saldo += saldoJogador
    }
  }
  return map
}

// Link "ver todos (N)" / "ver menos" no rodapé de um card de ranking —
// cada card guarda seu próprio estado de expandido (chave `expandKey`).
function VerTodos({ aberto, total, mostrando, onClick }) {
  if (total <= mostrando) return null
  return (
    <div {...acessivelClique(onClick)} style={{ textAlign: 'center', padding: '10px 0 2px', fontSize: 12, color: '#7fb89a', cursor: 'pointer', fontWeight: 700 }}>
      {aberto ? '▴ Ver menos' : `▾ Ver todos (${total})`}
    </div>
  )
}

export default function Stats() {
  const navigate = useNavigate()
  const [badges, setBadges] = useState([])
  const [jogos, setJogos] = useState([])
  const [pontuacao, setPontuacao] = useState([])
  const [jogadores, setJogadores] = useState([])
  const [vitoriasGerais, setVitoriasGerais] = useState([])
  const [ligas, setLigas] = useState([]) // mais recente primeiro; ligas[0] = atual
  const [selecao, setSelecao] = useState(null) // nome da liga, ou HISTORICO_TOTAL — vale pra página inteira, não só o Relatório
  const [classificacaoRelatorio, setClassificacaoRelatorio] = useState([])
  const [rodadaIdsRelatorio, setRodadaIdsRelatorio] = useState(new Set())
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(true)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('badges')
  const [expandido, setExpandido] = useState({})
  const [ordenacao, setOrdenacao] = useState({ campo: 'pontos', dir: -1 })

  useEffect(() => {
    async function carregar() {
      const { data: b } = await supabase
        .from('badges')
        .select('tipo, rodada_id, jogadores(nome, foto_url)')
      setBadges(b || [])

      const { data: jogos } = await supabase
        .from('jogos')
        .select('dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, dupla_a_1_id, dupla_a_2_id, dupla_b_1_id, dupla_b_2_id, placar_a, placar_b, chave, rodada_id')
        .not('placar_a', 'is', null)
        .not('placar_b', 'is', null)
      setJogos(jogos || [])

      const { data: p } = await supabase
        .from('pontuacao')
        .select('pontos, jogador_id, rodada_id, jogadores(nome)')
      setPontuacao(p || [])

      const { data: jogs } = await supabase.from('jogadores').select('id, nome, foto_url, chave')
      setJogadores(jogs || [])

      const ls = await listarLigas()
      setLigas(ls)
      setSelecao(ls[0] || HISTORICO_TOTAL)

      setLoading(false)
    }
    carregar()
  }, [])

  // Reage à liga selecionada — escopa classificação, vitórias gerais e o
  // conjunto de rodada_ids usado pra filtrar jogos/pontuação/badges de TODAS
  // as abas (não só o Relatório).
  useEffect(() => {
    if (!selecao) return
    async function carregarEscopo() {
      setCarregandoRelatorio(true)
      if (selecao === HISTORICO_TOTAL) {
        const [{ data }, vitGerais] = await Promise.all([
          supabase.from('classificacao').select('*').order('posicao', { ascending: true }),
          buscarVitoriasGerais(),
        ])
        setClassificacaoRelatorio(data || [])
        setRodadaIdsRelatorio(null) // null = sem filtro, considera todas as rodadas
        setVitoriasGerais(vitGerais)
      } else {
        const [{ lista }, rodIds, vitGerais] = await Promise.all([
          buscarClassificacaoTemporadaAtual({ liga: selecao }),
          buscarRodadaIdsLigaAtual(selecao),
          buscarVitoriasGerais(selecao),
        ])
        setClassificacaoRelatorio(lista)
        setRodadaIdsRelatorio(rodIds)
        setVitoriasGerais(vitGerais)
      }
      setCarregandoRelatorio(false)
    }
    carregarEscopo()
  }, [selecao])

  function toggleExpandido(key) {
    setExpandido(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Escopo pela liga selecionada — rodadaIdsRelatorio null = Histórico Total
  // (sem filtro); usado por todas as abas, não só o Relatório.
  const jogosEscopo = rodadaIdsRelatorio ? jogos.filter(j => rodadaIdsRelatorio.has(j.rodada_id)) : jogos
  const pontuacaoEscopo = rodadaIdsRelatorio ? pontuacao.filter(p => rodadaIdsRelatorio.has(p.rodada_id)) : pontuacao
  const badgesEscopo = rodadaIdsRelatorio ? badges.filter(b => rodadaIdsRelatorio.has(b.rodada_id)) : badges

  // Agrupa badges por tipo
  const rankingBadges = Object.entries(BADGE_INFO).map(([tipo, info]) => {
    const jogadoresComBadge = {}
    badgesEscopo.filter(b => b.tipo === tipo).forEach(b => {
      const nome = b.jogadores?.nome
      if (!nome) return
      if (!jogadoresComBadge[nome]) jogadoresComBadge[nome] = { nome, foto: b.jogadores?.foto_url, count: 0 }
      jogadoresComBadge[nome].count++
    })
    const todos = Object.values(jogadoresComBadge).sort((a,b) => b.count - a.count)
    return { tipo, info, todos, ranking: todos.slice(0, 3) }
  }).filter(r => r.todos.length > 0)

  // 🏆 Mais vitórias — sempre por jogador_id, via pontuacao + ranking_rodada
  // (src/lib/temporada.js:buscarVitoriasGerais). Nunca recalculado a partir
  // do nome em `jogos` — essa era a origem do número errado que o app
  // mostrava (vitórias de uma substituição de jogador iam pro nome errado).
  const rankingVitorias = expandido.vitorias ? vitoriasGerais : vitoriasGerais.slice(0, 10)

  // Função auxiliar para calcular stats por chave (por partida — sem
  // equivalente em `pontuacao`/`ranking_rodada`, então continua vindo de
  // `jogos`, agora protegido pela correção da substituição de jogador)
  const calcPorChave = (chave) => {
    const jogosChave = chave === 'todos' ? jogosEscopo : jogosEscopo.filter(j => j.chave === chave)

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
    const rankPctTodos = Object.values(pctMap).filter(j => j.total >= 8)
      .map(j => ({ ...j, pct: Math.round(j.vitorias / j.total * 100) }))
      .sort((a,b) => b.pct - a.pct)
    const rankPct = expandido.pct ? rankPctTodos : rankPctTodos.slice(0, 10)

    // Saldo
    const saldoMap = {}
    jogosChave.forEach(j => {
      const saldo = j.placar_a - j.placar_b
      ;[j.dupla_a_1, j.dupla_a_2].filter(Boolean).forEach(n => { saldoMap[n] = (saldoMap[n] || 0) + saldo })
      ;[j.dupla_b_1, j.dupla_b_2].filter(Boolean).forEach(n => { saldoMap[n] = (saldoMap[n] || 0) - saldo })
    })
    const rankSaldoTodos = Object.entries(saldoMap).map(([nome, saldo]) => ({ nome, saldo })).sort((a,b) => b.saldo - a.saldo)
    const rankSaldo = expandido.saldo ? rankSaldoTodos : rankSaldoTodos.slice(0, 10)

    // Duplas
    const duplaMap = {}
    jogosChave.forEach(j => {
      const venceuA = j.placar_a > j.placar_b
      const duplaA = [j.dupla_a_1, j.dupla_a_2].filter(Boolean)
      const duplaB = [j.dupla_b_1, j.dupla_b_2].filter(Boolean)
      if (duplaA.length === 2) {
        const key = [...duplaA].sort().join(' / ')
        if (!duplaMap[key]) duplaMap[key] = { dupla: key, vitorias: 0, jogos: 0 }
        duplaMap[key].jogos++
        if (venceuA) duplaMap[key].vitorias++
      }
      if (duplaB.length === 2) {
        const key = [...duplaB].sort().join(' / ')
        if (!duplaMap[key]) duplaMap[key] = { dupla: key, vitorias: 0, jogos: 0 }
        duplaMap[key].jogos++
        if (!venceuA) duplaMap[key].vitorias++
      }
    })
    const rankDuplasTodos = Object.values(duplaMap).filter(d => d.jogos >= 3).sort((a,b) => b.vitorias - a.vitorias)
    const rankDuplas = expandido.duplas ? rankDuplasTodos : rankDuplasTodos.slice(0, 8)

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
    const rankCarrascoTodos = Object.values(carrascoMap).filter(c => c.count >= 2).sort((a,b) => b.count - a.count)
    const rankCarrasco = expandido.carrasco ? rankCarrascoTodos : rankCarrascoTodos.slice(0, 8)

    return {
      rankPct, rankSaldo, rankDuplas, rankCarrasco,
      totalPct: rankPctTodos.length, totalSaldo: rankSaldoTodos.length,
      totalDuplas: rankDuplasTodos.length, totalCarrasco: rankCarrascoTodos.length,
    }
  }

  const [chaveExtra, setChaveExtra] = useState('ouro')
  const { rankPct, rankSaldo, rankDuplas, rankCarrasco, totalPct, totalSaldo, totalDuplas, totalCarrasco } = calcPorChave(chaveExtra)

  // Média de pontos por rodada (da tabela pontuacao — sempre por jogador_id)
  const mediaPontos = {}
  pontuacaoEscopo.forEach(p => {
    const nome = p.jogadores?.nome
    if (!nome || !p.jogador_id) return
    if (!mediaPontos[p.jogador_id]) mediaPontos[p.jogador_id] = { nome, total: 0, rodadas: 0 }
    mediaPontos[p.jogador_id].total += p.pontos || 0
    mediaPontos[p.jogador_id].rodadas++
  })
  const rankingMediaTodos = Object.values(mediaPontos)
    .filter(j => j.rodadas >= 3)
    .map(j => ({ ...j, media: Math.round(j.total / j.rodadas) }))
    .sort((a,b) => b.media - a.media)
  const rankingMedia = expandido.media ? rankingMediaTodos : rankingMediaTodos.slice(0, 10)

  // Pneu — conta quantas vezes cada jogador tomou 6x0
  const pneuCount = {}
  jogosEscopo.forEach(j => {
    const perdeuA = j.placar_a === 0 && j.placar_b === 6
    const perdeuB = j.placar_b === 0 && j.placar_a === 6
    if (perdeuA) [j.dupla_a_1, j.dupla_a_2].filter(Boolean).forEach(n => { pneuCount[n] = (pneuCount[n] || 0) + 1 })
    if (perdeuB) [j.dupla_b_1, j.dupla_b_2].filter(Boolean).forEach(n => { pneuCount[n] = (pneuCount[n] || 0) + 1 })
  })
  const pneuOrdenado = Object.entries(pneuCount).sort((a,b) => b[1]-a[1])
  const pneuLista = expandido.pneu ? pneuOrdenado : pneuOrdenado.slice(0, 5)

  // ─── Relatório Completo ────────────────────────────────────────────────
  const nomeParaId = {}
  jogadores.forEach(j => { nomeParaId[j.nome] = j.id })

  const baseRelatorio = classificacaoRelatorio
  const porJogadorRelatorio = calcJogosPorJogador(jogosEscopo, nomeParaId)

  const relatorioLista = baseRelatorio.map(j => {
    const extra = porJogadorRelatorio[j.id] || { jogos: 0, vitorias: 0, saldo: 0 }
    const vitorias = j.vitorias || 0
    const derrotas = Math.max(0, extra.jogos - vitorias)
    const pct = extra.jogos > 0 ? Math.round(vitorias / extra.jogos * 100) : 0
    return {
      id: j.id, nome: j.nome, foto: j.foto_url, chave: j.chave,
      jogos: extra.jogos, vitorias, derrotas, pct, saldo: extra.saldo, pontos: j.pontos || 0,
    }
  }).sort((a, b) => (b[ordenacao.campo] - a[ordenacao.campo]) * ordenacao.dir)

  function ordenarPor(campo) {
    setOrdenacao(prev => prev.campo === campo ? { campo, dir: -prev.dir } : { campo, dir: -1 })
  }

  function exportarRelatorioCSV() {
    const header = ['Jogador', 'Chave', 'Jogos', 'Vitórias', 'Derrotas', '% Aproveitamento', 'Saldo de Games', 'Pontos']
    const linhas = relatorioLista.map(j => [
      j.nome, j.chave === 'ouro' ? 'Ouro' : 'Prata', j.jogos, j.vitorias, j.derrotas, j.pct + '%', j.saldo, j.pontos,
    ])
    const csv = [header, ...linhas]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const sufixo = selecao === HISTORICO_TOTAL ? 'historico_total' : selecao
    a.download = `relatorio_estatisticas_${sufixo.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', padding: 0 }}>‹</button>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, color: '#c9a227' }}>
          📊 ESTATÍSTICAS
        </div>
      </div>

      {/* Seletor de liga — vale pra todas as abas abaixo */}
      <SeletorLiga ligas={ligas} selecao={selecao} onSelecionar={setSelecao} />

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ key: 'badges', label: '🏅 Badges' }, { key: 'vitorias', label: '🏆 Vitórias' }, { key: 'extra', label: '📊 Mais Stats' }, { key: 'relatorio', label: '📋 Relatório' }].map(({ key, label }) => (
          <button key={key} onClick={() => setAba(key)} style={{
            flex: '1 1 auto', minWidth: 80, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: aba === key ? '#c9a227' : 'rgba(255,255,255,0.06)',
            color: aba === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
          }}>{label}</button>
        ))}
      </div>

      {aba === 'badges' && (
        <div>
          {rankingBadges.map(({ tipo, info, todos, ranking }) => {
            const key = 'badge_' + tipo
            const lista = expandido[key] ? todos : ranking
            return (
              <div key={tipo} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${info.cor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{info.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: info.cor }}>{info.label}</span>
                </div>
                {lista.map((j, idx) => (
                  <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: idx === 0 ? info.cor : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
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
                <VerTodos aberto={!!expandido[key]} total={todos.length} mostrando={3} onClick={() => toggleExpandido(key)} />
              </div>
            )
          })}
        </div>
      )}

      {aba === 'badges' && Object.keys(pneuCount).length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid #fd79a8', marginTop: -4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>🍩</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fd79a8' }}>Pneu — Contador de 6x0</span>
          </div>
          {pneuLista.map(([nome, count], idx) => (
            <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#fd79a8', textAlign: 'center' }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{nome}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fd79a8' }}>{count}x 🍩</div>
            </div>
          ))}
          <VerTodos aberto={!!expandido.pneu} total={pneuOrdenado.length} mostrando={5} onClick={() => toggleExpandido('pneu')} />
        </div>
      )}

      {aba === 'vitorias' && (
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            🏆 Mais Vitórias no Torneio
          </div>
          {rankingVitorias.map((j, idx) => (
            <div key={j.id} {...acessivelClique(() => navigate('/jogador/' + j.id))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < rankingVitorias.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
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
                {j.vitoriasOutras > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#7fb89a' }}>Especial</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7fb89a' }}>{j.vitoriasOutras}V</div>
                  </div>
                )}
                <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 8 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2ecc71' }}>{j.total}V</div>
                </div>
              </div>
            </div>
          ))}
          <VerTodos aberto={!!expandido.vitorias} total={vitoriasGerais.length} mostrando={10} onClick={() => toggleExpandido('vitorias')} />
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
            <VerTodos aberto={!!expandido.pct} total={totalPct} mostrando={10} onClick={() => toggleExpandido('pct')} />
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
            <VerTodos aberto={!!expandido.saldo} total={totalSaldo} mostrando={10} onClick={() => toggleExpandido('saldo')} />
          </div>

          {/* Média de pontos — sempre geral */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>📈 Média de Pontos por Rodada (mín. 3)</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
              {selecao === HISTORICO_TOTAL ? 'Considera todas as rodadas disputadas' : `Rodadas de "${selecao}"`}
            </div>
            {rankingMedia.map((j, idx) => (
              <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: idx < rankingMedia.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 20, fontSize: 12, color: idx < 3 ? '#c9a227' : 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx+1}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{j.rodadas} rod.</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#c9a227' }}>{j.media}pts</div>
              </div>
            ))}
            <VerTodos aberto={!!expandido.media} total={rankingMediaTodos.length} mostrando={10} onClick={() => toggleExpandido('media')} />
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
            <VerTodos aberto={!!expandido.duplas} total={totalDuplas} mostrando={8} onClick={() => toggleExpandido('duplas')} />
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
              <VerTodos aberto={!!expandido.carrasco} total={totalCarrasco} mostrando={8} onClick={() => toggleExpandido('carrasco')} />
            </div>
          )}
        </div>
      )}

      {aba === 'relatorio' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={exportarRelatorioCSV} disabled={relatorioLista.length === 0} style={{
              background: '#c9a227', border: 'none', color: '#0d2b1a', borderRadius: 8, padding: '9px 14px',
              cursor: relatorioLista.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700,
              opacity: relatorioLista.length === 0 ? 0.5 : 1,
            }}>
              ⬇️ Exportar CSV
            </button>
          </div>
          {!carregandoRelatorio && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
              {relatorioLista.length} jogador{relatorioLista.length === 1 ? '' : 'es'} — toque num jogador pra ver o perfil completo. Toque numa coluna pra ordenar.
            </div>
          )}
          {carregandoRelatorio ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : relatorioLista.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum dado disponível ainda.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table className="tabela" style={{ minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: '#162f20', minWidth: 150 }}>Jogador</th>
                    {[
                      ['jogos', 'J'], ['vitorias', 'V'], ['derrotas', 'D'], ['pct', '%'], ['saldo', 'Saldo'], ['pontos', 'Pts'],
                    ].map(([campo, label]) => (
                      <th key={campo} onClick={() => ordenarPor(campo)} style={{ textAlign: 'right', cursor: 'pointer', minWidth: 64, userSelect: 'none' }}>
                        {label}{ordenacao.campo === campo ? (ordenacao.dir === -1 ? ' ▾' : ' ▴') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorioLista.map((j) => (
                    <tr key={j.id} {...acessivelClique(() => navigate('/jogador/' + j.id))} style={{ cursor: 'pointer' }}>
                      <td style={{ position: 'sticky', left: 0, background: '#162f20' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            background: 'linear-gradient(135deg, #1a4d2e, #0d2b1a)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid ' + (j.chave === 'ouro' ? 'rgba(201,162,39,0.4)' : 'rgba(142,158,171,0.4)'),
                          }}>
                            {j.foto
                              ? <img src={j.foto} alt={j.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: 11, fontWeight: 700 }}>{j.nome?.charAt(0)?.toUpperCase()}</span>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e9', whiteSpace: 'nowrap' }}>{j.nome}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{j.jogos}</td>
                      <td style={{ textAlign: 'right', color: '#2ecc71', fontWeight: 700 }}>{j.vitorias}</td>
                      <td style={{ textAlign: 'right', color: '#e74c3c' }}>{j.derrotas}</td>
                      <td style={{ textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{j.pct}%</td>
                      <td style={{ textAlign: 'right', color: j.saldo >= 0 ? '#f39c12' : '#e74c3c' }}>{j.saldo > 0 ? '+' : ''}{j.saldo}</td>
                      <td style={{ textAlign: 'right', color: '#f5c518', fontWeight: 700 }}>{j.pontos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
