// Regenerate dashboard.html from data/ledger.jsonl + data/corpus.json.
// Usage: node src/dashboard.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "corpus.json"), "utf8"));
const lines = fs.existsSync(path.join(ROOT, "data", "ledger.jsonl"))
  ? fs.readFileSync(path.join(ROOT, "data", "ledger.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const asks = lines.filter((e) => e.kind === "ask");
const decisions = lines.filter((e) => e.kind === "decision");
const trades = lines.filter((e) => e.kind === "paper-buy");
const totalCost = asks.reduce((s, a) => s + (a.cost_ledger_usd ?? 0), 0);
const aborts = decisions.filter((d) => d.decision === "ABORT").length;
const executes = decisions.filter((d) => d.decision === "EXECUTE").length;
const esc = (h) => h ? `<code>${h.slice(0, 10)}…${h.slice(-6)}</code>` : "—";
const money = (n) => n === null || n === undefined ? "—" : `$${Number(n).toFixed(4)}`;

const askRows = asks.map((a) => `<tr>
  <td>${a.token ?? "— (deployer)"}</td><td><code>${a.intent ?? "—"}</code></td>
  <td>${a.miner ?? "—"}</td><td>${a.status ?? "—"}</td>
  <td>${a.verdict ?? "—"}</td><td>${money(a.cost_ledger_usd)}</td><td>${esc(a.receipt_hash)}</td>
  <td>${a.error ? `<span class="err">${a.error.slice(0, 80)}</span>` : (a.reason ?? "")}</td></tr>`).join("\n");

const decCards = decisions.map((d) => {
  const cls = d.decision === "ABORT" ? "abort" : "exec";
  return `<div class="card ${cls}">
    <h3>${d.token} <span class="badge">${d.decision}</span></h3>
    <p><code>${d.address}</code></p>
    <p>Audit: <b>${d.audit_verdict}</b> &nbsp; Wash: <b>${d.wash_verdict}</b></p>
    <p>Reason: ${d.reason}${d.metric_flag ? `<br>Note: ${d.metric_flag}` : ""}</p>
  </div>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Rug-Proof Sniper — Telegraph Mission 14</title>
<style>
body{font-family:system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#111}
h1{font-size:1.6rem} table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{border:1px solid #ccc;padding:.4rem .5rem;text-align:left;vertical-align:top}
th{background:#f0f0f0} code{font-size:.85rem}
.card{border:1px solid #ccc;border-left:6px solid #888;border-radius:6px;padding:.6rem 1rem;margin:.6rem 0}
.card.abort{border-left-color:#c0392b}.card.exec{border-left-color:#27ae60}
.badge{background:#eee;border-radius:4px;padding:.1rem .4rem;font-size:.8rem}
.err{color:#c0392b}.note{background:#f7f7f7;border-radius:6px;padding:.8rem 1rem;font-size:.9rem}
</style></head><body>
<h1>🛡 Rug-Proof Memecoin Sniper</h1>
<p>Telegraph Hackathon Season II — Mission 14 (Web3 Native &amp; DeFi), Apps &amp; Agents track.
Testnet only (Ethereum Sepolia). Every buy decision is gated on intelligence bought
through Telegraph <i>before</i> capital is committed.</p>
<h2>Summary</h2>
<p>Tokens scanned: <b>${decisions.length}</b> &nbsp; Aborted (honeypot / no evidence): <b>${aborts}</b> &nbsp;
Executed (paper buys): <b>${executes}</b> &nbsp; Total Telegraph spend (node ledger): <b>${money(totalCost)}</b></p>
<p>Wallet: <code>0x35C306388dEb30dE096dDc76e4EF7C40B09458f3</code> (Sepolia) ·
Escrow: Telegraph diamond <code>0x72a70e…08b</code> · Corpus: <code>data/corpus.json</code></p>
<h2>Spend panel — every Telegraph request</h2>
<table><tr><th>Token</th><th>Intent</th><th>Miner</th><th>Status</th><th>Verdict</th><th>Cost (ledger)</th><th>Receipt</th><th>Note / error</th></tr>
${askRows || '<tr><td colspan="8">No asks recorded yet.</td></tr>'}
</table>
<h2>Decisions</h2>
${decCards || "<p>No decisions yet.</p>"}
<h2>Paper trades</h2>
<ul>${trades.map((t) => `<li>${t.token}: ${t.notional_sepolia_eth ? `SIMULATED BUY ${t.notional_sepolia_eth} Sepolia ETH notional` : "no buy"} — ${t.note}</li>`).join("\n") || "<li>none yet</li>"}</ul>
<div class="note"><b>How to read this:</b> (1) Audit asks include the token's full Solidity source in the
question — the audit miner cannot fetch live chain state. (2) Audit answers currently come from the
node's last-resort general model (free on the ledger); verdicts are still the model's reading of the
provided source. (3) Wash miners only cover mainnet/Base, so Sepolia corpus tokens return
"Unsupported chain" (free, unbilled) — the wash leg is proven separately on PEPE/mainnet
(receipt <code>0x882f2630…713e97</code>, $0.01). (4) Cost shown is the node's ledger unbilled delta per
ask, not the $0.26 authorization hold echoed in ask responses. (5) "EXECUTE" is a paper trade only:
no pool exists for these demo tokens, no on-chain swap happens, no funds move.</div>
<p><small>Generated from <code>data/ledger.jsonl</code>. Corpus: ${Object.entries(corpus.tokens).map(([n, a]) => `${n} <code>${a.slice(0, 10)}…</code>`).join(" · ")}</small></p>
</body></html>`;

fs.writeFileSync(path.join(ROOT, "dashboard.html"), html);
console.log(`dashboard.html written: ${asks.length} asks, ${decisions.length} decisions, ${money(totalCost)} total`);
