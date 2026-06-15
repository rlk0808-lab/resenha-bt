import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ouro = '#c9a227'
const prata = '#8e9eab'
const bg = '#0f2d1e'
const borda = '#2a5a3a'
const cardBg = '#162f20'

export default function Rodada() {
  const [view, setView] = useState('proxima')
  const [proximaRodada, setProximaRodada] = useState(null)
  const [proximaJogos, setProximaJogos] = useState([])
  const [rodadasFinalizadas, setRodadasFinalizadas] = useState([])
  const [rodadaDetalhe, setRodadaDetalhe] = useState(null)
  const [detalheJogos, setDetalheJogos] = useState([])
  const [detalheRanking, setDetalheRanking] = useState({ ouro: [], prata: [] })
  const [chaveVis, setChaveVis] = useState('ouro')
  const [detalheView, setDetalheView] = useState('jogos')
  const [loading, setLoading] = useState(true)
  const [gerandoImagem, setGerandoImagem] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    const { data: proximas } = await supabase
      .from('rodadas').select('*')
      .in('status', ['proxima', 'ativa'])
      .order('numero', { ascending: true }).limit(1)
    const proxima = proximas?.[0] || null
    setProximaRodada(proxima)

    if (proxima) {
      const { data: j } = await supabase.from('jogos').select('*')
        .eq('rodada_id', proxima.id)
        .order('chave', { ascending: true })
        .order('created_at', { ascending: true })
      setProximaJogos(j || [])
    }

    const { data: finalizadas } = await supabase.from('rodadas').select('*')
      .eq('status', 'finalizada').order('numero', { ascending: false })
    setRodadasFinalizadas(finalizadas || [])
    setLoading(false)
  }

  async function abrirDetalhe(rodada) {
    setRodadaDetalhe(rodada)
    setDetalheView('jogos')
    setChaveVis('ouro')
    setView('detalhe')

    const { data: j } = await supabase.from('jogos').select('*')
      .eq('rodada_id', rodada.id)
      .order('chave', { ascending: true })
      .order('created_at', { ascending: true })
    setDetalheJogos(j || [])

    const { data: rank } = await supabase
      .from('ranking_rodada')
      .select('*, jogadores(nome, chave)')
      .eq('rodada_id', rodada.id)
      .order('posicao', { ascending: true })

    if (rank) {
      // Suporta rodada especial (time_a/time_b/especial) e normal (ouro/prata)
      const isEspecial = rank.some(r => ['time_a','time_b','especial'].includes(r.chave))
      const rankOuro = isEspecial
        ? rank.filter(r => r.chave === 'time_b') // vencedor aparece primeiro
        : rank.filter(r => r.chave === 'ouro')
      const rankPrata = isEspecial
        ? rank.filter(r => r.chave === 'time_a')
        : rank.filter(r => r.chave === 'prata')

      const { data: rodadaAnt } = await supabase.from('rodadas').select('*')
        .eq('status', 'finalizada')
        .lt('numero', rodada.numero)
        .order('numero', { ascending: false }).limit(1)

      let desceram = []
      let subiram = []
      if (rodadaAnt?.[0]) {
        const { data: rankAnt } = await supabase
          .from('ranking_rodada')
          .select('*, jogadores(nome)')
          .eq('rodada_id', rodadaAnt[0].id)
          .order('posicao', { ascending: true })
        if (rankAnt) {
          const rankAntOuro = rankAnt.filter(r => r.chave === 'ouro')
          const rankAntPrata = rankAnt.filter(r => r.chave === 'prata')
          desceram = rankAntOuro.slice(-3).map(r => r.jogadores?.nome)
          subiram = rankAntPrata.slice(0, 3).map(r => r.jogadores?.nome)
        }
      }

      const ptsDia = {}
      const vitoriasDia = {}
      const jogosCompletos = (j || []).filter(x => x.placar_a !== null && x.placar_b !== null)

      for (const jogo of jogosCompletos) {
        const { dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, placar_a, placar_b } = jogo
        const jogA = [dupla_a_1, dupla_a_2].filter(Boolean)
        const jogB = [dupla_b_1, dupla_b_2].filter(Boolean)
        const todos = [...jogA, ...jogB]
        todos.forEach(n => { if (!ptsDia[n]) { ptsDia[n] = 0; vitoriasDia[n] = 0 } })
        const saldo = Math.abs(placar_a - placar_b)
        const venceuA = placar_a > placar_b
        const venc = venceuA ? jogA : jogB
        const perd = venceuA ? jogB : jogA
        venc.forEach(n => { ptsDia[n] += 15 + saldo; vitoriasDia[n] += 1 })
        perd.forEach(n => { ptsDia[n] += venceuA ? placar_b : placar_a })
      }

      setDetalheRanking({
        ouro: rankOuro.map(r => ({
          nome: r.jogadores?.nome,
          pontos: r.pontos_liga,
          pontosDia: ptsDia[r.jogadores?.nome] || 0,
          vitorias: vitoriasDia[r.jogadores?.nome] || 0,
          posicao: r.posicao,
          movimento: desceram.includes(r.jogadores?.nome) ? 'desceu' : null,
        })),
        prata: rankPrata.map(r => ({
          nome: r.jogadores?.nome,
          pontos: r.pontos_liga,
          pontosDia: ptsDia[r.jogadores?.nome] || 0,
          vitorias: vitoriasDia[r.jogadores?.nome] || 0,
          posicao: r.posicao,
          movimento: subiram.includes(r.jogadores?.nome) ? 'subiu' : null,
        })),
      })
    }
  }

  function renderJogo(jogo, i, corBorda) {
    return (
      <div key={jogo.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_a_1}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{jogo.dupla_a_2}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '80px', justifyContent: 'center' }}>
          {[
            { placar: jogo.placar_a, venceu: jogo.placar_a > jogo.placar_b },
            { placar: jogo.placar_b, venceu: jogo.placar_b > jogo.placar_a }
          ].map((lado, li) => (
            <span key={li} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {li === 1 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>X</span>}
              <div style={{
                background: lado.venceu ? 'rgba(245,197,24,0.15)' : 'rgba(255,255,255,0.05)',
                border: "1px solid " + (lado.venceu ? 'rgba(245,197,24,0.3)' : 'rgba(255,255,255,0.1)'),
                borderRadius: '6px', padding: '4px 10px',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px',
                color: lado.venceu ? '#f5c518' : 'rgba(255,255,255,0.5)',
                minWidth: '32px', textAlign: 'center'
              }}>{lado.placar ?? '-'}</div>
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_b_1}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{jogo.dupla_b_2}</div>
        </div>
      </div>
    )
  }

  function renderJogos(jogos, chave) {
    const chavesEspecial = ["time_a", "time_b", "especial"]
    const isEspecial = jogos.some(j => chavesEspecial.includes(j.chave))

    if (isEspecial) {
      // Rodada especial: mostra todos os jogos num único card sem agrupamento
      if (jogos.length === 0) return (
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo cadastrado</p>
        </div>
      )
      return (
        <div className="card" style={{ marginBottom: '12px', borderLeft: '3px solid #c9a227', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
            🔴 Time A  ×  🔵 Time B — {jogos.length} jogos
          </div>
          {jogos.map((jogo, i) => renderJogo(jogo, i, '#c9a227'))}
        </div>
      )
    }

    // Rodada normal: agrupa de 3 em 3
    const filtrados = jogos.filter(j => j.chave === chave)
    const subRodadas = []
    for (let i = 0; i < filtrados.length; i += 3) subRodadas.push(filtrados.slice(i, i + 3))
    const corChave = chave === 'ouro' ? ouro : prata

    if (filtrados.length === 0) return (
      <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo cadastrado para esta chave</p>
      </div>
    )

    return subRodadas.map((grupo, idx) => (
      <div key={idx} className="card" style={{ marginBottom: '12px', borderLeft: "3px solid " + corChave, padding: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
          Rodada {idx + 1}
        </div>
        {grupo.map((jogo, i) => renderJogo(jogo, i, corChave))}
      </div>
    ))
  }

  function renderClassificacao(ranking, chave, isEspecial) {
    const cor = isEspecial
      ? (chave === 'ouro' ? '#3498db' : '#e74c3c')  // ouro=Time B vencedor, prata=Time A
      : (chave === 'ouro' ? ouro : prata)
    const label = isEspecial
      ? (chave === 'ouro' ? '🔵 Time B (Vencedor)' : '🔴 Time A')
      : (chave === 'ouro' ? '🥇 Chave Ouro' : '🥈 Chave Prata')

    if (!ranking || ranking.length === 0) return (
      <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Classificacao nao disponivel</p>
      </div>
    )
    return (
      <div className="card" style={{ padding: '16px', borderLeft: "3px solid " + cor }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: cor, textTransform: 'uppercase', letterSpacing: 1 }}>
            {label}
          </span>
        </div>
        {ranking.map((j, idx) => {
          const desceu = j.movimento === 'desceu'
          const subiu = j.movimento === 'subiu'
          return (
            <div key={j.nome} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: idx < ranking.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderLeft: desceu ? '3px solid #e74c3c' : subiu ? '3px solid #2ecc71' : '3px solid transparent',
              paddingLeft: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: idx === 0 ? 'rgba(201,162,39,0.2)' : idx === 1 ? 'rgba(142,158,171,0.2)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: idx === 0 ? ouro : idx === 1 ? prata : 'rgba(255,255,255,0.4)',
                flexShrink: 0,
              }}>{idx + 1}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: idx < 3 ? 700 : 400, color: '#e8f5e9' }}>{j.nome}</div>
              {desceu && <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>↓ desceu</div>}
              {subiu && <div style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700 }}>↑ subiu</div>}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>
                  {j.vitorias}V · {j.pontosDia} pts dia
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: cor }}>{j.pontos} pts liga</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  async function compartilharImagem() {
    if (!rodadaDetalhe) return
    setGerandoImagem(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const el = cardRef.current
      if (!el) { setGerandoImagem(false); return }
      el.style.display = 'block'
      await new Promise(r => setTimeout(r, 400))
      const canvas = await html2canvas(el, { backgroundColor: '#0f2d1e', scale: 2, useCORS: true, logging: false })
      el.style.display = 'none'
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'resenha-bt-r' + rodadaDetalhe.numero + '.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Resenha BT - Rodada ' + rodadaDetalhe.numero })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          a.click()
          URL.revokeObjectURL(url)
        }
        setGerandoImagem(false)
      }, 'image/png')
    } catch (e) {
      console.error(e)
      setGerandoImagem(false)
    }
  }

  function ToggleChave({ isEspecial }) {
    const opcoes = isEspecial
      ? [{ key: 'ouro', label: '🏆 Time B (Vencedor)' }, { key: 'prata', label: '🔴 Time A' }]
      : [{ key: 'ouro', label: '🥇 Chave Ouro' }, { key: 'prata', label: '🥈 Chave Prata' }]
    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
        {opcoes.map(({ key, label }) => (
          <button key={key} onClick={() => setChaveVis(key)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
            background: chaveVis === key ? "linear-gradient(135deg, " + (key === 'ouro' ? '#f5c518, #c9a010' : '#8e9eab, #6b7f8a') + ")" : 'transparent',
            color: chaveVis === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
            letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s'
          }}>{label}</button>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  // Card de compartilhamento (oculto, só renderizado na hora de gerar imagem)
  const CardCompartilhamento = () => {
    const data = rodadaDetalhe ? new Date(rodadaDetalhe.data + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo'
    }) : ''
    const isEspecial = detalheJogos.some(j => ['time_a','time_b','especial'].includes(j.chave))
    const medals = ['🥇','🥈','🥉']

    const renderRankCard = (rank, label, cor) => {
      if (!rank || rank.length === 0) return null
      return (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            {label}
          </div>
          {rank.map((j, idx) => (
            <div key={j.nome} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', marginBottom: 4,
              background: idx === 0 ? cor + '22' : 'rgba(255,255,255,0.04)', borderRadius: 8,
              borderLeft: j.movimento === 'desceu' ? '3px solid #e74c3c' : j.movimento === 'subiu' ? '3px solid #2ecc71' : '3px solid ' + cor + '44',
            }}>
              <span style={{ width: 28, fontSize: 13, textAlign: 'center' }}>{idx < 3 ? medals[idx] : (idx+1)+'o'}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: idx < 3 ? 700 : 400 }}>{j.nome}</span>
              {j.movimento === 'desceu' && <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>↓</span>}
              {j.movimento === 'subiu' && <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700 }}>↑</span>}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{j.vitorias}V · {j.pontosDia} pts</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: cor }}>{j.pontos} pts liga</div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div ref={cardRef} style={{ display: 'none', width: '600px', background: '#0f2d1e', padding: '32px', fontFamily: "'Segoe UI', sans-serif", color: '#e8f5e9' }}>
        <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #2a5a3a', paddingBottom: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#c9a227', letterSpacing: 2 }}>RESENHA BT</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
            Rodada {rodadaDetalhe?.numero}{isEspecial ? ' — Especial' : ''}
          </div>
          <div style={{ fontSize: 13, color: '#7fb89a', marginTop: 4 }}>{data}</div>
        </div>

        {isEspecial ? (
          <>
            {renderRankCard(detalheRanking['ouro'], '🔵 Time B (Vencedor)', '#3498db')}
            {renderRankCard(detalheRanking['prata'], '🔴 Time A', '#e74c3c')}
          </>
        ) : (
          <>
            {renderRankCard(detalheRanking['ouro'], '🥇 Chave Ouro', '#c9a227')}
            {renderRankCard(detalheRanking['prata'], '🥈 Chave Prata', '#8e9eab')}
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #2a5a3a', fontSize: 12, color: '#5a8a6a' }}>
          Veronica Beach Tennis · Londrina/PR
        </div>
      </div>
    )
  }

  // VIEW: DETALHE
  if (view === 'detalhe' && rodadaDetalhe) {
    return (
      <div>
        <CardCompartilhamento />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button onClick={() => setView('historico')} style={{
            background: 'transparent', border: "1px solid " + borda, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <h1 className="section-title" style={{ margin: 0 }}>
            Rodada {rodadaDetalhe.numero}
            {rodadaDetalhe.tipo === 'especial' && <span style={{ fontSize: '14px', color: ouro, marginLeft: 8 }}>Especial</span>}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            {new Date(rodadaDetalhe.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
          </div>
          <button onClick={compartilharImagem} disabled={gerandoImagem} style={{
            background: '#25D366', border: 'none', borderRadius: '8px',
            padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            color: '#fff', fontWeight: 700, fontSize: '13px', opacity: gerandoImagem ? 0.7 : 1
          }}>
            {gerandoImagem ? '⏳ Gerando...' : '📲 Compartilhar'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
          {[{ key: 'jogos', label: '🎾 Jogos' }, { key: 'classificacao', label: '🏆 Classificacao' }].map(({ key, label }) => (
            <button key={key} onClick={() => setDetalheView(key)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              background: detalheView === key ? 'rgba(201,162,39,0.15)' : 'transparent',
              color: detalheView === key ? ouro : 'rgba(255,255,255,0.5)',
              outline: detalheView === key ? "1px solid rgba(201,162,39,0.3)" : '1px solid transparent',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        {(() => {
          const isEspecial = detalheJogos.some(j => ['time_a','time_b','especial'].includes(j.chave))
          return (
            <>
              {detalheView === 'classificacao' && !isEspecial && <ToggleChave isEspecial={false} />}
              {detalheView === 'jogos'
                ? renderJogos(detalheJogos, chaveVis)
                : isEspecial
                  ? <>
                      {renderClassificacao(detalheRanking['ouro'], 'ouro', true)}
                      {renderClassificacao(detalheRanking['prata'], 'prata', true)}
                    </>
                  : renderClassificacao(detalheRanking[chaveVis], chaveVis, false)
              }
            </>
          )
        })()}
      </div>
    )
  }

  // VIEW: HISTORICO
  if (view === 'historico') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setView('proxima')} style={{
            background: 'transparent', border: "1px solid " + borda, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <h1 className="section-title" style={{ margin: 0 }}>Historico de Rodadas</h1>
        </div>
        {rodadasFinalizadas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma rodada finalizada ainda.</p>
          </div>
        ) : (
          rodadasFinalizadas.map(r => (
            <div key={r.id} onClick={() => abrirDetalhe(r)} style={{
              background: cardBg, border: "1px solid " + borda, borderRadius: '12px',
              padding: '16px', marginBottom: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#e8f5e9' }}>
                  Rodada {r.numero}
                  {r.tipo === 'especial' && <span style={{ fontSize: '12px', color: ouro, marginLeft: 8 }}>Especial</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
                </div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '20px' }}>›</div>
            </div>
          ))
        )}
      </div>
    )
  }

  // VIEW: PROXIMA RODADA
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="section-title" style={{ margin: 0 }}>
          {proximaRodada ? "Rodada " + proximaRodada.numero : 'Rodada'}
        </h1>
        {rodadasFinalizadas.length > 0 && (
          <button onClick={() => setView('historico')} style={{
            background: 'transparent', border: "1px solid " + borda, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
          }}>Anteriores</button>
        )}
      </div>

      {proximaRodada ? (
        <>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
            {new Date(proximaRodada.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
            {proximaRodada.tipo === 'especial' && <span style={{ color: ouro, marginLeft: 8 }}>Rodada Especial</span>}
          </div>
          {proximaJogos.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>Os jogos ainda nao foram sorteados</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '8px' }}>Volte apos o sorteio ser publicado</p>
            </div>
          ) : (
            <>
              <ToggleChave />
              {renderJogos(proximaJogos, chaveVis)}
            </>
          )}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma rodada agendada no momento</p>
        </div>
      )}
    </div>
  )
}
