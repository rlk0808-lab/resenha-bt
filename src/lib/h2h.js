// Calcula parceiros, adversários, melhor dupla e sequência a partir de um
// conjunto de jogos já finalizados (com placar) de um jogador específico.
// Compartilhado entre Perfil.jsx e PerfilJogador.jsx.
export function calcularStatsDeJogos(jogosComPlacar, nomePerfil) {
  if (!jogosComPlacar || jogosComPlacar.length === 0) {
    return { jogos: [], parceiros: [], adversarios: [], melhorDupla: null, sequencia: null }
  }

  const statsParc = {}
  const statsAdv = {}
  for (const jogo of jogosComPlacar) {
    const estouNoA = jogo.dupla_a_1 === nomePerfil || jogo.dupla_a_2 === nomePerfil
    const euVenci = estouNoA ? jogo.placar_a > jogo.placar_b : jogo.placar_b > jogo.placar_a
    const parceiro = estouNoA
      ? (jogo.dupla_a_1 === nomePerfil ? jogo.dupla_a_2 : jogo.dupla_a_1)
      : (jogo.dupla_b_1 === nomePerfil ? jogo.dupla_b_2 : jogo.dupla_b_1)
    if (parceiro) {
      if (!statsParc[parceiro]) statsParc[parceiro] = { jogos: 0, vitorias: 0 }
      statsParc[parceiro].jogos++
      if (euVenci) statsParc[parceiro].vitorias++
    }
    const advs = estouNoA
      ? [jogo.dupla_b_1, jogo.dupla_b_2].filter(Boolean)
      : [jogo.dupla_a_1, jogo.dupla_a_2].filter(Boolean)
    for (const adv of advs) {
      if (!statsAdv[adv]) statsAdv[adv] = { jogos: 0, vitorias: 0, jogoIds: new Set() }
      if (!statsAdv[adv].jogoIds.has(jogo.id)) {
        statsAdv[adv].jogoIds.add(jogo.id)
        statsAdv[adv].jogos++
        if (euVenci) statsAdv[adv].vitorias++
      }
    }
  }

  const parceiros = Object.entries(statsParc)
    .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
    .sort((a, b) => b.jogos - a.jogos)
  const adversarios = Object.entries(statsAdv)
    .map(([nome, s]) => ({ nome, ...s, derrotas: s.jogos - s.vitorias, pct: Math.round(s.vitorias / s.jogos * 100) }))
    .sort((a, b) => b.jogos - a.jogos)
  const melhorDupla = parceiros.filter(p => p.jogos >= 2).sort((a, b) => b.pct - a.pct)[0] || null

  const jogosOrdenados = [...jogosComPlacar].sort((a, b) => {
    if (b.numero_rodada !== a.numero_rodada) return (b.numero_rodada || 0) - (a.numero_rodada || 0)
    if (b.rodada_interna !== a.rodada_interna) return (b.rodada_interna || 0) - (a.rodada_interna || 0)
    return new Date(b.created_at) - new Date(a.created_at)
  })
  let seq = 0, tipo = null
  for (const jogo of jogosOrdenados) {
    const estouNoA = jogo.dupla_a_1 === nomePerfil || jogo.dupla_a_2 === nomePerfil
    const venci = estouNoA ? jogo.placar_a > jogo.placar_b : jogo.placar_b > jogo.placar_a
    const t = venci ? 'V' : 'D'
    if (tipo === null) { tipo = t; seq = 1 }
    else if (t === tipo) seq++
    else break
  }
  const sequencia = tipo ? { tipo, seq } : null

  return { jogos: jogosComPlacar, parceiros, adversarios, melhorDupla, sequencia }
}

export const DADOS_H2H_VAZIOS = { jogos: [], parceiros: [], adversarios: [], melhorDupla: null, sequencia: null }
