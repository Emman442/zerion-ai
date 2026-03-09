export const CHAIN_IDS = new Set([
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
  "avalanche",
  "gnosis",
  "scroll",
  "linea",
  "zksync",
  "solana",
  "zora",
  "blast"
]);

export function parseFlags(argv) {
  const flags = {};
  const rest = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }

    const raw = token.slice(2);
    const eqIndex = raw.indexOf("=");
    const key = (eqIndex === -1 ? raw : raw.slice(0, eqIndex)).trim();
    const inlineValue = eqIndex === -1 ? undefined : raw.slice(eqIndex + 1);
    const nextValue = inlineValue ?? argv[i + 1];

    if (inlineValue === undefined && nextValue && !nextValue.startsWith("--")) {
      flags[key] = nextValue;
      i += 1;
    } else {
      flags[key] = inlineValue ?? true;
    }
  }

  return { rest, flags };
}

export function basicAuthHeader(rawKey) {
  return `Basic ${Buffer.from(`${rawKey}:`).toString("base64")}`;
}

export const POSITION_FILTERS = {
  all: "no_filter",
  simple: "only_simple",
  defi: "only_complex"
};

export function validatePositions(flag) {
  if (!flag) return null;
  if (flag === true) {
    return {
      code: "missing_positions_value",
      message: "--positions requires a value (e.g. --positions all).",
      supportedValues: Object.keys(POSITION_FILTERS)
    };
  }
  if (!POSITION_FILTERS[flag]) {
    return {
      code: "unsupported_positions_filter",
      message: `Unsupported positions filter '${flag}'.`,
      supportedValues: Object.keys(POSITION_FILTERS)
    };
  }
  return null;
}

export function resolvePositionFilter(flag) {
  return POSITION_FILTERS[flag] || "no_filter";
}

export function validateChain(chain) {
  if (!chain) return null;
  if (chain === true) {
    return {
      code: "missing_chain_value",
      message: "--chain requires a value (e.g. --chain ethereum).",
      supportedChains: Array.from(CHAIN_IDS).sort()
    };
  }
  if (!CHAIN_IDS.has(chain)) {
    return {
      code: "unsupported_chain",
      message: `Unsupported chain '${chain}'.`,
      supportedChains: Array.from(CHAIN_IDS).sort()
    };
  }
  return null;
}

export function summarizeAnalyze(address, portfolio, positions, transactions, pnl) {
  return {
    wallet: {
      query: address
    },
    portfolio: {
      total: portfolio?.data?.attributes?.total?.positions ?? null,
      currency: "usd"
    },
    positions: {
      count: Array.isArray(positions?.data) ? positions.data.length : 0
    },
    transactions: {
      sampled: Array.isArray(transactions?.data) ? transactions.data.length : 0
    },
    pnl: {
      available: Boolean(pnl?.data),
      summary: pnl?.data?.attributes ?? null
    },
    raw: {
      portfolio,
      positions,
      transactions,
      pnl
    }
  };
}
