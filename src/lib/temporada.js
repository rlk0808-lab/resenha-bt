import { supabase } from './supabase'

// A liga "atual" é a da rodada mais recente já criada. Não depende de
// nenhuma tabela de configuração — assim que "Encerrar Temporada" cria a
// rodada 1 da liga nova, ela automaticamente passa a ser a atual.
export async function buscarLigaAtual() {
  const { data } = await supabase.from('rodadas').select('liga').order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.liga || null
}

async function buscarRodadasDaLiga(liga) {
  const { data } = await supabase.from('rodadas').select('id, status').eq('liga', liga)
  return data || []
}

// Replica a lógica das views `classificacao` / `classificacao_com_descarte`
// (soma de pontuacao por jogador, com rank; a versão com descarte ignora os
// 2 piores resultados de cada jogador), mas escopada só à liga atual — as
// views originais somam tudo desde sempre, e viraram o "Histórico Total".
export async function buscarClassificacaoTemporadaAtual({ comDescarte = false } = {}) {
  const liga = await buscarLigaAtual()
  if (!liga) return { liga: null, lista: [] }

  const rodadas = await buscarRodadasDaLiga(liga)
  const rodadasFinalizadas = rodadas.filter(r => r.status === 'finalizada')
  const rodadaIds = comDescarte ? rodadasFinalizadas.map(r => r.id) : rodadas.map(r => r.id)

  const [{ data: jogadoresRows }, { data: pontuacaoRows }] = await Promise.all([
    supabase.from('jogadores').select('id, nome, chave, foto_url'),
    rodadaIds.length > 0
      ? supabase.from('pontuacao').select('jogador_id, rodada_id, pontos, vitorias').in('rodada_id', rodadaIds)
      : Promise.resolve({ data: [] }),
  ])

  const porJogador = {}
  for (const p of (pontuacaoRows || [])) {
    if (!porJogador[p.jogador_id]) porJogador[p.jogador_id] = []
    porJogador[p.jogador_id].push(p)
  }

  const resultado = []
  for (const j of (jogadoresRows || [])) {
    const pontuacoes = porJogador[j.id] || []
    if (pontuacoes.length === 0) continue // nunca participou dessa liga, nem uma vez

    if (comDescarte) {
      // Quem já jogou pelo menos 1 rodada da liga entra na conta de TODA
      // rodada finalizada da liga — mesmo as de antes de ter se
      // cadastrado, que valem pontos:0 e concorrem normalmente pra serem
      // uma das 2 descartadas (mesma regra de quem faltou já cadastrado).
      const porRodadaId = {}
      for (const p of pontuacoes) porRodadaId[p.rodada_id] = p
      const todasAsRodadas = rodadasFinalizadas.map(r => porRodadaId[r.id] || { pontos: 0, vitorias: 0 })
      if (todasAsRodadas.length <= 2) continue // liga com 2 ou menos rodadas — nada sobra pra contar
      const consideradas = [...todasAsRodadas].sort((a, b) => a.pontos - b.pontos).slice(2)
      resultado.push({
        id: j.id, nome: j.nome, chave: j.chave, foto_url: j.foto_url,
        pontos: consideradas.reduce((s, p) => s + p.pontos, 0),
        vitorias: consideradas.reduce((s, p) => s + p.vitorias, 0),
        rodadas_jogadas: pontuacoes.length, // participação real — não conta as rodadas fantasma
      })
    } else {
      resultado.push({
        id: j.id, nome: j.nome, chave: j.chave, foto_url: j.foto_url,
        pontos: pontuacoes.reduce((s, p) => s + p.pontos, 0),
        vitorias: pontuacoes.reduce((s, p) => s + p.vitorias, 0),
        rodadas_jogadas: pontuacoes.length,
      })
    }
  }

  resultado.sort((a, b) => b.pontos - a.pontos)
  let posAtual = 0, ultimoPontos = null
  resultado.forEach((r, idx) => {
    if (r.pontos !== ultimoPontos) { posAtual = idx + 1; ultimoPontos = r.pontos }
    r.posicao = posAtual
  })

  return { liga, lista: resultado }
}

