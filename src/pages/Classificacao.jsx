import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Evolucao from './Evolucao'
import DetalhadoRodadas from './DetalhadoRodadas'
import CalendarioTemporada from './CalendarioTemporada'
import { acessivelClique } from '../lib/a11y'
import { buscarClassificacaoTemporadaAtual } from '../lib/temporada'

export default function Classificacao() {
  const [modoDescarte, setModoDescarte] = useState(false)
  const [periodo, setPeriodo] = useState('atual') // 'atual' | 'total'
  const [verEvolucao, setVerEvolucao] = useState(false)
  const [verDetalhado, setVerDetalhado] = useState(false)
  const [verCalendario, setVerCalendario] = useState(false)
  const [jogadorAtualId, setJogadorAtualId] = useState(null)
  const [ligaAtual, setLigaAtual] = useState(null)
  const [totalSemDescarte, setTotalSemDescarte] = useState([])
  const [totalComDescarte, setTotalComDescarte] = useState([])
  const [atualSemDescarte, setAtualSemDescarte] = useState([])
  const [atualComDescarte, setAtualComDescarte] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ data: sem }, { data: com }, atualSem, atualCom] = await Promise.all([
        supabase.from('classificacao').select('*').order('posicao', { ascending: true }),
        supabase.from('classificacao_com_descarte').select('*').order('posicao', { ascending: true }),
        buscarClassificacaoTemporadaAtual({ comDescarte: false }),
        buscarClassificacaoTemporadaAtual({ comDescarte: true }),
      ])
      setTotalSemDescarte(sem || [])
      setTotalComDescarte(com || [])
      setLigaAtual(atualSem.liga)
      setAtualSemDescarte(atualSem.lista)
      setAtualComDescarte(atualCom.lista)
      // Busca jogador atual para pré-selecionar no gráfico
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: jog } = await supabase.from('jogadores').select('id').eq('user_id', user.id).limit(1)
        if (jog?.[0]) setJogadorAtualId(jog[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  const lista = periodo === 'atual'
    ? (modoDescarte ? atualComDescarte : atualSemDescarte)
    : (modoDescarte ? totalComDescarte : totalSemDescarte)

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <div {...acessivelClique(() => navigate('/stats'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: 10, marginBottom: 12, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c9a227' }}>Ver Estatísticas</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>›</span>
      </div>
        <h1 className="section-title" style={{ margin: 0 }}>🏆 Classificação</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => setVerCalendario(true)} style={{ background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.3)', borderRadius: 8, padding: '6px 10px', color: '#c9a227', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            📅 Agenda
          </button>
          <button onClick={() => setVerDetalhado(true)} style={{ background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.3)', borderRadius: 8, padding: '6px 10px', color: '#c9a227', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            📋 Detalhado
          </button>
          <button onClick={() => setVerEvolucao(true)} style={{ background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.3)', borderRadius: 8, padding: '6px 10px', color: '#c9a227', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            📈 Evolução
          </button>
        </div>
      </div>

      {/* Tabs Temporada Atual / Histórico Total */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
        {[
          { key: 'atual', label: ligaAtual ? `📅 ${ligaAtual}` : '📅 Temporada Atual' },
          { key: 'total', label: '🏆 Histórico Total' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setPeriodo(key)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
            background: periodo === key ? 'linear-gradient(135deg, #f5c518, #c9a010)' : 'transparent',
            color: periodo === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s'
          }}>{label}</button>
        ))}
      </div>

      {/* Toggle Descarte */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f5e9' }}>
            {modoDescarte ? '✂️ Com descarte' : '📊 Sem descarte'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {modoDescarte ? '2 piores resultados descartados' : 'Todos os pontos somados'}
          </div>
        </div>
        <div
          onClick={() => setModoDescarte(!modoDescarte)}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
            background: modoDescarte ? '#c9a227' : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 2,
            left: modoDescarte ? 22 : 2,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
          }} />
        </div>
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
              <tr key={j.id} {...acessivelClique(() => navigate(`/jogador/${j.id}`))} style={{ cursor: 'pointer' }}>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', color: corPos(j.posicao) }}>
                    {j.posicao}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'linear-gradient(135deg, #1a4d2e, #0d2b1a)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {j.foto_url
                        ? <img src={j.foto_url} alt={j.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '14px', fontWeight: 700 }}>{j.nome?.charAt(0)?.toUpperCase()}</span>
                      }
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{j.nome}</div>
                  </div>
                </td>
                <td style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  {j.vitorias || 0}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', color: j.posicao <= 3 ? corPos(j.posicao) : '#f5c518' }}>
                    {j.pontos || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
            Nenhum dado disponível ainda
          </div>
        )}
      </div>
      {verEvolucao && <Evolucao onFechar={() => setVerEvolucao(false)} jogadorAtualId={jogadorAtualId} />}
      {verDetalhado && <DetalhadoRodadas onFechar={() => setVerDetalhado(false)} />}
      {verCalendario && <CalendarioTemporada onFechar={() => setVerCalendario(false)} />}
    </div>
  )
}