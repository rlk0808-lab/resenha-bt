import { useState, useEffect } from 'react'

function calcularRestante(targetDate) {
  if (!targetDate) return null
  const diff = targetDate.getTime() - Date.now()
  if (diff <= 0) return null
  const dias = Math.floor(diff / 86400000)
  const horas = Math.floor((diff % 86400000) / 3600000)
  const minutos = Math.floor((diff % 3600000) / 60000)
  return { dias, horas, minutos }
}

// Retorna { dias, horas, minutos } até targetDate, ou null se já passou.
// Atualiza a cada 30s — suficiente para um contador de dias/horas/minutos.
export function useCountdown(targetDate) {
  const [restante, setRestante] = useState(() => calcularRestante(targetDate))
  const targetTime = targetDate?.getTime()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestante(calcularRestante(targetDate))
    const id = setInterval(() => setRestante(calcularRestante(targetDate)), 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTime])

  return restante
}

export function formatarRestante(restante) {
  if (!restante) return null
  const { dias, horas, minutos } = restante
  if (dias > 0) return `${dias}d ${horas}h`
  if (horas > 0) return `${horas}h ${minutos}min`
  return `${minutos}min`
}
