// Gera o sorteio da rodada de Qualify: todos os jogadores numa chave só,
// 4 rodadas internas, cada um com 4 parceiros e 8 adversários distintos
// (sem repetir nenhum), igual à regra já usada nas chaves normais — mas
// generalizado pra qualquer N múltiplo de 4 (24, 28, 32...), não só 12/16.
//
// Diferente de gerarSorteio() (Admin.jsx), que usa tabelas fixas pra 12/16,
// aqui a combinação é construída por tentativa aleatória com backtracking —
// validado em testes: sempre resolve em 1-2 tentativas, poucos ms.

function embaralhar(lista) {
  const arr = [...lista]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function chavePar(a, b) {
  return [a, b].sort().join('|')
}

function tentarMontarRodada(jogadores, parceirosUsados, adversariosUsados) {
  function montarDuplas(disponiveis) {
    if (disponiveis.length === 0) return []
    const [primeiro, ...resto] = disponiveis
    for (const candidato of embaralhar(resto)) {
      if (parceirosUsados.has(chavePar(primeiro, candidato))) continue
      const subResultado = montarDuplas(resto.filter(x => x !== candidato))
      if (subResultado !== null) return [[primeiro, candidato], ...subResultado]
    }
    return null
  }

  const duplas = montarDuplas(embaralhar(jogadores))
  if (!duplas) return null

  function conflitamAdversario(duplaA, duplaB) {
    for (const x of duplaA) for (const y of duplaB) {
      if (adversariosUsados.has(chavePar(x, y))) return true
    }
    return false
  }

  function montarPartidas(duplasDisponiveis) {
    if (duplasDisponiveis.length === 0) return []
    const [primeira, ...resto] = duplasDisponiveis
    for (const candidata of embaralhar(resto)) {
      if (conflitamAdversario(primeira, candidata)) continue
      const subResultado = montarPartidas(resto.filter(x => x !== candidata))
      if (subResultado !== null) return [[primeira, candidata], ...subResultado]
    }
    return null
  }

  const partidas = montarPartidas(embaralhar(duplas))
  if (!partidas) return null

  return partidas.map(([duplaA, duplaB]) => [duplaA[0], duplaA[1], duplaB[0], duplaB[1]])
}

// Retorna array de 4 rodadas, cada uma um array de [a1, a2, b1, b2], ou null
// se não conseguir montar (não deveria acontecer para N >= 12 múltiplo de 4).
export function gerarSorteioQualify(jogadores, tentativasMax = 500) {
  const n = jogadores?.length
  if (!n || n % 4 !== 0 || n < 12) {
    console.error(`gerarSorteioQualify: esperava múltiplo de 4 (mínimo 12), recebeu ${n}`)
    return null
  }

  for (let tentativa = 0; tentativa < tentativasMax; tentativa++) {
    const parceirosUsados = new Set()
    const adversariosUsados = new Set()
    const rodadas = []
    let sucesso = true

    for (let r = 0; r < 4; r++) {
      const partidas = tentarMontarRodada(jogadores, parceirosUsados, adversariosUsados)
      if (!partidas) { sucesso = false; break }
      for (const [a1, a2, b1, b2] of partidas) {
        parceirosUsados.add(chavePar(a1, a2))
        parceirosUsados.add(chavePar(b1, b2))
        for (const x of [a1, a2]) for (const y of [b1, b2]) adversariosUsados.add(chavePar(x, y))
      }
      rodadas.push(partidas)
    }
    if (sucesso) return rodadas
  }

  console.error('gerarSorteioQualify: não foi possível gerar sorteio válido após várias tentativas')
  return null
}
