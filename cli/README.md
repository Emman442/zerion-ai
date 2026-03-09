# zerion-cli

`zerion-cli` is the JSON-first CLI for using Zerion from OpenClaw-like and command-based agent runtimes.

## Install

```bash
npm install -g zerion-cli
```

Or run directly:

```bash
npx zerion-cli --help
```

## Authentication

Set your Zerion API key:

```bash
export ZERION_API_KEY="zk_dev_..."
```

The CLI converts the raw key into the HTTP Basic Auth header described in Zerion's authentication docs.

## Commands

```bash
zerion-cli wallet analyze <address> [--positions all|simple|defi]
zerion-cli wallet portfolio <address>
zerion-cli wallet positions <address> [--chain ethereum] [--positions all|simple|defi]
zerion-cli wallet transactions <address> [--limit 25] [--chain ethereum]
zerion-cli wallet pnl <address>
zerion-cli chains list
```

All commands print JSON to stdout.

## Position filtering

The `--positions` flag controls which position types are returned:

| Value | Meaning |
|-------|---------|
| `all` (default) | Both wallet tokens and DeFi positions |
| `simple` | Wallet token balances only |
| `defi` | DeFi protocol positions only (staked, deposited, LP, borrowed) |

## Error handling

Errors are written as JSON to stderr and exit non-zero.

Common failures:

- missing `ZERION_API_KEY`
- invalid address / unsupported wallet query
- unsupported chain filter
- API rate limit (`429`)
- upstream timeouts or temporary errors
