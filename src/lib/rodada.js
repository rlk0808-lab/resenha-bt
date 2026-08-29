// Nome de exibição de uma rodada. A de Qualify tem numero = 0 (só serve pra
// ordenação — ver Confirmacao.jsx/Home.jsx) e nunca deve aparecer como
// "Rodada 0" pro jogador ou admin.
export function nomeRodada(rodada) {
  if (!rodada) return ""
  return rodada.tipo === "qualify" ? "Qualify" : `Rodada ${rodada.numero}`
}

// Ranking do qualify: chave única, sem times, mas usa exatamente os mesmos
// critérios de pontuação e desempate de uma rodada normal (pontos ->
// saldo de games -> confronto direto -> saldo do placar de tiebreak — ver
// calcularRankingLocal em Admin.jsx) pra que a posição de cada um saia
// idêntica à de uma rodada de verdade. Usado tanto pra definir a chave
// Ouro/Prata de cada jogador (Admin.jsx) quanto pra mostrar a classificação
// do Qualify no histórico (Rodada.jsx) — o Qualify não grava ranking_rodada
// (não vale ponto de liga), então os dois lugares recalculam esse ranking a
// partir dos jogos em vez de ler de uma tabela.
export function calcularRankingQualify(jogosQualify) {
  const stats = {}
  const confrontos = {}
  const addJogador = (nome) => { if (nome && !stats[nome]) { stats[nome] = { nome, pts: 0, vitorias: 0, saldo: 0, saldoTie: 0 }; confrontos[nome] = {} } }
  for (const jogo of jogosQualify) {
    if (jogo.placar_a === null || jogo.placar_b === null) continue
    const { dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, placar_a, placar_b, tie_a, tie_b } = jogo
    ;[dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2].forEach(addJogador)
    const jogadoresA = [dupla_a_1, dupla_a_2].filter(Boolean)
    const jogadoresB = [dupla_b_1, dupla_b_2].filter(Boolean)
    const venceuA = placar_a > placar_b
    const saldo = Math.abs(placar_a - placar_b)
    const vencedores = venceuA ? jogadoresA : jogadoresB
    const perdedores = venceuA ? jogadoresB : jogadoresA
    vencedores.forEach(n => { stats[n].pts += 15 + saldo; stats[n].vitorias += 1; stats[n].saldo += saldo })
    perdedores.forEach(n => { stats[n].pts += venceuA ? placar_b : placar_a; stats[n].saldo -= saldo })
    if (tie_a != null && tie_b != null) {
      const saldoTieJogo = tie_a - tie_b
      jogadoresA.forEach(n => { stats[n].saldoTie += saldoTieJogo })
      jogadoresB.forEach(n => { stats[n].saldoTie -= saldoTieJogo })
    }
    jogadoresA.forEach(a => { jogadoresB.forEach(b => { if (venceuA) { confrontos[a][b] = (confrontos[a][b] || 0) + 1 } else { confrontos[b][a] = (confrontos[b][a] || 0) + 1 } }) })
  }
  return Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (b.saldo !== a.saldo) return b.saldo - a.saldo
    const confrontoDiff = (confrontos[b.nome]?.[a.nome] || 0) - (confrontos[a.nome]?.[b.nome] || 0)
    if (confrontoDiff !== 0) return confrontoDiff
    return (b.saldoTie || 0) - (a.saldoTie || 0)
  })
}

// Tamanho da chave Ouro conforme o total de jogadores no qualify
// (24 -> 12, 28 -> 12, 32 -> 16 — igual aos formatos do fechamento normal).
export function alvoOuroPorTotal(total) {
  return total >= 32 ? 16 : 12
}
