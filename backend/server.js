const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { chromium } = require('patchright');

// Cache variable to avoid redundant Supabase updates for slots_detected status
let cachedSlotsDetected = null;

// Initialize Supabase if credentials are provided
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: {
        transport: ws
      }
    }) 
  : null;

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Paths
const rootDir = process.env.WORKSPACE_DIR || path.join(__dirname, '..');
const configPath = path.join(rootDir, 'config.json');
const historyPath = path.join(rootDir, 'history.json');
const logFilePath = path.join(rootDir, 'app.log');

// Global configuration state
let config = {
  engine: "api", // "browser" or "api"
  telegramToken: "",
  telegramChatId: "",
  applicantName: "",
  checkIntervalSeconds: 180,
  loginTimeoutSeconds: 600,
  checkVisaSlotsApiKey: "",
  ofcCities: [
    "CHENNAI VAC",
    "HYDERABAD VAC",
    "KOLKATA VAC",
    "MUMBAI VAC",
    "NEW DELHI VAC",
    "CHENNAI",
    "HYDERABAD",
    "KOLKATA",
    "MUMBAI",
    "NEW DELHI"
  ],
  isActive: true,
  portalUsername: "",
  portalPassword: "",
  proxyUrl: "",
  captchaApiKey: "",
  googleClientId: "",
  googleClientSecret: "",
  securitySchool: "",
  securityCar: "",
  securityJob: "",
  securityFood: "",
  allowedEmails: {},
  clearBrowserProfileOnStart: false,
  jwtSecret: ""
};

// Global monitor state
let monitorState = {
  status: "stopped", // "stopped", "starting", "awaiting_login", "running", "awaiting_relogin", "error"
  lastCheckTime: null,
  availableSlots: {}, // { "MUMBAI VAC": false, ... }
  errors: [],
  lowCreditWarningSent: false,
  lastLowCreditAlertTime: 0,
  apiCreditsRemaining: null
};

let lastOFCPageRefreshTime = 0;

// Log Message Helper
function logMsg(message) {
  const ts = new Date().toLocaleString();
  const line = `[${ts}] ${message}\n`;
  try {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        fs.writeFileSync(logFilePath, `[${ts}] Log file cleared as it exceeded 10MB limit.\n`);
      }
    }
    fs.appendFileSync(logFilePath, line);
  } catch (err) {
    console.error("Failed to write to app.log:", err);
  }
  console.log(line.trim());
}

// Load configurations
async function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      config = { ...config, ...JSON.parse(data) };
      logMsg("Local configuration loaded successfully.");
    } catch (err) {
      logMsg(`Error parsing local config.json: ${err.message}`);
    }
  }

  if (supabase) {
    try {
      const { data: dbData, error } = await supabase
        .from('us_visa_config')
        .select('data')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (dbData && dbData.data) {
        let rawData = dbData.data;
        if (typeof rawData === 'string') {
          try { rawData = JSON.parse(rawData); } catch (e) {}
        }
        const dbConfigData = { ...rawData };
        delete dbConfigData.engine; // Ignore engine from Supabase
        config = { ...config, ...dbConfigData };
        logMsg("Configuration loaded from Supabase (ignoring engine field).");
      } else {
        logMsg("No configuration found in Supabase. Creating one with current config.");
        await saveConfig();
      }
    } catch (err) {
      logMsg(`Error loading config from Supabase: ${err.message}`);
    }
  } else if (!fs.existsSync(configPath)) {
    await saveConfig();
  }

  // Override configuration values with environment variables if present (for cloud deployment)
  if (process.env.ENGINE) config.engine = process.env.ENGINE;
  if (process.env.TELEGRAM_TOKEN) config.telegramToken = process.env.TELEGRAM_TOKEN;
  if (process.env.TELEGRAM_CHAT_ID) config.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (process.env.CHECK_VISA_SLOTS_API_KEY) config.checkVisaSlotsApiKey = process.env.CHECK_VISA_SLOTS_API_KEY;
  if (process.env.PORTAL_USERNAME) config.portalUsername = process.env.PORTAL_USERNAME;
  if (process.env.PORTAL_PASSWORD) config.portalPassword = process.env.PORTAL_PASSWORD;
  if (process.env.APPLICANT_NAME) config.applicantName = process.env.APPLICANT_NAME;
  config.checkIntervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS) || config.checkIntervalSeconds || 180;
  if (process.env.OFC_CITIES) {
    config.ofcCities = process.env.OFC_CITIES.split(',').map(c => c.trim());
  }
  if (process.env.PROXY_URL) config.proxyUrl = process.env.PROXY_URL;
  if (process.env.CAPTCHA_API_KEY) config.captchaApiKey = process.env.CAPTCHA_API_KEY;
  if (process.env.GOOGLE_CLIENT_ID) config.googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (process.env.GOOGLE_CLIENT_SECRET) config.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // Generate a JWT secret if not present and save it to config.json
  if (!config.jwtSecret) {
    config.jwtSecret = crypto.randomBytes(32).toString('hex');
    await saveConfig();
  }

  // Respect environmental override of isActive if explicitly provided
  if (process.env.IS_ACTIVE !== undefined) {
    config.isActive = process.env.IS_ACTIVE === "true";
  }
}

async function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    logMsg("Configuration saved to config.json.");
  } catch (err) {
    logMsg(`Error saving config.json: ${err.message}`);
  }

  if (supabase) {
    try {
      // Omit sensitive local-only portal login credentials and security questions from Supabase
      const dbConfig = { ...config };
      dbConfig.engine = "api"; // Force engine to be "api" in Supabase
      delete dbConfig.portalUsername;
      delete dbConfig.portalPassword;
      delete dbConfig.securitySchool;
      delete dbConfig.securityCar;
      delete dbConfig.securityJob;
      delete dbConfig.securityFood;

      const { error } = await supabase
        .from('us_visa_config')
        .upsert({ id: 1, data: dbConfig, updated_at: new Date().toISOString() });
      if (error) throw error;
      logMsg("Configuration saved to Supabase.");
    } catch (err) {
      logMsg(`Error saving config to Supabase: ${err.message}`);
    }
  }
}

// Load and Save History
let historyLogs = [];
async function loadHistory() {
  if (fs.existsSync(historyPath)) {
    try {
      const data = fs.readFileSync(historyPath, 'utf8');
      historyLogs = JSON.parse(data);
      logMsg("Local history loaded successfully.");
    } catch (err) {
      logMsg(`Error parsing history.json: ${err.message}`);
    }
  }
}

async function saveHistory(record) {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(historyLogs.slice(-1000), null, 2), 'utf8');
  } catch (err) {
    logMsg(`Error saving history.json: ${err.message}`);
  }
}

// ── Notification Helpers ───────────────────────────────────────────────────

function sendTelegram(message, token, chatId) {
  let targetChatId = chatId;

  if (process.env.DEV_MODE === "true") {
    logMsg(`[Telegram] [DEV_MODE] Overriding target chatId to dev group ID (-5238646343).`);
    targetChatId = "-5238646343";
  }

  if (!token || !targetChatId || token.includes("YOUR_") || targetChatId.includes("YOUR_")) {
    logMsg("[Telegram] Alert skipped (credentials not configured).");
    return;
  }
  
  // Custom prefix based on engine to avoid confusion
  let prefixedMessage = message;
  if (config.engine === "only_login") {
    prefixedMessage = `🔑 <b>[Login Only]</b> ${message}`;
  } else if (config.engine === "browser") {
    prefixedMessage = `🌐 <b>[Browser Auto]</b> ${message}`;
  } else if (config.engine === "api") {
    prefixedMessage = `☁️ <b>[API Monitor]</b> ${message}`;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: prefixedMessage,
      parse_mode: "HTML"
    })
  })
  .then(res => {
    if (!res.ok) throw new Error(`Status ${res.status}`);
    logMsg("[Telegram] Notification sent successfully.");
  })
  .catch(err => logMsg(`[Telegram] Send error: ${err.message}`));
}

function sendEmail(subject, text, mailConfig) {
  // SMTP email notifications disabled
}

