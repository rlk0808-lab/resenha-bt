import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Rodada() {
  const [rodada, setRodada] = useState(null)
  const [jogos, setJogos] = useState([])
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
          .order('numero_rodada', { ascending: true })
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
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>
          Nenhuma rodada ativa no momento
        </p>
      </div>
    </div>
  )

  const jogosPorRodada = jogos.reduce((acc, j) => {
    if (!acc[j.numero_rodada]) acc[j.numero_rodada] = []
    acc[j.numero_rodada].push(j)
    return acc
  }, {})

  const cores = ['#1a4d2e', '#2d1a4d', '#1a3a4d', '#2d2d1a']

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <h1 className="section-title" style={{ margin: 0 }}>
          🎾 Rodada {rodada.numero}
        </h1>
        <span className={rodada.chave === 'ouro' ? 'badge-ouro' : 'badge-prata'}>
          {rodada.chave === 'ouro' ? 'Chave Ouro' : 'Chave Prata'}
        </span>
      </div>

      {Object.entries(jogosPorRodada).map(([numRodada, jogosRodada]) => (
        <div key={numRodada} className="card" style={{
          marginBottom: '12px',
          borderLeft: `3px solid ${cores[(numRodada - 1) % 4]}`,
          padding: '16px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '12px'
          }}>Rodada {numRodada}</div>

          {jogosRodada.map((jogo, i) => (
            <div key={jogo.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 0',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none'
            }}>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_a_1}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                  {jogo.dupla_a_2}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: '80px',
                justifyContent: 'center'
              }}>
                <div style={{
                  background: jogo.placar_a > jogo.placar_b
                    ? 'rgba(245,197,24,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${jogo.placar_a > jogo.placar_b
                    ? 'rgba(245,197,24,0.3)'
                    : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '20px',
                  color: jogo.placar_a > jogo.placar_b
                    ? '#f5c518'
                    : 'rgba(255,255,255,0.5)',
                  minWidth: '32px',
                  textAlign: 'center'
                }}>
                  {jogo.placar_a ?? '–'}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>X</span>
                <div style={{
                  background: jogo.placar_b > jogo.placar_a
                    ? 'rgba(245,197,24,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${jogo.placar_b > jogo.placar_a
                    ? 'rgba(245,197,24,0.3)'
                    : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '20px',
                  color: jogo.placar_b > jogo.placar_a
                    ? '#f5c518'
                    : 'rgba(255,255,255,0.5)',
                  minWidth: '32px',
                  textAlign: 'center'
                }}>
                  {jogo.placar_b ?? '–'}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_b_1}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                  {jogo.dupla_b_2}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {jogos.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>
            Os jogos ainda não foram sorteados
          </p>
        </div>
      )}
    </div>
  )
}