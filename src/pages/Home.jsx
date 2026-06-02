import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Trophy, Users, CheckCircle } from 'lucide-react'

export default function Home() {
  const [proximaRodada, setProximaRodada] = useState(null)
  const [rodadaAtual, setRodadaAtual] = useState(null)
  const TOTAL_RODADAS = 12
  const [confirmado, setConfirmado] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [confirmacaoId, setConfirmacaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [totalConfirmados, setTotalConfirmados] = useState(0)
  const [totalJogadores, setTotalJogadores] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      // Busca todas as rodadas
      const { data: todasRodadas } = await supabase
        .from('rodadas').select('*').order('numero', { ascending: true })

      if (todasRodadas) {

        // Rodada atual = última finalizada ou ativa
        const finalizada = todasRodadas.filter(r => r.status === 'finalizada')
        const ativa = todasRodadas.find(r => r.status === 'ativa')
        const atual = ativa || finalizada[finalizada.length - 1] || null
        setRodadaAtual(atual)

        // Próxima rodada = proxima ou ativa
        const proxima = todasRodadas.find(r => r.status === 'proxima') || ativa || null
        setProximaRodada(proxima)

        if (proxima && user) {
          const { data: jogadores } = await supabase
            .from('jogadores').select('id').eq('user_id', user.id).limit(1)
          const jogador = jogadores?.[0]

          if (jogador) {
            const { data: confs } = await supabase
              .from('confirmacoes').select('id, status')
              .eq('rodada_id', proxima.id).eq('jogador_id', jogador.id).limit(1)
            if (confs && confs.length > 0 && confs[0].status === 'confirmado') {
              setConfirmado(true)
              setConfirmacaoId(confs[0].id)
            }
          }

          const { data: todos } = await supabase
            .from('confirmacoes').select('id')
            .eq('rodada_id', proxima.id).eq('status', 'confirmado')
          setTotalConfirmados(todos?.length || 0)
        }
      }

      // Total jogadores ativos
      const { count } = await supabase
        .from('jogadores').select('id', { count: 'exact', head: true }).eq('ativo', true)
      setTotalJogadores(count || 0)

      setLoading(false)
    }
    load()
  }, [])

  async function cancelarPresenca() {
    if (!confirmacaoId) return
    setCancelando(true)
    const { error } = await supabase.from('confirmacoes').delete().eq('id', confirmacaoId)
    if (!error) {
      setConfirmado(false)
      setConfirmacaoId(null)
      setTotalConfirmados(t => Math.max(0, t - 1))
    }
    setCancelando(false)
  }

  const rodadasFinalizadas = rodadaAtual?.numero || 0
  const progresso = (rodadasFinalizadas / TOTAL_RODADAS) * 100

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

      {/* Card próxima rodada */}
      <div className="card" style={{
        marginBottom: '20px',
        background: 'linear-gradient(135deg, #112918, #0d2b1a)',
        border: '1px solid rgba(245,197,24,0.2)',
        position: 'relative', overflow: 'hidden'
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
            fontSize: '13px', fontWeight: 700, letterSpacing: '2px',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)'
          }}>Próxima Rodada</span>
        </div>

        {proximaRodada ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '32px', letterSpacing: '2px', color: '#ffffff'
              }}>Rodada {proximaRodada.numero}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', marginTop: '4px' }}>
                📅 {new Date(proximaRodada.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo'
                })}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px' }}>
                ⏰ 08:00 · Veronica Beach Tennis, Londrina
              </div>
            </div>

            {confirmado ? (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'rgba(45,122,69,0.15)', border: '1px solid rgba(45,122,69,0.4)',
                  borderRadius: '10px', padding: '14px 16px', marginBottom: '10px'
                }}>
                  <CheckCircle size={20} color="#2d7a45" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#2d7a45' }}>Presença confirmada!</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                      {totalConfirmados} confirmado{totalConfirmados !== 1 ? 's' : ''} de 24
                    </div>
                  </div>
                </div>
                <button onClick={cancelarPresenca} disabled={cancelando} style={{
                  width: '100%', background: 'transparent',
                  border: '1px solid rgba(192,57,43,0.5)', color: '#e74c3c',
                  borderRadius: '10px', padding: '10px 0',
                  fontWeight: 600, fontSize: '14px', cursor: 'pointer'
                }}>
                  {cancelando ? 'Cancelando...' : '✕ Cancelar confirmação'}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                  ⚠️ Confirme sua presença na aba Presença
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>
            Nenhuma rodada agendada no momento
          </div>
        )}
      </div>

      {/* Cards de stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <Trophy size={24} color="#f5c518" style={{ marginBottom: '8px' }} />
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', color: '#f5c518'
          }}>{rodadaAtual?.numero || 0}</div>
          <div style={{
            fontSize: '12px', color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1px', textTransform: 'uppercase'
          }}>Rodada atual</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Users size={24} color="#2d7a45" style={{ marginBottom: '8px' }} />
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', color: '#2d7a45'
          }}>{totalJogadores}</div>
          <div style={{
            fontSize: '12px', color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1px', textTransform: 'uppercase'
          }}>Jogadores ativos</div>
        </div>
      </div>

      {/* Progresso da liga */}
      <div className="card" style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{
              fontSize: '12px', color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px'
            }}>Liga</div>
            <div style={{ fontWeight: 700 }}>Torneio de Inverno 2026</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '12px', color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px'
            }}>Rodadas</div>
            <div style={{ fontWeight: 700 }}>{rodadaAtual?.numero || 0} / {TOTAL_RODADAS}</div>
          </div>
        </div>
        <div style={{
          marginTop: '12px', height: '4px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progresso}%`,
            background: 'linear-gradient(90deg, #f5c518, #2d7a45)',
            borderRadius: '2px', transition: 'width 0.5s ease'
          }} />
        </div>
      </div>
    </div>
  )
}
