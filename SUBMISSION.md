# Rug-Proof Memecoin Sniper — Submission Draft (Telegraph Hackathon Season II)

> DRAFT — not submitted. English as the platform expects. Repo: (to be published
> as `naplex666/telegraph-rug-proof-sniper` — publication needs Zec's gas).

## Short public summary

A rug-proof memecoin sniper for Mission 14 (Web3 Native & DeFi). Before it commits
capital to a newly deployed token, the agent buys three pieces of intelligence
through Telegraph — a smart-contract audit, a wash-trading check, and a deployer
history check — and only buys when all of them clear. On a demo corpus of 5
honeypots + 2 clean tokens on Sepolia it dodged every honeypot and paper-bought
the clean ones. Every Telegraph request is logged with intent, miner, cost and
receipt hash in an on-page spend panel.

## How it works

1. **Scan** — the agent takes a list of newly deployed token addresses
   (`data/corpus.json`; in production, a chain watcher feeding new deployments).
2. **Ask Telegraph (escrow, test USDC)** — per token:
   - `SMART_CONTRACT_AUDIT_GENERAL` — the token's full Solidity source is
     included in the question (the audit miner cannot fetch live chain state).
     Verdict first word: `SAFE` / `SUSPICIOUS` / `MALICIOUS`.
   - `WASH_TRADING_DETECTION_GENERAL` — `subject` = token address.
   - `ONCHAIN_METRIC_VERIFY_GENERAL` — deployer `tx_count` on mainnet, once per
     run (context only; same deployer for the whole corpus).
3. **Decide** — ABORT on any SUSPICIOUS/MALICIOUS audit or positive wash verdict;
   EXECUTE (simulated/paper buy — no pool exists for demo tokens, no funds move)
   only on audit SAFE with no wash signal; otherwise ABORT (safe default).
4. **Record** — every ask and decision appends to `data/ledger.jsonl`;
   `dashboard.html` renders the spend panel and decision cards.

## How to run

```bash
node src/agent.mjs            # scan corpus, ask Telegraph, decide, write ledger
node src/dashboard.mjs        # regenerate dashboard.html from the ledger
```

Requires the Telegraph MCP server (repo build at
`~/workspace/telegraph/upstream-mcp/dist/index.js`; the npm v2.1.1 release is stale
— wrong escrow diamond) and a funded testnet wallet at `~/.telegraph/wallet.json`.
Testnet only. No real money.

## Evidence

- Full ledger: `data/ledger.jsonl` (every ask: intent, miner, cost, receipt hash).
- Spend panel: `dashboard.html` (open in any browser, no server needed).
- Corpus with ground truth: `CORPUS.md` (7 Sepolia tokens, deployer
  `0x35C306388dEb30dE096dDc76e4EF7C40B09458f3`).
- Local cross-check: Slither 0.11.6 (`data/slither.txt`, 12 INFO only) and Aderyn
  0.6.8 (`report.md`, 4 Low only) — neither flags the honeypot logic, which is
  exactly why the Telegraph audit layer matters.
- Demo run results (see table below; run id in ledger).

<!-- RESULTS — verified demo run 20261118T061448, 18 Nov 2026, 7 tokens, 15 asks, $0.09 total (node ledger) -->
| Token | Audit | Wash | Decision | Telegraph spend |
|---|---|---|---|---|
| HoneySellBlocked | SUSPICIOUS | inconclusive | ABORT | $0.01 (wash; audit $0) |
| HoneyTax99 | MALICIOUS | inconclusive | ABORT | $0.01 |
| HoneyBlacklist | MALICIOUS | inconclusive | ABORT | $0.01 |
| HoneyHiddenMint | MALICIOUS | inconclusive | ABORT | $0.01 |
| HoneyKillSwitch | SUSPICIOUS | inconclusive | ABORT | $0.01 |
| CleanA | SAFE | inconclusive | EXECUTE (paper buy) | $0.01 |
| CleanB | SAFE | inconclusive | EXECUTE (paper buy) | $0.01 |
| Deployer check (once) | — | — | context only | $0.02 (metric) |

Run id `20261118T061448`. 5 ABORT, 2 EXECUTE. Escrow before $0.12 unbilled,
after $0.21. Audit asks cost $0 on the ledger (last-resort model); wash asks
$0.01 each; metric $0.02. Receipts in `data/ledger.jsonl` (8 receipts).

## Commercial summary (5 questions — draft)

1. **Problem:** new memecoin buyers walk into honeypots: sells blocked, 99% sell
   tax, owner blacklist/mint/kill-switch. Losses are instant and irreversible.
2. **Users:** memecoin traders, copy-trading bots, and token-listing teams who need
   a go/no-go verdict on a fresh token in seconds.
3. **Why Telegraph:** the verdict must come from an independent machine, paid
   per-answer, with a receipt — not from the token's own deployer or a free API
   that can be gamed. Escrow billing means a failed ask costs nothing.
4. **Business model:** per-scan fee (a cut of the $0.01–0.03 intelligence cost
   per token) or subscription for sniper bots; listing desks pay per risk memo.
5. **Moat:** the decision log itself — every verdict is a signed, receipted
   Telegraph answer, so the sniper's track record is auditable by anyone.

## Honest limitations (found live, 18 Nov 2026)

- Audit answers currently come from the node's last-resort general model (free on
  the ledger), not a ranked specialist — the model reads the provided source and
  judges it correctly on our corpus, but it is unverified fulfillment.
- Wash miners only cover mainnet/Base; Sepolia corpus tokens sometimes return
  `422 Unsupported chain` (free, unbilled) and sometimes an inconclusive verdict
  from a general miner. The wash leg is proven on PEPE/mainnet
  (receipt `0x882f2630d82ac558403747ac582a4cf8de37e1acd07e7741d27c001313713e97`, $0.01).
- The "deterministic" metric intent returned a wrong value, twice differently:
  deployer `tx_count` 628451 in one run and `null` in the next, vs ground truth
  0 on mainnet (verified with `cast nonce`). The sniper therefore treats metric
  results as context only, never as a veto.
- Ask responses echo the $0.26 authorization hold as `billed_usd`; true cost is
  the node ledger's unbilled delta, which the agent snapshots per ask.
