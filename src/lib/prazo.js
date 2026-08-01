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

// Data (YYYY-MM-DD) do próximo sábado a partir de agora. Ancorado em meio-dia
// local antes de calcular: se usasse a hora atual direto, uma ação feita à
// noite (ex: perto da meia-noite) podia virar o dia seguinte ao converter
// pra UTC via toISOString(), adiantando a data da próxima rodada em 1 dia.
export function proximoSabadoISO() {
  const agora = new Date()
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12, 0, 0)
  const diasParaSabado = (6 - hoje.getDay() + 7) % 7 || 7
  hoje.setDate(hoje.getDate() + diasParaSabado)
  return hoje.toISOString().split('T')[0]
}