function triggerDesktopNotification(title, message) {
  const escapedMessage = message.replace(/'/g, "\\'");
  const escapedTitle = title.replace(/'/g, "\\'");
  const cmd = `osascript -e 'display notification "${escapedMessage}" with title "${escapedTitle}" sound name "Glass"'`;
  exec(cmd, (err) => {
    if (err) {
      logMsg(`[Desktop Alert] Error: ${err.message}`);
    } else {
      logMsg(`[Desktop Alert] Triggered: ${title} -> ${message}`);
    }
  });
}

// ── Browser Engine Logic (Patchright) ───────────────────────────────────────

const HOME_URL = "https://www.usvisascheduling.com/en-US/";
const OFC_SCHEDULE_URL = "https://www.usvisascheduling.com/en-US/ofc-schedule/";
const LOGIN_DOMAIN = "atlasauth.b2clogin.com";

let caffeinateProcess = null;
let activeBrowser = null;
let activeContext = null;
let activePage = null;
let loginCheckPromise = null;

async function cleanupBrowser() {
  logMsg("Cleaning up active browser session...");
  try {
    if (activePage) {
      await activePage.close().catch(() => {});
      activePage = null;
    }
    if (activeContext) {
      await activeContext.close().catch(() => {});
      activeContext = null;
    }
    if (activeBrowser) {
      await activeBrowser.close().catch(() => {});
      activeBrowser = null;
    }
    logMsg("Cleanup completed.");
  } catch (err) {
    logMsg(`Error during browser cleanup: ${err.message}`);
  }
}

async function isSessionAlive(page) {
  try {
    logMsg("Loading OFC page to test session validity...");
    await page.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    const hostname = await page.evaluate(() => window.location.hostname);
    return !hostname.includes(LOGIN_DOMAIN);
  } catch (error) {
    logMsg(`Session alive test failed: ${error.message}`);
    return false;
  }
}

async function humanType(locator, text) {
  try {
    await locator.click({ delay: Math.floor(Math.random() * 100) + 50 });
    await locator.focus();
    await locator.clear().catch(() => {});
    await locator.pressSequentially(text, { delay: Math.floor(Math.random() * 50) + 40 });
    await locator.dispatchEvent('input').catch(() => {});
    await locator.dispatchEvent('change').catch(() => {});
    await locator.evaluate(el => el.blur()).catch(() => {});
  } catch (err) {
    await locator.fill(text);
    await locator.dispatchEvent('input').catch(() => {});
    await locator.dispatchEvent('change').catch(() => {});
  }
}

async function solveImageCaptcha(page, apiKey) {
  if (!apiKey || apiKey.includes("YOUR_")) return null;
  try {
    const captchaImg = page.locator('img[src*="captcha" i], img[src*="Captcha" i], img[id*="captcha" i], img[class*="captcha" i]').first();
    if (await captchaImg.count() > 0 && await captchaImg.isVisible()) {
      logMsg("CAPTCHA image detected. Attempting to solve via 2Captcha...");
      const imgBase64 = await captchaImg.screenshot({ type: 'jpeg' }).then(buf => buf.toString('base64'));
      
      const submitRes = await fetch("https://2captcha.com/in.php", {
        method: "POST",
        body: new URLSearchParams({
          key: apiKey,
          method: "base64",
          body: imgBase64,
          json: 1
        })
      });
      const submitData = await submitRes.json();
      if (submitData.status !== 1) {
        throw new Error(`2Captcha submission failed: ${submitData.request}`);
      }
      
      const captchaId = submitData.request;
      logMsg(`CAPTCHA submitted successfully. ID: ${captchaId}. Waiting for solution...`);
      
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const checkRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
        const checkData = await checkRes.json();
        if (checkData.status === 1) {
          logMsg(`CAPTCHA solved: ${checkData.request}`);
          return checkData.request;
        }
        if (checkData.request !== "CAPCHA_NOT_READY") {
          throw new Error(`2Captcha error: ${checkData.request}`);
        }
      }
      throw new Error("CAPTCHA solve timeout");
    }
  } catch (err) {
    logMsg(`Failed to solve CAPTCHA: ${err.message}`);
  }
  return null;
}

async function checkCity(page, city, shouldLoadPage = false, applicantName = "") {
  try {
    logMsg(`Selecting consulate: ${city}`);
    if (shouldLoadPage) {
      await page.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1000);

      // If an applicant name is specified, click their checkbox row
      if (applicantName && applicantName.trim()) {
        const applicantRow = page.locator(`text=${applicantName}`);
        if (await applicantRow.count() > 0) {
          logMsg(`Clicking applicant row: ${applicantName}`);
          await applicantRow.first().click();
          await page.waitForTimeout(500);
        }
      }
    }

    const dropdown = page.locator("select");
    await dropdown.waitFor({ state: "visible", timeout: 15000 });
    
    // Prepare network response promise to ensure page data updates
    const responsePromise = page.waitForResponse(
      response => response.url().toLowerCase().includes('schedule'),
      { timeout: 5000 }
    ).catch(() => null);

    // Select dropdown option
    await dropdown.selectOption({ label: city });
    
    // Wait for the API response or fallback to timeout
    const resp = await responsePromise;
    if (!resp) {
      await page.waitForTimeout(1500);
    } else {
      await page.waitForTimeout(500); // Small DOM render buffer
    }

    // Dynamically wait (up to 4.5 seconds) for either "No Slots Available" banner or calendar elements
    try {
      await Promise.race([
        page.locator("text=No Slots Available").waitFor({ state: "visible", timeout: 4500 }),
        page.locator("input[type='date'], input[placeholder*='MM/DD/YYYY'], table.calendar, td.available, a.ui-state-default").waitFor({ state: "visible", timeout: 4500 })
      ]);
    } catch (e) {
      // Fallback delay if waiting dynamically timed out
      await page.waitForTimeout(1000);
    }

    // Look for "No Slots Available" banner
    const noSlots = page.locator("text=No Slots Available");
    if (await noSlots.count() > 0) {
      logMsg(`[${city}] Scan result: No slots available`);
      return false;
    }

    // Look for calendar or slot date elements
    const dateInput = page.locator("input[type='date'], input[placeholder*='MM/DD/YYYY'], table.calendar, td.available, a.ui-state-default");
    if (await dateInput.count() > 0) {
      logMsg(`[${city}] Scan result: SLOTS AVAILABLE!`);
      return true;
    }

    logMsg(`[${city}] Scan result: Uncertain (no clear indicators found)`);
    return null; // Uncertain
  } catch (err) {
    logMsg(`[${city}] Check error: ${err.message}`);
    return null;
  }
}

