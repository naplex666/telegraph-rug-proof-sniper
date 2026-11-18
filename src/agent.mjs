// Rug-proof memecoin sniper — Telegraph Hackathon Season II, Mission 14.
// CLI agent: scan (corpus) -> buy Telegraph intelligence -> decide -> paper trade.
// Testnet only. No real money. Simulated buys only (no pool exists for demo tokens).
//
// Telegraph flow (proven live 18 Nov 2026):
// - MCP server: repo build ~/workspace/telegraph/upstream-mcp/dist/index.js
//   (npm v2.1.1 is STALE — wrong escrow diamond. Never npx it.)
// - Wallet 0x35C306388dEb30dE096dDc76e4EF7C40B09458f3 (Sepolia), escrow ~1.93 test USDC.
// - Intents MUST use the _GENERAL suffix. Unsuffixed names have 0 miners and time out.
// - SMART_CONTRACT_AUDIT_GENERAL: no params; the miner CANNOT fetch live state,
//   so the question MUST include the contract source code.
// - WASH_TRADING_DETECTION_GENERAL: param subject=token address. Its miners only
//   cover mainnet/Base; Sepolia tokens come back "Unsupported chain" (free, unbilled).
// - ONCHAIN_METRIC_VERIFY_GENERAL: params address/block/chain/metric; mainnet
//   chains only. Used once per run as a deployer-history check (same deployer).
// - Cost truth: the ask response's billed_usd can echo the $0.26 hold. The real
//   cost is the node's ledger unbilled delta — the agent snapshots it per ask.
//
// Usage: node src/agent.mjs [--limit N] [--only NAME,...]
// Output: data/ledger.jsonl (append), dashboard.html (regenerated).
import { spawn } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MCP_SERVER = "/home/hatch/workspace/telegraph/upstream-mcp/dist/index.js";
const LEDGER = "https://devnode.telegraphprotocol.com";
const WALLET = "0x35C306388dEb30dE096dDc76e4EF7C40B09458f3";
const RPC_MAINNET = "https://ethereum-rpc.publicnode.com";
const PAIR = "0x1111111111111111111111111111111111111111";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.findIndex((a) => a === name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const LIMIT = Number(opt("--limit", "0")) || 0;
const ONLY = (opt("--only", "") || "").split(",").filter(Boolean);

const runId = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
const ledgerPath = path.join(ROOT, "data", "ledger.jsonl");
const ledger = [];
function record(entry) {
  entry.run_id = runId;
  entry.ts = new Date().toISOString();
  ledger.push(entry);
  fs.appendFileSync(ledgerPath, JSON.stringify(entry) + "\n");
}

// ---------- MCP client (one server process per run) ----------
class Mcp {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.server = spawn("node", [MCP_SERVER], { stdio: ["pipe", "pipe", "inherit"] });
    this.rl = readline.createInterface({ input: this.server.stdout });
    this.rl.on("line", (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params) {
    const id = this.nextId++;
    this.server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => this.pending.has(id) && (this.pending.delete(id), reject(new Error(`timeout ${method}`))), 120000);
    });
  }
  notify(method, params) {
    this.server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }
  async init() {
    await this.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "rug-proof-sniper", version: "1.0.0" } });
    this.notify("notifications/initialized");
  }
  async call(tool, argsObj) {
    const res = await this.send("tools/call", { name: tool, arguments: argsObj });
    const text = res?.content?.[0]?.text ?? "";
    try { return { raw: res, json: JSON.parse(text) }; }
    catch { return { raw: res, json: null, text }; }
  }
  close() { try { this.server.kill(); } catch {} }
}

