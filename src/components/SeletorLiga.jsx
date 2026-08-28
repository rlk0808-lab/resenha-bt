// Sentinela usado onde quer que "Histórico Total" precise ser distinguido de
// um nome de liga real — fonte única (antes duplicado como const local em
// Classificacao.jsx e Stats.jsx).
export const HISTORICO_TOTAL = '__total__'

// Seletor de liga reutilizado em Classificacao/Stats/Perfil/PerfilJogador/
// Evolucao: liga atual + cada liga passada (mais recente primeiro) + opção
// "Histórico Total" (omitida quando incluirHistoricoTotal=false, ex.
// Evolucao.jsx, onde misturar ligas no mesmo eixo X não faz sentido).
export default function SeletorLiga({ ligas, selecao, onSelecionar, incluirHistoricoTotal = true }) {
  const opcoes = [
    ...ligas.map((l, i) => ({ key: l, label: i === 0 ? `📅 ${l}` : `📜 ${l}` })),
    ...(incluirHistoricoTotal ? [{ key: HISTORICO_TOTAL, label: '🏆 Histórico Total' }] : []),
  ]

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', overflowX: 'auto' }}>
      {opcoes.map(({ key, label }) => (
        <button key={key} onClick={() => onSelecionar(key)} style={{
          flex: '0 0 auto', padding: '10px 14px', border: 'none', borderRadius: '8px',
          background: selecao === key ? 'linear-gradient(135deg, #f5c518, #c9a010)' : 'transparent',
          color: selecao === key ? '#0d2b1a' : 'rgba(255,255,255,0.5)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
        }}>{label}</button>
      ))}
    </div>
  )
}
