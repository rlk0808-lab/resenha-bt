// Espalhe o retorno num elemento não-interativo (div, tr...) que já tem onClick,
// pra ele responder também a teclado (Enter/Espaço) e ser anunciado por leitor de tela.
export function acessivelClique(onClick) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick(e)
      }
    },
  }
}
