import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buscarLigaAtual } from '../lib/temporada'

export default function DetalhadoRodadas({ onFechar }) {
  const navigate = useNavigate()
  const [liga, setLiga] = useState(null)
  const [rodadas, setRodadas] = useState([])
  const [jogadores, setJogadores] = useState([])
  const [pontuacao, setPontuacao] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const ligaAtual = await buscarLigaAtual()
      setLiga(ligaAtual)

      const { data: rods } = await supabase
        .from('rodadas').select('id, numero')
        .eq('status', 'finalizada').eq('liga', ligaAtual)
        .order('numero', { ascending: true })
      setRodadas(rods || [])

      const rodadaIds = (rods || []).map(r => r.id)

      const [{ data: jogs }, { data: pts }] = await Promise.all([
        supabase.from('jogadores').select('id, nome').order('nome', { ascending: true }),
        rodadaIds.length > 0
          ? supabase.from('pontuacao').select('jogador_id, rodada_id, pontos').in('rodada_id', rodadaIds)
          : Promise.resolve({ data: [] }),
      ])
      setJogadores(jogs || [])
      setPontuacao(pts || [])
      setLoading(false)
    }
    carregar()
  }, [])

  // Uma linha por jogador que tem pelo menos uma pontuação nessa liga.
  // Marca as 2 piores rodadas de cada um como "descartadas" (mesma regra de src/lib/temporada.js).
  const linhas = jogadores.map(j => {
    const porRodada = {}
    for (const r of rodadas) {
      const row = pontuacao.find(p => p.jogador_id === j.id && p.rodada_id === r.id)
      porRodada[r.numero] = row ? row.pontos : null
    }
    const jogadas = rodadas.map(r => ({ numero: r.numero, pts: porRodada[r.numero] })).filter(x => x.pts !== null)
    const total = jogadas.reduce((s, x) => s + x.pts, 0)

    const descartadas = new Set()
    let totalComDescarte = total
    if (jogadas.length > 2) {
      const piores = [...jogadas].sort((a, b) => a.pts - b.pts).slice(0, 2)
      piores.forEach(p => descartadas.add(p.numero))
      totalComDescarte = total - piores.reduce((s, p) => s + p.pts, 0)
    }

    return { jogador: j, porRodada, total, totalComDescarte, descartadas, jogou: jogadas.length > 0 }
  }).filter(l => l.jogou).sort((a, b) => b.total - a.total)

  function exportarCSV() {
    const header = ['Jogador', ...rodadas.map(r => `Rodada ${r.numero}`), 'Total (sem descarte)', 'Total (com descarte)']
    const linhasCsv = linhas.map(l => [
      l.jogador.nome,
      ...rodadas.map(r => l.porRodada[r.numero] ?? ''),
      l.total,
      l.totalComDescarte,
    ])
    const csv = [header, ...linhasCsv]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pontuacao_${(liga || 'liga').replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2d1e', zIndex: 500, overflowY: 'auto', padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onFechar} style={{ background: 'transparent', border: '1px solid #2a5a3a', color: '#7fb89a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
            ← Voltar
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#c9a227', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: 'uppercase' }}>
              📋 Detalhado por Rodada
            </h1>
            <div style={{ fontSize: 11, color: '#7fb89a', marginTop: 1 }}>{liga || 'Temporada atual'} — pontuação de todo mundo, rodada a rodada</div>
          </div>
        </div>
        <button onClick={exportarCSV} disabled={loading || linhas.length === 0} style={{
          background: '#c9a227', border: 'none', color: '#0d2b1a', borderRadius: 8, padding: '8px 14px',
          cursor: loading || linhas.length === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
          opacity: loading || linhas.length === 0 ? 0.5 : 1,
        }}>
          ⬇️ Exportar CSV
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : linhas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Nenhuma rodada finalizada ainda nesta temporada.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '12px 0' }}>
            Números riscados = as 2 piores rodadas de cada jogador, descartadas no total "com descarte".
          </div>
          <div style={{ background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 12, overflow: 'auto' }}>
            <table className="tabela" style={{ minWidth: rodadas.length * 56 + 340 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#162f20', minWidth: 140 }}>Jogador</th>
                  {rodadas.map(r => (
                    <th key={r.id} style={{ textAlign: 'center', minWidth: 48 }}>R{r.numero}</th>
                  ))}
                  <th style={{ textAlign: 'right', minWidth: 90 }}>Total</th>
                  <th style={{ textAlign: 'right', minWidth: 90 }}>C/ descarte</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.jogador.id}>
                    <td
                      onClick={() => navigate(`/jogador/${l.jogador.id}`)}
                      style={{ position: 'sticky', left: 0, background: '#162f20', cursor: 'pointer', color: '#f5c518', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {l.jogador.nome}
                    </td>
                    {rodadas.map(r => {
                      const pts = l.porRodada[r.numero]
                      const descartada = l.descartadas.has(r.numero)
                      return (
                        <td key={r.id} style={{
                          textAlign: 'center',
                          color: pts === null ? 'rgba(255,255,255,0.2)' : descartada ? 'rgba(255,255,255,0.35)' : '#e8f5e9',
                          textDecoration: descartada ? 'line-through' : 'none',
                        }}>
                          {pts === null ? '—' : pts}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#e8f5e9' }}>{l.total}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5c518' }}>{l.totalComDescarte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
