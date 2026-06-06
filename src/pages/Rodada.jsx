import { useState, useEffect } from 'react'
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
  const [detalheView, setDetalheView] = useState('jogos') // 'jogos' | 'classificacao'
  const [loading, setLoading] = useState(true)

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

    // Busca ranking desta rodada
    const { data: rank } = await supabase
      .from('ranking_rodada')
      .select('*, jogadores(nome, chave)')
      .eq('rodada_id', rodada.id)
      .order('posicao', { ascending: true })

    if (rank) {
      const rankOuro = rank.filter(r => r.chave === 'ouro')
      const rankPrata = rank.filter(r => r.chave === 'prata')

      // Busca ranking da rodada ANTERIOR para saber quem subiu/desceu
      const { data: rodadaAnt } = await supabase.from('rodadas').select('*')
        .eq('status', 'finalizada')
        .lt('numero', rodada.numero)
        .order('numero', { ascending: false }).limit(1)

      let rankAntOuro = [], rankAntPrata = []
      if (rodadaAnt?.[0]) {
        const { data: rankAnt } = await supabase
          .from('ranking_rodada')
          .select('*, jogadores(nome)')
          .eq('rodada_id', rodadaAnt[0].id)
          .order('posicao', { ascending: true })
        if (rankAnt) {
          rankAntOuro = rankAnt.filter(r => r.chave === 'ouro').map(r => r.jogadores?.nome)
          rankAntPrata = rankAnt.filter(r => r.chave === 'prata').map(r => r.jogadores?.nome)
        }
      }

      // Calcula pontos do dia a partir dos jogos
      const ptsDia = {}
      const vitoriasDia = {}
      const jogosCompletos = (j || []).filter(j => j.placar_a !== null && j.placar_b !== null)
      
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

      // Marca quem subiu/desceu baseado na posição desta rodada
      const desceram = rankOuro.slice(-3).map(r => r.jogadores?.nome)
      const subiram  = rankPrata.slice(0, 3).map(r => r.jogadores?.nome)

      setDetalheRanking({
        ouro: rankOuro.map((r) => ({
          nome: r.jogadores?.nome,
          pontos: r.pontos_liga,
          pontosDia: ptsDia[r.jogadores?.nome] || 0,
          vitorias: vitoriasDia[r.jogadores?.nome] || 0,
          posicao: r.posicao,
          movimento: desceram.includes(r.jogadores?.nome) ? 'desceu' : null,
        })),
        prata: rankPrata.map((r) => ({
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

  function renderJogos(jogos, chave) {
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
      <div key={idx} className="card" style={{ marginBottom: '12px', borderLeft: `3px solid ${corChave}`, padding: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
          Rodada {idx + 1}
        </div>
        {grupo.map((jogo, i) => (
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
                <>
                  {li === 1 && <span key="x" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>X</span>}
                  <div key={li} style={{
                    background: lado.venceu ? 'rgba(245,197,24,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${lado.venceu ? 'rgba(245,197,24,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '6px', padding: '4px 10px',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px',
                    color: lado.venceu ? '#f5c518' : 'rgba(255,255,255,0.5)',
                    minWidth: '32px', textAlign: 'center'
                  }}>{lado.placar ?? '–'}</div>
                </>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_b_1}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{jogo.dupla_b_2}</div>
            </div>
          </div>
        ))}
      </div>
    ))
  }

  function renderClassificacao(ranking, chave) {
    const cor = chave === 'ouro' ? ouro : prata
    if (!ranking || ranking.length === 0) return (
      <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Classificação não disponível</p>
      </div>
    )

    return (
      <div className="card" style={{ padding: '16px', borderLeft: `3px solid ${cor}` }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>{chave === 'ouro' ? '🥇' : '🥈'}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: cor, textTransform: 'uppercase', letterSpacing: 1 }}>
            Chave {chave}
          </span>
        </div>

        {/* Lista */}
        {ranking.map((j, idx) => {
          const desceu = j.movimento === 'desceu'
          const subiu  = j.movimento === 'subiu'
          return (
            <div key={j.nome} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: idx < ranking.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderLeft: desceu ? '3px solid #e74c3c' : subiu ? '3px solid #2ecc71' : '3px solid transparent',
              paddingLeft: 8,
            }}>
              {/* Posição */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: idx === 0 ? 'rgba(201,162,39,0.2)' : idx === 1 ? 'rgba(142,158,171,0.2)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: idx === 0 ? ouro : idx === 1 ? prata : 'rgba(255,255,255,0.4)',
                flexShrink: 0,
              }}>
                {idx + 1}
              </div>

              {/* Nome */}
              <div style={{ flex: 1, fontSize: 14, fontWeight: idx < 3 ? 700 : 400, color: '#e8f5e9' }}>
                {j.nome}
              </div>

              {/* Movimento */}
              {desceu && (
                <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                  ↓ desceu
                </div>
              )}
              {subiu && (
                <div style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                  ↑ subiu
                </div>
              )}

              {/* Pontos */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>
                  {j.vitorias}V · {j.pontosDia} pts dia
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: cor }}>
                  {j.pontos} pts liga
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function ToggleChave() {
    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
        {[{ key: 'ouro', label: '🥇 Chave Ouro' }, { key: 'prata', label: '🥈 Chave Prata' }].map(({ key, label }) => (
          <button key={key} onClick={() => setChaveVis(key)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
            background: chaveVis === key ? `linear-gradient(135deg, ${key === 'ouro' ? '#f5c518, #c9a010' : '#8e9eab, #6b7f8a'})` : 'transparent',
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

  // ── VIEW: DETALHE DE RODADA FINALIZADA ──
  if (view === 'detalhe' && rodadaDetalhe) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button onClick={() => setView('historico')} style={{
            background: 'transparent', border: `1px solid ${borda}`, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <h1 className="section-title" style={{ margin: 0 }}>
            🎾 Rodada {rodadaDetalhe.numero}
            {rodadaDetalhe.tipo === 'especial' && <span style={{ fontSize: '14px', color: ouro, marginLeft: 8 }}>⭐ Especial</span>}
          </h1>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
          📅 {new Date(rodadaDetalhe.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
        </div>

        {/* Toggle Jogos / Classificação */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
          {[{ key: 'jogos', label: '🎾 Jogos' }, { key: 'classificacao', label: '🏆 Classificação' }].map(({ key, label }) => (
            <button key={key} onClick={() => setDetalheView(key)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              background: detalheView === key ? 'rgba(201,162,39,0.15)' : 'transparent',
              color: detalheView === key ? ouro : 'rgba(255,255,255,0.5)',
              border: detalheView === key ? `1px solid rgba(201,162,39,0.3)` : '1px solid transparent',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <ToggleChave />

        {detalheView === 'jogos'
          ? renderJogos(detalheJogos, chaveVis)
          : renderClassificacao(detalheRanking[chaveVis], chaveVis)
        }
      </div>
    )
  }

  // ── VIEW: HISTÓRICO ──
  if (view === 'historico') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setView('proxima')} style={{
            background: 'transparent', border: `1px solid ${borda}`, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <h1 className="section-title" style={{ margin: 0 }}>📋 Histórico de Rodadas</h1>
        </div>

        {rodadasFinalizadas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma rodada finalizada ainda.</p>
          </div>
        ) : (
          rodadasFinalizadas.map(r => (
            <div key={r.id} onClick={() => abrirDetalhe(r)} style={{
              background: cardBg, border: `1px solid ${borda}`, borderRadius: '12px',
              padding: '16px', marginBottom: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: '#e8f5e9' }}>
                  Rodada {r.numero}
                  {r.tipo === 'especial' && <span style={{ fontSize: '12px', color: ouro, marginLeft: 8 }}>⭐ Especial</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  📅 {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
                </div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '20px' }}>›</div>
            </div>
          ))
        )}
      </div>
    )
  }

  // ── VIEW: PRÓXIMA RODADA ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="section-title" style={{ margin: 0 }}>
          {proximaRodada ? `🎾 Rodada ${proximaRodada.numero}` : '🎾 Rodada'}
        </h1>
        {rodadasFinalizadas.length > 0 && (
          <button onClick={() => setView('historico')} style={{
            background: 'transparent', border: `1px solid ${borda}`, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
          }}>📋 Anteriores</button>
        )}
      </div>

      {proximaRodada ? (
        <>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
            📅 {new Date(proximaRodada.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
            {proximaRodada.tipo === 'especial' && <span style={{ color: ouro, marginLeft: 8 }}>⭐ Rodada Especial</span>}
          </div>

          {proximaJogos.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>🎲 Os jogos ainda não foram sorteados</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '8px' }}>Volte após o sorteio ser publicado</p>
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
