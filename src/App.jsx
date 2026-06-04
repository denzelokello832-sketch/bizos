import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";

// ── FIREBASE CONFIG ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAZsWz9OjwRVfkJwmlSVdhqOwDXNB2iqJs",
  authDomain: "bizos-dec27.firebaseapp.com",
  projectId: "bizos-dec27",
  storageBucket: "bizos-dec27.firebasestorage.app",
  messagingSenderId: "126937721886",
  appId: "1:126937721886:web:cc8e9d376804f5788cd20f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── THEME ─────────────────────────────────────────────────────────────────────
const C = {
  bg: "#f7f4ef", surface: "#ffffff", dark: "#1a1a18", border: "#e8e3db",
  accent: "#1a6b3c", accentLight: "#e8f5ee", accentBright: "#22c55e",
  gold: "#c9831a", goldLight: "#fef3e2", red: "#dc2626", redLight: "#fef2f2",
  blue: "#1d4ed8", text: "#1a1a18", muted: "#78716c", faint: "#f0ece6",
  font: "'Plus Jakarta Sans', sans-serif", display: "'Fraunces', serif", mono: "'JetBrains Mono', monospace",
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const now = () => new Date().toISOString();
const fmt = (n, curr = "KSh") => `${curr} ${Number(n || 0).toLocaleString("en-KE")}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const thisMonth = () => new Date().toISOString().slice(0, 7);

// Get ref code from URL
const getRefCode = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") || localStorage.getItem("bizos_ref") || null;
};

// ── FIREBASE HELPERS ──────────────────────────────────────────────────────────
async function saveUserData(userId, key, data) {
  try {
    await setDoc(doc(db, "users", userId, "data", key), { value: JSON.stringify(data), updatedAt: now() });
  } catch (e) { console.error("Save error:", e); }
}

async function getUserData(userId, key, defaultVal) {
  try {
    const snap = await getDoc(doc(db, "users", userId, "data", key));
    if (snap.exists()) return JSON.parse(snap.data().value);
    return defaultVal;
  } catch (e) { return defaultVal; }
}

async function setUserPro(userId, isPro) {
  try {
    await setDoc(doc(db, "users", userId), { isPro, updatedAt: now() }, { merge: true });
  } catch (e) { console.error("Pro update error:", e); }
}

async function getUserProfile(userId) {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    return snap.exists() ? snap.data() : {};
  } catch (e) { return {}; }
}

// ── MULTI-SHOP HELPERS ────────────────────────────────────────────────────────
async function getShops(userId) {
  try {
    const snap = await getDoc(doc(db, "users", userId, "meta", "shops"));
    return snap.exists() ? snap.data().list || [] : [];
  } catch (e) { return []; }
}

async function saveShops(userId, shops) {
  try {
    await setDoc(doc(db, "users", userId, "meta", "shops"), { list: shops, updatedAt: now() });
  } catch (e) { console.error("Save shops error:", e); }
}

async function saveShopData(userId, shopId, key, data) {
  try {
    await setDoc(doc(db, "users", userId, "shops", shopId, "data", key), { value: JSON.stringify(data), updatedAt: now() });
  } catch (e) { console.error("Save shop data error:", e); }
}

async function getShopData(userId, shopId, key, defaultVal) {
  try {
    const snap = await getDoc(doc(db, "users", userId, "shops", shopId, "data", key));
    if (snap.exists()) return JSON.parse(snap.data().value);
    // Fallback to old data structure for existing users
    return await getUserData(userId, key, defaultVal);
  } catch (e) { return defaultVal; }
}

// Save affiliate referral
async function saveReferral(affiliateRef, newUserId, newUserEmail, newUserName) {
  try {
    // Find affiliate by ref code
    const affSnap = await getDoc(doc(db, "affiliates", affiliateRef));
    if (!affSnap.exists()) return;
    
    const affiliate = affSnap.data();
    
    // Save referral record
    await setDoc(doc(db, "referrals", newUserId), {
      affiliateRef,
      affiliateName: affiliate.name,
      affiliateEmail: affiliate.email,
      affiliatePhone: affiliate.phone,
      userId: newUserId,
      userEmail: newUserEmail,
      userName: newUserName,
      status: "free", // becomes "paid" when they subscribe
      earnings: 0,
      createdAt: now(),
    });

    // Update affiliate referral count
    await setDoc(doc(db, "affiliates", affiliateRef), {
      ...affiliate,
      referralCount: (affiliate.referralCount || 0) + 1,
      lastReferral: now(),
    });
  } catch (e) { console.error("Referral save error:", e); }
}

// Get affiliate stats
async function getAffiliateStats(refCode) {
  try {
    const affSnap = await getDoc(doc(db, "affiliates", refCode));
    if (!affSnap.exists()) return null;
    
    const q = query(collection(db, "referrals"), where("affiliateRef", "==", refCode));
    const refs = await getDocs(q);
    const referrals = refs.docs.map(d => d.data());
    
    return {
      ...affSnap.data(),
      referrals,
      totalReferrals: referrals.length,
      paidReferrals: referrals.filter(r => r.status === "paid").length,
      totalEarnings: referrals.filter(r => r.status === "paid").length * 5,
    };
  } catch (e) { return null; }
}

// Register affiliate
async function registerAffiliate(name, email, phone, country, method) {
  const refCode = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "").slice(0, 8) + Math.random().toString(36).slice(2, 6);
  await setDoc(doc(db, "affiliates", refCode), {
    refCode, name, email, phone, country, method,
    referralCount: 0, totalEarnings: 0, createdAt: now(),
  });
  return refCode;
}

// Mark referral as paid when user upgrades
async function markReferralPaid(userId) {
  try {
    const refSnap = await getDoc(doc(db, "referrals", userId));
    if (!refSnap.exists()) return;
    const ref = refSnap.data();
    await setDoc(doc(db, "referrals", userId), { ...ref, status: "paid", paidAt: now() });
    
    // Update affiliate earnings
    const affSnap = await getDoc(doc(db, "affiliates", ref.affiliateRef));
    if (affSnap.exists()) {
      const aff = affSnap.data();
      await setDoc(doc(db, "affiliates", ref.affiliateRef), {
        ...aff,
        totalEarnings: (aff.totalEarnings || 0) + 5,
      });
    }
  } catch (e) { console.error("Mark paid error:", e); }
}

// ── CLAUDE AI ─────────────────────────────────────────────────────────────────
const ANTHROPIC_KEY = "YOUR_ANTHROPIC_KEY_HERE"; // Replace with sk-ant-...
async function askAI(system, message) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 1000,
        system, messages: [{ role: "user", content: message }],
      }),
    });
    const j = await res.json();
    return j.content?.[0]?.text || "Could not get a response.";
  } catch { return "AI is unavailable right now."; }
}

// ── PAYSTACK ──────────────────────────────────────────────────────────────────
function openPaystack(email, amount, onSuccess) {
  function run() {
    const h = window.PaystackPop?.setup({
      key: "pk_test_08c5d5107aa8861893580f4c2b9acc055efb457a",
      email, amount: amount * 100, currency: "KES",
      callback: r => r.status === "success" && onSuccess(r.reference),
      onClose: () => {},
    });
    h?.openIframe();
  }
  if (window.PaystackPop) {
    run();
  } else {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = run;
    document.head.appendChild(script);
  }
}

// ══════════════════════════════════════════════════════
// UI PRIMITIVES
// ══════════════════════════════════════════════════════
const Fonts = () => <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fraunces:wght@700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />;

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
      style={{ ...sizes[size], ...vars[variant], borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", fontFamily: C.font, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.15s", opacity: disabled ? 0.5 : 1, width: full ? "100%" : "auto", justifyContent: "center", ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(0.92)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
      {children}
    </button>
  );
};

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, cursor: onClick ? "pointer" : "default", ...style }}>
    {children}
  </div>
);

const Badge = ({ children, color = C.accent }) => (
  <span style={{ background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 100, padding: "3px 10px", fontSize: 11, fontFamily: C.mono, fontWeight: 500 }}>
    {children}
  </span>
);

const Input = ({ label, value, onChange, placeholder, type = "text", required }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}{required && <span style={{ color: C.red }}> *</span>}</div>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none" }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Stat = ({ label, value, sub, icon, color = C.accent }) => (
  <Card>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    <div style={{ fontFamily: C.display, fontSize: 26, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</div>}
  </Card>
);

const Modal = ({ title, onClose, children, width = 520 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,24,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={onClose}>
    <div style={{ background: C.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 700 }}>{title}</div>
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
    <div style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>{desc}</div>
    {action && <Btn onClick={onAction}>{action}</Btn>}
  </div>
);

const Loader = ({ text = "Loading..." }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: C.font, color: C.muted, fontSize: 14 }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>🌍</div>
      <div>{text}</div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════
// AFFILIATE DASHBOARD
// ══════════════════════════════════════════════════════
function AffiliateDashboard({ refCode, onBack }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAffiliateStats(refCode).then(s => { setStats(s); setLoading(false); });
  }, [refCode]);

  if (loading) return <Loader text="Loading your stats..." />;
  if (!stats) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.font }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
        <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 700 }}>Affiliate not found</div>
        <Btn onClick={onBack} style={{ marginTop: 16 }} variant="secondary">Go Back</Btn>
      </div>
    </div>
  );

  const refUrl = `https://bizos-nine.vercel.app?ref=${refCode}`;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font }}>
      <Fonts />
      <div style={{ background: C.dark, padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 900, color: C.accentBright }}>BizOS Affiliate</div>
        <Btn variant="ghost" onClick={onBack} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>← Back</Btn>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <h2 style={{ fontFamily: C.display, fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Welcome, {stats.name}! 👋</h2>
        <p style={{ color: C.muted, marginBottom: 32 }}>Here's your affiliate performance dashboard.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 32 }}>
          <Stat label="Total Referrals" value={stats.totalReferrals} icon="👥" color={C.accent} />
          <Stat label="Paying Users" value={stats.paidReferrals} icon="💰" color={C.gold} sub="KSh 500 each" />
          <Stat label="Total Earned" value={`$${stats.totalEarnings}`} icon="🤑" color={C.accentBright} sub="Paid to M-Pesa" />
          <Stat label="Pending" value={stats.totalReferrals - stats.paidReferrals} icon="⏳" color={C.blue} sub="Free users" />
        </div>

        <Card style={{ marginBottom: 24, background: C.accentLight, border: `1px solid ${C.accent}30` }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 12, color: C.accent }}>Your Referral Link</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontFamily: C.mono, fontSize: 13, color: C.accent, marginBottom: 12, wordBreak: "break-all" }}>
            {refUrl}
          </div>
          <Btn onClick={() => { navigator.clipboard.writeText(refUrl); alert("✅ Link copied!"); }}>📋 Copy Link</Btn>
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Your Referrals</div>
          {stats.referrals.length === 0
            ? <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: 24 }}>No referrals yet. Share your link to start earning!</div>
            : stats.referrals.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.faint}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.userName}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{r.userEmail} · {fmtDate(r.createdAt)}</div>
                </div>
                <Badge color={r.status === "paid" ? C.accentBright : C.gold}>
                  {r.status === "paid" ? "✓ PAID — $5 earned" : "FREE TRIAL"}
                </Badge>
              </div>
            ))}
        </Card>

        <Card style={{ background: C.goldLight, border: `1px solid ${C.gold}30` }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.gold }}>💰 How Payouts Work</div>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: 0 }}>
            You earn $5 for every business that upgrades to Business plan through your link. Payouts via M-Pesa when you hit $20 minimum. We'll WhatsApp you at <strong>{stats.phone}</strong> when you're ready to withdraw.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// AFFILIATE SIGNUP PAGE