async function handleAutoLoginHelper(page) {
  try {
    const url = page.url();
    if (url.includes(LOGIN_DOMAIN)) {


      // 1. Detect if we are on the security questions page.
      // Since security answers are often password inputs, standard page.locator('input[type="password"]')
      // might match them. We check for paragraphs/labels containing typical security questions
      // or inputs ending in '_response', or we check if there are multiple password inputs.
      const isSecurityPage = await page.evaluate(() => {
        const hasQuestionsList = document.querySelectorAll('#attributeList li.Paragraph p.textInParagraph').length > 0;
        const hasResponseInputs = document.querySelectorAll('input[id$="_response"], input[id*="response" i], input[id*="kba" i], input[id*="kbq" i], input[id*="Security" i]').length > 0;
        return hasQuestionsList || hasResponseInputs;
      }).catch(() => false);

      if (isSecurityPage) {
        logMsg("Security questions page detected. Autofilling visible questions...");

        const matchQuestion = (text) => {
          const lower = text.toLowerCase();
          if (lower.includes("school") || lower.includes("education") || lower.includes("college") || lower.includes("study")) {
            return config.securitySchool;
          } else if (lower.includes("car") || lower.includes("vehicle") || lower.includes("automobile") || lower.includes("drive")) {
            return config.securityCar;
          } else if (lower.includes("job") || lower.includes("work") || lower.includes("profession") || lower.includes("employer") || lower.includes("occupation") || lower.includes("company") || lower.includes("city or town")) {
            return config.securityJob;
          } else if (lower.includes("food") || lower.includes("dish") || lower.includes("eat") || lower.includes("restaurant")) {
            return config.securityFood;
          }
          return "";
        };

        const getQuestionTextForInput = async (rLocator) => {
          return await rLocator.evaluate(el => {
            if (el.id) {
              const label = document.querySelector(`label[for="${el.id}"]`);
              if (label && label.innerText.trim()) return label.innerText.trim();
              const labelById = document.getElementById(el.id + '_label') || 
                                document.getElementById(el.id.replace('response', 'question')) || 
                                document.getElementById(el.id.replace('response', 'question_label')) || 
                                document.getElementById(el.id.replace('response', 'ReadOnly')) ||
                                document.getElementById(el.id.replace('response', 'aReadOnly')) ||
                                document.getElementById(el.id.replace('response', 'ReadOnly_label')) ||
                                document.getElementById(el.id.replace('response', 'aReadOnly_label')) ||
                                document.getElementById(el.id + 'ReadOnly') ||
                                document.getElementById(el.id + 'aReadOnly');
              if (labelById && labelById.innerText.trim()) return labelById.innerText.trim();
            }
            
            // Try previous sibling of closest list item (common in Azure AD B2C custom policies)
            let liParent = el.closest('li');
            if (liParent) {
              let sibling = liParent.previousElementSibling;
              while (sibling) {
                let textEl = sibling.querySelector('p.textInParagraph, p[id*="ReadOnly" i]');
                if (!textEl || !textEl.innerText.trim()) {
                  textEl = sibling.querySelector('label, .label, .question, [id*="ReadOnly" i], [id*="question" i]');
                }
                if (textEl && textEl.innerText.trim()) {
                  return textEl.innerText.trim();
                }
                if (sibling.innerText && sibling.innerText.trim()) {
                  return sibling.innerText.trim();
                }
                sibling = sibling.previousElementSibling;
              }
            }
            
            let parent = el.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              const label = parent.querySelector('label, .label, .question, .kba-question, [id*="ReadOnly" i], [id*="question" i]');
              if (label && label.innerText.trim()) return label.innerText.trim();
              parent = parent.parentElement;
            }
            let sibling = el.previousElementSibling;
            while (sibling) {
              if (sibling.innerText && sibling.innerText.trim()) {
                return sibling.innerText.trim();
              }
              sibling = sibling.previousElementSibling;
            }
            return "";
          }).catch(() => "");
        };

        const inputLocators = page.locator('input[id*="response" i], input[id*="kba" i], input[id*="kbq" i], input[id*="answer" i], input[id*="Security" i], input[id$="_response"], #attributeList input').filter({ visible: true });
        const inputCount = await inputLocators.count();
        let filledCount = 0;
        let visibleCount = 0;

        for (let i = 0; i < inputCount; i++) {
          const input = inputLocators.nth(i);
          if (await input.isVisible()) {
            const id = await input.getAttribute('id').catch(() => "");
            const name = await input.getAttribute('name').catch(() => "");
            const qText = await getQuestionTextForInput(input);
            logMsg(`[Debug] Visible Input index: ${i}, ID: "${id}", Name: "${name}", Resolved Label Text: "${qText || 'EMPTY'}"`);
            
            if (qText) {
              const lowerQ = qText.toLowerCase();
              if (lowerQ.includes("username") || lowerQ.includes("email") || lowerQ.includes("sign in name")) {
                continue; // Skip username/email display fields
              }
              
              visibleCount++;
              logMsg(`Found visible question label: "${qText}"`);
              const answer = matchQuestion(qText);
              if (answer) {
                const currentVal = await input.inputValue().catch(() => "");
                if (currentVal !== answer) {
                  logMsg(`Autofilling answer: "${answer}"`);
                  await humanType(input, answer);
                }
                filledCount++;
              } else {
                logMsg(`WARNING: Could not match question: "${qText}". Please answer manually.`);
              }
            } else {
              logMsg(`WARNING: Question label for input #${i+1} is empty.`);
            }
          }
        }

        const canSubmit = visibleCount > 0 && filledCount === visibleCount;
        if (canSubmit) {
          const continueBtn = page.locator('#continue, #next, button:text("Continue"), button:text("Next")').first();
          if (await continueBtn.count() > 0) {
            logMsg("Clicking continue button on security questions page...");
            await continueBtn.click();
          }
        } else {
          logMsg("Cannot auto-submit yet. Some security questions could not be automatically filled.");
        }

      } else {
        // --- STANDARD LOGIN PAGE FLOW ---
        const emailInput = page.locator('#email, #logonIdentifier, #username, #signInName, input[type="email"], input[name*="username" i], input[name*="login" i], input[id*="signin" i], input[id*="login" i], input[id*="user" i], input[placeholder*="username" i], input[placeholder*="email" i]').first();
        const passwordInput = page.locator('#password, input[type="password"]').first();
        
        if (config.portalUsername && await emailInput.count() > 0) {
          const currentVal = await emailInput.inputValue().catch(() => "");
          if (currentVal !== config.portalUsername) {
            logMsg("Autofilling portal username...");
            await humanType(emailInput, config.portalUsername);
          }
        }
        
        if (config.portalPassword && await passwordInput.count() > 0) {
          const currentVal = await passwordInput.inputValue().catch(() => "");
          const id = await passwordInput.getAttribute('id').catch(() => "");
          const isKbaResponse = id && id.includes("kba");
          if (currentVal !== config.portalPassword && !isKbaResponse) {
            logMsg("Autofilling portal password...");
            await humanType(passwordInput, config.portalPassword);
          }
        }

        // Check if CAPTCHA is visible
        const captchaImg = page.locator('img[src*="captcha" i], img[src*="Captcha" i], img[id*="captcha" i], img[class*="captcha" i]').first();
        const hasCaptcha = await captchaImg.count() > 0 && await captchaImg.isVisible();

        if (!hasCaptcha) {
          const currentUsername = await emailInput.inputValue().catch(() => "");
          const currentPassword = await passwordInput.inputValue().catch(() => "");
          if (currentUsername === config.portalUsername && currentPassword === config.portalPassword) {
            const loginBtn = page.locator('#next, #signIn, button:text("Sign In"), button:text("Login"), input[type="submit"]').first();
            if (await loginBtn.count() > 0) {
              logMsg("No CAPTCHA detected. Auto-submitting login credentials... (Waiting 1.5s)");
              await page.waitForTimeout(1500);
              await loginBtn.click();
            }
          }
        } else if (config.captchaApiKey && config.captchaApiKey.trim()) {
          // Auto-solve CAPTCHA if API key is supplied
          const captchaInput = page.locator('input[name*="captcha" i], input[id*="captcha" i], input[placeholder*="captcha" i]').first();
          if (await captchaInput.count() > 0) {
            const currentVal = await captchaInput.inputValue().catch(() => "");
            if (!currentVal) {
              const solution = await solveImageCaptcha(page, config.captchaApiKey.trim());
              if (solution) {
                logMsg(`Entering solved CAPTCHA solution...`);
                await humanType(captchaInput, solution);
                
                // Click Sign In / Login button
                const loginBtn = page.locator('#next, #signIn, button:text("Sign In"), button:text("Login"), input[type="submit"]').first();
                if (await loginBtn.count() > 0) {
                  logMsg("Auto-submitting login form after CAPTCHA solution...");
                  await loginBtn.click();
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    logMsg(`Auto-login helper error: ${err.message}`);
  }
}

async function waitForLoginAsync(page, timeoutSeconds) {
  let reachedLoginPage = false;
  let lastLogUrl = "";
  let lastScreenshotTime = 0;
  
  // Give a small wait for the initial redirect to b2clogin.com to begin
  try {
    await page.waitForTimeout(4000);
  } catch (e) {
    return;
  }
  
  while (true) {
    if (!activeBrowser) {
      logMsg("Login waiting canceled – browser was closed.");
      return;
    }
    
    try {
      if (Date.now() - lastScreenshotTime > 10000) {
        try {
          await page.screenshot({ path: path.join(rootDir, 'current_page.png') });
          lastScreenshotTime = Date.now();
        } catch (screenshotErr) {
          // Ignore screenshot failures
        }
      }
      const url = page.url();
      let hostname = "";
      try {
        hostname = new URL(url).hostname;
      } catch (e) {
        // Fallback if URL is about:blank
      }
      
      const title = await page.title().catch(() => "");
      
      // Success criteria: If we are on any portal page and it loaded successfully with logged-in indicators, exit early
      const isUsvisaPage = url.includes('usvisascheduling.com');
      if (isUsvisaPage && !hostname.includes(LOGIN_DOMAIN)) {
        const loggedInIndicator = page.locator('text=Sign Out, text=Sign out, text=Logout, text=Dashboard, #schedule-appointment, select, .username, a[href*="logout" i], a[href*="signout" i], a[href*="logoff" i], a[title*="sign out" i]');
        const hasLoggedInElements = await loggedInIndicator.count() > 0;
        const hasDashboardTitle = title.includes("Visa Application Home") || title.includes("OFC Appointment");
        
        if (reachedLoginPage || hasLoggedInElements || hasDashboardTitle) {
          logMsg("Detected active authenticated portal session page. Exiting login loop immediately!");
          monitorState.status = "running";
          triggerDesktopNotification("US Visa Slot Monitor", "Login verified. Direct monitoring active!");
          if (config.engine === "only_login") {
            sendTelegram("✅ <b>Login Verified</b>. The browser session is active and staying idle.", config.telegramToken, config.telegramChatId);
          } else {
            sendTelegram("✅ <b>Login Verified</b>. The browser monitor is now checking slots.", config.telegramToken, config.telegramChatId);
          }
          // Trigger check cycle with a safety delay to let session and cookies settle
          setTimeout(runCycle, 8000);
          return;
        }
      }

      // Track state changes (like entering login pages or queues) and alert via Telegram
      const bodyTextSnippet = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 250).replace(/\n/g, ' ') : "").catch(() => "");
      const currentWaitState = `${title} | ${bodyTextSnippet}`;
      if (!global.lastWaitState || global.lastWaitState !== currentWaitState) {
        global.lastWaitState = currentWaitState;
        logMsg(`[Status Change] ${title} - sending Telegram update.`);
        sendTelegram(`🔄 <b>Session Status Update</b>\n\n📌 <b>Title:</b> ${title}\n📝 <b>Page Context:</b>\n<i>${bodyTextSnippet.slice(0, 200)}...</i>`, config.telegramToken, config.telegramChatId);
      }

      const isWaitingRoom = title.includes("You are now in line") || title.includes("Waiting Room") || (await page.locator('text=You are now in line').count() > 0);
      const isCloudflare = url.includes("cf_chl") || title.includes("Just a moment") || title.includes("Cloudflare") || isWaitingRoom;
      
      if (isCloudflare) {
        if (url !== lastLogUrl) {
          lastLogUrl = url;
          if (isWaitingRoom) {
            logMsg("Waiting Room / Queue detected in browser. Waiting for line to clear...");
          }
        }
        await new Promise(r => setTimeout(r, 6000));
        continue;
      }

      if (url !== lastLogUrl) {
        lastLogUrl = url;
      }
      
      // If we see the login domain, we flag that we have reached the login page
      if (url.includes(LOGIN_DOMAIN) || hostname.includes(LOGIN_DOMAIN)) {
        reachedLoginPage = true;
      }
      
      // Call autofill helper only if we are on the login domain (or if we have reached it)
      if (reachedLoginPage) {
        await handleAutoLoginHelper(page);
      }
    } catch (err) {
      // Ignore intermediate navigation errors
    }
    
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
  }
  
  logMsg("Login check timed out.");
  monitorState.status = "stopped";
  config.isActive = false;
  saveConfig();
  triggerDesktopNotification("US Visa Monitor", "Login wait timed out. Monitor disabled.");
  if (config.engine === "only_login") {
    sendTelegram("❌ <b>Login Timeout</b>. Browser session login failed / stopped.", config.telegramToken, config.telegramChatId);
  } else {
    sendTelegram("❌ <b>Login Timeout</b>. Slot monitor has been stopped.", config.telegramToken, config.telegramChatId);
  }
  cleanupBrowser();
}

async function waitForLoginContribution(page, timeoutSeconds) {
  const timeoutMs = (timeoutSeconds || 180) * 1000;
  const startTime = Date.now();
  let reachedLoginPage = false;
  
  try {
    await page.waitForTimeout(4000);
  } catch (e) {
    return false;
  }
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const url = page.url();
      const hostname = await page.evaluate(() => window.location.hostname);
      
      if (url.includes(LOGIN_DOMAIN) || hostname.includes(LOGIN_DOMAIN)) {
        reachedLoginPage = true;
      }
      
      if (reachedLoginPage) {
        await handleAutoLoginHelper(page);
      }
      
      const onPortal = !hostname.includes(LOGIN_DOMAIN) && hostname.includes("usvisascheduling.com");
      if (onPortal) {
        let isSuccess = false;
        if (reachedLoginPage) {
          isSuccess = true;
        } else {
          const loggedInIndicator = page.locator('text=Sign Out, text=Logout, text=Dashboard, #schedule-appointment');
          if (await loggedInIndicator.count() > 0) {
            isSuccess = true;
          }
        }
        if (isSuccess) {
          return true;
        }
      }
    } catch (err) {
      // Ignore intermediate errors
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function runBrowserContributionCycle() {
  logMsg("Starting scheduled browser contribution cycle to refresh API quota...");
  const { chromium } = require('patchright');
  const userDataDir = path.join(rootDir, 'browser_profile');
  const extensionPath = path.join(__dirname, 'extension');
  const autofillExtensionPath = path.join(__dirname, 'autofill-extension');

  let browserContext = null;
  let page = null;

  try {
    logMsg("Launching Chromium for contribution check...");
    browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      slowMo: 50,
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${extensionPath},${autofillExtensionPath}`,
        `--load-extension=${extensionPath},${autofillExtensionPath}`,
        '--disable-features=IsolateOrigins,site-per-process,BlockThirdPartyCookies'
      ]
    });

    page = browserContext.pages()[0] || await browserContext.newPage();
    logMsg("Navigating to login page for contribution...");
    await page.goto(HOME_URL);

    const isSuccess = await waitForLoginContribution(page, 180);
    if (isSuccess) {
      logMsg("Contribution login verified. Loading OFC page...");
      await page.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);

      if (config.applicantName && config.applicantName.trim()) {
        const applicantRow = page.locator(`text=${config.applicantName}`);
        if (await applicantRow.count() > 0) {
          logMsg(`Clicking applicant row for contribution: ${config.applicantName}`);
          await applicantRow.first().click();
        }
      }

      logMsg("Waiting 15 seconds on OFC page for extension screenshot upload...");
      await page.waitForTimeout(15000);
      logMsg("Contribution screenshot uploaded successfully.");
    } else {
      logMsg("Contribution check: Manual login required but timed out / failed.");
    }
  } catch (err) {
    logMsg(`Error during browser contribution cycle: ${err.message}`);
  } finally {
    if (browserContext) {
      await browserContext.close().catch(() => {});
    }
    logMsg("Browser contribution cycle completed.");
  }
}


async function runBrowserCycle() {
  // Launch browser if not running
  if (!activeBrowser) {
    monitorState.status = "starting";
    logMsg("Launching Chromium via Patchright stealth...");
    try {
      const userDataDir = path.join(rootDir, 'browser_profile');
      const extensionPath = path.join(__dirname, 'extension');
      const autofillExtensionPath = path.join(__dirname, 'autofill-extension');

      if (config.clearBrowserProfileOnStart && fs.existsSync(userDataDir)) {
        logMsg("Clearing persistent browser profile on startup as configured...");
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch (rmErr) {
          logMsg(`Warning: Failed to clear browser profile directory: ${rmErr.message}`);
        }
      }

      activeContext = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        slowMo: 50,
        viewport: { width: 1280, height: 800 },
        args: [
          `--disable-extensions-except=${extensionPath},${autofillExtensionPath}`,
          `--load-extension=${extensionPath},${autofillExtensionPath}`,
          '--disable-features=IsolateOrigins,site-per-process,BlockThirdPartyCookies'
        ]
      });
      
      activeContext.on('close', () => {
        logMsg("Browser context closed.");
        activeBrowser = null;
        activeContext = null;
        activePage = null;
        if (monitorState.status !== "stopped") {
          monitorState.status = "stopped";
          config.isActive = false;
          saveConfig();
        }
      });

      // Mock activeBrowser object to maintain compatibility with standard close/checking logic
      activeBrowser = {
        close: async () => {
          await activeContext.close();
        }
      };

      activePage = activeContext.pages()[0] || await activeContext.newPage();
      
      const setupPageListeners = (p) => {
        p.on('console', msg => {
          const text = msg.text();
          if (msg.type() === 'error' || msg.type() === 'warning' || text.toLowerCase().includes('error') || text.toLowerCase().includes('failed') || text.toLowerCase().includes('cookie')) {
            logMsg(`[Browser Console] [${msg.type().toUpperCase()}] ${text}`);
          }
        });
        p.on('pageerror', err => {
          logMsg(`[Browser Page Error] ${err.message}`);
        });
      };
      
      setupPageListeners(activePage);
      activeContext.on('page', p => setupPageListeners(p));
      
      monitorState.status = "awaiting_login";
      logMsg("Waiting for manual login inside browser window...");
      
      triggerDesktopNotification("US Visa Action Required", "Please complete the portal login flow.");
      sendTelegram("🤖 <b>Visa Monitor</b>: Awaiting portal login in Chromium window.", config.telegramToken, config.telegramChatId);
      
      try {
        await activePage.goto(HOME_URL, { waitUntil: 'commit', timeout: 30000 });
      } catch (gotoErr) {
        logMsg(`Initial page load redirected or challenged: ${gotoErr.message}. Launching background solver...`);
      }
      
      // Async poll for login (this runs the Turnstile solver loop)
      waitForLoginAsync(activePage, config.loginTimeoutSeconds);
      return;
    } catch (err) {
      logMsg(`Failed to launch browser: ${err.message}`);
      monitorState.status = "error";
      config.isActive = false;
      saveConfig();
      cleanupBrowser();
      throw err;
    }
  }

  // If waiting for login, let the async check handle it
  if (monitorState.status === "awaiting_login" || monitorState.status === "awaiting_relogin") {
    logMsg("Currently waiting for credentials / CAPTCHAs in the browser.");
    return;
  }

  // If in waiting room, check if the queue is still present without performing a page reload
  if (monitorState.status === "waiting_room") {
    const title = await activePage.title().catch(() => "");
    const url = activePage.url() || "";
    const isWaiting = title.includes("You are now in line") || title.includes("Waiting Room") || url.includes("cf_chl") || title.includes("Just a moment") || (await activePage.locator('text=You are now in line').count() > 0);
    
    if (isWaiting) {
      logMsg("Still in the Cloudflare queue / Waiting Room. Letting it load...");
      return;
    } else {
      logMsg("Cloudflare queue / Waiting Room cleared! Checking session status...");
      monitorState.status = "running";
    }
  }

  // Load the OFC scheduling page once to start the checking process and check session validity
  try {
    const currentUrl = activePage.url() || "";
    const currentTitle = await activePage.title().catch(() => "");
    const isAlreadyOnOFC = currentUrl.includes('/ofc-schedule') && currentTitle.includes("OFC Appointment");
    
    let response = null;
    if (isAlreadyOnOFC) {
      if (config.engine === "only_login") {
        const timeSinceLastRefresh = Date.now() - lastOFCPageRefreshTime;
        if (timeSinceLastRefresh < 240000) { // 4 minutes (240,000 ms)
          monitorState.status = "running";
          logMsg(`[Login Only Mode] Session is active on OFC page. Skipping refresh (last refreshed ${Math.round(timeSinceLastRefresh / 1000)}s ago).`);
          return;
        } else {
          logMsg("[Login Only Mode] 4 minutes elapsed. Refreshing page to renew short-lived Cloudflare and session cookies (ppuid, __cf_bm, __cfwaitingroom)...");
          response = await activePage.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
          lastOFCPageRefreshTime = Date.now();
          await activePage.waitForTimeout(2000);
        }
      } else {
        logMsg("Browser is already on the OFC Scheduling page. Skipping page load/reload.");
      }
    } else {
      logMsg("Loading OFC scheduling page...");
      response = await activePage.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      lastOFCPageRefreshTime = Date.now();
      await activePage.waitForTimeout(2000);
    }
    
    const url = activePage.url() || "";
    const title = await activePage.title().catch(() => "");
    
    // Detect Cloudflare Turnstile / Managed Challenge page
    const isCloudflare = (response && response.status() === 403) || url.includes("cf_chl") || title.includes("Just a moment") || title.includes("Cloudflare");
    if (isCloudflare) {
      logMsg("Cloudflare challenge page detected. Launching Turnstile solver loop...");
      monitorState.status = "awaiting_relogin";
      waitForLoginAsync(activePage, config.loginTimeoutSeconds);
      return;
    }

    // Check if the response returned an HTTP error status (4xx or 5xx)
    if (response && response.status() >= 400) {
      throw new Error(`Server returned HTTP status ${response.status()}`);
    }

    const isWaitingRoom = title.includes("You are now in line") || title.includes("Waiting Room") || (await activePage.locator('text=You are now in line').count() > 0);
    if (isWaitingRoom) {
      logMsg("Waiting Room / Queue detected. Waiting for line to clear...");
      monitorState.status = "waiting_room";
      return; // Retry on the next cycle, keep the browser open
    }
    
    const hostname = await activePage.evaluate(() => window.location.hostname);
    if (hostname.includes(LOGIN_DOMAIN)) {
      monitorState.status = "awaiting_relogin";
      logMsg("Session invalid / expired (redirected to login domain). Asking for manual re-login.");
      triggerDesktopNotification("US Visa Session Expired", "Please log back into the visa scheduling portal.");
      sendTelegram("⚠️ <b>Visa Monitor</b>: Session expired. Please log back into the browser.", config.telegramToken, config.telegramChatId);
      await activePage.goto(HOME_URL);
      waitForLoginAsync(activePage, config.loginTimeoutSeconds);
      return;
    }

    // Verify the consulate select dropdown is visible to confirm we are successfully on the OFC scheduling page
    const dropdown = activePage.locator("select");
    try {
      await dropdown.waitFor({ state: "visible", timeout: 8000 });
    } catch (e) {
      throw new Error("OFC page loaded, but consulate select dropdown is not visible. (Possibly blocked, restricted dashboard page, or empty session)");
    }
  } catch (err) {
    logMsg(`Failed to load OFC page: ${err.message}`);
    if (!activeBrowser) return; // Browser closed
    monitorState.errors.push({ time: new Date().toISOString(), message: `Failed to load OFC page: ${err.message}` });
    throw err;
  }

  // Run checks
  monitorState.status = "running";
  const foundSlots = [];
  const results = {};

  // If we are in "only_login" mode, skip slot checks and just verify session is active
  if (config.engine === "only_login") {
    monitorState.status = "running";
    logMsg("[Login Only Mode] Session is active and verified. Staying idle.");
    return;
  }

  // If an applicant name is specified, click their checkbox row once on page load
  if (config.applicantName && config.applicantName.trim()) {
    try {
      const applicantRow = activePage.locator(`text=${config.applicantName}`);
      if (await applicantRow.count() > 0) {
        logMsg(`Clicking applicant row: ${config.applicantName}`);
        await applicantRow.first().click();
        await activePage.waitForTimeout(1000);
      }
    } catch (err) {
      logMsg(`Error clicking applicant row: ${err.message}`);
    }
  }

  // Check each city consulate by changing the select dropdown (without page reload)
  for (const city of config.ofcCities) {
    // Abort if browser was closed or scheduler was stopped during the cycle
    if (!activePage || !activeBrowser || !config.isActive) {
      logMsg("Browser closed or scheduler stopped. Aborting scan cycle.");
      break;
    }
    
    // Skip cities without 'VAC' in their name when running browser scans
    if (!city.toUpperCase().includes("VAC")) {
      logMsg(`[Browser Mode] Skipping non-VAC consulate option: ${city}`);
      continue;
    }
    
    logMsg(`Scanning slots for ${city}...`);
    // Pass shouldLoadPage = false, and applicantName empty since it's already checked once
    const status = await checkCity(activePage, city, false, "");
    results[city] = status;

    if (status === true) {
      foundSlots.push(city);
    }
    
    // Safety delay between selections to avoid rate limiting
    await new Promise(r => setTimeout(r, 6000));
  }

  monitorState.availableSlots = results;

  // Dispatch alerts
  if (foundSlots.length > 0) {
    const timeStr = new Date().toLocaleString();
    const citiesLines = foundSlots.map(c => `✅ ${c}`).join("\n");
    const textMsg = `🚨 US Visa OFC Slots Available!\n\n${citiesLines}\n\nChecked at: ${timeStr}`;
    
    triggerDesktopNotification("Visa Slots Available!", `Locations: ${foundSlots.join(", ")}`);
    sendTelegram(`🚨 <b>OFC Appointment Slots Open!</b>\n\n${citiesLines}\n\n🕐 ${timeStr}\n👉 <a href="${OFC_SCHEDULE_URL}">Book Now</a>`, config.telegramToken, config.telegramChatId);
    sendEmail("US Visa Slots Open Alert", textMsg, config);
  }
}

// ── API Engine Logic ────────────────────────────────────────────────────────

async function runApiCycle() {
  logMsg("Querying CheckVisaSlots crowdsourced API...");
  if (!config.checkVisaSlotsApiKey) {
    logMsg("Error: CheckVisaSlots API Key is missing. Skipping API cycle.");
    return;
  }

  try {
    const url = "https://us-visa-slot-checker.akhilkumarbaja.workers.dev";
    const key = config.checkVisaSlotsApiKey.trim();
    const headers = {
      "x-api-key": key,
      "extversion": "4.7.0.2",
      "origin": "chrome-extension://beepaenfejnphdgnkmccjcfiieihhogl",
      "accept": "*/*",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    };

    let fetchOptions = { method: "GET", headers };
    if (config.proxyUrl && config.proxyUrl.trim()) {
      try {
        const { ProxyAgent } = require('undici');
        fetchOptions.dispatcher = new ProxyAgent(config.proxyUrl.trim());
        logMsg(`Routing API request through proxy: ${config.proxyUrl.trim().replace(/:[^:@]+@/, ':***@')}`);
      } catch (err) {
        logMsg(`Error initializing proxy agent: ${err.message}`);
      }
    }

    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`API error code ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    logMsg(`API Response received. Available keys in payload: ${Object.keys(data).join(", ")}`);
    logMsg(`Full API Payload: ${JSON.stringify(data)}`);

    const foundSlots = [];
    const results = {};

    const slotDetails = data.slotDetails || [];
    for (const city of config.ofcCities) {
      const cityDetail = slotDetails.find(d => d.visa_location.toUpperCase() === city.toUpperCase());

      if (cityDetail) {
        const isAvailable = cityDetail.slots > 0;
        results[city] = isAvailable;
        if (isAvailable) {
          const updateTime = cityDetail.createdon ? new Date(cityDetail.createdon).getTime() : 0;
          const fifteenMins = 15 * 60 * 1000;
          const isRecent = (Date.now() - updateTime) < fifteenMins;
          if (isRecent) {
            foundSlots.push(`${city} (Slots: ${cityDetail.slots}, Last Updated: ${formatToIST(cityDetail.createdon) || 'N/A'})`);
          } else {
            console.log(`[API Check] Slots found for ${city} but skipped (Older than 15 mins: Updated at ${formatToIST(cityDetail.createdon)})`);
          }
        }
      } else {
        results[city] = null; // No data for this VAC in response
      }
    }

    monitorState.availableSlots = results;

    // Check remaining credits and send warning if low
    const remaining = data.userActivity && data.userActivity.remaining;
    if (typeof remaining === 'number') {
      monitorState.apiCreditsRemaining = remaining;
      if (remaining < 100) {
        const now = Date.now();
        const oneHour = 1 * 60 * 60 * 1000;
        if (!monitorState.lowCreditWarningSent || (now - monitorState.lastLowCreditAlertTime > oneHour)) {
          logMsg(`Warning: CheckVisaSlots API credits are low (${remaining} left). Sending Telegram alert.`);
          sendTelegram(`⚠️ <b>API Credits Low</b>\n\nYour remaining CheckVisaSlots API credits are low: <b>${remaining}</b> left.\nPlease run the browser scanner on your laptop to contribute screenshots and earn more credits!`, config.telegramToken, config.telegramChatId);
          monitorState.lowCreditWarningSent = true;
          monitorState.lastLowCreditAlertTime = now;
        }
      } else {
        // Reset warning state once credits are recharged above 100
        monitorState.lowCreditWarningSent = false;
        monitorState.lastLowCreditAlertTime = 0;
      }
    }

    if (foundSlots.length > 0) {
      const timeStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }) + " IST";
      const citiesLines = foundSlots.map(c => `✅ ${c}`).join("\n");
      const textMsg = `🚨 US Visa Slots Open (CheckVisaSlots API)!\n\n${citiesLines}\n\nChecked at: ${timeStr}`;

      triggerDesktopNotification("Visa Slots Open (API)!", `Locations: ${foundSlots.join(", ")}`);
      sendTelegram(`🤖 <b>US Visa Slots Open (API Tracker)</b>\n\n${citiesLines}\n\n🕐 <b>Checked at:</b> ${timeStr}\n👉 <a href="https://www.usvisascheduling.com/en-US/">Book Now</a>`, config.telegramToken, config.telegramChatId);
      sendEmail("US Visa Slots Open Alert (API)", textMsg, config);

      if (supabase && cachedSlotsDetected !== true) {
        logMsg("Slots found via API! Writing slots_detected flag to Supabase for local listener...");
        try {
          const { data: dbData } = await supabase.from('us_visa_config').select('data').eq('id', 1).single();
          let rawData = dbData && dbData.data ? dbData.data : {};
          if (typeof rawData === 'string') {
            try { rawData = JSON.parse(rawData); } catch (e) {}
          }
          const currentData = { ...rawData };
          currentData.slots_detected = true;
          await supabase.from('us_visa_config').update({ data: currentData }).eq('id', 1);
          cachedSlotsDetected = true;
        } catch (err) {
          logMsg(`Failed to write slots_detected to Supabase: ${err.message}`);
        }
      }

      // If running locally, switch local mode and launch browser immediately
      if (!process.env.RENDER) {
        logMsg("Local instance detected. Automatically switching to Browser Auto mode and launching Chromium...");
        config.engine = "browser";
        saveConfig();
        sendTelegram(`🚀 <b>Auto-Trigger:</b> Slots found! Switching engine to <b>Browser Auto</b> and launching Chromium browser...`, config.telegramToken, config.telegramChatId);
        runBrowserCycle().catch(err => logMsg(`Auto-launched browser cycle error: ${err.message}`));
      }
    } else {
      logMsg("No slots detected in CheckVisaSlots data.");
      if (supabase && cachedSlotsDetected !== false) {
        try {
          const { data: dbData } = await supabase.from('us_visa_config').select('data').eq('id', 1).single();
          if (dbData && dbData.data) {
            let rawData = dbData.data;
            if (typeof rawData === 'string') {
              try { rawData = JSON.parse(rawData); } catch (e) {}
            }
            if (rawData && rawData.slots_detected) {
              logMsg("Cleaning stale slots_detected flag in Supabase...");
              const currentData = { ...rawData };
              currentData.slots_detected = false;
              await supabase.from('us_visa_config').update({ data: currentData }).eq('id', 1);
            }
          }
          cachedSlotsDetected = false;
        } catch (err) {
          // Ignore silently
        }
      }
    }
  } catch (err) {
    logMsg(`API check cycle failed: ${err.message}`);
    monitorState.errors.push({ time: new Date().toISOString(), message: err.message });
    throw err;
  }
}

// ── Background Interval Manager ─────────────────────────────────────────────

let schedulerIntervalId = null;
let contributionIntervalId = null;
let hourlySummaryIntervalId = null;
let isChecking = false;
let checkCycleStartTime = 0;

// Track history over the last hour for cumulative notifications
let hourlyChecksCount = 0;
let hourlySuccessfulChecks = 0;
let hourlyCreditsStart = null;
let hourlyCreditsEnd = null;
let consecutiveFailuresCount = 0;

async function sendHourlySummary() {
  if (hourlyChecksCount === 0) return;

  const timeStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const creditsUsed = (hourlyCreditsStart !== null && hourlyCreditsEnd !== null) 
    ? (hourlyCreditsStart - hourlyCreditsEnd) 
    : 0;

  // Compile current slot status overview
  const citiesStatus = config.ofcCities.map(city => {
    const hasSlots = monitorState.availableSlots[city];
    const icon = hasSlots === true ? "✅" : hasSlots === false ? "❌" : "❓";
    return `${icon} ${city.replace(" VAC", "")}: ${hasSlots === true ? "Slots Available" : hasSlots === false ? "No Slots" : "Pending"}`;
  }).join("\n");

  const message = `📊 <b>Hourly US Visa Monitor Report</b>\n\n` +
                  `🕐 <b>Time:</b> ${timeStr} IST\n` +
                  `🔄 <b>Successful Checks:</b> ${hourlySuccessfulChecks}/${hourlyChecksCount} cycles\n` +
                  `💳 <b>Credits Remaining:</b> ${monitorState.apiCreditsRemaining || "N/A"} (${creditsUsed} used this hour)\n\n` +
                  `<b>Consulate Status Overview:</b>\n${citiesStatus}`;

  logMsg("Sending hourly cumulative stats summary to Telegram...");
  sendTelegram(message, config.telegramToken, config.telegramChatId);

  // Reset hourly counters
  hourlyChecksCount = 0;
  hourlySuccessfulChecks = 0;
  hourlyCreditsStart = monitorState.apiCreditsRemaining;
}

async function runCycle() {
  if (isChecking) {
    const cycleDuration = Date.now() - checkCycleStartTime;
    if (cycleDuration > 300000) { // 5 minutes safety timeout
      logMsg(`[Scheduler Guard] Current active cycle has been running for over 5 minutes (${Math.round(cycleDuration / 1000)}s). Forcing lock release...`);
      isChecking = false;
    } else {
      logMsg("Active check cycle in progress. Skipping duplicate loop.");
      return;
    }
  }
  isChecking = true;
  checkCycleStartTime = Date.now();

  try {
    monitorState.lastCheckTime = new Date().toISOString();
    hourlyChecksCount++;
    if (hourlyCreditsStart === null && monitorState.apiCreditsRemaining !== null) {
      hourlyCreditsStart = monitorState.apiCreditsRemaining;
    }

    if (config.engine === "browser" || config.engine === "only_login") {
      await runBrowserCycle();
      hourlySuccessfulChecks++;
    } else {
      await runApiCycle();
      hourlySuccessfulChecks++;
      hourlyCreditsEnd = monitorState.apiCreditsRemaining;
    }
    consecutiveFailuresCount = 0; // Reset on success
  } catch (err) {
    logMsg(`Scheduler execution failed: ${err.message}`);
    consecutiveFailuresCount++;
    if (consecutiveFailuresCount >= 3) {
      logMsg(`Sending failure alert: 3 consecutive failures exceeded.`);
      sendTelegram(`⚠️ <b>Visa Monitor Loop Failure</b>\n\nThe slot checker has encountered consecutive errors.\n\n❌ <b>Latest Error:</b> ${err.message}\n\nPlease check the Render logs or the dashboard console.`, config.telegramToken, config.telegramChatId);
      consecutiveFailuresCount = 0; // Reset to avoid spamming
    }
  } finally {
    isChecking = false;
    
    // Save record to history
    const record = {
      timestamp: new Date().toISOString(),
      engine: config.engine,
      status: monitorState.status,
      slots: { ...monitorState.availableSlots }
    };
    historyLogs.push(record);
    if (historyLogs.length > 1000) {
      historyLogs = historyLogs.slice(-1000);
    }
    saveHistory();
  }
}

function startSupabaseListener() {
  if (!supabase) return;
  
  logMsg("Starting local Supabase listener (Realtime WebSocket + Polling fallback) for cloud triggers...");

  // 1. Instant Realtime Subscription (sub-second latency)
  const channel = supabase
    .channel('us_visa_config_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'us_visa_config',
        filter: 'id=eq.1'
      },
      async (payload) => {
        let data = payload.new && payload.new.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) {}
        }
        if (data && data.slots_detected === true) {
          logMsg("[Supabase Realtime] Slots detected by Cloud!");
          await handleSlotsDetectedNotification(data);
        }
      }
    )
    .subscribe((status) => {
      logMsg(`[Supabase Realtime] Subscription status: ${status}`);
    });

  // 2. Fallback Polling (Every 10 seconds) in case Realtime replication is disabled in Supabase dashboard
  const pollCheck = async () => {
    try {
      const { data: dbData } = await supabase
        .from('us_visa_config')
        .select('data')
        .eq('id', 1)
        .single();
        
      if (dbData && dbData.data) {
        let rawData = dbData.data;
        if (typeof rawData === 'string') {
          try { rawData = JSON.parse(rawData); } catch (e) {}
        }
        if (rawData && rawData.slots_detected === true) {
          logMsg("[Supabase Poll Fallback] Slots detected by Cloud!");
          await handleSlotsDetectedNotification(rawData);
        }
      }
    } catch (err) {
      // Ignore network errors
    }
  };

  // Run once immediately on startup
  pollCheck();
  
  // Set interval to poll every 10 seconds
  setInterval(pollCheck, 10000);
}

