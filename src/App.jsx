import { useState, useEffect, useRef } from "react";

// ── FONTS ─────────────────────────────────────────────────────────────────────
const Fonts = () => (
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fraunces:ital,wght@0,700;0,900;1,600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
);

// ── THEME ─────────────────────────────────────────────────────────────────────
const C = {
  bg: "#f7f4ef",
  surface: "#ffffff",
  dark: "#1a1a18",
  border: "#e8e3db",
  accent: "#1a6b3c",
  accentLight: "#e8f5ee",
  accentBright: "#22c55e",
  gold: "#c9831a",
  goldLight: "#fef3e2",
  red: "#dc2626",
  redLight: "#fef2f2",
  blue: "#1d4ed8",
  blueLight: "#eff6ff",
  text: "#1a1a18",
  muted: "#78716c",
  faint: "#f0ece6",
  font: "'Plus Jakarta Sans', sans-serif",
  display: "'Fraunces', serif",
  mono: "'JetBrains Mono', monospace",
};

// ── STORAGE ───────────────────────────────────────────────────────────────────
const db = {
  get: (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const now = () => new Date().toISOString();
const fmt = (n, curr = "₦") => `${curr}${Number(n || 0).toLocaleString("en-NG")}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—";
const thisMonth = () => new Date().toISOString().slice(0, 7);

// ── CLAUDE AI ─────────────────────────────────────────────────────────────────
async function askAI(system, message) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: message }],
      }),
    });
    const j = await res.json();
    return j.content?.[0]?.text || "Could not get a response.";
  } catch { return "AI is unavailable right now."; }
}

// ── PAYSTACK ──────────────────────────────────────────────────────────────────
function paystack(email, amount, onSuccess) {
  const h = window.PaystackPop?.setup({
    key: "pk_test_08c5d5107aa8861893580f4c2b9acc055efb457as",
    email, amount: amount * 100, currency: "NGN",
    callback: r => r.status === "success" && onSuccess(r.reference),
    onClose: () => {},
  });
  h?.openIframe();
}

// ══════════════════════════════════════════════════════
// UI PRIMITIVES
// ══════════════════════════════════════════════════════

const Btn = ({ children, onClick, variant = "primary", size = "md", full, disabled, style = {} }) => {
  const sizes = { sm: { padding: "6px 14px", fontSize: 12 }, md: { padding: "10px 20px", fontSize: 14 }, lg: { padding: "14px 28px", fontSize: 16 } };
  const vars = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    secondary: { background: C.faint, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    danger: { background: C.redLight, color: C.red, border: `1px solid #fca5a5` },
    gold: { background: C.gold, color: "#fff", border: "none" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...sizes[size], ...vars[variant], borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", fontFamily: C.font, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.15s", opacity: disabled ? 0.5 : 1, width: full ? "100%" : "auto", justifyContent: "center", letterSpacing: "-0.01em", ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.92)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
      {children}
    </button>
  );
};

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, cursor: onClick ? "pointer" : "default", transition: onClick ? "box-shadow 0.15s" : undefined, ...style }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; }}
    onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = "none"; }}>
    {children}
  </div>
);