// ---------- ledger (node) balance snapshots ----------
async function unbilled() {
  try {
    const r = await fetch(`${LEDGER}/v1/ledger/account/${WALLET}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    return Number(j.unbilled ?? 0) / 1e6;
  } catch { return null; }
}

async function ask(mcp, tool, argsObj, label) {
  const before = await unbilled();
  const started = Date.now();
  let out;
  try {
    out = await mcp.call(tool, argsObj);
  } catch (e) {
    return { label, error: String(e.message || e), ms: Date.now() - started };
  }
  const after = await unbilled();
  const j = out.json ?? {};
  return {
    label,
    ms: Date.now() - started,
    status: j.status ?? (j.answer || j.fulfillment ? 200 : null),
    error: j.error ?? null,
    reason: j.reason ?? null,
    intent: j.intent ?? argsObj.intent ?? null,
    miner: j.miner ?? null,
    answer: j.answer ?? null,
    fulfillment: j.fulfillment ?? null,
    cost_response_usd: j.cost_usd ?? j.payment?.billed_usd ?? null,
    cost_ledger_usd: before !== null && after !== null ? +(after - before).toFixed(6) : null,
    receipt_hash: j.fulfillment?.payments?.[0]?.receipt_hash ?? j.payment?.receipt?.receipt_hash ?? null,
    warnings: j.warnings ?? [],
  };
}

// ---------- verdict parsing ----------
function auditVerdict(answer) {
  if (typeof answer !== "string") return { verdict: "unknown", detail: answer };
  const first = answer.trim().split(/\s+/)[0].replace(/[^A-Za-z]/g, "").toUpperCase();
  const verdict = ["SAFE", "SUSPICIOUS", "MALICIOUS"].includes(first) ? first : "unknown";
  return { verdict, detail: answer.slice(0, 600) };
}
function washVerdict(answer) {
  if (!answer || typeof answer !== "object") return { verdict: "unknown", detail: answer };
  const v = String(answer.verdict ?? "unknown");
  const pct = answer.wash_volume_pct ?? null;
  const bad = (/wash/i.test(v) && !/inconclusive/i.test(v) && v.toLowerCase() !== "clean") || (typeof pct === "number" && pct > 50);
  return { verdict: v, wash_volume_pct: pct, bad, summary: answer.summary ?? null, signals: answer.signals ?? [] };
}

// ---------- main ----------
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "corpus.json"), "utf8"));
const tokens = Object.entries(corpus.tokens).map(([name, address]) => ({ name, address }));
const queue = tokens.filter((t) => !ONLY.length || ONLY.includes(t.name)).slice(0, LIMIT || undefined);
const sourceOf = (name) => {
  const base = fs.readFileSync(path.join(ROOT, "contracts", "Base.sol"), "utf8");
  const self = fs.readFileSync(path.join(ROOT, "contracts", `${name}.sol`), "utf8");
  return base + "\n" + self;
};

const mcp = new Mcp();
await mcp.init();
console.log(`run ${runId}: ${queue.length} token(s), escrow unbilled before: $${await unbilled()}`);

// 1) Deployer-history check, once per run (same deployer for all corpus tokens).
let metric = null;
try {
  const br = await fetch(RPC_MAINNET, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
    signal: AbortSignal.timeout(15000),
  });
  const bj = await br.json();
  const block = parseInt(bj.result, 16);
  const r = await ask(mcp, "telegraph_ask", {
    intent: "ONCHAIN_METRIC_VERIFY_GENERAL",
    question: `What is the transaction count (nonce) of ${WALLET} at block ${block} on ethereum?`,
    params: { address: WALLET, block, chain: "ethereum", metric: "tx_count" },
  }, "metric:deployer");
  metric = { ...r, block, address: WALLET };
  record({ kind: "ask", token: null, ...stripAnswer(r), block });
  console.log(`metric deployer tx_count: ${JSON.stringify(r.answer)} cost_ledger=$${r.cost_ledger_usd} receipt=${r.receipt_hash}`);
} catch (e) {
  console.log(`metric check skipped: ${e.message}`);
  record({ kind: "ask", token: null, label: "metric:deployer", error: String(e.message || e) });
}
const metricFlag = metric?.answer && Number(metric.answer.tx_count) === 0
  ? "fresh deployer: no mainnet history"
  : null;

// 2) Per-token: audit (with source) + wash (attempt) -> decide.
let aborts = 0, executes = 0;
for (const t of queue) {
  console.log(`\n== ${t.name} ${t.address} ==`);
  const src = sourceOf(t.name);
  const auditQ = `Audit this Solidity source code, deployed as an ERC20 token at ${t.address} on Ethereum Sepolia. Look for reentrancy, access control problems, integer overflow, and honeypot behavior: can ordinary holders sell their tokens, are transfers restricted, can the owner mint, blacklist, or disable trading? Give a one-word verdict first (SAFE, SUSPICIOUS, or MALICIOUS), then the main findings.\n\n\`\`\`solidity\n${src}\n\`\`\``;
  const a = await ask(mcp, "telegraph_ask", { intent: "SMART_CONTRACT_AUDIT_GENERAL", question: auditQ }, `audit:${t.name}`);
  const av = auditVerdict(a.answer);
  record({ kind: "ask", token: t.name, address: t.address, ...stripAnswer(a), verdict: av.verdict });
  console.log(`audit: ${av.verdict} miner=${a.miner} cost_ledger=$${a.cost_ledger_usd} receipt=${a.receipt_hash} ${a.error ? "ERROR " + a.error : ""}`);

  const w = await ask(mcp, "telegraph_ask", {
    intent: "WASH_TRADING_DETECTION_GENERAL",
    question: `Is volume on token ${t.address} (${t.name} on Ethereum Sepolia) wash traded? Check for circular transfers between affiliated wallets.`,
    params: { subject: t.address },
  }, `wash:${t.name}`);
  const wv = w.answer ? washVerdict(w.answer) : { verdict: w.error ? `error: ${w.reason || w.error}` : "unknown", bad: false };
  record({ kind: "ask", token: t.name, address: t.address, ...stripAnswer(w), verdict: wv.verdict, wash_volume_pct: wv.wash_volume_pct ?? null });
  console.log(`wash: ${wv.verdict} miner=${w.miner} cost_ledger=$${w.cost_ledger_usd} receipt=${w.receipt_hash} ${w.error ? "ERROR " + (w.reason || w.error) : ""}`);

  // 3) Decide. Abort on any positive malicious signal. Wash errors are neutral
  // (miners don't cover Sepolia); metric is context only, same deployer for all.
  let decision, reason;
  if (av.verdict === "MALICIOUS" || av.verdict === "SUSPICIOUS") {
    decision = "ABORT"; reason = `audit verdict ${av.verdict}`;
  } else if (wv.bad) {
    decision = "ABORT"; reason = `wash verdict ${wv.verdict} (${wv.wash_volume_pct ?? "?"}% wash)`;
  } else if (av.verdict === "SAFE") {
    decision = "EXECUTE"; reason = "audit SAFE, no wash signal";
  } else {
    decision = "ABORT"; reason = `audit verdict ${av.verdict} (insufficient evidence)`;
  }
  const trade = decision === "EXECUTE"
    ? { kind: "paper-buy", token: t.name, address: t.address, notional_sepolia_eth: 0.001, note: "SIMULATED buy only — no pool exists for this demo token, no on-chain swap, no funds moved" }
    : { kind: "paper-buy", token: t.name, address: t.address, notional_sepolia_eth: 0, note: "no buy — aborted" };
  record({ kind: "decision", token: t.name, address: t.address, decision, reason, audit_verdict: av.verdict, wash_verdict: wv.verdict, metric_flag: metricFlag });
  record(trade);
  if (decision === "ABORT") aborts++; else executes++;
  console.log(`DECISION: ${decision} — ${reason}`);
}

mcp.close();
console.log(`\nrun ${runId} done: ${aborts} ABORT, ${executes} EXECUTE. escrow unbilled now: $${await unbilled()}`);
console.log(`ledger: ${ledgerPath}`);
process.exit(0); // readline on the server stdout would otherwise keep the loop alive

function stripAnswer(r) {
  const { label, ms, status, error, reason, intent, miner, fulfillment, cost_response_usd, cost_ledger_usd, receipt_hash, warnings } = r;
  return { label, ms, status, error, reason, intent, miner, fulfillment_status: fulfillment?.status ?? null, cost_response_usd, cost_ledger_usd, receipt_hash, warnings };
}
