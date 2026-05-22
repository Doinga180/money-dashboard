import { useState, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const INCOME_CATS = [
  { id: "w2",         label: "W-2 Work",    icon: "💼", color: "#00C9A7" },
  { id: "sidehustle", label: "Side Hustle", icon: "⚡", color: "#845EF7" },
  { id: "ebay",       label: "eBay Sales",  icon: "📦", color: "#339AF0" },
  { id: "poker",      label: "Poker",       icon: "♠️", color: "#FF6B6B" },
];

const EXPENSE_CATS = [
  { id: "housing",       label: "Housing / Rent",  icon: "🏠", color: "#FF922B" },
  { id: "utilities",     label: "Utilities",       icon: "💡", color: "#FCC419" },
  { id: "food",          label: "Food / Groceries",icon: "🛒", color: "#20C997" },
  { id: "transport",     label: "Transportation",  icon: "🚗", color: "#74C0FC" },
  { id: "insurance",     label: "Insurance",       icon: "🛡️", color: "#DA77F2" },
  { id: "subscriptions", label: "Subscriptions",   icon: "📱", color: "#FF6B6B" },
  { id: "other",         label: "Other Bills",     icon: "📋", color: "#94A3B8" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmt = (n, sign = false) => {
  const s = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(Math.abs(n || 0));
  if (sign && n > 0) return "+" + s;
  if (sign && n < 0) return "−" + s;
  return s;
};

const fmtFull = (n) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2
}).format(n || 0);

const TABS = ["Dashboard", "Checking", "Credit Card", "Income", "Expenses", "Recurring", "401(k)"];

// ─── Seed / initial state ─────────────────────────────────────────────────────

const INIT = {
  incomeEntries: [],
  expenseEntries: [],
  k401Entries: [],           // { id, month, year, payPeriod, amount, note }
  recurringBills: [],        // { id, name, amount, category, dueDay, active, icon }
  recurringLog: {},          // { "billId-YYYY-MM": true } — which months are marked paid
  ccStatementDay: 15,        // day of month statement closes
  ccLimit: 5000,
  ccCashbackRate: 3,
  checkingBalance: 0,
  ccBalance: 0,
  payments: [],              // { id, date, amount, from, to, note }
};

function load() {
  try { return { ...INIT, ...JSON.parse(localStorage.getItem("fin_v2") || "{}") }; }
  catch { return INIT; }
}

// ─── Small shared components ──────────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#1A1F2E", border: "1px solid #2D3548",
      borderRadius: 12, padding: "18px 20px", ...style
    }}>
      {children}
    </div>
  );
}

function SectionHead({ label, color = "#00C9A7" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 3, height: 20, background: color, borderRadius: 2 }} />
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color, letterSpacing: 1 }}>{label}</h2>
    </div>
  );
}

function Pill({ active, color = "#00C9A7", onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color : "#1A1F2E",
      border: `1px solid ${active ? color : "#2D3548"}`,
      color: active ? "#0A0E1A" : "#94A3B8",
      borderRadius: 20, padding: "5px 13px", cursor: "pointer",
      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap"
    }}>{children}</button>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Modal({ title, icon, color, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, backdropFilter: "blur(4px)", padding: 16
    }}>
      <div style={{
        background: "#1A1F2E", border: "1px solid #2D3548", borderRadius: 16,
        padding: 28, width: "100%", maxWidth: 380,
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)"
      }}>
        <div style={{ fontSize: 24, marginBottom: 2 }}>{icon}</div>
        <h3 style={{ color: "#F1F5F9", margin: "0 0 20px", fontSize: 18 }}>{title}</h3>
        {children}
        <button onClick={onClose} style={{
          marginTop: 12, width: "100%", background: "transparent",
          border: "1px solid #2D3548", color: "#64748B",
          borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13
        }}>Cancel</button>
      </div>
    </div>
  );
}

function inputStyle(extra = {}) {
  return {
    width: "100%", background: "#0F1320", border: "1px solid #2D3548",
    color: "#F1F5F9", borderRadius: 8, padding: "9px 12px",
    fontSize: 14, outline: "none", boxSizing: "border-box", ...extra
  };
}

