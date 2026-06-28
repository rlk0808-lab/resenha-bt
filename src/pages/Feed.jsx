import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMOJIS = ['🔥', '👏', '😤', '💪', '🎾', '😂']

const BADGE_INFO = {
  campeao_ouro:  { emoji: '🥇', label: 'Campeão Ouro',  cor: '#c9a227' },
  campeao_prata: { emoji: '🥈', label: 'Campeão Prata', cor: '#8e9eab' },
  dia_perfeito:  { emoji: '💪', label: 'Dia Perfeito',  cor: '#2ecc71' },
  hat_trick:     { emoji: '🔥', label: 'Hat-trick',     cor: '#e74c3c' },
  artilheiro:    { emoji: '🎯', label: 'Artilheiro',    cor: '#f39c12' },
  relampago:     { emoji: '⚡', label: 'Relampago',     cor: '#f1c40f' },
  ascensao:      { emoji: '📈', label: 'Ascensao',      cor: '#1abc9c' },
  dia_negro:     { emoji: '💀', label: 'Dia Negro',     cor: '#636e72' },
  congelado:     { emoji: '🥶', label: 'Congelado',     cor: '#74b9ff' },
  pneu:          { emoji: '🍩', label: 'Pneu',          cor: '#fd79a8' },
  dormindo:      { emoji: '😴', label: 'Dormindo',      cor: '#b2bec3' },
  queda_livre:   { emoji: '📉', label: 'Queda Livre',   cor: '#d63031' },
}

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [jogadorAtual, setJogadorAtual] = useState(null)
  const [jogadores, setJogadores] = useState([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mencaoAtiva, setMencaoAtiva] = useState(false)
  const [filtroBusca, setFiltroBusca] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const textareaRef = useRef()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: jogs } = await supabase.from('jogadores').select('*').order('nome')
      setJogadores(jogs || [])
      const jog = jogs?.find(j => j.user_id === user?.id) || null
      setJogadorAtual(jog)
      await carregarPosts()
      setLoading(false)
    }
    load()

    // Realtime
    const channel = supabase.channel('feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, () => carregarPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_reacoes' }, () => carregarPosts())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregarPosts() {
    const { data } = await supabase
      .from('feed_posts')
      .select(`*, jogadores(nome, foto_url, chave), rodadas(numero), feed_reacoes(emoji, jogador_id)`)
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data || [])
  }

  async function publicarPost() {
    if (!texto.trim() || !jogadorAtual) return
    setEnviando(true)
    const textoFinal = texto.trim()
    await supabase.from('feed_posts').insert({
      jogador_id: jogadorAtual.id,
      texto: textoFinal,
    })
    // Notifica mencionados
    const mencoes = textoFinal.match(/@(\w+(?:\s\w+\.?)?)/g)
    if (mencoes && mencoes.length > 0) {
      const nomesMencionados = mencoes.map(m => m.slice(1).trim())
      const { data: jogs } = await supabase.from('jogadores').select('id').in('nome', nomesMencionados)
      if (jogs && jogs.length > 0) {
        const ids = jogs.map(j => j.id)
        const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').in('jogador_id', ids)
        if (subs && subs.length > 0) {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptions: subs,
              title: jogadorAtual.nome + ' te mencionou no Feed!',
              body: textoFinal,
              url: '/feed'
            })
          })
        }
      }
    }
    setTexto('')
    setEnviando(false)
  }

  async function reagir(postId, emoji) {
    if (!jogadorAtual) return
    const post = posts.find(p => p.id === postId)
    const jaReagiu = post?.feed_reacoes?.some(r => r.jogador_id === jogadorAtual.id && r.emoji === emoji)
    if (jaReagiu) {
      await supabase.from('feed_reacoes').delete()
        .eq('post_id', postId).eq('jogador_id', jogadorAtual.id).eq('emoji', emoji)
    } else {
      await supabase.from('feed_reacoes').insert({ post_id: postId, jogador_id: jogadorAtual.id, emoji })
    }
    await carregarPosts()
  }

  async function deletarPost(postId) {
    if (!confirm('Excluir este post?')) return
    await supabase.from('feed_posts').delete().eq('id', postId)
  }

  function handleTextoChange(e) {
    const val = e.target.value
    setTexto(val)
    const pos = e.target.selectionStart
    setCursorPos(pos)
    const antes = val.slice(0, pos)
    const match = antes.match(/@(\w*)$/)
    if (match) {
      setMencaoAtiva(true)
      setFiltroBusca(match[1])
    } else {
      setMencaoAtiva(false)
      setFiltroBusca('')
    }
  }

  function inserirMencao(nome) {
    const antes = texto.slice(0, cursorPos)
    const depois = texto.slice(cursorPos)
    const novoTexto = antes.replace(/@\w*$/, '@' + nome + ' ') + depois
    setTexto(novoTexto)
    setMencaoAtiva(false)
    textareaRef.current?.focus()
  }

  function renderTexto(txt) {
    if (!txt) return null
    const parts = txt.split(/(@\w+)/g)
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} style={{ color: '#c9a227', fontWeight: 700 }}>{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  function agruparReacoes(reacoes) {
    const grupos = {}
    for (const r of (reacoes || [])) {
      if (!grupos[r.emoji]) grupos[r.emoji] = []
      grupos[r.emoji].push(r.jogador_id)
    }
    return grupos
  }

  function tempoRelativo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000
    if (diff < 60) return 'agora'
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="spinner" />
    </div>
  )

  const jogadoresFiltrados = jogadores.filter(j =>
    j.nome.toLowerCase().includes(filtroBusca.toLowerCase()) && j.nome !== jogadorAtual?.nome
  ).slice(0, 5)

  return (
    <div>
      {/* Box de novo post */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #112918, #0d2b1a)', border: '1px solid rgba(201,162,39,0.15)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, overflow: 'hidden' }}>
            {jogadorAtual?.foto_url
              ? <img src={jogadorAtual.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : jogadorAtual?.nome?.charAt(0) || '?'}
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={handleTextoChange}
              placeholder="O que está rolando? Use @nome para mencionar..."
              rows={3}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#e8f5e9', fontSize: 14, resize: 'none', fontFamily: "'Barlow', sans-serif", boxSizing: 'border-box', outline: 'none' }}
            />
            {mencaoAtiva && jogadoresFiltrados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 8, zIndex: 100, overflow: 'hidden' }}>
                {jogadoresFiltrados.map(j => (
                  <div key={j.id} onClick={() => inserirMencao(j.nome)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#c8e6c9', borderBottom: '1px solid #1e3d2a' }}>
                    @{j.nome}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button onClick={publicarPost} disabled={enviando || !texto.trim()} style={{ background: '#c9a227', color: '#0d2b1a', border: 'none', borderRadius: 20, padding: '8px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: !texto.trim() ? 0.5 : 1 }}>
            {enviando ? '...' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎾</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Nenhum post ainda.</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 4 }}>Seja o primeiro a postar!</p>
        </div>
      ) : posts.map(post => {
        const reacoes = agruparReacoes(post.feed_reacoes)
        const isMeu = post.jogador_id === jogadorAtual?.id
        const chave = post.jogadores?.chave

        return (
          <div key={post.id} className="card" style={{ marginBottom: 12, padding: 14 }}>
            {/* Header do post */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, overflow: 'hidden', flexShrink: 0 }}>
                {post.jogadores?.foto_url
                  ? <img src={post.jogadores.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : post.jogadores?.nome?.charAt(0) || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f5e9' }}>{post.jogadores?.nome}</span>
                  {chave === 'ouro'
                    ? <span style={{ fontSize: 10, background: 'rgba(201,162,39,0.2)', color: '#c9a227', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>OURO</span>
                    : <span style={{ fontSize: 10, background: 'rgba(142,158,171,0.2)', color: '#8e9eab', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>PRATA</span>}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{tempoRelativo(post.created_at)}</div>
              </div>
              {isMeu && (
                <button onClick={() => deletarPost(post.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 16, padding: 4 }}>🗑️</button>
              )}
            </div>

            {/* Badge compartilhado */}
            {post.badge_tipo && BADGE_INFO[post.badge_tipo] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: BADGE_INFO[post.badge_tipo].cor + '18', border: '1px solid ' + BADGE_INFO[post.badge_tipo].cor + '44', borderRadius: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{BADGE_INFO[post.badge_tipo].emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BADGE_INFO[post.badge_tipo].cor }}>{BADGE_INFO[post.badge_tipo].label}</div>
                  {post.rodadas?.numero && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Rodada {post.rodadas.numero}</div>}
                </div>
              </div>
            )}

            {/* Texto */}
            {post.texto && (
              <p style={{ fontSize: 14, color: '#e8f5e9', lineHeight: 1.5, margin: '0 0 12px' }}>
                {renderTexto(post.texto)}
              </p>
            )}

            {/* Reações */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {EMOJIS.map(emoji => {
                const count = reacoes[emoji]?.length || 0
                const euReagi = reacoes[emoji]?.includes(jogadorAtual?.id)
                return (
                  <button key={emoji} onClick={() => reagir(post.id, emoji)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: euReagi ? 'rgba(201,162,39,0.2)' : 'rgba(255,255,255,0.05)',
                    border: euReagi ? '1px solid rgba(201,162,39,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontSize: 14
                  }}>
                    <span>{emoji}</span>
                    {count > 0 && <span style={{ fontSize: 12, color: euReagi ? '#c9a227' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
