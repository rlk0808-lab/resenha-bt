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
  const [abaAtiva, setAbaAtiva] = useState("jogos");

  // ── Estado Jogos ──
  const [rodadas, setRodadas] = useState([]);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(null);
  const [jogadores, setJogadores] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [chaveAtiva, setChaveAtiva] = useState("ouro");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [rankingPreview, setRankingPreview] = useState(null);
  const [sorteioPreview, setSorteioPreview] = useState(null);
  const [salvandoSorteio, setSalvandoSorteio] = useState(false);
  const [novoJogo, setNovoJogo] = useState({
    dupla_a_1: "", dupla_a_2: "", dupla_b_1: "", dupla_b_2: "", placar_a: "", placar_b: "",
  });
  const [editandoId, setEditandoId] = useState(null);

  // ── Estado Convites ──
  const [convites, setConvites] = useState([]);
  const [loadingConvites, setLoadingConvites] = useState(false);
  const [gerandoConvite, setGerandoConvite] = useState(false);

  // ── Estado Aprovações ──
  const [pendentes, setPendentes] = useState([]);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [aprovando, setAprovando] = useState(null);

  // ── Mensagem global ──
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => { carregarRodadas(); carregarJogadores(); }, []);
  useEffect(() => { if (rodadaSelecionada) carregarJogos(); }, [rodadaSelecionada, chaveAtiva]);
  useEffect(() => { if (abaAtiva === "convites") carregarConvites(); }, [abaAtiva]);
  useEffect(() => { if (abaAtiva === "aprovacoes") carregarPendentes(); }, [abaAtiva]);

  function mostrarMensagem(texto, tipo = "sucesso") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 4000);
  }

  // ─── JOGOS ───────────────────────────────────────────────────────────────

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

  // ─── SORTEIO ─────────────────────────────────────────────────────────────

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

  async function salvarSorteio() {
    if (!sorteioPreview || !rodadaSelecionada) return;
    setSalvandoSorteio(true);
    await supabase.from("jogos").delete()
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
    else { mostrarMensagem("✅ Sorteio salvo!"); setSorteioPreview(null); carregarJogos(); }
    setSalvandoSorteio(false);
  }

  // ─── PONTUAÇÃO ───────────────────────────────────────────────────────────

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

  // ─── CONVITES ────────────────────────────────────────────────────────────

  async function carregarConvites() {
    setLoadingConvites(true);
    const { data } = await supabase
      .from("convites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setConvites(data || []);
    setLoadingConvites(false);
  }

  async function gerarNovoConvite() {
    setGerandoConvite(true);
    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("convites").insert({
      token,
      email: "",
      usado: false,
      criado_por: session?.user?.id || null,
      expires_at,
    });

    if (error) {
      mostrarMensagem("Erro ao gerar convite: " + error.message, "erro");
    } else {
      mostrarMensagem("✅ Convite gerado!");
      carregarConvites();
    }
    setGerandoConvite(false);
  }

  function copiarLink(token) {
    const url = `${window.location.origin}/cadastro?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      mostrarMensagem("✅ Link copiado!");
    });
  }

  async function revogarConvite(id) {
    if (!confirm("Revogar este convite?")) return;
    const { error } = await supabase.from("convites").delete().eq("id", id);
    if (error) mostrarMensagem("Erro ao revogar.", "erro");
    else { mostrarMensagem("Convite revogado."); carregarConvites(); }
  }

  // ─── APROVAÇÕES ──────────────────────────────────────────────────────────

  async function carregarPendentes() {
    setLoadingPendentes(true);
    const { data } = await supabase
      .from("cadastros_pendentes")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    setPendentes(data || []);
    setLoadingPendentes(false);
  }

  async function aprovarCadastro(pendente) {
    setAprovando(pendente.id);
    const { error } = await supabase
      .from("cadastros_pendentes")
      .update({ status: "aprovado" })
      .eq("id", pendente.id);

    if (error) {
      mostrarMensagem("Erro ao aprovar: " + error.message, "erro");
    } else {
      mostrarMensagem(`✅ ${pendente.nome} aprovado!`);
      carregarPendentes();
    }
    setAprovando(null);
  }

  async function rejeitarCadastro(pendente) {
    if (!confirm(`Rejeitar cadastro de ${pendente.nome}?`)) return;
    setAprovando(pendente.id);
    const { error } = await supabase
      .from("cadastros_pendentes")
      .update({ status: "rejeitado" })
      .eq("id", pendente.id);

    if (error) {
      mostrarMensagem("Erro ao rejeitar: " + error.message, "erro");
    } else {
      mostrarMensagem(`${pendente.nome} rejeitado.`);
      carregarPendentes();
    }
    setAprovando(null);
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

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>⚙️</div>
        <div>
          <h1 style={styles.titulo}>Painel Admin</h1>
          <p style={styles.subtitulo}>Sorteio, resultados, pontuação e convites</p>
        </div>
      </div>

      {/* Mensagem */}
      {mensagem && (
        <div style={{ ...styles.mensagem, background: mensagem.tipo === "erro" ? "#c0392b" : "#27ae60" }}>
          {mensagem.texto}
        </div>
      )}

      {/* Abas */}
      <div style={styles.abas}>
        <button onClick={() => setAbaAtiva("jogos")}
          style={{ ...styles.aba, ...(abaAtiva === "jogos" ? styles.abaAtiva : {}) }}>
          🎾 Jogos
        </button>
        <button onClick={() => setAbaAtiva("convites")}
          style={{ ...styles.aba, ...(abaAtiva === "convites" ? styles.abaAtiva : {}) }}>
          🔗 Convites
        </button>
        <button onClick={() => setAbaAtiva("aprovacoes")}
          style={{ ...styles.aba, ...(abaAtiva === "aprovacoes" ? styles.abaAtiva : {}) }}>
          👤 Aprovações {pendentes.length > 0 && <span style={styles.badge}>{pendentes.length}</span>}
        </button>
      </div>

      {/* ═══ ABA JOGOS ═══ */}
      {abaAtiva === "jogos" && (
        <>
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

          {/* Sorteio */}
          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>
              🎲 Sorteio
              {rodadaSelecionada && <span style={styles.badgeRodada}>R{rodadaSelecionada.numero} — {chaveAtiva}</span>}
            </h2>
            <p style={styles.infoText}>Gera as partidas garantindo que nenhum jogador repita parceiro.</p>
            <button onClick={gerarSorteioLocal} style={styles.btnSortear}>🎲 Gerar Sorteio</button>
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
                  {salvandoSorteio ? "Salvando..." : "✅ Confirmar"}
                </button>
                <button onClick={() => { setSorteioPreview(null); setTimeout(gerarSorteioLocal, 100); }} style={styles.btnRegerar}>🔄</button>
                <button onClick={() => setSorteioPreview(null)} style={styles.btnCancelar}>✕</button>
              </div>
            </div>
          )}

          {/* Formulário placar */}
          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>
              {editandoId ? "✏️ Editando placar" : "➕ Inserir placar"}
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

          {/* Lista jogos */}
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

          {/* Pontuação */}
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
        </>
      )}

      {/* ═══ ABA CONVITES ═══ */}
      {abaAtiva === "convites" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>🔗 Gerar Convite</h2>
          <p style={styles.infoText}>Gere um link único válido por 7 dias e envie pelo WhatsApp.</p>
          <button onClick={gerarNovoConvite} disabled={gerandoConvite} style={styles.btnSalvar}>
            {gerandoConvite ? "Gerando..." : "🔗 Gerar novo link de convite"}
          </button>

          <div style={{ marginTop: 20 }}>
            <div style={styles.label}>Convites recentes</div>
            {loadingConvites ? <p style={styles.loadingText}>Carregando...</p>
              : convites.length === 0 ? <p style={styles.emptyText}>Nenhum convite gerado.</p>
              : convites.map((c) => {
                  const expirado = new Date(c.expires_at) < new Date();
                  return (
                    <div key={c.id} style={styles.conviteCard}>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...styles.conviteToken, color: c.usado ? "#5a8a6a" : expirado ? "#c0392b" : ouro }}>
                          {c.usado ? "✅ Usado" : expirado ? "⏰ Expirado" : "🟢 Ativo"}
                        </div>
                        <div style={styles.conviteData}>
                          Criado: {new Date(c.created_at).toLocaleDateString("pt-BR")} •
                          Expira: {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                        </div>
                        <div style={styles.conviteLink}>
                          {window.location.origin}/cadastro?token={c.token.substring(0, 8)}...
                        </div>
                      </div>
                      <div style={styles.jogoAcoes}>
                        {!c.usado && !expirado && (
                          <button onClick={() => copiarLink(c.token)} style={styles.btnCopiar}>📋</button>
                        )}
                        <button onClick={() => revogarConvite(c.id)} style={styles.btnDel}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      )}

      {/* ═══ ABA APROVAÇÕES ═══ */}
      {abaAtiva === "aprovacoes" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>
            👤 Cadastros Pendentes
            {pendentes.length > 0 && <span style={styles.badgeCount}>{pendentes.length}</span>}
          </h2>

          {loadingPendentes ? <p style={styles.loadingText}>Carregando...</p>
            : pendentes.length === 0 ? (
              <div style={styles.emptyAprovacao}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <p style={styles.emptyText}>Nenhum cadastro pendente.</p>
              </div>
            ) : pendentes.map((p) => (
              <div key={p.id} style={styles.pendenteCard}>
                <div style={{ flex: 1 }}>
                  <div style={styles.pendenteNome}>{p.nome}</div>
                  <div style={styles.pendenteInfo}>📧 {p.email}</div>
                  {p.whatsapp && <div style={styles.pendenteInfo}>📱 {p.whatsapp}</div>}
                  <div style={styles.pendenteData}>
                    Solicitado: {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    onClick={() => aprovarCadastro(p)}
                    disabled={aprovando === p.id}
                    style={styles.btnAprovar}
                  >
                    {aprovando === p.id ? "..." : "✅ Aprovar"}
                  </button>
                  <button
                    onClick={() => rejeitarCadastro(p)}
                    disabled={aprovando === p.id}
                    style={styles.btnRejeitar}
                  >
                    {aprovando === p.id ? "..." : "✕ Rejeitar"}
                  </button>
                </div>
              </div>
            ))}
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
  abas: { display: "flex", gap: 8, marginBottom: 16 },
  aba: { flex: 1, padding: "10px 4px", borderRadius: 10, border: `1px solid ${borda}`, background: "#1e3d2a", color: "#5a8a6a", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  abaAtiva: { background: verde, border: `1px solid ${ouro}`, color: ouro },
  badge: { background: "#c0392b", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 },
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
  btnCopiar: { background: "#1a5c3a", border: `1px solid ${borda}`, color: "#7fd8a0", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 },
  btnAprovar: { background: "#1a5c3a", border: `1px solid #4a9a6a`, color: "#7fd8a0", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnRejeitar: { background: "transparent", border: `1px solid #c0392b`, color: "#e74c3c", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  loadingText: { color: "#7fb89a", textAlign: "center", padding: 20 },
  emptyText: { color: "#5a8a6a", textAlign: "center", padding: 20, fontSize: 14 },
  emptyAprovacao: { textAlign: "center", padding: "20px 0" },
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
  conviteCard: { display: "flex", alignItems: "flex-start", gap: 8, background: "#0f2d1e", border: `1px solid ${borda}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 },
  conviteToken: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  conviteData: { fontSize: 11, color: "#5a8a6a", marginBottom: 2 },
  conviteLink: { fontSize: 11, color: "#3a6a4a", fontFamily: "monospace" },
  pendenteCard: { display: "flex", alignItems: "flex-start", gap: 12, background: "#0f2d1e", border: `1px solid ${borda}`, borderRadius: 10, padding: "12px", marginBottom: 8 },
  pendenteNome: { fontSize: 15, fontWeight: 700, color: "#c8e6c9", marginBottom: 4 },
  pendenteInfo: { fontSize: 13, color: "#7fb89a", marginBottom: 2 },
  pendenteData: { fontSize: 11, color: "#5a8a6a", marginTop: 4 },
};
