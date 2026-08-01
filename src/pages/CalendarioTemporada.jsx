import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { baixarIcs } from '../lib/calendario'
import { buscarLigaAtual } from '../lib/temporada'

export default function CalendarioTemporada({ onFechar }) {
  const [liga, setLiga] = useState(null)
  const [rodadas, setRodadas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const ligaAtual = await buscarLigaAtual()
      setLiga(ligaAtual)
      const { data } = await supabase
        .from('rodadas').select('*')
        .eq('liga', ligaAtual)
        .order('numero', { ascending: true })
      setRodadas(data || [])
      setLoading(false)
    }
    carregar()
  }, [])

  function statusInfo(status) {
    if (status === 'finalizada') return { emoji: '✅', label: 'Realizada', cor: '#7fb89a' }
    if (status === 'ativa') return { emoji: '🎾', label: 'Sorteio publicado', cor: '#2ecc71' }
    if (status === 'proxima') return { emoji: '📅', label: 'Confirmações abertas', cor: '#c9a227' }
    return { emoji: '⏳', label: status, cor: 'rgba(255,255,255,0.4)' }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2d1e', zIndex: 500, overflowY: 'auto', padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={onFechar} style={{ background: 'transparent', border: '1px solid #2a5a3a', color: '#7fb89a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#c9a227', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: 'uppercase' }}>
            📅 Calendário da Temporada
          </h1>
          <div style={{ fontSize: 11, color: '#7fb89a', marginTop: 1 }}>{liga || 'Temporada atual'}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : rodadas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Nenhuma rodada cadastrada ainda nesta temporada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {rodadas.map(r => {
            const info = statusInfo(r.status)
            const data = new Date(r.data + 'T12:00:00')
            return (
              <div key={r.id} style={{
                background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 12,
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 10, background: 'rgba(201,162,39,0.1)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#c9a227', lineHeight: 1, fontFamily: "'Bebas Neue', sans-serif" }}>
                    {data.toLocaleDateString('pt-BR', { day: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 10, color: '#7fb89a', textTransform: 'uppercase' }}>
                    {data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f5e9' }}>
                    {r.tipo === 'qualify' ? 'Qualify — define Ouro/Prata'
                      : r.tipo === 'especial' ? `Rodada ${r.numero} — Especial 🏆`
                      : `Rodada ${r.numero}`}
                  </div>
                  <div style={{ fontSize: 12, color: info.cor, marginTop: 2 }}>{info.emoji} {info.label}</div>
                  {r.local && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>📍 {r.local}</div>}
                </div>
                <button onClick={() => baixarIcs(r)} title="Adicionar à agenda" style={{
                  background: 'transparent', border: '1px solid #2a5a3a', color: '#7fb89a',
                  borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 16, flexShrink: 0,
                }}>
                  📆
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
