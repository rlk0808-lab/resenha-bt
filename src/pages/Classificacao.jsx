import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Evolucao from './Evolucao'

export default function Classificacao() {
  const [aba, setAba] = useState('geral')
  const [modoDescarte, setModoDescarte] = useState(false)
  const [verEvolucao, setVerEvolucao] = useState(false)
  const [jogadorAtualId, setJogadorAtualId] = useState(null)
  const [jogadores, setJogadores] = useState([])
  const [jogadoresDescarte, setJogadoresDescarte] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ data: sem }, { data: com }] = await Promise.all([
        supabase.from('classificacao').select('*').order('posicao', { ascending: true }),
        supabase.from('classificacao_com_descarte').select('*').order('posicao', { ascending: true }),
      ])
      setJogadores(sem || [])
      setJogadoresDescarte(com || [])
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

  const dados = modoDescarte ? jogadoresDescarte : jogadores
  const ouro = dados.filter(j => j.chave === 'ouro')
  const prata = dados.filter(j => j.chave === 'prata')
  const lista = aba === 'geral' ? dados : aba === 'ouro' ? ouro : prata

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
        <h1 className="section-title" style={{ margin: 0 }}>🏆 Classificação</h1>
        <button onClick={() => setVerEvolucao(true)} style={{ background: 'rgba(201,162,39,0.1)', border: '1px solid rgba(201,162,39,0.3)', borderRadius: 8, padding: '6px 12px', color: '#c9a227', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          📈 Evolução
        </button>
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

      {/* Tabs Geral / Ouro / Prata */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
        {[
          { key: 'geral', label: 'Geral' },
          { key: 'ouro', label: '🥇 Ouro' },
          { key: 'prata', label: '🥈 Prata' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setAba(key)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
            background: aba === key ? 'linear-gradient(135deg, #f5c518, #c9a010)' : 'transparent',
            color: aba === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
            letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s'
          }}>{label}</button>
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
              <tr key={j.id} onClick={() => navigate(`/jogador/${j.id}`)} style={{ cursor: 'pointer' }}>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', color: corPos(j.posicao) }}>
                    {j.posicao}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      border: `1px solid ${j.chave === 'ouro' ? 'rgba(255,215,0,0.3)' : 'rgba(192,192,192,0.3)'}`,
                      background: 'linear-gradient(135deg, #1a4d2e, #0d2b1a)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {j.foto_url
                        ? <img src={j.foto_url} alt={j.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '14px', fontWeight: 700 }}>{j.nome?.charAt(0)?.toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{j.nome}</div>
                      <div style={{ marginTop: '2px' }}>
                        {j.chave === 'ouro'
                          ? <span className="badge-ouro">Ouro</span>
                          : <span className="badge-prata">Prata</span>}
                      </div>
                    </div>
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
    </div>
    {verEvolucao && <Evolucao onFechar={() => setVerEvolucao(false)} jogadorAtualId={jogadorAtualId} />}
  )
}