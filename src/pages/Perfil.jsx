import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const ouro = '#c9a227'
const prata = '#8e9eab'

export default function Perfil() {
  const [perfil, setPerfil] = useState(null)
  const [stats, setStats] = useState(null)
  const [temporadas, setTemporadas] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [adversarios, setAdversarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadando, setUploadando] = useState(false)
  const [mensagem, setMensagem] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: jogadores } = await supabase
        .from('jogadores').select('*').eq('user_id', user.id).limit(1)
      const p = jogadores?.[0] || null
      setPerfil(p)

      if (p) {
        // Stats atuais (Inverno)
        const { data: s } = await supabase
          .from('stats_jogador').select('*').eq('jogador_id', p.id).limit(1)
        setStats(s?.[0] || null)

        // Histórico de temporadas anteriores
        const { data: temps } = await supabase
          .from('temporadas')
          .select('*')
          .eq('jogador_id', p.id)
          .order('ano', { ascending: false })
        setTemporadas(temps || [])

        // Busca jogos para calcular parceiros e adversários
        const { data: jogos } = await supabase
          .from('jogos')
          .select('*')
          .or(`dupla_a_1.eq.${p.nome},dupla_a_2.eq.${p.nome},dupla_b_1.eq.${p.nome},dupla_b_2.eq.${p.nome}`)

        if (jogos && jogos.length > 0) {
          const statsParc = {}
          const statsAdv = {}
          for (const jogo of jogos) {
            if (jogo.placar_a === null || jogo.placar_b === null) continue
            const estouNoA = jogo.dupla_a_1 === p.nome || jogo.dupla_a_2 === p.nome
            const euVenci = estouNoA ? jogo.placar_a > jogo.placar_b : jogo.placar_b > jogo.placar_a
            const parceiro = estouNoA
              ? (jogo.dupla_a_1 === p.nome ? jogo.dupla_a_2 : jogo.dupla_a_1)
              : (jogo.dupla_b_1 === p.nome ? jogo.dupla_b_2 : jogo.dupla_b_1)
            if (parceiro) {
              if (!statsParc[parceiro]) statsParc[parceiro] = { jogos: 0, vitorias: 0 }
              statsParc[parceiro].jogos++
              if (euVenci) statsParc[parceiro].vitorias++
            }
            const advs = estouNoA
              ? [jogo.dupla_b_1, jogo.dupla_b_2].filter(Boolean)
              : [jogo.dupla_a_1, jogo.dupla_a_2].filter(Boolean)
            for (const adv of advs) {
              if (!statsAdv[adv]) statsAdv[adv] = { jogos: 0, vitorias: 0 }
              statsAdv[adv].jogos++
              if (euVenci) statsAdv[adv].vitorias++
            }
          }
          setParceiros(Object.entries(statsParc)
            .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
            .sort((a, b) => b.jogos - a.jogos))
          setAdversarios(Object.entries(statsAdv)
            .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
            .sort((a, b) => b.jogos - a.jogos))
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !perfil) return
    setUploadando(true)
    const ext = file.name.split('.').pop()
    const path = `${perfil.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setMensagem({ texto: 'Erro ao enviar foto.', tipo: 'erro' })
      setUploadando(false)
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const foto_url = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('jogadores').update({ foto_url }).eq('id', perfil.id)
    setPerfil({ ...perfil, foto_url })
    setMensagem({ texto: 'Foto atualizada!', tipo: 'sucesso' })
    setUploadando(false)
    setTimeout(() => setMensagem(null), 3000)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  const statCards = [
    { label: 'Pontos', valor: stats?.pontos_total || 0, cor: '#f5c518' },
    { label: 'Vitorias', valor: stats?.vitorias || 0, cor: '#2d7a45' },
    { label: 'Rodadas', valor: stats?.rodadas_jogadas || 0, cor: '#4d8ab5' },
    { label: 'Posicao', valor: stats?.posicao ? (String(stats.posicao) + 'º') : '-', cor: '#e8621a' },
  ]

  return (
    <div>
      {mensagem && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#fff', background: mensagem.tipo === 'erro' ? '#c0392b' : '#27ae60' }}>
          {mensagem.texto}
        </div>
      )}

      {/* Card do jogador */}
      <div className="card" style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #112918, #0d2b1a)', border: '1px solid rgba(245,197,24,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => fileRef.current?.click()}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
              border: '2px solid rgba(245,197,24,0.3)', cursor: 'pointer',
              background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {perfil?.foto_url
                ? <img src={perfil.foto_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '28px', fontFamily: "'Bebas Neue', sans-serif" }}>{perfil?.nome?.charAt(0)?.toUpperCase() || '?'}</span>
              }
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              background: '#c9a227', borderRadius: '50%', width: '22px', height: '22px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer'
            }}>📷</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFoto} />
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '2px', lineHeight: 1, color: '#ffffff' }}>
              {perfil?.nome || 'Jogador'}
            </div>
            {perfil?.apelido && (
              <div style={{ fontSize: 13, color: '#7fb89a', marginTop: 3 }}>{perfil.apelido}</div>
            )}
            <div style={{ marginTop: '6px' }}>
              {perfil?.chave === 'ouro'
                ? <span className="badge-ouro">Chave Ouro</span>
                : <span className="badge-prata">Chave Prata</span>}
            </div>
            {uploadando && <div style={{ fontSize: 12, color: '#7fb89a', marginTop: 4 }}>Enviando foto...</div>}
            {!uploadando && <div style={{ fontSize: 11, color: '#5a8a6a', marginTop: 4, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>Toque para alterar foto</div>}
          </div>
        </div>
      </div>

      {/* Stats do Inverno */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        {statCards.map(({ label, valor, cor }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', color: cor, lineHeight: 1 }}>{valor}</div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Histórico de temporadas */}
      <div className="card">
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
          Historico de Temporadas
        </h3>

        {/* Torneio de Inverno 2026 — em andamento */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(201,162,39,0.06)', borderRadius: '8px', border: '1px solid rgba(201,162,39,0.2)', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: ouro }}>Torneio de Inverno 2026</div>
            <div style={{ fontSize: '12px', color: '#2ecc71', marginTop: '2px' }}>Em andamento</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', color: '#f5c518' }}>
              {stats?.pontos_total || '-'}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              {stats?.posicao ? `${stats.posicao}o lugar` : '-'}
            </div>
          </div>
        </div>

        {/* Temporadas anteriores do banco */}
        {temporadas.length > 0 ? (
          temporadas.map((t, i) => {
            const corChave = t.chave === 'ouro' ? ouro : prata
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--borda)', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    {t.nome_torneio.replace('Verao', 'Verão')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: corChave, textTransform: 'uppercase' }}>
                      {t.chave === 'ouro' ? 'Chave Ouro' : 'Chave Prata'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>·</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Concluido</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', color: corChave }}>
                    {t.pontos}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {t.posicao + 'o'} lugar
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px' }}>
            Nenhuma temporada anterior registrada
          </div>
        )}
      </div>
      {/* Parceiros */}
      {parceiros.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
            🤝 Histórico com Parceiros
          </h3>
          {parceiros.map((p, i) => (
            <div key={p.nome} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #2a5a3a' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e9' }}>{p.nome}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#2d7a45' }}>{p.vitorias}V</span>
                  <span style={{ color: '#c0392b' }}>{p.derrotas}D</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{p.jogos} jogos</span>
                  <span style={{ color: '#f5c518', fontWeight: 700 }}>{p.pct}%</span>
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${p.pct}%`, background: p.pct >= 50 ? '#2d7a45' : '#c0392b', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adversários */}
      {adversarios.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
            ⚔️ Histórico contra Adversários
          </h3>
          {adversarios.map((a, i) => (
            <div key={a.nome} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #2a5a3a' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f5e9' }}>{a.nome}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#2d7a45' }}>{a.vitorias}V</span>
                  <span style={{ color: '#c0392b' }}>{a.derrotas}D</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{a.jogos} jogos</span>
                  <span style={{ color: '#f5c518', fontWeight: 700 }}>{a.pct}%</span>
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${a.pct}%`, background: a.pct >= 50 ? '#2d7a45' : '#c0392b', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