// Global helper to handle slots detected state, switching from only_login to active browser if needed
async function handleSlotsDetectedNotification(dbConfigData) {
  try {
    // Reset the flag in Supabase immediately so we don't double-trigger
    const updatedData = { ...dbConfigData };
    updatedData.slots_detected = false;
    logMsg("[Supabase Trigger] Resetting slots_detected flag to false in Supabase...");
    await supabase
      .from('us_visa_config')
      .update({ data: updatedData })
      .eq('id', 1);

    if (config.isActive) {
      logMsg("[Supabase Trigger] Cloud detected slots! Ensuring browser is on OFC page and disabling consulate auto-scanning (dropdown clicks) to protect account...");
      
      // Force engine to only_login to prevent the loop from clicking consulate dropdowns
      config.engine = "only_login";
      saveConfig();
      
      sendTelegram(`🚀 <b>Auto-Trigger:</b> Cloud detected slots! Ensuring browser stays open on the <b>OFC Appointment</b> booking page. Auto-scanning (dropdown clicks) disabled to prevent blocks.`, config.telegramToken, config.telegramChatId);
      
      // Restart scheduler immediately to safely navigate to the OFC page on the main thread
      startScheduler();
    } else {
      // If stopped, launch browser in Login Only mode to keep it alive
      logMsg("[Supabase Trigger] Local instance stopped. Launching browser in Login Only mode to await manual login...");
      await triggerLocalBrowserLaunch(dbConfigData);
    }
  } catch (err) {
    logMsg(`[Supabase Trigger] Error during slots notification handling: ${err.message}`);
  }
}