const Badge = ({ children, color = C.accent, bg }) => (
  <span style={{ background: bg || `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 100, padding: "3px 10px", fontSize: 11, fontFamily: C.mono, fontWeight: 500, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const Input = ({ label, value, onChange, placeholder, type = "text", prefix, required }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, fontFamily: C.font }}>{label}{required && <span style={{ color: C.red }}> *</span>}</div>}
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {prefix && <span style={{ position: "absolute", left: 12, color: C.muted, fontSize: 14, fontFamily: C.mono }}>{prefix}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: `10px ${prefix ? "14px 10px 36px" : "14px 10px"}`, fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none", transition: "border-color 0.15s" }}
        onFocus={e => e.target.style.borderColor = C.accent}
        onBlur={e => e.target.style.borderColor = C.border} />
    </div>
  </div>
);

const Select = ({ label, value, onChange, options, required }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}{required && <span style={{ color: C.red }}> *</span>}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none" }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Stat = ({ label, value, sub, icon, color = C.accent, bg }) => (
  <Card style={{ background: bg || C.surface }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    <div style={{ fontFamily: C.display, fontSize: 28, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</div>}
  </Card>
);

const Modal = ({ title, onClose, children, width = 520 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,24,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={onClose}>
    <div style={{ background: C.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 700, color: C.text }}>{title}</div>
        <button onClick={onClose} style={{ background: C.faint, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: C.muted }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const EmptyState = ({ icon, title, desc, action, onAction }) => (
  <div style={{ textAlign: "center", padding: "60px 24px" }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
    <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</div>
    <div style={{ color: C.muted, fontSize: 14, marginBottom: 24, maxWidth: 300, margin: "0 auto 24px" }}>{desc}</div>
    {action && <Btn onClick={onAction}>{action}</Btn>}
  </div>
);

// ══════════════════════════════════════════════════════
// LANDING PAGE
// ══════════════════════════════════════════════════════
function Landing({ onStart }) {
  return (
    <div style={{ minHeight: "100vh", background: C.dark, color: "#fff", fontFamily: C.font, overflow: "hidden" }}>
      <Fonts />
      <script src="https://js.paystack.co/v1/inline.js" />

      {/* Hero section */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,107,60,0.3) 0%, transparent 70%)", top: -200, right: -100, pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,131,26,0.2) 0%, transparent 70%)", bottom: -100, left: -100, pointerEvents: "none" }} />

        {/* Nav */}
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 48px", position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: C.accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌍</div>
            <div style={{ fontFamily: C.display, fontSize: 22, fontWeight: 900, color: "#fff" }}>BizOS</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Btn variant="ghost" onClick={onStart} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>Login</Btn>
            <Btn onClick={onStart} style={{ background: C.accentBright, color: "#000" }}>Start Free</Btn>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ textAlign: "center", padding: "70px 24px 80px", maxWidth: 820, margin: "0 auto", position: "relative", zIndex: 10 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 100, padding: "6px 18px", fontSize: 12, color: C.accentBright, fontFamily: C.mono, marginBottom: 28 }}>
            🌍 Built for African Businesses
          </div>
          <h1 style={{ fontFamily: C.display, fontSize: "clamp(44px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.05, margin: "0 0 20px", letterSpacing: "-0.03em" }}>
            Run your entire<br />
            <span style={{ color: C.accentBright }}>business in one place.</span>
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Inventory. Sales. Customers. Staff. AI insights. Everything your shop needs — without the spreadsheets, the guesswork, or the stress.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn size="lg" onClick={onStart} style={{ background: C.accentBright, color: "#000", fontSize: 16 }}>Start Free Today →</Btn>
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 16, fontFamily: C.mono }}>Free forever · No credit card · Upgrade anytime</p>
        </div>
      </div>

      {/* Features */}
      <div style={{ background: C.bg, padding: "80px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontFamily: C.display, fontSize: 40, fontWeight: 900, color: C.text, margin: "0 0 12px" }}>Everything your business needs</h2>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: 480, margin: "0 auto" }}>Five powerful tools in one app. No more switching between WhatsApp, paper books, and calculators.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
          {[
            { icon: "📦", title: "Inventory Management", desc: "Track every product, get low-stock alerts before you run out, know your real stock value at any time.", color: C.accent },
            { icon: "💰", title: "Sales & Revenue", desc: "Record every sale, track daily revenue, see which products make you the most money.", color: C.gold },
            { icon: "👥", title: "Customer Records", desc: "Know every customer by name. Track who owes you, who's loyal, and who to follow up with.", color: C.blue },
            { icon: "👷", title: "Staff & Expenses", desc: "Track staff salaries, daily expenses, and stop losing money you can't account for.", color: "#7c3aed" },
            { icon: "🧠", title: "AI Business Insights", desc: "Ask your AI anything. 'What's my best selling product?' 'Which day do I sell the most?' It knows.", color: C.accentBright },
          ].map(f => (
            <Card key={f.title} style={{ borderTop: `3px solid ${f.color}` }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontFamily: C.display, fontSize: 17, fontWeight: 700, marginBottom: 8, color: C.text }}>{f.title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{f.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ background: C.dark, padding: "80px 48px", textAlign: "center" }}>
        <h2 style={{ fontFamily: C.display, fontSize: 36, fontWeight: 900, color: "#fff", margin: "0 0 12px" }}>Simple pricing</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 48, fontSize: 15 }}>No surprises. Cancel anytime.</p>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", maxWidth: 800, margin: "0 auto" }}>
          {[
            { name: "Free", price: "₦0", period: "forever", features: ["50 products", "3 customers", "Basic sales tracking", "7-day history"], cta: "Start Free", variant: "ghost" },
            { name: "Business", price: "₦9,000", period: "/month", features: ["Unlimited products", "Unlimited customers", "Full sales history", "AI insights", "Staff tracking", "Export reports"], cta: "Go Business", variant: "gold", highlight: true },
          ].map(p => (
            <div key={p.name} style={{ background: p.highlight ? C.accent : "rgba(255,255,255,0.05)", border: `1px solid ${p.highlight ? C.accent : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: 32, flex: 1, minWidth: 260, maxWidth: 340 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.highlight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>{p.name}</div>
              <div style={{ fontFamily: C.display, fontSize: 40, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{p.price}<span style={{ fontSize: 16, fontWeight: 400, opacity: 0.6 }}>{p.period}</span></div>
              <div style={{ margin: "24px 0" }}>{p.features.map(f => <div key={f} style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, padding: "5px 0" }}>✓ {f}</div>)}</div>
              <Btn full onClick={onStart} variant={p.highlight ? "secondary" : "ghost"} style={{ background: p.highlight ? "#fff" : "transparent", color: p.highlight ? C.accent : "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)" }}>{p.cta}</Btn>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ background: C.accentBright, padding: "60px 48px", textAlign: "center" }}>
        <h2 style={{ fontFamily: C.display, fontSize: 36, fontWeight: 900, color: "#000", margin: "0 0 16px" }}>Your competitors are already going digital.</h2>
        <p style={{ color: "rgba(0,0,0,0.6)", fontSize: 16, marginBottom: 32 }}>Don't get left behind. Start managing your business properly today.</p>
        <Btn size="lg" onClick={onStart} style={{ background: "#000", color: "#fff" }}>Start Free — Takes 60 Seconds →</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════
function Auth({ onAuth }) {
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", pass: "", currency: "₦" });
  const [err, setErr] = useState("");
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    setErr("");
    if (mode === "signup") {
      if (!form.name || !form.business || !form.email || !form.pass) return setErr("Please fill all required fields.");
      const users = db.get("biz_users", {});
      if (users[form.email]) return setErr("Account exists. Please login.");
      const user = { id: uid(), name: form.name, business: form.business, phone: form.phone, email: form.email, currency: form.currency, isPro: false, createdAt: today() };
      users[form.email] = { ...user, pass: form.pass };
      db.set("biz_users", users);
      onAuth(user);
    } else {
      if (!form.email || !form.pass) return setErr("Enter email and password.");
      const users = db.get("biz_users", {});
      const u = users[form.email];
      if (!u || u.pass !== form.pass) return setErr("Wrong email or password.");
      const { pass: _, ...user } = u;
      onAuth(user);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", fontFamily: C.font }}>
      <Fonts />
      {/* Left panel */}
      <div style={{ width: "42%", background: C.dark, padding: 48, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: C.display, fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
          <span style={{ color: C.accentBright }}>BizOS</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.8, marginTop: 24, maxWidth: 320 }}>
          The operating system for African businesses. Track inventory, sales, customers and staff — all in one place.
        </p>
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 16 }}>
          {["📦 Real-time inventory tracking", "💰 Daily sales & revenue", "🧠 AI business insights", "👥 Customer management"].map(f => (
            <div key={f} style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>{f}</div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ fontFamily: C.display, fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>
            {mode === "signup" ? "Start managing your business better today." : "Sign in to your BizOS account."}
          </p>
          {mode === "signup" && <>
            <Input label="Your Name" value={form.name} onChange={f("name")} placeholder="Amara Okonkwo" required />
            <Input label="Business Name" value={form.business} onChange={f("business")} placeholder="Amara's Fashion Store" required />
            <Input label="Phone Number" value={form.phone} onChange={f("phone")} placeholder="+234 800 000 0000" />
            <Select label="Currency" value={form.currency} onChange={f("currency")} options={[{ value: "₦", label: "₦ Nigerian Naira (NGN)" }, { value: "GH₵", label: "GH₵ Ghanaian Cedi (GHS)" }, { value: "KSh", label: "KSh Kenyan Shilling (KES)" }, { value: "$", label: "$ US Dollar (USD)" }]} />
          </>}
          <Input label="Email" value={form.email} onChange={f("email")} placeholder="amara@email.com" type="email" required />
          <Input label="Password" value={form.pass} onChange={f("pass")} placeholder="••••••••" type="password" required />
          {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 14, background: C.redLight, padding: "10px 14px", borderRadius: 8 }}>{err}</div>}
          <Btn full onClick={submit} size="lg">{mode === "signup" ? "Create Account →" : "Login →"}</Btn>
          <p style={{ textAlign: "center", fontSize: 13, color: C.muted, marginTop: 16 }}>
            {mode === "signup" ? "Already have an account? " : "No account? "}
            <span style={{ color: C.accent, cursor: "pointer", fontWeight: 600 }} onClick={() => { setMode(m => m === "signup" ? "login" : "signup"); setErr(""); }}>
              {mode === "signup" ? "Login" : "Sign up free"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════
function Dashboard({ user, products, sales, customers, expenses, onNav }) {
  const curr = user.currency;
  const todaySales = sales.filter(s => s.date === today()).reduce((sum, s) => sum + s.total, 0);
  const monthSales = sales.filter(s => s.date.startsWith(thisMonth())).reduce((sum, s) => sum + s.total, 0);
  const totalCustomers = customers.length;
  const lowStock = products.filter(p => p.qty <= (p.lowStockAlert || 5)).length;
  const todayExpenses = expenses.filter(e => e.date === today()).reduce((s, e) => s + Number(e.amount), 0);
  const recentSales = [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const topProducts = products.map(p => ({ ...p, sold: sales.flatMap(s => s.items).filter(i => i.productId === p.id).reduce((s, i) => s + i.qty, 0) })).sort((a, b) => b.sold - a.sold).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 26, margin: "0 0 4px" }}>Good day, {user.name.split(" ")[0]} 👋</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>{user.business} · {fmtDate(today())}</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label="Today's Sales" value={fmt(todaySales, curr)} sub={`${sales.filter(s => s.date === today()).length} transactions`} icon="💰" color={C.accent} />
        <Stat label="This Month" value={fmt(monthSales, curr)} sub="Total revenue" icon="📈" color={C.gold} />
        <Stat label="Customers" value={totalCustomers} sub="Total records" icon="👥" color={C.blue} />
        <Stat label="Low Stock" value={lowStock} sub={lowStock > 0 ? "Need restocking" : "All good"} icon="📦" color={lowStock > 0 ? C.red : C.accentBright} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Recent sales */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16 }}>Recent Sales</div>
            <Btn size="sm" variant="secondary" onClick={() => onNav("sales")}>View All</Btn>
          </div>
          {recentSales.length === 0
            ? <EmptyState icon="💰" title="No sales yet" desc="Record your first sale to see it here." action="Record Sale" onAction={() => onNav("sales")} />
            : recentSales.map(s => {
              const cust = customers.find(c => c.id === s.customerId);
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${C.faint}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cust?.name || "Walk-in Customer"}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{s.items.length} item{s.items.length !== 1 ? "s" : ""} · {fmtDate(s.date)}</div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.accent, fontSize: 14 }}>{fmt(s.total, curr)}</div>
                </div>
              );
            })}
        </Card>

        {/* Top products + quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Top Products</div>
            {topProducts.length === 0
              ? <div style={{ color: C.muted, fontSize: 13 }}>Add products to see top sellers.</div>
              : topProducts.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.faint}` }}>
                  <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, fontFamily: C.mono }}>{p.sold} sold</div>
                </div>
              ))}
          </Card>
          <Card>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Quick Actions</div>
            {[{ label: "📦 Add Product", nav: "inventory" }, { label: "💰 Record Sale", nav: "sales" }, { label: "👥 New Customer", nav: "customers" }, { label: "🧠 Ask AI", nav: "ai" }].map(a => (
              <button key={a.nav} onClick={() => onNav(a.nav)} style={{ width: "100%", background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontFamily: C.font, fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer", textAlign: "left" }}>
                {a.label}
              </button>
            ))}
          </Card>
        </div>
      </div>

      {/* Low stock warning */}
      {lowStock > 0 && (
        <Card style={{ background: C.redLight, border: `1px solid #fca5a5` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: C.red, marginBottom: 4 }}>⚠ {lowStock} product{lowStock > 1 ? "s" : ""} running low</div>
              <div style={{ fontSize: 13, color: C.muted }}>{products.filter(p => p.qty <= (p.lowStockAlert || 5)).map(p => p.name).join(", ")}</div>
            </div>
            <Btn size="sm" variant="danger" onClick={() => onNav("inventory")}>View Inventory</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// INVENTORY
// ══════════════════════════════════════════════════════
function Inventory({ products, setProducts, user, isPro }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", category: "", buyPrice: "", sellPrice: "", qty: "", unit: "pcs", lowStockAlert: "5" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const canAdd = isPro || products.length < 50;

  function add() {
    if (!form.name || !form.sellPrice || !form.qty) return alert("Fill required fields.");
    setProducts(prev => [...prev, { ...form, id: uid(), sellPrice: Number(form.sellPrice), buyPrice: Number(form.buyPrice), qty: Number(form.qty), lowStockAlert: Number(form.lowStockAlert), createdAt: today() }]);
    setForm({ name: "", category: "", buyPrice: "", sellPrice: "", qty: "", unit: "pcs", lowStockAlert: "5" });
    setShowAdd(false);
  }

  function restock(id, amount) {
    const qty = Number(prompt("How many units to add?"));
    if (!qty || isNaN(qty)) return;
    setProducts(prev => prev.map(p => p.id === id ? { ...p, qty: p.qty + qty } : p));
  }

  function remove(id) {
    if (window.confirm("Remove this product?")) setProducts(prev => prev.filter(p => p.id !== id));
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const curr = user.currency;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Inventory</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{products.length} products · Total value: {fmt(products.reduce((s, p) => s + p.qty * p.sellPrice, 0), curr)}</div>
        </div>
        {canAdd ? <Btn onClick={() => setShowAdd(true)}>+ Add Product</Btn> : <Badge color={C.gold}>Upgrade for more</Badge>}
      </div>

      {/* Search */}
      <Input value={search} onChange={setSearch} placeholder="🔍  Search products..." style={{ marginBottom: 16 }} />

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Product" onClose={() => setShowAdd(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Product Name" value={form.name} onChange={f("name")} placeholder="Indomie Noodles" required /></div>
            <Input label="Category" value={form.category} onChange={f("category")} placeholder="Food, Fashion..." />
            <Select label="Unit" value={form.unit} onChange={f("unit")} options={[{ value: "pcs", label: "Pieces" }, { value: "kg", label: "Kilograms" }, { value: "litres", label: "Litres" }, { value: "bags", label: "Bags" }, { value: "cartons", label: "Cartons" }, { value: "metres", label: "Metres" }]} />
            <Input label={`Buy Price (${curr})`} value={form.buyPrice} onChange={f("buyPrice")} placeholder="500" type="number" />
            <Input label={`Sell Price (${curr})`} value={form.sellPrice} onChange={f("sellPrice")} placeholder="700" type="number" required />
            <Input label="Current Stock" value={form.qty} onChange={f("qty")} placeholder="100" type="number" required />
            <Input label="Low Stock Alert" value={form.lowStockAlert} onChange={f("lowStockAlert")} placeholder="5" type="number" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={add}>Add Product</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Table */}
      {filtered.length === 0
        ? <EmptyState icon="📦" title="No products yet" desc="Add your first product to start tracking inventory." action="+ Add Product" onAction={() => setShowAdd(true)} />
        : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontFamily: C.font }}>
              <thead>
                <tr style={{ background: C.faint, borderBottom: `1px solid ${C.border}` }}>
                  {["Product", "Category", "Buy Price", "Sell Price", "Stock", "Value", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const isLow = p.qty <= (p.lowStockAlert || 5);
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${C.faint}`, background: i % 2 === 0 ? C.surface : C.bg }}>
                      <td style={{ padding: "13px 16px", fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: "13px 16px", color: C.muted }}>{p.category || "—"}</td>
                      <td style={{ padding: "13px 16px", fontFamily: C.mono }}>{p.buyPrice ? fmt(p.buyPrice, curr) : "—"}</td>
                      <td style={{ padding: "13px 16px", fontFamily: C.mono, color: C.accent, fontWeight: 700 }}>{fmt(p.sellPrice, curr)}</td>
                      <td style={{ padding: "13px 16px", fontFamily: C.mono }}>{p.qty} {p.unit}</td>
                      <td style={{ padding: "13px 16px", fontFamily: C.mono }}>{fmt(p.qty * p.sellPrice, curr)}</td>
                      <td style={{ padding: "13px 16px" }}>
                        <Badge color={isLow ? C.red : C.accentBright}>{isLow ? "LOW STOCK" : "IN STOCK"}</Badge>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn size="sm" variant="secondary" onClick={() => restock(p.id)}>Restock</Btn>
                          <Btn size="sm" variant="danger" onClick={() => remove(p.id)}>✕</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════
function Sales({ sales, setSales, products, setProducts, customers, user, isPro }) {
  const [showAdd, setShowAdd] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [filter, setFilter] = useState("today");
  const curr = user.currency;

  function addToCart(productId) {
    const p = products.find(x => x.id === productId);
    if (!p || p.qty < 1) return alert("Product out of stock.");
    setCart(prev => {
      const ex = prev.find(i => i.productId === productId);
      if (ex) return prev.map(i => i.productId === productId ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId, name: p.name, sellPrice: p.sellPrice, qty: 1 }];
    });
  }

  function updateQty(productId, qty) {
    if (qty < 1) { setCart(prev => prev.filter(i => i.productId !== productId)); return; }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty: Number(qty) } : i));
  }

  const cartTotal = cart.reduce((s, i) => s + i.sellPrice * i.qty, 0);

  function recordSale() {
    if (cart.length === 0) return alert("Add items to cart.");
    // Deduct from inventory
    setProducts(prev => prev.map(p => {
      const item = cart.find(i => i.productId === p.id);
      return item ? { ...p, qty: Math.max(0, p.qty - item.qty) } : p;
    }));
    const sale = { id: uid(), items: cart, total: cartTotal, customerId: selectedCustomer, payMethod, date: today(), createdAt: now() };
    setSales(prev => [...prev, sale]);
    setCart([]);
    setSelectedCustomer("");
    setPayMethod("cash");
    setShowAdd(false);
  }

  const filterDates = { today: today(), week: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0], month: thisMonth() };
  const filtered = sales.filter(s => {
    if (filter === "today") return s.date === filterDates.today;
    if (filter === "week") return s.date >= filterDates.week;
    if (filter === "month") return s.date.startsWith(filterDates.month);
    return true;
  });
  const filteredTotal = filtered.reduce((s, sale) => s + sale.total, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Sales</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{filtered.length} transactions · {fmt(filteredTotal, curr)}</div>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Record Sale</Btn>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["today", "week", "month", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ border: `1px solid ${filter === f ? C.accent : C.border}`, background: filter === f ? C.accentLight : "transparent", color: filter === f ? C.accent : C.muted, borderRadius: 8, padding: "7px 16px", fontSize: 12, cursor: "pointer", fontFamily: C.mono, textTransform: "capitalize", fontWeight: filter === f ? 700 : 400 }}>
            {f}
          </button>
        ))}
      </div>

      {/* Sale modal */}
      {showAdd && (
        <Modal title="Record New Sale" onClose={() => setShowAdd(false)} width={640}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Products */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase" }}>Select Products</div>
              <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
                {products.map(p => (
                  <div key={p.id} onClick={() => addToCart(p.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: C.faint }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accentLight}
                    onMouseLeave={e => e.currentTarget.style.background = C.faint}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Stock: {p.qty} {p.unit}</div>
                    </div>
                    <div style={{ fontFamily: C.mono, fontSize: 13, color: C.accent, fontWeight: 700 }}>{fmt(p.sellPrice, curr)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase" }}>Cart</div>
              <div style={{ minHeight: 200, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                {cart.length === 0
                  ? <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 60 }}>Click products to add</div>
                  : cart.map(item => (
                    <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{fmt(item.sellPrice, curr)} each</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => updateQty(item.productId, item.qty - 1)} style={{ width: 24, height: 24, border: `1px solid ${C.border}`, borderRadius: 4, background: C.faint, cursor: "pointer", fontFamily: C.font, fontWeight: 700 }}>-</button>
                        <span style={{ fontSize: 13, fontFamily: C.mono, minWidth: 24, textAlign: "center" }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.productId, item.qty + 1)} style={{ width: 24, height: 24, border: `1px solid ${C.border}`, borderRadius: 4, background: C.faint, cursor: "pointer", fontFamily: C.font, fontWeight: 700 }}>+</button>
                      </div>
                      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.accent, marginLeft: 10, minWidth: 60, textAlign: "right" }}>{fmt(item.sellPrice * item.qty, curr)}</div>
                    </div>
                  ))}
              </div>
              <Select label="Customer (optional)" value={selectedCustomer} onChange={setSelectedCustomer} options={[{ value: "", label: "Walk-in customer" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
              <Select label="Payment Method" value={payMethod} onChange={setPayMethod} options={[{ value: "cash", label: "💵 Cash" }, { value: "transfer", label: "🏦 Bank Transfer" }, { value: "pos", label: "💳 POS" }, { value: "mobile_money", label: "📱 Mobile Money" }]} />
              <div style={{ background: C.accentLight, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: C.accent }}>Total</span>
                <span style={{ fontFamily: C.mono, fontWeight: 900, fontSize: 20, color: C.accent }}>{fmt(cartTotal, curr)}</span>
              </div>
              <Btn full onClick={recordSale} disabled={cart.length === 0}>✓ Complete Sale</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Sales list */}
      {filtered.length === 0
        ? <EmptyState icon="💰" title="No sales recorded" desc="Record your sales to track revenue and see insights." action="+ Record Sale" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 10 }}>
            {[...filtered].reverse().map(sale => {
              const cust = customers.find(c => c.id === sale.customerId);
              return (
                <Card key={sale.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{cust?.name || "Walk-in Customer"}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{sale.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{fmtDate(sale.date)} · {sale.payMethod}</div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 900, fontSize: 18, color: C.accent }}>{fmt(sale.total, curr)}</div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════════════
function Customers({ customers, setCustomers, sales, user, isPro }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const canAdd = isPro || customers.length < 3;
  const curr = user.currency;

  function add() {
    if (!form.name) return alert("Enter customer name.");
    setCustomers(prev => [...prev, { ...form, id: uid(), createdAt: today() }]);
    setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    setShowAdd(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Customers</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{customers.length} total{!isPro ? ` · Free plan: ${3 - customers.length} slots left` : ""}</div>
        </div>
        {canAdd ? <Btn onClick={() => setShowAdd(true)}>+ Add Customer</Btn> : <Badge color={C.gold}>Upgrade to add more</Badge>}
      </div>

      {showAdd && (
        <Modal title="New Customer" onClose={() => setShowAdd(false)}>
          <Input label="Full Name" value={form.name} onChange={f("name")} placeholder="Chioma Obi" required />
          <Input label="Phone Number" value={form.phone} onChange={f("phone")} placeholder="+234 800 000 0000" />
          <Input label="Email" value={form.email} onChange={f("email")} placeholder="chioma@email.com" />
          <Input label="Address" value={form.address} onChange={f("address")} placeholder="10 Marina Street, Lagos" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Notes</div>
            <textarea value={form.notes} onChange={e => f("notes")(e.target.value)} placeholder="Prefers bulk orders, pays on time..." rows={3}
              style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={add}>Save Customer</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {customers.length === 0
        ? <EmptyState icon="👥" title="No customers yet" desc="Build your customer database to track loyalty and follow up on debts." action="+ Add Customer" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 12 }}>
            {customers.map(c => {
              const custSales = sales.filter(s => s.customerId === c.id);
              const totalSpent = custSales.reduce((s, sale) => s + sale.total, 0);
              return (
                <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 900, fontSize: 18, color: C.accent, flexShrink: 0 }}>
                      {c.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{c.phone} {c.email && `· ${c.email}`}</div>
                      {c.notes && <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 4 }}>{c.notes}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.accent, fontSize: 16 }}>{fmt(totalSpent, curr)}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{custSales.length} purchase{custSales.length !== 1 ? "s" : ""}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Since {fmtDate(c.createdAt)}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// EXPENSES
// ══════════════════════════════════════════════════════
function Expenses({ expenses, setExpenses, user }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", category: "operations", date: today() });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const curr = user.currency;

  function add() {
    if (!form.description || !form.amount) return alert("Fill required fields.");
    setExpenses(prev => [...prev, { ...form, amount: Number(form.amount), id: uid(), createdAt: now() }]);
    setForm({ description: "", amount: "", category: "operations", date: today() });
    setShowAdd(false);
  }

  const thisMonthExpenses = expenses.filter(e => e.date.startsWith(thisMonth()));
  const total = thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = thisMonthExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + Number(e.amount); return acc; }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Expenses</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>This month: {fmt(total, curr)}</div>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Expense</Btn>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.entries(byCategory).map(([cat, amount]) => (
            <Card key={cat} style={{ flex: 1, minWidth: 140, background: C.redLight, border: `1px solid #fca5a5` }}>
              <div style={{ fontSize: 11, color: C.red, textTransform: "capitalize", fontWeight: 700, marginBottom: 6 }}>{cat}</div>
              <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.red }}>{fmt(amount, curr)}</div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Expense" onClose={() => setShowAdd(false)}>
          <Input label="Description" value={form.description} onChange={f("description")} placeholder="Generator fuel, Staff salary..." required />
          <Input label={`Amount (${curr})`} value={form.amount} onChange={f("amount")} placeholder="5000" type="number" required />
          <Select label="Category" value={form.category} onChange={f("category")} options={[{ value: "operations", label: "Operations" }, { value: "staff", label: "Staff / Salary" }, { value: "rent", label: "Rent / Utilities" }, { value: "transport", label: "Transport" }, { value: "marketing", label: "Marketing" }, { value: "other", label: "Other" }]} />
          <Input label="Date" value={form.date} onChange={f("date")} type="date" />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={add}>Save Expense</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {expenses.length === 0
        ? <EmptyState icon="💸" title="No expenses recorded" desc="Track what you spend to understand your real profit." action="+ Add Expense" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 10 }}>
            {[...expenses].reverse().map(e => (
              <Card key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{e.description}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(e.date)} · <span style={{ textTransform: "capitalize" }}>{e.category}</span></div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.red, fontSize: 15 }}>-{fmt(e.amount, curr)}</div>
                  <Btn size="sm" variant="danger" onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))}>✕</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// AI BRAIN
