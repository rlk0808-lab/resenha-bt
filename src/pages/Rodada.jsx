import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Rodada() {
  const [rodada, setRodada] = useState(null)
  const [jogos, setJogos] = useState([])
  const [chaveVis, setChaveVis] = useState('ouro')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: rod } = await supabase
        .from('rodadas')
        .select('*')
        .eq('status', 'ativa')
        .single()
      setRodada(rod)
      if (rod) {
        const { data: j } = await supabase
          .from('jogos')
          .select('*')
          .eq('rodada_id', rod.id)
          .order('chave', { ascending: true })
          .order('created_at', { ascending: true })
        setJogos(j || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  if (!rodada) return (
    <div>
      <h1 className="section-title">🎾 Rodada</h1>
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma rodada ativa no momento</p>
      </div>
    </div>
  )

  const jogosFiltrados = jogos.filter(j => j.chave === chaveVis)

  // Agrupa em sub-rodadas de 3 jogos cada (12 jogadores = 3 jogos por sub-rodada)
  const tamanhoGrupo = chaveVis === 'ouro' ? 3 : 3
  const subRodadas = []
  for (let i = 0; i < jogosFiltrados.length; i += tamanhoGrupo) {
    subRodadas.push(jogosFiltrados.slice(i, i + tamanhoGrupo))
  }

  const ouro = '#c9a227'
  const prata = '#8e9eab'
  const corChave = chaveVis === 'ouro' ? ouro : prata

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="section-title" style={{ margin: 0 }}>🎾 Rodada {rodada.numero}</h1>
      </div>

      {/* Toggle Ouro/Prata */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '20px',
        background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px'
      }}>
        {[
          { key: 'ouro', label: '🥇 Chave Ouro' },
          { key: 'prata', label: '🥈 Chave Prata' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setChaveVis(key)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
            background: chaveVis === key
              ? `linear-gradient(135deg, ${key === 'ouro' ? '#f5c518, #c9a010' : '#8e9eab, #6b7f8a'})`
              : 'transparent',
            color: chaveVis === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px', fontWeight: 700, letterSpacing: '1px',
            textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s'
          }}>{label}</button>
        ))}
      </div>

      {subRodadas.map((jogosGrupo, idx) => (
        <div key={idx} className="card" style={{
          marginBottom: '12px',
          borderLeft: `3px solid ${corChave}`,
          padding: '16px'
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px'
          }}>Rodada {idx + 1}</div>

          {jogosGrupo.map((jogo, i) => (
            <div key={jogo.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none'
            }}>
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
                    {li === 1 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>X</span>}
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
      ))}

      {jogosFiltrados.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo cadastrado para esta chave</p>
        </div>
      )}
    </div>
  )
}