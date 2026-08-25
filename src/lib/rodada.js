// Nome de exibição de uma rodada. A de Qualify tem numero = 0 (só serve pra
// ordenação — ver Confirmacao.jsx/Home.jsx) e nunca deve aparecer como
// "Rodada 0" pro jogador ou admin.
export function nomeRodada(rodada) {
  if (!rodada) return ""
  return rodada.tipo === "qualify" ? "Qualify" : `Rodada ${rodada.numero}`
}
