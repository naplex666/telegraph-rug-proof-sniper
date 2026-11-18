# Demo corpus — Sepolia (chain 11155111)

Deployer (Telegraph wallet): `0x35C306388dEb30dE096dDc76e4EF7C40B09458f3`
Pair stand-in for sell logic: `0x1111111111111111111111111111111111111111` (a dummy address
standing in for the DEX pair; no real pool exists for these demo tokens).
Deploy script: `deploy.sh` (forge create --broadcast; `--broadcast` is required or
forge only simulates). All addresses verified on-chain via `name()`.

| Token | Address | Type | Ground truth (what the trap is) |
|---|---|---|---|
| HoneySellBlocked | `0x38659121Bb8498c26C0776602425173655b0c9ff` | honeypot | Sells to the pair revert for everyone except the owner. Buy works, sell doesn't. |
| HoneyTax99 | `0x68EcF362cE958908F38Bb7CD52A3ECEb7c23E6Cf` | honeypot | 99% tax on sells to the pair (99% to owner, seller keeps 1%). |
| HoneyBlacklist | `0xCBbE669AbDF9b221cD95dc717226314bfC39D763` | honeypot | Owner can blacklist any address; blacklisted addresses can't send or receive. |
| HoneyHiddenMint | `0xc0a79E537428345e37EBb6695126A0dFFC7626d5` | honeypot | Owner can `mint()` unlimited tokens to anyone, no cap, no timelock. |
| HoneyKillSwitch | `0xe2f00533b47EB0480916b2060391A85B9A6905Ed` | honeypot | Owner can disable all trading (`tradingEnabled=false`) + 25% sell tax. |
| CleanA | `0xA16b3D95c1E4Fcf26ae2A57f46182F8570782c53` | clean | Plain ERC20. Fixed supply, no owner, no mint, no tax, no restrictions. |
| CleanB | `0xC3e8BcDac236a2C302aCD16508F0ef6490315315` | clean | Plain ERC20, different name/supply. Same clean profile as CleanA. |

Expected sniper behavior: ABORT on all 5 honeypots, EXECUTE (paper buy) on the cleans.

## Local cross-check (Slither 0.11.6 + Aderyn 0.6.8, 18 Nov 2026)

- Slither (`data/slither.txt`): 12 findings, **all INFO** — `missing-zero-check` on
  constructor pair addresses, `immutable-states` (owner/pair could be immutable).
  No HIGH/MEDIUM. Slither does **not** flag the honeypot logic: owner-gated sells,
  99% tax, blacklist, hidden mint and kill-switch are business-logic centralization,
  not code-level vulnerabilities its detectors cover.
- Aderyn (`report.md`): 4 findings, **all Low** — large numeric literal, state change
  without event, address set without checks, could-be-immutable. No High/Medium.

This is the point of the demo: local static tools miss the trap. The Telegraph audit
miner reads the actual source and judges the *logic* (verified live: it called
HoneySellBlocked SUSPICIOUS and described the sell block correctly).

## Note on the shared wallet

The Telegraph wallet is shared with the parallel bounty-hunter build. Its first
deploy burst (nonces 7–13, 3 contracts + other txs, ~0.025 Sepolia ETH) belongs to
that build, not this corpus. This corpus used nonces 15+. If nonces collide again,
`deploy.sh` retries each deploy up to 5 times.
