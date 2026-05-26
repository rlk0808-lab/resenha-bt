import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Confirmacao({ session }) {
  const [rodadaAtual, setRodadaAtual] = useState(null);
  const [jogador, setJogador] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [listaConfirmados, setListaConfirmados] = useState([]);
  const [listaEspera, setListaEspera] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const LIMITE_PRINCIPAL = 24;

  useEffect(() => {
    if (session?.user) carregarDados();
  }, [session]);

  async function carregarDados() {
    setLoading(true);
    await Promise.all([carregarJogador(), carregarProximaRodada()]);
    setLoading(false);
  }

  async function carregarJogador() {
    const { data } = await supabase
      .from("jogadores")
      .select("*")
      .eq("user_id", session.user.id)
      .limit(1);
    setJogador(data?.[0] || null);
    return data?.[0] || null;
  }

  async function carregarProximaRodada() {
    // Busca rodada ativa OU próxima
    const { data } = await supabase
      .from("rodadas")
      .select("*")
      .in("status", ["ativa", "proxima"])
      .order("numero", { ascending: true })
      .limit(1);

    const rodada = data?.[0] || null;
    if (rodada) {
      setRodadaAtual(rodada);
      await carregarConfirmacoes(rodada.id);
    }
    return rodada;
  }

  async function carregarConfirmacoes(rodadaId) {
    const { data } = await supabase
      .from("confirmacoes")
      .select("*, jogadores(nome, chave)")
      .eq("rodada_id", rodadaId)
      .order("created_at", { ascending: true });

    if (data) {
      setListaConfirmados(data.filter(c => c.status === "confirmado"));
      setListaEspera(data.filter(c => c.status === "espera"));

      if (session?.user) {
        const { data: jData } = await supabase
          .from("jogadores")
          .select("id")
          .eq("user_id", session.user.id)
          .limit(1);
        if (jData?.[0]) {
          const minhaConf = data.find(c => c.jogador_id === jData[0].id);
          setConfirmacao(minhaConf || null);
        }
      }
    }
  }

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
    setProcessando(true);

    const { data: existentes } = await supabase
      .from("confirmacoes")
      .select("*")
      .eq("jogador_id", jogador.id)
      .eq("rodada_id", rodadaAtual.id);

    if (existentes && existentes.length > 0) {
      mostrarMensagem("Você já está confirmado!", "info");
      setProcessando(false);
      return;
    }

    const agora = new Date();
    const dentroDoPrazo = agora.getDay() < 3 || (agora.getDay() === 3 && agora.getHours() < 10);
    const status = (listaConfirmados.length < LIMITE_PRINCIPAL && dentroDoPrazo) ? "confirmado" : "espera";

    const { error } = await supabase.from("confirmacoes").insert({
      jogador_id: jogador.id,
      rodada_id: rodadaAtual.id,
      status,
    });

    if (error) {
      mostrarMensagem("Erro ao confirmar: " + error.message, "erro");
    } else {
      mostrarMensagem(
        status === "confirmado" ? "✅ Presença confirmada!" : "⏳ Você entrou na lista de espera!",
        "sucesso"
      );
      await carregarConfirmacoes(rodadaAtual.id);
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
      }
      mostrarMensagem("Confirmação cancelada.", "info");
      setConfirmacao(null);
      await carregarConfirmacoes(rodadaAtual.id);
    }
    setProcessando(false);
  }

  function mostrarMensagem(texto, tipo = "sucesso") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 4000);
  }

  const status = statusConfirmacao();

  if (loading) return (
    <div style={styles.container}><p style={styles.loadingText}>Carregando...</p></div>
  );

  if (!jogador) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.emptyText}>Seu perfil ainda não está vinculado a um jogador. Entre em contato com o administrador.</p>
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
          <div style={styles.card}>
            <div style={styles.rodadaInfo}>
              <div>
                <div style={styles.rodadaLabel}>Próxima Rodada</div>
                <div style={styles.rodadaNumero}>Rodada {rodadaAtual.numero}</div>
                <div style={styles.rodadaData}>
                  📅 {new Date(rodadaAtual.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                </div>
              </div>
              <div style={styles.contadorBox}>
                <div style={styles.contadorNum}>{listaConfirmados.length}</div>
                <div style={styles.contadorLabel}>confirmados</div>
                <div style={styles.contadorMax}>de {LIMITE_PRINCIPAL}</div>
              </div>
            </div>
            <div style={styles.prazoBox}>
              <span style={styles.prazoIcon}>⏰</span>
              <span style={styles.prazoTexto}>Prazo para lista principal: <strong>Quarta-feira às 10h00</strong></span>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>Minha situação</h2>
            {!status ? (
              <div style={styles.semConfirmacao}>
                <div style={styles.semConfirmacaoIcon}>❓</div>
                <div style={styles.semConfirmacaoTexto}>Você ainda não confirmou presença</div>
                <button onClick={confirmarPresenca} disabled={processando} style={styles.btnConfirmar}>
                  {processando ? "Processando..." : "✅ Confirmar Presença"}
                </button>
              </div>
            ) : status.tipo === "confirmado" ? (
              <div style={styles.statusConfirmado}>
                <div style={styles.statusIcon}>✅</div>
                <div style={styles.statusTexto}><strong>Confirmado!</strong> Você está na lista principal</div>
                <div style={styles.statusPos}>#{status.pos} na lista</div>
                <button onClick={cancelarPresenca} disabled={processando} style={styles.btnCancelar}>
                  {processando ? "..." : "Cancelar confirmação"}
                </button>
              </div>
            ) : (
              <div style={styles.statusEspera}>
                <div style={styles.statusIcon}>⏳</div>
                <div style={styles.statusTexto}><strong>Lista de espera</strong> — Posição #{status.pos}</div>
                <div style={styles.statusInfo}>Você será notificado se uma vaga abrir</div>
                <button onClick={cancelarPresenca} disabled={processando} style={styles.btnCancelarEspera}>
                  {processando ? "..." : "Sair da lista de espera"}
                </button>
              </div>
            )}
          </div>

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
                    <span style={styles.listaHora}>{new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {listaEspera.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>⏳ Lista de Espera <span style={styles.badge}>{listaEspera.length}</span></h2>
              <div style={styles.lista}>
                {listaEspera.map((c, idx) => (
                  <div key={c.id} style={{ ...styles.listaItem, ...(c.jogador_id === jogador?.id ? styles.listaItemMeu : {}) }}>
                    <span style={styles.listaPos}>{idx + 1}º</span>
                    <span style={styles.listaNome}>{c.jogadores?.nome}</span>
                    <span style={styles.listaHora}>{new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={styles.card}>
          <p style={styles.emptyText}>Nenhuma rodada agendada no momento.</p>
        </div>
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
  cardTitulo: { margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#c8e6c9", display: "flex", alignItems: "center", gap: 8 },
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