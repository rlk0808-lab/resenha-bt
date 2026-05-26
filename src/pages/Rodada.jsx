import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ouro = '#c9a227'
const prata = '#8e9eab'
const bg = '#0f2d1e'
const borda = '#2a5a3a'
const cardBg = '#162f20'

export default function Rodada() {
  const [view, setView] = useState('proxima') // 'proxima' | 'historico' | 'detalhe'
  const [proximaRodada, setProximaRodada] = useState(null)
  const [proximaJogos, setProximaJogos] = useState([])
  const [rodadasFinalizadas, setRodadasFinalizadas] = useState([])
  const [rodadaDetalhe, setRodadaDetalhe] = useState(null)
  const [detalheJogos, setDetalheJogos] = useState([])
  const [chaveVis, setChaveVis] = useState('ouro')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setLoading(true)

    // Busca próxima rodada (proxima ou ativa)
    const { data: proximas } = await supabase
      .from('rodadas')
      .select('*')
      .in('status', ['proxima', 'ativa'])
      .order('numero', { ascending: true })
      .limit(1)
    
    const proxima = proximas?.[0] || null
    setProximaRodada(proxima)

    if (proxima) {
      const { data: j } = await supabase
        .from('jogos')
        .select('*')
        .eq('rodada_id', proxima.id)
        .order('chave', { ascending: true })
        .order('created_at', { ascending: true })
      setProximaJogos(j || [])
    }

    // Busca rodadas finalizadas
    const { data: finalizadas } = await supabase
      .from('rodadas')
      .select('*')
      .eq('status', 'finalizada')
      .order('numero', { ascending: false })
    setRodadasFinalizadas(finalizadas || [])

    setLoading(false)
  }

  async function abrirDetalhe(rodada) {
    setRodadaDetalhe(rodada)
    setView('detalhe')
    const { data: j } = await supabase
      .from('jogos')
      .select('*')
      .eq('rodada_id', rodada.id)
      .order('chave', { ascending: true })
      .order('created_at', { ascending: true })
    setDetalheJogos(j || [])
  }

  function renderJogos(jogos, chave) {
    const filtrados = jogos.filter(j => j.chave === chave)
    const subRodadas = []
    for (let i = 0; i < filtrados.length; i += 3) {
      subRodadas.push(filtrados.slice(i, i + 3))
    }
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
        <ToggleChave />
        {renderJogos(detalheJogos, chaveVis)}
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

  // ── VIEW: PRÓXIMA RODADA (principal) ──
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