// Stats de um único jogador na temporada atual (equivalente a stats_jogador,
// mas escopado à liga atual). Reaproveita o cálculo da classificação inteira
// porque a posição de um jogador depende de todo mundo.
export async function buscarStatsJogadorTemporadaAtual(jogadorId, { comDescarte = false } = {}) {
  const { liga, lista } = await buscarClassificacaoTemporadaAtual({ comDescarte })
  const jogador = lista.find(j => j.id === jogadorId)
  return {
    liga,
    pontos_total: jogador?.pontos || 0,
    vitorias: jogador?.vitorias || 0,
    rodadas_jogadas: jogador?.rodadas_jogadas || 0,
    posicao: jogador?.posicao || null,
  }
}

// IDs de rodada que pertencem à liga atual — usado pra filtrar `jogos`
// (H2H, parceiros, sequência) por temporada atual em vez de histórico total.
export async function buscarRodadaIdsLigaAtual() {
  const liga = await buscarLigaAtual()
  if (!liga) return new Set()
  const rodadas = await buscarRodadasDaLiga(liga)
  return new Set(rodadas.map(r => r.id))
}

// Vitórias por jogador, quebradas por chave (Ouro/Prata), somando SEMPRE
// por jogador_id — `pontuacao` e `ranking_rodada` nunca são tocadas pela
// substituição de jogador (diferente de `jogos`, que guarda nome em texto
// e pode ter sido reescrita retroativamente). Histórico total (todas as
// ligas), mesmo recorte que a aba "Vitórias" de Estatísticas sempre teve.
export async function buscarVitoriasGerais() {
  const [{ data: jogadoresRows }, { data: pontuacaoRows }, { data: rankingRows }] = await Promise.all([
    supabase.from('jogadores').select('id, nome, foto_url'),
    supabase.from('pontuacao').select('jogador_id, rodada_id, pontos, vitorias'),
    supabase.from('ranking_rodada').select('jogador_id, rodada_id, chave'),
  ])

  const chavePorLinha = {}
  for (const r of (rankingRows || [])) chavePorLinha[r.jogador_id + '_' + r.rodada_id] = r.chave

  const porJogador = {}
  for (const p of (pontuacaoRows || [])) {
    if (!porJogador[p.jogador_id]) porJogador[p.jogador_id] = { vitoriasOuro: 0, vitoriasPrata: 0, vitoriasOutras: 0, pontos: 0, rodadasJogadas: 0 }
    const acc = porJogador[p.jogador_id]
    const chave = chavePorLinha[p.jogador_id + '_' + p.rodada_id]
    // Rodadas especiais usam chave "time_a"/"time_b" (ou vêm sem linha em
    // ranking_rodada) — não são nem Ouro nem Prata. Cair no "else" de um
    // if(chave==='ouro') as jogava tudo dentro de Prata (bug: inflava a
    // Prata de quem jogou especial, ex: Ricardo aparecendo com 8V na
    // Prata sendo que só tinha 3 — as outras 5 eram de 2 rodadas especiais).
    if (chave === 'ouro') acc.vitoriasOuro += p.vitorias || 0
    else if (chave === 'prata') acc.vitoriasPrata += p.vitorias || 0
    else acc.vitoriasOutras += p.vitorias || 0
    acc.pontos += p.pontos || 0
    acc.rodadasJogadas += 1
  }

  return (jogadoresRows || [])
    .filter(j => porJogador[j.id])
    .map(j => {
      const acc = porJogador[j.id]
      return {
        id: j.id, nome: j.nome, foto: j.foto_url,
        vitoriasOuro: acc.vitoriasOuro, vitoriasPrata: acc.vitoriasPrata, vitoriasOutras: acc.vitoriasOutras,
        total: acc.vitoriasOuro + acc.vitoriasPrata + acc.vitoriasOutras,
        pontos: acc.pontos, rodadasJogadas: acc.rodadasJogadas,
      }
    })
    .sort((a, b) => b.total - a.total)
}
