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
  const rodadaIds = comDescarte
    ? rodadas.filter(r => r.status === 'finalizada').map(r => r.id)
    : rodadas.map(r => r.id)

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

    if (comDescarte) {
      if (pontuacoes.length === 0) continue // precisa ter jogado ao menos uma rodada finalizada
      const consideradas = [...pontuacoes].sort((a, b) => a.pontos - b.pontos).slice(2)
      if (consideradas.length === 0) continue // só jogou 1-2 rodadas, ambas descartadas
      resultado.push({
        id: j.id, nome: j.nome, chave: j.chave, foto_url: j.foto_url,
        pontos: consideradas.reduce((s, p) => s + p.pontos, 0),
        vitorias: consideradas.reduce((s, p) => s + p.vitorias, 0),
        rodadas_jogadas: consideradas.length,
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
