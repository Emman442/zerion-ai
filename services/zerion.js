import { exec } from "child_process";

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
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
  return await runCommand(
    `npx zerion-cli wallet analyze ${address}`
  );
}