import { supabase } from './supabase'

// Todas as punições (atraso/suspensão) da liga informada — tudo escopado
// por jogador_id, nunca por nome (mesma regra do resto do projeto).
export async function buscarPunicoesLiga(liga) {
  if (!liga) return []
  const { data } = await supabase.from('punicoes').select('*').eq('liga', liga).order('created_at', { ascending: true })
  return data || []
}

// Quantos atrasos (tipo:'atraso') esse jogador já acumulou nessa liga.
export function contarAtrasos(jogadorId, punicoesLiga) {
  return punicoesLiga.filter(p => p.jogador_id === jogadorId && p.tipo === 'atraso').length
}

// Suspensão ativa (se houver) que bloqueia `rodadaNumeroAtual` pra esse
// jogador: cada linha tipo:'suspensao' bloqueia as rodadas
// [rodada_numero+1, rodada_numero+quantidade_rodadas] dentro da liga em que
// foi aplicada. Se houver mais de uma suspensão cobrindo a rodada atual,
// retorna a mais recente (a que blindou por último).
export function suspensaoAtiva(jogadorId, rodadaNumeroAtual, punicoesLiga) {
  const suspensoes = punicoesLiga.filter(p => p.jogador_id === jogadorId && p.tipo === 'suspensao')
  let ativa = null
  for (const s of suspensoes) {
    const inicio = s.rodada_numero + 1
    const fim = s.rodada_numero + s.quantidade_rodadas
    if (rodadaNumeroAtual >= inicio && rodadaNumeroAtual <= fim) {
      if (!ativa || new Date(s.created_at) > new Date(ativa.created_at)) ativa = s
    }
  }
  return ativa
}

// Status resumido de um jogador pra exibir em badges (perfil, listas, home).
export function statusJogador(jogadorId, rodadaNumeroAtual, punicoesLiga) {
  const atrasos = contarAtrasos(jogadorId, punicoesLiga)
  const suspensao = suspensaoAtiva(jogadorId, rodadaNumeroAtual, punicoesLiga)
  return { atrasos, suspensao }
}