// ══════════════════════════════════════════════════════
function AffiliateSignup({ onBack }) {
  const [step, setStep] = useState("form"); // form | success
  const [refCode, setRefCode] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", country: "Kenya", method: "WhatsApp" });
  const [loading, setLoading] = useState(false);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  // Check if viewing existing dashboard
  const [checkCode, setCheckCode] = useState("");
  const [viewMode, setViewMode] = useState("signup"); // signup | login | dashboard

  if (viewMode === "dashboard") return <AffiliateDashboard refCode={checkCode} onBack={() => setViewMode("signup")} />;

  async function submit() {
    if (!form.name || !form.email || !form.phone) return alert("Fill all fields.");
    setLoading(true);
    const code = await registerAffiliate(form.name, form.email, form.phone, form.country, form.method);
    setRefCode(code);
    setStep("success");
    setLoading(false);
  }

  const refUrl = `https://bizos-nine.vercel.app?ref=${refCode}`;
  const shareMsg = `Hi! I found this free app called BizOS that helps small businesses track their stock, sales and customers — with AI insights. It's completely free to start. Check it out: ${refUrl}`;

  return (
    <div style={{ minHeight: "100vh", background: C.dark, fontFamily: C.font, color: "#fff" }}>
      <Fonts />
      <div style={{ background: "rgba(0,0,0,0.3)", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 900, color: C.accentBright }}>🌍 BizOS Affiliates</div>
        <Btn variant="ghost" onClick={onBack} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>← Back to BizOS</Btn>
      </div>

      {step === "form" && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ display: "inline-block", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 100, padding: "6px 20px", fontSize: 12, color: C.accentBright, fontFamily: C.mono, marginBottom: 20 }}>
              💰 EARN $5 PER REFERRAL
            </div>
            <h1 style={{ fontFamily: C.display, fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.05, margin: "0 0 16px" }}>
              Earn money<br /><span style={{ color: C.accentBright }}>selling BizOS</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, lineHeight: 1.7 }}>
              Share BizOS with shop owners. Every time someone subscribes through your link — you earn $5. Every month they stay.
            </p>
          </div>

          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 32, marginBottom: 24 }}>
            <Input label="Full Name" value={form.name} onChange={f("name")} placeholder="John Kamau" />
            <Input label="Email" value={form.email} onChange={f("email")} placeholder="john@gmail.com" type="email" />
            <Input label="WhatsApp Number" value={form.phone} onChange={f("phone")} placeholder="+254 700 000 000" />
            <Select label="Country" value={form.country} onChange={f("country")} options={[
              { value: "Kenya", label: "Kenya" }, { value: "Nigeria", label: "Nigeria" },
              { value: "Ghana", label: "Ghana" }, { value: "Uganda", label: "Uganda" },
              { value: "Tanzania", label: "Tanzania" }, { value: "Other", label: "Other" },
            ]} />
            <Select label="How will you promote?" value={form.method} onChange={f("method")} options={[
              { value: "WhatsApp", label: "WhatsApp groups" },
              { value: "Facebook", label: "Facebook / Instagram" },
              { value: "TikTok", label: "TikTok" },
              { value: "Direct", label: "Direct to businesses" },
              { value: "Other", label: "Other" },
            ]} />
            <Btn full size="lg" onClick={submit} disabled={loading} style={{ background: C.accentBright, color: "#000" }}>
              {loading ? "Creating your link..." : "Get My Affiliate Link →"}
            </Btn>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Already have a link?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={checkCode} onChange={e => setCheckCode(e.target.value)} placeholder="Enter your ref code (e.g. john1234)"
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontFamily: C.font, fontSize: 14, outline: "none" }} />
              <Btn onClick={() => { if (checkCode) setViewMode("dashboard"); }} variant="ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>View Stats</Btn>
            </div>
          </div>
        </div>
      )}

      {step === "success" && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h2 style={{ fontFamily: C.display, fontSize: 36, fontWeight: 900, marginBottom: 8 }}>You're in!</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 32, fontSize: 15, lineHeight: 1.7 }}>
            Welcome to the BizOS affiliate program. Your unique link is ready. Share it everywhere and start earning.
          </p>

          <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.accentBright}40`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontFamily: C.mono, color: C.accentBright, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>Your Referral Link</div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 16px", fontFamily: C.mono, fontSize: 13, color: C.accentBright, wordBreak: "break-all", marginBottom: 12 }}>
              {refUrl}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: C.mono, marginBottom: 16 }}>Your ref code: <strong style={{ color: C.accentBright }}>{refCode}</strong> — save this to check your stats later</div>
            <Btn onClick={() => { navigator.clipboard.writeText(refUrl); alert("✅ Copied!"); }} style={{ background: C.accentBright, color: "#000", marginRight: 10 }}>📋 Copy Link</Btn>
            <Btn onClick={() => { setCheckCode(refCode); setViewMode("dashboard"); }} variant="ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>View Dashboard</Btn>
          </div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "left", marginBottom: 24 }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>📱 Ready-to-send WhatsApp message</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.8, marginBottom: 12 }}>{shareMsg}</div>
            <Btn onClick={() => { navigator.clipboard.writeText(shareMsg); alert("✅ Message copied! Paste in WhatsApp."); }} variant="ghost" style={{ color: C.accentBright, borderColor: `${C.accentBright}40` }}>📋 Copy Message</Btn>
          </div>

          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
            Payouts via M-Pesa when you hit $20. We'll WhatsApp you at {form.phone}.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LANDING
// ══════════════════════════════════════════════════════
function Landing({ onStart, onAffiliate }) {
  return (
    <div style={{ minHeight: "100vh", background: C.dark, color: "#fff", fontFamily: C.font }}>
      <Fonts />
      <script src="https://js.paystack.co/v1/inline.js" />
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34,197,94,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌍</div>
          <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 900 }}>BizOS</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onAffiliate} size="sm" style={{ color: C.accentBright, borderColor: `${C.accentBright}40` }}>💰 Earn</Btn>
          <Btn variant="ghost" onClick={onStart} size="sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>Login</Btn>
          <Btn onClick={onStart} size="sm" style={{ background: C.accentBright, color: "#000" }}>Start Free</Btn>
        </div>
      </nav>
      <div style={{ textAlign: "center", padding: "70px 24px 80px", maxWidth: 820, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 100, padding: "6px 18px", fontSize: 12, color: C.accentBright, fontFamily: C.mono, marginBottom: 28 }}>
          🌍 Built for African Businesses
        </div>
        <h1 style={{ fontFamily: C.display, fontSize: "clamp(44px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.05, margin: "0 0 20px", letterSpacing: "-0.03em" }}>
          Run your entire<br /><span style={{ color: C.accentBright }}>business in one place.</span>
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Inventory. Sales. Customers. Staff. AI insights. Everything your shop needs — without the spreadsheets, the guesswork, or the stress.
        </p>
        <Btn size="lg" onClick={onStart} style={{ background: C.accentBright, color: "#000" }}>Start Free Today →</Btn>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 16, fontFamily: C.mono }}>Free forever · No credit card · Upgrade anytime</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, maxWidth: 900, margin: "0 auto", padding: "0 24px 60px" }}>
        {[
          { icon: "📦", title: "Inventory", desc: "Track every product. Get low-stock alerts before you run out." },
          { icon: "💰", title: "Sales Tracking", desc: "Record every sale. Know exactly how much you make daily." },
          { icon: "👥", title: "Customers", desc: "Know every customer. Track who owes you, who's loyal." },
          { icon: "🧠", title: "AI Advisor", desc: "Ask anything. 'What's my best product?' It knows your data." },
        ].map(f => (
          <Card key={f.title} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderTop: `3px solid ${C.accentBright}` }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontFamily: C.display, fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{f.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{f.desc}</div>
          </Card>
        ))}
      </div>
      <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, maxWidth: 700, margin: "0 auto 80px", padding: "32px 40px", textAlign: "center", position: "relative", zIndex: 10 }}>
        <div style={{ fontFamily: C.display, fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Know a business owner? 💰</div>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 20, fontSize: 14 }}>Join our affiliate program. Earn $5 for every business you bring to BizOS — every month they stay.</p>
        <Btn onClick={onAffiliate} style={{ background: C.accentBright, color: "#000" }}>Join Affiliate Program →</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════
function Auth({ onAuth }) {
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", pass: "", currency: "KSh" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  async function forgotPassword() {
    if (!form.email) return setErr("Enter your email first then click Forgot Password.");
    try {
      await sendPasswordResetEmail(auth, form.email);
      setResetSent(true);
      setErr("");
    } catch (e) { setErr("Could not send reset email. Check your email address."); }
  }

  async function submit() {
    setErr(""); setLoading(true);
    try {
      if (mode === "signup") {
        if (!form.name || !form.business || !form.email || !form.pass) { setErr("Fill all required fields."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.pass);
        const userData = { id: cred.user.uid, name: form.name, business: form.business, phone: form.phone, email: form.email, currency: form.currency, isPro: false, createdAt: today() };
        await setDoc(doc(db, "users", cred.user.uid), userData);
        
        // Track referral if user came from affiliate link
        const refCode = getRefCode();
        if (refCode) {
          await saveReferral(refCode, cred.user.uid, form.email, form.name);
          localStorage.removeItem("bizos_ref");
        }
        
        onAuth(userData);
      } else {
        if (!form.email || !form.pass) { setErr("Enter email and password."); setLoading(false); return; }
        const cred = await signInWithEmailAndPassword(auth, form.email, form.pass);
        const profile = await getUserProfile(cred.user.uid);
        onAuth({ ...profile, id: cred.user.uid });
      }
    } catch (e) {
      setErr(e.code === "auth/email-already-in-use" ? "Account exists. Login instead." : e.code === "auth/wrong-password" || e.code === "auth/user-not-found" ? "Wrong email or password." : e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", fontFamily: C.font }}>
      <Fonts />
      <div style={{ width: "42%", background: C.dark, padding: 48, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontFamily: C.display, fontSize: 28, fontWeight: 900, color: "#fff" }}>🌍 <span style={{ color: C.accentBright }}>BizOS</span></div>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.8, marginTop: 24, maxWidth: 300 }}>
          The operating system for African businesses. Your data saved to cloud — access from any device.
        </p>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
          {["📦 Real-time inventory", "💰 Daily sales tracking", "🧠 AI business insights", "☁️ Cloud sync across devices"].map(f => (
            <div key={f} style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{f}</div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ fontFamily: C.display, fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>
            {mode === "signup" ? "Start managing your business today." : "Sign in to your BizOS account."}
          </p>
          {mode === "signup" && <>
            <Input label="Your Name" value={form.name} onChange={f("name")} placeholder="Amara Wanjiku" required />
            <Input label="Business Name" value={form.business} onChange={f("business")} placeholder="Amara's Shop" required />
            <Input label="Phone" value={form.phone} onChange={f("phone")} placeholder="+254 700 000 000" />
            <Select label="Currency" value={form.currency} onChange={f("currency")} options={[
              { value: "KSh", label: "KSh — Kenyan Shilling" },
              { value: "₦", label: "₦ — Nigerian Naira" },
              { value: "GH₵", label: "GH₵ — Ghanaian Cedi" },
              { value: "$", label: "$ — US Dollar" },
            ]} />
          </>}
          <Input label="Email" value={form.email} onChange={f("email")} placeholder="you@email.com" type="email" required />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Password <span style={{ color: C.red }}>*</span></div>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} value={form.pass} onChange={e => f("pass")(e.target.value)} placeholder="••••••••"
                style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 44px 10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none" }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border} />
              <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.muted }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {resetSent && <div style={{ color: C.accent, fontSize: 13, marginBottom: 14, background: C.accentLight, padding: "10px 14px", borderRadius: 8 }}>✅ Password reset email sent! Check your inbox.</div>}
          {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 14, background: C.redLight, padding: "10px 14px", borderRadius: 8 }}>{err}</div>}
          <Btn full onClick={submit} size="lg" disabled={loading}>{loading ? "Please wait..." : mode === "signup" ? "Create Account →" : "Login →"}</Btn>
          {mode === "login" && (
            <p style={{ textAlign: "center", fontSize: 13, color: C.muted, marginTop: 12 }}>
              <span style={{ color: C.accent, cursor: "pointer", fontWeight: 600 }} onClick={forgotPassword}>Forgot Password?</span>
            </p>
          )}
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
  const curr = user.currency || "KSh";
  const todaySales = sales.filter(s => s.date === today()).reduce((sum, s) => sum + s.total, 0);
  const monthSales = sales.filter(s => s.date?.startsWith(thisMonth())).reduce((sum, s) => sum + s.total, 0);
  const lowStock = products.filter(p => p.qty <= (p.lowStockAlert || 5)).length;
  const recentSales = [...sales].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 26, margin: "0 0 4px" }}>Good day, {user.name?.split(" ")[0]} 👋</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>{user.business} · {fmtDate(today())}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label="Today's Sales" value={fmt(todaySales, curr)} sub={`${sales.filter(s => s.date === today()).length} transactions`} icon="💰" color={C.accent} />
        <Stat label="This Month" value={fmt(monthSales, curr)} sub="Total revenue" icon="📈" color={C.gold} />
        <Stat label="Customers" value={customers.length} sub="Total records" icon="👥" color={C.blue} />
        <Stat label="Low Stock" value={lowStock} sub={lowStock > 0 ? "Need restocking" : "All good"} icon="📦" color={lowStock > 0 ? C.red : C.accentBright} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16 }}>Recent Sales</div>
            <Btn size="sm" variant="secondary" onClick={() => onNav("sales")}>View All</Btn>
          </div>
          {recentSales.length === 0
            ? <EmptyState icon="💰" title="No sales yet" desc="Record your first sale." action="Record Sale" onAction={() => onNav("sales")} />
            : recentSales.map(s => {
              const cust = customers.find(c => c.id === s.customerId);
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${C.faint}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cust?.name || "Walk-in"}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{s.items?.length || 0} items · {fmtDate(s.date)}</div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.accent }}>{fmt(s.total, curr)}</div>
                </div>
              );
            })}
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
      {lowStock > 0 && (
        <Card style={{ background: C.redLight, border: "1px solid #fca5a5", marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: C.red, marginBottom: 4 }}>⚠ {lowStock} product{lowStock > 1 ? "s" : ""} running low</div>
              <div style={{ fontSize: 13, color: C.muted }}>{products.filter(p => p.qty <= (p.lowStockAlert || 5)).map(p => p.name).join(", ")}</div>
            </div>
            <Btn size="sm" variant="danger" onClick={() => onNav("inventory")}>View</Btn>
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
  const [editProduct, setEditProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", category: "", buyPrice: "", sellPrice: "", qty: "", unit: "pcs", lowStockAlert: "5" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const canAdd = isPro || products.length < 50;
  const curr = user.currency || "KSh";

  function add() {
    if (!form.name || !form.sellPrice || !form.qty) return alert("Fill required fields.");
    setProducts(prev => [...prev, { ...form, id: uid(), sellPrice: Number(form.sellPrice), buyPrice: Number(form.buyPrice || 0), qty: Number(form.qty), lowStockAlert: Number(form.lowStockAlert || 5), createdAt: today() }]);
    setForm({ name: "", category: "", buyPrice: "", sellPrice: "", qty: "", unit: "pcs", lowStockAlert: "5" });
    setShowAdd(false);
  }

  function openEdit(p) {
    setEditProduct(p);
    setForm({ name: p.name, category: p.category || "", buyPrice: String(p.buyPrice || ""), sellPrice: String(p.sellPrice), qty: String(p.qty), unit: p.unit || "pcs", lowStockAlert: String(p.lowStockAlert || 5) });
  }

  function saveEdit() {
    if (!form.name || !form.sellPrice) return alert("Fill required fields.");
    setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...form, sellPrice: Number(form.sellPrice), buyPrice: Number(form.buyPrice || 0), qty: Number(form.qty), lowStockAlert: Number(form.lowStockAlert || 5) } : p));
    setEditProduct(null);
    setForm({ name: "", category: "", buyPrice: "", sellPrice: "", qty: "", unit: "pcs", lowStockAlert: "5" });
  }

  const [showLowOnly, setShowLowOnly] = useState(false);
  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchLow = showLowOnly ? p.qty <= (p.lowStockAlert || 5) : true;
    return matchSearch && matchLow;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Inventory</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{products.length} products</div>
        </div>
        {canAdd ? <Btn onClick={() => setShowAdd(true)}>+ Add Product</Btn> : <Badge color={C.gold}>Upgrade for unlimited</Badge>}
      </div>
      <Input value={search} onChange={setSearch} placeholder="🔍 Search products..." />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowLowOnly(false)}
          style={{ border: `1px solid ${!showLowOnly ? C.accent : C.border}`, background: !showLowOnly ? C.accentLight : "transparent", color: !showLowOnly ? C.accent : C.muted, borderRadius: 8, padding: "7px 16px", fontSize: 12, cursor: "pointer", fontFamily: C.mono, fontWeight: !showLowOnly ? 700 : 400 }}>
          All Products ({products.length})
        </button>
        <button onClick={() => setShowLowOnly(true)}
          style={{ border: `1px solid ${showLowOnly ? C.red : C.border}`, background: showLowOnly ? C.redLight : "transparent", color: showLowOnly ? C.red : C.muted, borderRadius: 8, padding: "7px 16px", fontSize: 12, cursor: "pointer", fontFamily: C.mono, fontWeight: showLowOnly ? 700 : 400 }}>
          ⚠ Low Stock ({products.filter(p => p.qty <= (p.lowStockAlert || 5)).length})
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Product" onClose={() => setShowAdd(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Product Name *" value={form.name} onChange={f("name")} placeholder="Tusker Beer" /></div>
            <Input label="Category" value={form.category} onChange={f("category")} placeholder="Drinks..." />
            <Select label="Unit" value={form.unit} onChange={f("unit")} options={[{ value: "pcs", label: "Pieces" }, { value: "kg", label: "Kilograms" }, { value: "litres", label: "Litres" }, { value: "bags", label: "Bags" }, { value: "cartons", label: "Cartons" }]} />
            <Input label={`Buy Price (${curr})`} value={form.buyPrice} onChange={f("buyPrice")} placeholder="200" type="number" />
            <Input label={`Sell Price (${curr}) *`} value={form.sellPrice} onChange={f("sellPrice")} placeholder="250" type="number" />
            <Input label="Stock Qty *" value={form.qty} onChange={f("qty")} placeholder="100" type="number" />
            <Input label="Low Stock Alert" value={form.lowStockAlert} onChange={f("lowStockAlert")} placeholder="5" type="number" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={add}>Add Product</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editProduct && (
        <Modal title={`Edit — ${editProduct.name}`} onClose={() => setEditProduct(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}><Input label="Product Name *" value={form.name} onChange={f("name")} placeholder="Tusker Beer" /></div>
            <Input label="Category" value={form.category} onChange={f("category")} placeholder="Drinks..." />
            <Select label="Unit" value={form.unit} onChange={f("unit")} options={[{ value: "pcs", label: "Pieces" }, { value: "kg", label: "Kilograms" }, { value: "litres", label: "Litres" }, { value: "bags", label: "Bags" }, { value: "cartons", label: "Cartons" }]} />
            <Input label={`Buy Price (${curr})`} value={form.buyPrice} onChange={f("buyPrice")} placeholder="200" type="number" />
            <Input label={`Sell Price (${curr}) *`} value={form.sellPrice} onChange={f("sellPrice")} placeholder="250" type="number" />
            <Input label="Current Stock" value={form.qty} onChange={f("qty")} placeholder="100" type="number" />
            <Input label="Low Stock Alert" value={form.lowStockAlert} onChange={f("lowStockAlert")} placeholder="5" type="number" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Btn onClick={saveEdit}>Save Changes</Btn>
            <Btn variant="ghost" onClick={() => setEditProduct(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {filtered.length === 0
        ? <EmptyState icon="📦" title="No products yet" desc="Add your first product." action="+ Add Product" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map((p) => {
              const isLow = p.qty <= (p.lowStockAlert || 5);
              return (
                <Card key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
                      {p.category && <div style={{ fontSize: 12, color: C.muted }}>{p.category}</div>}
                    </div>
                    <Badge color={isLow ? C.red : C.accentBright}>{isLow ? "LOW STOCK" : "IN STOCK"}</Badge>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div style={{ background: C.faint, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Buy</div>
                      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700 }}>{p.buyPrice ? fmt(p.buyPrice, curr) : "—"}</div>
                    </div>
                    <div style={{ background: C.accentLight, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: C.accent, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Sell</div>
                      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(p.sellPrice, curr)}</div>
                    </div>
                    <div style={{ background: C.faint, borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Stock</div>
                      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700 }}>{p.qty} {p.unit}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn size="sm" variant="secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(p)}>✏️ Edit</Btn>
                    <Btn size="sm" variant="secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => { const q = Number(prompt("Units to add?")); if (q) setProducts(prev => prev.map(x => x.id === p.id ? { ...x, qty: x.qty + q } : x)); }}>+ Stock</Btn>
                    <Btn size="sm" variant="danger" onClick={() => { if (window.confirm("Remove this product?")) setProducts(prev => prev.filter(x => x.id !== p.id)); }}>✕</Btn>
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
// SALES
// ══════════════════════════════════════════════════════
function Sales({ sales, setSales, products, setProducts, customers, user }) {
  const [showAdd, setShowAdd] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [filter, setFilter] = useState("today");
  const [productSearch, setProductSearch] = useState("");
  const curr = user.currency || "KSh";

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  function addToCart(p) {
    if (p.qty < 1) return alert("Out of stock.");
    setCart(prev => {
      const ex = prev.find(i => i.productId === p.id);
      if (ex) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId: p.id, name: p.name, sellPrice: p.sellPrice, qty: 1 }];
    });
  }

  const cartTotal = cart.reduce((s, i) => s + i.sellPrice * i.qty, 0);

  function recordSale() {
    if (cart.length === 0) return alert("Add items to cart.");
    setProducts(prev => prev.map(p => {
      const item = cart.find(i => i.productId === p.id);
      return item ? { ...p, qty: Math.max(0, p.qty - item.qty) } : p;
    }));
    setSales(prev => [...prev, { id: uid(), items: cart, total: cartTotal, customerId: selectedCustomer, payMethod, date: today(), createdAt: now() }]);
    setCart([]); setSelectedCustomer(""); setPayMethod("cash"); setShowAdd(false);
  }

  const filtered = sales.filter(s => {
    if (filter === "today") return s.date === today();
    if (filter === "week") return s.date >= new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    if (filter === "month") return s.date?.startsWith(thisMonth());
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Sales</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{filtered.length} transactions · {fmt(filtered.reduce((s, x) => s + x.total, 0), curr)}</div>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Record Sale</Btn>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["today", "week", "month", "all"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ border: `1px solid ${filter === f ? C.accent : C.border}`, background: filter === f ? C.accentLight : "transparent", color: filter === f ? C.accent : C.muted, borderRadius: 8, padding: "7px 16px", fontSize: 12, cursor: "pointer", fontFamily: C.mono, textTransform: "capitalize", fontWeight: filter === f ? 700 : 400 }}>
            {f}
          </button>
        ))}
      </div>
      {showAdd && (
        <Modal title="Record New Sale" onClose={() => setShowAdd(false)} width={640}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase" }}>Select Products</div>
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="🔍 Search product..."
                style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontFamily: C.font, fontSize: 13, marginBottom: 8, outline: "none", background: C.bg, color: C.text }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
                {filteredProducts.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>No products found.</div>
                  : filteredProducts.map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: C.faint }}
                      onMouseEnter={e => e.currentTarget.style.background = C.accentLight}
                      onMouseLeave={e => e.currentTarget.style.background = C.faint}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>Stock: {p.qty}</div>
                      </div>
                      <div style={{ fontFamily: C.mono, fontSize: 13, color: C.accent, fontWeight: 700 }}>{fmt(p.sellPrice, curr)}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase" }}>Cart</div>
              <div style={{ minHeight: 160, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                {cart.length === 0 ? <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 40 }}>Click products to add</div>
                  : cart.map(item => (
                    <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => setCart(prev => item.qty <= 1 ? prev.filter(i => i.productId !== item.productId) : prev.map(i => i.productId === item.productId ? { ...i, qty: i.qty - 1 } : i))} style={{ width: 24, height: 24, border: `1px solid ${C.border}`, borderRadius: 4, background: C.faint, cursor: "pointer" }}>-</button>
                        <span style={{ fontSize: 13, fontFamily: C.mono, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                        <button onClick={() => setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i))} style={{ width: 24, height: 24, border: `1px solid ${C.border}`, borderRadius: 4, background: C.faint, cursor: "pointer" }}>+</button>
                      </div>
                      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.accent, marginLeft: 8 }}>{fmt(item.sellPrice * item.qty, curr)}</div>
                    </div>
                  ))}
              </div>
              <Select label="Customer" value={selectedCustomer} onChange={setSelectedCustomer} options={[{ value: "", label: "Walk-in customer" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
              <Select label="Payment" value={payMethod} onChange={setPayMethod} options={[{ value: "cash", label: "💵 Cash" }, { value: "mpesa", label: "📱 M-Pesa" }, { value: "transfer", label: "🏦 Bank Transfer" }, { value: "pos", label: "💳 POS" }]} />
              <div style={{ background: C.accentLight, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: C.accent }}>Total</span>
                <span style={{ fontFamily: C.mono, fontWeight: 900, fontSize: 20, color: C.accent }}>{fmt(cartTotal, curr)}</span>
              </div>
              <Btn full onClick={recordSale} disabled={cart.length === 0}>✓ Complete Sale</Btn>
            </div>
          </div>
        </Modal>
      )}
      {filtered.length === 0
        ? <EmptyState icon="💰" title="No sales" desc="Record your first sale." action="+ Record Sale" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 10 }}>
            {[...filtered].reverse().map(sale => {
              const cust = customers.find(c => c.id === sale.customerId);
              return (
                <Card key={sale.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{cust?.name || "Walk-in"}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{sale.items?.map(i => `${i.name} ×${i.qty}`).join(", ")}</div>
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
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const canAdd = isPro || customers.length < 3;
  const curr = user.currency || "KSh";

  function add() {
    if (!form.name) return alert("Enter customer name.");
    setCustomers(prev => [...prev, { ...form, id: uid(), createdAt: today() }]);
    setForm({ name: "", phone: "", email: "", notes: "" });
    setShowAdd(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Customers</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>{customers.length} total{!isPro ? ` · ${3 - customers.length} free slots left` : ""}</div>
        </div>
        {canAdd ? <Btn onClick={() => setShowAdd(true)}>+ Add Customer</Btn> : <Badge color={C.gold}>Upgrade to add more</Badge>}
      </div>
      {showAdd && (
        <Modal title="New Customer" onClose={() => setShowAdd(false)}>
          <Input label="Full Name *" value={form.name} onChange={f("name")} placeholder="Jane Wanjiku" />
          <Input label="Phone" value={form.phone} onChange={f("phone")} placeholder="+254 700 000 000" />
          <Input label="Email" value={form.email} onChange={f("email")} placeholder="jane@email.com" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Notes</div>
            <textarea value={form.notes} onChange={e => f("notes")(e.target.value)} placeholder="Notes about this customer..." rows={3}
              style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={add}>Save</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
      {customers.length === 0
        ? <EmptyState icon="👥" title="No customers yet" desc="Build your customer database." action="+ Add Customer" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 12 }}>
            {customers.map(c => {
              const spent = sales.filter(s => s.customerId === c.id).reduce((s, x) => s + x.total, 0);
              return (
                <Card key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontWeight: 900, fontSize: 18, color: C.accent, flexShrink: 0 }}>
                      {c.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{c.phone} {c.email && `· ${c.email}`}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.accent }}>{fmt(spent, curr)}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{sales.filter(s => s.customerId === c.id).length} purchases</div>
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
  const curr = user.currency || "KSh";
  const total = expenses.filter(e => e.date?.startsWith(thisMonth())).reduce((s, e) => s + Number(e.amount), 0);

  function add() {
    if (!form.description || !form.amount) return alert("Fill required fields.");
    setExpenses(prev => [...prev, { ...form, amount: Number(form.amount), id: uid(), createdAt: now() }]);
    setForm({ description: "", amount: "", category: "operations", date: today() });
    setShowAdd(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>Expenses</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>This month: {fmt(total, curr)}</div>
        </div>
        <Btn onClick={() => setShowAdd(true)}>+ Add Expense</Btn>
      </div>
      {showAdd && (
        <Modal title="Add Expense" onClose={() => setShowAdd(false)}>
          <Input label="Description *" value={form.description} onChange={f("description")} placeholder="Generator fuel..." />
          <Input label={`Amount (${curr}) *`} value={form.amount} onChange={f("amount")} placeholder="5000" type="number" />
          <Select label="Category" value={form.category} onChange={f("category")} options={[{ value: "operations", label: "Operations" }, { value: "staff", label: "Staff / Salary" }, { value: "rent", label: "Rent" }, { value: "transport", label: "Transport" }, { value: "marketing", label: "Marketing" }, { value: "other", label: "Other" }]} />
          <Input label="Date" value={form.date} onChange={f("date")} type="date" />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={add}>Save</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
      {expenses.length === 0
        ? <EmptyState icon="💸" title="No expenses" desc="Track your spending." action="+ Add Expense" onAction={() => setShowAdd(true)} />
        : (
          <div style={{ display: "grid", gap: 10 }}>
            {[...expenses].reverse().map(e => (
              <Card key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{e.description}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(e.date)} · {e.category}</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ fontFamily: C.mono, fontWeight: 700, color: C.red }}>-{fmt(e.amount, curr)}</div>
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
function AIBrain({ user, products, sales, customers, expenses, onUpgrade }) {
  const [msgs, setMsgs] = useState([{ role: "ai", text: `Hello ${user.name?.split(" ")[0]}! I'm your BizOS AI advisor. I know everything about ${user.business}. Ask me anything.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const curr = user.currency || "KSh";

  // Lock AI behind Pro plan
  if (!user.isPro) return (
    <div style={{ textAlign: "center", padding: "60px 24px", fontFamily: C.font }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🧠</div>
      <div style={{ fontFamily: C.display, fontSize: 24, fontWeight: 900, marginBottom: 12 }}>AI Business Advisor</div>
      <p style={{ color: C.muted, fontSize: 15, maxWidth: 400, margin: "0 auto 20px", lineHeight: 1.7 }}>
        Get instant answers about your business. Ask anything and your AI advisor will tell you exactly what's working and what's not.
      </p>
      <div style={{ background: C.accentLight, border: `1px solid ${C.accent}30`, borderRadius: 16, padding: 20, maxWidth: 400, margin: "0 auto 20px", textAlign: "left" }}>
        {["💬 'What's my best selling product?'", "📈 'How much profit this month?'", "⚠️ 'Which products are running low?'", "👥 'Who is my best customer?'", "📅 'What day do I sell the most?'"].map(q => (
          <div key={q} style={{ fontSize: 14, color: C.accent, padding: "5px 0", fontWeight: 500 }}>{q}</div>
        ))}
      </div>
      <div style={{ background: C.goldLight, border: `1px solid ${C.gold}30`, borderRadius: 12, padding: 14, maxWidth: 400, margin: "0 auto 24px", fontSize: 14, color: C.gold, fontWeight: 600 }}>
        🔒 AI Advisor is a Business plan feature — KSh 1,500/month
      </div>
      <Btn size="lg" onClick={onUpgrade} style={{ background: C.gold, color: "#fff" }}>
        ⚡ Upgrade to unlock AI →
      </Btn>
    </div>
  );

  const PROMPTS = ["What's my best selling product?", "How much profit this month?", "Which customer buys most?", "What's running low?", "What day do I sell most?"];

  function buildSystem() {
    const monthRevenue = sales.filter(s => s.date?.startsWith(thisMonth())).reduce((s, x) => s + x.total, 0);
    const monthExpenses = expenses.filter(e => e.date?.startsWith(thisMonth())).reduce((s, e) => s + Number(e.amount), 0);
    const topProducts = products.map(p => ({ name: p.name, sold: sales.flatMap(s => s.items || []).filter(i => i.productId === p.id).reduce((s, i) => s + i.qty, 0) })).sort((a, b) => b.sold - a.sold).slice(0, 5);
    const topCustomers = customers.map(c => ({ name: c.name, spent: sales.filter(s => s.customerId === c.id).reduce((s, x) => s + x.total, 0) })).sort((a, b) => b.spent - a.spent).slice(0, 5);
    return `You are the AI business advisor for ${user.business}, owned by ${user.name}. Be direct, helpful, insightful. Speak like a smart advisor.

BUSINESS: Currency: ${curr} | Products: ${products.length} | Customers: ${customers.length}
FINANCES: Revenue this month: ${curr} ${monthRevenue.toLocaleString()} | Expenses: ${curr} ${monthExpenses.toLocaleString()} | Profit: ${curr} ${(monthRevenue - monthExpenses).toLocaleString()}
LOW STOCK: ${products.filter(p => p.qty <= (p.lowStockAlert || 5)).map(p => p.name).join(", ") || "None"}
TOP PRODUCTS: ${topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.sold} sold)`).join(", ") || "No sales yet"}
TOP CUSTOMERS: ${topCustomers.map((c, i) => `${i + 1}. ${c.name} (${curr} ${c.spent.toLocaleString()})`).join(", ") || "None yet"}

