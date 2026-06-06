import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const PONTOS_OURO = [25, 22, 20, 18, 16, 14, 12, 10, 8, 8, 8, 8];

// Estrutura fixa do chaveamento (índices 0-11 = slots J1-J12)
// Formato por rodada: [a1, a2, b1, b2] = dupla(a1,a2) x dupla(b1,b2)
const ESTRUTURA_CHAVE = [
  // Rodada 1
  [[0,8,  1,2],  [3,5,  7,10], [4,11, 6,9]],
  // Rodada 2
  [[0,5,  4,6],  [1,9,  2,7],  [3,10, 8,11]],
  // Rodada 3
  [[0,1,  5,10], [2,4,  3,11], [6,8,  7,9]],
  // Rodada 4
  [[0,11, 7,8],  [1,10, 4,9],  [2,3,  5,6]],
];

function gerarSorteio(jogadores) {
  // Valida que temos exatamente 12 jogadores
  if (!jogadores || jogadores.length !== 12) {
    console.error(`gerarSorteio: esperava 12 jogadores, recebeu ${jogadores?.length}`);
    return null;
  }

  // Sorteia aleatoriamente os jogadores nos slots J1-J12
  const slots = [...jogadores].sort(() => Math.random() - 0.5);

  // Monta as 4 rodadas usando a estrutura fixa
  const rodadas = ESTRUTURA_CHAVE.map(rodada =>
    rodada.map(([a1, a2, b1, b2]) => [slots[a1], slots[a2], slots[b1], slots[b2]])
  );

  // Valida que não há undefined nos jogos
  const temInvalido = rodadas.some(r => r.some(([a1,a2,b1,b2]) => !a1 || !a2 || !b1 || !b2));
  if (temInvalido) {
    console.error('gerarSorteio: jogos com jogadores undefined');
    return null;
  }

  return rodadas;
}