// ══════════════════════════════════════════════════════
function AIBrain({ user, products, sales, customers, expenses }) {
  const [msgs, setMsgs] = useState([{ role: "ai", text: `Hello ${user.name.split(" ")[0]}! I'm your BizOS AI assistant. I know everything about ${user.business} — your products, sales, customers, and expenses. Ask me anything.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const curr = user.currency;

  const PROMPTS = ["What's my best selling product?", "How much profit did I make this month?", "Which customer buys the most?", "What products are running low?", "What day do I sell the most?", "What are my biggest expenses?"];

  function buildSystem() {
    const monthRevenue = sales.filter(s => s.date.startsWith(thisMonth())).reduce((s, x) => s + x.total, 0);
    const monthExpenses = expenses.filter(e => e.date.startsWith(thisMonth())).reduce((s, e) => s + Number(e.amount), 0);
    const topProducts = products.map(p => ({ name: p.name, sold: sales.flatMap(s => s.items).filter(i => i.productId === p.id).reduce((s, i) => s + i.qty, 0) })).sort((a, b) => b.sold - a.sold).slice(0, 5);
    const topCustomers = customers.map(c => ({ name: c.name, spent: sales.filter(s => s.customerId === c.id).reduce((s, x) => s + x.total, 0) })).sort((a, b) => b.spent - a.spent).slice(0, 5);
    const lowStock = products.filter(p => p.qty <= (p.lowStockAlert || 5)).map(p => p.name);

    return `You are the AI business advisor for ${user.business}, owned by ${user.name}. You have full access to their business data. Be direct, insightful, and practical. Speak like a smart business advisor who cares about their success.

BUSINESS SNAPSHOT:
- Currency: ${curr}
- Total products: ${products.length}
- Total customers: ${customers.length}
- This month revenue: ${curr}${monthRevenue.toLocaleString()}
- This month expenses: ${curr}${monthExpenses.toLocaleString()}  
- Estimated profit: ${curr}${(monthRevenue - monthExpenses).toLocaleString()}
- Low stock items: ${lowStock.join(", ") || "None"}

TOP SELLING PRODUCTS:
${topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.sold} units sold)`).join("\n") || "No sales yet"}

TOP CUSTOMERS:
${topCustomers.map((c, i) => `${i + 1}. ${c.name} (${curr}${c.spent.toLocaleString()} total)`).join("\n") || "No customers yet"}

RECENT SALES (last 10):
${sales.slice(-10).map(s => `- ${curr}${s.total.toLocaleString()} on ${s.date} via ${s.payMethod}`).join("\n") || "None"}

Answer helpfully and specifically. If you spot something concerning (low stock, low profit), mention it proactively. Keep responses concise and actionable.`;
  }

  async function send(msg) {
    const text = msg || input.trim();
    if (!text) return;
    setMsgs(m => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    const reply = await askAI(buildSystem(), text);
    setMsgs(m => [...m, { role: "ai", text: reply }]);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>AI Business Advisor 🧠</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Knows your entire business. Ask anything.</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "ai" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10, flexShrink: 0 }}>🧠</div>}
            <div style={{ maxWidth: "72%", padding: "13px 18px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? "#fff" : C.text, border: m.role === "ai" ? `1px solid ${C.border}` : "none", fontSize: 14, lineHeight: 1.7, fontFamily: C.font, whiteSpace: "pre-wrap" }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧠</div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px 16px 16px 4px", padding: "13px 18px", color: C.muted, fontFamily: C.mono, fontSize: 13 }}>Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {PROMPTS.map(p => (
          <button key={p} onClick={() => send(p)} style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 100, padding: "6px 14px", fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: C.font, fontWeight: 500 }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about your business..."
          style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 18px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.surface, outline: "none" }}
          onFocus={e => e.target.style.borderColor = C.accent}
          onBlur={e => e.target.style.borderColor = C.border} />
        <Btn onClick={() => send()}>Send →</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// UPGRADE MODAL
