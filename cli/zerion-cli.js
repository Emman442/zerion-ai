#!/usr/bin/env node

import { parseFlags, basicAuthHeader, validateChain, validatePositions, resolvePositionFilter, summarizeAnalyze, CHAIN_IDS, POSITION_FILTERS } from "./lib.mjs";

const API_BASE = (process.env.ZERION_API_BASE || "https://api.zerion.io/v1").replace(/\/+$/, "");
const DEFAULT_TX_LIMIT = 10;
const API_KEY = process.env.ZERION_API_KEY || "";

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printError(code, message, details = {}) {
  process.stderr.write(`${JSON.stringify({ error: { code, message, ...details } }, null, 2)}\n`);
}

function usage() {
  print({
    name: "zerion-cli",
    usage: [
      "zerion-cli wallet analyze <address> [--positions all|simple|defi]",
      "zerion-cli wallet portfolio <address>",
      "zerion-cli wallet positions <address> [--chain ethereum] [--positions all|simple|defi]",
      "zerion-cli wallet transactions <address> [--limit 10] [--chain ethereum]",
      "zerion-cli wallet pnl <address>",
      "zerion-cli chains list"
    ],
    env: ["ZERION_API_KEY", "ZERION_API_BASE (optional)"]
  });
}

function ensureKey() {
  if (!API_KEY) {
    printError("missing_api_key", "ZERION_API_KEY is required.");
    process.exit(1);
  }
}

function validateChainOrExit(chain) {
  const err = validateChain(chain);
  if (err) {
    printError(err.code, err.message, { supportedChains: err.supportedChains });
    process.exit(1);
  }
}

function validatePositionsOrExit(positions) {
  const err = validatePositions(positions);
  if (err) {
    printError(err.code, err.message, { supportedValues: err.supportedValues });
    process.exit(1);
  }
}

async function fetchAPI(pathname, params = {}) {
  const url = new URL(`${API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: basicAuthHeader(API_KEY)
    }
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const err = new Error(`Zerion API request failed with status ${response.status}.`);
    err.status = response.status;
    err.response = payload;
    throw err;
  }

  return payload;
}

async function request(pathname, params = {}) {
  ensureKey();
  try {
    return await fetchAPI(pathname, params);
  } catch (err) {
    printError("api_error", err.message, {
      status: err.status,
      response: err.response
    });
    process.exit(1);
  }
}

async function getPortfolio(address) {
  return request(`/wallets/${encodeURIComponent(address)}/portfolio`);
}

async function getPositions(address, chain, positionFilter) {
  const params = { "filter[positions]": resolvePositionFilter(positionFilter) };
  if (chain) params["filter[chain_ids]"] = chain;
  return request(`/wallets/${encodeURIComponent(address)}/positions/`, params);
}

async function getTransactions(address, chain, limit) {
  const params = {
    "page[size]": limit || DEFAULT_TX_LIMIT
  };
  if (chain) params["filter[chain_ids]"] = chain;
  return request(`/wallets/${encodeURIComponent(address)}/transactions/`, params);
}

async function getPnl(address) {
  return request(`/wallets/${encodeURIComponent(address)}/pnl`);
}

async function listChains() {
  return request("/chains/");
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    usage();
    return;
  }

  const { rest, flags } = parseFlags(argv);
  const [scope, action, target] = rest;

  if (scope === "chains" && action === "list") {
    print(await listChains());
    return;
  }

  if (scope !== "wallet" || !action) {
    usage();
    process.exit(1);
  }

  if (!target) {
    printError("missing_wallet", "A wallet address or ENS name is required.");
    process.exit(1);
  }

  validateChainOrExit(flags.chain);
  validatePositionsOrExit(flags.positions);

  switch (action) {
    case "portfolio":
      print(await getPortfolio(target));
      return;
    case "positions":
      print(await getPositions(target, flags.chain, flags.positions));
      return;
    case "transactions":
      print(await getTransactions(target, flags.chain, flags.limit));
      return;
    case "pnl":
      print(await getPnl(target));
      return;
    case "analyze": {
      ensureKey();
      const addr = encodeURIComponent(target);
      const txParams = { "page[size]": flags.limit || DEFAULT_TX_LIMIT };
      const posParams = { "filter[positions]": resolvePositionFilter(flags.positions) };
      if (flags.chain) posParams["filter[chain_ids]"] = flags.chain;
      if (flags.chain) txParams["filter[chain_ids]"] = flags.chain;
      const results = await Promise.allSettled([
        fetchAPI(`/wallets/${addr}/portfolio`),
        fetchAPI(`/wallets/${addr}/positions/`, posParams),
        fetchAPI(`/wallets/${addr}/transactions/`, txParams),
        fetchAPI(`/wallets/${addr}/pnl`)
      ]);
      const labels = ["portfolio", "positions", "transactions", "pnl"];
      const values = results.map((r) => r.status === "fulfilled" ? r.value : null);
      const failures = results
        .map((r, i) => r.status === "rejected" ? labels[i] : null)
        .filter(Boolean);
      const summary = summarizeAnalyze(target, ...values);
      if (failures.length) summary.failures = failures;
      print(summary);
      return;
    }
    default:
      usage();
      process.exit(1);
  }
}

main().catch((error) => {
  printError("unexpected_error", error.message);
  process.exit(1);
});
