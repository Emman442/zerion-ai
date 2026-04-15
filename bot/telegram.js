import TelegramBot from "node-telegram-bot-api";
import { getPortfolio } from "../services/zerion.js";

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

console.log(process.env.TELEGRAM_TOKEN);

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to Sentinel\n\n[📊 Portfolio]",
    {
      reply_markup: {
        keyboard: [["📊 Portfolio"], ["🤖 Run Agent"]],
      },
    }
  );
});

bot.onText(/📊 Portfolio/, async (msg) => {
  const data = await getPortfolio("YOUR_ADDRESS");

  bot.sendMessage(
    msg.chat.id,
    `💼 Portfolio\nPositions: ${data.positions.count}`
  );
});

export default bot;