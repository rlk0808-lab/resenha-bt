import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Classificacao() {
  const [aba, setAba] = useState('geral')
  const [jogadores, setJogadores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('classificacao')
        .select('*')
        .order('posicao', { ascending: true })
      setJogadores(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const ouro = jogadores.filter(j => j.chave === 'ouro')
  const prata = jogadores.filter(j => j.chave === 'prata')
  const lista = aba === 'geral' ? jogadores : aba === 'ouro' ? ouro : prata

  function corPos(pos) {
    if (pos === 1) return 'var(--ouro)'
    if (pos === 2) return 'var(--prata)'
    if (pos === 3) return 'var(--bronze)'
    return 'rgba(255,255,255,0.6)'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div>
      <h1 className="section-title">🏆 Classificação</h1>

      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        background: 'rgba(255,255,255,0.04)',
        padding: '4px',
        borderRadius: '10px'
      }}>
        {[
          { key: 'geral', label: 'Geral' },
          { key: 'ouro', label: '🥇 Ouro' },
          { key: 'prata', label: '🥈 Prata' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '8px',
              background: aba === key
                ? 'linear-gradient(135deg, #f5c518, #c9a010)'
                : 'transparent',
              color: aba === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >{label}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tabela">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>#</th>
              <th>Jogador</th>
              <th style={{ textAlign: 'right' }}>V</th>
              <th style={{ textAlign: 'right' }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((j) => (
              <tr key={j.id}>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '18px',
                    color: corPos(j.posicao)
                  }}>
                    {j.posicao}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px',
                      background: 'linear-gradient(135deg, #1a4d2e, #0d2b1a)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: `1px solid ${j.chave === 'ouro'
                        ? 'rgba(255,215,0,0.3)'
                        : 'rgba(192,192,192,0.3)'}`
                    }}>
                      {j.nome?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{j.nome}</div>
                      <div style={{ marginTop: '2px' }}>
                        {j.chave === 'ouro'
                          ? <span className="badge-ouro">Ouro</span>
                          : <span className="badge-prata">Prata</span>
                        }
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{
                  textAlign: 'right',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '13px'
                }}>
                  {j.vitorias || 0}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '20px',
                    color: j.posicao <= 3 ? corPos(j.posicao) : '#f5c518'
                  }}>
                    {j.pontos || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lista.length === 0 && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px'
          }}>
            Nenhum dado disponível ainda
          </div>
        )}
      </div>
    </div>
  )
}