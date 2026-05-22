import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const PONTOS_OURO = [25, 22, 20, 18, 16, 14, 12, 10, 8, 8, 8, 8];

// ─── ALGORITMO DE SORTEIO ────────────────────────────────────────────────────
function gerarSorteio(jogadores) {
  const n = jogadores.length;
  const todasDuplas = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      todasDuplas.push([jogadores[i], jogadores[j]]);

  const parceirosUsados = {};
  const adversariosContador = {};
  jogadores.forEach(j => { parceirosUsados[j] = new Set(); adversariosContador[j] = {}; });

  const rodadas = [];

  for (let r = 0; r < 4; r++) {
    let melhorRodada = null;
    let melhorScore = -Infinity;

    for (let t = 0; t < 3000; t++) {
      const duplasDisponiveis = todasDuplas
        .filter(([a, b]) => !parceirosUsados[a].has(b))
        .sort(() => Math.random() - 0.5);

      const usados = new Set();
      const jogosRodada = [];

      for (const [a1, a2] of duplasDisponiveis) {
        if (usados.has(a1) || usados.has(a2)) continue;
        for (const [b1, b2] of duplasDisponiveis) {
          if (usados.has(b1) || usados.has(b2)) continue;
          if (b1 === a1 || b1 === a2 || b2 === a1 || b2 === a2) continue;
          const repAdv =
            (adversariosContador[a1][b1] || 0) + (adversariosContador[a1][b2] || 0) +
            (adversariosContador[a2][b1] || 0) + (adversariosContador[a2][b2] || 0);
          jogosRodada.push({ jogo: [a1, a2, b1, b2], rep: repAdv });
          usados.add(a1); usados.add(a2); usados.add(b1); usados.add(b2);
          break;
        }
        if (usados.size === n) break;
      }

      if (usados.size === n) {
        const score = -jogosRodada.reduce((s, j) => s + j.rep, 0);
        if (score > melhorScore) {
          melhorScore = score;
          melhorRodada = jogosRodada.map(j => j.jogo);
        }
      }
    }

    if (!melhorRodada) return null;

    melhorRodada.forEach(([a1, a2, b1, b2]) => {
      parceirosUsados[a1].add(a2); parceirosUsados[a2].add(a1);
      parceirosUsados[b1].add(b2); parceirosUsados[b2].add(b1);
      [b1, b2].forEach(b => {
        adversariosContador[a1][b] = (adversariosContador[a1][b] || 0) + 1;
        adversariosContador[b][a1] = (adversariosContador[b][a1] || 0) + 1;
        adversariosContador[a2][b] = (adversariosContador[a2][b] || 0) + 1;
        adversariosContador[b][a2] = (adversariosContador[b][a2] || 0) + 1;
      });
    });

    rodadas.push(melhorRodada);
  }
  return rodadas;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function Admin({ session }) {
  const [rodadas, setRodadas] = useState([]);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(null);
  const [jogadores, setJogadores] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [chaveAtiva, setChaveAtiva] = useState("ouro");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [rankingPreview, setRankingPreview] = useState(null);
  const [sorteioPreview, setSorteioPreview] = useState(null);
  const [salvandoSorteio, setSalvandoSorteio] = useState(false);

  const [novoJogo, setNovoJogo] = useState({
    dupla_a_1: "", dupla_a_2: "", dupla_b_1: "", dupla_b_2: "", placar_a: "", placar_b: "",
  });
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => { carregarRodadas(); carregarJogadores(); }, []);
  useEffect(() => { if (rodadaSelecionada) carregarJogos(); }, [rodadaSelecionada, chaveAtiva]);

  async function carregarRodadas() {
    const { data } = await supabase.from("rodadas").select("*").order("numero", { ascending: true });
    setRodadas(data || []);
    if (data && data.length > 0) setRodadaSelecionada(data[0]);
  }

  async function carregarJogadores() {
    const { data } = await supabase.from("jogadores").select("*").order("nome", { ascending: true });
    setJogadores(data || []);
  }

  async function carregarJogos() {
    setLoading(true);
    setRankingPreview(null);
    const { data } = await supabase
      .from("jogos").select("*")
      .eq("rodada_id", rodadaSelecionada.id)
      .eq("chave", chaveAtiva)
      .order("created_at", { ascending: true });
    setJogos(data || []);
    setLoading(false);
  }

  function mostrarMensagem(texto, tipo = "sucesso") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 4000);
  }

  async function salvarJogo() {
    if (!novoJogo.dupla_a_1 || !novoJogo.dupla_b_1 || novoJogo.placar_a === "" || novoJogo.placar_b === "") {
      mostrarMensagem("Preencha jogadores e placar.", "erro"); return;
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
    if (erro) mostrarMensagem("Erro: " + erro.message, "erro");
    else { mostrarMensagem(editandoId ? "Jogo atualizado!" : "Jogo salvo!"); resetForm(); carregarJogos(); }
    setSalvando(false);
  }

  async function excluirJogo(id) {
    if (!confirm("Excluir este jogo?")) return;
    const { error } = await supabase.from("jogos").delete().eq("id", id);
    if (error) mostrarMensagem("Erro ao excluir.", "erro");
    else { mostrarMensagem("Jogo excluído."); carregarJogos(); }
  }

  function editarJogo(jogo) {
    setEditandoId(jogo.id);
    setNovoJogo({
      dupla_a_1: jogo.dupla_a_1 || "", dupla_a_2: jogo.dupla_a_2 || "",
      dupla_b_1: jogo.dupla_b_1 || "", dupla_b_2: jogo.dupla_b_2 || "",
      placar_a: jogo.placar_a ?? "", placar_b: jogo.placar_b ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setNovoJogo({ dupla_a_1: "", dupla_a_2: "", dupla_b_1: "", dupla_b_2: "", placar_a: "", placar_b: "" });
    setEditandoId(null);
  }

  // ─── SORTEIO ──────────────────────────────────────────────────────────────
  function gerarSorteioLocal() {
    const jogadoresChave = jogadores.filter(j => j.chave === chaveAtiva).map(j => j.nome);
    if (jogadoresChave.length < 4) {
      mostrarMensagem("Poucos jogadores cadastrados nesta chave.", "erro"); return;
    }
    const resultado = gerarSorteio(jogadoresChave);
    if (!resultado) {
      mostrarMensagem("Não foi possível gerar o sorteio. Tente novamente.", "erro"); return;
    }
    setSorteioPreview(resultado);
  }

  function regerarSorteio() {
    setSorteioPreview(null);
    setTimeout(() => gerarSorteioLocal(), 100);
  }

  async function salvarSorteio() {
    if (!sorteioPreview || !rodadaSelecionada) return;
    setSalvandoSorteio(true);

    // Remove jogos anteriores dessa chave/rodada sem placar
    await supabase.from("jogos")
      .delete()
      .eq("rodada_id", rodadaSelecionada.id)
      .eq("chave", chaveAtiva)
      .is("placar_a", null);

    const inserts = sorteioPreview.flatMap((rodadaJogos) =>
      rodadaJogos.map(([a1, a2, b1, b2]) => ({
        rodada_id: rodadaSelecionada.id,
        numero_rodada: rodadaSelecionada.numero,
        dupla_a_1: a1, dupla_a_2: a2,
        dupla_b_1: b1, dupla_b_2: b2,
        placar_a: null, placar_b: null,
        chave: chaveAtiva,
      }))
    );

    const { error } = await supabase.from("jogos").insert(inserts);
    if (error) mostrarMensagem("Erro ao salvar sorteio: " + error.message, "erro");
    else {
      mostrarMensagem("✅ Sorteio salvo! Insira os placares após os jogos.");
      setSorteioPreview(null);
      carregarJogos();
    }
    setSalvandoSorteio(false);
  }

  // ─── PONTUAÇÃO ────────────────────────────────────────────────────────────
  function calcularRankingLocal(jogosChave, chave) {
    const stats = {};
    const addJogador = (nome) => { if (nome && !stats[nome]) stats[nome] = { nome, pts: 0, vitorias: 0, saldo: 0 }; };

    for (const jogo of jogosChave) {
      if (jogo.placar_a === null || jogo.placar_b === null) continue;
      const { dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, placar_a, placar_b } = jogo;
      [dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2].forEach(addJogador);
      const jogadoresA = [dupla_a_1, dupla_a_2].filter(Boolean);
      const jogadoresB = [dupla_b_1, dupla_b_2].filter(Boolean);
      const venceuA = placar_a > placar_b;
      const saldo = Math.abs(placar_a - placar_b);
      const ptsVenc = 15 + saldo;
      const ptsPerd = venceuA ? placar_b : placar_a;
      const vencedores = venceuA ? jogadoresA : jogadoresB;
      const perdedores = venceuA ? jogadoresB : jogadoresA;
      vencedores.forEach(n => { stats[n].pts += ptsVenc; stats[n].vitorias += 1; stats[n].saldo += saldo; });
      perdedores.forEach(n => { stats[n].pts += ptsPerd; stats[n].saldo -= saldo; });
    }

    const ranking = Object.values(stats).sort((a, b) => b.pts - a.pts || b.saldo - a.saldo);
    const ehEspecial = rodadaSelecionada?.tipo === "especial";

    ranking.forEach((j, idx) => {
      const ptosFixos = chave === "ouro" ? (PONTOS_OURO[idx] || 8) : 8;
      const bonusVitorias = j.vitorias * 3;
      const bonusCampeao = (chave === "prata" && idx === 0 && !ehEspecial) ? 3 : 0;
      j.ptosLiga = ptosFixos + bonusVitorias + bonusCampeao;
      j.posicao = idx + 1;
    });
    return ranking;
  }

  async function calcularPontuacao() {
    if (!rodadaSelecionada) return;
    setCalculando(true);
    const { data: todosJogos, error } = await supabase.from("jogos").select("*").eq("rodada_id", rodadaSelecionada.id);
    if (error) { mostrarMensagem("Erro ao buscar jogos.", "erro"); setCalculando(false); return; }
    const rankingOuro = calcularRankingLocal(todosJogos.filter(j => j.chave === "ouro"), "ouro");
    const rankingPrata = calcularRankingLocal(todosJogos.filter(j => j.chave === "prata"), "prata");
    setRankingPreview({ ouro: rankingOuro, prata: rankingPrata });
    setCalculando(false);
  }

  async function salvarPontuacao() {
    if (!rankingPreview) return;
    setCalculando(true);
    const todos = [...rankingPreview.ouro, ...rankingPreview.prata];
    const erros = [];
    for (const j of todos) {
      const jogador = jogadores.find(jg => jg.nome === j.nome);
      if (!jogador) { erros.push(`Não encontrado: ${j.nome}`); continue; }
      const { data: existente } = await supabase.from("pontuacao").select("id")
        .eq("jogador_id", jogador.id).eq("rodada_id", rodadaSelecionada.id).single().catch(() => ({ data: null }));
      if (existente) {
        const { error } = await supabase.from("pontuacao").update({ pontos: j.ptosLiga, vitorias: j.vitorias }).eq("id", existente.id);
        if (error) erros.push(error.message);
      } else {
        const { error } = await supabase.from("pontuacao").insert({ jogador_id: jogador.id, rodada_id: rodadaSelecionada.id, pontos: j.ptosLiga, vitorias: j.vitorias });
        if (error) erros.push(error.message);
      }
    }
    if (erros.length > 0) mostrarMensagem("Erros: " + erros.join(", "), "erro");
    else { mostrarMensagem("✅ Pontuação salva!"); setRankingPreview(null); }
    setCalculando(false);
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const SelectJogador = ({ value, onChange, placeholder }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
      <option value="">{placeholder || "— selecionar —"}</option>
      {jogadores.map((j) => <option key={j.id} value={j.nome}>{j.nome} ({j.chave})</option>)}
    </select>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIcon}>⚙️</div>
        <div>
          <h1 style={styles.titulo}>Painel Admin</h1>
          <p style={styles.subtitulo}>Sorteio, resultados e pontuação</p>
        </div>
      </div>

      {mensagem && (
        <div style={{ ...styles.mensagem, background: mensagem.tipo === "erro" ? "#c0392b" : "#27ae60" }}>
          {mensagem.texto}
        </div>
      )}

      {/* Seletor Rodada */}
      <div style={styles.card}>
        <label style={styles.label}>Rodada</label>
        <div style={styles.rodadasRow}>
          {rodadas.map((r) => (
            <button key={r.id} onClick={() => setRodadaSelecionada(r)}
              style={{ ...styles.btnRodada, ...(rodadaSelecionada?.id === r.id ? styles.btnRodadaAtivo : {}) }}>
              R{r.numero}
              <span style={styles.rodadaData}>
                {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Seletor Chave */}
      <div style={styles.chaveRow}>
        <button onClick={() => setChaveAtiva("ouro")}
          style={{ ...styles.btnChave, ...(chaveAtiva === "ouro" ? styles.btnOuroAtivo : styles.btnChaveInativo) }}>
          🥇 Chave Ouro
        </button>
        <button onClick={() => setChaveAtiva("prata")}
          style={{ ...styles.btnChave, ...(chaveAtiva === "prata" ? styles.btnPrataAtivo : styles.btnChaveInativo) }}>
          🥈 Chave Prata
        </button>
      </div>

      {/* SORTEIO */}
      <div style={styles.card}>
        <h2 style={styles.cardTitulo}>
          🎲 Sorteio de Jogos
          {rodadaSelecionada && <span style={styles.badgeRodada}>Rodada {rodadaSelecionada.numero} — {chaveAtiva}</span>}
        </h2>
        <p style={styles.infoText}>
          Gera automaticamente as {chaveAtiva === "ouro" ? "6" : "6"} partidas da rodada, garantindo que nenhum jogador repita parceiro.
        </p>
        <button onClick={gerarSorteioLocal} style={styles.btnSortear}>
          🎲 Gerar Sorteio
        </button>
      </div>

      {/* Preview Sorteio */}
      {sorteioPreview && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>👀 Preview do Sorteio</h2>
          {sorteioPreview.map((rodadaJogos, r) => (
            <div key={r} style={{ marginBottom: 14 }}>
              <div style={styles.rodadaJogosHeader}>Rodada {r + 1}</div>
              {rodadaJogos.map(([a1, a2, b1, b2], i) => (
                <div key={i} style={styles.sorteioJogoRow}>
                  <span style={styles.sorteioNomes}>{a1} / {a2}</span>
                  <span style={styles.sorteioVs}>×</span>
                  <span style={styles.sorteioNomes}>{b1} / {b2}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={styles.botoesForm}>
            <button onClick={salvarSorteio} disabled={salvandoSorteio} style={styles.btnSalvar}>
              {salvandoSorteio ? "Salvando..." : "✅ Confirmar e Salvar"}
            </button>
            <button onClick={regerarSorteio} style={styles.btnRegerar}>🔄 Regerar</button>
            <button onClick={() => setSorteioPreview(null)} style={styles.btnCancelar}>✕</button>
          </div>
        </div>
      )}

      {/* Formulário manual */}
      <div style={styles.card}>
        <h2 style={styles.cardTitulo}>
          {editandoId ? "✏️ Editando placar" : "➕ Inserir placar manualmente"}
        </h2>
        <div style={styles.duplaSection}>
          <div style={styles.duplaLabel}>🎾 Dupla A</div>
          <div style={styles.duplaInputs}>
            <SelectJogador value={novoJogo.dupla_a_1} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_1: v })} placeholder="Jogador 1" />
            <SelectJogador value={novoJogo.dupla_a_2} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_2: v })} placeholder="Jogador 2" />
          </div>
        </div>
        <div style={styles.placarSection}>
          <input type="number" min="0" max="7" placeholder="0" value={novoJogo.placar_a}
            onChange={(e) => setNovoJogo({ ...novoJogo, placar_a: e.target.value })} style={styles.placarInput} />
          <span style={styles.placarVs}>×</span>
          <input type="number" min="0" max="7" placeholder="0" value={novoJogo.placar_b}
            onChange={(e) => setNovoJogo({ ...novoJogo, placar_b: e.target.value })} style={styles.placarInput} />
        </div>
        <div style={styles.duplaSection}>
          <div style={styles.duplaLabel}>🎾 Dupla B</div>
          <div style={styles.duplaInputs}>
            <SelectJogador value={novoJogo.dupla_b_1} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_1: v })} placeholder="Jogador 1" />
            <SelectJogador value={novoJogo.dupla_b_2} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_2: v })} placeholder="Jogador 2" />
          </div>
        </div>
        <div style={styles.botoesForm}>
          <button onClick={salvarJogo} disabled={salvando} style={styles.btnSalvar}>
            {salvando ? "Salvando..." : editandoId ? "💾 Atualizar" : "💾 Salvar"}
          </button>
          {editandoId && <button onClick={resetForm} style={styles.btnCancelar}>✕ Cancelar</button>}
        </div>
      </div>

      {/* Lista de jogos */}
      <div style={styles.card}>
        <h2 style={styles.cardTitulo}>
          📋 Jogos da rodada
          <span style={styles.badgeCount}>{jogos.length} jogos</span>
        </h2>
        {loading ? <p style={styles.loadingText}>Carregando...</p>
          : jogos.length === 0 ? <p style={styles.emptyText}>Nenhum jogo inserido ainda.</p>
          : (
            <div style={styles.jogosList}>
              {jogos.map((jogo, idx) => {
                const temPlacar = jogo.placar_a !== null && jogo.placar_b !== null;
                const venceuA = temPlacar && jogo.placar_a > jogo.placar_b;
                return (
                  <div key={jogo.id} style={styles.jogoCard}>
                    <div style={styles.jogoNumero}>{idx + 1}</div>
                    <div style={styles.jogoConteudo}>
                      <div style={{ ...styles.dupla, ...(venceuA ? styles.vencedor : {}) }}>
                        {jogo.dupla_a_1}{jogo.dupla_a_2 ? ` / ${jogo.dupla_a_2}` : ""}
                      </div>
                      <div style={styles.placarDisplay}>
                        {temPlacar ? (
                          <>
                            <span style={venceuA ? styles.placarVencedor : styles.placarPerdedor}>{jogo.placar_a}</span>
                            <span style={styles.placarSep}>×</span>
                            <span style={!venceuA ? styles.placarVencedor : styles.placarPerdedor}>{jogo.placar_b}</span>
                          </>
                        ) : <span style={styles.semPlacar}>× ?</span>}
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

      {/* Calcular Pontuação */}
      <div style={styles.card}>
        <h2 style={styles.cardTitulo}>🏆 Pontuação da Liga</h2>
        <p style={styles.infoText}>Calcule após inserir todos os placares das duas chaves.</p>
        <button onClick={calcularPontuacao} disabled={calculando} style={styles.btnCalcular}>
          {calculando ? "Calculando..." : "📊 Calcular Pontuação"}
        </button>
      </div>

      {/* Preview Ranking */}
      {rankingPreview && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>👀 Preview — Confirmar antes de salvar</h2>
          {["ouro", "prata"].map(chave => (
            <div key={chave} style={{ marginBottom: 16 }}>
              <div style={{ ...styles.chaveHeader, color: chave === "ouro" ? ouro : prata }}>
                {chave === "ouro" ? "🥇 Chave Ouro" : "🥈 Chave Prata"}
              </div>
              {(rankingPreview[chave] || []).map((j, idx) => (
                <div key={j.nome} style={styles.rankingRow}>
                  <span style={styles.rankPos}>{idx + 1}º</span>
                  <span style={styles.rankNome}>{j.nome}</span>
                  <span style={styles.rankVit}>{j.vitorias}V</span>
                  <span style={styles.rankPts}>{j.ptosLiga} pts</span>
                </div>
              ))}
            </div>
          ))}
          <div style={styles.botoesForm}>
            <button onClick={salvarPontuacao} disabled={calculando} style={styles.btnSalvar}>
              {calculando ? "Salvando..." : "✅ Confirmar e Salvar"}
            </button>
            <button onClick={() => setRankingPreview(null)} style={styles.btnCancelar}>✕ Cancelar</button>
          </div>
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
const verde = "#1a4a2e";

const styles = {
  container: { minHeight: "100vh", background: bg, padding: "20px 16px 100px", fontFamily: "'Segoe UI', sans-serif", color: "#e8f5e9", maxWidth: 600, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${borda}` },
  headerIcon: { fontSize: 32 },
  titulo: { margin: 0, fontSize: 22, fontWeight: 700, color: ouro },
  subtitulo: { margin: 0, fontSize: 13, color: "#7fb89a", marginTop: 2 },
  mensagem: { padding: "10px 16px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, color: "#fff" },
  card: { background: cardBg, border: `1px solid ${borda}`, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitulo: { margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#c8e6c9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { fontSize: 12, color: "#7fb89a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" },
  rodadasRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  btnRodada: { background: "transparent", border: `1px solid ${borda}`, borderRadius: 8, color: "#9dbfac", padding: "6px 12px", cursor: "pointer", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  btnRodadaAtivo: { background: verde, border: `1px solid ${ouro}`, color: ouro, fontWeight: 700 },
  rodadaData: { fontSize: 10, opacity: 0.7 },
  chaveRow: { display: "flex", gap: 10, marginBottom: 16 },
  btnChave: { flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnOuroAtivo: { background: ouro, color: "#0f2d1e" },
  btnPrataAtivo: { background: prata, color: "#0f2d1e" },
  btnChaveInativo: { background: "#1e3d2a", color: "#5a8a6a", border: `1px solid ${borda}` },
  duplaSection: { marginBottom: 10 },
  duplaLabel: { fontSize: 12, color: "#7fb89a", marginBottom: 6, fontWeight: 600 },
  duplaInputs: { display: "flex", gap: 8, flexWrap: "wrap" },
  select: { flex: 1, minWidth: 140, background: "#0f2d1e", border: `1px solid ${borda}`, borderRadius: 8, color: "#e8f5e9", padding: "8px 10px", fontSize: 13, cursor: "pointer" },
  placarSection: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "14px 0" },
  placarInput: { width: 64, background: "#0f2d1e", border: `2px solid ${ouro}`, borderRadius: 10, color: ouro, fontSize: 28, fontWeight: 700, textAlign: "center", padding: "6px 0" },
  placarVs: { fontSize: 20, color: "#5a8a6a", fontWeight: 700 },
  botoesForm: { display: "flex", gap: 10, marginTop: 16 },
  btnSalvar: { flex: 1, background: ouro, color: "#0f2d1e", border: "none", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btnCancelar: { background: "transparent", border: `1px solid #c0392b`, color: "#e74c3c", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnCalcular: { width: "100%", background: "#1a5c3a", border: `1px solid ${ouro}`, color: ouro, borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btnSortear: { width: "100%", background: "#0f3d2a", border: `1px solid #4a9a6a`, color: "#7fd8a0", borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btnRegerar: { background: "#1e3d2a", border: `1px solid ${borda}`, color: "#9dbfac", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  loadingText: { color: "#7fb89a", textAlign: "center", padding: 20 },
  emptyText: { color: "#5a8a6a", textAlign: "center", padding: 20, fontSize: 14 },
  infoText: { color: "#7fb89a", fontSize: 13, marginBottom: 12, lineHeight: 1.5 },
  badgeRodada: { background: "#1e3d2a", border: `1px solid ${borda}`, borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#7fb89a", fontWeight: 400 },
  badgeCount: { background: "#1e3d2a", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#7fb89a", fontWeight: 400 },
  jogosList: { display: "flex", flexDirection: "column", gap: 8 },
  jogoCard: { display: "flex", alignItems: "center", gap: 8, background: "#0f2d1e", border: `1px solid ${borda}`, borderRadius: 10, padding: "10px 12px" },
  jogoNumero: { width: 22, height: 22, borderRadius: "50%", background: borda, color: "#7fb89a", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700 },
  jogoConteudo: { flex: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  dupla: { flex: 1, fontSize: 12, color: "#9dbfac", minWidth: 80 },
  vencedor: { color: ouro, fontWeight: 700 },
  placarDisplay: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 },
  placarVencedor: { fontSize: 16, fontWeight: 700, color: ouro },
  placarPerdedor: { fontSize: 16, fontWeight: 700, color: "#5a8a6a" },
  placarSep: { fontSize: 12, color: "#3a6a4a" },
  semPlacar: { fontSize: 13, color: "#5a8a6a", fontStyle: "italic" },
  jogoAcoes: { display: "flex", gap: 4, flexShrink: 0 },
  btnEdit: { background: "transparent", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px" },
  btnDel: { background: "transparent", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px" },
  rodadaJogosHeader: { fontSize: 12, color: "#7fb89a", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  sorteioJogoRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${borda}` },
  sorteioNomes: { flex: 1, fontSize: 13, color: "#c8e6c9" },
  sorteioVs: { fontSize: 12, color: "#5a8a6a", fontWeight: 700 },
  chaveHeader: { fontWeight: 700, fontSize: 14, marginBottom: 8 },
  rankingRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${borda}` },
  rankPos: { width: 24, fontSize: 12, color: "#7fb89a", fontWeight: 700 },
  rankNome: { flex: 1, fontSize: 13, color: "#e8f5e9" },
  rankVit: { fontSize: 12, color: "#7fb89a", width: 28 },
  rankPts: { fontSize: 13, fontWeight: 700, color: ouro },
};