// Helper to trigger the browser launch and clean up the flag in Supabase
async function triggerLocalBrowserLaunch(dbConfigData) {
  try {
    // Reset the flag in Supabase immediately so we don't double-trigger (fallback fallback)
    const updatedData = { ...dbConfigData };
    updatedData.slots_detected = false;
    await supabase
      .from('us_visa_config')
      .update({ data: updatedData })
      .eq('id', 1);
      
    // Start local browser in Login Only mode to keep it alive
    config.engine = "only_login";
    config.isActive = true;
    saveConfig();
    
    startScheduler();
  } catch (err) {
    logMsg(`[Supabase Listener] Error during launch trigger: ${err.message}`);
  }
}

function startScheduler() {
  if (schedulerIntervalId) clearTimeout(schedulerIntervalId);
  if (contributionIntervalId) clearInterval(contributionIntervalId);
  if (hourlySummaryIntervalId) clearInterval(hourlySummaryIntervalId);
  
  logMsg("Starting background scheduler loop...");
  config.isActive = true;
  saveConfig();
  
  // Set up hourly stat counters
  hourlyChecksCount = 0;
  hourlySuccessfulChecks = 0;
  hourlyCreditsStart = monitorState.apiCreditsRemaining;
  consecutiveFailuresCount = 0;

  // Schedule cycles dynamically with random delays to prevent bot detection profiles
  function scheduleNextCycle() {
    if (!config.isActive) return;
    
    // Determine optimal interval dynamically based on the active engine mode
    let intervalSeconds = config.checkIntervalSeconds || 180;
    if (config.engine === "browser") {
      intervalSeconds = Math.max(intervalSeconds, 900); // 15 minutes to avoid Cloudflare flags
    } else if (config.engine === "only_login") {
      intervalSeconds = 300; // 5 minutes to keep browser session alive without timing out
    } else if (config.engine === "api") {
      intervalSeconds = 180; // 3 minutes for fast silent API checks
    }
    
    // Add a random fluctuation (+/- 10 seconds) to the interval
    const baseIntervalMs = Math.max(intervalSeconds, 60) * 1000;
    const fluctuationMs = (Math.random() * 20 - 10) * 1000; // Random offset between -10s and +10s
    const nextDelayMs = Math.max(60000, baseIntervalMs + fluctuationMs); // Ensure minimum 60s
    
    schedulerIntervalId = setTimeout(async () => {
      await runCycle();
      scheduleNextCycle();
    }, nextDelayMs);
  }

  runCycle().then(() => {
    scheduleNextCycle();
  });
  
  if (config.engine === "api") {
    // Align hourly summary loop to trigger at the top of the hour in IST (UTC +5:30)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const msToNextHour = 3600000 - ((Date.now() + IST_OFFSET) % 3600000);
    
    // Send immediate Telegram alert confirming active loop and the schedule
    const nextHourDate = new Date(Date.now() + msToNextHour);
    const targetTimeStr = nextHourDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: 'numeric', minute: '2-digit', hour12: true });
    logMsg(`Hourly scheduler initialized. First report scheduled at ${targetTimeStr} IST.`);
    sendTelegram(`🟢 <b>US Visa Monitor Active</b>\n\nHourly cumulative summary reports successfully configured to trigger at the top of each hour.\n🕐 <b>First Report:</b> ${targetTimeStr} IST`, config.telegramToken, config.telegramChatId);

    hourlySummaryIntervalId = setTimeout(() => {
      sendHourlySummary();
      // After the first aligned trigger, set up a standard 1-hour interval
      hourlySummaryIntervalId = setInterval(sendHourlySummary, 60 * 60 * 1000);
    }, msToNextHour);
  } else {
    sendTelegram(`🟢 <b>US Visa Monitor Active</b>\n\nThe monitor has been started in <b>${config.engine === 'only_login' ? 'Login Only' : 'Browser Auto'}</b> mode.`, config.telegramToken, config.telegramChatId);
  }
  
  monitorState.status = (config.engine === "browser" || config.engine === "only_login") ? "starting" : "running";
}

