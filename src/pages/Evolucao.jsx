import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CORES = [
  '#f5c518', '#2ecc71', '#3498db', '#e74c3c', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
  '#ff5722', '#607d8b',
]

export default function Evolucao({ onFechar, jogadorAtualId }) {
  const [jogadores, setJogadores] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [dados, setDados] = useState({})
  const [rodadas, setRodadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    // Busca rodadas finalizadas
    const { data: rods } = await supabase
      .from('rodadas').select('id, numero, tipo')
      .eq('status', 'finalizada')
      .order('numero', { ascending: true })
    setRodadas(rods || [])

    // Busca todos os jogadores
    const { data: jogs } = await supabase
      .from('jogadores').select('id, nome, chave, foto_url')
      .order('nome', { ascending: true })
    setJogadores(jogs || [])

    // Pré-seleciona o jogador atual
    if (jogadorAtualId) setSelecionados([jogadorAtualId])

    // Busca todos os pontos
    const { data: pts } = await supabase
      .from('pontuacao').select('jogador_id, rodada_id, pontos')
    
    // Organiza pontos por jogador e rodada (acumulado)
    const mapa = {}
    for (const p of (pts || [])) {
      if (!mapa[p.jogador_id]) mapa[p.jogador_id] = {}
      mapa[p.jogador_id][p.rodada_id] = p.pontos
    }

    // Calcula acumulado por rodada
    const acumulado = {}
    for (const jogId in mapa) {
      acumulado[jogId] = {}
      let total = 0
      for (const rod of (rods || [])) {
        total += mapa[jogId][rod.id] || 0
        acumulado[jogId][rod.numero] = total
      }
    }

    setDados(acumulado)
    setLoading(false)
  }

  function toggleJogador(id) {
    setSelecionados(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 6 ? [...prev, id] : prev
    )
  }

  // Calcula max para escala
  const maxPts = Math.max(1, ...selecionados.flatMap(id =>
    rodadas.map(r => dados[id]?.[r.numero] || 0)
  ))

  const w = 320
  const h = 200
  const padL = 40
  const padB = 30
  const padT = 10
  const padR = 10
  const graphW = w - padL - padR
  const graphH = h - padT - padB

  function xPos(idx) {
    return padL + (idx / Math.max(rodadas.length - 1, 1)) * graphW
  }
  function yPos(pts) {
    return padT + graphH - (pts / maxPts) * graphH
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2d1e', zIndex: 500, overflowY: 'auto', padding: '20px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onFechar} style={{ background: 'transparent', border: '1px solid #2a5a3a', color: '#7fb89a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#c9a227', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: 'uppercase' }}>
            📈 Evolução
          </h1>
          <div style={{ fontSize: 11, color: '#7fb89a', marginTop: 1 }}>Selecione até 6 atletas para comparar</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Gráfico SVG */}
          <div style={{ background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 12, padding: 16, marginBottom: 16, overflowX: 'auto' }}>
            {selecionados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Selecione um atleta abaixo para ver a evolução
              </div>
            ) : (
              <svg width={w} height={h} style={{ display: 'block', margin: '0 auto' }}>
                {/* Grid horizontal */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                  const y = padT + graphH * (1 - p)
                  const val = Math.round(maxPts * p)
                  return (
                    <g key={i}>
                      <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                      <text x={padL - 4} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9}>{val}</text>
                    </g>
                  )
                })}

                {/* Labels das rodadas */}
                {rodadas.map((r, i) => (
                  <text key={r.id} x={xPos(i)} y={h - 6} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9}>
                    R{r.numero}
                  </text>
                ))}

                {/* Linhas dos jogadores */}
                {selecionados.map((id, ci) => {
                  const cor = CORES[ci % CORES.length]
                  const pontos = rodadas.map(r => dados[id]?.[r.numero] || 0)
                  const pts = rodadas.map((r, i) => `${xPos(i)},${yPos(pontos[i])}`).join(' ')

                  return (
                    <g key={id}>
                      <polyline points={pts} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      {rodadas.map((r, i) => (
                        <circle
                          key={r.id}
                          cx={xPos(i)} cy={yPos(pontos[i])} r={4}
                          fill={cor} stroke="#0f2d1e" strokeWidth={1.5}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setTooltip({ id, rodada: r.numero, pts: pontos[i], x: xPos(i), y: yPos(pontos[i]), cor })}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ))}
                    </g>
                  )
                })}

                {/* Tooltip */}
                {tooltip && (
                  <g>
                    <rect x={tooltip.x - 30} y={tooltip.y - 28} width={60} height={22} rx={4} fill="#0f2d1e" stroke={tooltip.cor} strokeWidth={1} />
                    <text x={tooltip.x} y={tooltip.y - 13} textAnchor="middle" fill={tooltip.cor} fontSize={10} fontWeight="bold">
                      R{tooltip.rodada}: {tooltip.pts} pts
                    </text>
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* Legenda dos selecionados */}
          {selecionados.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {selecionados.map((id, ci) => {
                const jog = jogadores.find(j => j.id === id)
                const cor = CORES[ci % CORES.length]
                const ultimoPts = dados[id]?.[rodadas[rodadas.length - 1]?.numero] || 0
                return (
                  <div key={id} onClick={() => toggleJogador(id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: cor + '22', borderRadius: 20, border: `1px solid ${cor}55`, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
                    <span style={{ fontSize: 12, color: '#e8f5e9', fontWeight: 600 }}>{jog?.nome}</span>
                    <span style={{ fontSize: 11, color: cor, fontWeight: 700 }}>{ultimoPts} pts</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>✕</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista de atletas para selecionar */}
          <div style={{ background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Atletas ({selecionados.length}/6 selecionados)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {jogadores.filter(j => Object.keys(dados).includes(j.id)).map((jog, ci) => {
                const sel = selecionados.includes(jog.id)
                const idx = selecionados.indexOf(jog.id)
                const cor = sel ? CORES[idx % CORES.length] : null
                const ultimoPts = dados[jog.id]?.[rodadas[rodadas.length - 1]?.numero] || 0
                return (
                  <div
                    key={jog.id}
                    onClick={() => toggleJogador(jog.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      background: sel ? (cor + '22') : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sel ? cor + '66' : '#2a5a3a'}`,
                      borderRadius: 8, cursor: selecionados.length >= 6 && !sel ? 'not-allowed' : 'pointer',
                      opacity: selecionados.length >= 6 && !sel ? 0.4 : 1,
                    }}
                  >
                    {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? cor : '#e8f5e9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{jog.nome}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{ultimoPts} pts</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
