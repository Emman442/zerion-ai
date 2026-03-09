import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, "../cli/zerion-cli.js");

function run(args, env = {}) {
  return new Promise((resolve) => {
    execFile(
      "node",
      [BIN, ...args],
      { env: { ...process.env, ZERION_API_KEY: "", ...env } },
      (error, stdout, stderr) => {
        resolve({ code: error?.code ?? 0, stdout, stderr });
      }
    );
  });
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

describe("CLI routing", () => {
  describe("help output", () => {
    it("shows help with no args (exit 0)", async () => {
      const { code, stdout } = await run([]);
      assert.equal(code, 0);
      const json = parseJSON(stdout);
      assert.ok(json);
      assert.equal(json.name, "zerion-cli");
      assert.ok(Array.isArray(json.usage));
      assert.ok(Array.isArray(json.env));
    });

    it("shows help with --help (exit 0)", async () => {
      const { code, stdout } = await run(["--help"]);
      assert.equal(code, 0);
      assert.ok(parseJSON(stdout));
    });

    it("shows help with -h (exit 0)", async () => {
      const { code, stdout } = await run(["-h"]);
      assert.equal(code, 0);
      assert.ok(parseJSON(stdout));
    });
  });

  describe("error routing", () => {
    it("wallet with no action → help, exit 1", async () => {
      const { code, stdout } = await run(["wallet"]);
      assert.equal(code, 1);
      const json = parseJSON(stdout);
      assert.ok(json);
      assert.equal(json.name, "zerion-cli");
    });

    it("wallet portfolio with no address → missing_wallet, exit 1", async () => {
      const { code, stderr } = await run(["wallet", "portfolio"]);
      assert.equal(code, 1);
      const json = parseJSON(stderr);
      assert.ok(json);
      assert.equal(json.error.code, "missing_wallet");
    });

    it("wallet analyze with no address → missing_wallet, exit 1", async () => {
      const { code, stderr } = await run(["wallet", "analyze"]);
      assert.equal(code, 1);
      const json = parseJSON(stderr);
      assert.ok(json);
      assert.equal(json.error.code, "missing_wallet");
    });

    it("wallet unknownAction 0xABC → help, exit 1", async () => {
      const { code, stdout } = await run(["wallet", "unknownAction", "0xABC"]);
      assert.equal(code, 1);
      const json = parseJSON(stdout);
      assert.ok(json);
      assert.equal(json.name, "zerion-cli");
    });

    it("chains list without API key → missing_api_key, exit 1", async () => {
      const { code, stderr } = await run(["chains", "list"]);
      assert.equal(code, 1);
      const json = parseJSON(stderr);
      assert.ok(json);
      assert.equal(json.error.code, "missing_api_key");
    });

    it("chains with no action → help, exit 1", async () => {
      const { code, stdout } = await run(["chains"]);
      assert.equal(code, 1);
      const json = parseJSON(stdout);
      assert.ok(json);
      assert.equal(json.name, "zerion-cli");
    });

    it("foo bar → help, exit 1", async () => {
      const { code, stdout } = await run(["foo", "bar"]);
      assert.equal(code, 1);
      const json = parseJSON(stdout);
      assert.ok(json);
      assert.equal(json.name, "zerion-cli");
    });

    it("wallet positions 0xABC --positions (bare) → missing_positions_value, exit 1", async () => {
      const { code, stderr } = await run(["wallet", "positions", "0xABC", "--positions"]);
      assert.equal(code, 1);
      const json = parseJSON(stderr);
      assert.ok(json);
      assert.equal(json.error.code, "missing_positions_value");
    });

    it("wallet positions 0xABC --positions bogus → unsupported_positions_filter, exit 1", async () => {
      const { code, stderr } = await run(["wallet", "positions", "0xABC", "--positions", "bogus"]);
      assert.equal(code, 1);
      const json = parseJSON(stderr);
      assert.ok(json);
      assert.equal(json.error.code, "unsupported_positions_filter");
    });

    it("wallet positions 0xABC --chain invalidchain without API key → missing_api_key", async () => {
      // ensureKey() runs before validateChain in request(), so missing key errors first
      const { code, stderr } = await run(["wallet", "positions", "0xABC", "--chain", "ethereum"]);
      assert.equal(code, 1);
      const json = parseJSON(stderr);
      assert.ok(json);
      assert.equal(json.error.code, "missing_api_key");
    });
  });

  describe("output format", () => {
    it("all error outputs are valid JSON on stderr", async () => {
      const errorCases = [
        ["wallet", "portfolio"],         // missing_wallet
        ["chains", "list"],              // missing_api_key
      ];

      for (const args of errorCases) {
        const { stderr } = await run(args);
        if (stderr.trim()) {
          const json = parseJSON(stderr);
          assert.ok(json, `Invalid JSON on stderr for args: ${args.join(" ")}`);
          assert.ok(json.error, `Missing error key for args: ${args.join(" ")}`);
        }
      }
    });

    it("help output is valid JSON on stdout with required keys", async () => {
      const { stdout } = await run([]);
      const json = parseJSON(stdout);
      assert.ok(json);
      assert.ok(json.name);
      assert.ok(json.usage);
      assert.ok(json.env);
    });
  });
});
