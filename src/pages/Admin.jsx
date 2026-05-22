import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Admin({ session }) {
  const [rodadas, setRodadas] = useState([]);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(null);
  const [jogadores, setJogadores] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [chaveAtiva, setChaveAtiva] = useState("ouro");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Jogo em edição
  const [novoJogo, setNovoJogo] = useState({
    dupla_a_1: "",
    dupla_a_2: "",
    dupla_b_1: "",
    dupla_b_2: "",
    placar_a: "",
    placar_b: "",
    chave: "ouro",
  });

  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    carregarRodadas();
    carregarJogadores();
  }, []);

  useEffect(() => {
    if (rodadaSelecionada) carregarJogos();
  }, [rodadaSelecionada, chaveAtiva]);

  async function carregarRodadas() {
    const { data } = await supabase
      .from("rodadas")
      .select("*")
      .order("numero", { ascending: true });
    setRodadas(data || []);
    if (data && data.length > 0) setRodadaSelecionada(data[0]);
  }

  async function carregarJogadores() {
    const { data } = await supabase
      .from("jogadores")
      .select("*")
      .order("nome", { ascending: true });
    setJogadores(data || []);
  }

  async function carregarJogos() {
    setLoading(true);
    const { data } = await supabase
      .from("jogos")
      .select("*")
      .eq("rodada_id", rodadaSelecionada.id)
      .eq("chave", chaveAtiva)
      .order("created_at", { ascending: true });
    setJogos(data || []);
    setLoading(false);
  }

  function mostrarMensagem(texto, tipo = "sucesso") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  }

  async function salvarJogo() {
    if (
      !novoJogo.dupla_a_1 ||
      !novoJogo.dupla_b_1 ||
      novoJogo.placar_a === "" ||
      novoJogo.placar_b === ""
    ) {
      mostrarMensagem("Preencha ao menos os jogadores principais e o placar.", "erro");
      return;
    }

    setSalvando(true);

    const payload = {
      rodada_id: rodadaSelecionada.id,
      numero_rodada: rodadaSelecionada.numero,
      dupla_a_1: novoJogo.dupla_a_1,
      dupla_a_2: novoJogo.dupla_a_2 || null,
      dupla_b_1: novoJogo.dupla_b_1,
      dupla_b_2: novoJogo.dupla_b_2 || null,
      placar_a: parseInt(novoJogo.placar_a),
      placar_b: parseInt(novoJogo.placar_b),
      chave: chaveAtiva,
    };

    let erro;
    if (editandoId) {
      ({ error: erro } = await supabase.from("jogos").update(payload).eq("id", editandoId));
    } else {
      ({ error: erro } = await supabase.from("jogos").insert(payload));
    }

    if (erro) {
      mostrarMensagem("Erro ao salvar: " + erro.message, "erro");
    } else {
      mostrarMensagem(editandoId ? "Jogo atualizado!" : "Jogo inserido com sucesso!");
      resetForm();
      carregarJogos();
    }

    setSalvando(false);
  }

  async function excluirJogo(id) {
    if (!confirm("Confirmar exclusão deste jogo?")) return;
    const { error } = await supabase.from("jogos").delete().eq("id", id);
    if (error) {
      mostrarMensagem("Erro ao excluir.", "erro");
    } else {
      mostrarMensagem("Jogo excluído.");
      carregarJogos();
    }
  }

  function editarJogo(jogo) {
    setEditandoId(jogo.id);
    setNovoJogo({
      dupla_a_1: jogo.dupla_a_1 || "",
      dupla_a_2: jogo.dupla_a_2 || "",
      dupla_b_1: jogo.dupla_b_1 || "",
      dupla_b_2: jogo.dupla_b_2 || "",
      placar_a: jogo.placar_a ?? "",
      placar_b: jogo.placar_b ?? "",
      chave: jogo.chave,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setNovoJogo({
      dupla_a_1: "",
      dupla_a_2: "",
      dupla_b_1: "",
      dupla_b_2: "",
      placar_a: "",
      placar_b: "",
      chave: chaveAtiva,
    });
    setEditandoId(null);
  }

  const jogadoresDaChave = jogadores.filter((j) => j.chave === chaveAtiva);

  const SelectJogador = ({ value, onChange, placeholder }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.select}
    >
      <option value="">{placeholder || "— selecionar —"}</option>
      {jogadores.map((j) => (
        <option key={j.id} value={j.nome}>
          {j.nome} ({j.chave})
        </option>
      ))}
    </select>
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>⚙️</div>
        <div>
          <h1 style={styles.titulo}>Painel Admin</h1>
          <p style={styles.subtitulo}>Inserir resultados dos jogos</p>
        </div>
      </div>

      {/* Mensagem feedback */}
      {mensagem && (
        <div
          style={{
            ...styles.mensagem,
            background: mensagem.tipo === "erro" ? "#c0392b" : "#27ae60",
          }}
        >
          {mensagem.tipo === "erro" ? "❌" : "✅"} {mensagem.texto}
        </div>
      )}

      {/* Seletor de Rodada */}
      <div style={styles.card}>
        <label style={styles.label}>Rodada</label>
        <div style={styles.rodadasRow}>
          {rodadas.map((r) => (
            <button
              key={r.id}
              onClick={() => setRodadaSelecionada(r)}
              style={{
                ...styles.btnRodada,
                ...(rodadaSelecionada?.id === r.id ? styles.btnRodadaAtivo : {}),
              }}
            >
              R{r.numero}
              <span style={styles.rodadaData}>
                {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de Chave */}
      <div style={styles.chaveRow}>
        <button
          onClick={() => setChaveAtiva("ouro")}
          style={{
            ...styles.btnChave,
            ...(chaveAtiva === "ouro" ? styles.btnOuroAtivo : styles.btnChaveInativo),
          }}
        >
          🥇 Chave Ouro
        </button>
        <button
          onClick={() => setChaveAtiva("prata")}
          style={{
            ...styles.btnChave,
            ...(chaveAtiva === "prata" ? styles.btnPrataAtivo : styles.btnChaveInativo),
          }}
        >
          🥈 Chave Prata
        </button>
      </div>

      {/* Formulário */}
      <div style={styles.card}>
        <h2 style={styles.cardTitulo}>
          {editandoId ? "✏️ Editando jogo" : "➕ Novo jogo"}
          {rodadaSelecionada && (
            <span style={styles.badgeRodada}>
              Rodada {rodadaSelecionada.numero} — {chaveAtiva}
            </span>
          )}
        </h2>

        {/* Dupla A */}
        <div style={styles.duplaSection}>
          <div style={styles.duplaLabel}>🎾 Dupla A</div>
          <div style={styles.duplaInputs}>
            <SelectJogador
              value={novoJogo.dupla_a_1}
              onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_1: v })}
              placeholder="Jogador 1"
            />
            <SelectJogador
              value={novoJogo.dupla_a_2}
              onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_2: v })}
              placeholder="Jogador 2 (opcional)"
            />
          </div>
        </div>

        {/* Placar */}
        <div style={styles.placarSection}>
          <input
            type="number"
            min="0"
            max="7"
            placeholder="0"
            value={novoJogo.placar_a}
            onChange={(e) => setNovoJogo({ ...novoJogo, placar_a: e.target.value })}
            style={styles.placarInput}
          />
          <span style={styles.placarVs}>×</span>
          <input
            type="number"
            min="0"
            max="7"
            placeholder="0"
            value={novoJogo.placar_b}
            onChange={(e) => setNovoJogo({ ...novoJogo, placar_b: e.target.value })}
            style={styles.placarInput}
          />
        </div>

        {/* Dupla B */}
        <div style={styles.duplaSection}>
          <div style={styles.duplaLabel}>🎾 Dupla B</div>
          <div style={styles.duplaInputs}>
            <SelectJogador
              value={novoJogo.dupla_b_1}
              onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_1: v })}
              placeholder="Jogador 1"
            />
            <SelectJogador
              value={novoJogo.dupla_b_2}
              onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_2: v })}
              placeholder="Jogador 2 (opcional)"
            />
          </div>
        </div>

        {/* Botões */}
        <div style={styles.botoesForm}>
          <button
            onClick={salvarJogo}
            disabled={salvando}
            style={styles.btnSalvar}
          >
            {salvando ? "Salvando..." : editandoId ? "💾 Atualizar" : "💾 Salvar Jogo"}
          </button>
          {editandoId && (
            <button onClick={resetForm} style={styles.btnCancelar}>
              ✕ Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista de jogos */}
      <div style={styles.card}>
        <h2 style={styles.cardTitulo}>
          📋 Jogos inseridos
          <span style={styles.badgeCount}>{jogos.length} jogos</span>
        </h2>

        {loading ? (
          <p style={styles.loadingText}>Carregando...</p>
        ) : jogos.length === 0 ? (
          <p style={styles.emptyText}>Nenhum jogo inserido ainda para esta rodada/chave.</p>
        ) : (
          <div style={styles.jogosList}>
            {jogos.map((jogo, idx) => {
              const venceuA = jogo.placar_a > jogo.placar_b;
              return (
                <div key={jogo.id} style={styles.jogoCard}>
                  <div style={styles.jogoNumero}>{idx + 1}</div>
                  <div style={styles.jogoConteudo}>
                    <div style={{ ...styles.dupla, ...(venceuA ? styles.vencedor : {}) }}>
                      {jogo.dupla_a_1}{jogo.dupla_a_2 ? ` / ${jogo.dupla_a_2}` : ""}
                    </div>
                    <div style={styles.placarDisplay}>
                      <span style={venceuA ? styles.placarVencedor : styles.placarPerdedor}>
                        {jogo.placar_a}
                      </span>
                      <span style={styles.placarSep}>×</span>
                      <span style={!venceuA ? styles.placarVencedor : styles.placarPerdedor}>
                        {jogo.placar_b}
                      </span>
                    </div>
                    <div style={{ ...styles.dupla, ...(!venceuA ? styles.vencedor : {}), textAlign: "right" }}>
                      {jogo.dupla_b_1}{jogo.dupla_b_2 ? ` / ${jogo.dupla_b_2}` : ""}
                    </div>
                  </div>
                  <div style={styles.jogoAcoes}>
                    <button onClick={() => editarJogo(jogo)} style={styles.btnEdit}>✏️</button>
                    <button onClick={() => excluirJogo(jogo.id)} style={styles.btnDel}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const verde = "#1a4a2e";
const ouro = "#c9a227";
const prata = "#8e9eab";
const bg = "#0f2d1e";
const cardBg = "#162f20";
const borda = "#2a5a3a";

const styles = {
  container: {
    minHeight: "100vh",
    background: bg,
    padding: "20px 16px 100px",
    fontFamily: "'Segoe UI', sans-serif",
    color: "#e8f5e9",
    maxWidth: 600,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: `1px solid ${borda}`,
  },
  headerIcon: { fontSize: 32 },
  titulo: { margin: 0, fontSize: 22, fontWeight: 700, color: ouro },
  subtitulo: { margin: 0, fontSize: 13, color: "#7fb89a", marginTop: 2 },
  mensagem: {
    padding: "10px 16px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
  },
  card: {
    background: cardBg,
    border: `1px solid ${borda}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitulo: {
    margin: "0 0 14px",
    fontSize: 15,
    fontWeight: 700,
    color: "#c8e6c9",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  label: { fontSize: 12, color: "#7fb89a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" },
  rodadasRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  btnRodada: {
    background: "transparent",
    border: `1px solid ${borda}`,
    borderRadius: 8,
    color: "#9dbfac",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    transition: "all 0.2s",
  },
  btnRodadaAtivo: {
    background: verde,
    border: `1px solid ${ouro}`,
    color: ouro,
    fontWeight: 700,
  },
  rodadaData: { fontSize: 10, opacity: 0.7 },
  chaveRow: { display: "flex", gap: 10, marginBottom: 16 },
  btnChave: {
    flex: 1,
    padding: "10px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
    transition: "all 0.2s",
  },
  btnOuroAtivo: { background: ouro, color: "#0f2d1e" },
  btnPrataAtivo: { background: prata, color: "#0f2d1e" },
  btnChaveInativo: { background: "#1e3d2a", color: "#5a8a6a", border: `1px solid ${borda}` },
  duplaSection: { marginBottom: 10 },
  duplaLabel: { fontSize: 12, color: "#7fb89a", marginBottom: 6, fontWeight: 600 },
  duplaInputs: { display: "flex", gap: 8, flexWrap: "wrap" },
  select: {
    flex: 1,
    minWidth: 140,
    background: "#0f2d1e",
    border: `1px solid ${borda}`,
    borderRadius: 8,
    color: "#e8f5e9",
    padding: "8px 10px",
    fontSize: 13,
    cursor: "pointer",
  },
  placarSection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    margin: "14px 0",
  },
  placarInput: {
    width: 64,
    background: "#0f2d1e",
    border: `2px solid ${ouro}`,
    borderRadius: 10,
    color: ouro,
    fontSize: 28,
    fontWeight: 700,
    textAlign: "center",
    padding: "6px 0",
  },
  placarVs: { fontSize: 20, color: "#5a8a6a", fontWeight: 700 },
  botoesForm: { display: "flex", gap: 10, marginTop: 16 },
  btnSalvar: {
    flex: 1,
    background: ouro,
    color: "#0f2d1e",
    border: "none",
    borderRadius: 10,
    padding: "12px 0",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  btnCancelar: {
    background: "transparent",
    border: `1px solid #c0392b`,
    color: "#e74c3c",
    borderRadius: 10,
    padding: "12px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  loadingText: { color: "#7fb89a", textAlign: "center", padding: 20 },
  emptyText: { color: "#5a8a6a", textAlign: "center", padding: 20, fontSize: 14 },
  badgeRodada: {
    background: "#1e3d2a",
    border: `1px solid ${borda}`,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    color: "#7fb89a",
    fontWeight: 400,
  },
  badgeCount: {
    background: "#1e3d2a",
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    color: "#7fb89a",
    fontWeight: 400,
  },
  jogosList: { display: "flex", flexDirection: "column", gap: 8 },
  jogoCard: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#0f2d1e",
    border: `1px solid ${borda}`,
    borderRadius: 10,
    padding: "10px 12px",
  },
  jogoNumero: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: borda,
    color: "#7fb89a",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontWeight: 700,
  },
  jogoConteudo: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  dupla: { flex: 1, fontSize: 12, color: "#9dbfac", minWidth: 80 },
  vencedor: { color: ouro, fontWeight: 700 },
  placarDisplay: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  placarVencedor: { fontSize: 16, fontWeight: 700, color: ouro },
  placarPerdedor: { fontSize: 16, fontWeight: 700, color: "#5a8a6a" },
  placarSep: { fontSize: 12, color: "#3a6a4a" },
  jogoAcoes: { display: "flex", gap: 4, flexShrink: 0 },
  btnEdit: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "2px 4px",
  },
  btnDel: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "2px 4px",
  },
};
