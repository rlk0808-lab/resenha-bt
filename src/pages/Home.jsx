import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Trophy, Users, CheckCircle } from 'lucide-react'

export default function Home() {
  const [proximaRodada, setProximaRodada] = useState(null)
  const [confirmado, setConfirmado] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('rodadas')
        .select('*')
        .eq('status', 'proxima')
        .single()
      setProximaRodada(data)
      if (data && user) {
        const { data: conf } = await supabase
          .from('confirmacoes')
          .select('*')
          .eq('rodada_id', data.id)
          .eq('jogador_id', user.id)
          .single()
        setConfirmado(!!conf)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function confirmarPresenca() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!proximaRodada || !user) return
    await supabase.from('confirmacoes').upsert({
      rodada_id: proximaRodada.id,
      jogador_id: user.id
    })
    setConfirmado(true)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '36px',
          letterSpacing: '3px',
          background: 'linear-gradient(135deg, #f5c518, #ffffff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1
        }}>BOM DIA, CAMPEÃO!</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '6px' }}>
          Torneio de Inverno 2026 · Liga em andamento
        </p>
      </div>

      <div className="card" style={{
        marginBottom: '20px',
        background: 'linear-gradient(135deg, #112918, #0d2b1a)',
        border: '1px solid rgba(245,197,24,0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '120px', height: '120px',
          background: 'radial-gradient(circle, rgba(245,197,24,0.05) 0%, transparent 70%)'
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Calendar size={18} color="#f5c518" />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)'
          }}>Próxima Rodada</span>
        </div>

        {proximaRodada ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '32px',
                letterSpacing: '2px',
                color: '#ffffff'
              }}>
                Rodada {proximaRodada.numero}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', marginTop: '4px' }}>
                📅 {new Date(proximaRodada.data).toLocaleDateString('pt-BR', {
                  weekday: 'long', day: '2-digit', month: 'long'
                })}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px' }}>
                ⏰ 08:00 · Veronica Beach Tennis, Londrina
              </div>
            </div>

            {confirmado ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(45,122,69,0.15)',
                border: '1px solid rgba(45,122,69,0.4)',
                borderRadius: '10px',
                padding: '14px 16px'
              }}>
                <CheckCircle size={20} color="#2d7a45" />
                <div>
                  <div style={{ fontWeight: 700, color: '#2d7a45' }}>Presença confirmada!</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                    Você está confirmado para esta rodada
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '12px'
                }}>
                  ⚠️ Confirmação até quarta-feira às 10h
                </p>
                <button className="btn-primary" onClick={confirmarPresenca}>
                  ✓ Confirmar presença
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
            Nenhuma rodada agendada no momento
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <Trophy size={24} color="#f5c518" style={{ marginBottom: '8px' }} />
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '28px',
            color: '#f5c518'
          }}>1</div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>Rodada atual</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Users size={24} color="#2d7a45" style={{ marginBottom: '8px' }} />
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '28px',
            color: '#2d7a45'
          }}>24</div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>Jogadores ativos</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}>Liga</div>
            <div style={{ fontWeight: 700 }}>Torneio de Inverno 2026</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}>Rodadas</div>
            <div style={{ fontWeight: 700 }}>1 / 12</div>
          </div>
        </div>
        <div style={{
          marginTop: '12px',
          height: '4px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: '8.33%',
            background: 'linear-gradient(90deg, #f5c518, #2d7a45)',
            borderRadius: '2px'
          }} />
        </div>
      </div>
    </div>
  )
}