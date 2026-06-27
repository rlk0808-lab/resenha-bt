import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = 'BMHV4p7s8c56frD-er1PKzzRAEEiDXRlvY-KLpA4Zbksj0zjkbRK6eCfCqargq9piCfWO1M2FawklaGx3JrvoGY'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function registrarNotificacoes(jogadorId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push não suportado neste navegador')
    return false
  }

  try {
    // Registra o service worker
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Pede permissão
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Cria subscription
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    const sub = subscription.toJSON()

    // Salva no banco
    await supabase.from('push_subscriptions').upsert({
      jogador_id: jogadorId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    }, { onConflict: 'jogador_id,endpoint', ignoreDuplicates: false })

    return true
  } catch (err) {
    console.error('Erro ao registrar notificações:', err)
    return false
  }
}

export async function verificarNotificacoes() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub && Notification.permission === 'granted'
}