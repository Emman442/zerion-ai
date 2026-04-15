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

// Improved extractor - show positions even if value is null
export function getTopPositions(rawData, limit = 10) {
  const top = rawData?.positions?.top || [];

  return top
    .slice(0, limit)  // don't filter displayable too strictly for now
    .map((pos) => {
      const attr = pos?.attributes || {};
      const fungible = attr.fungible_info || {};
      const quantity = attr.quantity?.float || 0;

      return {
        name: fungible.name || "Unknown Token",
        symbol: fungible.symbol || "???",
        quantity: Number(quantity.toFixed(6)), // clean number
        valueUsd: attr.value?.usd ?? null,
        price: attr.price ?? 0,
        chain: pos.relationships?.chain?.data?.id || "ethereum",
        displayable: attr.flags?.displayable !== false
      };
    });
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