export default function Admin({ session }) {
  const [abaAtiva, setAbaAtiva] = useState("jogos");
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
  const [timesEspecial, setTimesEspecial] = useState({ time_a: [], time_b: [] });
  const [salvandoSorteio, setSalvandoSorteio] = useState(false);
  const [fechandoLista, setFechandoLista] = useState(false);
  const [previewFechamento, setPreviewFechamento] = useState(null);
  const [novoJogo, setNovoJogo] = useState({
    dupla_a_1: "", dupla_a_2: "", dupla_b_1: "", dupla_b_2: "", placar_a: "", placar_b: "",
  });
  const [editandoId, setEditandoId] = useState(null);
  const [convites, setConvites] = useState([]);
  const [loadingConvites, setLoadingConvites] = useState(false);
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const [pendentes, setPendentes] = useState([]);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [aprovando, setAprovando] = useState(null);
  const [vinculacoes, setVinculacoes] = useState({});
  const [atletas, setAtletas] = useState([]);
  const [loadingAtletas, setLoadingAtletas] = useState(false);
  const [listaEsperaAdmin, setListaEsperaAdmin] = useState([]);
  const [promovendo, setPromovendo] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => { carregarRodadas(); carregarJogadores(); }, []);
  useEffect(() => {
    if (rodadaSelecionada) {
      carregarJogos();
      carregarListaEspera();
      if (rodadaSelecionada.tipo === "especial") {
        supabase.from("confirmacoes")
          .select("*, jogadores(nome)")
          .eq("rodada_id", rodadaSelecionada.id)
          .eq("status", "confirmado")
          .then(({ data }) => setConfirmacoes(data || []));
        setTimesEspecial({ time_a: [], time_b: [] });
      }
    }
  }, [rodadaSelecionada, chaveAtiva]);
  useEffect(() => { if (abaAtiva === "convites") carregarConvites(); }, [abaAtiva]);
  useEffect(() => { if (abaAtiva === "aprovacoes") carregarPendentes(); }, [abaAtiva]);
  useEffect(() => { if (abaAtiva === "atletas") carregarAtletas(); }, [abaAtiva]);

  function mostrarMensagem(texto, tipo = "sucesso") {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 5000);
  }

  async function carregarRodadas() {
    const { data } = await supabase.from("rodadas").select("*").order("numero", { ascending: true });
    setRodadas(data || []);
    if (data && data.length > 0) setRodadaSelecionada(data[0]);
  }

  const [confirmacoes, setConfirmacoes] = useState([]);

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
      rodada_id: rodadaSelecionada.id, numero_rodada: rodadaSelecionada.numero,
      dupla_a_1: novoJogo.dupla_a_1, dupla_a_2: novoJogo.dupla_a_2 || null,
      dupla_b_1: novoJogo.dupla_b_1, dupla_b_2: novoJogo.dupla_b_2 || null,
      placar_a: parseInt(novoJogo.placar_a), placar_b: parseInt(novoJogo.placar_b),
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

  function gerarSorteioLocal() {
    const jogadoresChave = jogadores.filter(j => j.chave === chaveAtiva).map(j => j.nome);
    if (jogadoresChave.length < 4) { mostrarMensagem("Poucos jogadores nesta chave.", "erro"); return; }
    const resultado = gerarSorteio(jogadoresChave);
    if (!resultado) { mostrarMensagem("Não foi possível gerar o sorteio.", "erro"); return; }
    setSorteioPreview(resultado);
  }

  async function salvarSorteio() {
    if (!sorteioPreview || !rodadaSelecionada) return;
    setSalvandoSorteio(true);
    await supabase.from("jogos").delete().eq("rodada_id", rodadaSelecionada.id).eq("chave", chaveAtiva).is("placar_a", null);
    const inserts = sorteioPreview.flatMap((rj) =>
      rj.map(([a1, a2, b1, b2]) => ({
        rodada_id: rodadaSelecionada.id, numero_rodada: rodadaSelecionada.numero,
        dupla_a_1: a1, dupla_a_2: a2, dupla_b_1: b1, dupla_b_2: b2,
        placar_a: null, placar_b: null, chave: chaveAtiva,
      }))
    );
    const { error } = await supabase.from("jogos").insert(inserts);
    if (error) mostrarMensagem("Erro ao salvar sorteio: " + error.message, "erro");
    else { mostrarMensagem("✅ Sorteio salvo!"); setSorteioPreview(null); carregarJogos(); }
    setSalvandoSorteio(false);
  }

  // ─── FECHAR LISTA ────────────────────────────────────────────────────────
  async function prepararFechamento() {
    const agora = new Date();
    const foraDoPrazo = agora.getDay() !== 5 || agora.getHours() < 14;

    const { data: proximasRodadas } = await supabase.from("rodadas").select("*").eq("status", "proxima").limit(1);
    const rodadaAlvo = proximasRodadas?.[0];
    if (!rodadaAlvo) { mostrarMensagem("Nenhuma rodada 'proxima' encontrada.", "erro"); return; }

    // Promove automaticamente da espera se houver vagas
    const { data: confirmadosAtuais } = await supabase.from("confirmacoes").select("id")
      .eq("rodada_id", rodadaAlvo.id).eq("status", "confirmado");
    const totalConfirmados = confirmadosAtuais?.length || 0;
    const vagas = 24 - totalConfirmados;
    if (vagas > 0) {
      const { data: listaEspera } = await supabase.from("confirmacoes").select("id")
        .eq("rodada_id", rodadaAlvo.id).eq("status", "espera")
        .order("created_at", { ascending: true }).limit(vagas);
      if (listaEspera && listaEspera.length > 0) {
        for (const c of listaEspera) {
          await supabase.from("confirmacoes").update({ status: "confirmado" }).eq("id", c.id);
        }
        mostrarMensagem(`✅ ${listaEspera.length} jogador(es) promovido(s) da lista de espera.`);
      }
    }

    const { data: confirmacoes } = await supabase
      .from("confirmacoes").select("*, jogadores(id, nome, chave)")
      .eq("rodada_id", rodadaAlvo.id).eq("status", "confirmado")
      .order("created_at", { ascending: true });

    if (!confirmacoes || confirmacoes.length < 8) { mostrarMensagem("Confirmados insuficientes (mínimo 8).", "erro"); return; }

    // Usa diretamente a chave atual do banco de cada jogador confirmado
    const jogadoresOuro = confirmacoes
      .filter(c => c.jogadores?.chave === "ouro")
      .map(c => c.jogadores?.nome);
    const jogadoresPrata = confirmacoes
      .filter(c => c.jogadores?.chave === "prata")
      .map(c => c.jogadores?.nome);

    if (jogadoresOuro.length < 4) { mostrarMensagem(`Ouro com ${jogadoresOuro.length} confirmados. Mínimo 4.`, "erro"); return; }
    if (jogadoresPrata.length < 4) { mostrarMensagem(`Prata com ${jogadoresPrata.length} confirmados. Mínimo 4.`, "erro"); return; }

    setPreviewFechamento({ rodada: rodadaAlvo, ouro: jogadoresOuro, prata: jogadoresPrata, total: confirmacoes.length, foraDoPrazo });
  }

  async function confirmarFechamento() {
    if (!previewFechamento) return;
    setFechandoLista(true);
    const { rodada, ouro: jogOuro, prata: jogPrata } = previewFechamento;
    const erros = [];

    for (const nome of jogOuro) {
      const jog = jogadores.find(j => j.nome === nome);
      if (!jog) continue;
      const { error } = await supabase.from("jogadores").update({ chave: "ouro" }).eq("id", jog.id);
      if (error) erros.push(`chave ${nome}: ${error.message}`);
    }
    for (const nome of jogPrata) {
      const jog = jogadores.find(j => j.nome === nome);
      if (!jog) continue;
      const { error } = await supabase.from("jogadores").update({ chave: "prata" }).eq("id", jog.id);
      if (error) erros.push(`chave ${nome}: ${error.message}`);
    }
    if (erros.length > 0) { mostrarMensagem("Erros: " + erros.join(", "), "erro"); setFechandoLista(false); return; }

    const sorteioOuro = gerarSorteio(jogOuro);
    const sorteioPrata = gerarSorteio(jogPrata);
    if (!sorteioOuro || !sorteioPrata) { mostrarMensagem("Erro ao gerar sorteio.", "erro"); setFechandoLista(false); return; }

    const insertsOuro = sorteioOuro.flatMap(rj => rj.map(([a1, a2, b1, b2]) => ({ rodada_id: rodada.id, numero_rodada: rodada.numero, dupla_a_1: a1, dupla_a_2: a2, dupla_b_1: b1, dupla_b_2: b2, placar_a: null, placar_b: null, chave: "ouro" })));
    const insertsPrata = sorteioPrata.flatMap(rj => rj.map(([a1, a2, b1, b2]) => ({ rodada_id: rodada.id, numero_rodada: rodada.numero, dupla_a_1: a1, dupla_a_2: a2, dupla_b_1: b1, dupla_b_2: b2, placar_a: null, placar_b: null, chave: "prata" })));

    await supabase.from("jogos").delete().eq("rodada_id", rodada.id).is("placar_a", null);
    const { error: erroInsert } = await supabase.from("jogos").insert([...insertsOuro, ...insertsPrata]);
    if (erroInsert) { mostrarMensagem("Erro ao salvar jogos: " + erroInsert.message, "erro"); setFechandoLista(false); return; }

    await supabase.from("rodadas").update({ status: "ativa" }).eq("id", rodada.id);
    await carregarJogadores();
    await carregarRodadas();
    setPreviewFechamento(null);
    setFechandoLista(false);
    mostrarMensagem(`✅ Lista fechada! Sorteio publicado para a Rodada ${rodada.numero}.`);
  }

  // ─── PONTUAÇÃO ───────────────────────────────────────────────────────────
  function calcularRankingLocal(jogosChave, chave) {
    const ehEspecial = rodadaSelecionada?.tipo === "especial";
    const stats = {};
    const confrontos = {};
    const addJogador = (nome) => { if (nome && !stats[nome]) { stats[nome] = { nome, pts: 0, vitorias: 0, saldo: 0 }; confrontos[nome] = {}; } };

    for (const jogo of jogosChave) {
      if (jogo.placar_a === null || jogo.placar_b === null) continue;
      const { dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2, placar_a, placar_b } = jogo;
      [dupla_a_1, dupla_a_2, dupla_b_1, dupla_b_2].forEach(addJogador);
      const jogadoresA = [dupla_a_1, dupla_a_2].filter(Boolean);
      const jogadoresB = [dupla_b_1, dupla_b_2].filter(Boolean);
      const venceuA = placar_a > placar_b;
      const saldo = Math.abs(placar_a - placar_b);
      const vencedores = venceuA ? jogadoresA : jogadoresB;
      const perdedores = venceuA ? jogadoresB : jogadoresA;

      if (ehEspecial) {
        // Rodada especial: pontuação por saldo de games
        // Vencedor ganha o saldo (6x0=6, 6x1=5, etc), perdedor ganha 0
        vencedores.forEach(n => { stats[n].pts += saldo; stats[n].vitorias += 1; stats[n].saldo += saldo; });
        perdedores.forEach(n => { stats[n].saldo -= saldo; });
      } else {
        // Rodada normal: vencedor 15+saldo, perdedor games conquistados
        vencedores.forEach(n => { stats[n].pts += 15 + saldo; stats[n].vitorias += 1; stats[n].saldo += saldo; });
        perdedores.forEach(n => { stats[n].pts += venceuA ? placar_b : placar_a; stats[n].saldo -= saldo; });
      }
      jogadoresA.forEach(a => { jogadoresB.forEach(b => { if (venceuA) { confrontos[a][b] = (confrontos[a][b] || 0) + 1; } else { confrontos[b][a] = (confrontos[b][a] || 0) + 1; } }); });
    }

    const jogadoresList = Object.values(stats);
    jogadoresList.sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.saldo !== a.saldo ? b.saldo - a.saldo : ((confrontos[b.nome]?.[a.nome] || 0) - (confrontos[a.nome]?.[b.nome] || 0)));

    if (ehEspecial) {
      // Rodada especial: times definidos pelo campo chave do jogo
      // chave = "time_a" ou "time_b"
      // Time com mais pontos do dia = vencedor
      const ptsPorTime = { time_a: 0, time_b: 0 };
      const jogadoresPorTime = { time_a: new Set(), time_b: new Set() };

      for (const jogo of jogosChave) {
        if (jogo.placar_a === null || jogo.placar_b === null) continue;
        const time = jogo.chave; // "time_a" ou "time_b"
        if (!ptsPorTime[time] && ptsPorTime[time] !== 0) continue;
        const venceuA = jogo.placar_a > jogo.placar_b;
        const saldo = Math.abs(jogo.placar_a - jogo.placar_b);
        if (venceuA) ptsPorTime[time] += saldo; // dupla A ganhou: saldo vai para o time
        [jogo.dupla_a_1, jogo.dupla_a_2, jogo.dupla_b_1, jogo.dupla_b_2]
          .filter(Boolean).forEach(n => jogadoresPorTime[time]?.add(n));
      }

      const timeVencedor = ptsPorTime.time_a >= ptsPorTime.time_b ? "time_a" : "time_b";

      jogadoresList.forEach((j, idx) => {
        const meuTime = jogadoresPorTime.time_a.has(j.nome) ? "time_a" : "time_b";
        const isVencedor = meuTime === timeVencedor;
        j.ptosLiga = (isVencedor ? 40 : 10) + j.vitorias * 3;
        j.posicao = idx + 1;
        j.timeVencedor = isVencedor;
        j.time = meuTime;
      });
    } else {
      jogadoresList.forEach((j, idx) => {
        j.ptosLiga = (chave === "ouro" ? (PONTOS_OURO[idx] || 8) : 8) + j.vitorias * 3 + (chave === "prata" && idx === 0 ? 3 : 0);
        j.posicao = idx + 1;
      });
    }
    return jogadoresList;
  }

  async function calcularPontuacao() {
    if (!rodadaSelecionada) return;
    setCalculando(true);
    const { data: todosJogos, error } = await supabase.from("jogos").select("*").eq("rodada_id", rodadaSelecionada.id);
    if (error) { mostrarMensagem("Erro ao buscar jogos.", "erro"); setCalculando(false); return; }
    if (rodadaSelecionada?.tipo === "especial") {
      // Especial: todos os jogos juntos (time_a e time_b), sem separação ouro/prata
      const todosJogosEspecial = todosJogos.filter(j => j.chave === "time_a" || j.chave === "time_b");
      const rankEspecial = calcularRankingLocal(todosJogosEspecial, "especial");
      setRankingPreview({ ouro: rankEspecial, prata: [] });
    } else {
      setRankingPreview({
        ouro: calcularRankingLocal(todosJogos.filter(j => j.chave === "ouro"), "ouro"),
        prata: calcularRankingLocal(todosJogos.filter(j => j.chave === "prata"), "prata"),
      });
    }
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
      const { data: existentes } = await supabase.from("pontuacao").select("id").eq("jogador_id", jogador.id).eq("rodada_id", rodadaSelecionada.id);
      const existente = existentes?.[0];
      if (existente) { await supabase.from("pontuacao").update({ pontos: j.ptosLiga, vitorias: j.vitorias }).eq("id", existente.id); }
      else { await supabase.from("pontuacao").insert({ jogador_id: jogador.id, rodada_id: rodadaSelecionada.id, pontos: j.ptosLiga, vitorias: j.vitorias }); }
    }

    if (erros.length > 0) { mostrarMensagem("Erros: " + erros.join(", "), "erro"); setCalculando(false); return; }

    if (rodadaSelecionada?.tipo === "especial") {
      // Especial: salva com chave = time do jogador
      for (const j of (rankingPreview.ouro || [])) {
        const jogador = jogadores.find(jg => jg.nome === j.nome);
        if (!jogador) continue;
        await supabase.from("ranking_rodada").delete().eq("rodada_id", rodadaSelecionada.id).eq("jogador_id", jogador.id);
        await supabase.from("ranking_rodada").insert({ rodada_id: rodadaSelecionada.id, jogador_id: jogador.id, chave: j.time || "time_a", posicao: j.posicao, pontos_liga: j.ptosLiga });
      }
    } else {
      for (const chave of ["ouro", "prata"]) {
        for (const j of (rankingPreview[chave] || [])) {
          const jogador = jogadores.find(jg => jg.nome === j.nome);
          if (!jogador) continue;
          await supabase.from("ranking_rodada").delete().eq("rodada_id", rodadaSelecionada.id).eq("jogador_id", jogador.id);
          await supabase.from("ranking_rodada").insert({ rodada_id: rodadaSelecionada.id, jogador_id: jogador.id, chave, posicao: j.posicao, pontos_liga: j.ptosLiga });
        }
      }
    }

    if (rodadaSelecionada?.tipo !== "especial") {
      for (const nome of (rankingPreview.ouro || []).slice(-3).map(j => j.nome)) {
        const jog = jogadores.find(jg => jg.nome === nome);
        if (jog) await supabase.from("jogadores").update({ chave: "prata" }).eq("id", jog.id);
      }
      for (const nome of (rankingPreview.prata || []).slice(0, 3).map(j => j.nome)) {
        const jog = jogadores.find(jg => jg.nome === nome);
        if (jog) await supabase.from("jogadores").update({ chave: "ouro" }).eq("id", jog.id);
      }
    }

    await supabase.from("rodadas").update({ status: "finalizada" }).eq("id", rodadaSelecionada.id);

    const { data: proximaExistente } = await supabase.from("rodadas").select("id").eq("status", "proxima").limit(1);
    if (!proximaExistente || proximaExistente.length === 0) {
      const hoje = new Date();
      const diasParaSabado = (6 - hoje.getDay() + 7) % 7 || 7;
      const proximoSabado = new Date(hoje);
      proximoSabado.setDate(hoje.getDate() + diasParaSabado);
      const proximoNumero = rodadaSelecionada.numero + 1;
      await supabase.from("rodadas").insert({ numero: proximoNumero, data: proximoSabado.toISOString().split("T")[0], status: "proxima", liga: rodadaSelecionada.liga, tipo: (proximoNumero === 4 || proximoNumero === 8) ? "especial" : "normal" });
      mostrarMensagem(`✅ Pontuação salva! Rodada ${proximoNumero} criada.`);
    } else {
      mostrarMensagem("✅ Pontuação salva e chaves atualizadas!");
    }

    await carregarJogadores();
    setRankingPreview(null);
    carregarRodadas();
    setCalculando(false);
  }

  // ─── CONVITES ────────────────────────────────────────────────────────────
  async function carregarConvites() {
    setLoadingConvites(true);
    const { data } = await supabase.from("convites").select("*").order("created_at", { ascending: false }).limit(20);
    setConvites(data || []);
    setLoadingConvites(false);
  }

  async function gerarNovoConvite() {
    setGerandoConvite(true);
    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("convites").insert({ token, email: "", usado: false, criado_por: session?.user?.id || null, expires_at });
    if (error) mostrarMensagem("Erro ao gerar convite: " + error.message, "erro");
    else { mostrarMensagem("✅ Convite gerado!"); carregarConvites(); }
    setGerandoConvite(false);
  }

  function copiarLink(token) {
    const url = `https://resenha-bt.vercel.app/cadastro?token=${token}`;
    navigator.clipboard.writeText(url).then(() => mostrarMensagem("✅ Link copiado!"));
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
    const { data } = await supabase.from("cadastros_pendentes").select("*").eq("status", "pendente").order("created_at", { ascending: true });
    setPendentes(data || []);
    setLoadingPendentes(false);
  }

  function setVinculacao(pendenteId, campo, valor) {
    setVinculacoes(v => ({ ...v, [pendenteId]: { ...v[pendenteId], [campo]: valor } }));
  }

  async function aprovarCadastro(pendente) {
    const vinc = vinculacoes[pendente.id];
    if (!vinc || (!vinc.jogadorId && !vinc.apelido)) {
      mostrarMensagem("Selecione um jogador existente ou informe o apelido para criar novo.", "erro");
      return;
    }
    setAprovando(pendente.id);
    let jogadorId = vinc.jogadorId;

    if (vinc.tipo === "novo") {
      if (!vinc.apelido?.trim()) { mostrarMensagem("Informe o apelido do novo jogador.", "erro"); setAprovando(null); return; }
      const { data: novoJog, error: erroNovo } = await supabase
        .from("jogadores")
        .insert({ nome: vinc.apelido.trim(), apelido: pendente.nome, chave: "prata", ativo: true, user_id: pendente.user_id })
        .select().single();
      if (erroNovo) { mostrarMensagem("Erro ao criar jogador: " + erroNovo.message, "erro"); setAprovando(null); return; }
      jogadorId = novoJog.id;
    } else {
      const { error: erroVinculo } = await supabase
        .from("jogadores")
        .update({ user_id: pendente.user_id, apelido: pendente.nome })
        .eq("id", jogadorId);
      if (erroVinculo) { mostrarMensagem("Erro ao vincular: " + erroVinculo.message, "erro"); setAprovando(null); return; }
    }

    const { error } = await supabase.from("cadastros_pendentes").update({ status: "aprovado" }).eq("id", pendente.id);
    if (error) mostrarMensagem("Erro ao aprovar: " + error.message, "erro");
    else {
      mostrarMensagem(`✅ ${pendente.nome} aprovado e vinculado!`);
      setVinculacoes(v => { const n = { ...v }; delete n[pendente.id]; return n; });
      carregarPendentes();
      carregarJogadores();
    }
    setAprovando(null);
  }

  async function rejeitarCadastro(pendente) {
    if (!confirm(`Rejeitar cadastro de ${pendente.nome}?`)) return;
    setAprovando(pendente.id);
    const { error } = await supabase.from("cadastros_pendentes").update({ status: "rejeitado" }).eq("id", pendente.id);
    if (error) mostrarMensagem("Erro ao rejeitar: " + error.message, "erro");
    else { mostrarMensagem(`${pendente.nome} rejeitado.`); carregarPendentes(); }
    setAprovando(null);
  }

  // ─── ATLETAS ─────────────────────────────────────────────────────────────
  async function carregarAtletas() {
    setLoadingAtletas(true);
    const { data } = await supabase.from("jogadores").select("*").order("nome", { ascending: true });
    setAtletas(data || []);
    setLoadingAtletas(false);
  }

  async function revogarAcesso(jogador) {
    if (!confirm(`Revogar acesso de ${jogador.nome}? O jogador não conseguirá mais fazer login.`)) return;
    const { error } = await supabase.from("jogadores").update({ user_id: null, apelido: null }).eq("id", jogador.id);
    if (error) mostrarMensagem("Erro ao revogar: " + error.message, "erro");
    else { mostrarMensagem(`✅ Acesso de ${jogador.nome} revogado.`); carregarAtletas(); }
  }

  async function carregarListaEspera() {
    const rodadaProx = rodadas.find(r => r.status === "proxima" || r.status === "ativa");
    if (!rodadaProx) { setListaEsperaAdmin([]); return; }
    const { data } = await supabase
      .from("confirmacoes")
      .select("*, jogadores(nome, chave)")
      .eq("rodada_id", rodadaProx.id)
      .eq("status", "espera")
      .order("created_at", { ascending: true });
    setListaEsperaAdmin(data || []);
  }

  async function promoverListaEspera() {
    const rodadaProx = rodadas.find(r => r.status === "proxima" || r.status === "ativa");
    if (!rodadaProx) { mostrarMensagem("Nenhuma rodada próxima encontrada.", "erro"); return; }
    setPromovendo(true);

    // Conta confirmados atuais
    const { data: confirmados } = await supabase
      .from("confirmacoes").select("id")
      .eq("rodada_id", rodadaProx.id).eq("status", "confirmado");
    const total = confirmados?.length || 0;
    const vagas = 24 - total;

    if (vagas <= 0) {
      mostrarMensagem("Lista principal já está completa (24/24).", "info");
      setPromovendo(false); return;
    }
    if (listaEsperaAdmin.length === 0) {
      mostrarMensagem("Lista de espera está vazia.", "info");
      setPromovendo(false); return;
    }

    const promover = listaEsperaAdmin.slice(0, vagas);
    for (const c of promover) {
      await supabase.from("confirmacoes").update({ status: "confirmado" }).eq("id", c.id);
    }

    mostrarMensagem(`✅ ${promover.length} jogador(es) promovido(s) da lista de espera!`);
    await carregarListaEspera();
    setPromovendo(false);
  }

  const SelectJogador = ({ value, onChange, placeholder }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
      <option value="">{placeholder || "— selecionar —"}</option>
      {jogadores.map((j) => <option key={j.id} value={j.nome}>{j.nome} ({j.chave})</option>)}
    </select>
  );

  const rodadaProxima = rodadas.find(r => r.status === "proxima");

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIcon}>⚙️</div>
        <div>
          <h1 style={styles.titulo}>Painel Admin</h1>
          <p style={styles.subtitulo}>Sorteio, resultados, pontuação e convites</p>
        </div>
      </div>

      {mensagem && (
        <div style={{ ...styles.mensagem, background: mensagem.tipo === "erro" ? "#c0392b" : "#27ae60" }}>
          {mensagem.texto}
        </div>
      )}

      {/* ── PROMOVER LISTA DE ESPERA ── */}
      {listaEsperaAdmin.length > 0 && !previewFechamento && (
        <div style={{ ...styles.cardDestaque, borderColor: "#2980b9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>⏳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#4a9ad4" }}>Lista de Espera</div>
              <div style={{ fontSize: 12, color: "#7fb89a" }}>{listaEsperaAdmin.length} jogador(es) aguardando</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            {listaEsperaAdmin.map((c, i) => (
              <div key={c.id} style={{ fontSize: 13, color: "#c8e6c9", padding: "3px 0", borderBottom: "1px solid #1e3d2a" }}>
                {i + 1}. {c.jogadores?.nome} <span style={{ fontSize: 11, color: "#5a8a6a" }}>({c.jogadores?.chave})</span>
              </div>
            ))}
          </div>
          <button onClick={promoverListaEspera} disabled={promovendo} style={{ ...styles.btnSalvar, background: "#2980b9" }}>
            {promovendo ? "Promovendo..." : "⬆️ Promover para Lista Principal"}
          </button>
        </div>
      )}

      {rodadaProxima && !previewFechamento && (
        <div style={styles.cardDestaque}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>🔒</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: ouro }}>Fechar Lista e Sortear</div>
              <div style={{ fontSize: 12, color: "#7fb89a" }}>Rodada {rodadaProxima.numero} — Faça isso sexta-feira às 14h</div>
            </div>
          </div>
          <p style={styles.infoText}>Fecha as confirmações, monta as chaves e publica o sorteio para todos.</p>
          <button onClick={prepararFechamento} style={styles.btnFechar}>🔒 Fechar Lista e Gerar Sorteio</button>
        </div>
      )}

      {previewFechamento && (
        <div style={styles.cardDestaque}>
          <h2 style={{ ...styles.cardTitulo, color: ouro }}>🔒 Confirmar Fechamento — Rodada {previewFechamento.rodada.numero}</h2>
          {previewFechamento.foraDoPrazo && (
            <div style={{ background: "#3a2000", border: "1px solid #c9a227", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#c9a227" }}>
              ⚠️ Hoje não é sexta-feira após 14h. Pode continuar mesmo assim.
            </div>
          )}
          <div style={{ fontSize: 13, color: "#7fb89a", marginBottom: 12 }}>
            <strong style={{ color: "#c8e6c9" }}>{previewFechamento.total}</strong> jogadores confirmados
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ouro, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🥇 Ouro ({previewFechamento.ouro.length})</div>
              {previewFechamento.ouro.map((nome, i) => <div key={i} style={{ fontSize: 12, color: "#e8f5e9", padding: "3px 0", borderBottom: "1px solid #1e3d2a" }}>{i + 1}. {nome}</div>)}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: prata, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🥈 Prata ({previewFechamento.prata.length})</div>
              {previewFechamento.prata.map((nome, i) => <div key={i} style={{ fontSize: 12, color: "#e8f5e9", padding: "3px 0", borderBottom: "1px solid #1e3d2a" }}>{i + 1}. {nome}</div>)}
            </div>
          </div>
          <div style={styles.botoesForm}>
            <button onClick={confirmarFechamento} disabled={fechandoLista} style={styles.btnSalvar}>{fechandoLista ? "Processando..." : "✅ Confirmar e Publicar"}</button>
            <button onClick={() => setPreviewFechamento(null)} disabled={fechandoLista} style={styles.btnCancelar}>✕ Cancelar</button>
          </div>
        </div>
      )}

      <div style={styles.abas}>
        <button onClick={() => setAbaAtiva("jogos")} style={{ ...styles.aba, ...(abaAtiva === "jogos" ? styles.abaAtiva : {}) }}>🎾 Jogos</button>
        <button onClick={() => setAbaAtiva("convites")} style={{ ...styles.aba, ...(abaAtiva === "convites" ? styles.abaAtiva : {}) }}>🔗 Convites</button>
        <button onClick={() => setAbaAtiva("aprovacoes")} style={{ ...styles.aba, ...(abaAtiva === "aprovacoes" ? styles.abaAtiva : {}) }}>
          👤 Aprovações {pendentes.length > 0 && <span style={styles.badge}>{pendentes.length}</span>}
        </button>
        <button onClick={() => setAbaAtiva("atletas")} style={{ ...styles.aba, ...(abaAtiva === "atletas" ? styles.abaAtiva : {}) }}>👥 Atletas</button>
      </div>

      {/* ── ABA JOGOS ── */}
      {abaAtiva === "jogos" && (
        <>
          <div style={styles.card}>
            <label style={styles.label}>Rodada</label>
            <div style={styles.rodadasRow}>
              {rodadas.map((r) => (
                <button key={r.id} onClick={() => setRodadaSelecionada(r)}
                  style={{ ...styles.btnRodada, ...(rodadaSelecionada?.id === r.id ? styles.btnRodadaAtivo : {}) }}>
                  R{r.numero}
                  <span style={styles.rodadaTipo}>{r.tipo === "especial" ? "⭐" : ""}</span>
                  <span style={styles.rodadaData}>{new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                  <span style={{ fontSize: 9, color: r.status === "finalizada" ? "#5a8a6a" : r.status === "ativa" ? "#c9a227" : "#7fb89a" }}>{r.status}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.chaveRow}>
            {rodadaSelecionada?.tipo === "especial" ? (<>
              <button onClick={() => setChaveAtiva("time_a")} style={{ ...styles.btnChave, ...(chaveAtiva === "time_a" ? styles.btnOuroAtivo : styles.btnChaveInativo) }}>🔴 Time A</button>
              <button onClick={() => setChaveAtiva("time_b")} style={{ ...styles.btnChave, ...(chaveAtiva === "time_b" ? styles.btnPrataAtivo : styles.btnChaveInativo) }}>🔵 Time B</button>
            </>) : (<>
              <button onClick={() => setChaveAtiva("ouro")} style={{ ...styles.btnChave, ...(chaveAtiva === "ouro" ? styles.btnOuroAtivo : styles.btnChaveInativo) }}>🥇 Chave Ouro</button>
              <button onClick={() => setChaveAtiva("prata")} style={{ ...styles.btnChave, ...(chaveAtiva === "prata" ? styles.btnPrataAtivo : styles.btnChaveInativo) }}>🥈 Chave Prata</button>
            </>)}
          </div>

          {rodadaSelecionada?.tipo === "especial" && (
            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>👥 Configuração dos Times</h2>
              <p style={styles.infoText}>Selecione quais jogadores pertencem a cada time. O capitão escolhe no draft da sexta.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {["time_a", "time_b"].map(time => {
                  const cor = time === "time_a" ? "#e74c3c" : "#3498db";
                  const label = time === "time_a" ? "🔴 Time A" : "🔵 Time B";
                  const confirmadosNaoAlocados = (confirmacoes || [])
                    .map(c => c.jogadores?.nome)
                    .filter(n => n && !timesEspecial.time_a.includes(n) && !timesEspecial.time_b.includes(n));
                  return (
                    <div key={time}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: cor, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                        {label} ({timesEspecial[time].length})
                      </div>
                      {timesEspecial[time].map(nome => (
                        <div key={nome} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: `${cor}22`, borderRadius: 6, marginBottom: 4, border: `1px solid ${cor}44` }}>
                          <span style={{ fontSize: 12, color: "#e8f5e9" }}>{nome}</span>
                          <button onClick={() => setTimesEspecial(prev => ({ ...prev, [time]: prev[time].filter(n => n !== nome) }))}
                            style={{ background: "transparent", border: "none", color: cor, cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✕</button>
                        </div>
                      ))}
                      <select
                        onChange={e => {
                          const nome = e.target.value;
                          if (!nome) return;
                          setTimesEspecial(prev => ({ ...prev, [time]: [...prev[time], nome] }));
                          e.target.value = "";
                        }}
                        style={{ width: "100%", background: "#0f2d1e", border: `1px solid ${cor}66`, borderRadius: 6, padding: "6px 8px", color: "#e8f5e9", fontSize: 12, marginTop: 4 }}>
                        <option value="">+ Adicionar jogador</option>
                        {confirmadosNaoAlocados.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>🎲 Sorteio Manual {rodadaSelecionada && <span style={styles.badgeRodada}>R{rodadaSelecionada.numero} — {chaveAtiva}</span>}</h2>
            <p style={styles.infoText}>Use apenas para sorteios pontuais. Para fechar a rodada use o botão acima.</p>
            {rodadaSelecionada?.tipo !== "especial" && (
              <button onClick={gerarSorteioLocal} style={styles.btnSortear}>🎲 Gerar Sorteio Manual</button>
            )}
            {rodadaSelecionada?.tipo === "especial" && (
              <div style={{ background: "#1a3a20", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#c9a227", border: "1px solid rgba(201,162,39,0.3)" }}>
                ⭐ Rodada Especial — insira os jogos manualmente abaixo
              </div>
            )}
          </div>

          {rodadaSelecionada?.tipo !== "especial" && sorteioPreview && (
            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>👀 Preview do Sorteio</h2>
              {sorteioPreview.map((rj, r) => (
                <div key={r} style={{ marginBottom: 14 }}>
                  <div style={styles.rodadaJogosHeader}>Rodada {r + 1}</div>
                  {rj.map(([a1, a2, b1, b2], i) => (
                    <div key={i} style={styles.sorteioJogoRow}>
                      <span style={styles.sorteioNomes}>{a1} / {a2}</span>
                      <span style={styles.sorteioVs}>×</span>
                      <span style={styles.sorteioNomes}>{b1} / {b2}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={styles.botoesForm}>
                <button onClick={salvarSorteio} disabled={salvandoSorteio} style={styles.btnSalvar}>{salvandoSorteio ? "Salvando..." : "✅ Confirmar"}</button>
                <button onClick={() => { setSorteioPreview(null); setTimeout(gerarSorteioLocal, 100); }} style={styles.btnRegerar}>🔄</button>
                <button onClick={() => setSorteioPreview(null)} style={styles.btnCancelar}>✕</button>
              </div>
            </div>
          )}

          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>{editandoId ? "✏️ Editando placar" : "➕ Inserir placar"}</h2>
            <div style={styles.duplaSection}>
              <div style={styles.duplaLabel}>🎾 Dupla A</div>
              <div style={styles.duplaInputs}>
                <SelectJogador value={novoJogo.dupla_a_1} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_1: v })} placeholder="Jogador 1" />
                <SelectJogador value={novoJogo.dupla_a_2} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_2: v })} placeholder="Jogador 2" />
              </div>
            </div>
            <div style={styles.placarSection}>
              <input type="number" min="0" max="7" placeholder="0" value={novoJogo.placar_a} onChange={(e) => setNovoJogo({ ...novoJogo, placar_a: e.target.value })} style={styles.placarInput} />
              <span style={styles.placarVs}>×</span>
              <input type="number" min="0" max="7" placeholder="0" value={novoJogo.placar_b} onChange={(e) => setNovoJogo({ ...novoJogo, placar_b: e.target.value })} style={styles.placarInput} />
            </div>
            <div style={styles.duplaSection}>
              <div style={styles.duplaLabel}>🎾 Dupla B</div>
              <div style={styles.duplaInputs}>
                <SelectJogador value={novoJogo.dupla_b_1} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_1: v })} placeholder="Jogador 1" />
                <SelectJogador value={novoJogo.dupla_b_2} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_2: v })} placeholder="Jogador 2" />
              </div>
            </div>
            <div style={styles.botoesForm}>
              <button onClick={salvarJogo} disabled={salvando} style={styles.btnSalvar}>{salvando ? "Salvando..." : editandoId ? "💾 Atualizar" : "💾 Salvar"}</button>
              {editandoId && <button onClick={resetForm} style={styles.btnCancelar}>✕ Cancelar</button>}
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>📋 Jogos da rodada <span style={styles.badgeCount}>{jogos.length} jogos</span></h2>
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
                          <div style={{ ...styles.dupla, ...(venceuA ? styles.vencedor : {}) }}>{jogo.dupla_a_1}{jogo.dupla_a_2 ? ` / ${jogo.dupla_a_2}` : ""}</div>
                          <div style={styles.placarDisplay}>
                            {temPlacar ? (<><span style={venceuA ? styles.placarVencedor : styles.placarPerdedor}>{jogo.placar_a}</span><span style={styles.placarSep}>×</span><span style={!venceuA ? styles.placarVencedor : styles.placarPerdedor}>{jogo.placar_b}</span></>) : <span style={styles.semPlacar}>–</span>}
                          </div>
                          <div style={{ ...styles.dupla, ...(!venceuA ? styles.vencedor : {}), textAlign: "right" }}>{jogo.dupla_b_1}{jogo.dupla_b_2 ? ` / ${jogo.dupla_b_2}` : ""}</div>
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

          <div style={styles.card}>
            <h2 style={styles.cardTitulo}>🏆 Pontuação da Liga</h2>
            <p style={styles.infoText}>Calcule após inserir todos os placares das duas chaves.</p>
            {rodadaSelecionada?.tipo === "especial" && (
              <div style={{ background: "#1a3a20", border: "1px solid #c9a227", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#c9a227" }}>
                ⭐ Rodada Especial — pontuação dobrada aplicada automaticamente
              </div>
            )}
            <button onClick={calcularPontuacao} disabled={calculando} style={styles.btnCalcular}>{calculando ? "Calculando..." : "📊 Calcular Pontuação"}</button>
          </div>

          {rankingPreview && (
            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>👀 Preview — Confirmar antes de salvar</h2>
              {rodadaSelecionada?.tipo !== "especial" && (
                <div style={{ background: "#1a3a20", border: "1px solid #2a5a3a", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#7fb89a" }}>
                  ↓ Descem: <strong style={{ color: "#e74c3c" }}>{(rankingPreview.ouro || []).slice(-3).map(j => j.nome).join(", ")}</strong>
                  &nbsp;&nbsp;↑ Sobem: <strong style={{ color: "#2ecc71" }}>{(rankingPreview.prata || []).slice(0, 3).map(j => j.nome).join(", ")}</strong>
                </div>
              )}
              {["ouro", "prata"].map(chave => (
                <div key={chave} style={{ marginBottom: 16 }}>
                  <div style={{ ...styles.chaveHeader, color: chave === "ouro" ? ouro : prata }}>
                    {rodadaSelecionada?.tipo === "especial" ? "⭐ Resultado Especial" : chave === "ouro" ? "🥇 Chave Ouro" : "🥈 Chave Prata"}
                  </div>
                  {(rankingPreview[chave] || []).map((j, idx) => {
                    const total = (rankingPreview[chave] || []).length;
                    const desce = chave === "ouro" && idx >= total - 3 && rodadaSelecionada?.tipo !== "especial";
                    const sobe = chave === "prata" && idx < 3 && rodadaSelecionada?.tipo !== "especial";
                    const isVencedor = rodadaSelecionada?.tipo === "especial" && j.timeVencedor;
                    const isPerdedor = rodadaSelecionada?.tipo === "especial" && !j.timeVencedor;
                    return (
                      <div key={j.nome} style={{ ...styles.rankingRow, ...(desce ? { borderLeft: "3px solid #e74c3c" } : sobe ? { borderLeft: "3px solid #2ecc71" } : {}) }}>
                        <span style={styles.rankPos}>{idx + 1}º</span>
                        <span style={styles.rankNome}>{j.nome}</span>
                        <span style={styles.rankVit}>{j.vitorias}V</span>
                        <span style={styles.rankPts}>
                          {j.ptosLiga} pts
                          {rodadaSelecionada?.tipo === "especial" && (
                            <span style={{ fontSize: 10, marginLeft: 4, color: isVencedor ? "#2ecc71" : "#e74c3c" }}>
                              {isVencedor ? "🏆 vencedor" : "perdedor"}
                            </span>
                          )}
                        </span>
                        {desce && <span style={{ fontSize: 11, color: "#e74c3c" }}>↓</span>}
                        {sobe && <span style={{ fontSize: 11, color: "#2ecc71" }}>↑</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={styles.botoesForm}>
                <button onClick={salvarPontuacao} disabled={calculando} style={styles.btnSalvar}>{calculando ? "Salvando..." : "✅ Confirmar e Salvar"}</button>
                <button onClick={() => setRankingPreview(null)} style={styles.btnCancelar}>✕ Cancelar</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ABA CONVITES ── */}
      {abaAtiva === "convites" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>🔗 Gerar Convite</h2>
          <p style={styles.infoText}>Gere um link único válido por 7 dias e envie pelo WhatsApp.</p>
          <button onClick={gerarNovoConvite} disabled={gerandoConvite} style={styles.btnSalvar}>{gerandoConvite ? "Gerando..." : "🔗 Gerar novo link de convite"}</button>
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
                        <div style={styles.conviteData}>Criado: {new Date(c.created_at).toLocaleDateString("pt-BR")} • Expira: {new Date(c.expires_at).toLocaleDateString("pt-BR")}</div>
                        <div style={styles.conviteLink}>resenha-bt.vercel.app/cadastro?token={c.token.substring(0, 8)}...</div>
                      </div>
                      <div style={styles.jogoAcoes}>
                        {!c.usado && !expirado && <button onClick={() => copiarLink(c.token)} style={styles.btnCopiar}>📋</button>}
                        <button onClick={() => revogarConvite(c.id)} style={styles.btnDel}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      )}

      {/* ── ABA APROVAÇÕES ── */}
      {abaAtiva === "aprovacoes" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>
            👤 Cadastros Pendentes
            {pendentes.length > 0 && <span style={styles.badgeCount}>{pendentes.length}</span>}
          </h2>
          {loadingPendentes ? <p style={styles.loadingText}>Carregando...</p>
            : pendentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <p style={styles.emptyText}>Nenhum cadastro pendente.</p>
              </div>
            ) : pendentes.map((p) => {
              const vinc = vinculacoes[p.id] || {};
              const tipoSelecionado = vinc.tipo || "existente";
              return (
                <div key={p.id} style={styles.pendenteCard}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.pendenteNome}>{p.nome}</div>
                    <div style={styles.pendenteInfo}>📧 {p.email}</div>
                    {p.whatsapp && <div style={styles.pendenteInfo}>📱 {p.whatsapp}</div>}
                    <div style={styles.pendenteData}>Solicitado: {new Date(p.created_at).toLocaleDateString("pt-BR")}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => setVinculacao(p.id, "tipo", "existente")} style={{ ...styles.btnToggle, ...(tipoSelecionado === "existente" ? styles.btnToggleAtivo : {}) }}>Jogador existente</button>
                      <button onClick={() => setVinculacao(p.id, "tipo", "novo")} style={{ ...styles.btnToggle, ...(tipoSelecionado === "novo" ? styles.btnToggleAtivo : {}) }}>Novo jogador</button>
                    </div>
                    {tipoSelecionado === "existente" && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: "#7fb89a", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Vincular ao jogador</div>
                        <select value={vinc.jogadorId || ""} onChange={(e) => setVinculacao(p.id, "jogadorId", e.target.value)} style={{ ...styles.select, width: "100%" }}>
                          <option value="">— selecionar jogador —</option>
                          {jogadores.filter(j => !j.user_id).sort((a, b) => a.nome.localeCompare(b.nome)).map(j => (
                            <option key={j.id} value={j.id}>{j.nome} ({j.chave})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {tipoSelecionado === "novo" && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: "#7fb89a", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Apelido (nome curto no torneio)</div>
                        <input type="text" placeholder="Ex: Joao V." value={vinc.apelido || ""} onChange={(e) => setVinculacao(p.id, "apelido", e.target.value)} style={{ ...styles.select, width: "100%", boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: "#5a8a6a", marginTop: 4 }}>Entrará na Chave Prata automaticamente</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 8 }}>
                    <button onClick={() => aprovarCadastro(p)} disabled={aprovando === p.id} style={styles.btnAprovar}>{aprovando === p.id ? "..." : "✅ Aprovar"}</button>
                    <button onClick={() => rejeitarCadastro(p)} disabled={aprovando === p.id} style={styles.btnRejeitar}>{aprovando === p.id ? "..." : "✕ Rejeitar"}</button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── ABA ATLETAS ── */}
      {abaAtiva === "atletas" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitulo}>
            👥 Atletas Cadastrados
            <span style={styles.badgeCount}>{atletas.filter(a => a.user_id).length} com acesso</span>
          </h2>
          {loadingAtletas ? <p style={styles.loadingText}>Carregando...</p>
            : atletas.length === 0 ? <p style={styles.emptyText}>Nenhum atleta cadastrado.</p>
            : atletas.map((a) => (
              <div key={a.id} style={{ ...styles.pendenteCard, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={styles.pendenteNome}>{a.nome}</div>
                  {a.apelido && (
                    <div style={{ fontSize: 12, color: "#7fb89a", marginBottom: 4 }}>{a.apelido}</div>
                  )}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: a.chave === "ouro" ? ouro : prata, fontWeight: 700, textTransform: "uppercase" }}>
                      {a.chave === "ouro" ? "🥇" : "🥈"} {a.chave}
                    </span>
                    <span style={{ fontSize: 11, color: a.user_id ? "#2ecc71" : "#5a8a6a" }}>
                      {a.user_id ? "✅ Com acesso" : "⭕ Sem acesso"}
                    </span>
                  </div>
                </div>
                {a.user_id && (
                  <button onClick={() => revogarAcesso(a)} style={styles.btnRejeitar}>
                    🚫 Revogar
                  </button>
                )}
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
  cardDestaque: { background: "#1a3020", border: `2px solid ${ouro}`, borderRadius: 12, padding: 16, marginBottom: 16 },
  abas: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  aba: { flex: 1, minWidth: 70, padding: "10px 4px", borderRadius: 10, border: `1px solid ${borda}`, background: "#1e3d2a", color: "#5a8a6a", cursor: "pointer", fontWeight: 600, fontSize: 12 },
  abaAtiva: { background: verde, border: `1px solid ${ouro}`, color: ouro },
  badge: { background: "#c0392b", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 },
  card: { background: cardBg, border: `1px solid ${borda}`, borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitulo: { margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#c8e6c9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { fontSize: 12, color: "#7fb89a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" },
  rodadasRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  btnRodada: { background: "transparent", border: `1px solid ${borda}`, borderRadius: 8, color: "#9dbfac", padding: "6px 12px", cursor: "pointer", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  btnRodadaAtivo: { background: verde, border: `1px solid ${ouro}`, color: ouro, fontWeight: 700 },
  rodadaData: { fontSize: 10, opacity: 0.7 },
  rodadaTipo: { fontSize: 10 },
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
  btnFechar: { width: "100%", background: "#3a2000", border: `2px solid ${ouro}`, color: ouro, borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  btnRegerar: { background: "#1e3d2a", border: `1px solid ${borda}`, color: "#9dbfac", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnCopiar: { background: "#1a5c3a", border: `1px solid ${borda}`, color: "#7fd8a0", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 },
  btnAprovar: { background: "#1a5c3a", border: `1px solid #4a9a6a`, color: "#7fd8a0", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnRejeitar: { background: "transparent", border: `1px solid #c0392b`, color: "#e74c3c", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnToggle: { flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${borda}`, background: "#0f2d1e", color: "#5a8a6a", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  btnToggleAtivo: { background: verde, border: `1px solid ${ouro}`, color: ouro },
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
  rankingRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${borda}`, paddingLeft: 4 },
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
