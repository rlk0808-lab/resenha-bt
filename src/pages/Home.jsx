import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Regulamento from './Regulamento'
import { Calendar, Trophy, Users, CheckCircle } from 'lucide-react'

export default function Home() {
  const [proximaRodada, setProximaRodada] = useState(null)
  const [rodadaAtual, setRodadaAtual] = useState(null)
  const TOTAL_RODADAS = 12
  const [confirmado, setConfirmado] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [confirmacaoId, setConfirmacaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [verRegulamento, setVerRegulamento] = useState(false)
  const [totalConfirmados, setTotalConfirmados] = useState(0)
  const [totalJogadores, setTotalJogadores] = useState(0)
  const [ultimaRodada, setUltimaRodada] = useState(null)
  const [feedJogos, setFeedJogos] = useState([])
  const [feedRanking, setFeedRanking] = useState({ ouro: [], prata: [] })

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

      // Busca última rodada finalizada e seus resultados
      const { data: rodsFin } = await supabase.from('rodadas').select('*')
        .eq('status', 'finalizada').order('numero', { ascending: false }).limit(1)
      const ultima = rodsFin?.[0]
      if (ultima) {
        setUltimaRodada(ultima)

        const { data: rank } = await supabase.from('ranking_rodada')
          .select('*, jogadores(nome, foto_url)')
          .eq('rodada_id', ultima.id)
          .order('posicao', { ascending: true })
        if (rank) {
          setFeedRanking({
            ouro: rank.filter(r => r.chave === 'ouro' || r.chave === 'time_b').slice(0, 3),
            prata: rank.filter(r => r.chave === 'prata' || r.chave === 'time_a').slice(0, 3),
          })
        }

        // Busca badges da última rodada
        const { data: bads } = await supabase.from('badges')
          .select('tipo, jogadores(nome)')
          .eq('rodada_id', ultima.id)
        setFeedJogos(bads || []) // reaproveitando estado para badges
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
      {/* Feed de Resultados */}
      {ultimaRodada && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1 }}>
                🏆 Últimos Resultados
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                Rodada {ultimaRodada.numero} · {new Date(ultimaRodada.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })}
              </div>
            </div>
          </div>

          {/* Pódio Ouro e Prata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: ultimaRodada.tipo === 'especial' ? '🔵 Time B' : '🥇 Ouro', lista: feedRanking.ouro, cor: ultimaRodada.tipo === 'especial' ? '#3498db' : '#c9a227' },
              { label: ultimaRodada.tipo === 'especial' ? '🔴 Time A' : '🥈 Prata', lista: feedRanking.prata, cor: ultimaRodada.tipo === 'especial' ? '#e74c3c' : '#8e9eab' },
            ].map(({ label, lista, cor }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid ' + cor + '33' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
                {lista.map((r, i) => (
                  <div key={r.jogadores?.nome} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: i === 0 ? cor : 'rgba(255,255,255,0.3)', fontWeight: 700, width: 16 }}>{i + 1}º</span>
                    <span style={{ fontSize: 12, color: i === 0 ? '#e8f5e9' : 'rgba(255,255,255,0.5)', fontWeight: i === 0 ? 700 : 400 }}>{r.jogadores?.nome}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: cor, fontWeight: 700 }}>{r.pontos_liga}pts</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Badges da rodada */}
          {feedJogos.length > 0 && (
            <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🏅 Conquistas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {feedJogos.map((b, i) => {
                  const info = {
                    campeao_ouro:  { emoji: '🥇', label: 'Campeão Ouro',  cor: '#c9a227' },
                    campeao_prata: { emoji: '🥈', label: 'Campeão Prata', cor: '#8e9eab' },
                    dia_perfeito:  { emoji: '💪', label: 'Dia Perfeito',  cor: '#2ecc71' },
                    hat_trick:     { emoji: '🔥', label: 'Hat-trick',     cor: '#e74c3c' },
                  }[b.tipo] || { emoji: '🏅', label: b.tipo, cor: '#7fb89a' }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: info.cor + '18', border: '1px solid ' + info.cor + '44', borderRadius: 16 }}>
                      <span style={{ fontSize: 12 }}>{info.emoji}</span>
                      <span style={{ fontSize: 11, color: info.cor, fontWeight: 700 }}>{b.jogadores?.nome}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Regulamento */}
      <div onClick={() => setVerRegulamento(true)} style={{
        background: 'linear-gradient(135deg, #112918, #0d2b1a)',
        border: '1px solid rgba(201,162,39,0.2)',
        borderRadius: 12, padding: '16px', marginTop: 16,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>📋</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#c9a227' }}>Regulamento</div>
            <div style={{ fontSize: 12, color: '#7fb89a', marginTop: 2 }}>Torneio de Inverno 2026</div>
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>›</span>
      </div>

      {verRegulamento && <Regulamento onFechar={() => setVerRegulamento(false)} />}
    </div>
  )
}
