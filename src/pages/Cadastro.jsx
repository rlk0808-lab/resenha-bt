import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Cadastro() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [etapa, setEtapa] = useState("validando");
  const [convite, setConvite] = useState(null);
  const [mensagemErro, setMensagemErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    senha: "",
    confirmarSenha: "",
  });

  useEffect(() => {
    if (!token) {
      setMensagemErro("Link de convite inválido. Solicite um novo convite ao organizador.");
      setEtapa("erro");
      return;
    }
    validarToken();
  }, [token]);

  async function validarToken() {
    const { data, error } = await supabase
      .from("convites")
      .select("*")
      .eq("token", token)
      .limit(1);

    if (error || !data || data.length === 0) {
      setMensagemErro("Convite não encontrado. Solicite um novo convite ao organizador.");
      setEtapa("erro");
      return;
    }

    const conviteData = data[0];

    if (conviteData.usado) {
      setMensagemErro("Este convite já foi utilizado.");
      setEtapa("erro");
      return;
    }

    if (new Date(conviteData.expires_at) < new Date()) {
      setMensagemErro("Este convite expirou. Solicite um novo convite ao organizador.");
      setEtapa("erro");
      return;
    }

    setConvite(conviteData);
    setEtapa("formulario");
  }

  async function handleSubmit() {
    if (!form.nome.trim()) {
      alert("Digite seu nome completo."); return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      alert("Digite um email válido."); return;
    }
    if (!form.whatsapp.trim()) {
      alert("Digite seu WhatsApp."); return;
    }
    if (form.senha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres."); return;
    }
    if (form.senha !== form.confirmarSenha) {
      alert("As senhas não coincidem."); return;
    }

    setSalvando(true);

    // 1. Cria conta no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
    });

    if (authError) {
      alert("Erro ao criar conta: " + authError.message);
      setSalvando(false);
      return;
    }

    const userId = authData.user?.id;

    // 2. Salva em cadastros_pendentes
    const { error: pendenteError } = await supabase
      .from("cadastros_pendentes")
      .insert({
        user_id: userId,
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim(),
        token_convite: token,
        status: "pendente",
      });

    if (pendenteError) {
      alert("Erro ao registrar cadastro: " + pendenteError.message);
      setSalvando(false);
      return;
    }

    // 3. Marca convite como usado
    const { error: erroConvite } = await supabase
      .from("convites")
      .update({ usado: true })
      .eq("token", token);

    if (erroConvite) {
      console.error("Erro ao marcar convite como usado:", erroConvite);
      console.error("Detalhes:", JSON.stringify(erroConvite));
    }

    setSalvando(false);
    setEtapa("sucesso");
  }

  // ─── TELA VALIDANDO ───────────────────────────────────────────────────────
  if (etapa === "validando") {
    return (
      <div style={styles.fullPage}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Validando convite...</p>
      </div>
    );
  }

  // ─── TELA ERRO ────────────────────────────────────────────────────────────
  if (etapa === "erro") {
    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <span style={{ fontSize: 40 }}>🎾</span>
            <h1 style={styles.titulo}>Resenha BT</h1>
          </div>
          <div style={styles.erroBox}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
            <p style={styles.erroTexto}>{mensagemErro}</p>
          </div>
          <button onClick={() => navigate("/login")} style={styles.btnSecundario}>
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  // ─── TELA SUCESSO ─────────────────────────────────────────────────────────
  if (etapa === "sucesso") {
    return (
      <div style={styles.fullPage}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <span style={{ fontSize: 40 }}>🎾</span>
            <h1 style={styles.titulo}>Resenha BT</h1>
          </div>
          <div style={styles.sucessoBox}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={styles.sucessoTitulo}>Cadastro enviado!</h2>
            <p style={styles.sucessoTexto}>
              Seu cadastro foi enviado para aprovação. O organizador vai liberar seu acesso em breve.
            </p>
            <p style={styles.sucessoTexto}>
              Você receberá uma confirmação assim que for aprovado.
            </p>
          </div>
          <button onClick={() => navigate("/login")} style={styles.btnPrimario}>
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  // ─── FORMULÁRIO ───────────────────────────────────────────────────────────
  return (
    <div style={styles.fullPage}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
            <ellipse cx="20" cy="22" rx="10" ry="13" fill="#f5c518" transform="rotate(-25 20 22)" />
            <line x1="26" y1="33" x2="14" y2="52" stroke="#f5c518" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="44" cy="22" rx="10" ry="13" fill="#f5c518" transform="rotate(25 44 22)" />
            <line x1="38" y1="33" x2="50" y2="52" stroke="#f5c518" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="32" r="8" fill="#e8621a" />
          </svg>
          <h1 style={styles.titulo}>Resenha BT</h1>
        </div>

        <h2 style={styles.subtitulo}>Criar conta</h2>
        <p style={styles.infoText}>Preencha seus dados para entrar na liga.</p>

        <div style={styles.campo}>
          <label style={styles.label}>Nome completo</label>
          <input
            type="text"
            placeholder="Seu nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            style={styles.input}
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            placeholder="seu@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={styles.input}
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>WhatsApp</label>
          <input
            type="tel"
            placeholder="(43) 99999-9999"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            style={styles.input}
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Senha</label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            style={styles.input}
          />
        </div>

        <div style={styles.campo}>
          <label style={styles.label}>Confirmar senha</label>
          <input
            type="password"
            placeholder="Repita a senha"
            value={form.confirmarSenha}
            onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
            style={styles.input}
          />
        </div>

        <button onClick={handleSubmit} disabled={salvando} style={styles.btnPrimario}>
          {salvando ? "Enviando..." : "📋 Enviar cadastro"}
        </button>

        <button onClick={() => navigate("/login")} style={styles.btnLink}>
          Já tenho conta — Fazer login
        </button>
      </div>
    </div>
  );
}

const bg = "#0a1628";
const cardBg = "#0d2b1a";
const borda = "#1e4030";
const ouro = "#f5c518";

const styles = {
  fullPage: {
    minHeight: "100vh",
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: cardBg,
    border: `1px solid ${borda}`,
    borderRadius: 16,
    padding: "32px 24px",
    width: "100%",
    maxWidth: 400,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  titulo: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: ouro,
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: 2,
    textAlign: "center",
  },
  subtitulo: {
    margin: "16px 0 4px",
    fontSize: 18,
    fontWeight: 700,
    color: "#c8e6c9",
    textAlign: "center",
  },
  infoText: {
    margin: "0 0 20px",
    fontSize: 13,
    color: "#7fb89a",
    textAlign: "center",
  },
  campo: { marginBottom: 14 },
  label: {
    display: "block",
    fontSize: 12,
    color: "#7fb89a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    background: "#0a1f14",
    border: `1px solid ${borda}`,
    borderRadius: 10,
    color: "#e8f5e9",
    padding: "12px 14px",
    fontSize: 15,
    boxSizing: "border-box",
    outline: "none",
  },
  btnPrimario: {
    width: "100%",
    background: ouro,
    color: "#0a1628",
    border: "none",
    borderRadius: 10,
    padding: "14px 0",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    marginTop: 8,
  },
  btnSecundario: {
    width: "100%",
    background: "transparent",
    color: ouro,
    border: `1px solid ${ouro}`,
    borderRadius: 10,
    padding: "12px 0",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 8,
  },
  btnLink: {
    width: "100%",
    background: "transparent",
    border: "none",
    color: "#5a8a6a",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 12,
    textDecoration: "underline",
  },
  erroBox: {
    background: "rgba(192,57,43,0.1)",
    border: "1px solid rgba(192,57,43,0.3)",
    borderRadius: 10,
    padding: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  erroTexto: {
    color: "#e74c3c",
    fontSize: 14,
    margin: 0,
    lineHeight: 1.5,
  },
  sucessoBox: {
    textAlign: "center",
    padding: "16px 0",
  },
  sucessoTitulo: {
    color: "#7fd8a0",
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 12px",
  },
  sucessoTexto: {
    color: "#7fb89a",
    fontSize: 14,
    margin: "0 0 8px",
    lineHeight: 1.5,
  },
  loadingText: {
    color: "#7fb89a",
    marginTop: 16,
    fontSize: 14,
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #1e4030",
    borderTop: `3px solid ${ouro}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
