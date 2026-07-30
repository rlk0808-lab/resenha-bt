import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BADGE_INFO } from '../lib/badges'
import { acessivelClique } from '../lib/a11y'

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
  const [fotoArquivo, setFotoArquivo] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)
  const [curtidasAbertas, setCurtidasAbertas] = useState(null)
  const [comentariosAbertos, setComentariosAbertos] = useState(new Set())
  const [rascunhoComentario, setRascunhoComentario] = useState({})
  const [enviandoComentario, setEnviandoComentario] = useState(null)
  const textareaRef = useRef()
  const fotoInputRef = useRef()

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comentarios' }, () => carregarPosts())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function carregarPosts() {
    const { data } = await supabase
      .from('feed_posts')
      .select(`*, jogadores(nome, foto_url, chave), rodadas(numero), feed_reacoes(jogador_id, jogadores(nome)), feed_comentarios(id, texto, created_at, jogador_id, jogadores(nome, foto_url))`)
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data || [])
  }

  function selecionarFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoArquivo(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function cancelarFoto() {
    setFotoArquivo(null)
    setFotoPreview(null)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  async function publicarPost() {
    if ((!texto.trim() && !fotoArquivo) || !jogadorAtual) return
    setEnviando(true)
    const textoFinal = texto.trim()

    let foto_url = null
    if (fotoArquivo) {
      const ext = fotoArquivo.name.split('.').pop()
      const path = `feed/${jogadorAtual.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, fotoArquivo)
      if (uploadError) {
        alert('Erro ao enviar a foto: ' + uploadError.message)
        setEnviando(false)
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      foto_url = urlData.publicUrl
    }

    await supabase.from('feed_posts').insert({
      jogador_id: jogadorAtual.id,
      texto: textoFinal,
      foto_url,
    })
    // Notifica mencionados
    const mencoes = textoFinal.match(/@[\w.]+/g)
    if (mencoes && mencoes.length > 0) {
      const prefixos = mencoes.map(m => m.slice(1).trim())
      const { data: todosJogs } = await supabase.from('jogadores').select('id, nome')
      const jogs = (todosJogs || []).filter(j => prefixos.some(p => j.nome.startsWith(p) || j.nome === p))
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
    cancelarFoto()
    setEnviando(false)
  }

  async function curtir(postId) {
    if (!jogadorAtual) return
    const post = posts.find(p => p.id === postId)
    const jaCurti = post?.feed_reacoes?.some(r => r.jogador_id === jogadorAtual.id)
    if (jaCurti) {
      await supabase.from('feed_reacoes').delete().eq('post_id', postId).eq('jogador_id', jogadorAtual.id)
    } else {
      await supabase.from('feed_reacoes').insert({ post_id: postId, jogador_id: jogadorAtual.id, emoji: '❤️' })
    }
    await carregarPosts()
  }

  async function deletarPost(postId) {
    if (!confirm('Excluir este post?')) return
    await supabase.from('feed_posts').delete().eq('id', postId)
  }

  function toggleComentarios(postId) {
    setComentariosAbertos(prev => {
      const novo = new Set(prev)
      if (novo.has(postId)) novo.delete(postId)
      else novo.add(postId)
      return novo
    })
  }

  async function enviarComentario(postId) {
    const texto = (rascunhoComentario[postId] || '').trim()
    if (!texto || !jogadorAtual) return
    setEnviandoComentario(postId)
    const { error } = await supabase.from('feed_comentarios').insert({
      post_id: postId, jogador_id: jogadorAtual.id, texto,
    })
    if (!error) {
      setRascunhoComentario(prev => ({ ...prev, [postId]: '' }))
      await carregarPosts()
    }
    setEnviandoComentario(null)
  }

  async function deletarComentario(comentarioId) {
    await supabase.from('feed_comentarios').delete().eq('id', comentarioId)
    await carregarPosts()
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
                  <div key={j.id} {...acessivelClique(() => inserirMencao(j.nome))} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#c8e6c9', borderBottom: '1px solid #1e3d2a' }}>
                    @{j.nome}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {fotoPreview && (
          <div style={{ position: 'relative', marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
            <img src={fotoPreview} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
            <button onClick={cancelarFoto} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}

        <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={selecionarFoto} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <button onClick={() => fotoInputRef.current?.click()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            📷 Foto
          </button>
          <button onClick={publicarPost} disabled={enviando || (!texto.trim() && !fotoArquivo)} style={{ background: '#c9a227', color: '#0d2b1a', border: 'none', borderRadius: 20, padding: '8px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (!texto.trim() && !fotoArquivo) ? 0.5 : 1 }}>
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
        const isMeu = post.jogador_id === jogadorAtual?.id
        const chave = post.jogadores?.chave
        const curtidas = post.feed_reacoes || []
        const euCurti = curtidas.some(r => r.jogador_id === jogadorAtual?.id)
        const comentarios = [...(post.feed_comentarios || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        const comentariosAberto = comentariosAbertos.has(post.id)
        const curtidasAberto = curtidasAbertas === post.id

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

            {/* Foto */}
            {post.foto_url && (
              <img src={post.foto_url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 10, marginBottom: 12, display: 'block' }} />
            )}

            {/* Curtir + Comentar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => curtir(post.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: 14, color: euCurti ? '#e74c3c' : 'rgba(255,255,255,0.5)', fontWeight: euCurti ? 700 : 400
              }}>
                {euCurti ? '❤️' : '🤍'} Curtir
              </button>
              {curtidas.length > 0 && (
                <div {...acessivelClique(() => setCurtidasAbertas(curtidasAberto ? null : post.id))} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                  {curtidas.length} curtida{curtidas.length !== 1 ? 's' : ''}
                </div>
              )}
              <div {...acessivelClique(() => toggleComentarios(post.id))} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                💬 {comentarios.length > 0 ? `${comentarios.length} coment.` : 'Comentar'}
              </div>
            </div>

            {curtidasAberto && curtidas.length > 0 && (
              <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#c8e6c9' }}>
                Curtido por {curtidas.map(c => c.jogadores?.nome).filter(Boolean).join(', ')}
              </div>
            )}

            {comentariosAberto && (
              <div style={{ marginTop: 10 }}>
                {comentarios.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 11 }}>
                      {c.jogadores?.foto_url
                        ? <img src={c.jogadores.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : c.jogadores?.nome?.charAt(0) || '?'}
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a227' }}>{c.jogadores?.nome}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{tempoRelativo(c.created_at)}</span>
                        {c.jogador_id === jogadorAtual?.id && (
                          <button onClick={() => deletarComentario(c.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: '#e8f5e9', marginTop: 2 }}>{renderTexto(c.texto)}</div>
                    </div>
                  </div>
                ))}
                {jogadorAtual && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      value={rascunhoComentario[post.id] || ''}
                      onChange={e => setRascunhoComentario(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && enviarComentario(post.id)}
                      placeholder="Escreva um comentário..."
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '8px 14px', color: '#e8f5e9', fontSize: 13 }}
                    />
                    <button onClick={() => enviarComentario(post.id)} disabled={enviandoComentario === post.id || !(rascunhoComentario[post.id] || '').trim()} style={{ background: '#c9a227', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#0d2b1a', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                      {enviandoComentario === post.id ? '...' : '➤'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