function stopScheduler() {
  if (schedulerIntervalId) {
    clearTimeout(schedulerIntervalId);
    schedulerIntervalId = null;
  }
  if (contributionIntervalId) {
    clearInterval(contributionIntervalId);
    contributionIntervalId = null;
  }
  if (hourlySummaryIntervalId) {
    clearTimeout(hourlySummaryIntervalId);
    clearInterval(hourlySummaryIntervalId);
    hourlySummaryIntervalId = null;
  }
  config.isActive = false;
  saveConfig();
  
  monitorState.status = "stopped";
  logMsg("Background scheduler stopped.");
  cleanupBrowser();

  // Alert Telegram when scanner stops
  sendTelegram(`🛑 <b>US Visa Monitor Stopped</b>\n\nThe scheduler loop has been stopped. Browser session terminated.`, config.telegramToken, config.telegramChatId);
}

// Graceful process shutdown exit handlers
const handleGracefulShutdown = (signal) => {
  logMsg(`Received signal ${signal}. Starting graceful shutdown...`);
  sendTelegram(`🔌 <b>US Visa Backend Offline</b>\n\nThe Node.js server process was terminated (Signal: ${signal}). Local checker is offline.`, config.telegramToken, config.telegramChatId);
  stopScheduler();

  // Restore sleep mode on macOS
  if (caffeinateProcess) {
    try {
      logMsg("Restoring normal Mac sleep behavior...");
      caffeinateProcess.kill();
    } catch (killErr) {
      logMsg(`Error killing caffeinate process: ${killErr.message}`);
    }
    caffeinateProcess = null;
  }

  setTimeout(() => {
    process.exit(0);
  }, 1000);
};

