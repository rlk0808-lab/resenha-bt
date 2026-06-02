import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Confirmacao({ session }) {
  const [rodadaAtual, setRodadaAtual] = useState(null);
  const [jogador, setJogador] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [listaConfirmados, setListaConfirmados] = useState([]);
  const [listaEspera, setListaEspera] = useState([]);
  const [rankingAnterior, setRankingAnterior] = useState({ ouro: [], prata: [] });
  const [previaChaves, setPreviaChaves] = useState({ ouro: [], prata: [] });
  const [jogouUltimaRodada, setJogouUltimaRodada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const LIMITE_PRINCIPAL = 24;

  useEffect(() => { if (session?.user) carregarDados(); }, [session]);

  async function carregarDados() {
    setLoading(true);
    const jog = await carregarJogador();
    await carregarProximaRodada(jog);
    setLoading(false);
  }

  async function carregarJogador() {
    const { data } = await supabase.from("jogadores").select("*").eq("user_id", session.user.id).limit(1);
    const jog = data?.[0] || null;
    setJogador(jog);
    return jog;
  }

  async function carregarProximaRodada(jog) {
    const { data } = await supabase.from("rodadas").select("*")
      .in("status", ["ativa", "proxima"]).order("numero", { ascending: true }).limit(1);
    const rodada = data?.[0] || null;
    if (!rodada) return;
    setRodadaAtual(rodada);

    // Rodada anterior finalizada
    const { data: anterior } = await supabase.from("rodadas").select("*")
      .eq("status", "finalizada").order("numero", { ascending: false }).limit(1);
    const rodAnt = anterior?.[0] || null;

    if (rodAnt) {
      const { data: rank } = await supabase.from("ranking_rodada")
        .select("*, jogadores(id, nome, chave)").eq("rodada_id", rodAnt.id)
        .order("posicao", { ascending: true });
      if (rank) {
        setRankingAnterior({
          ouro: rank.filter(r => r.chave === "ouro"),
          prata: rank.filter(r => r.chave === "prata"),
        });
      }

      // Verifica se jogador jogou a última rodada
      if (jog) {
        const { data: rankJog } = await supabase.from("ranking_rodada").select("id")
          .eq("rodada_id", rodAnt.id).eq("jogador_id", jog.id).limit(1);
        setJogouUltimaRodada(!!(rankJog && rankJog.length > 0));
      }
    } else {
      setJogouUltimaRodada(true); // Primeira rodada: todos podem confirmar
    }

    await carregarConfirmacoes(rodada.id, jog);
  }

  async function carregarConfirmacoes(rodadaId, jog) {
    const { data } = await supabase.from("confirmacoes")
      .select("*, jogadores(id, nome, chave)")
      .eq("rodada_id", rodadaId).order("created_at", { ascending: true });
    if (data) {
      setListaConfirmados(data.filter(c => c.status === "confirmado"));
      setListaEspera(data.filter(c => c.status === "espera"));
      const jogadorId = jog?.id;
      if (jogadorId) {
        const minhaConf = data.find(c => c.jogador_id === jogadorId);
        setConfirmacao(minhaConf || null);
      }
    }
  }

  function listaFechada() { return rodadaAtual?.status === "ativa"; }

  function dentroDoPrazoListaPrincipal() {
    const agora = new Date();
    const dia = agora.getDay();
    const hora = agora.getHours();
    if (dia < 3) return true;
    if (dia === 3 && hora < 10) return true;
    return false;
  }

  // ─── CÁLCULO DE PRÉVIA ───────────────────────────────────────────────────
  // Regras:
  // - 3 últimos da Ouro descem
  // - 3 primeiros da Prata sobem (em condições normais)
  // - Se jogadores da Ouro faltam: sobem mais da Prata (4º, 5º, 6º...)
  // - A partir do 6º faltante da Ouro: 10º, 11º, 12º se mantêm (não descem)
  // - Celso (e outros que desceram) ficam na Prata até a prévia
  function calcularPrevia(confirmados, rankingAnt) {
    if (!rankingAnt.ouro.length && !rankingAnt.prata.length) {
      return {
        ouro: confirmados.filter(c => c.jogadores?.chave === "ouro").map(c => ({ nome: c.jogadores?.nome, status: "normal" })),
        prata: confirmados.filter(c => c.jogadores?.chave === "prata").map(c => ({ nome: c.jogadores?.nome, status: "normal" })),
      };
    }

    const nomeConfirmados = new Set(confirmados.map(c => c.jogadores?.nome));

    // Os 3 que descem (10º, 11º, 12º da Ouro anterior)
    const ouroDescem = rankingAnt.ouro.slice(-3).map(r => r.jogadores?.nome);

    // Jogadores da Ouro que ficam (1º ao 9º que confirmaram)
    const ouroFicam = rankingAnt.ouro
      .filter(r => !ouroDescem.includes(r.jogadores?.nome) && nomeConfirmados.has(r.jogadores?.nome))
      .map(r => ({ nome: r.jogadores?.nome, status: "normal" }));

    // Quantos da Ouro efetiva (1º-9º) faltaram
    const ouroEfetivos = rankingAnt.ouro.filter(r => !ouroDescem.includes(r.jogadores?.nome));
    const ouroFaltaram = ouroEfetivos.filter(r => !nomeConfirmados.has(r.jogadores?.nome));
    const qtdFaltasEfetivas = ouroFaltaram.length;

    // Jogadores que desceram mas confirmaram → ficam na Prata (marcados como "desceu")
    // Não voltam para Ouro a não ser que sejam chamados pela fila da Prata

    // Quantos precisam subir da Prata: 3 (normais) + faltas dos efetivos
    let totalSubir = 3 + qtdFaltasEfetivas;

    // Regra especial: a partir do 6º faltante da efetiva (posições 10-12 se mantêm)
    const ouroMantem = [];
    if (qtdFaltasEfetivas >= 4) {
      const pos10 = rankingAnt.ouro.find(r => r.posicao === 10);
      if (pos10 && nomeConfirmados.has(pos10.jogadores?.nome)) {
        ouroMantem.push({ nome: pos10.jogadores?.nome, status: "mantido" });
        totalSubir--;
      }
    }
    if (qtdFaltasEfetivas >= 5) {
      const pos11 = rankingAnt.ouro.find(r => r.posicao === 11);
      if (pos11 && nomeConfirmados.has(pos11.jogadores?.nome)) {
        ouroMantem.push({ nome: pos11.jogadores?.nome, status: "mantido" });
        totalSubir--;
      }
    }
    if (qtdFaltasEfetivas >= 6) {
      const pos12 = rankingAnt.ouro.find(r => r.posicao === 12);
      if (pos12 && nomeConfirmados.has(pos12.jogadores?.nome)) {
        ouroMantem.push({ nome: pos12.jogadores?.nome, status: "mantido" });
        totalSubir--;
      }
    }

    // Jogadores da Prata que podem subir (ordenados por posição na Prata anterior)
    // Inclui os que desceram da Ouro (eles entram na fila da Prata pela posição)
    const prataTodos = rankingAnt.prata
      .filter(r => nomeConfirmados.has(r.jogadores?.nome))
      .sort((a, b) => a.posicao - b.posicao);

    // Jogadores que desceram da Ouro e confirmaram (entram no final da fila da Prata)
    const desceuOuroConfirmou = ouroDescem
      .filter(nome => nomeConfirmados.has(nome))
      .map(nome => ({ nome, status: "desceu" }));

    // Sobe: primeiros da Prata até totalSubir (excluindo os que desceram)
    const prataSobem = prataTodos
      .slice(0, totalSubir)
      .map(r => ({ nome: r.jogadores?.nome, status: "subiu" }));

    const ouroFinal = [...ouroFicam, ...ouroMantem, ...prataSobem].slice(0, 12);
    const nomesOuro = new Set(ouroFinal.map(j => j.nome));

    // Prata: quem não foi para Ouro
    const prataFinal = [
      ...prataTodos.slice(totalSubir).map(r => ({ nome: r.jogadores?.nome, status: "normal" })),
      ...desceuOuroConfirmou,
      // Confirmados que não estão no ranking anterior (estreantes ou retornando)
      ...confirmados
        .filter(c => !nomesOuro.has(c.jogadores?.nome) &&
          !prataTodos.some(r => r.jogadores?.nome === c.jogadores?.nome) &&
          !desceuOuroConfirmou.some(d => d.nome === c.jogadores?.nome))
        .map(c => ({ nome: c.jogadores?.nome, status: "normal" }))
    ];

    return { ouro: ouroFinal, prata: prataFinal };
  }

  useEffect(() => {
    if (listaConfirmados.length > 0 || rankingAnterior.ouro.length > 0) {
      setPreviaChaves(calcularPrevia(listaConfirmados, rankingAnterior));
    }
  }, [listaConfirmados, rankingAnterior]);

  function statusConfirmacao() {
    if (!confirmacao) return null;
    if (confirmacao.status === "confirmado") {
      const pos = listaConfirmados.findIndex(c => c.id === confirmacao.id) + 1;
      return { tipo: "confirmado", pos };
    }
    if (confirmacao.status === "espera") {
      const pos = listaEspera.findIndex(c => c.id === confirmacao.id) + 1;
      return { tipo: "espera", pos };
    }
    return null;
  }

  async function confirmarPresenca() {
    if (!jogador || !rodadaAtual) return;
    if (listaFechada()) { mostrarMensagem("Lista encerrada. O sorteio já foi publicado.", "info"); return; }
    setProcessando(true);

    const { data: existentes } = await supabase.from("confirmacoes").select("*")
      .eq("jogador_id", jogador.id).eq("rodada_id", rodadaAtual.id);
    if (existentes && existentes.length > 0) {
      mostrarMensagem("Você já está confirmado!", "info"); setProcessando(false); return;
    }

    const dentroPrazo = dentroDoPrazoListaPrincipal();

    // REGRA: quem não jogou a última rodada → sempre espera
    let status;
    if (!jogouUltimaRodada) {
      status = "espera";
    } else if (listaConfirmados.length < LIMITE_PRINCIPAL && dentroPrazo) {
      status = "confirmado";
    } else {
      status = "espera";
    }

    const { error } = await supabase.from("confirmacoes").insert({
      jogador_id: jogador.id, rodada_id: rodadaAtual.id, status,
    });

    if (error) {
      mostrarMensagem("Erro ao confirmar: " + error.message, "erro");
    } else {
      if (status === "confirmado") mostrarMensagem("✅ Presença confirmada na lista principal!");
      else if (!jogouUltimaRodada) mostrarMensagem("⏳ Você não jogou a última rodada. Entrou na lista de espera.", "info");
      else mostrarMensagem("⏳ Prazo encerrado. Você entrou na lista de espera.");
      await carregarConfirmacoes(rodadaAtual.id, jogador);
    }
    setProcessando(false);
  }

  async function cancelarPresenca() {
    if (!confirmacao) return;
    if (!confirm("Deseja cancelar sua confirmação?")) return;
    setProcessando(true);
    const eraConfirmado = confirmacao.status === "confirmado";
    const { error } = await supabase.from("confirmacoes").delete().eq("id", confirmacao.id);
    if (error) {
      mostrarMensagem("Erro ao cancelar: " + error.message, "erro");
    } else {
      if (eraConfirmado && listaEspera.length > 0) {
        await supabase.from("confirmacoes").update({ status: "confirmado" }).eq("id", listaEspera[0].id);
        mostrarMensagem("Confirmação cancelada. O próximo da espera foi promovido.", "info");
      } else {
        mostrarMensagem("Confirmação cancelada.", "info");
      }
      setConfirmacao(null);
      await carregarConfirmacoes(rodadaAtual.id, jogador);
    }
    setProcessando(false);
  }

  function mostrarMensagem(texto, tipo = "sucesso") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 5000);
  }

  function formatarDataHora(iso) {
    const d = new Date(iso);
    const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    return `${data} ${hora}`;
  }

  function corStatus(status) {
    if (status === "subiu") return "#2d7a45";
    if (status === "desceu") return "#c0392b";
    if (status === "mantido") return "#e8621a";
    return "#e8f5e9";
  }

  function iconStatus(status) {
    if (status === "subiu") return "↑";
    if (status === "desceu") return "↓";
    if (status === "mantido") return "=";
    return "";
  }

  const status = statusConfirmacao();
  const vagasOuro = Math.max(0, 12 - previaChaves.ouro.length);
  const vagasPrata = Math.max(0, 12 - previaChaves.prata.length);
  const fechada = listaFechada();
  const dentroPrazo = dentroDoPrazoListaPrincipal();

  if (loading) return <div style={styles.container}><p style={styles.loadingText}>Carregando...</p></div>;

  if (!jogador) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.emptyText}>Seu perfil ainda não está vinculado. Entre em contato com o administrador.</p>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIcon}>📋</div>
        <div>
          <h1 style={styles.titulo}>Confirmação</h1>
          <p style={styles.subtitulo}>Gerencie sua presença na próxima rodada</p>
        </div>
      </div>

      {mensagem && (
        <div style={{ ...styles.mensagem, background: mensagem.tipo === "erro" ? "#c0392b" : mensagem.tipo === "info" ? "#2980b9" : "#27ae60" }}>
          {mensagem.texto}
        </div>
      )}

      {rodadaAtual ? (
        <>
          {/* ── INFO DA RODADA ── */}
          <div style={styles.card}>
            <div style={styles.rodadaInfo}>
              <div>
                <div style={styles.rodadaLabel}>Próxima Rodada</div>
                <div style={styles.rodadaNumero}>Rodada {rodadaAtual.numero}</div>
                <div style={styles.rodadaData}>
                  📅 {new Date(rodadaAtual.data + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo"
                  })}
                </div>
              </div>
              <div style={styles.contadorBox}>
                <div style={styles.contadorNum}>{listaConfirmados.length}</div>
                <div style={styles.contadorLabel}>confirmados</div>
                <div style={styles.contadorMax}>de {LIMITE_PRINCIPAL}</div>
              </div>
            </div>

            {fechada ? (
              <div style={{ ...styles.prazoBox, background: "#1a3a20", borderColor: "#2ecc71" }}>
                <span style={styles.prazoIcon}>✅</span>
                <span style={styles.prazoTexto}>Lista encerrada — <strong style={{ color: "#2ecc71" }}>sorteio publicado</strong></span>
              </div>
            ) : dentroPrazo ? (
              <div style={styles.prazoBox}>
                <span style={styles.prazoIcon}>⏰</span>
                <span style={styles.prazoTexto}>Prazo para lista principal: <strong>Quarta-feira às 10h</strong></span>
              </div>
            ) : (
              <div style={{ ...styles.prazoBox, background: "#3a2000", borderColor: "#c9a227" }}>
                <span style={styles.prazoIcon}>⚠️</span>
                <span style={styles.prazoTexto}>Prazo encerrado — novas confirmações vão para <strong style={{ color: "#c9a227" }}>lista de espera</strong></span>
              </div>
            )}

            {!fechada && jogouUltimaRodada === false && !status && (
              <div style={{ ...styles.prazoBox, background: "#1a2a3a", borderColor: "#4a8ab5", marginTop: 8 }}>
                <span style={styles.prazoIcon}>ℹ️</span>
                <span style={styles.prazoTexto}>Você não jogou a última rodada — sua confirmação irá para a <strong style={{ color: "#4a9ad4" }}>lista de espera</strong></span>
              </div>
            )}
          </div>

          {/* ── MINHA SITUAÇÃO ── */}
          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>Minha situação</h2>
            {fechada ? (
              <div style={styles.listaEncerrada}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                <div style={{ fontSize: 15, color: "#c8e6c9", fontWeight: 700, marginBottom: 4 }}>Lista encerrada</div>
                <div style={{ fontSize: 13, color: "#7fb89a", textAlign: "center" }}>O sorteio foi publicado. Veja os jogos na aba Rodada.</div>
                {status?.tipo === "confirmado" && <div style={{ marginTop: 12, background: "#1a3a20", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#2ecc71", fontWeight: 700 }}>✅ Você está confirmado — #{status.pos} na lista</div>}
                {status?.tipo === "espera" && <div style={{ marginTop: 12, background: "#3a2000", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#c9a227" }}>⏳ Você está na lista de espera — #{status.pos}º</div>}
                {!status && <div style={{ marginTop: 12, background: "#1e3d2a", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#5a8a6a" }}>Você não confirmou presença para esta rodada.</div>}
              </div>
            ) : !status ? (
              <div style={styles.semConfirmacao}>
                <div style={styles.semConfirmacaoIcon}>❓</div>
                <div style={styles.semConfirmacaoTexto}>Você ainda não confirmou presença</div>
                {!dentroPrazo && <div style={{ fontSize: 12, color: "#c9a227", background: "#3a2000", borderRadius: 8, padding: "6px 12px", marginBottom: 4, textAlign: "center" }}>⚠️ Prazo encerrado — você entrará na lista de espera</div>}
                {jogouUltimaRodada === false && dentroPrazo && <div style={{ fontSize: 12, color: "#4a9ad4", background: "#1a2a3a", borderRadius: 8, padding: "6px 12px", marginBottom: 4, textAlign: "center" }}>ℹ️ Você não jogou a última rodada — entrará na lista de espera</div>}
                <button onClick={confirmarPresenca} disabled={processando} style={styles.btnConfirmar}>
                  {processando ? "Processando..." : (!jogouUltimaRodada || !dentroPrazo) ? "⏳ Entrar na Lista de Espera" : "✅ Confirmar Presença"}
                </button>
              </div>
            ) : status.tipo === "confirmado" ? (
              <div style={styles.statusConfirmado}>
                <div style={styles.statusIcon}>✅</div>
                <div style={styles.statusTexto}><strong>Confirmado!</strong> Você está na lista principal</div>
                <div style={styles.statusPos}>#{status.pos} na lista</div>
                <button onClick={cancelarPresenca} disabled={processando} style={styles.btnCancelar}>{processando ? "..." : "Cancelar confirmação"}</button>
              </div>
            ) : (
              <div style={styles.statusEspera}>
                <div style={styles.statusIcon}>⏳</div>
                <div style={styles.statusTexto}><strong>Lista de espera</strong> — Posição #{status.pos}</div>
                <div style={styles.statusInfo}>Você será promovido automaticamente se uma vaga abrir</div>
                <button onClick={cancelarPresenca} disabled={processando} style={styles.btnCancelarEspera}>{processando ? "..." : "Sair da lista de espera"}</button>
              </div>
            )}
          </div>

          {/* ── PRÉVIA DAS CHAVES ── */}
          {!fechada && listaConfirmados.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>
                🔮 Prévia das Chaves
                <span style={{ fontSize: 11, color: "#5a8a6a", fontWeight: 400 }}>atualiza em tempo real</span>
              </h2>
              <p style={{ fontSize: 12, color: "#5a8a6a", marginBottom: 14 }}>↑ subiu &nbsp;↓ desceu &nbsp;= mantido por falta na Ouro</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ouro, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🥇 Ouro ({previaChaves.ouro.length}/12)</div>
                  {previaChaves.ouro.map((j, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", borderBottom: "1px solid #1e3d2a" }}>
                      <span style={{ fontSize: 10, color: "#5a8a6a", width: 16 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 12, color: corStatus(j.status), fontWeight: j.status !== "normal" ? 700 : 400 }}>{j.nome}</span>
                      {j.status !== "normal" && <span style={{ fontSize: 11, color: corStatus(j.status), fontWeight: 700 }}>{iconStatus(j.status)}</span>}
                    </div>
                  ))}
                  {vagasOuro > 0 && Array.from({ length: vagasOuro }).map((_, i) => (
                    <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1e3d2a" }}>
                      <span style={{ fontSize: 11, color: "#3a5a4a", fontStyle: "italic" }}>vaga aberta</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: prata, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🥈 Prata ({previaChaves.prata.length}/12)</div>
                  {previaChaves.prata.map((j, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", borderBottom: "1px solid #1e3d2a" }}>
                      <span style={{ fontSize: 10, color: "#5a8a6a", width: 16 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 12, color: corStatus(j.status), fontWeight: j.status !== "normal" ? 700 : 400 }}>{j.nome}</span>
                      {j.status !== "normal" && <span style={{ fontSize: 11, color: corStatus(j.status), fontWeight: 700 }}>{iconStatus(j.status)}</span>}
                    </div>
                  ))}
                  {vagasPrata > 0 && Array.from({ length: vagasPrata }).map((_, i) => (
                    <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1e3d2a" }}>
                      <span style={{ fontSize: 11, color: "#3a5a4a", fontStyle: "italic" }}>vaga aberta</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── LISTA PRINCIPAL ── */}
          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>
              ✅ Lista Principal
              <span style={styles.badge}>{listaConfirmados.length}/{LIMITE_PRINCIPAL}</span>
            </h2>
            {listaConfirmados.length === 0 ? (
              <p style={styles.emptyText}>Nenhum jogador confirmado ainda.</p>
            ) : (
              <div style={styles.lista}>
                {listaConfirmados.map((c, idx) => (
                  <div key={c.id} style={{ ...styles.listaItem, ...(c.jogador_id === jogador?.id ? styles.listaItemMeu : {}) }}>
                    <span style={styles.listaPos}>{idx + 1}</span>
                    <span style={styles.listaNome}>{c.jogadores?.nome}</span>
                    <span style={{ ...styles.listaChave, color: c.jogadores?.chave === "ouro" ? ouro : prata }}>{c.jogadores?.chave}</span>
                    <span style={styles.listaHora}>{formatarDataHora(c.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── LISTA DE ESPERA ── */}
          {listaEspera.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>⏳ Lista de Espera <span style={styles.badge}>{listaEspera.length}</span></h2>
              <div style={styles.lista}>
                {listaEspera.map((c, idx) => (
                  <div key={c.id} style={{ ...styles.listaItem, ...(c.jogador_id === jogador?.id ? styles.listaItemMeu : {}) }}>
                    <span style={styles.listaPos}>{idx + 1}º</span>
                    <span style={styles.listaNome}>{c.jogadores?.nome}</span>
                    <span style={styles.listaHora}>{formatarDataHora(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={styles.card}><p style={styles.emptyText}>Nenhuma rodada agendada no momento.</p></div>
      )}
    </div>
  );
}

const ouro = "#c9a227";
const prata = "#8e9eab";
const bg = "#0f2d1e";
const cardBg = "#162f20";
const borda = "#2a5a3a";

const styles = {
  container: { minHeight: "100vh", background: bg, padding: "20px 16px 100px", fontFamily: "'Segoe UI', sans-serif", color: "#e8f5e9", maxWidth: 600, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${borda}` },
  headerIcon: { fontSize: 32 },
  titulo: { margin: 0, fontSize: 22, fontWeight: 700, color: ouro },
  subtitulo: { margin: 0, fontSize: 13, color: "#7fb89a", marginTop: 2 },
  mensagem: { padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, color: "#fff" },
  card: { background: cardBg, border: `1px solid ${borda}`, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitulo: { margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#c8e6c9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: { background: "#1e3d2a", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#7fb89a", fontWeight: 400 },
  loadingText: { color: "#7fb89a", textAlign: "center", padding: 40 },
  emptyText: { color: "#5a8a6a", textAlign: "center", padding: 20, fontSize: 14 },
  rodadaInfo: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  rodadaLabel: { fontSize: 11, color: "#7fb89a", textTransform: "uppercase", letterSpacing: 1 },
  rodadaNumero: { fontSize: 20, fontWeight: 700, color: ouro, marginTop: 4 },
  rodadaData: { fontSize: 13, color: "#9dbfac", marginTop: 4 },
  contadorBox: { textAlign: "center", background: "#0f2d1e", borderRadius: 10, padding: "10px 16px", border: `1px solid ${borda}` },
  contadorNum: { fontSize: 28, fontWeight: 700, color: ouro },
  contadorLabel: { fontSize: 11, color: "#7fb89a" },
  contadorMax: { fontSize: 11, color: "#5a8a6a" },
  prazoBox: { background: "#0f2d1e", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${borda}` },
  prazoIcon: { fontSize: 16 },
  prazoTexto: { fontSize: 13, color: "#9dbfac" },
  listaEncerrada: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 0" },
  semConfirmacao: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "10px 0" },
  semConfirmacaoIcon: { fontSize: 32 },
  semConfirmacaoTexto: { fontSize: 14, color: "#7fb89a", textAlign: "center" },
  statusConfirmado: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 0" },
  statusEspera: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 0" },
  statusIcon: { fontSize: 32 },
  statusTexto: { fontSize: 15, color: "#c8e6c9", textAlign: "center" },
  statusPos: { fontSize: 13, color: ouro, fontWeight: 700 },
  statusInfo: { fontSize: 12, color: "#7fb89a", textAlign: "center" },
  btnConfirmar: { background: ouro, color: "#0f2d1e", border: "none", borderRadius: 10, padding: "12px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%", marginTop: 4 },
  btnCancelar: { background: "transparent", border: `1px solid #c0392b`, color: "#e74c3c", borderRadius: 8, padding: "8px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 4 },
  btnCancelarEspera: { background: "transparent", border: `1px solid #5a8a6a`, color: "#7fb89a", borderRadius: 8, padding: "8px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 4 },
  lista: { display: "flex", flexDirection: "column", gap: 6 },
  listaItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#0f2d1e", borderRadius: 8, border: `1px solid ${borda}` },
  listaItemMeu: { border: `1px solid ${ouro}`, background: "#1a3a20" },
  listaPos: { width: 24, fontSize: 12, color: "#7fb89a", fontWeight: 700, textAlign: "center" },
  listaNome: { flex: 1, fontSize: 13, color: "#e8f5e9", fontWeight: 500 },
  listaChave: { fontSize: 11, fontWeight: 600, textTransform: "uppercase" },
  listaHora: { fontSize: 11, color: "#5a8a6a" },
};
