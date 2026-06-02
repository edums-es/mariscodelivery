import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ChefHat, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

const G  = "#D4AF37";
const G2 = "#B8860B";
const BK = "#0A0A0A";

const INP = {
  width: "100%", boxSizing: "border-box",
  height: 46, borderRadius: 10,
  background: "#161616", border: "1px solid #2a2a2a",
  color: "#E5E5E5", fontSize: 14, padding: "0 14px",
  fontFamily: "Manrope, sans-serif", outline: "none",
  transition: "border-color .2s",
};

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [showPass, setShowPass] = useState(false);

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [rName, setRName]       = useState("");
  const [rEmail, setREmail]     = useState("");
  const [rPass, setRPass]       = useState("");
  const [rStore, setRStore]     = useState("");

  useEffect(() => {
    if (user?.role) navigate(user.role === "super_admin" ? "/super" : "/admin", { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success("Bem-vindo de volta!");
      navigate(u.role === "super_admin" ? "/super" : "/admin", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Falha no login");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ name: rName, email: rEmail, password: rPass, restaurant_name: rStore });
      toast.success("Restaurante criado!");
      navigate("/admin", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Falha no cadastro");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: BK, fontFamily: "Manrope, sans-serif", color: "#E5E5E5" }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        width: "42%", flexShrink: 0,
        background: `linear-gradient(160deg, #141414 0%, #0F0F0F 100%)`,
        borderRight: "1px solid #1e1e1e",
        display: "flex", flexDirection: "column",
        padding: "40px 48px", position: "relative", overflow: "hidden",
      }} className="login-left">

        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", zIndex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${G}18`, border: `1px solid ${G}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChefHat size={18} color={G} />
          </div>
          <span style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 18, color: "#E5E5E5" }}>MenuFlow</span>
        </Link>

        {/* Center text */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", zIndex: 1 }}>
          <div style={{ width: 32, height: 2, background: G, borderRadius: 2, marginBottom: 28 }} />
          <h2 style={{ margin: "0 0 16px", fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 36, lineHeight: 1.15, color: "#F0F0F0" }}>
            Gerencie seu restaurante com facilidade.
          </h2>
          <p style={{ margin: "0 0 32px", fontSize: 14, lineHeight: 1.75, color: "#555" }}>
            Cardápio digital, pedidos e relatórios em um painel feito para o dia a dia da sua cozinha.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Cardápio Digital", "Gestão de Pedidos", "Relatórios", "PDV", "Fidelidade", "Atacado"].map((f) => (
              <span key={f} style={{ fontSize: 12, fontWeight: 600, background: "#1A1A1A", border: "1px solid #2a2a2a", color: "#777", padding: "5px 12px", borderRadius: 100 }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -80, bottom: -80, width: 240, height: 240, borderRadius: "50%", border: `1px solid ${G}12`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: -40, bottom: -40, width: 140, height: 140, borderRadius: "50%", border: `1px solid ${G}18`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 40, top: 120, width: 100, height: 100, borderRadius: "50%", border: "1px solid #1e1e1e", pointerEvents: "none" }} />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Tab switcher */}
          <div style={{ display: "flex", background: "#111", border: "1px solid #222", borderRadius: 14, padding: 4, marginBottom: 32 }}>
            {[["login", "Entrar"], ["register", "Criar conta"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                data-testid={`tab-${key}`}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
                  fontFamily: "Manrope, sans-serif", fontSize: 14, fontWeight: 600,
                  transition: "all .2s",
                  background: tab === key ? G : "transparent",
                  color: tab === key ? BK : "#555",
                }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <div>
              <h1 style={{ margin: "0 0 6px", fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 26, color: "#F0F0F0" }}>
                Acesse seu painel
              </h1>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: "#444" }}>Entre com suas credenciais para continuar.</p>

              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: 7 }}>E-mail</label>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    data-testid="login-email" placeholder="voce@restaurante.com"
                    style={INP}
                    onFocus={(e) => e.target.style.borderColor = G}
                    onBlur={(e) => e.target.style.borderColor = "#2a2a2a"}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: 7 }}>Senha</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPass ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      data-testid="login-password" placeholder="••••••••"
                      style={{ ...INP, paddingRight: 44 }}
                      onFocus={(e) => e.target.style.borderColor = G}
                      onBlur={(e) => e.target.style.borderColor = "#2a2a2a"}
                    />
                    <button type="button" onClick={() => setShowPass((s) => !s)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", padding: 0, display: "flex" }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} data-testid="login-submit"
                  style={{
                    height: 48, borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
                    background: `linear-gradient(135deg, ${G}, ${G2})`,
                    color: BK, fontSize: 14, fontWeight: 700,
                    fontFamily: "Manrope, sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    marginTop: 4, opacity: loading ? 0.7 : 1,
                    boxShadow: `0 4px 20px ${G}30`,
                  }}>
                  {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <><span>Entrar</span><ArrowRight size={16} /></>}
                </button>
              </form>

              {/* Test accounts */}
              <div style={{ marginTop: 24, background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
                <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#444" }}>Contas de teste</p>
                <button type="button" onClick={() => { setEmail("dono@burger.com"); setPassword("dono123"); }}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 10px", borderRadius: 8, marginBottom: 4, transition: "background .15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#1a1a1a"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#999" }}>Restaurante</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#444" }}>dono@burger.com · dono123</p>
                </button>
                <button type="button" onClick={() => { setEmail("super@menudigital.com"); setPassword("super123"); }}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 10px", borderRadius: 8, transition: "background .15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#1a1a1a"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: G }}>Super Admin</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#444" }}>super@menudigital.com · super123</p>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h1 style={{ margin: "0 0 6px", fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 26, color: "#F0F0F0" }}>
                Crie seu cardápio
              </h1>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: "#444" }}>Comece grátis. Sem cartão de crédito.</p>

              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Nome do restaurante", value: rStore, set: setRStore, placeholder: "Ex: Burger do Zé", testId: "register-store", type: "text" },
                  { label: "Seu nome", value: rName, set: setRName, placeholder: "João Silva", testId: "register-name", type: "text" },
                  { label: "E-mail", value: rEmail, set: setREmail, placeholder: "voce@email.com", testId: "register-email", type: "email" },
                ].map(({ label, value, set: setter, placeholder, testId, type }) => (
                  <div key={testId}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: 7 }}>{label}</label>
                    <input type={type} required value={value} onChange={(e) => setter(e.target.value)}
                      data-testid={testId} placeholder={placeholder} style={INP}
                      onFocus={(e) => e.target.style.borderColor = G}
                      onBlur={(e) => e.target.style.borderColor = "#2a2a2a"} />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: 7 }}>Senha</label>
                  <div style={{ position: "relative" }}>
                    <input type={showPass ? "text" : "password"} required minLength={6} value={rPass} onChange={(e) => setRPass(e.target.value)}
                      data-testid="register-password" placeholder="Mínimo 6 caracteres"
                      style={{ ...INP, paddingRight: 44 }}
                      onFocus={(e) => e.target.style.borderColor = G}
                      onBlur={(e) => e.target.style.borderColor = "#2a2a2a"} />
                    <button type="button" onClick={() => setShowPass((s) => !s)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", padding: 0, display: "flex" }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} data-testid="register-submit"
                  style={{
                    height: 48, borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
                    background: `linear-gradient(135deg, ${G}, ${G2})`,
                    color: BK, fontSize: 14, fontWeight: 700,
                    fontFamily: "Manrope, sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    marginTop: 4, opacity: loading ? 0.7 : 1,
                    boxShadow: `0 4px 20px ${G}30`,
                  }}>
                  {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <><span>Criar restaurante</span><ArrowRight size={16} /></>}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: hide left panel */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