process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));



function formatToIST(gmtStr) {
  if (gmtStr === "N/A" || gmtStr === undefined || gmtStr === null) return "N/A";
  try {
    const d = new Date(gmtStr);
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
  } catch (e) {
    return gmtStr;
  }
}

// ── Authentication & Real-time Stream Setup ───────────────────────────────

let sseClients = [];

function getCurrentStatus() {
  return {
    status: monitorState.status,
    isActive: config.isActive,
    engine: config.engine,
    lastCheckTime: monitorState.lastCheckTime,
    availableSlots: monitorState.availableSlots,
    errors: monitorState.errors.slice(-10), // Only send recent errors
    apiCreditsRemaining: monitorState.apiCreditsRemaining
  };
}

function broadcastStatus() {
  if (sseClients.length === 0) return;
  const statusData = JSON.stringify(getCurrentStatus());
  sseClients.forEach(client => {
    try {
      client.write(`data: ${statusData}\n\n`);
    } catch (e) {
      // Ignore write errors for closed clients
    }
  });
}

// Broadcast status to all connected dashboards every 3 seconds to keep them synced
setInterval(broadcastStatus, 3000);

function authenticateToken(req, res, next) {
  // If Google OAuth credentials are not set up, bypass auth
  if (!config.googleClientId || !config.googleClientSecret) {
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: "Access token is missing" });
  }
  
  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token is invalid or expired" });
    }
    req.user = decoded;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!config.googleClientId || !config.googleClientSecret) {
    return next();
  }
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: "Admin privileges required" });
}

