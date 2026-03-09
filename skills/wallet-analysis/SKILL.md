---
name: wallet-analysis
description: Analyze a wallet using Zerion's hosted MCP or the zerion-cli. Summarize portfolio value, positions, transactions, and PnL in a clear read-only report.
---

# Wallet Analysis

Use this skill for fast, read-only wallet analysis.

## Inputs

- wallet query: address or ENS name
- optional chain filter when the user wants chain-specific context
- optional position filter: `all` (default, both tokens and DeFi), `simple` (wallet tokens only), `defi` (DeFi protocol positions only)

## Workflow

1. Resolve the wallet query if the runtime supports name resolution.
2. Fetch portfolio overview.
3. Fetch wallet positions.
4. Fetch recent transactions.
5. Fetch wallet PnL.
6. Summarize:
   - total portfolio context
   - top holdings
   - DeFi exposure
   - recent activity
   - PnL highlights

## MCP-first usage

If the environment supports MCP, prefer the hosted Zerion MCP and ask directly for wallet analysis.

## CLI-first usage

If the environment expects commands, run:

```bash
zerion-cli wallet analyze <wallet>
zerion-cli wallet analyze <wallet> --positions defi
```

Or fetch the pieces explicitly:

```bash
zerion-cli wallet portfolio <wallet>
zerion-cli wallet positions <wallet>
zerion-cli wallet positions <wallet> --positions defi
zerion-cli wallet transactions <wallet> --limit 10
zerion-cli wallet pnl <wallet>
```

## Output

Return a concise read-only report covering:

- wallet identifier
- total portfolio context
- notable positions
- notable transactions
- PnL
- any data limitations or failures

## Guardrails

- read-only only
- do not fabricate unsupported chains or positions
- if data is missing or upstream is rate-limited, say that explicitly
- prefer addresses in examples when client-side ENS support is uncertain
