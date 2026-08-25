import { nomeRodada } from './rodada'

// Gera e baixa um arquivo .ics da rodada (08h às 12h, Lake Beach Sports).
export function gerarIcs(rodada) {
  if (!rodada) return null
  const inicio = new Date(rodada.data + 'T08:00:00-03:00')
  const fim = new Date(rodada.data + 'T12:00:00-03:00')
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const uid = `resenha-bt-rodada-${rodada.numero}-${rodada.id}@resenha-bt.vercel.app`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Resenha BT//PT-BR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(inicio)}`,
    `DTEND:${fmt(fim)}`,
    `SUMMARY:Resenha BT - ${nomeRodada(rodada)}`,
    `LOCATION:${rodada.local || 'Lake Beach Sports, Londrina - PR'}`,
    `DESCRIPTION:Liga de Beach Tennis - ${rodada.liga || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function baixarIcs(rodada) {
  const texto = gerarIcs(rodada)
  if (!texto) return
  const blob = new Blob([texto], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = rodada.tipo === 'qualify' ? 'resenha-bt-qualify.ics' : `resenha-bt-rodada-${rodada.numero}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
