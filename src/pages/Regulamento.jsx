import { useState } from 'react'

const ouro = '#c9a227'
const prata = '#8e9eab'
const borda = '#2a5a3a'
const cardBg = '#162f20'

const secoes = [
  {
    icon: '📅',
    titulo: 'Quando?',
    itens: [
      'Todos os sábados às 08h00',
      'O torneio terá 12 rodadas',
      'A rodada será cancelada em caso de condições climáticas desfavoráveis',
    ]
  },
  {
    icon: '⚡',
    titulo: 'Estrutura',
    itens: [
      'Qualify (sem pontuação) define os jogadores da Chave Ouro e Prata',
      'A cada rodada: 3 últimos da Ouro descem, 3 primeiros da Prata sobem',
      'Se faltarem jogadores da Ouro, sobem mais da Prata na mesma proporção',
      'Jogador da Ouro que faltar é automaticamente rebaixado para a Prata',
    ]
  },
  {
    icon: '🏆',
    titulo: 'Formato dos Jogos',
    itens: [
      '4 jogos por participante por rodada',
      'Cada jogo: 1 set até 6 games',
      'Em 5x5: tiebreak até 7 pontos',
      'Vencedores: 15 pontos + saldo de games',
      'Perdedores: games conquistados',
      'A soma dos 4 jogos define a classificação da rodada',
    ]
  },
  {
    icon: '📊',
    titulo: 'Pontuação da Liga — Chave Ouro',
    tabela: [
      ['1º', '25 pts', '+3 por vitória'],
      ['2º', '22 pts', '+3 por vitória'],
      ['3º', '20 pts', '+3 por vitória'],
      ['4º', '18 pts', '+3 por vitória'],
      ['5º', '16 pts', '+3 por vitória'],
      ['6º', '14 pts', '+3 por vitória'],
      ['7º', '12 pts', '+3 por vitória'],
      ['8º', '10 pts', '+3 por vitória'],
      ['9º ao 12º', '8 pts', '+3 por vitória'],
    ]
  },
  {
    icon: '🥈',
    titulo: 'Pontuação da Liga — Chave Prata',
    itens: [
      '8 pontos fixos + 3 por vitória',
      'Campeão da rodada: +3 pontos extras',
      'Bônus de campeão não vale nas rodadas especiais',
    ]
  },
  {
    icon: '🎯',
    titulo: 'Rodadas Especiais (4ª e 8ª)',
    itens: [
      'Disputa entre times — sem subida/descida',
      'Capitães = 2 primeiros da classificação geral',
      'Draft na sexta-feira anterior ao jogo',
      'Vitória = saldo de games | Derrota = 0 pontos',
      'Time vencedor: 40 pts por jogador + 3 por vitória individual',
      'Time perdedor: 10 pts por jogador + 3 por vitória individual',
    ]
  },
  {
    icon: '🔚',
    titulo: '12ª Rodada',
    itens: [
      'Pontuação dobrada',
      'Divisão normal entre Ouro e Prata',
    ]
  },
  {
    icon: '🧮',
    titulo: 'Descarte de Resultados',
    itens: [
      'As 2 piores pontuações de cada jogador são descartadas ao final',
      'Inclui faltas (pontuação 0) ou desempenhos ruins',
    ]
  },
  {
    icon: '📝',
    titulo: 'Confirmação de Participação',
    itens: [
      'Lista enviada toda segunda-feira',
      'Confirmação obrigatória até quarta-feira às 10h00',
      'Quem não confirmar será substituído automaticamente',
      'Jogadores da lista de espera entram conforme vagas abrem',
    ]
  },
  {
    icon: '⏰',
    titulo: 'Pontualidade e Ausência',
    itens: [
      'Jogos iniciam às 08h00 com tolerância de 10 minutos',
      '2 atrasos = suspensão na rodada seguinte',
      'Falta sem aviso e sem substituto = suspensão de 2 rodadas',
    ]
  },
  {
    icon: '🤕',
    titulo: 'Lesão',
    itens: [
      'Jogador lesionado é substituído por alguém do mesmo nível',
      'Se o lesionado estiver na Ouro, é automaticamente rebaixado para a Prata',
    ]
  },
  {
    icon: '❄️',
    titulo: 'Bônus de Inverno',
    itens: [
      'Campeões da rodada (Ouro e Prata) não pagam a quadra',
      'O valor é dividido entre os demais participantes',
    ]
  },
]

export default function Regulamento({ onFechar }) {
  const [secaoAberta, setSecaoAberta] = useState(null)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f2d1e', zIndex: 500, overflowY: 'auto', padding: '20px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onFechar} style={{ background: 'transparent', border: `1px solid ${borda}`, color: '#7fb89a', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: ouro, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 2, textTransform: 'uppercase' }}>
            📋 Regulamento
          </h1>
          <div style={{ fontSize: 12, color: '#7fb89a', marginTop: 2 }}>Torneio de Inverno 2026</div>
        </div>
      </div>

      {/* Seções accordion */}
      {secoes.map((s, idx) => {
        const aberta = secaoAberta === idx
        return (
          <div key={idx} style={{ background: cardBg, border: `1px solid ${aberta ? ouro + '44' : borda}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden', transition: 'border 0.2s' }}>
            <button
              onClick={() => setSecaoAberta(aberta ? null : idx)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: aberta ? ouro : '#e8f5e9' }}>{s.titulo}</span>
              </div>
              <span style={{ color: aberta ? ouro : 'rgba(255,255,255,0.3)', fontSize: 18, transition: 'transform 0.2s', display: 'inline-block', transform: aberta ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {aberta && (
              <div style={{ padding: '0 16px 16px' }}>
                {s.itens && s.itens.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <span style={{ color: ouro, flexShrink: 0, marginTop: 2 }}>•</span>
                    <span style={{ fontSize: 13, color: '#c8e6c9', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
                {s.tabela && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
                    <thead>
                      <tr>
                        {['Posição', 'Pts Fixos', 'Bônus'].map(h => (
                          <th key={h} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textAlign: 'left', padding: '4px 8px', borderBottom: `1px solid ${borda}`, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.tabela.map(([pos, pts, bonus], i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                          <td style={{ padding: '6px 8px', fontSize: 13, color: ouro, fontWeight: 700 }}>{pos}</td>
                          <td style={{ padding: '6px 8px', fontSize: 13, color: '#e8f5e9' }}>{pts}</td>
                          <td style={{ padding: '6px 8px', fontSize: 13, color: '#7fb89a' }}>{bonus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
        🎾 Resenha BT — Londrina/PR
      </div>
    </div>
  )
}
