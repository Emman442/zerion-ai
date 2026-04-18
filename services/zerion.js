import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) return reject(error);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout);
      }
    });
  });
}

export async function getPortfolio(address) {
  try {
    const { stdout } = await execAsync(
      `npx zerion-cli wallet analyze ${address} --json`
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error("Zerion CLI Error:", error.stderr || error.message);
    throw new Error("Failed to fetch portfolio");
  }
}


// services/zerion.js
export function getTopPositions(rawData, limit = 10) {
  const top = rawData?.positions?.top || [];

  return top
    .slice(0, limit)
    .map((pos) => ({
      name: pos.name || "Unknown Token",
      symbol: pos.symbol || "???",
      quantity: Number(pos.quantity) || 0,
      valueUsd: Number(pos.value) || null,
      chain: pos.chain || "ethereum"
    }))
    .filter(pos => pos.quantity > 0);
}

export async function executeSwap({ from, to, amount, chain }) {
  const command = `
    npx zerion-cli wallet swap \
    --from ${from} \
    --to ${to} \
    --amount ${amount} \
    --chain ${chain}
  `;

  return await runCommand(command);
}