Answer specifically and concisely. Be actionable.`;
  }

  async function send(msg) {
    const text = msg || input.trim();
    if (!text) return;
    setMsgs(m => [...m, { role: "user", text }]);
    setInput(""); setLoading(true);
    const reply = await askAI(buildSystem(), text);
    setMsgs(m => [...m, { role: "ai", text: reply }]);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: C.display, fontWeight: 900, fontSize: 24, margin: "0 0 4px" }}>AI Advisor 🧠</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Knows your entire business. Ask anything.</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "ai" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10, flexShrink: 0 }}>🧠</div>}
            <div style={{ maxWidth: "72%", padding: "13px 18px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? "#fff" : C.text, border: m.role === "ai" ? `1px solid ${C.border}` : "none", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>🧠</div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "16px 16px 16px 4px", padding: "13px 18px", color: C.muted, fontSize: 13 }}>Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {PROMPTS.map(p => (
          <button key={p} onClick={() => send(p)} style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 100, padding: "6px 14px", fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: C.font }}>
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
  const [email, setEmail] = useState(user.email || "");
  return (
    <Modal title="" onClose={onClose} width={460}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontFamily: C.display, fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Upgrade to Business</div>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>Unlock unlimited everything.</p>
      </div>
      <div style={{ background: C.accentLight, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        {["✓ Unlimited products", "✓ Unlimited customers", "✓ Full sales history", "✓ AI business insights", "✓ Expense tracking"].map(f => (
          <div key={f} style={{ fontSize: 14, fontWeight: 600, color: C.accent, padding: "5px 0" }}>{f}</div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: C.display, fontWeight: 900, fontSize: 36 }}>KSh 1,500</span>
        <span style={{ color: C.muted }}>/month</span>
      </div>
      <Input label="Email" value={email} onChange={setEmail} type="email" />
      <Btn full size="lg" onClick={() => openPaystack(email, 1500, async (ref) => {
        await onUpgrade();
        alert("🎉 Welcome to Business! Ref: " + ref);
      })}>
        Pay KSh 1,500/month →
      </Btn>
      <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 12 }}>Cancel anytime.</p>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════
// FEEDBACK FORM
// ══════════════════════════════════════════════════════
function FeedbackForm({ user }) {
  const [msg, setMsg] = useState("");
  const [type, setType] = useState("bug");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!msg.trim()) return alert("Write your feedback first.");
    setLoading(true);
    try {
      await setDoc(doc(db, "feedback", uid()), {
        userId: user.id, userName: user.name, userEmail: user.email,
        business: user.business, type, message: msg, createdAt: now(),
      });
      setSent(true);
    } catch (e) { alert("Failed to send. Try again."); }
    setLoading(false);
  }

  if (sent) return (
    <Card style={{ textAlign: "center", padding: 48, maxWidth: 500, margin: "0 auto" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Feedback received!</div>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Thank you. We'll use this to improve BizOS.</p>
      <Btn onClick={() => { setMsg(""); setSent(false); }}>Send More Feedback</Btn>
    </Card>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
        <div style={{ fontFamily: C.display, fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Send Feedback</div>
        <p style={{ color: C.muted, fontSize: 14 }}>Tell us what's broken, what you love, or what you want added.</p>
      </div>
      <Card>
        <Select label="Type of feedback" value={type} onChange={setType} options={[
          { value: "bug", label: "🐛 Something is broken" },
          { value: "feature", label: "✨ I want a new feature" },
          { value: "improvement", label: "🔧 Something could be better" },
          { value: "other", label: "💬 Other" },
        ]} />
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Your feedback</div>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Describe the bug, feature or improvement..." rows={5}
            style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: C.font, fontSize: 14, color: C.text, background: C.bg, outline: "none", resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e => e.target.style.borderColor = C.border} />
        </div>
        <Btn full onClick={send} disabled={loading}>
          {loading ? "Sending..." : "Send Feedback →"}
        </Btn>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SHOP MANAGER
// ══════════════════════════════════════════════════════
function ShopManager({ user, shops, setShops, onClose }) {
  const [form, setForm] = useState({ name: "", currency: "KSh" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));
  const canAdd = user.isPro || shops.length < 2;

  function addShop() {
    if (!form.name) return alert("Enter shop name.");
    const newShop = { id: uid(), name: form.name, currency: form.currency, createdAt: today() };
    setShops(prev => [...prev, newShop]);
    setForm({ name: "", currency: "KSh" });
  }

  function removeShop(id) {
    if (shops.length <= 1) return alert("You need at least one shop.");
    if (window.confirm("Remove this shop? All its data will be deleted.")) {
      setShops(prev => prev.filter(s => s.id !== id));
    }
  }

  return (
    <Modal title="Manage Shops" onClose={onClose} width={500}>
      <div style={{ marginBottom: 24 }}>
        {shops.map((s, i) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.faint}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{s.currency} · Added {fmtDate(s.createdAt)}</div>
            </div>
            {shops.length > 1 && <Btn size="sm" variant="danger" onClick={() => removeShop(s.id)}>Remove</Btn>}
          </div>
        ))}
      </div>
      {canAdd ? (
        <div style={{ background: C.faint, borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Add New Shop</div>
          <Input label="Shop Name" value={form.name} onChange={f("name")} placeholder="Shop 2 — Westlands" />
          <Select label="Currency" value={form.currency} onChange={f("currency")} options={[
            { value: "KSh", label: "KSh — Kenyan Shilling" },
            { value: "₦", label: "₦ — Nigerian Naira" },
            { value: "GH₵", label: "GH₵ — Ghanaian Cedi" },
            { value: "$", label: "$ — US Dollar" },
          ]} />
          <Btn onClick={addShop}>+ Add Shop</Btn>
        </div>
      ) : (
        <Card style={{ background: C.goldLight, border: `1px solid ${C.gold}30`, textAlign: "center" }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.gold }}>Upgrade for more shops</div>
          <p style={{ color: C.muted, fontSize: 13 }}>Business plan includes up to 5 shops.</p>
        </Card>
      )}
    </Modal>
  );
}
function AppShell({ user: initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [nav, setNav] = useState("dashboard");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showShopManager, setShowShopManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [shops, setShopsState] = useState([]);
  const [activeShopId, setActiveShopId] = useState(null);
  const [products, setProductsState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [customers, setCustomersState] = useState([]);
  const [expenses, setExpensesState] = useState([]);
  const userId = user.id;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [shopList, profile] = await Promise.all([
        getShops(userId),
        getUserProfile(userId),
      ]);
      let finalShops = shopList;
      if (!shopList || shopList.length === 0) {
        const defaultShop = { id: uid(), name: profile.business || "My Shop", currency: profile.currency || "KSh", createdAt: today() };
        finalShops = [defaultShop];
        await saveShops(userId, finalShops);
      }
      setShopsState(finalShops);
      const shopId = finalShops[0].id;
      setActiveShopId(shopId);

      // ── MIGRATION: move old data to new shop-based keys ──
      const [oldProducts, newProducts] = await Promise.all([
        getUserData(userId, "products", null),
        getUserData(userId, `products_${shopId}`, null),
      ]);
      if (oldProducts && oldProducts.length > 0 && (!newProducts || newProducts.length === 0)) {
        // Migrate old data to new shop key
        await Promise.all([
          saveUserData(userId, `products_${shopId}`, oldProducts),
          saveUserData(userId, `sales_${shopId}`, await getUserData(userId, "sales", [])),
          saveUserData(userId, `customers_${shopId}`, await getUserData(userId, "customers", [])),
          saveUserData(userId, `expenses_${shopId}`, await getUserData(userId, "expenses", [])),
        ]);
      }

      const [p, s, c, e] = await Promise.all([
        getUserData(userId, `products_${shopId}`, []),
        getUserData(userId, `sales_${shopId}`, []),
        getUserData(userId, `customers_${shopId}`, []),
        getUserData(userId, `expenses_${shopId}`, []),
      ]);
      setProductsState(p); setSalesState(s); setCustomersState(c); setExpensesState(e);
      if (profile.isPro !== undefined) setUser(u => ({ ...u, isPro: profile.isPro }));
      setLoading(false);
    }
    loadData();
  }, [userId]);

  async function switchShop(shopId) {
    if (shopId === activeShopId) return;
    setLoading(true);
    setActiveShopId(shopId);
    const [p, s, c, e] = await Promise.all([
      getUserData(userId, `products_${shopId}`, []),
      getUserData(userId, `sales_${shopId}`, []),
      getUserData(userId, `customers_${shopId}`, []),
      getUserData(userId, `expenses_${shopId}`, []),
    ]);
    setProductsState(p); setSalesState(s); setCustomersState(c); setExpensesState(e);
    setLoading(false);
  }

  const setShops = (updater) => {
    setShopsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveShops(userId, next);
      return next;
    });
  };

  const setProducts = (updater) => setProductsState(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveUserData(userId, `products_${activeShopId}`, next); return next; });
  const setSales = (updater) => setSalesState(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveUserData(userId, `sales_${activeShopId}`, next); return next; });
  const setCustomers = (updater) => setCustomersState(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveUserData(userId, `customers_${activeShopId}`, next); return next; });
  const setExpenses = (updater) => setExpensesState(prev => { const next = typeof updater === "function" ? updater(prev) : updater; saveUserData(userId, `expenses_${activeShopId}`, next); return next; });

  async function upgrade() {
    await setUserPro(userId, true);
    await markReferralPaid(userId);
    setUser(u => ({ ...u, isPro: true }));
    setShowUpgrade(false);
  }

  if (loading) return <Loader text="Loading your business data..." />;

  const activeShop = shops.find(s => s.id === activeShopId) || shops[0];
  const activeUser = { ...user, business: activeShop?.name || user.business, currency: activeShop?.currency || user.currency };

  const MOBILE_NAV = [
    { id: "dashboard", label: "Home", icon: "◈" },
    { id: "inventory", label: "Stock", icon: "📦" },
    { id: "sales", label: "Sales", icon: "💰" },
    { id: "customers", label: "Customers", icon: "👥" },
    { id: "more", label: "More", icon: "☰" },
  ];

  const DESKTOP_NAV = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "inventory", label: "Inventory", icon: "📦" },
    { id: "sales", label: "Sales", icon: "💰" },
    { id: "customers", label: "Customers", icon: "👥" },
    { id: "expenses", label: "Expenses", icon: "💸" },
    { id: "ai", label: "AI Advisor", icon: "🧠" },
    { id: "feedback", label: "Feedback", icon: "💬" },
  ];

  const PageContent = () => (
    <>
      {nav === "dashboard" && <Dashboard user={activeUser} products={products} sales={sales} customers={customers} expenses={expenses} onNav={setNav} />}
      {nav === "inventory" && <Inventory products={products} setProducts={setProducts} user={activeUser} isPro={user.isPro} />}
      {nav === "sales" && <Sales sales={sales} setSales={setSales} products={products} setProducts={setProducts} customers={customers} user={activeUser} />}
      {nav === "customers" && <Customers customers={customers} setCustomers={setCustomers} sales={sales} user={activeUser} isPro={user.isPro} />}
      {nav === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} user={activeUser} />}
      {nav === "ai" && <AIBrain user={activeUser} products={products} sales={sales} customers={customers} expenses={expenses} onUpgrade={() => setShowUpgrade(true)} />}
      {nav === "feedback" && <FeedbackForm user={user} />}
    </>
  );

  // Shop switcher component
  const ShopSwitcher = () => shops.length > 1 ? (
    <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Active Shop</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {shops.map(s => (
          <button key={s.id} onClick={() => switchShop(s.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: C.font, fontWeight: 600, fontSize: 12, background: s.id === activeShopId ? C.accentLight : C.faint, color: s.id === activeShopId ? C.accent : C.muted }}>
            <span>🏪 {s.name}</span>
            {s.id === activeShopId && <span style={{ fontSize: 10 }}>✓</span>}
          </button>
        ))}
      </div>
      <button onClick={() => setShowShopManager(true)} style={{ width: "100%", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "6px", color: C.muted, fontFamily: C.font, fontSize: 11, cursor: "pointer", marginTop: 6 }}>
        + Manage Shops
      </button>
    </div>
  ) : (
    <div style={{ padding: "4px 10px 8px" }}>
      <button onClick={() => setShowShopManager(true)} style={{ width: "100%", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "7px", color: C.muted, fontFamily: C.font, fontSize: 11, cursor: "pointer" }}>
        + Add Another Shop
      </button>
    </div>
  );

  // ── MOBILE LAYOUT ──────────────────────────────────
  if (isMobile) return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, paddingBottom: 70 }}>
      <Fonts />
      {showUpgrade && <UpgradeModal user={user} onUpgrade={upgrade} onClose={() => setShowUpgrade(false)} />}
      {showShopManager && <ShopManager user={user} shops={shops} setShops={setShops} onClose={() => setShowShopManager(false)} />}

      {/* Mobile top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🌍</div>
          <div style={{ fontFamily: C.display, fontSize: 16, fontWeight: 900, color: C.accent }}>BizOS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {shops.length > 1 && (
            <select value={activeShopId} onChange={e => switchShop(e.target.value)}
              style={{ fontSize: 12, fontFamily: C.font, fontWeight: 700, color: C.accent, background: C.accentLight, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "4px 8px", outline: "none" }}>
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {user.isPro && <Badge color={C.accent}>✦ PRO</Badge>}
        </div>
      </div>

      {/* Mobile slide-down menu for "More" */}
      {showMobileMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }} onClick={() => setShowMobileMenu(false)}>
          <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, background: C.surface, borderRadius: "20px 20px 0 0", padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 16, marginBottom: 16, color: C.muted }}>More options</div>
            {[{ id: "expenses", label: "Expenses", icon: "💸" }, { id: "ai", label: "AI Advisor", icon: "🧠" }, { id: "feedback", label: "Feedback", icon: "💬" }].map(n => (
              <button key={n.id} onClick={() => { setNav(n.id); setShowMobileMenu(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: C.font, fontWeight: 600, fontSize: 15, marginBottom: 4, background: nav === n.id ? C.accentLight : C.faint, color: nav === n.id ? C.accent : C.text }}>
                <span style={{ fontSize: 20 }}>{n.icon}</span> {n.label}
              </button>
            ))}
            <button onClick={() => { setShowShopManager(true); setShowMobileMenu(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: C.font, fontWeight: 600, fontSize: 15, marginBottom: 4, background: C.faint, color: C.text }}>
              <span style={{ fontSize: 20 }}>🏪</span> Manage Shops
            </button>
            {!user.isPro && (
              <button onClick={() => { setShowUpgrade(true); setShowMobileMenu(false); }}
                style={{ width: "100%", background: C.gold, border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontFamily: C.font, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 }}>
                ⚡ Upgrade — KSh 1,500/mo
              </button>
            )}
            <button onClick={async () => { await signOut(auth); onLogout(); }}
              style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px", color: C.muted, fontFamily: C.font, fontSize: 14, cursor: "pointer", marginTop: 8 }}>
              Logout
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "16px" }}>
        <PageContent />
      </div>

      {/* Bottom navigation bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 }}>
        {MOBILE_NAV.map(n => {
          const isActive = n.id === "more" ? ["expenses", "ai", "feedback"].includes(nav) : nav === n.id;
          return (
            <button key={n.id} onClick={() => n.id === "more" ? setShowMobileMenu(true) : setNav(n.id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer", gap: 3 }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 10, fontFamily: C.font, fontWeight: isActive ? 700 : 500, color: isActive ? C.accent : C.muted }}>{n.label}</span>
              {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.accent }} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── DESKTOP LAYOUT ─────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", fontFamily: C.font }}>
      <Fonts />
      {showUpgrade && <UpgradeModal user={user} onUpgrade={upgrade} onClose={() => setShowUpgrade(false)} />}
      {showShopManager && <ShopManager user={user} shops={shops} setShops={setShops} onClose={() => setShowShopManager(false)} />}
      <div style={{ width: 230, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", height: "100vh", zIndex: 50 }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌍</div>
            <div style={{ fontFamily: C.display, fontSize: 18, fontWeight: 900, color: C.accent }}>BizOS</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{activeShop?.name || user.business}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{user.name}</div>
          {user.isPro && <Badge color={C.accent} style={{ marginTop: 8, display: "inline-flex" }}>✦ BUSINESS</Badge>}
        </div>
        <ShopSwitcher />
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {DESKTOP_NAV.map(n => (
            <button key={n.id} onClick={() => setNav(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: C.font, fontWeight: 600, fontSize: 14, marginBottom: 2, background: nav === n.id ? C.accentLight : "transparent", color: nav === n.id ? C.accent : C.muted }}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 10px", borderTop: `1px solid ${C.border}` }}>
          {!user.isPro && (
            <button onClick={() => setShowUpgrade(true)} style={{ width: "100%", background: C.gold, border: "none", borderRadius: 10, padding: "11px 12px", color: "#fff", fontFamily: C.font, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
              ⚡ Upgrade — KSh 1,500/mo
            </button>
          )}
          <button onClick={async () => { await signOut(auth); onLogout(); }} style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", color: C.muted, fontFamily: C.font, fontSize: 13, cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>
      <main style={{ flex: 1, marginLeft: 230, padding: "36px 32px", maxWidth: "calc(100% - 230px)", boxSizing: "border-box" }}>
        <PageContent />
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════
export default function BizOS() {
  const [screen, setScreen] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Save ref code from URL to localStorage
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem("bizos_ref", ref);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid);
        setUser({ ...profile, id: firebaseUser.uid });
        setScreen("app");
      } else {
        setScreen("landing");
      }
    });
    return unsub;
  }, []);

  if (screen === "loading") return <Loader text="Starting BizOS..." />;
  if (screen === "affiliate") return <AffiliateSignup onBack={() => setScreen("landing")} />;
  if (screen === "landing") return <Landing onStart={() => setScreen("auth")} onAffiliate={() => setScreen("affiliate")} />;
  if (screen === "auth") return <Auth onAuth={(u) => { setUser(u); setScreen("app"); }} />;
  if (screen === "app" && user) return <AppShell user={user} onLogout={() => { setUser(null); setScreen("landing"); }} />;
  return null;
}