# Rug-Proof Memecoin Sniper — Telegraph Hackathon Season II

Mission 14 (Web3 Native & DeFi), Apps & Agents track. Testnet only (Ethereum Sepolia).
No real money, no mainnet, no real swaps.

## What it does

A new token appears. Before committing capital, the agent buys three pieces of
intelligence through Telegraph — then decides:

1. **Audit** — `SMART_CONTRACT_AUDIT_GENERAL` on the token's source code.
   Verdict first word: `SAFE` / `SUSPICIOUS` / `MALICIOUS`.
2. **Wash check** — `WASH_TRADING_DETECTION_GENERAL` on the token address.
3. **Deployer history** — `ONCHAIN_METRIC_VERIFY_GENERAL`, deployer tx_count on
   mainnet (once per run; same deployer for the whole corpus).

**Decision rule:** ABORT if the audit says SUSPICIOUS/MALICIOUS or the wash verdict
is positive. EXECUTE (simulated/paper buy only) if the audit says SAFE and there is
no wash signal. Otherwise ABORT (insufficient evidence — safe default).

Every ask and every decision is written to `data/ledger.jsonl` with intent, miner,
cost and receipt hash. `dashboard.html` renders the spend panel.

## How to run

```bash
# 1. Telegraph MCP server (repo build — the npm v2.1.1 release is STALE, wrong
#    escrow diamond; never use npx for it). Already built at:
#    ~/workspace/telegraph/upstream-mcp/dist/index.js
#    Wallet ~/.telegraph/wallet.json (mode 0600) is read by the server itself.
#    Escrow must hold test USDC: node ~/workspace/telegraph/upstream-mcp/dist/index.js fund 2 --yes

# 2. Run the agent (processes the corpus in order: 5 honeypots, then 2 cleans)
node src/agent.mjs

# 3. Rebuild the dashboard
node src/dashboard.mjs

# 4. Options
node src/agent.mjs --only HoneySellBlocked   # single token
node src/agent.mjs --limit 3                 # first 3 tokens
```

## Layout

- `contracts/` — demo corpus (5 honeypots + 2 clean ERC20s, Solidity 0.8.24).
  `deploy.sh` deploys them to Sepolia; `data/corpus.json` holds the addresses.
- `src/agent.mjs` — the agent (one MCP server process per run, stdio JSON-RPC).
- `src/dashboard.mjs` — regenerates `dashboard.html` from the ledger.
- `data/ledger.jsonl` — append-only record of every ask + decision + paper trade.
- `data/slither.txt`, `report.md` — local Slither/Aderyn cross-check output.
- `CORPUS.md` — corpus ground truth. `SUBMISSION.md` — hackathon submission draft.

## Things we learned the hard way (verified live, 18 Nov 2026)

- **Intent names need the `_GENERAL` suffix.** `SMART_CONTRACT_AUDIT` (no suffix)
  has 0 miners and times out. `SMART_CONTRACT_AUDIT_GENERAL` has 16 miners.
- **The audit miner cannot fetch live chain state.** The question MUST include the
  token's full Solidity source, or the miner refuses and returns generic guidance.
  With source included it correctly called HoneySellBlocked SUSPICIOUS.
- **Audit answers currently come from the node's last-resort general model** (free on
  the node ledger; `cost_usd: 0`). No ranked specialist answered the audit asks.
  The verdict is still the model's reading of the provided source.
- **Wash miners only cover mainnet/Base.** Sepolia tokens come back
  `422 [invalid_subject]: Unsupported chain for this route` — free, unbilled. The
  wash leg is proven separately on PEPE/mainnet (receipt `0x882f2630…713e97`, $0.01).
- **Cost truth is the node ledger, not the ask response.** Responses echo the $0.26
  authorization hold as `billed_usd`; the agent snapshots
  `GET /v1/ledger/account/<wallet>` unbilled before/after each ask and records the
  delta. Specialist asks cost $0.01; last-resort audit answers cost $0.
- **npm `@telegraphprotocol/telegraph-protocol-mcp` v2.1.1 is stale**: its default
  escrow diamond is the old `0x3624…b99b`, and deposits there are invisible to the
  node. Use the repo build (default diamond `0x72a70e…08b`).
- **`forge create` needs `--broadcast`** or it only simulates (dry run).
- The Telegraph wallet is shared with the parallel bounty-hunter build; if a deploy
  hits a nonce collision, `deploy.sh` retries up to 5 times.
