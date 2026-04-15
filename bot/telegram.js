import TelegramBot from "node-telegram-bot-api";
import { getPortfolio, getTopPositions } from "../services/zerion.js";
import { evaluatePortfolio } from "../utils/engine.js";

const token = process.env.TELEGRAM_TOKEN || "8600988454:AAFw7IwkGGw-wzaGjdxMD9k3GXwG-WPygpM";
if (!token) throw new Error("TELEGRAM_TOKEN is required in .env");

const bot = new TelegramBot(token, { polling: true });

function sendMainMenu(chatId) {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Portfolio", callback_data: "portfolio" }],
        [{ text: "⚙️ Policies", callback_data: "policies" }],
        [{ text: "🤖 Run Agent", callback_data: "run_agent" }],
        [{ text: "🛡️ Protection Mode", callback_data: "protection_mode" }],
        [{ text: "📜 Activity Log", callback_data: "activity_log" }],
      ],
    },
  };

  bot.sendMessage(chatId, "👋 Welcome to **Sentinel** — Your Onchain Portfolio Guardian.", {
    parse_mode: "Markdown",
    ...opts,
  });
}

bot.onText(/\/start/, (msg) => {
  sendMainMenu(msg.chat.id);
});

// Handle Policy Type Selection + Ask for Value
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  await bot.answerCallbackQuery(callbackQuery.id);

  try {
    switch (data) {
      case "portfolio":
        await handlePortfolio(chatId);
        break;

      case "policies":
        await handlePolicies(chatId);
        break;

      case "add_policy":
        await handleAddPolicy(chatId);
        break;

      case "policy_alloc":
        await bot.sendMessage(chatId, "Enter max allocation % per asset (e.g. 40):");
        bot.once("message", async (msg) => {
          if (msg.chat.id === chatId) {
            const value = msg.text.trim();
            addPolicy(chatId, "allocation", value, `Max ${value}% per asset`);
            await bot.sendMessage(chatId, `✅ Allocation Limit set to ${value}%`);
            await handlePolicies(chatId);   // Refresh menu
          }
        });
        break;

      case "policy_spend":
        await bot.sendMessage(chatId, "Enter daily spend limit in USD (e.g. 100):");
        bot.once("message", async (msg) => {
          if (msg.chat.id === chatId) {
            const value = msg.text.trim();
            addPolicy(chatId, "spend_limit", value, `Max $${value} per day`);
            await bot.sendMessage(chatId, `✅ Daily Spend Limit set to $${value}`);
            await handlePolicies(chatId);
          }
        });
        break;

      case "policy_chain":
        await bot.sendMessage(chatId, "Enter allowed chains (comma separated, e.g. base,solana,ethereum):");
        bot.once("message", async (msg) => {
          if (msg.chat.id === chatId) {
            const value = msg.text.trim().toLowerCase();
            addPolicy(chatId, "chain_lock", value, `Allowed: ${value}`);
            await bot.sendMessage(chatId, `✅ Chain Lock set to: ${value}`);
            await handlePolicies(chatId);
          }
        });
        break;

      case "policy_emergency":
        await bot.sendMessage(chatId, "Enter portfolio drop % that triggers protection (e.g. 10):");
        bot.once("message", async (msg) => {
          if (msg.chat.id === chatId) {
            const value = msg.text.trim();
            addPolicy(chatId, "emergency", value, `Auto-protect on >${value}% drop`);
            await bot.sendMessage(chatId, `✅ Emergency Protection set to ${value}% drop`);
            await handlePolicies(chatId);
          }
        });
        break;

      case "main_menu":
        sendMainMenu(chatId);
        break;

      case "protection_mode":
        await handleProtectionMode(chatId);
        break;

      case "toggle_protection":
        await toggleProtectionMode(chatId);
        break;

      case "run_agent":
        await runAgent(chatId);
        break;

      case "execute_fix":
        await executeFix(chatId);
        break;

      default:
        // Keep your other cases (run_agent, protection_mode, etc.)
        if (data === "run_agent" || data === "protection_mode" || data === "activity_log") {
          // your existing code...
        }
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Something went wrong.");
  }
});

