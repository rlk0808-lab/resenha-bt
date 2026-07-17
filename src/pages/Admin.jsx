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

  // Estrutura fixa para 16 jogadores — sem repetir parceiro nem adversário
  const ESTRUTURA_CHAVE_16 = [
    // Rodada 1
    [[0,1,2,3], [4,5,6,7], [8,9,10,11], [12,13,14,15]],
    // Rodada 2
    [[0,4,8,12], [1,5,9,13], [2,6,10,14], [3,7,11,15]],
    // Rodada 3
    [[0,5,10,15], [1,4,11,14], [2,7,8,13], [3,6,9,12]],
    // Rodada 4
    [[0,6,11,13], [1,7,10,12], [2,4,9,15], [3,5,8,14]],
  ];

  function gerarSorteio(jogadores) {
    const n = jogadores?.length;
    if (!jogadores || (n !== 12 && n !== 16)) {
      console.error(`gerarSorteio: esperava 12 ou 16 jogadores, recebeu ${n}`);
      return null;
    }
    const slots = [...jogadores].sort(() => Math.random() - 0.5);
    const estrutura = n === 16 ? ESTRUTURA_CHAVE_16 : ESTRUTURA_CHAVE;
    const rodadas = estrutura.map(rodada =>
      rodada.map(([a1, a2, b1, b2]) => [slots[a1], slots[a2], slots[b1], slots[b2]])
    );
    const temInvalido = rodadas.some(r => r.some(([a1,a2,b1,b2]) => !a1 || !a2 || !b1 || !b2));
    if (temInvalido) {
      console.error('gerarSorteio: jogos com jogadores undefined');
      return null;
    }
    return rodadas;
  }

  export default function Admin({ session }) {
    const [abaAtiva, setAbaAtiva] = useState("jogos");
  const [formatoRodada, setFormatoRodada] = useState(() => {
    try {
      const salvo = localStorage.getItem('resenha_formato_rodada')
      return salvo ? JSON.parse(salvo) : { label: "24", ouro: 12, prata: 12, total: 24 }
    } catch { return { label: "24", ouro: 12, prata: 12, total: 24 } }
  });

  function setFormatoRodadaPersistido(f) {
    setFormatoRodada(f)
    localStorage.setItem('resenha_formato_rodada', JSON.stringify(f))
  }
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
    const [modalSubst, setModalSubst] = useState(false);
    const [substAusente, setSubstAusente] = useState("");
    const [substReserva, setSubstReserva] = useState("");
    const [substProcessando, setSubstProcessando] = useState(false);
    const [timesEspecial, setTimesEspecial] = useState({ time_a: [], time_b: [] });
    const [salvandoSorteio, setSalvandoSorteio] = useState(false);
    const [fechandoLista, setFechandoLista] = useState(false);
    const [previewFechamento, setPreviewFechamento] = useState(null);
    const [novoJogo, setNovoJogo] = useState({
      dupla_a_1: "", dupla_a_2: "", dupla_b_1: "", dupla_b_2: "", placar_a: "", placar_b: "",
    });
    const [editandoId, setEditandoId] = useState(null);
    const [placaresInline, setPlacaresInline] = useState({});
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
            .then(({ data }) => {
              setConfirmacoes(data || []);
              // Carrega times já salvos no banco
              const ta = (data || []).filter(c => c.time === "time_a").map(c => c.jogadores?.nome).filter(Boolean);
              const tb = (data || []).filter(c => c.time === "time_b").map(c => c.jogadores?.nome).filter(Boolean);
              console.log('Times:', ta, tb);
              setTimesEspecial({ time_a: ta, time_b: tb });
            });
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
      if (data && data.length > 0) {
        // Seleciona a rodada ativa, ou proxima, ou a última
        const ativa = data.find(r => r.status === "ativa")
          || data.find(r => r.status === "proxima")
          || data[data.length - 1];
        setRodadaSelecionada(ativa);
      }
    }

    const [confirmacoes, setConfirmacoes] = useState([]);

    async function carregarJogadores() {
      const { data } = await supabase.from("jogadores").select("*").order("nome", { ascending: true });
      setJogadores(data || []);
    }

    async function salvarSlot(jogoId, campo, valor) {
      await supabase.from("jogos").update({ [campo]: valor || null }).eq("id", jogoId)
      await carregarJogos()
    }

    async function carregarJogos() {
      setLoading(true);
      setRankingPreview(null);
      let query = supabase.from("jogos").select("*").eq("rodada_id", rodadaSelecionada.id);
      // Rodada especial: carrega todos os jogos (especial, time_a, time_b)
      if (rodadaSelecionada.tipo !== "especial") {
        query = query.eq("chave", chaveAtiva);
      }
      const { data } = await query.order("rodada_interna").order("id", { ascending: true });
      setJogos(data || []);
      setLoading(false);
    }

    async function salvarJogo() {
      if (!novoJogo.dupla_a_1 || !novoJogo.dupla_a_2 || !novoJogo.dupla_b_1 || !novoJogo.dupla_b_2) {
        mostrarMensagem("Preencha os jogadores das duas duplas.", "erro"); return;
      }
      setSalvando(true);
      const payload = {
        rodada_id: rodadaSelecionada.id, numero_rodada: rodadaSelecionada.numero,
        dupla_a_1: novoJogo.dupla_a_1, dupla_a_2: novoJogo.dupla_a_2 || null,
        dupla_b_1: novoJogo.dupla_b_1, dupla_b_2: novoJogo.dupla_b_2 || null,
        placar_a: novoJogo.placar_a !== "" ? parseInt(novoJogo.placar_a) : null,
        placar_b: novoJogo.placar_b !== "" ? parseInt(novoJogo.placar_b) : null,
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

    async function salvarPlacarInline(jogoId) {
      const p = placaresInline[jogoId];
      if (!p || p.a === "" || p.b === "") return;
      const pa = parseInt(p.a);
      const pb = parseInt(p.b);
      if (isNaN(pa) || isNaN(pb)) return;
      const tieA = placaresInline[jogoId]?.ta !== undefined && placaresInline[jogoId]?.ta !== "" ? parseInt(placaresInline[jogoId].ta) : undefined;
    const tieB = placaresInline[jogoId]?.tb !== undefined && placaresInline[jogoId]?.tb !== "" ? parseInt(placaresInline[jogoId].tb) : undefined;
    const updateData = { placar_a: pa, placar_b: pb };
    if (!isNaN(tieA) && !isNaN(tieB)) { updateData.tie_a = tieA; updateData.tie_b = tieB; }
    await supabase.from("jogos").update(updateData).eq("id", jogoId);
      await carregarJogos();
      setPlacaresInline(prev => { const n = {...prev}; delete n[jogoId]; return n; });
    }

    function editarJogo(jogo) {
      setEditandoId(jogo.id);
      setNovoJogo({
        dupla_a_1: jogo.dupla_a_1 || "", dupla_a_2: jogo.dupla_a_2 || "",
        dupla_b_1: jogo.dupla_b_1 || "", dupla_b_2: jogo.dupla_b_2 || "",
        placar_a: jogo.placar_a ?? "", placar_b: jogo.placar_b ?? "", tie_a: jogo.tie_a ?? "", tie_b: jogo.tie_b ?? "",
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
      const totalEsperado = formatoRodada.total;
      const vagas = totalEsperado - totalConfirmados;
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

      // Busca ranking da última rodada finalizada para calcular subida/descida
      const { data: rodadasFinalizadas } = await supabase.from("rodadas").select("*")
        .eq("status", "finalizada").order("numero", { ascending: false });
      const rodAntNormal = rodadasFinalizadas?.find(r => r.tipo !== "especial") || rodadasFinalizadas?.[0];

      const nomeConfirmados = new Set(confirmacoes.map(c => c.jogadores?.nome));
      let jogadoresOuro = [];
      let jogadoresPrata = [];

      if (!rodAntNormal) {
        // Primeira rodada: usa chave do banco
        jogadoresOuro = confirmacoes.filter(c => c.jogadores?.chave === "ouro").map(c => c.jogadores?.nome);
        jogadoresPrata = confirmacoes.filter(c => c.jogadores?.chave === "prata").map(c => c.jogadores?.nome);
      } else {
        const { data: rankAnt } = await supabase.from("ranking_rodada")
          .select("*, jogadores(id, nome)")
          .eq("rodada_id", rodAntNormal.id)
          .order("posicao", { ascending: true });

        const rankOuro = (rankAnt || []).filter(r => r.chave === "ouro");
        const rankPrata = (rankAnt || []).filter(r => r.chave === "prata");

        // Os 3 últimos da Ouro descem
        const ouroDescem = new Set(rankOuro.slice(-3).map(r => r.jogadores?.nome));

        // Ouro que fica (posições 1-9 que confirmaram)
        const ouroFicam = rankOuro
          .filter(r => !ouroDescem.has(r.jogadores?.nome) && nomeConfirmados.has(r.jogadores?.nome))
          .map(r => r.jogadores?.nome);
        // Prata confirmada ordenada por posicao
        const prataTodos = rankPrata
          .filter(r => nomeConfirmados.has(r.jogadores?.nome))
          .sort((a, b) => a.posicao - b.posicao);
        // Top 3 da Prata que confirmaram (sempre sobem)
        const prataSobemFixos = prataTodos.filter(r => r.posicao <= 3).map(r => r.jogadores?.nome);
        // Vagas não preenchidas pelos top 3 (ex: 1º não confirmou)
        const vagasFixasNaoPreenchidas = 3 - prataSobemFixos.length;
        // Faltas na Ouro (pos 1-9)
        const ouroEfetivos = rankOuro.filter(r => !ouroDescem.has(r.jogadores?.nome));
        const qtdFaltasEfetivas = ouroEfetivos.filter(r => !nomeConfirmados.has(r.jogadores?.nome)).length;
        // Sobe pos 4, 5, 6 da Prata por falta na Ouro
        const prataSobemExtras = prataTodos.filter(r => r.posicao >= 4 && r.posicao <= 6)
          .slice(0, qtdFaltasEfetivas).map(r => r.jogadores?.nome);
        // Vagas ainda restantes → mantém 10º, 11º, 12º da Ouro
        const vagasRestantes = qtdFaltasEfetivas - prataSobemExtras.length + vagasFixasNaoPreenchidas;
        const ouroMantem = [];
        if (vagasRestantes > 0) {
          [10, 11, 12].slice(0, vagasRestantes).forEach(pos => {
            const jogPos = rankOuro.find(r => r.posicao === pos);
            if (jogPos && nomeConfirmados.has(jogPos.jogadores?.nome)) {
              ouroMantem.push(jogPos.jogadores?.nome);
            }
          });
        }
        // Se ainda faltar → sobe pos 7, 8, 9... da Prata
        const vagasAindaRestantes = vagasRestantes - ouroMantem.length;
        const prataSobemUltimos = vagasAindaRestantes > 0
          ? prataTodos.filter(r => r.posicao >= 7).slice(0, vagasAindaRestantes).map(r => r.jogadores?.nome)
          : [];
        const prataSobem = [...prataSobemFixos, ...prataSobemExtras, ...prataSobemUltimos];
        jogadoresOuro = [...ouroFicam, ...ouroMantem, ...prataSobem];

        jogadoresOuro = [...ouroFicam, ...ouroMantem, ...prataSobem];
        const nomesOuro = new Set(jogadoresOuro);

        // Prata: todos os confirmados que não foram para Ouro
        const nomesUsados = new Set(nomesOuro);
        jogadoresPrata = [];
        prataTodos.slice(prataSobem.length).forEach(r => {
          if (!nomesUsados.has(r.jogadores?.nome)) { jogadoresPrata.push(r.jogadores?.nome); nomesUsados.add(r.jogadores?.nome); }
        });
        // Quem desceu da Ouro e confirmou
        ouroDescem.forEach(nome => {
          if (nomeConfirmados.has(nome) && !nomesUsados.has(nome)) { jogadoresPrata.push(nome); nomesUsados.add(nome); }
        });
        // Confirmados que não aparecem no ranking (estreantes)
        confirmacoes.forEach(c => {
          const nome = c.jogadores?.nome;
          if (nome && !nomesUsados.has(nome)) { jogadoresPrata.push(nome); nomesUsados.add(nome); }
        });

        // Atualiza a chave dos jogadores no banco de acordo com a prévia
        for (const nome of jogadoresOuro) {
          const jog = confirmacoes.find(c => c.jogadores?.nome === nome)?.jogadores;
          if (jog && jog.chave !== "ouro") await supabase.from("jogadores").update({ chave: "ouro" }).eq("id", jog.id);
        }
        for (const nome of jogadoresPrata) {
          const jog = confirmacoes.find(c => c.jogadores?.nome === nome)?.jogadores;
          if (jog && jog.chave !== "prata") await supabase.from("jogadores").update({ chave: "prata" }).eq("id", jog.id);
        }
      }

      // Ajusta para garantir exatamente 12 em cada chave quando possível
      // Se sobrar jogadores (ex: prata com 13), move para prata
      // Se faltar (ex: ouro com 11), avisa mas permite continuar
      console.log("Ouro:", jogadoresOuro.length, jogadoresOuro);
      console.log("Prata:", jogadoresPrata.length, jogadoresPrata);

      if (jogadoresOuro.length < 4) { mostrarMensagem(`Ouro com ${jogadoresOuro.length} confirmados. Mínimo 4.`, "erro"); return; }
      if (jogadoresPrata.length < 4) { mostrarMensagem(`Prata com ${jogadoresPrata.length} confirmados. Mínimo 4.`, "erro"); return; }
      
      // Garante múltiplo de 4 em cada chave para o sorteio funcionar
      while (jogadoresOuro.length % 4 !== 0 && jogadoresPrata.length > 4) {
        jogadoresPrata.unshift(jogadoresOuro.pop());
      }

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

      const insertsOuro = sorteioOuro.flatMap((rj, ri) => rj.map(([a1, a2, b1, b2]) => ({ rodada_id: rodada.id, numero_rodada: rodada.numero, dupla_a_1: a1, dupla_a_2: a2, dupla_b_1: b1, dupla_b_2: b2, placar_a: null, placar_b: null, chave: "ouro", rodada_interna: ri + 1 })));
      const insertsPrata = sorteioPrata.flatMap((rj, ri) => rj.map(([a1, a2, b1, b2]) => ({ rodada_id: rodada.id, numero_rodada: rodada.numero, dupla_a_1: a1, dupla_a_2: a2, dupla_b_1: b1, dupla_b_2: b2, placar_a: null, placar_b: null, chave: "prata", rodada_interna: ri + 1 })));

      await supabase.from("jogos").delete().eq("rodada_id", rodada.id).is("placar_a", null);
      const { error: erroInsert } = await supabase.from("jogos").insert([...insertsOuro, ...insertsPrata]);
      if (erroInsert) { mostrarMensagem("Erro ao salvar jogos: " + erroInsert.message, "erro"); setFechandoLista(false); return; }

      await supabase.from("rodadas").update({ status: "ativa" }).eq("id", rodada.id);
      await carregarJogadores();
      await carregarRodadas();
      setPreviewFechamento(null);
      setFechandoLista(false);
      await enviarNotificacao("Sorteio publicado!", `O sorteio da Rodada ${rodada.numero} foi publicado. Confira seus jogos!`, "/rodada");
      mostrarMensagem(`Lista fechada! Sorteio publicado para a Rodada ${rodada.numero}.`);
    }
  async function enviarLembrete(titulo, corpo) {
    await enviarNotificacao(titulo, corpo, "/confirmacao");
    mostrarMensagem("Lembrete enviado para todos!");
  }

  async function enviarNotificacao(titulo, corpo, url, jogadorIds) {
      try {
        let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
        if (jogadorIds && jogadorIds.length > 0) query = query.in("jogador_id", jogadorIds);
        const { data: subs } = await query;
        if (!subs || subs.length === 0) return;
        await fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptions: subs, title: titulo, body: corpo, url })
        });
      } catch (e) { console.error("Erro notificacao:", e); }
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
      jogadoresList.sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.saldo !== a.saldo ? b.saldo - a.saldo : (b.saldoTie || 0) !== (a.saldoTie || 0) ? (b.saldoTie || 0) - (a.saldoTie || 0) : ((confrontos[b.nome]?.[a.nome] || 0) - (confrontos[a.nome]?.[b.nome] || 0)));

      if (ehEspecial) {
        // Rodada especial: times definidos pelo campo chave do jogo
        // Usa timesEspecial (do estado) para saber o time de cada jogador
        // Calcula total de pontos do dia por time para determinar vencedor
        const ptsPorTime = { time_a: 0, time_b: 0 };

        jogadoresList.forEach(j => {
          const meuTime = timesEspecial.time_a.includes(j.nome) ? "time_a"
                        : timesEspecial.time_b.includes(j.nome) ? "time_b"
                        : "time_a"; // fallback
          ptsPorTime[meuTime] += j.pts;
          j.time = meuTime;
        });

        const timeVencedor = ptsPorTime.time_a >= ptsPorTime.time_b ? "time_a" : "time_b";

        jogadoresList.forEach((j, idx) => {
          const isVencedor = j.time === timeVencedor;
          j.ptosLiga = (isVencedor ? 40 : 10) + j.vitorias * 3;
          j.posicao = idx + 1;
          j.timeVencedor = isVencedor;
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
        const todosJogosEspecial = todosJogos.filter(j => j.chave === "especial" || j.chave === "time_a" || j.chave === "time_b");
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

  async function calcularBadges(rodadaId, ranking) {
    if (!ranking) return;
    const { data: jogsDB } = await supabase.from("jogadores").select("id, nome, chave");
    if (!jogsDB) return;
    const { data: jogosRodada } = await supabase.from("jogos").select("*").eq("rodada_id", rodadaId);
    const findJog = (nome) => jogsDB.find(j => j.nome === nome);
    const badges = [];
    const todosRanking = [...(ranking.ouro || []), ...(ranking.prata || [])];
    const campeaoOuro = ranking.ouro?.[0];
    if (campeaoOuro) { const jog = findJog(campeaoOuro.nome); if (jog) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "campeao_ouro" }); }
    const campeaoPrata = ranking.prata?.[0];
    if (campeaoPrata) { const jog = findJog(campeaoPrata.nome); if (jog) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "campeao_prata" }); }
    const ultimoOuro = ranking.ouro?.[(ranking.ouro?.length || 0) - 1];
    if (ultimoOuro) { const jog = findJog(ultimoOuro.nome); if (jog) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "congelado" }); }
    const ultimoPrata = ranking.prata?.[(ranking.prata?.length || 0) - 1];
    if (ultimoPrata) { const jog = findJog(ultimoPrata.nome); if (jog) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "congelado" }); }
    for (const j of todosRanking) {
      const jog = findJog(j.nome); if (!jog) continue;
      if (j.vitorias >= 4) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "dia_perfeito" });
      else if (j.vitorias >= 3) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "hat_trick" });
      if (j.vitorias === 0) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "dia_negro" });
    }
    for (const j of (ranking.ouro || []).slice(-3)) { const jog = findJog(j.nome); if (jog) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "queda_livre" }); }
    for (const j of (ranking.prata || []).slice(0, 3)) { const jog = findJog(j.nome); if (jog) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "ascensao" }); }
    if (jogosRodada) {
      const statsJog = {};
      for (const jogo of jogosRodada) {
        if (jogo.placar_a === null || jogo.placar_b === null) continue;
        const lados = [
          { nome: jogo.dupla_a_1, meu: jogo.placar_a, adv: jogo.placar_b },
          { nome: jogo.dupla_a_2, meu: jogo.placar_a, adv: jogo.placar_b },
          { nome: jogo.dupla_b_1, meu: jogo.placar_b, adv: jogo.placar_a },
          { nome: jogo.dupla_b_2, meu: jogo.placar_b, adv: jogo.placar_a },
        ].filter(x => x.nome);
        for (const { nome, meu, adv } of lados) {
          if (!statsJog[nome]) statsJog[nome] = { saldo: 0, tomouPneu: false, vitoriasRelamp: 0, derrotas: 0, todosDiff3: true, total: 0 };
          const venceu = meu > adv;
          statsJog[nome].saldo += (meu - adv);
          statsJog[nome].total++;
          if (venceu) { if (adv <= 1) statsJog[nome].vitoriasRelamp++; }
          else {
            statsJog[nome].derrotas++;
            if (meu === 0) statsJog[nome].tomouPneu = true;
            if (adv - meu < 3) statsJog[nome].todosDiff3 = false;
          }
        }
      }
      const maxSaldo = Math.max(...Object.values(statsJog).map(s => s.saldo));
      for (const [nome, s] of Object.entries(statsJog)) {
        const jog = findJog(nome); if (!jog) continue;
        if (s.saldo === maxSaldo && maxSaldo > 0) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "artilheiro" });
        if (s.tomouPneu) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "pneu" });
        if (s.derrotas === s.total && s.total > 0 && s.todosDiff3) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "dormindo" });
        const rankJ = todosRanking.find(r => r.nome === nome);
        if (rankJ && rankJ.vitorias === s.total && s.vitoriasRelamp === s.total && s.total > 0) badges.push({ jogador_id: jog.id, rodada_id: rodadaId, tipo: "relampago" });
      }
    }
    if (badges.length > 0) {
      await supabase.from("badges").upsert(badges, { onConflict: "jogador_id,rodada_id,tipo", ignoreDuplicates: true });
    }
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
        // 1. Os 3 últimos da Ouro descem
        for (const nome of (rankingPreview.ouro || []).slice(-3).map(j => j.nome)) {
          const jog = jogadores.find(jg => jg.nome === nome);
          if (jog) await supabase.from("jogadores").update({ chave: "prata" }).eq("id", jog.id);
        }
        // 2. Os 3 primeiros da Prata sobem
        for (const nome of (rankingPreview.prata || []).slice(0, 3).map(j => j.nome)) {
          const jog = jogadores.find(jg => jg.nome === nome);
          if (jog) await supabase.from("jogadores").update({ chave: "ouro" }).eq("id", jog.id);
        }
        // 3. Jogadores da Ouro que NÃO jogaram esta rodada → descem para Prata
        const nomesQueJogaram = new Set([
          ...(rankingPreview.ouro || []).map(j => j.nome),
          ...(rankingPreview.prata || []).map(j => j.nome),
        ]);
        const jogadoresOuroQueFaltaram = jogadores.filter(
          jg => jg.chave === "ouro" && !nomesQueJogaram.has(jg.nome)
        );
        for (const jog of jogadoresOuroQueFaltaram) {
          await supabase.from("jogadores").update({ chave: "prata" }).eq("id", jog.id);
        }
        if (jogadoresOuroQueFaltaram.length > 0) {
          console.log("Rebaixados por falta:", jogadoresOuroQueFaltaram.map(j => j.nome));
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
        await enviarNotificacao("Lista aberta!", `A lista para a Rodada ${proximoNumero} esta aberta. Confirme sua presenca!`, "/confirmacao");
        mostrarMensagem(`✅ Pontuação salva! Rodada ${proximoNumero} criada.`);
      } else {
        await enviarNotificacao("Resultado da Rodada " + rodadaSelecionada.numero + "!", "A pontuacao foi calculada. Confira a classificacao!", "/classificacao");
      mostrarMensagem("✅ Pontuação salva e chaves atualizadas!");
      }

      // Calcula badges da rodada
      await calcularBadges(rodadaSelecionada.id, rankingPreview);

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

    async function substituirJogador() {
      if (!substAusente || !substReserva || !rodadaSelecionada) return;
      setSubstProcessando(true);

      const jogadorAusente = jogadores.find(j => j.nome === substAusente);
      if (!jogadorAusente) { mostrarMensagem("Jogador ausente não encontrado.", "erro"); setSubstProcessando(false); return; }

      const { data: jogosRodada } = await supabase.from("jogos").select("*").eq("rodada_id", rodadaSelecionada.id);
      if (!jogosRodada) { mostrarMensagem("Erro ao buscar jogos.", "erro"); setSubstProcessando(false); return; }

      if (jogadorAusente.chave === "ouro") {
        // Busca ranking anterior da prata para pegar o 1º
        const { data: rodAntData } = await supabase.from("rodadas").select("id").eq("status","finalizada").order("numero",{ascending:false}).limit(1);
        const rodAntId = rodAntData?.[0]?.id;
        const { data: rankAnt } = await supabase.from("ranking_rodada")
          .select("*, jogadores(nome)")
          .eq("rodada_id", rodAntId)
          .eq("chave", "prata")
          .order("posicao", {ascending: true});

        const nomesNosJogos = new Set(jogosRodada.flatMap(j => [j.dupla_a_1, j.dupla_a_2, j.dupla_b_1, j.dupla_b_2].filter(Boolean)));
        const primeiroPrata = rankAnt?.find(r => nomesNosJogos.has(r.jogadores?.nome))?.jogadores?.nome;

        if (!primeiroPrata) { mostrarMensagem("Não foi possível identificar o 1º da Prata.", "erro"); setSubstProcessando(false); return; }

        const updates = [];
        for (const jogo of jogosRodada) {
          const campos = {};
          if (jogo.chave === "ouro") {
            if (jogo.dupla_a_1 === substAusente) campos.dupla_a_1 = primeiroPrata;
            if (jogo.dupla_a_2 === substAusente) campos.dupla_a_2 = primeiroPrata;
            if (jogo.dupla_b_1 === substAusente) campos.dupla_b_1 = primeiroPrata;
            if (jogo.dupla_b_2 === substAusente) campos.dupla_b_2 = primeiroPrata;
          }
          if (jogo.chave === "prata") {
            if (jogo.dupla_a_1 === primeiroPrata) campos.dupla_a_1 = substReserva;
            if (jogo.dupla_a_2 === primeiroPrata) campos.dupla_a_2 = substReserva;
            if (jogo.dupla_b_1 === primeiroPrata) campos.dupla_b_1 = substReserva;
            if (jogo.dupla_b_2 === primeiroPrata) campos.dupla_b_2 = substReserva;
          }
          if (Object.keys(campos).length > 0) updates.push(supabase.from("jogos").update(campos).eq("id", jogo.id));
        }
        await Promise.all(updates);
        mostrarMensagem(`✅ ${substAusente} → ${primeiroPrata} (Ouro) | ${primeiroPrata} → ${substReserva} (Prata)`);
      } else {
        // Prata: substitui direto
        const updates = [];
        for (const jogo of jogosRodada) {
          const campos = {};
          if (jogo.dupla_a_1 === substAusente) campos.dupla_a_1 = substReserva;
          if (jogo.dupla_a_2 === substAusente) campos.dupla_a_2 = substReserva;
          if (jogo.dupla_b_1 === substAusente) campos.dupla_b_1 = substReserva;
          if (jogo.dupla_b_2 === substAusente) campos.dupla_b_2 = substReserva;
          if (Object.keys(campos).length > 0) updates.push(supabase.from("jogos").update(campos).eq("id", jogo.id));
        }
        await Promise.all(updates);
        mostrarMensagem(`✅ ${substAusente} substituído por ${substReserva} na Prata.`);
      }

      setModalSubst(false);
      setSubstAusente("");
      setSubstReserva("");
      await carregarJogos();
      setSubstProcessando(false);
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

    async function imprimirRodada(chave) {
      if (!rodadaSelecionada) { mostrarMensagem("Selecione uma rodada primeiro.", "erro"); return; }
      // Abre a janela ANTES do await para não ser bloqueado pelo Safari
      const win = window.open("", "_blank")
      if (!win) { mostrarMensagem("Permita pop-ups para imprimir.", "erro"); return; }
      win.document.write("<html><body><p>Carregando...</p></body></html>")
      const { data: jogosChave } = await supabase.from("jogos").select("*")
        .eq("rodada_id", rodadaSelecionada.id).eq("chave", chave).order("rodada_interna")
      if (!jogosChave || jogosChave.length === 0) { win.close(); mostrarMensagem("Nenhum jogo na chave " + chave, "erro"); return; }
      const gruposMap = {}
      jogosChave.forEach(j => { const r = j.rodada_interna || 1; if (!gruposMap[r]) gruposMap[r] = []; gruposMap[r].push(j); })
      const grupos = Object.keys(gruposMap).map(Number).sort((a,b) => a-b)
      const corChave = chave === "ouro" ? "#c9a227" : "#8e9eab"
      const nomeChave = chave === "ouro" ? "CHAVE OURO" : "CHAVE PRATA"
      const dataRodada = rodadaSelecionada ? new Date(rodadaSelecionada.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }) : ""
      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Resenha BT - R${rodadaSelecionada?.numero} - ${nomeChave}</title><style>@page{size:A4;margin:8mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1a1a1a;font-size:11px}.header{display:flex;align-items:center;gap:10px;border-bottom:2px solid ${corChave};padding-bottom:6px;margin-bottom:10px}.header img{width:40px;height:40px;border-radius:8px}.header h1{font-size:16px;color:${corChave};letter-spacing:2px;font-weight:900}.header h2{font-size:11px;color:#444;margin-top:1px}.header h3{font-size:10px;color:#888;margin-top:1px}.ri{margin-bottom:10px;break-inside:avoid}.ri-titulo{background:${corChave}22;border-left:3px solid ${corChave};padding:3px 8px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${corChave};margin-bottom:4px}.jogo{display:flex;align-items:center;padding:5px 8px;border:1px solid #e0e0e0;border-radius:5px;margin-bottom:3px;background:#fafafa}.dupla{flex:1}.j1{font-size:11px;font-weight:700}.j2{font-size:9px;color:#666;margin-top:1px}.placar{display:flex;align-items:center;gap:6px;padding:0 10px}.pbox{width:32px;height:28px;border:2px solid #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#ccc}.vs{font-size:9px;color:#999;font-weight:700}</style></head><body><div class="header"><img src="https://resenha-bt.vercel.app/logo.png" onerror="this.style.display='none'"/><div><h1>RESENHA BT</h1><h2>Rodada ${rodadaSelecionada?.numero} — ${nomeChave} · ${jogosChave.length} jogos</h2><h3>${dataRodada} · 08h00 · Verônica Beach Tennis</h3></div></div>${grupos.map(gi => `<div class="ri"><div class="ri-titulo">Rodada ${gi}</div>${gruposMap[gi].map(j => `<div class="jogo"><div class="dupla"><div class="j1">${j.dupla_a_1}</div><div class="j2">${j.dupla_a_2||""}</div></div><div class="placar"><div class="pbox"></div><div class="vs">×</div><div class="pbox"></div></div><div class="dupla" style="text-align:right"><div class="j1">${j.dupla_b_1}</div><div class="j2">${j.dupla_b_2||""}</div></div></div>`).join("")}</div>`).join("")}<div style='text-align:center;margin-top:12px;display:none' class='no-print'><button onclick='window.close()' style='padding:8px 20px;border:1px solid #ccc;border-radius:6px;cursor:pointer;font-size:12px'>✕ Fechar</button></div><style>@media print{.no-print{display:none!important}}@media screen{.no-print{display:block!important}}</style><script>window.onload=()=>{window.print()}</script></body></html>`
      win.document.open()
      win.document.write(html)
      win.document.close()
    }

    function expandirFormato(novoFormato) {
      setFormatoRodadaPersistido(novoFormato);
      mostrarMensagem(`✅ Formato ${novoFormato.label} atletas selecionado! Use o botão "Promover para Lista Principal" para subir atletas da espera.`);
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
      const vagas = formatoRodada.total - total;

      if (vagas <= 0) {
        mostrarMensagem(`Lista principal já está completa (${formatoRodada.total}/${formatoRodada.total}).`, "info");
        setPromovendo(false); return;
      }
      if (listaEsperaAdmin.length === 0) {
        mostrarMensagem("Lista de espera está vazia.", "info");
        setPromovendo(false); return;
      }

      const promover = listaEsperaAdmin.slice(0, vagas);
      for (const c of promover) {
        await supabase.from("confirmacoes").update({ status: "confirmado" }).eq("id", c.id);
        const jogId = c.jogadores?.id || c.jogador_id;
        if (jogId) {
          const { data: sub } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("jogador_id", jogId);
          if (sub && sub.length > 0) {
            await fetch("/api/send-notification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptions: sub, title: "Voce entrou na lista!", body: "Voce foi promovido da lista de espera para a lista principal. Ate sabado!", url: "/confirmacao" }) });
          }
        }
      }
      mostrarMensagem(`✅ ${promover.length} jogador(es) promovido(s) da lista de espera!`);
      await carregarListaEspera();
      setPromovendo(false);
    }

    // Na especial: dupla A = Time A, dupla B = Time B (fixo, independente da aba)
    const SelectJogador = ({ value, onChange, placeholder, dupla }) => {
      let lista;
      if (rodadaSelecionada?.tipo === "especial") {
        // dupla "a" mostra Time A, dupla "b" mostra Time B
        const time = dupla === "a" ? "time_a" : "time_b";
        lista = (timesEspecial[time] || []).map(nome => ({ key: nome, label: nome }));
      } else {
        lista = jogadores.map(j => ({ key: j.id, label: j.nome + " (" + j.chave + ")" }));
      }
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
          <option value="">{placeholder || "— selecionar —"}</option>
          {lista.map(j => <option key={j.key} value={dupla ? j.label.split(" (")[0] : j.label}>{j.label}</option>)}
        </select>
      );
    };

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

        <div style={{ background: "#1a3020", border: "1px solid #2a5a3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#7fb89a", marginBottom: 10 }}>👥 Formato da Rodada</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {[
              { label: "24", sub: "12🥇+12🥈", ouro: 12, prata: 12, total: 24 },
              { label: "28", sub: "12🥇+16🥈", ouro: 12, prata: 16, total: 28 },
              { label: "32", sub: "16🥇+16🥈", ouro: 16, prata: 16, total: 32 },
            ].map(f => (
              <button key={f.label} onClick={() => expandirFormato(f)} style={{
                flex: 1, padding: "10px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14, textAlign: "center",
                background: formatoRodada.total === f.total ? "#c9a227" : "rgba(255,255,255,0.08)",
                color: formatoRodada.total === f.total ? "#0d2b1a" : "rgba(255,255,255,0.5)",
              }}>
                <div>{f.label}</div>
                <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{f.sub}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Ao expandir, atletas da lista de espera são promovidos automaticamente
          </div>
        </div>

        <div style={{ background: "#1a3020", border: "1px solid #2a5a3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#7fb89a", marginBottom: 10 }}>📢 Lembretes de Confirmacao</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => enviarLembrete("Faltam 2 dias!", "A lista de confirmacao fecha na quarta as 10h. Confirme sua presenca!")} style={{ flex: 1, background: "#1a3a20", border: "1px solid #2a5a3a", borderRadius: 8, color: "#7fb89a", padding: "8px 4px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📅 2 dias
            </button>
            <button onClick={() => enviarLembrete("Falta 1 dia!", "A lista fecha amanha as 10h. Confirme sua presenca!")} style={{ flex: 1, background: "#1a3a20", border: "1px solid #2a5a3a", borderRadius: 8, color: "#7fb89a", padding: "8px 4px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📅 1 dia
            </button>
            <button onClick={() => enviarLembrete("Ultimas 12 horas!", "A lista fecha hoje as 10h. Corra e confirme sua presenca!")} style={{ flex: 1, background: "#1a3a20", border: "1px solid #2a5a3a", borderRadius: 8, color: "#c0392b", padding: "8px 4px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              ⚡ 12h
            </button>
          </div>
        </div>

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
                <p style={styles.infoText}>Selecione quais jogadores pertencem a cada time.</p>
                {["time_a", "time_b"].map(time => {
                  const cor = time === "time_a" ? "#e74c3c" : "#3498db";
                  const label = time === "time_a" ? "🔴 Time A" : "🔵 Time B";
                  const isAtivo = chaveAtiva === time;
                  if (!isAtivo) return null;
                  const confirmadosNaoAlocados = jogadores
                    .filter(j => j.nome && !timesEspecial.time_a.includes(j.nome) && !timesEspecial.time_b.includes(j.nome))
                    .map(j => j.nome)
                    .sort();
                  return (
                    <div key={time}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: cor, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                        {label} — {timesEspecial[time].length} jogadores
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        {timesEspecial[time].map(nome => (
                          <div key={nome} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: cor + "22", borderRadius: 20, border: "1px solid " + cor + "55" }}>
                            <span style={{ fontSize: 13, color: "#e8f5e9" }}>{nome}</span>
                            <button onClick={async () => {
                              const jog = jogadores.find(j => j.nome === nome);
                              if (jog) await supabase.from("confirmacoes").update({ time: null }).eq("jogador_id", jog.id).eq("rodada_id", rodadaSelecionada.id);
                              setTimesEspecial(prev => ({ ...prev, [time]: prev[time].filter(n => n !== nome) }));
                            }} style={{ background: "transparent", border: "none", color: cor, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                          </div>
                        ))}
                        {timesEspecial[time].length === 0 && (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>Nenhum jogador adicionado</span>
                        )}
                      </div>
                      <select
                        onChange={async e => {
                          const nome = e.target.value;
                          if (!nome) return;
                          const jog = jogadores.find(j => j.nome === nome);
                          if (jog) {
                            const { error } = await supabase.from("confirmacoes").update({ time }).eq("jogador_id", jog.id).eq("rodada_id", rodadaSelecionada.id);
                            if (error) console.error("Erro ao salvar time:", error);
                          }
                          setTimesEspecial(prev => ({ ...prev, [time]: [...prev[time], nome] }));
                          e.target.value = "";
                        }}
                        style={{ width: "100%", background: "#0f2d1e", border: "1px solid " + cor + "66", borderRadius: 8, padding: "8px 10px", color: "#e8f5e9", fontSize: 13, marginTop: 4 }}>
                        <option value="">+ Adicionar jogador ao {label}</option>
                        {confirmadosNaoAlocados.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>🎲 Sorteio Manual {rodadaSelecionada && <span style={styles.badgeRodada}>R{rodadaSelecionada.numero} — {chaveAtiva}</span>}</h2>
              <p style={styles.infoText}>Use apenas para sorteios pontuais. Para fechar a rodada use o botão acima.</p>
              {rodadaSelecionada?.tipo !== "especial" && (
                <button onClick={gerarSorteioLocal} style={styles.btnSortear}>🎲 Gerar Sorteio Manual</button>
              )}
              {rodadaSelecionada?.tipo === "especial" && jogos.filter(j => j.chave === "especial").length > 0 && (() => {
                const jogosEsp = jogos.filter(j => j.chave === "especial")
                const gruposMap = {}
                jogosEsp.forEach(j => { const r = j.rodada_interna || 1; if (!gruposMap[r]) gruposMap[r] = []; gruposMap[r].push(j) })
                const grupos = Object.keys(gruposMap).map(Number).sort((a,b) => a-b)
                return grupos.map(gi => {
                  const usadosNaRodada = new Set()
                  gruposMap[gi].forEach(j => { [j.dupla_a_1,j.dupla_a_2,j.dupla_b_1,j.dupla_b_2].filter(Boolean).forEach(n => usadosNaRodada.add(n)) })
                  const renderSelect = (j, campo, time) => {
                    const valor = j[campo] || ""
                    const disponiveis = (timesEspecial[time] || []).filter(n => !usadosNaRodada.has(n) || n === valor)
                    return (
                      <select key={j.id + campo} value={valor}
                        onChange={async e => { await salvarSlot(j.id, campo, e.target.value) }}
                        style={{ background: "#0d2b1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: valor ? "#e8f5e9" : "rgba(255,255,255,0.3)", fontSize: 11, padding: "4px 6px", width: "100%" }}>
                        <option value="">selecionar</option>
                        {disponiveis.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )
                  }
                  return (
                    <div key={gi} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Rodada {gi}</div>
                      {gruposMap[gi].map((j) => (
                        <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: "#e74c3c", marginBottom: 3, fontWeight: 700 }}>TIME A</div>
                            {renderSelect(j, "dupla_a_1", "time_a")}
                            <div style={{ marginTop: 3 }}>{renderSelect(j, "dupla_a_2", "time_a")}</div>
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, padding: "0 4px" }}>x</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: "#3498db", marginBottom: 3, fontWeight: 700 }}>TIME B</div>
                            {renderSelect(j, "dupla_b_1", "time_b")}
                            <div style={{ marginTop: 3 }}>{renderSelect(j, "dupla_b_2", "time_b")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}
            </div>
{rodadaSelecionada?.status === "ativa" && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setModalSubst(true)} style={{ ...styles.btnSortear, background: "rgba(231,76,60,0.1)", borderColor: "#e74c3c", color: "#e74c3c" }}>
                🔄 Substituir Jogador
              </button>
            </div>
          )}
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
              <h2 style={styles.cardTitulo}>{editandoId ? "✏️ Editando jogo" : "➕ Inserir jogo"}</h2>
  <div style={{ marginBottom: 12 }}>
                <div style={styles.duplaLabel}>Rodada Interna</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setNovoJogo({ ...novoJogo, rodada_interna: n })}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
                        background: novoJogo.rodada_interna === n ? "#c9a227" : "#1e3d2a",
                        color: novoJogo.rodada_interna === n ? "#0d2b1a" : "#7fb89a" }}>
                      R{n}
                    </button>
                  ))}
                </div>
              </div>            <div style={styles.duplaSection}>
                <div style={styles.duplaLabel}>{rodadaSelecionada?.tipo === "especial" ? "🔴 Time A" : "🎾 Dupla A"}</div>
                <div style={styles.duplaInputs}>
                  <SelectJogador value={novoJogo.dupla_a_1} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_1: v })} placeholder="Jogador 1" dupla="a" />
                  <SelectJogador value={novoJogo.dupla_a_2} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_a_2: v })} placeholder="Jogador 2" dupla="a" />
                </div>
              </div>
              <div style={styles.placarSection}>
                <input type="number" min="0" max="7" placeholder="0" value={novoJogo.placar_a} onChange={(e) => setNovoJogo({ ...novoJogo, placar_a: e.target.value })} style={styles.placarInput} />
                <span style={styles.placarVs}>×</span>
                <input type="number" min="0" max="7" placeholder="0" value={novoJogo.placar_b} onChange={(e) => setNovoJogo({ ...novoJogo, placar_b: e.target.value })} style={styles.placarInput} />
              {(novoJogo.placar_a === "6" && novoJogo.placar_b === "5") || (novoJogo.placar_a === "5" && novoJogo.placar_b === "6") ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, justifyContent: "center" }}>
                  <span style={{ fontSize: 11, color: "#7fb89a" }}>Tie break:</span>
                  <input type="number" min="0" max="15" placeholder="0" value={novoJogo.tie_a} onChange={(e) => setNovoJogo({ ...novoJogo, tie_a: e.target.value })} style={{ width: 48, textAlign: "center", background: "#0f2d1e", border: "1px solid #c9a227", borderRadius: 8, padding: "4px 0", color: "#c9a227", fontSize: 18, fontFamily: "'Bebas Neue', sans-serif" }} />
                  <span style={{ color: "#5a8a6a", fontSize: 12 }}>x</span>
                  <input type="number" min="0" max="15" placeholder="0" value={novoJogo.tie_b} onChange={(e) => setNovoJogo({ ...novoJogo, tie_b: e.target.value })} style={{ width: 48, textAlign: "center", background: "#0f2d1e", border: "1px solid #c9a227", borderRadius: 8, padding: "4px 0", color: "#c9a227", fontSize: 18, fontFamily: "'Bebas Neue', sans-serif" }} />
                </div>
              ) : null}
              </div>
              <div style={styles.duplaSection}>
                <div style={styles.duplaLabel}>{rodadaSelecionada?.tipo === "especial" ? "🔵 Time B" : "🎾 Dupla B"}</div>
                <div style={styles.duplaInputs}>
                  <SelectJogador value={novoJogo.dupla_b_1} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_1: v })} placeholder="Jogador 1" dupla="b" />
                  <SelectJogador value={novoJogo.dupla_b_2} onChange={(v) => setNovoJogo({ ...novoJogo, dupla_b_2: v })} placeholder="Jogador 2" dupla="b" />
                </div>
              </div>
              <div style={styles.botoesForm}>
                <button onClick={salvarJogo} disabled={salvando} style={styles.btnSalvar}>{salvando ? "Salvando..." : editandoId ? "💾 Atualizar" : "💾 Salvar"}</button>
                {editandoId && <button onClick={resetForm} style={styles.btnCancelar}>✕ Cancelar</button>}
              </div>
            </div>

            <div style={styles.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h2 style={{ ...styles.cardTitulo, marginBottom: 0 }}>📋 Jogos da rodada <span style={styles.badgeCount}>{jogos.length} jogos</span></h2>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => imprimirRodada("ouro")} style={{ background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.4)", borderRadius: 8, padding: "6px 10px", color: "#c9a227", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🖨️ Ouro</button>
                  <button onClick={() => imprimirRodada("prata")} style={{ background: "rgba(142,158,171,0.15)", border: "1px solid rgba(142,158,171,0.4)", borderRadius: 8, padding: "6px 10px", color: "#8e9eab", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🖨️ Prata</button>
                </div>
              </div>
              {loading ? <p style={styles.loadingText}>Carregando...</p>
                : jogos.length === 0 ? <p style={styles.emptyText}>Nenhum jogo inserido ainda.</p>
                : (() => {
                  // Agrupa jogos por rodada_interna
  const gruposMap = {};
  jogos.forEach(j => { const r = j.rodada_interna || 1; if (!gruposMap[r]) gruposMap[r] = []; gruposMap[r].push(j); });
  const gruposOrdenados = Object.keys(gruposMap).map(Number).sort((a,b) => a-b);
  return gruposOrdenados.map((gi) => (
    <div key={gi} style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
        Rodada {gi}
      </div>
      {gruposMap[gi].map((jogo) => {
                          const temPlacar = jogo.placar_a !== null && jogo.placar_b !== null;
                          const venceuA = temPlacar && jogo.placar_a > jogo.placar_b;
                          const inline = placaresInline[jogo.id] || { a: jogo.placar_a ?? "", b: jogo.placar_b ?? "" };
                          return (
                            <div key={jogo.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                              {/* Dupla A */}
                              <div style={{ flex: 1, fontSize: 12 }}>
                                <div style={{ fontWeight: venceuA ? 700 : 400, color: venceuA ? "#f5c518" : "#e8f5e9" }}>{jogo.dupla_a_1}</div>
                                <div style={{ color: "rgba(255,255,255,0.5)" }}>{jogo.dupla_a_2}</div>
                              </div>
                              {/* Placares inline */}
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="number" min="0" max="7"
                                  value={inline.a}
                                  onChange={e => setPlacaresInline(prev => ({ ...prev, [jogo.id]: { ...inline, a: e.target.value } }))}
                                  onBlur={() => salvarPlacarInline(jogo.id)}
                                  onKeyDown={e => e.key === "Enter" && salvarPlacarInline(jogo.id)}
                                  style={{ width: 40, textAlign: "center", background: venceuA ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 0", color: venceuA ? "#f5c518" : "#e8f5e9", fontSize: 16, fontFamily: "'Bebas Neue', sans-serif" }}
                                />
                                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>×</span>
                                <input
                                  type="number" min="0" max="7"
                                  value={inline.b}
                                  onChange={e => setPlacaresInline(prev => ({ ...prev, [jogo.id]: { ...inline, b: e.target.value } }))}
                                  onBlur={() => salvarPlacarInline(jogo.id)}
                                  onKeyDown={e => e.key === "Enter" && salvarPlacarInline(jogo.id)}
                                  style={{ width: 40, textAlign: "center", background: !venceuA && temPlacar ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 0", color: !venceuA && temPlacar ? "#f5c518" : "#e8f5e9", fontSize: 16, fontFamily: "'Bebas Neue', sans-serif" }}
                                />
                              </div>
                              {/* Dupla B */}
                              <div style={{ flex: 1, fontSize: 12, textAlign: "right" }}>
                                <div style={{ fontWeight: !venceuA && temPlacar ? 700 : 400, color: !venceuA && temPlacar ? "#f5c518" : "#e8f5e9" }}>{jogo.dupla_b_1}</div>
                                <div style={{ color: "rgba(255,255,255,0.5)" }}>{jogo.dupla_b_2}</div>
                              </div>
                              {/* Botão excluir */}
                              <button onClick={() => excluirJogo(jogo.id)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>🗑️</button>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()
              }
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitulo}>🏆 Pontuação da Liga</h2>
              <p style={styles.infoText}>Calcule após inserir todos os placares das duas chaves.</p>
              {rodadaSelecionada?.tipo === "especial" && (
                <div style={{ background: "#1a3a20", border: "1px solid #c9a227", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#c9a227" }}>
                  ⭐ Rodada Especial — formato de times. Time vencedor: 40pts + 3/vitória | Perdedor: 10pts + 3/vitória
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
        {/* Modal de substituição */}
        {modalSubst && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#162f20", border: "1px solid #2a5a3a", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420 }}>
              <h3 style={{ color: "#e8f5e9", margin: "0 0 16px", fontSize: 16 }}>🔄 Substituir Jogador</h3>
              <p style={{ fontSize: 12, color: "#7fb89a", marginBottom: 16 }}>
                Se o ausente for da <strong>Ouro</strong>: o 1° da Prata sobe, e o reserva entra na Prata.<br/>
                Se for da <strong>Prata</strong>: o reserva entra direto na Prata.
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#7fb89a", display: "block", marginBottom: 4 }}>Jogador ausente:</label>
                <select value={substAusente} onChange={e => setSubstAusente(e.target.value)} style={styles.select}>
                  <option value="">selecionar</option>
                  {jogadores.filter(j => j.chave === "ouro" || j.chave === "prata").map(j => (
                    <option key={j.id} value={j.nome}>{j.nome} ({j.chave})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: "#7fb89a", display: "block", marginBottom: 4 }}>Reserva (quem entra):</label>
                <select value={substReserva} onChange={e => setSubstReserva(e.target.value)} style={styles.select}>
                  <option value="">selecionar</option>
                  {jogadores.map(j => (
                    <option key={j.id} value={j.nome}>{j.nome}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setModalSubst(false); setSubstAusente(""); setSubstReserva(""); }}
                  style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid #2a5a3a", borderRadius: 8, color: "#7fb89a", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={substituirJogador} disabled={substProcessando || !substAusente || !substReserva}
                  style={{ flex: 1, padding: "10px", background: "#e74c3c", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", opacity: (!substAusente || !substReserva) ? 0.5 : 1 }}>
                  {substProcessando ? "Processando..." : "Confirmar"}
                </button>
              </div>
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
