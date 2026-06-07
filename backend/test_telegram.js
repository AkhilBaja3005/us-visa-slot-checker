const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');

function testTelegram() {
  if (!fs.existsSync(configPath)) {
    console.error(`Error: config.json not found at ${configPath}`);
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = config.telegramToken;
  const chatId = config.telegramChatId;

  if (!token || !chatId) {
    console.error("Error: Telegram bot token or Chat ID is missing in config.json.");
    return;
  }

  console.log(`Using Telegram Token: ${token.substring(0, 10)}...`);
  console.log(`Using Chat ID: ${chatId}`);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: `🚨 <b>US Visa Notification System</b> 🚨\n\n✅ Your Telegram Bot notification channel has been successfully verified!\n🕐 Verified at: ${new Date().toLocaleString()}`,
    parse_mode: 'HTML'
  };

  console.log("Sending verification request to Telegram Bot API...");
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(res => {
    if (res.ok) {
      console.log("🚀 SUCCESS: Test notification sent successfully! Check your Telegram chat.");
    } else {
      res.text().then(text => {
        console.error(`❌ FAILED: Telegram server returned status ${res.status}. Response: ${text}`);
        console.error("Please ensure that you have clicked 'Start' in the chat with your bot on Telegram.");
      });
    }
  })
  .catch(err => {
    console.error(`❌ CONNECTION ERROR: Failed to reach Telegram API: ${err.message}`);
  });
}

testTelegram();