// Portfolio Handler (with better formatting)
async function handlePortfolio(chatId) {
  //   const address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // TODO: make dynamic later
  const address = "0x9dCFF04fafC8e7cAC8c0A70DB61f2E33166dDFB6"; // TODO: make dynamic later

  try {
    const rawData = await getPortfolio(address);

    const positionCount = rawData.positions?.count || 0;

    // Total value is often unreliable when many tokens have null value
    let totalValueStr = "N/A";
    if (rawData.portfolio?.total != null) {
      totalValueStr = `$${Number(rawData.portfolio.total).toLocaleString()}`;
    }

    const topPositions = getTopPositions(rawData, 10);

    let message = `💼 **Sentinel Portfolio Overview**\n\n`;
    message += `**Wallet**: \`${address.slice(0, 8)}...${address.slice(-6)}\`\n`;
    message += `**Total Positions**: ${positionCount}\n`;
    message += `**Estimated Value**: ${totalValueStr}\n\n`;

    if (topPositions.length > 0) {
      message += `**Top Holdings** (showing first ${topPositions.length})\n\n`;

      topPositions.forEach((pos, i) => {
        const valueStr = pos.valueUsd !== null
          ? ` ≈ $${pos.valueUsd.toLocaleString()}`
          : " (no USD value)";

        message += `${i + 1}. **${pos.symbol}** — ${pos.quantity.toLocaleString()} ${pos.name}${valueStr}\n`;
      });
    } else {
      message += "⚠️ No positions found or all have zero value.\n";
    }

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

    if (topPositions.length > 1) {
      await sendSimplePieChart(chatId, topPositions);
    }

  } catch (error) {
    console.error(error);
    await bot.sendMessage(chatId, `❌ Error loading portfolio:\n${error.message}`);
  }
}
// Get policies from DB
function getCurrentPolicies(chatId) {
  const stmt = global.db.prepare(`
    SELECT type, value, description 
    FROM policies 
    WHERE chat_id = ? AND active = 1 
    ORDER BY created_at DESC
  `);
  return stmt.all(chatId);
}
// Save a new policy
function addPolicy(chatId, type, value, description) {
  // Ensure user exists first
  global.db.prepare(`
    INSERT OR IGNORE INTO users (chat_id) VALUES (?)
  `).run(chatId);

  // Now insert policy
  const stmt = global.db.prepare(`
    INSERT INTO policies (chat_id, type, value, description)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(chatId, type, value, description);
}
// Handle Policies Menu
async function handlePolicies(chatId) {
  const policies = getCurrentPolicies(chatId);

  let text = `⚙️ *Your Sentinel Policies*\n\n`;

  if (policies.length === 0) {
    text += "No policies set yet\\. Protect your portfolio by adding rules\\.";
  } else {
    text += "Active Policies:\n\n";
    policies.forEach((p, i) => {
      // Escape special MarkdownV2 characters
      const safeType = escapeMarkdownV2(p.type);
      const safeDesc = escapeMarkdownV2(p.description);
      const safeValue = escapeMarkdownV2(p.value);

      text += `${i + 1}\\. *${safeType}*\n`;
      text += `   ${safeDesc} \\(Value: ${safeValue}\\)\n\n`;
    });
  }

  const opts = {
    parse_mode: "MarkdownV2",           // ← Changed to V2
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Add New Policy", callback_data: "add_policy" }],
        [{ text: "🔙 Back to Menu", callback_data: "main_menu" }]
      ]
    }
  };

  await bot.sendMessage(chatId, text, opts);
}
// Add Policy Flow
async function handleAddPolicy(chatId) {
  await bot.sendMessage(chatId, "➕ **Choose Policy Type**:", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Allocation Limit (Max % per asset)", callback_data: "policy_alloc" }],
        [{ text: "Spend Limit (Max $ per day)", callback_data: "policy_spend" }],
        [{ text: "Chain Lock (Allowed chains)", callback_data: "policy_chain" }],
        [{ text: "Emergency Protection (% drop trigger)", callback_data: "policy_emergency" }],
        [{ text: "🔙 Back", callback_data: "policies" }]
      ]
    }
  });
}
// ====================== PROTECTION MODE ======================
async function handleProtectionMode(chatId) {
  // Get current status from DB
  let user = global.db.prepare("SELECT protection_mode FROM users WHERE chat_id = ?")
    .get(chatId);

  if (!user) {
    // Create user record if not exists
    global.db.prepare("INSERT OR IGNORE INTO users (chat_id) VALUES (?)").run(chatId);
    user = { protection_mode: 0 };
  }

  const isOn = user.protection_mode === 1;

  const text = `🛡️ **Protection Mode**\n\n` +
    `Status: **${isOn ? 'ON' : 'OFF'}**\n\n` +
    (isOn
      ? "Emergency protection is active.\nIf portfolio drops significantly, Sentinel will automatically move to stablecoins (within your policies)."
      : "Protection is disabled. Agent will only suggest actions.");

  const opts = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{
          text: isOn ? "🔴 Turn OFF" : "🟢 Turn ON",
          callback_data: "toggle_protection"
        }],
        [{ text: "🔙 Back to Menu", callback_data: "main_menu" }]
      ]
    }
  };

  await bot.sendMessage(chatId, text, opts);
}
// Toggle Protection Mode
async function toggleProtectionMode(chatId) {
  // Ensure user exists
  global.db.prepare("INSERT OR IGNORE INTO users (chat_id) VALUES (?)").run(chatId);

  // Toggle the value
  global.db.prepare(`
    UPDATE users 
    SET protection_mode = 1 - protection_mode 
    WHERE chat_id = ?
  `).run(chatId);

  await bot.sendMessage(chatId, "✅ Protection Mode updated successfully!");
  await handleProtectionMode(chatId);   // Refresh the screen
}
async function runAgent(chatId) {
  // const address = "0x9dCFF04fafC8e7cAC8c0A70DB61f2E33166dDFB6";
  const address = "0x4d224452801ACEd8B2F0aebE155379bb5D594381";

  await bot.sendMessage(chatId, "🤖 Running Sentinel Agent...");

  try {
    const portfolio = await getPortfolio(address);
    console.log("Portfolio fetched for agent:",portfolio);
    const policies = getCurrentPolicies(chatId);

    const actions = evaluatePortfolio(portfolio, policies);

    if (actions.length === 0) {
      await bot.sendMessage(chatId, "✅ No policy violations. Portfolio is healthy.");
      return;
    }

    // Show first violation (keep demo simple)
    const action = actions[0];

    const message = `
🚨 *Policy Violation Detected*

Asset: *${action.asset}*
Current: ${action.current}%
Limit: ${action.limit}%

💡 Suggested Action:
${action.suggestion}
`;

    await bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚡ Execute Fix", callback_data: "execute_fix" }],
          [{ text: "❌ Ignore", callback_data: "main_menu" }]
        ]
      }
    });

  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, "❌ Agent failed to run.");
  }
}


async function executeFix(chatId) {
  await bot.sendMessage(chatId, "🚀 Executing rebalance...");

  // For now: FAKE execution (demo)
  await bot.sendMessage(chatId, `
✅ Swap executed

ETH → USDC
Amount: $1.20
  `);

}

function logActivity(chatId, action, details) {
  global.db.prepare(`
    INSERT INTO activity_log (chat_id, action, details)
    VALUES (?, ?, ?)
  `).run(chatId, action, details);
}
function escapeMarkdownV2(text) {
  if (!text) return "";
  return text
    .replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');   // Escape all special MarkdownV2 chars
}

// Add this helper at the top of bot.js (or in a utils file)
function encodeChartConfig(config) {
  return encodeURIComponent(JSON.stringify(config));
}
// Improved chart function
async function sendSimplePieChart(chatId, positions) {
  if (positions.length < 2) {
    return; // Skip chart if too few items
  }

  try {
    // Build clean Chart.js config
    const chartConfig = {
      type: 'pie',
      data: {
        labels: positions.map(p => p.symbol || p.name),
        datasets: [{
          data: positions.map(p => Math.max(p.quantity, 0.01)), // avoid zero
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
          ]
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Top Holdings by Quantity'
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    };

    // Properly encoded QuickChart URL
    const encodedConfig = encodeChartConfig(chartConfig);
    const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}`;

    // Send with explicit options (more reliable than just passing string)
    await bot.sendPhoto(chatId, chartUrl, {
      caption: "📊 Allocation by Quantity (Top 10)",
      parse_mode: "Markdown"
    });

    console.log("Chart sent successfully");
  } catch (err) {
    console.error("Chart sending failed:", err.message);
    // Fallback: send a message instead of crashing
    await bot.sendMessage(chatId, "📊 Could not generate chart right now (too many tokens).");
  }
}

export default bot;