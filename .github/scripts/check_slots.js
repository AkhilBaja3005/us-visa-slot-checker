// Standalone slot checker for GitHub Actions
// Reads credentials from environment variables (GitHub Secrets)

const API_KEY = process.env.CHECK_VISA_SLOTS_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const OFC_CITIES = [
  "CHENNAI VAC",
  "HYDERABAD VAC",
  "KOLKATA VAC",
  "MUMBAI VAC",
  "NEW DELHI VAC"
];

const OFC_SCHEDULE_URL = "https://usvisascheduling.com/en-US/ofc-schedule/";

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[Telegram] Credentials missing, skipping alert.");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" })
  });
  if (res.ok) {
    console.log("[Telegram] Alert sent successfully.");
  } else {
    const text = await res.text();
    console.error(`[Telegram] Failed: ${text}`);
  }
}

async function checkSlots() {
  if (!API_KEY) {
    console.error("ERROR: CHECK_VISA_SLOTS_API_KEY secret is not set.");
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Querying CheckVisaSlots API...`);

  const url = "https://app.checkvisaslots.com/slots/v3";
  const headers = {
    "x-api-key": API_KEY,
    "extversion": "4.7.0.2",
    "origin": "chrome-extension://beepaenfejnphdgnkmccjcfiieihhogl",
    "accept": "*/*",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
  };

  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    const text = await response.text();
    console.error(`API Error ${response.status}: ${text}`);

    // If we get 403 even on GitHub Actions, report it via Telegram once
    if (response.status === 403) {
      console.log("GitHub Actions IP is blocked by AWS WAF. Cannot bypass without residential proxy.");
    }
    process.exit(1);
  }

  const data = await response.json();
  const slotDetails = data.slotDetails || [];
  const remaining = data.userActivity?.remaining;

  console.log(`Credits remaining: ${remaining}`);

  // Check each configured city
  const foundSlots = [];
  for (const city of OFC_CITIES) {
    const cityDetail = slotDetails.find(
      d => d.visa_location.toUpperCase() === city.toUpperCase()
    );
    if (cityDetail && cityDetail.slots > 0) {
      foundSlots.push(
        `✅ ${city} — ${cityDetail.slots} slot(s) from ${cityDetail.start_date || "N/A"}`
      );
    }
  }

  const timeStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  if (foundSlots.length > 0) {
    console.log("SLOTS FOUND:", foundSlots);
    const msg = `🚨 <b>US Visa OFC Slots Available!</b>\n\n${foundSlots.join("\n")}\n\n🕐 ${timeStr} IST\n👉 <a href="${OFC_SCHEDULE_URL}">Book Now</a>`;
    await sendTelegram(msg);
  } else {
    console.log("No slots available across all monitored cities.");
  }

  // Send low-credit warning if below 100
  if (typeof remaining === "number" && remaining < 100) {
    console.warn(`Low credits: ${remaining} remaining!`);
    await sendTelegram(
      `⚠️ <b>API Credits Low</b>\n\nOnly <b>${remaining}</b> CheckVisaSlots credits left.\nPlease log in on your laptop and contribute screenshots to recharge!`
    );
  }
}

checkSlots().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
