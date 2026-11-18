#!/bin/bash
# Deploy the sniper demo corpus to Sepolia from the Telegraph wallet.
# NOTE: forge create needs --broadcast or it only simulates (dry run).
# The wallet is shared with a parallel builder: retry on nonce collisions.
# Key is passed via shell substitution only; never printed.
set -u
export PATH="$HOME/.local/bin:$PATH"
cd /home/hatch/workspace/telegraph/sniper
RPC="https://ethereum-sepolia-rpc.publicnode.com"
KEY="$(jq -r .privateKey ~/.telegraph/wallet.json)"
PAIR="0x1111111111111111111111111111111111111111"  # stand-in DEX pair address
OUT="data/deployed.txt"
: > "$OUT"

deploy() {
  local name="$1"; local file="$2"; shift 2
  for attempt in 1 2 3 4 5; do
    echo "--- $name (try $attempt) ---" >&2
    local out addr
    out=$(forge create --broadcast --rpc-url "$RPC" --private-key "$KEY" "contracts/$file:$name" "$@" 2>&1)
    addr=$(echo "$out" | grep -i "deployed to" | awk '{print $NF}' | head -1)
    if [ -n "$addr" ]; then
      echo "$name $addr" >> "$OUT"
      echo "OK $name $addr" >&2
      return 0
    fi
    echo "$out" | tail -3 >&2
    sleep 20
  done
  echo "FAILED $name" >&2
  return 1
}

deploy HoneySellBlocked HoneySellBlocked.sol --constructor-args "$PAIR"
deploy HoneyTax99 HoneyTax99.sol --constructor-args "$PAIR"
deploy HoneyBlacklist HoneyBlacklist.sol
deploy HoneyHiddenMint HoneyHiddenMint.sol
deploy HoneyKillSwitch HoneyKillSwitch.sol --constructor-args "$PAIR"
deploy CleanA CleanA.sol
deploy CleanB CleanB.sol

node -e '
const fs = require("fs");
const lines = fs.readFileSync("data/deployed.txt", "utf8").trim().split("\n");
const tokens = {};
for (const l of lines) { const [n, a] = l.split(" "); tokens[n] = a; }
const doc = { chain: "sepolia (11155111)", deployer: "0x35C306388dEb30dE096dDc76e4EF7C40B09458f3", pair_standin: "0x1111111111111111111111111111111111111111", tokens };
fs.writeFileSync("data/corpus.json", JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify(doc, null, 2));
'