// ══════════════════════════════════════════════════════
function UpgradeModal({ user, onUpgrade, onClose }) {
  const [email, setEmail] = useState(user.email);
  return (
    <Modal title="" onClose={onClose} width={480}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontFamily: C.display, fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Upgrade to Business</div>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>Unlock everything and run your business without limits.</p>
      </div>
      <div style={{ background: C.accentLight, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        {["✓ Unlimited products & inventory", "✓ Unlimited customers", "✓ Full sales history", "✓ AI business insights", "✓ Staff & expense tracking", "✓ Priority support"].map(f => (
          <div key={f} style={{ fontSize: 14, fontWeight: 600, color: C.accent, padding: "5px 0" }}>{f}</div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: C.display, fontWeight: 900, fontSize: 40, color: C.text }}>₦9,000</span>
        <span style={{ color: C.muted }}>/month</span>
      </div>
      <Input label="Email" value={email} onChange={setEmail} type="email" />
      <Btn full size="lg" onClick={() => paystack(email, 9000, ref => { onUpgrade(); alert("🎉 Welcome to Business! Ref: " + ref); })}>
        Pay ₦9,000/month with Paystack →
      </Btn>
      <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 12 }}>Cancel anytime. Instant activation.</p>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// MAIN APP SHELL
// ══════════════════════════════════════════════════════
function AppShell({ user: initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [nav, setNav] = useState("dashboard");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const key = id => `biz_${id}`;
  const [products, setProducts] = useState(() => db.get(key(initialUser.id) + "_products", []));
  const [sales, setSales] = useState(() => db.get(key(initialUser.id) + "_sales", []));
  const [customers, setCustomers] = useState(() => db.get(key(initialUser.id) + "_customers", []));
  const [expenses, setExpenses] = useState(() => db.get(key(initialUser.id) + "_expenses", []));

  useEffect(() => db.set(key(user.id) + "_products", products), [products]);
  useEffect(() => db.set(key(user.id) + "_sales", sales), [sales]);
  useEffect(() => db.set(key(user.id) + "_customers", customers), [customers]);
  useEffect(() => db.set(key(user.id) + "_expenses", expenses), [expenses]);

  function upgrade() {
    const users = db.get("biz_users", {});
    if (users[user.email]) { users[user.email].isPro = true; db.set("biz_users", users); }
    setUser(u => ({ ...u, isPro: true }));
    setShowUpgrade(false);
  }

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "inventory", label: "Inventory", icon: "📦" },
    { id: "sales", label: "Sales", icon: "💰" },
    { id: "customers", label: "Customers", icon: "👥" },
    { id: "expenses", label: "Expenses", icon: "💸" },
    { id: "ai", label: "AI Advisor", icon: "🧠" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", fontFamily: C.font }}>
      <Fonts />
      {showUpgrade && <UpgradeModal user={user} onUpgrade={upgrade} onClose={() => setShowUpgrade(false)} />}

      {/* Sidebar */}
      <div style={{ width: 230, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", height: "100vh", zIndex: 50 }}>
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌍</div>
            <div style={{ fontFamily: C.display, fontSize: 18, fontWeight: 900, color: C.accent }}>BizOS</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{user.business}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{user.name}</div>
          {user.isPro && <Badge color={C.accent} style={{ marginTop: 8, display: "inline-flex" }}>✦ BUSINESS</Badge>}
        </div>

        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setNav(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: C.font, fontWeight: 600, fontSize: 14, marginBottom: 2, transition: "all 0.15s", background: nav === n.id ? C.accentLight : "transparent", color: nav === n.id ? C.accent : C.muted }}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 10px", borderTop: `1px solid ${C.border}` }}>
          {!user.isPro && (
            <button onClick={() => setShowUpgrade(true)} style={{ width: "100%", background: C.gold, border: "none", borderRadius: 10, padding: "11px 12px", color: "#fff", fontFamily: C.font, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              ⚡ Upgrade to Business
            </button>
          )}
          <button onClick={onLogout} style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", color: C.muted, fontFamily: C.font, fontSize: 13, cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 230, padding: "36px 32px", maxWidth: "calc(100% - 230px)", boxSizing: "border-box", overflowY: "auto" }}>
        {nav === "dashboard" && <Dashboard user={user} products={products} sales={sales} customers={customers} expenses={expenses} onNav={setNav} />}
        {nav === "inventory" && <Inventory products={products} setProducts={setProducts} user={user} isPro={user.isPro} />}
        {nav === "sales" && <Sales sales={sales} setSales={setSales} products={products} setProducts={setProducts} customers={customers} user={user} isPro={user.isPro} />}
        {nav === "customers" && <Customers customers={customers} setCustomers={setCustomers} sales={sales} user={user} isPro={user.isPro} />}
        {nav === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} user={user} />}
        {nav === "ai" && <AIBrain user={user} products={products} sales={sales} customers={customers} expenses={expenses} />}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════
export default function BizOS() {
  const [screen, setScreen] = useState("landing");
  const [user, setUser] = useState(null);
  function login(u) { setUser(u); setScreen("app"); }
  function logout() { setUser(null); setScreen("landing"); }
  if (screen === "landing") return <Landing onStart={() => setScreen("auth")} />;
  if (screen === "auth") return <Auth onAuth={login} />;
  if (screen === "app" && user) return <AppShell user={user} onLogout={logout} />;
  return null;
}