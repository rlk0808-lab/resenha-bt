import { supabase } from './supabase'

// Manda o(s) jogador_id(s) a notificar — não mais a subscription (endpoint
// + chaves) em si. Quem busca a subscription agora é o servidor, usando a
// service_role key, que nunca chega no navegador (ver
// api/send-notification.js) — antes o client precisava ler
// push_subscriptions de OUTRO jogador pra montar essa chamada, o que só
// era possível porque a tabela estava aberta pra leitura geral.
// jogadorIds omitido/vazio = notifica todo mundo inscrito.
export async function enviarPush({ jogadorIds, title, body, url }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await fetch('/api/send-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ jogadorIds, title, body, url }),
  })
}

// Avisa os admins (push) quando alguém sai da lista PRINCIPAL de uma rodada,
// pra decidirem se falta procurar outro jogador. Chamar logo depois do RPC
// cancelar_confirmacao, só quando a confirmação cancelada era 'confirmado'
// (sair da espera não abre vaga). `promovidoJogadorId` é o retorno do RPC:
// quem subiu da espera automaticamente, ou null se a espera estava vazia.
// Nunca lança — o aviso é secundário e não pode quebrar o cancelamento.
export async function avisarAdminsSaidaLista({ rodada, promovidoJogadorId }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !rodada) return

    const { data: admins } = await supabase.from('jogadores').select('id, user_id').eq('role', 'admin')
    const { data: quemSaiu } = await supabase.from('jogadores').select('id, nome').eq('user_id', user.id).limit(1)
    const saiu = quemSaiu?.[0]
    // Quem cancelou não precisa ser avisado da própria saída.
    const destinatarios = (admins || []).filter(a => a.user_id !== user.id).map(a => a.id)
    if (!saiu || destinatarios.length === 0) return

    let promovidoNome = null
    if (promovidoJogadorId) {
      const { data: p } = await supabase.from('jogadores').select('nome').eq('id', promovidoJogadorId).limit(1)
      promovidoNome = p?.[0]?.nome || null
    }
    const { count: naEspera } = await supabase.from('confirmacoes')
      .select('id', { count: 'exact', head: true }).eq('rodada_id', rodada.id).eq('status', 'espera')

    const nomeRod = rodada.tipo === 'qualify' ? 'Qualify' : `Rodada ${rodada.numero}`
    const desfecho = promovidoJogadorId
      ? `${promovidoNome || 'O primeiro da espera'} subiu da lista de espera${naEspera ? ` (restam ${naEspera} na espera)` : ''}.`
      : 'Não há ninguém na lista de espera — é preciso procurar outro jogador.'

    await enviarPush({
      jogadorIds: destinatarios,
      title: `Saiu da lista: ${saiu.nome}`,
      body: `${saiu.nome} saiu da lista principal da ${nomeRod}. ${desfecho}`,
      url: '/admin',
    })
  } catch (e) { console.error('Erro ao avisar admins da saída:', e) }
}