function Label({ children }) {
  return <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700,
    letterSpacing: 1, marginBottom: 5, marginTop: 14 }}>{children}</div>;
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function Dashboard({ state }) {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();

  const thisIncome = state.incomeEntries
    .filter(e => e.month === m && e.year === y)
    .reduce((s, e) => s + e.amount, 0);
  const thisExpenses = state.expenseEntries
    .filter(e => e.month === m && e.year === y)
    .reduce((s, e) => s + e.amount, 0);
  const this401k = state.k401Entries
    .filter(e => e.month === m && e.year === y)
    .reduce((s, e) => s + e.amount, 0);

  const net = thisIncome - thisExpenses - this401k;

  const totalCashback = state.expenseEntries
    .reduce((s, e) => s + e.amount, 0) * (state.ccCashbackRate / 100);

  // Statement closing info
  const closeDay = state.ccStatementDay;
  const today = now.getDate();
  const daysUntilClose = closeDay >= today
    ? closeDay - today
    : (new Date(y, m + 1, closeDay) - now) / 86400000;

  // Utilization
  const util = state.ccLimit > 0
    ? Math.round((state.ccBalance / state.ccLimit) * 100)
    : 0;
  const utilColor = util <= 10 ? "#00C9A7" : util <= 29 ? "#FCC419" : "#FF6B6B";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Month summary */}
      <SectionHead label={`${MONTHS[m]} ${y} SNAPSHOT`} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Income In",     value: thisIncome,   color: "#00C9A7", icon: "↑" },
          { label: "Bills Out",     value: thisExpenses, color: "#FF6B6B", icon: "↓" },
          { label: "401(k) Out",   value: this401k,     color: "#845EF7", icon: "🏦" },
          { label: "Net Cash",      value: net,          color: net >= 0 ? "#00C9A7" : "#FF6B6B", icon: net >= 0 ? "✓" : "!" },
        ].map(c => (
          <Card key={c.label} style={{ textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{c.icon}</div>
            <div style={{ color: c.color, fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
              {fmt(c.value)}
            </div>
            <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginTop: 3 }}>
              {c.label.toUpperCase()}
            </div>
          </Card>
        ))}
      </div>

      {/* Accounts */}
      <SectionHead label="ACCOUNTS" color="#339AF0" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card style={{ borderColor: "#339AF033" }}>
          <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>CHECKING</div>
          <div style={{ color: "#339AF0", fontSize: 22, fontWeight: 800, fontFamily: "monospace", marginTop: 4 }}>
            {fmtFull(state.checkingBalance)}
          </div>
          <div style={{ color: "#64748B", fontSize: 11, marginTop: 6 }}>Primary account</div>
        </Card>
        <Card style={{ borderColor: "#845EF733" }}>
          <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>PAYPAL CC</div>
          <div style={{ color: "#845EF7", fontSize: 22, fontWeight: 800, fontFamily: "monospace", marginTop: 4 }}>
            {fmtFull(state.ccBalance)}
          </div>
          <div style={{ color: utilColor, fontSize: 11, marginTop: 6 }}>
            {util}% utilized · {fmt(state.ccLimit)} limit
          </div>
        </Card>
      </div>

      {/* Credit card alerts */}
      <Card style={{ borderColor: daysUntilClose <= 5 ? "#FF6B6B55" : "#2D3548" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600 }}>
              📅 Statement closes on the {closeDay}{closeDay===1?"st":closeDay===2?"nd":closeDay===3?"rd":"th"}
            </div>
            <div style={{ color: daysUntilClose <= 5 ? "#FF6B6B" : "#64748B", fontSize: 12, marginTop: 3 }}>
              {Math.ceil(daysUntilClose)} days away — pay before this date for best credit score impact
            </div>
          </div>
          <div style={{
            background: daysUntilClose <= 5 ? "#FF6B6B22" : "#1A1F2E",
            border: `1px solid ${daysUntilClose <= 5 ? "#FF6B6B" : "#2D3548"}`,
            borderRadius: 8, padding: "6px 12px",
            color: daysUntilClose <= 5 ? "#FF6B6B" : "#64748B",
            fontSize: 18, fontWeight: 800
          }}>{Math.ceil(daysUntilClose)}d</div>
        </div>
        <div style={{ marginTop: 10, background: "#0F1320", borderRadius: 6, padding: "8px 12px" }}>
          <div style={{ color: "#64748B", fontSize: 11 }}>
            Utilization tip: Pay down to under{" "}
            <span style={{ color: "#00C9A7", fontWeight: 700 }}>{fmt(state.ccLimit * 0.1)}</span>
            {" "}before closing date to stay under 10%
          </div>
        </div>
      </Card>

      {/* Cashback earned */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>TOTAL CASHBACK EARNED</div>
            <div style={{ color: "#FCC419", fontSize: 24, fontWeight: 800, fontFamily: "monospace", marginTop: 2 }}>
              {fmtFull(totalCashback)}
            </div>
          </div>
          <div style={{ fontSize: 28 }}>💰</div>
        </div>
        <div style={{ color: "#64748B", fontSize: 11, marginTop: 6 }}>
          at {state.ccCashbackRate}% on all tracked expenses
        </div>
      </Card>

      {/* Flow diagram */}
      <SectionHead label="MONEY FLOW" color="#FCC419" />
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          {[
            { label: "Income", sub: "W-2 / eBay / Poker", color: "#00C9A7", icon: "💵" },
            { label: "→", color: "#2D3548" },
            { label: "Checking", sub: "Primary account", color: "#339AF0", icon: "🏦" },
            { label: "→", color: "#2D3548" },
            { label: "PayPal CC", sub: "Charges here", color: "#845EF7", icon: "💳" },
            { label: "→", color: "#2D3548" },
            { label: "Auto-Pay", sub: "Back to checking", color: "#FCC419", icon: "♻️" },
          ].map((step, i) =>
            step.label === "→" ? (
              <div key={i} style={{ color: "#2D3548", fontSize: 18, flexShrink: 0 }}>→</div>
            ) : (
              <div key={i} style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18 }}>{step.icon}</div>
                <div style={{ color: step.color, fontSize: 11, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.label}</div>
                <div style={{ color: "#475569", fontSize: 9, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.sub}</div>
              </div>
            )
          )}
        </div>
        <div style={{ marginTop: 12, background: "#0F1320", borderRadius: 6, padding: "8px 12px" }}>
          <div style={{ color: "#64748B", fontSize: 11 }}>
            💡 401(k) deducted pre-paycheck · {state.ccCashbackRate}% cashback on CC spend · Autopay keeps score clean
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Checking Tab ─────────────────────────────────────────────────────────────

function CheckingTab({ state, setState }) {
  const [showEdit, setShowEdit] = useState(false);
  const [bal, setBal] = useState(state.checkingBalance);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmt, setPayAmt] = useState("");
  const [payNote, setPayNote] = useState("");

  const recentPayments = (state.payments || [])
    .filter(p => p.from === "checking")
    .slice(-10).reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="CHECKING ACCOUNT" color="#339AF0" />

      <Card style={{ borderColor: "#339AF033" }}>
        <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>CURRENT BALANCE</div>
        <div style={{ color: "#339AF0", fontSize: 36, fontWeight: 800, fontFamily: "monospace", margin: "6px 0" }}>
          {fmtFull(state.checkingBalance)}
        </div>
        <button onClick={() => { setBal(state.checkingBalance); setShowEdit(true); }} style={{
          background: "#339AF022", border: "1px solid #339AF044", color: "#339AF0",
          borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600
        }}>Update Balance</button>
      </Card>

      <button onClick={() => setShowPayment(true)} style={{
        background: "#845EF722", border: "1px solid #845EF744", color: "#845EF7",
        borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 14, fontWeight: 700
      }}>💳 Record CC Payment (Checking → PayPal CC)</button>

      {recentPayments.length > 0 && (
        <Card>
          <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>RECENT PAYMENTS</div>
          {recentPayments.map(p => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between",
              padding: "7px 0", borderBottom: "1px solid #2D3548"
            }}>
              <div>
                <div style={{ color: "#CBD5E1", fontSize: 13 }}>{p.note || "CC Payment"}</div>
                <div style={{ color: "#64748B", fontSize: 11 }}>{p.date}</div>
              </div>
              <div style={{ color: "#FF6B6B", fontWeight: 700, fontFamily: "monospace" }}>−{fmt(p.amount)}</div>
            </div>
          ))}
        </Card>
      )}

      {showEdit && (
        <Modal title="Update Checking Balance" icon="🏦" color="#339AF0" onClose={() => setShowEdit(false)}>
          <Label>BALANCE ($)</Label>
          <input autoFocus type="number" value={bal} onChange={e => setBal(e.target.value)}
            style={inputStyle({ fontSize: 22, fontWeight: 700 })} />
          <button onClick={() => {
            setState(s => ({ ...s, checkingBalance: +bal }));
            setShowEdit(false);
          }} style={{
            marginTop: 16, width: "100%", background: "#339AF0", border: "none",
            color: "#0A0E1A", borderRadius: 8, padding: 12, cursor: "pointer",
            fontSize: 14, fontWeight: 700
          }}>Save</button>
        </Modal>
      )}

      {showPayment && (
        <Modal title="Pay Credit Card" icon="💳" color="#845EF7" onClose={() => setShowPayment(false)}>
          <Label>PAYMENT AMOUNT ($)</Label>
          <input autoFocus type="number" placeholder="0" value={payAmt}
            onChange={e => setPayAmt(e.target.value)} style={inputStyle({ fontSize: 20, fontWeight: 700 })} />
          <Label>NOTE (optional)</Label>
          <input type="text" placeholder="e.g. Early payoff, autopay..." value={payNote}
            onChange={e => setPayNote(e.target.value)} style={inputStyle()} />
          <button onClick={() => {
            if (!payAmt || isNaN(+payAmt)) return;
            const amt = +payAmt;
            const date = new Date().toLocaleDateString();
            setState(s => ({
              ...s,
              checkingBalance: s.checkingBalance - amt,
              ccBalance: Math.max(0, s.ccBalance - amt),
              payments: [...(s.payments || []), {
                id: Date.now(), amount: amt, from: "checking",
                to: "paypal_cc", note: payNote || "CC Payment", date
              }]
            }));
            setShowPayment(false);
            setPayAmt(""); setPayNote("");
          }} style={{
            marginTop: 16, width: "100%", background: "#845EF7", border: "none",
            color: "#fff", borderRadius: 8, padding: 12, cursor: "pointer",
            fontSize: 14, fontWeight: 700
          }}>Record Payment</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Credit Card Tab ──────────────────────────────────────────────────────────

function CreditCardTab({ state, setState }) {
  const [showSettings, setShowSettings] = useState(false);
  const [closeDay, setCloseDay] = useState(state.ccStatementDay);
  const [limit, setLimit] = useState(state.ccLimit);
  const [rate, setRate] = useState(state.ccCashbackRate);
  const [showCharge, setShowCharge] = useState(false);
  const [chargeAmt, setChargeAmt] = useState("");
  const [chargeNote, setChargeNote] = useState("");

  const util = state.ccLimit > 0 ? (state.ccBalance / state.ccLimit) * 100 : 0;
  const utilColor = util <= 10 ? "#00C9A7" : util <= 29 ? "#FCC419" : "#FF6B6B";
  const totalCashback = state.expenseEntries.reduce((s, e) => s + e.amount, 0) * (state.ccCashbackRate / 100);
  const recentCharges = (state.payments || []).filter(p => p.to === "paypal_cc" && p.from !== "checking").slice(-8).reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="PAYPAL CREDIT CARD" color="#845EF7" />

      <Card style={{ borderColor: "#845EF733" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>CURRENT BALANCE</div>
            <div style={{ color: "#845EF7", fontSize: 32, fontWeight: 800, fontFamily: "monospace", margin: "4px 0" }}>
              {fmtFull(state.ccBalance)}
            </div>
            <div style={{ color: "#64748B", fontSize: 12 }}>of {fmt(state.ccLimit)} limit</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: utilColor, fontSize: 28, fontWeight: 800 }}>{Math.round(util)}%</div>
            <div style={{ color: "#64748B", fontSize: 11 }}>utilized</div>
          </div>
        </div>

        {/* Utilization bar */}
        <div style={{ marginTop: 12, background: "#0F1320", borderRadius: 99, height: 8, overflow: "hidden" }}>
          <div style={{
            width: `${Math.min(util, 100)}%`, height: "100%",
            background: utilColor, borderRadius: 99, transition: "width 0.5s"
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ color: "#00C9A7", fontSize: 10 }}>0% ideal</span>
          <span style={{ color: "#FCC419", fontSize: 10 }}>10% good</span>
          <span style={{ color: "#FF6B6B", fontSize: 10 }}>30% high</span>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card style={{ textAlign: "center" }}>
          <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>CASHBACK RATE</div>
          <div style={{ color: "#FCC419", fontSize: 26, fontWeight: 800, marginTop: 4 }}>{state.ccCashbackRate}%</div>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>TOTAL EARNED</div>
          <div style={{ color: "#FCC419", fontSize: 22, fontWeight: 800, fontFamily: "monospace", marginTop: 4 }}>
            {fmtFull(totalCashback)}
          </div>
        </Card>
      </div>

      <Card style={{ borderColor: "#2D3548" }}>
        <div style={{ color: "#F1F5F9", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          📅 Statement Closes: Day {state.ccStatementDay} of each month
        </div>
        <div style={{ color: "#64748B", fontSize: 12 }}>
          Pay before this date — not the due date — to minimize reported utilization and maximize your credit score.
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setShowCharge(true)} style={{
          flex: 2, background: "#845EF722", border: "1px solid #845EF744", color: "#845EF7",
          borderRadius: 10, padding: 12, cursor: "pointer", fontSize: 13, fontWeight: 700
        }}>+ Log a Charge</button>
        <button onClick={() => { setCloseDay(state.ccStatementDay); setLimit(state.ccLimit); setRate(state.ccCashbackRate); setShowSettings(true); }} style={{
          flex: 1, background: "transparent", border: "1px solid #2D3548", color: "#64748B",
          borderRadius: 10, padding: 12, cursor: "pointer", fontSize: 13
        }}>⚙️ Settings</button>
      </div>

      {recentCharges.length > 0 && (
        <Card>
          <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>RECENT CHARGES</div>
          {recentCharges.map(p => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between",
              padding: "7px 0", borderBottom: "1px solid #2D3548"
            }}>
              <div>
                <div style={{ color: "#CBD5E1", fontSize: 13 }}>{p.note}</div>
                <div style={{ color: "#64748B", fontSize: 11 }}>{p.date}</div>
              </div>
              <div style={{ color: "#845EF7", fontWeight: 700, fontFamily: "monospace" }}>{fmt(p.amount)}</div>
            </div>
          ))}
        </Card>
      )}

      {showCharge && (
        <Modal title="Log CC Charge" icon="💳" color="#845EF7" onClose={() => setShowCharge(false)}>
          <Label>AMOUNT ($)</Label>
          <input autoFocus type="number" placeholder="0" value={chargeAmt}
            onChange={e => setChargeAmt(e.target.value)} style={inputStyle({ fontSize: 20, fontWeight: 700 })} />
          <Label>DESCRIPTION</Label>
          <input type="text" placeholder="e.g. Xfinity, groceries..." value={chargeNote}
            onChange={e => setChargeNote(e.target.value)} style={inputStyle()} />
          <button onClick={() => {
            if (!chargeAmt || isNaN(+chargeAmt)) return;
            setState(s => ({
              ...s,
              ccBalance: s.ccBalance + +chargeAmt,
              payments: [...(s.payments || []), {
                id: Date.now(), amount: +chargeAmt, from: "expense",
                to: "paypal_cc", note: chargeNote || "CC Charge",
                date: new Date().toLocaleDateString()
              }]
            }));
            setShowCharge(false); setChargeAmt(""); setChargeNote("");
          }} style={{
            marginTop: 16, width: "100%", background: "#845EF7", border: "none",
            color: "#fff", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
          }}>Record Charge</button>
        </Modal>
      )}

      {showSettings && (
        <Modal title="Card Settings" icon="⚙️" color="#845EF7" onClose={() => setShowSettings(false)}>
          <Label>STATEMENT CLOSING DAY (1–28)</Label>
          <input type="number" min="1" max="28" value={closeDay}
            onChange={e => setCloseDay(+e.target.value)} style={inputStyle()} />
          <Label>CREDIT LIMIT ($)</Label>
          <input type="number" value={limit} onChange={e => setLimit(+e.target.value)} style={inputStyle()} />
          <Label>CASHBACK RATE (%)</Label>
          <input type="number" step="0.5" value={rate} onChange={e => setRate(+e.target.value)} style={inputStyle()} />
          <button onClick={() => {
            setState(s => ({ ...s, ccStatementDay: closeDay, ccLimit: limit, ccCashbackRate: rate }));
            setShowSettings(false);
          }} style={{
            marginTop: 16, width: "100%", background: "#845EF7", border: "none",
            color: "#fff", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
          }}>Save Settings</button>
        </Modal>
      )}
    </div>
  );
}