// ── Google OAuth Endpoints ──────────────────────────────────────────────────

app.get('/api/auth/bypass-dev', (req, res) => {
  const host = req.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  if (!isLocal) {
    return res.status(403).json({ error: "Developer Admin Bypass is only allowed in local development." });
  }

  const email = "akhilkumarbaja@gmail.com";
  const role = "admin";
  const token = jwt.sign(
    { email, role },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
  const targetOrigin = req.query.origin || `${req.protocol}://${req.get('host')}`;
  res.redirect(`${targetOrigin}/login-success?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`);
});

app.get('/api/auth/google/url', (req, res) => {
  if (!config.googleClientId) {
    return res.status(400).json({ error: "Google Client ID is not configured." });
  }
  const { origin } = req.query;
  const state = origin ? encodeURIComponent(origin) : '';
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(config.googleClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent&state=${state}`;
  res.json({ url });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code is missing");
  }
  
  const targetOrigin = state ? decodeURIComponent(state) : `${req.protocol}://${req.get('host')}`;
  
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    
    // Exchange auth code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logMsg(`Google OAuth code exchange failed: ${errText}`);
      return res.redirect(`${targetOrigin}/login?error=auth_failed`);
    }
    
    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;
    
    // Fetch user profile from OpenID Connect
    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!userInfoRes.ok) {
      return res.redirect(`${targetOrigin}/login?error=profile_failed`);
    }
    
    const userInfo = await userInfoRes.json();
    const email = userInfo.email;
    
    if (!email) {
      return res.redirect(`${targetOrigin}/login?error=no_email`);
    }
    
    // Bootstrap: First ever Google login becomes admin if allowedEmails is empty or has no admins
    let allowedEmails = config.allowedEmails || {};
    const hasAdmin = Object.values(allowedEmails).some(val => {
      if (typeof val === 'string') return val === 'admin';
      if (val && typeof val === 'object') return val.role === 'admin';
      return false;
    });
    
    if (!hasAdmin || Object.keys(allowedEmails).length === 0) {
      allowedEmails[email] = { role: 'admin', phone: '' };
      config.allowedEmails = allowedEmails;
      saveConfig();
      logMsg(`Bootstrap: Automatically registered first signed-in user (${email}) as admin.`);
    }
    
    const userVal = allowedEmails[email];
    let role = 'viewer';
    if (userVal) {
      role = typeof userVal === 'object' ? userVal.role : userVal;
    }
    
    // Issue token valid for 30 days
    const token = jwt.sign(
      { email, role },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    
    res.redirect(`${targetOrigin}/login-success?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`);
  } catch (err) {
    logMsg(`OAuth Callback processing error: ${err.message}`);
    res.redirect(`${targetOrigin}/login?error=server_error`);
  }
});

// ── REST API Endpoints ──────────────────────────────────────────────────────

app.get('/api/config', authenticateToken, requireAdmin, (req, res) => {
  res.json(config);
});

app.post('/api/config', authenticateToken, requireAdmin, (req, res) => {
  const originalActive = config.isActive;
  const originalJwtSecret = config.jwtSecret;
  config = { ...config, ...req.body };
  
  // Enforce minimum check intervals to prevent account lockouts and IP bans
  if (config.engine === "browser") {
    config.checkIntervalSeconds = Math.max(config.checkIntervalSeconds || 900, 900); // 15 minutes minimum
  } else if (config.engine === "only_login") {
    config.checkIntervalSeconds = Math.max(config.checkIntervalSeconds || 300, 300); // 5 minutes minimum
  } else if (config.engine === "api") {
    config.checkIntervalSeconds = Math.max(config.checkIntervalSeconds || 180, 180); // 3 minutes minimum
  }

  // Do not allow editing isActive directly via this config update endpoint to avoid race conditions
  config.isActive = originalActive; 
  config.jwtSecret = originalJwtSecret;
  saveConfig();
  
  logMsg("Configuration updated via API.");
  
  // If scheduler is currently running, restart it to apply new intervals/filters
  if (config.isActive) {
    startScheduler();
  }
  res.json({ message: "Configuration updated successfully", config });
});

app.get('/api/extension/credentials', (req, res) => {
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.connection.remoteAddress === '127.0.0.1' || req.connection.remoteAddress === '::1';
  if (!isLocal) {
    return res.status(403).json({ error: "Access denied. Only localhost requests allowed." });
  }
  res.json({
    portalUsername: config.portalUsername || "",
    portalPassword: config.portalPassword || "",
    securitySchool: config.securitySchool || "",
    securityCar: config.securityCar || "",
    securityJob: config.securityJob || "",
    securityFood: config.securityFood || "",
  });
});

app.get('/api/status', (req, res) => {
  res.json(getCurrentStatus());
});

app.get('/api/status/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Send initial state immediately
  res.write(`data: ${JSON.stringify(getCurrentStatus())}\n\n`);
  
  sseClients.push(res);
  
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

app.get('/api/history', (req, res) => {
  res.json(historyLogs.slice(-100)); // Send last 100 entries
});

app.post('/api/scheduler/toggle', authenticateToken, requireAdmin, (req, res) => {
  const { start } = req.body;
  if (start) {
    startScheduler();
    res.json({ message: "Scheduler started", status: monitorState.status });
  } else {
    stopScheduler();
    res.json({ message: "Scheduler stopped", status: monitorState.status });
  }
});

app.post('/api/test-alert', authenticateToken, requireAdmin, async (req, res) => {
  const { channel } = req.body;
  const timeStr = new Date().toLocaleTimeString();
  logMsg(`Triggering test alert on channel: ${channel}`);

  if (channel === "desktop") {
    triggerDesktopNotification("US Visa Alert Test", "This is a test notification from US Visa Slot Monitor. Audio check active.");
    res.json({ message: "Desktop alert triggered" });
  } else if (channel === "telegram") {
    sendTelegram(`🤖 <b>US Visa Monitor Test</b>\n\nThis is a test message confirming your Telegram notification settings are correct!\n🕐 Sent at: ${timeStr}`, config.telegramToken, config.telegramChatId);
    res.json({ message: "Telegram alert sent" });
  } else {
    res.status(400).json({ error: "Invalid notification channel requested" });
  }
});

app.get('/api/logs', authenticateToken, requireAdmin, (req, res) => {
  if (fs.existsSync(logFilePath)) {
    try {
      const data = fs.readFileSync(logFilePath, 'utf8');
      const lines = data.split('\n').filter(Boolean);
      res.json({ logs: lines.slice(-200) }); // Send last 200 log entries
    } catch (err) {
      res.status(500).json({ error: `Failed to read log file: ${err.message}` });
    }
  } else {
    res.json({ logs: ["No logs available yet."] });
  }
});

// Serve static frontend files in production
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  logMsg(`Serving static frontend files from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    // Avoid intercepting API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  logMsg("Static frontend files not found. Dashboard UI must be run separately via dev server.");
}

// Initialize database and files, then start server
async function initApp() {
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  await loadConfig();
  await loadHistory();
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, `[${new Date().toLocaleString()}] US Visa Slot Tracker Logs Initialized.\n`, 'utf8');
  }

  // Auto-start scheduler if configured active
  if (config.isActive) {
    startScheduler();
  }

  // Only start Supabase listener locally (not on Render cloud)
  // Prevent sleep on macOS as long as backend server is alive
  if (process.platform === 'darwin') {
    try {
      const { spawn } = require('child_process');
      if (caffeinateProcess) {
        caffeinateProcess.kill();
        caffeinateProcess = null;
      }
      logMsg("Preventing Mac sleep mode via caffeinate (Always-On while server running)...");
      caffeinateProcess = spawn('caffeinate', ['-di']);
      caffeinateProcess.on('error', (err) => {
        logMsg(`Failed to start caffeinate: ${err.message}`);
      });
    } catch (caffErr) {
      logMsg(`Error initializing caffeinate: ${caffErr.message}`);
    }
  }

  // Only start Supabase listener locally (not on Render cloud)
  if (supabase && !process.env.RENDER) {
    startSupabaseListener();
  }

  app.listen(PORT, () => {
    logMsg(`Server listening on port ${PORT}`);
  });
}

initApp().catch(err => {
  logMsg(`Fatal error during application startup: ${err.message}`);
  if (caffeinateProcess) caffeinateProcess.kill();
  process.exit(1);
});
