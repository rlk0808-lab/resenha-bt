// Calcula o prazo da lista principal: quarta-feira (3 dias antes do sábado
// da rodada) às 10h. Extraído da Confirmacao.jsx para poder ser reaproveitado
// (ex: contador regressivo na Home).
export function calcularPrazoConfirmacao(rodada) {
  if (!rodada) return null
  const dataRodada = new Date(rodada.data + "T12:00:00-03:00")
  const quartaAntes = new Date(dataRodada)
  quartaAntes.setDate(dataRodada.getDate() - 3)
  quartaAntes.setHours(10, 0, 0, 0)
  return quartaAntes
}
