import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CORES = [
  '#f5c518', '#2ecc71', '#3498db', '#e74c3c', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
]

const MODOS = [
  { key: 'pontos', label: 'Pontos', desc: 'sem descarte' },
  { key: 'descarte', label: 'Pontos', desc: 'com descarte' },
  { key: 'posicao', label: 'Posição', desc: 'sem descarte' },
  { key: 'posicao_desc', label: 'Posição', desc: 'com descarte' },
]

export default function Evolucao({ onFechar, jogadorAtualId }) {
  const [jogadores, setJogadores] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [dadosPontos, setDadosPontos] = useState({})
  const [dadosDescarte, setDadosDescarte] = useState({})
  const [dadosPosicao, setDadosPosicao] = useState({})
  const [rodadas, setRodadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const [modo, setModo] = useState('pontos')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)

    const { data: rods } = await supabase
      .from('rodadas').select('id, numero, tipo')
      .eq('status', 'finalizada')
      .order('numero', { ascending: true })
    setRodadas(rods || [])

    const { data: jogs } = await supabase
      .from('jogadores').select('id, nome, chave, foto_url')
      .order('nome', { ascending: true })
    setJogadores(jogs || [])

    if (jogadorAtualId) setSelecionados([jogadorAtualId])

    const { data: pts } = await supabase
      .from('pontuacao').select('jogador_id, rodada_id, pontos')

    // Mapa de pontos por rodada
    const mapaPts = {}
    for (const p of (pts || [])) {
      if (!mapaPts[p.jogador_id]) mapaPts[p.jogador_id] = {}
      mapaPts[p.jogador_id][p.rodada_id] = p.pontos
    }

    // Pontos acumulados (sem descarte)
    const acumulado = {}
    for (const jogId in mapaPts) {
      acumulado[jogId] = {}
      let total = 0
      for (const rod of (rods || [])) {
        total += mapaPts[jogId][rod.id] || 0
        acumulado[jogId][rod.numero] = total
      }
    }
    setDadosPontos(acumulado)

    // Pontos com descarte (descarta 2 piores por rodada)
    const comDescarte = {}
    for (const jogId in mapaPts) {
      comDescarte[jogId] = {}
      const rodsJogadas = (rods || []).map(r => mapaPts[jogId][r.id] || 0)
      // Para cada rodada, calcula total descontando os 2 piores até aquela rodada
      for (let i = 0; i < (rods || []).length; i++) {
        const slice = rodsJogadas.slice(0, i + 1)
        const total = slice.reduce((s, v) => s + v, 0)
        // Só descarta se tiver mais de 2 rodadas jogadas
        let totalDesc = total
        if (slice.length > 2) {
          const sorted = [...slice].sort((a, b) => a - b)
          const descartados = sorted.slice(0, 2)
          totalDesc = total - descartados.reduce((s, v) => s + v, 0)
        }
        comDescarte[jogId][(rods || [])[i].numero] = totalDesc
      }
    }
    setDadosDescarte(comDescarte)

    // Posição na classificação por rodada (sem descarte)
    const posicao = {}
    for (const jogId in mapaPts) posicao[jogId] = {}

    for (let i = 0; i < (rods || []).length; i++) {
      const rod = (rods || [])[i]
      const ranking = Object.entries(acumulado).map(([id, dados]) => ({
        id, pts: dados[rod.numero] || 0
      })).sort((a, b) => b.pts - a.pts)
      ranking.forEach((j, idx) => {
        if (!posicao[j.id]) posicao[j.id] = {}
        posicao[j.id][rod.numero] = idx + 1
      })
    }

    // Posição na classificação por rodada (com descarte)
    const posicaoDesc = {}
    for (const jogId in comDescarte) posicaoDesc[jogId] = {}

    for (let i = 0; i < (rods || []).length; i++) {
      const rod = (rods || [])[i]
      const ranking = Object.entries(comDescarte).map(([id, dados]) => ({
        id, pts: dados[rod.numero] || 0
      })).sort((a, b) => b.pts - a.pts)
      ranking.forEach((j, idx) => {
        if (!posicaoDesc[j.id]) posicaoDesc[j.id] = {}
        posicaoDesc[j.id][rod.numero] = idx + 1
      })
    }

    setDadosPosicao({ sem: posicao, com: posicaoDesc })

    setLoading(false)
  }

  function toggleJogador(id) {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 6 ? [...prev, id] : prev
    )
  }

  const dadosAtivos = modo === 'pontos' ? dadosPontos : modo === 'descarte' ? dadosDescarte : modo === 'posicao' ? (dadosPosicao.sem || {}) : (dadosPosicao.com || {})
  const inverter = modo === 'posicao' || modo === 'posicao_desc'

  const valores = selecionados.flatMap(id => rodadas.map(r => dadosAtivos[id]?.[r.numero] || 0))
  const maxVal = Math.max(1, ...valores)
  const minVal = inverter ? Math.max(1, Math.min(...valores.filter(v => v > 0))) : 0

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
  function yPos(val) {
    if (inverter) {
      // Posição: 1 fica no topo, máximo fica embaixo
      return padT + ((val - 1) / Math.max(maxVal - 1, 1)) * graphH
    }
    return padT + graphH - (val / maxVal) * graphH
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2d1e', zIndex: 500, overflowY: 'auto', padding: '20px 16px 100px' }}>
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

      {/* Toggle de modo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {MODOS.map(m => (
          <button key={m.key} onClick={() => setModo(m.key)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: modo === m.key ? '#c9a227' : '#1e3d2a',
            color: modo === m.key ? '#0d2b1a' : '#7fb89a',
            fontWeight: 700, fontSize: 11, lineHeight: 1.3
          }}>
            <div>{m.label}</div>
            <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div style={{ background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 12, padding: 16, marginBottom: 16, overflowX: 'auto' }}>
            {selecionados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Selecione um atleta abaixo
              </div>
            ) : (
              <svg width={w} height={h} style={{ display: 'block', margin: '0 auto' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                  const y = padT + graphH * p
                  const val = inverter
                    ? Math.round(1 + (maxVal - 1) * p)
                    : Math.round(maxVal * (1 - p))
                  return (
                    <g key={i}>
                      <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                      <text x={padL - 4} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9}>
                        {inverter ? `${val}º` : val}
                      </text>
                    </g>
                  )
                })}

                {rodadas.map((r, i) => (
                  <text key={r.id} x={xPos(i)} y={h - 6} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9}>
                    R{r.numero}
                  </text>
                ))}

                {selecionados.map((id, ci) => {
                  const cor = CORES[ci % CORES.length]
                  const vals = rodadas.map(r => dadosAtivos[id]?.[r.numero] || 0)
                  const pts = rodadas.map((r, i) => `${xPos(i)},${yPos(vals[i])}`).join(' ')
                  return (
                    <g key={id}>
                      <polyline points={pts} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      {rodadas.map((r, i) => (
                        <circle key={r.id} cx={xPos(i)} cy={yPos(vals[i])} r={4}
                          fill={cor} stroke="#0f2d1e" strokeWidth={1.5} style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setTooltip({ id, rodada: r.numero, val: vals[i], x: xPos(i), y: yPos(vals[i]), cor })}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      ))}
                    </g>
                  )
                })}

                {tooltip && (
                  <g>
                    <rect x={tooltip.x - 32} y={tooltip.y - 28} width={64} height={22} rx={4} fill="#0f2d1e" stroke={tooltip.cor} strokeWidth={1} />
                    <text x={tooltip.x} y={tooltip.y - 13} textAnchor="middle" fill={tooltip.cor} fontSize={10} fontWeight="bold">
                      R{tooltip.rodada}: {inverter ? `${tooltip.val}º` : `${tooltip.val}pts`}
                    </text>
                  </g>
                )}
              </svg>
            )}
          </div>

          {selecionados.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {selecionados.map((id, ci) => {
                const jog = jogadores.find(j => j.id === id)
                const cor = CORES[ci % CORES.length]
                const ultimoVal = dadosAtivos[id]?.[rodadas[rodadas.length - 1]?.numero] || 0
                return (
                  <div key={id} onClick={() => toggleJogador(id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: cor + '22', borderRadius: 20, border: `1px solid ${cor}55`, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
                    <span style={{ fontSize: 12, color: '#e8f5e9', fontWeight: 600 }}>{jog?.nome}</span>
                    <span style={{ fontSize: 11, color: cor, fontWeight: 700 }}>{inverter ? `${ultimoVal}º` : `${ultimoVal}pts`}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>✕</span>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Atletas ({selecionados.length}/6 selecionados)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {jogadores.filter(j => Object.keys(dadosPontos).includes(j.id) || Object.keys(dadosDescarte).includes(j.id)).map((jog, ci) => {
                const sel = selecionados.includes(jog.id)
                const idx = selecionados.indexOf(jog.id)
                const cor = sel ? CORES[idx % CORES.length] : null
                const ultimoVal = dadosAtivos[jog.id]?.[rodadas[rodadas.length - 1]?.numero] || 0
                return (
                  <div key={jog.id} onClick={() => toggleJogador(jog.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: sel ? (cor + '22') : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${sel ? cor + '66' : '#2a5a3a'}`,
                    borderRadius: 8, cursor: selecionados.length >= 6 && !sel ? 'not-allowed' : 'pointer',
                    opacity: selecionados.length >= 6 && !sel ? 0.4 : 1,
                  }}>
                    {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? cor : '#e8f5e9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{jog.nome}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{inverter ? `${ultimoVal}º lugar` : `${ultimoVal} pts`}</div>
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
