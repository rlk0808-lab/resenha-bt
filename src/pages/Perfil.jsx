import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Perfil() {
  const [perfil, setPerfil] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase
        .from('jogadores')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setPerfil(p)
      const { data: s } = await supabase
        .from('stats_jogador')
        .select('*')
        .eq('jogador_id', p?.id)
        .single()
      setStats(s)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  const statCards = [
    { label: 'Pontos', valor: stats?.pontos_total || 0, cor: '#f5c518' },
    { label: 'Vitórias', valor: stats?.vitorias || 0, cor: '#2d7a45' },
    { label: 'Rodadas', valor: stats?.rodadas_jogadas || 0, cor: '#4d8ab5' },
    { label: 'Posição', valor: stats?.posicao ? `${stats.posicao}º` : '–', cor: '#e8621a' },
  ]

  return (
    <div>
      <div className="card" style={{
        marginBottom: '16px',
        background: 'linear-gradient(135deg, #112918, #0d2b1a)',
        border: '1px solid rgba(245,197,24,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            fontFamily: "'Bebas Neue', sans-serif",
            border: '2px solid rgba(245,197,24,0.3)',
            flexShrink: 0
          }}>
            {perfil?.nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '28px',
              letterSpacing: '2px',
              lineHeight: 1,
              color: '#ffffff'
            }}>{perfil?.nome || 'Jogador'}</div>
            <div style={{ marginTop: '6px' }}>
              {perfil?.chave === 'ouro'
                ? <span className="badge-ouro">Chave Ouro</span>
                : <span className="badge-prata">Chave Prata</span>
              }
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '16px'
      }}>
        {statCards.map(({ label, valor, cor }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '36px',
              color: cor,
              lineHeight: 1
            }}>{valor}</div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '4px'
            }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '16px',
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '16px'
        }}>Histórico de Temporadas</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { liga: 'Torneio de Inverno 2026', posicao: '–', pontos: '–', status: 'Em andamento' },
            { liga: 'Torneio de Verão 2026', posicao: '–', pontos: '–', status: 'Concluído' },
          ].map((t, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              border: '1px solid var(--borda)'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t.liga}</div>
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: '2px'
                }}>{t.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '22px',
                  color: '#f5c518'
                }}>{t.pontos}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  {t.posicao} lugar
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}