// ─── Income Tab ───────────────────────────────────────────────────────────────

function IncomeTab({ state, setState }) {
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());
  const [filterM, setFilterM] = useState("all");

  const filtered = filterM === "all" ? state.incomeEntries
    : state.incomeEntries.filter(e => e.month === +filterM && e.year === year);

  const save = () => {
    if (!amount || isNaN(+amount)) return;
    setState(s => ({
      ...s,
      incomeEntries: [...s.incomeEntries, {
        id: Date.now(), category: modal, type: "income",
        amount: +amount, note, month: +month, year
      }],
      checkingBalance: s.checkingBalance + +amount
    }));
    setModal(null); setAmount(""); setNote("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="INCOME" color="#00C9A7" />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill active={filterM === "all"} onClick={() => setFilterM("all")}>All</Pill>
        {MONTHS.map((m, i) => (
          <Pill key={i} active={filterM === i} onClick={() => setFilterM(i)}>{m}</Pill>
        ))}
      </div>

      {INCOME_CATS.map(cat => {
        const entries = filtered.filter(e => e.category === cat.id);
        const total = entries.reduce((s, e) => s + e.amount, 0);
        return (
          <Card key={cat.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <div>
                  <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                  <div style={{ color: cat.color, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{fmt(total)}</div>
                </div>
              </div>
              <button onClick={() => { setModal(cat.id); setMonth(new Date().getMonth()); }} style={{
                background: cat.color + "22", border: `1px solid ${cat.color}44`,
                color: cat.color, borderRadius: 8, padding: "6px 12px",
                cursor: "pointer", fontSize: 12, fontWeight: 700
              }}>+ Add</button>
            </div>
            {entries.length > 0 && (
              <div style={{ marginTop: 10, borderTop: "1px solid #2D3548", paddingTop: 10 }}>
                {entries.slice().reverse().map(e => (
                  <div key={e.id} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "5px 0", borderBottom: "1px solid #1A1F2E"
                  }}>
                    <span style={{ color: "#94A3B8", fontSize: 12 }}>
                      {MONTHS[e.month]} {e.year}{e.note ? ` · ${e.note}` : ""}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: cat.color, fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>{fmt(e.amount)}</span>
                      <button onClick={() => setState(s => ({
                        ...s,
                        incomeEntries: s.incomeEntries.filter(x => x.id !== e.id),
                        checkingBalance: s.checkingBalance - e.amount
                      }))} style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {modal && (() => {
        const cat = INCOME_CATS.find(c => c.id === modal);
        return (
          <Modal title={`Add ${cat.label} Income`} icon={cat.icon} color={cat.color} onClose={() => setModal(null)}>
            <Label>MONTH</Label>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={inputStyle()}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
            </select>
            <Label>AMOUNT ($)</Label>
            <input autoFocus type="number" placeholder="0" value={amount}
              onChange={e => setAmount(e.target.value)} style={inputStyle({ fontSize: 22, fontWeight: 700 })} />
            <Label>NOTE (optional)</Label>
            <input type="text" placeholder="e.g. Paycheck, sold item..." value={note}
              onChange={e => setNote(e.target.value)} style={inputStyle()} />
            <button onClick={save} style={{
              marginTop: 16, width: "100%", background: cat.color, border: "none",
              color: "#0A0E1A", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
            }}>Save · Add to Checking</button>
          </Modal>
        );
      })()}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ state, setState }) {
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().getMonth());
  const [year] = useState(new Date().getFullYear());
  const [filterM, setFilterM] = useState(new Date().getMonth());

  const filtered = state.expenseEntries.filter(
    e => e.month === filterM && e.year === year
  );
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const save = () => {
    if (!amount || isNaN(+amount)) return;
    setState(s => ({
      ...s,
      expenseEntries: [...s.expenseEntries, {
        id: Date.now(), category: modal, type: "expense",
        amount: +amount, note, month: +month, year
      }],
      ccBalance: s.ccBalance + +amount
    }));
    setModal(null); setAmount(""); setNote("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="EXPENSES" color="#FF6B6B" />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MONTHS.map((m, i) => (
          <Pill key={i} active={filterM === i} color="#FF6B6B" onClick={() => setFilterM(i)}>{m}</Pill>
        ))}
      </div>

      <Card style={{ borderColor: "#FF6B6B33", padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#64748B", fontSize: 13 }}>{MONTHS[filterM]} total bills</span>
          <span style={{ color: "#FF6B6B", fontWeight: 800, fontFamily: "monospace" }}>{fmt(total)}</span>
        </div>
      </Card>

      {EXPENSE_CATS.map(cat => {
        const entries = filtered.filter(e => e.category === cat.id);
        const catTotal = entries.reduce((s, e) => s + e.amount, 0);
        return (
          <Card key={cat.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <div>
                  <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                  <div style={{ color: catTotal > 0 ? cat.color : "#475569", fontSize: 16, fontWeight: 800, fontFamily: "monospace" }}>
                    {fmt(catTotal)}
                  </div>
                </div>
              </div>
              <button onClick={() => { setModal(cat.id); setMonth(filterM); }} style={{
                background: cat.color + "22", border: `1px solid ${cat.color}44`,
                color: cat.color, borderRadius: 8, padding: "6px 12px",
                cursor: "pointer", fontSize: 12, fontWeight: 700
              }}>+ Add</button>
            </div>
            {entries.map(e => (
              <div key={e.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 0", borderBottom: "1px solid #1A1F2E", marginTop: 4
              }}>
                <span style={{ color: "#64748B", fontSize: 12 }}>{e.note || "—"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: cat.color, fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{fmt(e.amount)}</span>
                  <button onClick={() => setState(s => ({
                    ...s,
                    expenseEntries: s.expenseEntries.filter(x => x.id !== e.id),
                    ccBalance: Math.max(0, s.ccBalance - e.amount)
                  }))} style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>×</button>
                </div>
              </div>
            ))}
          </Card>
        );
      })}

      {modal && (() => {
        const cat = EXPENSE_CATS.find(c => c.id === modal);
        return (
          <Modal title={`Add ${cat.label}`} icon={cat.icon} color={cat.color} onClose={() => setModal(null)}>
            <Label>MONTH</Label>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={inputStyle()}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
            </select>
            <Label>AMOUNT ($)</Label>
            <input autoFocus type="number" placeholder="0" value={amount}
              onChange={e => setAmount(e.target.value)} style={inputStyle({ fontSize: 22, fontWeight: 700 })} />
            <Label>NOTE (optional)</Label>
            <input type="text" placeholder="e.g. Xfinity, electric..." value={note}
              onChange={e => setNote(e.target.value)} style={inputStyle()} />
            <button onClick={save} style={{
              marginTop: 16, width: "100%", background: cat.color, border: "none",
              color: "#fff", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
            }}>Save · Adds to CC Balance</button>
          </Modal>
        );
      })()}
    </div>
  );
}

// ─── Recurring Bills Tab ──────────────────────────────────────────────────────

const BILL_ICONS = ["📺","📡","🌐","💧","⚡","🔥","🏠","📱","🎵","🎮","🚗","🛡️","💊","🐾","📰","☁️","🏋️","💳"];

function RecurringTab({ state, setState }) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const today = now.getDate();
  const [showAdd, setShowAdd] = useState(false);
  const [editBill, setEditBill] = useState(null);

  // form state
  const [fName, setFName] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fCat, setFCat] = useState("subscriptions");
  const [fDue, setFDue] = useState(1);
  const [fIcon, setFIcon] = useState("📺");

  const bills = state.recurringBills || [];
  const log = state.recurringLog || {};
  const logKey = (id) => `${id}-${thisYear}-${thisMonth}`;
  const isPaid = (id) => !!log[logKey(id)];

  const activeBills = bills.filter(b => b.active !== false);
  const totalMonthly = activeBills.reduce((s, b) => s + b.amount, 0);
  const totalPaid = activeBills.filter(b => isPaid(b.id)).reduce((s, b) => s + b.amount, 0);
  const totalUnpaid = totalMonthly - totalPaid;

  const openAdd = () => {
    setFName(""); setFAmount(""); setFCat("subscriptions");
    setFDue(1); setFIcon("📺"); setEditBill(null); setShowAdd(true);
  };

  const openEdit = (b) => {
    setFName(b.name); setFAmount(String(b.amount)); setFCat(b.category);
    setFDue(b.dueDay); setFIcon(b.icon || "📺"); setEditBill(b.id); setShowAdd(true);
  };

  const saveBill = () => {
    if (!fName || !fAmount || isNaN(+fAmount)) return;
    setState(s => {
      const existing = s.recurringBills || [];
      if (editBill) {
        return { ...s, recurringBills: existing.map(b => b.id === editBill
          ? { ...b, name: fName, amount: +fAmount, category: fCat, dueDay: +fDue, icon: fIcon }
          : b) };
      }
      return { ...s, recurringBills: [...existing, {
        id: Date.now(), name: fName, amount: +fAmount,
        category: fCat, dueDay: +fDue, icon: fIcon, active: true
      }]};
    });
    setShowAdd(false);
  };

  const togglePaid = (bill) => {
    const key = logKey(bill.id);
    setState(s => {
      const log = { ...(s.recurringLog || {}) };
      if (log[key]) {
        // unmark paid — remove from CC balance
        delete log[key];
        return { ...s, recurringLog: log, ccBalance: Math.max(0, s.ccBalance - bill.amount) };
      } else {
        // mark paid — add to CC balance
        log[key] = true;
        return { ...s, recurringLog: log, ccBalance: s.ccBalance + bill.amount };
      }
    });
  };

  const deleteBill = (id) => {
    setState(s => ({ ...s, recurringBills: (s.recurringBills || []).filter(b => b.id !== id) }));
  };

  // sort: unpaid due-soon first, then paid
  const sorted = [...activeBills].sort((a, b) => {
    const aPaid = isPaid(a.id), bPaid = isPaid(b.id);
    if (aPaid !== bPaid) return aPaid ? 1 : -1;
    return a.dueDay - b.dueDay;
  });

  const daysUntilDue = (dueDay) => {
    if (dueDay >= today) return dueDay - today;
    const nextMonth = new Date(thisYear, thisMonth + 1, dueDay);
    return Math.ceil((nextMonth - now) / 86400000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="RECURRING BILLS" color="#FF922B" />

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Monthly Total", value: totalMonthly, color: "#FF922B" },
          { label: "Paid This Month", value: totalPaid, color: "#00C9A7" },
          { label: "Still Owed", value: totalUnpaid, color: totalUnpaid > 0 ? "#FF6B6B" : "#475569" },
        ].map(c => (
          <Card key={c.label} style={{ textAlign: "center", padding: "12px 8px" }}>
            <div style={{ color: c.color, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{fmt(c.value)}</div>
            <div style={{ color: "#64748B", fontSize: 9, fontWeight: 700, letterSpacing: 1, marginTop: 3 }}>{c.label.toUpperCase()}</div>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      {activeBills.length > 0 && (
        <Card style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#CBD5E1", fontSize: 12, fontWeight: 600 }}>
              {activeBills.filter(b => isPaid(b.id)).length} of {activeBills.length} bills paid for {MONTHS[thisMonth]}
            </span>
            <span style={{ color: "#00C9A7", fontSize: 12, fontWeight: 700 }}>
              {Math.round((totalPaid / (totalMonthly || 1)) * 100)}%
            </span>
          </div>
          <div style={{ background: "#0F1320", borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min((totalPaid / (totalMonthly || 1)) * 100, 100)}%`,
              height: "100%", background: "#00C9A7", borderRadius: 99, transition: "width 0.4s"
            }} />
          </div>
        </Card>
      )}

      <button onClick={openAdd} style={{
        background: "#FF922B22", border: "1px solid #FF922B44", color: "#FF922B",
        borderRadius: 10, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
      }}>+ Add Recurring Bill</button>

      {/* Bill list */}
      {sorted.length === 0 && (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔁</div>
          <div style={{ color: "#64748B", fontSize: 14 }}>No recurring bills yet.</div>
          <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Add bills once and they appear every month.</div>
        </Card>
      )}

      {sorted.map(bill => {
        const paid = isPaid(bill.id);
        const days = daysUntilDue(bill.dueDay);
        const urgent = !paid && days <= 3;
        const cat = EXPENSE_CATS.find(c => c.id === bill.category);
        return (
          <Card key={bill.id} style={{
            borderColor: paid ? "#00C9A722" : urgent ? "#FF6B6B44" : "#2D3548",
            opacity: paid ? 0.75 : 1
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{bill.icon || "📋"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    color: paid ? "#64748B" : "#F1F5F9", fontSize: 14, fontWeight: 600,
                    textDecoration: paid ? "line-through" : "none"
                  }}>{bill.name}</span>
                  {urgent && <span style={{
                    background: "#FF6B6B22", border: "1px solid #FF6B6B44",
                    color: "#FF6B6B", fontSize: 9, fontWeight: 700, borderRadius: 4,
                    padding: "1px 5px", letterSpacing: 0.5
                  }}>DUE SOON</span>}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 2, alignItems: "center" }}>
                  <span style={{ color: cat?.color || "#94A3B8", fontSize: 11 }}>{cat?.label || bill.category}</span>
                  <span style={{ color: "#475569", fontSize: 11 }}>·</span>
                  <span style={{ color: paid ? "#64748B" : "#94A3B8", fontSize: 11 }}>
                    Due {paid ? `the ${bill.dueDay}${bill.dueDay===1?"st":bill.dueDay===2?"nd":bill.dueDay===3?"rd":"th"}` : `in ${days}d (the ${bill.dueDay}${bill.dueDay===1?"st":bill.dueDay===2?"nd":bill.dueDay===3?"rd":"th"})`}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{
                  color: paid ? "#64748B" : "#FF922B", fontWeight: 800,
                  fontFamily: "monospace", fontSize: 16
                }}>{fmtFull(bill.amount)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(bill)} style={{
                    background: "transparent", border: "1px solid #2D3548", color: "#64748B",
                    borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11
                  }}>✏️</button>
                  <button onClick={() => deleteBill(bill.id)} style={{
                    background: "transparent", border: "1px solid #2D3548", color: "#EF4444",
                    borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11
                  }}>×</button>
                  <button onClick={() => togglePaid(bill)} style={{
                    background: paid ? "#00C9A722" : "#FF922B22",
                    border: `1px solid ${paid ? "#00C9A744" : "#FF922B44"}`,
                    color: paid ? "#00C9A7" : "#FF922B",
                    borderRadius: 6, padding: "3px 10px", cursor: "pointer",
                    fontSize: 11, fontWeight: 700
                  }}>{paid ? "✓ Paid" : "Mark Paid"}</button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Add/Edit Modal */}
      {showAdd && (
        <Modal
          title={editBill ? "Edit Bill" : "Add Recurring Bill"}
          icon={fIcon} color="#FF922B"
          onClose={() => setShowAdd(false)}
        >
          {/* Icon picker */}
          <Label>ICON</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            {BILL_ICONS.map(ic => (
              <button key={ic} onClick={() => setFIcon(ic)} style={{
                background: fIcon === ic ? "#FF922B33" : "#0F1320",
                border: `1px solid ${fIcon === ic ? "#FF922B" : "#2D3548"}`,
                borderRadius: 6, padding: "4px 7px", cursor: "pointer", fontSize: 16
              }}>{ic}</button>
            ))}
          </div>

          <Label>BILL NAME</Label>
          <input autoFocus type="text" placeholder="e.g. Netflix, Xfinity, Spotify..."
            value={fName} onChange={e => setFName(e.target.value)} style={inputStyle()} />

          <Label>MONTHLY AMOUNT ($)</Label>
          <input type="number" placeholder="0.00" value={fAmount}
            onChange={e => setFAmount(e.target.value)} style={inputStyle({ fontSize: 20, fontWeight: 700 })} />

          <Label>CATEGORY</Label>
          <select value={fCat} onChange={e => setFCat(e.target.value)} style={inputStyle()}>
            {EXPENSE_CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>

          <Label>DUE DAY OF MONTH</Label>
          <input type="number" min="1" max="28" value={fDue}
            onChange={e => setFDue(+e.target.value)} style={inputStyle()} />

          <button onClick={saveBill} style={{
            marginTop: 16, width: "100%", background: "#FF922B", border: "none",
            color: "#fff", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
          }}>{editBill ? "Save Changes" : "Add Bill"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── 401k Tab ─────────────────────────────────────────────────────────────────

function K401Tab({ state, setState }) {
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [period, setPeriod] = useState("1");
  const [month, setMonth] = useState(new Date().getMonth());
  const year = new Date().getFullYear();

  const entries = state.k401Entries.slice().reverse();
  const ytdTotal = state.k401Entries
    .filter(e => e.year === year)
    .reduce((s, e) => s + e.amount, 0);

  const IRS_LIMIT_2025 = 23500;

  const save = () => {
    if (!amount || isNaN(+amount)) return;
    setState(s => ({
      ...s,
      k401Entries: [...s.k401Entries, {
        id: Date.now(), month: +month, year,
        payPeriod: period, amount: +amount, note
      }]
    }));
    setShowAdd(false); setAmount(""); setNote(""); setPeriod("1");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHead label="401(k) CONTRIBUTIONS" color="#845EF7" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card style={{ textAlign: "center" }}>
          <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>YTD CONTRIBUTED</div>
          <div style={{ color: "#845EF7", fontSize: 22, fontWeight: 800, fontFamily: "monospace", marginTop: 4 }}>
            {fmtFull(ytdTotal)}
          </div>
        </Card>
        <Card style={{ textAlign: "center" }}>
          <div style={{ color: "#64748B", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>IRS LIMIT {year}</div>
          <div style={{ color: "#00C9A7", fontSize: 22, fontWeight: 800, fontFamily: "monospace", marginTop: 4 }}>
            {fmt(IRS_LIMIT_2025)}
          </div>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#CBD5E1", fontSize: 13, fontWeight: 600 }}>Annual Progress</span>
          <span style={{ color: "#845EF7", fontSize: 13, fontWeight: 700 }}>
            {Math.round((ytdTotal / IRS_LIMIT_2025) * 100)}%
          </span>
        </div>
        <div style={{ background: "#0F1320", borderRadius: 99, height: 10, overflow: "hidden" }}>
          <div style={{
            width: `${Math.min((ytdTotal / IRS_LIMIT_2025) * 100, 100)}%`,
            height: "100%", background: "#845EF7", borderRadius: 99, transition: "width 0.5s"
          }} />
        </div>
        <div style={{ color: "#64748B", fontSize: 11, marginTop: 6 }}>
          {fmtFull(IRS_LIMIT_2025 - ytdTotal)} remaining to max out
        </div>
      </Card>

      <Card style={{ background: "#0F1320", borderColor: "#845EF733" }}>
        <div style={{ color: "#845EF7", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>💡 Why does my amount vary?</div>
        <div style={{ color: "#64748B", fontSize: 12, lineHeight: 1.5 }}>
          Your 401(k) is set as a percentage of gross pay. Small fluctuations in hours, overtime, or bonuses shift the dollar amount each period — that's expected and correct. Log each paycheck amount as it appears on your stub.
        </div>
      </Card>

      <button onClick={() => { setMonth(new Date().getMonth()); setShowAdd(true); }} style={{
        background: "#845EF722", border: "1px solid #845EF744", color: "#845EF7",
        borderRadius: 10, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
      }}>+ Log Pay Period Contribution</button>

      {entries.length > 0 && (
        <Card>
          <div style={{ color: "#64748B", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>CONTRIBUTION LOG</div>
          {entries.map(e => (
            <div key={e.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 0", borderBottom: "1px solid #2D3548"
            }}>
              <div>
                <div style={{ color: "#CBD5E1", fontSize: 13 }}>
                  {MONTHS[e.month]} {e.year} · Pay Period {e.payPeriod}
                </div>
                {e.note && <div style={{ color: "#64748B", fontSize: 11 }}>{e.note}</div>}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "#845EF7", fontWeight: 700, fontFamily: "monospace" }}>{fmtFull(e.amount)}</span>
                <button onClick={() => setState(s => ({
                  ...s, k401Entries: s.k401Entries.filter(x => x.id !== e.id)
                }))} style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showAdd && (
        <Modal title="Log 401(k) Contribution" icon="🏦" color="#845EF7" onClose={() => setShowAdd(false)}>
          <Label>MONTH</Label>
          <select value={month} onChange={e => setMonth(+e.target.value)} style={inputStyle()}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
          </select>
          <Label>PAY PERIOD #</Label>
          <input type="number" min="1" max="26" value={period}
            onChange={e => setPeriod(e.target.value)} style={inputStyle()} />
          <Label>AMOUNT WITHHELD ($)</Label>
          <input autoFocus type="number" placeholder="~500" value={amount}
            onChange={e => setAmount(e.target.value)} style={inputStyle({ fontSize: 20, fontWeight: 700 })} />
          <Label>NOTE (optional)</Label>
          <input type="text" placeholder="e.g. 511.23 this period" value={note}
            onChange={e => setNote(e.target.value)} style={inputStyle()} />
          <button onClick={save} style={{
            marginTop: 16, width: "100%", background: "#845EF7", border: "none",
            color: "#fff", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 14, fontWeight: 700
          }}>Save Contribution</button>
        </Modal>
      )}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState(load);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    try { localStorage.setItem("fin_v2", JSON.stringify(state)); } catch {}
  }, [state]);

  const tabComponents = [
    <Dashboard state={state} setState={setState} />,
    <CheckingTab state={state} setState={setState} />,
    <CreditCardTab state={state} setState={setState} />,
    <IncomeTab state={state} setState={setState} />,
    <ExpensesTab state={state} setState={setState} />,
    <RecurringTab state={state} setState={setState} />,
    <K401Tab state={state} setState={setState} />,
  ];

  const tabIcons = ["📊","🏦","💳","💵","📋","🔁","🏦"];

  return (
    <div style={{
      minHeight: "100vh", background: "#0A0E1A",
      fontFamily: "'DM Sans', system-ui, sans-serif", color: "#F1F5F9",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        select option { background: #1A1F2E; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0A0E1A; }
        ::-webkit-scrollbar-thumb { background: #2D3548; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#0F1320", borderBottom: "1px solid #2D3548",
        padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 50
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>💵</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Money Dashboard</h1>
              <div style={{ color: "#475569", fontSize: 11 }}>Income · Expenses · Accounts · 401(k)</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 1 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                background: "transparent",
                borderBottom: tab === i ? "2px solid #00C9A7" : "2px solid transparent",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                color: tab === i ? "#00C9A7" : "#64748B",
                padding: "8px 12px", cursor: "pointer",
                fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                letterSpacing: 0.3
              }}>
                {tabIcons[i]} {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 14px 80px" }}>
        {tabComponents[tab]}
      </div>
    </div>
  );
}
