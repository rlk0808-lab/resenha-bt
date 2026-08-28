import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { baixarIcs } from '../lib/calendario'
import { acessivelClique } from '../lib/a11y'
import { enviarPush } from '../lib/notificar'
import { nomeRodada } from '../lib/rodada'

const ouro = '#c9a227'
const prata = '#8e9eab'
const borda = '#2a5a3a'
const cardBg = '#162f20'

export default function Rodada() {
  const [view, setView] = useState('proxima')
  const [proximaRodada, setProximaRodada] = useState(null)
  const [proximaJogos, setProximaJogos] = useState([])
  const [rodadasFinalizadas, setRodadasFinalizadas] = useState([])
  const [rodadaDetalhe, setRodadaDetalhe] = useState(null)
  const [detalheJogos, setDetalheJogos] = useState([])
  const [detalheRanking, setDetalheRanking] = useState({ ouro: [], prata: [] })
  const navigate = useNavigate()
  const [chaveVis, setChaveVis] = useState('ouro')
  const [detalheView, setDetalheView] = useState('jogos')
  const [loading, setLoading] = useState(true)
  const [gerandoImagem, setGerandoImagem] = useState(false)
  const [aoVivo, setAoVivo] = useState(true)
  const [rankingVivo, setRankingVivo] = useState({ ouro: [], prata: [] })
  const [editandoPlacarId, setEditandoPlacarId] = useState(null)
  const [placarForm, setPlacarForm] = useState({ a: '', b: '', ta: '', tb: '' })
  const [salvandoPlacar, setSalvandoPlacar] = useState(false)
  const [mensagemPlacar, setMensagemPlacar] = useState(null)
  const [reacoes, setReacoes] = useState({})
  const [curtidasJogoAberto, setCurtidasJogoAberto] = useState(null)
  const [compartilhandoModo, setCompartilhandoModo] = useState('classificacao')
  const cardRef = useRef(null)
  const [comentarios, setComentarios] = useState([])
  const [novoComentario, setNovoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [jogadorAtual, setJogadorAtual] = useState(null)
  const [jogadoresList, setJogadoresList] = useState([])
  const [mencaoAtiva, setMencaoAtiva] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarDados() }, [])

  async function carregarReacoes(jogoIds) {
    if (!jogoIds || jogoIds.length === 0) return
    const { data } = await supabase
      .from('jogo_reacoes')
      .select('jogo_id, emoji, jogador_id, jogadores(nome)')
      .in('jogo_id', jogoIds)
    const mapa = {}
    for (const r of (data || [])) {
      if (!mapa[r.jogo_id]) mapa[r.jogo_id] = []
      mapa[r.jogo_id].push(r)
    }
    setReacoes(mapa)
  }

  async function reagirJogo(jogoId, emoji) {
    if (!jogadorAtual) return
    const lista = reacoes[jogoId] || []
    // Ignora qual emoji era antes (curtida antiga com outro emoji conta como já curtido)
    const jaReagiu = lista.some(r => r.jogador_id === jogadorAtual.id)
    if (jaReagiu) {
      await supabase.from('jogo_reacoes').delete()
        .eq('jogo_id', jogoId).eq('jogador_id', jogadorAtual.id)
    } else {
      await supabase.from('jogo_reacoes').insert({ jogo_id: jogoId, jogador_id: jogadorAtual.id, emoji })
    }
    const ids = [...Object.keys(reacoes), jogoId]
    await carregarReacoes([...new Set(ids)])
  }
  useEffect(() => {
    if (rodadaDetalhe) carregarComentarios(rodadaDetalhe.id)
  }, [rodadaDetalhe])

  useEffect(() => {
    if (!proximaRodada) return
    // Subscrição realtime para jogos da rodada ativa
    const channel = supabase
      .channel('jogos-ao-vivo')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'jogos',
        filter: `rodada_id=eq.${proximaRodada.id}`
      }, (payload) => {
        setProximaJogos(prev => {
          const idx = prev.findIndex(j => j.id === payload.new?.id)
          let novo = prev
          if (payload.eventType === 'UPDATE' && idx >= 0) {
            novo = [...prev]; novo[idx] = payload.new
          } else if (payload.eventType === 'INSERT') {
            novo = [...prev, payload.new]
          } else if (payload.eventType === 'DELETE') {
            novo = prev.filter(j => j.id !== payload.old?.id)
          }
          calcularRankingVivo(novo, proximaRodada.numero)
          return novo
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [proximaRodada])

  async function carregarDados() {
    setLoading(true)
    const { data: proximas } = await supabase
      .from('rodadas').select('*')
      .in('status', ['proxima', 'ativa'])
      .order('numero', { ascending: true }).limit(1)
    const proxima = proximas?.[0] || null
    setProximaRodada(proxima)

    if (proxima) {
      const { data: j } = await supabase.from('jogos').select('*')
        .eq('rodada_id', proxima.id)
        .order('chave', { ascending: true })
        .order('created_at', { ascending: true })
      setProximaJogos(j || [])
      calcularRankingVivo(j || [], proxima.numero)
    }

    // created_at, não numero — assim rodadas de ligas diferentes não se
    // misturam na ordenação quando o numero reinicia numa liga nova
    const { data: finalizadas } = await supabase.from('rodadas').select('*')
      .eq('status', 'finalizada').order('created_at', { ascending: false })
    setRodadasFinalizadas(finalizadas || [])
    setLoading(false)

    // Busca jogador atual e lista de jogadores para menções
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: jog } = await supabase.from('jogadores').select('id, nome').eq('user_id', user.id).limit(1)
      if (jog?.[0]) setJogadorAtual(jog[0])
    }
    const { data: jogs } = await supabase.from('jogadores').select('id, nome').order('nome')
    setJogadoresList(jogs || [])
  }

  async function abrirDetalhe(rodada) {
    setRodadaDetalhe(rodada)
    setDetalheView('jogos')
    setChaveVis('ouro')
    setView('detalhe')

    const { data: j } = await supabase.from('jogos').select('*')
      .eq('rodada_id', rodada.id)
      .order('chave', { ascending: true })
      .order('created_at', { ascending: true })
    setDetalheJogos(j || [])

    const { data: rank } = await supabase
      .from('ranking_rodada')
      .select('*, jogadores(nome, chave)')
      .eq('rodada_id', rodada.id)
      .order('posicao', { ascending: true })

    if (rank) {
      // Suporta rodada especial (time_a/time_b/especial) e normal (ouro/prata)
      const isEspecial = rank.some(r => ['time_a','time_b','especial'].includes(r.chave))
      const rankOuro = isEspecial
        ? rank.filter(r => r.chave === 'time_b') // vencedor aparece primeiro
        : rank.filter(r => r.chave === 'ouro')
      const rankPrata = isEspecial
        ? rank.filter(r => r.chave === 'time_a')
        : rank.filter(r => r.chave === 'prata')

      const { data: rodadaAnt } = await supabase.from('rodadas').select('*')
        .eq('status', 'finalizada')
        .eq('liga', rodada.liga)
        .lt('numero', rodada.numero)
        .order('numero', { ascending: false }).limit(1)

      let desceram = []
      let subiram = []
      if (rodadaAnt?.[0]) {
        const { data: rankAnt } = await supabase
          .from('ranking_rodada')
          .select('*, jogadores(nome)')
          .eq('rodada_id', rodadaAnt[0].id)
          .order('posicao', { ascending: true })
        if (rankAnt) {
          const rankAntOuro = rankAnt.filter(r => r.chave === 'ouro')
          const rankAntPrata = rankAnt.filter(r => r.chave === 'prata')
          desceram = rankAntOuro.slice(-3).map(r => r.jogadores?.nome)
          subiram = rankAntPrata.slice(0, 3).map(r => r.jogadores?.nome)
        }
      }

      const ptsDia = {}
      const vitoriasDia = {}
      const jogosCompletos = (j || []).filter(x => x.placar_a !== null && x.placar_b !== null)

      for (const jogo of jogosCompletos) {
        const { dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, placar_a, placar_b } = jogo
        const jogA = [dupla_a_1, dupla_a_2].filter(Boolean)
        const jogB = [dupla_b_1, dupla_b_2].filter(Boolean)
        const todos = [...jogA, ...jogB]
        todos.forEach(n => { if (!ptsDia[n]) { ptsDia[n] = 0; vitoriasDia[n] = 0 } })
        const saldo = Math.abs(placar_a - placar_b)
        const venceuA = placar_a > placar_b
        const venc = venceuA ? jogA : jogB
        const perd = venceuA ? jogB : jogA
        venc.forEach(n => { ptsDia[n] += 15 + saldo; vitoriasDia[n] += 1 })
        perd.forEach(n => { ptsDia[n] += venceuA ? placar_b : placar_a })
      }

      setDetalheRanking({
        ouro: rankOuro.map(r => ({
          nome: r.jogadores?.nome,
          pontos: r.pontos_liga,
          pontosDia: ptsDia[r.jogadores?.nome] || 0,
          vitorias: vitoriasDia[r.jogadores?.nome] || 0,
          posicao: r.posicao,
          movimento: desceram.includes(r.jogadores?.nome) ? 'desceu' : null,
        })),
        prata: rankPrata.map(r => ({
          nome: r.jogadores?.nome,
          pontos: r.pontos_liga,
          pontosDia: ptsDia[r.jogadores?.nome] || 0,
          vitorias: vitoriasDia[r.jogadores?.nome] || 0,
          posicao: r.posicao,
          movimento: subiram.includes(r.jogadores?.nome) ? 'subiu' : null,
        })),
      })
    }
  }

  function calcularRankingVivo(jogos, rodadaNumero) {
    const PONTOS_OURO = [25,22,20,18,16,14,12,10,8,8,8,8]
    // Rodadas especiais (4/8/12): tabela única de colocação pra Ouro e
    // Prata, tudo dobrado (posição e bônus de vitória) — mesma regra usada
    // em Admin.jsx (calcularRankingLocal/RODADAS_ESPECIAIS). Recebe o número
    // da rodada por parâmetro (em vez de ler `proximaRodada` via closure)
    // pra não criar uma dependência reativa implícita nos efeitos que chamam
    // essa função.
    const especial = [4, 8, 12].includes(rodadaNumero)
    const calcChave = (jogosChave, chave) => {
      const stats = {}
      for (const j of jogosChave) {
        if (j.placar_a === null || j.placar_b === null) continue
        const {dupla_a_1,dupla_a_2,dupla_b_1,dupla_b_2,placar_a,placar_b} = j
        for (const n of [dupla_a_1,dupla_a_2,dupla_b_1,dupla_b_2].filter(Boolean))
          if (!stats[n]) stats[n] = {nome:n, pts:0, vitorias:0, saldo:0}
        const venceuA = placar_a > placar_b
        const saldo = Math.abs(placar_a - placar_b)
        const venc = venceuA ? [dupla_a_1,dupla_a_2] : [dupla_b_1,dupla_b_2]
        const perd = venceuA ? [dupla_b_1,dupla_b_2] : [dupla_a_1,dupla_a_2]
        venc.filter(Boolean).forEach(n => { stats[n].pts += 15+saldo; stats[n].vitorias += 1; stats[n].saldo += saldo })
        perd.filter(Boolean).forEach(n => { stats[n].pts += venceuA ? placar_b : placar_a; stats[n].saldo -= saldo })
      }
      return Object.values(stats)
        .sort((a,b) => b.pts !== a.pts ? b.pts-a.pts : b.saldo-a.saldo)
        .map((j,idx) => {
          const posPts = especial ? (PONTOS_OURO[idx] || 8) : (chave === 'ouro' ? (PONTOS_OURO[idx] || 8) : 8)
          const bonusCampeaoPrata = (!especial && chave === 'prata' && idx === 0) ? 3 : 0
          const dobra = especial ? 2 : 1
          return {
            ...j,
            pontosDia: j.pts,
            pontos: (posPts + j.vitorias * 3 + bonusCampeaoPrata) * dobra
          }
        })
    }
    const ouro = calcChave(jogos.filter(j => j.chave === 'ouro'), 'ouro')
    const prata = calcChave(jogos.filter(j => j.chave === 'prata'), 'prata')
    setRankingVivo({ ouro, prata })
  }

  // ─── LANÇAMENTO DE PLACAR PELO PRÓPRIO JOGADOR ───────────────────────────
  function souDoJogo(jogo) {
    if (!jogadorAtual) return false
    return [jogo.dupla_a_1, jogo.dupla_a_2, jogo.dupla_b_1, jogo.dupla_b_2].includes(jogadorAtual.nome)
  }

  function abrirEdicaoPlacar(jogo) {
    setMensagemPlacar(null)
    setEditandoPlacarId(jogo.id)
    setPlacarForm({
      a: jogo.placar_a ?? '', b: jogo.placar_b ?? '',
      ta: jogo.tie_a ?? '', tb: jogo.tie_b ?? '',
    })
  }

  function cancelarEdicaoPlacar() {
    setEditandoPlacarId(null)
    setMensagemPlacar(null)
  }

  async function salvarPlacarJogador(jogoId, jogo) {
    const pa = parseInt(placarForm.a)
    const pb = parseInt(placarForm.b)
    if (isNaN(pa) || isNaN(pb)) { setMensagemPlacar('Preencha os dois placares.'); return }
    // Já tinha um placar diferente lançado (por qualquer um dos 4 da
    // partida) — evita sobrescrever silenciosamente um valor que outra
    // pessoa já colocou, sem quem está corrigindo perceber.
    const jaTinhaPlacar = jogo.placar_a !== null && jogo.placar_b !== null
    const mudouValor = jaTinhaPlacar && (jogo.placar_a !== pa || jogo.placar_b !== pb)
    if (mudouValor && !confirm(`Esse jogo já está com o placar ${jogo.placar_a} × ${jogo.placar_b}. Confirma trocar para ${pa} × ${pb}?`)) {
      return
    }
    setSalvandoPlacar(true)
    setMensagemPlacar(null)
    const updateData = { placar_a: pa, placar_b: pb }
    const ta = parseInt(placarForm.ta)
    const tb = parseInt(placarForm.tb)
    if (!isNaN(ta) && !isNaN(tb)) { updateData.tie_a = ta; updateData.tie_b = tb }
    const { error } = await supabase.from('jogos').update(updateData).eq('id', jogoId)
    if (error) {
      setMensagemPlacar('Não foi possível salvar. Peça para o admin lançar esse placar.')
    } else {
      setProximaJogos(prev => {
        const novo = prev.map(j => j.id === jogoId ? { ...j, ...updateData } : j)
        calcularRankingVivo(novo, proximaRodada?.numero)
        return novo
      })
      setEditandoPlacarId(null)
    }
    setSalvandoPlacar(false)
  }

  function renderJogo(jogo, i, permitirLancar) {
    const curtidas = reacoes[jogo.id] || []
    const euCurtiJogo = curtidas.some(r => r.jogador_id === jogadorAtual?.id)
    const curtidasJogoAbertoAqui = curtidasJogoAberto === jogo.id
    const temPlacar = jogo.placar_a !== null && jogo.placar_b !== null
    const meuJogo = permitirLancar && souDoJogo(jogo)
    const editando = editandoPlacarId === jogo.id
    const precisaTiebreak = (placarForm.a === '6' && placarForm.b === '5') || (placarForm.a === '5' && placarForm.b === '6')
    return (
      <div key={jogo.id} style={{
        padding: '10px 8px', marginTop: i > 0 ? 0 : undefined,
        borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
        background: meuJogo ? 'rgba(201,162,39,0.06)' : 'transparent',
        borderLeft: meuJogo ? '2px solid rgba(201,162,39,0.5)' : '2px solid transparent',
        borderRadius: meuJogo ? 8 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_a_1}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{jogo.dupla_a_2}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '80px', justifyContent: 'center' }}>
            {[
              { placar: jogo.placar_a, venceu: jogo.placar_a > jogo.placar_b },
              { placar: jogo.placar_b, venceu: jogo.placar_b > jogo.placar_a }
            ].map((lado, li) => (
              <span key={li} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {li === 1 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>X</span>}
                <div style={{
                  background: lado.venceu ? 'rgba(245,197,24,0.15)' : 'rgba(255,255,255,0.05)',
                  border: "1px solid " + (lado.venceu ? 'rgba(245,197,24,0.3)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: '6px', padding: '4px 10px',
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px',
                  color: lado.venceu ? '#f5c518' : 'rgba(255,255,255,0.5)',
                  minWidth: '32px', textAlign: 'center'
                }}>{lado.placar ?? '-'}</div>
              </span>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{jogo.dupla_b_1}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{jogo.dupla_b_2}</div>
          </div>
        </div>

        {meuJogo && !editando && (
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <button onClick={() => abrirEdicaoPlacar(jogo)} style={{
              background: 'transparent', border: '1px solid rgba(201,162,39,0.4)', color: '#c9a227',
              borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700
            }}>
              {temPlacar ? '✏️ Corrigir placar' : '📝 Lançar placar'}
            </button>
          </div>
        )}

        {editando && (
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.3)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <input type="number" min="0" max="7" value={placarForm.a}
                onChange={e => setPlacarForm({ ...placarForm, a: e.target.value })}
                placeholder="0"
                style={{ width: 48, textAlign: 'center', background: '#0f2d1e', border: '1px solid #2a5a3a', borderRadius: 8, padding: '6px 0', color: '#e8f5e9', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif" }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>×</span>
              <input type="number" min="0" max="7" value={placarForm.b}
                onChange={e => setPlacarForm({ ...placarForm, b: e.target.value })}
                placeholder="0"
                style={{ width: 48, textAlign: 'center', background: '#0f2d1e', border: '1px solid #2a5a3a', borderRadius: 8, padding: '6px 0', color: '#e8f5e9', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif" }} />
            </div>
            {precisaTiebreak && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>tie-break</span>
                <input type="number" min="0" max="15" value={placarForm.ta}
                  onChange={e => setPlacarForm({ ...placarForm, ta: e.target.value })}
                  placeholder="0"
                  style={{ width: 36, textAlign: 'center', background: '#0f2d1e', border: '1px solid #2a5a3a', borderRadius: 6, padding: '4px 0', color: '#c9a227', fontSize: 13 }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>×</span>
                <input type="number" min="0" max="15" value={placarForm.tb}
                  onChange={e => setPlacarForm({ ...placarForm, tb: e.target.value })}
                  placeholder="0"
                  style={{ width: 36, textAlign: 'center', background: '#0f2d1e', border: '1px solid #2a5a3a', borderRadius: 6, padding: '4px 0', color: '#c9a227', fontSize: 13 }} />
              </div>
            )}
            {mensagemPlacar && (
              <div style={{ fontSize: 12, color: '#e74c3c', textAlign: 'center', marginTop: 8 }}>{mensagemPlacar}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={cancelarEdicaoPlacar} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={() => salvarPlacarJogador(jogo.id, jogo)} disabled={salvandoPlacar} style={{ flex: 1, background: '#c9a227', border: 'none', color: '#0d2b1a', fontWeight: 700, borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>
                {salvandoPlacar ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {temPlacar && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => reagirJogo(jogo.id, '❤️')} style={{
                display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: 13, color: euCurtiJogo ? '#e74c3c' : 'rgba(255,255,255,0.5)', fontWeight: euCurtiJogo ? 700 : 400
              }}>
                {euCurtiJogo ? '❤️' : '🤍'} Curtir
              </button>
              {curtidas.length > 0 && (
                <div {...acessivelClique(() => setCurtidasJogoAberto(curtidasJogoAbertoAqui ? null : jogo.id))} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                  {curtidas.length} curtida{curtidas.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            {curtidasJogoAbertoAqui && curtidas.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#c8e6c9' }}>
                Curtido por {curtidas.map(c => c.jogadores?.nome).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderJogos(jogos, chave, permitirLancar) {
    const isQualify = jogos.some(j => j.chave === 'qualify')
    if (isQualify) {
      // Qualify: chave única, mas ainda com 4 sub-rodadas — agrupa igual ao normal
      if (jogos.length === 0) return (
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo cadastrado</p>
        </div>
      )
      const gruposMap = {}
      jogos.forEach(j => { const r = j.rodada_interna || 1; if (!gruposMap[r]) gruposMap[r] = []; gruposMap[r].push(j) })
      const subRodadas = Object.keys(gruposMap).map(Number).sort((a, b) => a - b).map(k => gruposMap[k])
      return subRodadas.map((grupo, idx) => (
        <div key={idx} className="card" style={{ marginBottom: '12px', borderLeft: '3px solid #c9a227', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
            🎲 Qualify — Rodada {idx + 1}
          </div>
          {grupo.map((jogo, i) => renderJogo(jogo, i, permitirLancar))}
        </div>
      ))
    }

    const chavesEspecial = ["time_a", "time_b", "especial"]
    const isEspecial = jogos.some(j => chavesEspecial.includes(j.chave))

    if (isEspecial) {
      // Rodada especial: mostra todos os jogos num único card sem agrupamento
      if (jogos.length === 0) return (
        <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo cadastrado</p>
        </div>
      )
      return (
        <div className="card" style={{ marginBottom: '12px', borderLeft: '3px solid #c9a227', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
            🔴 Time A  ×  🔵 Time B — {jogos.length} jogos
          </div>
          {jogos.map((jogo, i) => renderJogo(jogo, i, permitirLancar))}
        </div>
      )
    }

    // Rodada normal: agrupa por rodada_interna
    const filtrados = jogos.filter(j => j.chave === chave)
    const gruposMap = {}
    filtrados.forEach(j => {
      const r = j.rodada_interna || 1
      if (!gruposMap[r]) gruposMap[r] = []
      gruposMap[r].push(j)
    })
    const subRodadas = Object.keys(gruposMap).map(Number).sort((a,b) => a-b).map(k => gruposMap[k])
    const corChave = chave === 'ouro' ? ouro : prata

    if (filtrados.length === 0) return (
      <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo cadastrado para esta chave</p>
      </div>
    )

    return subRodadas.map((grupo, idx) => (
      <div key={idx} className="card" style={{ marginBottom: '12px', borderLeft: "3px solid " + corChave, padding: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
          Rodada {idx + 1}
        </div>
        {grupo.map((jogo, i) => renderJogo(jogo, i, permitirLancar))}
      </div>
    ))
  }

  function renderClassificacao(ranking, chave, isEspecial) {
    const cor = isEspecial
      ? (chave === 'ouro' ? '#3498db' : '#e74c3c')  // ouro=Time B vencedor, prata=Time A
      : (chave === 'ouro' ? ouro : prata)
    const label = isEspecial
      ? (chave === 'ouro' ? '🔵 Time B (Vencedor)' : '🔴 Time A')
      : (chave === 'ouro' ? '🥇 Chave Ouro' : '🥈 Chave Prata')

    if (!ranking || ranking.length === 0) return (
      <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Classificacao nao disponivel</p>
      </div>
    )
    return (
      <div className="card" style={{ padding: '16px', borderLeft: "3px solid " + cor }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: cor, textTransform: 'uppercase', letterSpacing: 1 }}>
            {label}
          </span>
        </div>
        {ranking.map((j, idx) => {
          const desceu = j.movimento === 'desceu'
          const subiu = j.movimento === 'subiu'
          return (
            <div key={j.nome} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: idx < ranking.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderLeft: desceu ? '3px solid #e74c3c' : subiu ? '3px solid #2ecc71' : '3px solid transparent',
              paddingLeft: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: idx === 0 ? 'rgba(201,162,39,0.2)' : idx === 1 ? 'rgba(142,158,171,0.2)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: idx === 0 ? ouro : idx === 1 ? prata : 'rgba(255,255,255,0.4)',
                flexShrink: 0,
              }}>{idx + 1}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: idx < 3 ? 700 : 400, color: '#e8f5e9' }}>{j.nome}</div>
              {desceu && <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>↓ desceu</div>}
              {subiu && <div style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700 }}>↑ subiu</div>}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>
                  {j.vitorias}V · {j.pontosDia} pts dia
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: cor }}>{j.pontos} pts liga</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  async function carregarComentarios(rodadaId) {
    const { data } = await supabase
      .from('comentarios')
      .select('*, jogadores(nome, foto_url)')
      .eq('rodada_id', rodadaId)
      .order('created_at', { ascending: true })
    setComentarios(data || [])
  }

  async function enviarComentario() {
    if (!novoComentario.trim() || !jogadorAtual || !rodadaDetalhe) return
    setEnviandoComentario(true)
    const texto = novoComentario.trim()
    const { error } = await supabase.from('comentarios').insert({
      rodada_id: rodadaDetalhe.id,
      jogador_id: jogadorAtual.id,
      texto
    })
    if (!error) {
      setNovoComentario('')
      await carregarComentarios(rodadaDetalhe.id)
      // Notifica jogadores mencionados — casa pelo nome de cada jogador
      // direto no texto (nomes mais longos primeiro, com checagem de
      // fronteira), em vez do regex \w antigo, que era ASCII-only e
      // cortava em qualquer acento (ex: "@José" virava "Jos", ninguém
      // encontrado). Mesma técnica de Feed.jsx.
      const { data: todosJogs } = await supabase.from('jogadores').select('id, nome')
      const candidatos = [...(todosJogs || [])].sort((a, b) => (b.nome?.length || 0) - (a.nome?.length || 0))
      const posicoesUsadas = []
      const jogs = []
      for (const j of candidatos) {
        if (!j.nome) continue
        const alvo = '@' + j.nome
        let idx = texto.indexOf(alvo)
        while (idx !== -1) {
          const fim = idx + alvo.length
          const proximoChar = texto[fim]
          const naFronteira = proximoChar === undefined || !/\p{L}/u.test(proximoChar)
          const dentroDeOutraMencao = posicoesUsadas.some(([ini, f]) => idx >= ini && idx < f)
          if (naFronteira && !dentroDeOutraMencao) {
            posicoesUsadas.push([idx, fim])
            jogs.push(j)
            break
          }
          idx = texto.indexOf(alvo, idx + 1)
        }
      }
      if (jogs.length > 0) {
        await enviarPush({
          jogadorIds: jogs.map(j => j.id),
          title: jogadorAtual.nome + ' te mencionou!',
          body: texto,
          url: '/rodada',
        })
      }
    }
    setEnviandoComentario(false)
  }

  async function deletarComentario(id) {
    await supabase.from('comentarios').delete().eq('id', id)
    setComentarios(prev => prev.filter(c => c.id !== id))
  }

  function renderTextoComMencoes(texto) {
    const partes = texto.split(/(@\w+(?:\s\w+\.?)?)/g)
    return partes.map((parte, i) => {
      if (parte.startsWith('@')) {
        return <span key={i} style={{ color: '#c9a227', fontWeight: 700 }}>{parte}</span>
      }
      return parte
    })
  }

  function handleTextoComentario(e) {
    const val = e.target.value
    setNovoComentario(val)
    // Detecta @ para sugerir menções
    const match = val.match(/@(\w*)$/)
    if (match) {
      const busca = match[1].toLowerCase()
      const sugestoes = jogadoresList.filter(j => j.nome.toLowerCase().includes(busca)).slice(0, 5)
      setMencaoAtiva(sugestoes.length > 0 ? sugestoes : null)
    } else {
      setMencaoAtiva(null)
    }
  }

  function inserirMencao(nome) {
    const semUltimaArroba = novoComentario.replace(/@\w*$/, '')
    setNovoComentario(semUltimaArroba + '@' + nome + ' ')
    setMencaoAtiva(null)
  }

  async function compartilharImagem(modo) {
    if (!rodadaDetalhe) return
    setCompartilhandoModo(modo || 'classificacao')
    setGerandoImagem(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const el = cardRef.current
      if (!el) { setGerandoImagem(false); return }
      el.style.display = 'block'
      await new Promise(r => setTimeout(r, 600))
      const canvas = await html2canvas(el, { backgroundColor: '#0f2d1e', scale: 2, useCORS: true, logging: false })
      el.style.display = 'none'
      canvas.toBlob(async (blob) => {
        const nomeArquivo = rodadaDetalhe.tipo === 'qualify' ? 'qualify' : 'r' + rodadaDetalhe.numero
        const file = new File([blob], 'resenha-bt-' + nomeArquivo + '.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Resenha BT - ' + nomeRodada(rodadaDetalhe) })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          a.click()
          URL.revokeObjectURL(url)
        }
        setGerandoImagem(false)
      }, 'image/png')
    } catch (e) {
      console.error(e)
      setGerandoImagem(false)
    }
  }

  function renderToggleChave(isEspecial) {
    const opcoes = isEspecial
      ? [{ key: 'ouro', label: '🏆 Time B (Vencedor)' }, { key: 'prata', label: '🔴 Time A' }]
      : [{ key: 'ouro', label: '🥇 Chave Ouro' }, { key: 'prata', label: '🥈 Chave Prata' }]
    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
        {opcoes.map(({ key, label }) => (
          <button key={key} onClick={() => setChaveVis(key)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
            background: chaveVis === key ? "linear-gradient(135deg, " + (key === 'ouro' ? '#f5c518, #c9a010' : '#8e9eab, #6b7f8a') + ")" : 'transparent',
            color: chaveVis === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
            letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s'
          }}>{label}</button>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  // Card de compartilhamento (oculto, só renderizado na hora de gerar imagem)
  function renderCardCompartilhamento() {
    const data = rodadaDetalhe ? new Date(rodadaDetalhe.data + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo'
    }) : ''
    const isEspecial = detalheJogos.some(j => ['time_a','time_b','especial'].includes(j.chave))
    const medals = ['🥇','🥈','🥉']
    const modoAtual = compartilhandoModo

    const renderRankCard = (rank, label, cor) => {
      if (!rank || rank.length === 0) return null
      return (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            {label}
          </div>
          {rank.map((j, idx) => (
            <div key={j.nome} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', marginBottom: 4,
              background: idx === 0 ? cor + '22' : 'rgba(255,255,255,0.04)', borderRadius: 8,
              borderLeft: j.movimento === 'desceu' ? '3px solid #e74c3c' : j.movimento === 'subiu' ? '3px solid #2ecc71' : '3px solid ' + cor + '44',
            }}>
              <span style={{ width: 28, fontSize: 13, textAlign: 'center' }}>{idx < 3 ? medals[idx] : (idx+1)+'o'}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: idx < 3 ? 700 : 400 }}>{j.nome}</span>
              {j.movimento === 'desceu' && <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700 }}>↓</span>}
              {j.movimento === 'subiu' && <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700 }}>↑</span>}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{j.vitorias}V · {j.pontosDia} pts</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: cor }}>{j.pontos} pts liga</div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div ref={cardRef} style={{ display: 'none', width: '600px', background: '#0f2d1e', padding: '32px', fontFamily: "'Segoe UI', sans-serif", color: '#e8f5e9' }}>
        <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #2a5a3a', paddingBottom: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#c9a227', letterSpacing: 2 }}>RESENHA BT</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
            {nomeRodada(rodadaDetalhe)}{isEspecial ? ' — Especial' : ''}
          </div>
          <div style={{ fontSize: 13, color: '#7fb89a', marginTop: 4 }}>{data}</div>
        </div>

        {modoAtual === 'jogos' ? (
          // Mostra os jogos
          <div>
            {isEspecial ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a227', marginBottom: 10 }}>🔴 Time A × 🔵 Time B</div>
                {detalheJogos.map((j) => (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{j.dupla_a_1}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)' }}>{j.dupla_a_2}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 70, justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: j.placar_a > j.placar_b ? '#f5c518' : 'rgba(255,255,255,0.4)' }}>{j.placar_a ?? '-'}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>x</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: j.placar_b > j.placar_a ? '#f5c518' : 'rgba(255,255,255,0.4)' }}>{j.placar_b ?? '-'}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{j.dupla_b_1}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)' }}>{j.dupla_b_2}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              ['ouro', 'prata'].map(chave => {
                const jogosChave = detalheJogos.filter(j => j.chave === chave)
                if (jogosChave.length === 0) return null
                const cor = chave === 'ouro' ? '#c9a227' : '#8e9eab'
                const grupos = []
                for (let i = 0; i < jogosChave.length; i += 3) grupos.push(jogosChave.slice(i, i+3))
                return (
                  <div key={chave} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cor, marginBottom: 8 }}>{chave === 'ouro' ? '🥇 Chave Ouro' : '🥈 Chave Prata'}</div>
                    {grupos.map((grupo, gi) => (
                      <div key={gi} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>Rodada {gi+1}</div>
                        {grupo.map(j => (
                          <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ flex: 1, textAlign: 'right', fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{j.dupla_a_1}</div>
                              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{j.dupla_a_2}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 70, justifyContent: 'center' }}>
                              <span style={{ fontSize: 18, fontWeight: 700, color: j.placar_a > j.placar_b ? '#f5c518' : 'rgba(255,255,255,0.4)' }}>{j.placar_a ?? '-'}</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>x</span>
                              <span style={{ fontSize: 18, fontWeight: 700, color: j.placar_b > j.placar_a ? '#f5c518' : 'rgba(255,255,255,0.4)' }}>{j.placar_b ?? '-'}</span>
                            </div>
                            <div style={{ flex: 1, fontSize: 12 }}>
                              <div style={{ fontWeight: 600 }}>{j.dupla_b_1}</div>
                              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{j.dupla_b_2}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        ) : isEspecial ? (
          <>
            {renderRankCard(detalheRanking['ouro'], '🔵 Time B (Vencedor)', '#3498db')}
            {renderRankCard(detalheRanking['prata'], '🔴 Time A', '#e74c3c')}
          </>
        ) : (
          <>
            {renderRankCard(detalheRanking['ouro'], '🥇 Chave Ouro', '#c9a227')}
            {renderRankCard(detalheRanking['prata'], '🥈 Chave Prata', '#8e9eab')}
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #2a5a3a', fontSize: 12, color: '#5a8a6a' }}>
          {rodadaDetalhe.local || 'Lake Beach Sports, Londrina/PR'}
        </div>
      </div>
    )
  }

  // VIEW: DETALHE
  if (view === 'detalhe' && rodadaDetalhe) {
    return (
      <div>
        {renderCardCompartilhamento()}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button onClick={() => setView('historico')} style={{
            background: 'transparent', border: "1px solid " + borda, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <h1 className="section-title" style={{ margin: 0 }}>
            {nomeRodada(rodadaDetalhe)}
            {rodadaDetalhe.tipo === 'especial' && <span style={{ fontSize: '14px', color: ouro, marginLeft: 8 }}>Especial</span>}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
            {new Date(rodadaDetalhe.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
          </div>
          <button onClick={() => compartilharImagem(detalheView)} disabled={gerandoImagem} style={{
            background: '#25D366', border: 'none', borderRadius: '8px',
            padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            color: '#fff', fontWeight: 700, fontSize: '13px', opacity: gerandoImagem ? 0.7 : 1
          }}>
            {gerandoImagem ? '⏳ Gerando...' : '📲 Compartilhar'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px' }}>
          {[{ key: 'jogos', label: '🎾 Jogos' }, { key: 'classificacao', label: '🏆 Classificacao' }].map(({ key, label }) => (
            <button key={key} onClick={() => setDetalheView(key)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              background: detalheView === key ? 'rgba(201,162,39,0.15)' : 'transparent',
              color: detalheView === key ? ouro : 'rgba(255,255,255,0.5)',
              outline: detalheView === key ? "1px solid rgba(201,162,39,0.3)" : '1px solid transparent',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        {/* Seção de Comentários */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 16px' }}>
            💬 Comentários ({comentarios.length})
          </h3>

          {/* Lista de comentários */}
          {comentarios.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              Seja o primeiro a comentar!
            </p>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {comentarios.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #1a4d2e, #2d7a45)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(201,162,39,0.2)' }}>
                    {c.jogadores?.foto_url
                      ? <img src={c.jogadores.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 13, fontWeight: 700 }}>{c.jogadores?.nome?.charAt(0)}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#c9a227' }}>{c.jogadores?.nome}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                      </span>
                      {jogadorAtual?.id === c.jogador_id && (
                        <button onClick={() => deletarComentario(c.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 11, marginLeft: 'auto', padding: 0 }}>🗑️</button>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#e8f5e9', lineHeight: 1.5 }}>{renderTextoComMencoes(c.texto)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Input de novo comentário */}
          {jogadorAtual ? (
            <div style={{ position: 'relative' }}>
              {mencaoAtiva && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#162f20', border: '1px solid #2a5a3a', borderRadius: 8, marginBottom: 4, zIndex: 10, overflow: 'hidden' }}>
                  {mencaoAtiva.map(j => (
                    <div key={j.id} {...acessivelClique(() => inserirMencao(j.nome))} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#e8f5e9', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      @{j.nome}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={novoComentario}
                  onChange={handleTextoComentario}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarComentario()}
                  placeholder="Comentar... use @ para mencionar"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #2a5a3a', borderRadius: 8, padding: '10px 12px', color: '#e8f5e9', fontSize: 13 }}
                />
                <button onClick={enviarComentario} disabled={enviandoComentario || !novoComentario.trim()} style={{ background: '#c9a227', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#0d2b1a', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: !novoComentario.trim() ? 0.5 : 1 }}>
                  {enviandoComentario ? '...' : '➤'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Faça login para comentar</p>
          )}
        </div>

        {(() => {
          const isEspecial = detalheJogos.some(j => ['time_a','time_b','especial'].includes(j.chave))
          return (
            <>
              {!isEspecial && renderToggleChave(false)}
              {detalheView === 'jogos'
                ? renderJogos(detalheJogos, chaveVis)
                : isEspecial
                  ? <>
                      {renderClassificacao(detalheRanking['ouro'], 'ouro', true)}
                      {renderClassificacao(detalheRanking['prata'], 'prata', true)}
                    </>
                  : renderClassificacao(detalheRanking[chaveVis], chaveVis, false)
              }
            </>
          )
        })()}
      </div>
    )
  }

  // VIEW: HISTORICO
  if (view === 'historico') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button onClick={() => setView('proxima')} style={{
            background: 'transparent', border: "1px solid " + borda, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px'
          }}>← Voltar</button>
          <h1 className="section-title" style={{ margin: 0 }}>Historico de Rodadas</h1>
        </div>
        {rodadasFinalizadas.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma rodada finalizada ainda.</p>
          </div>
        ) : (
          rodadasFinalizadas.map((r, i) => (
            <div key={r.id}>
              {(i === 0 || rodadasFinalizadas[i - 1].liga !== r.liga) && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, margin: i === 0 ? '0 0 8px' : '20px 0 8px' }}>
                  {r.liga}
                </div>
              )}
              <div {...acessivelClique(() => abrirDetalhe(r))} style={{
                background: cardBg, border: "1px solid " + borda, borderRadius: '12px',
                padding: '16px', marginBottom: '10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#e8f5e9' }}>
                    {nomeRodada(r)}
                    {r.tipo === 'especial' && <span style={{ fontSize: '12px', color: ouro, marginLeft: 8 }}>Especial</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '20px' }}>›</div>
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  // VIEW: PROXIMA RODADA
  return (
    <div>
      <div {...acessivelClique(() => navigate('/confirmacao'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: 10, marginBottom: 12, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#c9a227' }}>Confirmar Presença</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>›</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="section-title" style={{ margin: 0 }}>
          {proximaRodada ? (proximaRodada.tipo === 'qualify' ? 'Qualify' : "Rodada " + proximaRodada.numero) : 'Rodada'}
        </h1>
        {rodadasFinalizadas.length > 0 && (
          <button onClick={() => setView('historico')} style={{
            background: 'transparent', border: "1px solid " + borda, color: '#7fb89a',
            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
          }}>Anteriores</button>
        )}
      </div>

      {proximaRodada ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              {new Date(proximaRodada.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })}
              {proximaRodada.tipo === 'especial' && <span style={{ color: ouro, marginLeft: 8 }}>Rodada Especial</span>}
              <button onClick={() => baixarIcs(proximaRodada)} style={{
                marginLeft: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)',
                borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontSize: 11
              }}>
                📅 agenda
              </button>
              <div style={{ marginTop: 4 }}>⏰ 08:00 · {proximaRodada.local || 'Lake Beach Sports, Londrina'}</div>
            </div>
            {proximaJogos.length > 0 && (
              <button onClick={() => setAoVivo(!aoVivo)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: aoVivo ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.05)',
                border: aoVivo ? '1px solid rgba(231,76,60,0.5)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                color: aoVivo ? '#e74c3c' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: aoVivo ? '#e74c3c' : 'rgba(255,255,255,0.2)', display: 'inline-block', animation: aoVivo ? 'pulse 1s infinite' : 'none' }} />
                {aoVivo ? 'AO VIVO' : 'Ver classificação do dia'}
              </button>
            )}
          </div>
          {proximaJogos.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px' }}>Os jogos ainda nao foram sorteados</p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', marginTop: '8px' }}>Volte apos o sorteio ser publicado</p>
            </div>
          ) : (
            <>
              {renderToggleChave()}
              {aoVivo && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e74c3c', display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: '#e74c3c', fontWeight: 700 }}>Atualizando em tempo real</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>Os placares atualizam automaticamente</span>
                  </div>
                  {(rankingVivo.ouro.length > 0 || rankingVivo.prata.length > 0) && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        📊 Classificacao do dia (parcial)
                      </div>
                      {rankingVivo.ouro.length > 0 && (
                        <div className="card" style={{ marginBottom: 8, padding: 12, borderLeft: '3px solid #c9a227' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#c9a227', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🥇 Ouro</div>
                          {rankingVivo.ouro.map((j, idx) => (
                            <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < rankingVivo.ouro.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                              <div style={{ width: 20, fontSize: 11, fontWeight: 700, color: idx === 0 ? '#c9a227' : 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{idx+1}</div>
                              <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{j.vitorias}V</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a227' }}>{j.pontos}pts</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {rankingVivo.prata.length > 0 && (
                        <div className="card" style={{ padding: 12, borderLeft: '3px solid #8e9eab' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#8e9eab', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🥈 Prata</div>
                          {rankingVivo.prata.map((j, idx) => (
                            <div key={j.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < rankingVivo.prata.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                              <div style={{ width: 20, fontSize: 11, fontWeight: 700, color: idx === 0 ? '#8e9eab' : 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{idx+1}</div>
                              <div style={{ flex: 1, fontSize: 13, color: '#e8f5e9' }}>{j.nome}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{j.vitorias}V</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#8e9eab' }}>{j.pontos}pts</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {renderJogos(proximaJogos, chaveVis, proximaRodada?.status === 'ativa')}
            </>
          )}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma rodada agendada no momento</p>
        </div>
      )}
    </div>
  )
}
