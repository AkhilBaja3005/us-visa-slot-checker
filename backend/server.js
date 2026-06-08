const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
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
  engine: "browser", // "browser" or "api"
  telegramToken: "",
  telegramChatId: "",
  emailSmtpHost: "",
  emailSmtpPort: 587,
  emailSmtpUser: "",
  emailSmtpPass: "",
  emailTo: "",
  applicantName: "",
  checkIntervalSeconds: 120,
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
  securityJob: "",
  securityCar: "",
  securitySchool: "",
  securityFood: "",
  proxyUrl: ""
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

// Log Message Helper
function logMsg(message) {
  const ts = new Date().toLocaleString();
  const line = `[${ts}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, line);
  } catch (err) {
    console.error("Failed to write to app.log:", err);
  }
  console.log(line.trim());
}

// Load configurations
function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      config = { ...config, ...JSON.parse(data) };
      logMsg("Configuration loaded successfully.");
    } catch (err) {
      logMsg(`Error parsing config.json: ${err.message}`);
    }
  } else {
    saveConfig();
  }

  // Override configuration values with environment variables if present (for cloud deployment)
  if (process.env.ENGINE) config.engine = process.env.ENGINE;
  if (process.env.TELEGRAM_TOKEN) config.telegramToken = process.env.TELEGRAM_TOKEN;
  if (process.env.TELEGRAM_CHAT_ID) config.telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (process.env.CHECK_VISA_SLOTS_API_KEY) config.checkVisaSlotsApiKey = process.env.CHECK_VISA_SLOTS_API_KEY;
  if (process.env.PORTAL_USERNAME) config.portalUsername = process.env.PORTAL_USERNAME;
  if (process.env.PORTAL_PASSWORD) config.portalPassword = process.env.PORTAL_PASSWORD;
  if (process.env.APPLICANT_NAME) config.applicantName = process.env.APPLICANT_NAME;
  config.checkIntervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS) || config.checkIntervalSeconds || 120;
  if (process.env.OFC_CITIES) {
    config.ofcCities = process.env.OFC_CITIES.split(',').map(c => c.trim());
  }
  if (process.env.SECURITY_JOB) config.securityJob = process.env.SECURITY_JOB;
  if (process.env.SECURITY_CAR) config.securityCar = process.env.SECURITY_CAR;
  if (process.env.SECURITY_SCHOOL) config.securitySchool = process.env.SECURITY_SCHOOL;
  if (process.env.PROXY_URL) config.proxyUrl = process.env.PROXY_URL;
  
  // Default isActive to true on server boots unless explicitly disabled via environment
  config.isActive = process.env.IS_ACTIVE !== "false";
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    logMsg("Configuration saved to config.json.");
  } catch (err) {
    logMsg(`Error saving config.json: ${err.message}`);
  }
}

// Load and Save History
let historyLogs = [];
function loadHistory() {
  if (fs.existsSync(historyPath)) {
    try {
      const data = fs.readFileSync(historyPath, 'utf8');
      historyLogs = JSON.parse(data);
    } catch (err) {
      logMsg(`Error parsing history.json: ${err.message}`);
    }
  } else {
    saveHistory();
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(historyLogs.slice(-1000), null, 2), 'utf8'); // Keep last 1000 records
  } catch (err) {
    logMsg(`Error saving history.json: ${err.message}`);
  }
}

// Initialize files
if (!fs.existsSync(rootDir)) {
  fs.mkdirSync(rootDir, { recursive: true });
}
loadConfig();
loadHistory();
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, `[${new Date().toLocaleString()}] US Visa Slot Tracker Logs Initialized.\n`, 'utf8');
}

// ── Notification Helpers ───────────────────────────────────────────────────

function sendTelegram(message, token, chatId) {
  if (!token || !chatId || token.includes("YOUR_") || chatId.includes("YOUR_")) {
    logMsg("[Telegram] Alert skipped (credentials not configured).");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
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
  if (!mailConfig.emailSmtpHost || !mailConfig.emailTo) {
    logMsg("[Email] Alert skipped (SMTP host or recipient missing).");
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: mailConfig.emailSmtpHost,
    port: parseInt(mailConfig.emailSmtpPort) || 587,
    secure: parseInt(mailConfig.emailSmtpPort) === 465,
    auth: {
      user: mailConfig.emailSmtpUser,
      pass: mailConfig.emailSmtpPass
    }
  });

  const mailOptions = {
    from: mailConfig.emailSmtpUser || "us-visa-checker@local.com",
    to: mailConfig.emailTo,
    subject: subject,
    text: text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      logMsg(`[Email] Send error: ${error.message}`);
    } else {
      logMsg(`[Email] Sent: ${info.response}`);
    }
  });
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
    await page.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    const hostname = await page.evaluate(() => window.location.hostname);
    return !hostname.includes(LOGIN_DOMAIN);
  } catch (error) {
    logMsg(`Session alive test failed: ${error.message}`);
    return false;
  }
}

async function checkCity(page, city, shouldLoadPage = false, applicantName = "") {
  try {
    logMsg(`Selecting consulate: ${city}`);
    if (shouldLoadPage) {
      await page.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
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
    
    // Select dropdown option
    await dropdown.selectOption({ label: city });
    
    // Give page time to request new calendar layout
    await page.waitForTimeout(3000);

    // Look for "No Slots Available" banner
    const noSlots = page.locator("text=No Slots Available");
    if (await noSlots.count() > 0) {
      return false;
    }

    // Look for calendar or slot date elements
    const dateInput = page.locator("input[type='date'], input[placeholder*='MM/DD/YYYY'], table.calendar, td.available, a.ui-state-default");
    if (await dateInput.count() > 0) {
      return true;
    }

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
      const kba1R = page.locator('#kba1_response').first();
      const isSecurityPage = await kba1R.count() > 0 && await kba1R.isVisible();

      if (isSecurityPage) {
        // --- SECURITY QUESTIONS PAGE FLOW ---
        const kba1Q = page.locator('#kba1_question, #kba1_question_label, label[for="kba1_response"]').first();
        const kba2Q = page.locator('#kba2_question, #kba2_question_label, label[for="kba2_response"]').first();
        const kba2R = page.locator('#kba2_response').first();

        const getQuestionText = async (qLocator, rLocator) => {
          let text = "";
          if (await qLocator.count() > 0) {
            text = await qLocator.innerText();
          }
          if (!text.trim()) {
            text = await rLocator.evaluate(el => {
              const id = el.id;
              if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (label && label.innerText.trim()) return label.innerText.trim();
              }
              const container = el.closest('.form-group, .entry-item, .attrEntry, div');
              if (container) {
                const label = container.querySelector('label, .label');
                if (label && label.innerText.trim()) return label.innerText.trim();
                let sibling = el.previousElementSibling;
                while (sibling) {
                  if (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN' || sibling.tagName === 'DIV') {
                    const t = sibling.innerText.trim();
                    if (t) return t;
                  }
                  sibling = sibling.previousElementSibling;
                }
              }
              return "";
            }).catch(() => "");
          }
          return text.trim();
        };

        const q1Text = await getQuestionText(kba1Q, kba1R);
        let q2Text = "";
        const hasQ2 = await kba2R.count() > 0;
        if (hasQ2) {
          q2Text = await getQuestionText(kba2Q, kba2R);
        }

        // If the question text is still empty, it might be loading. Let's wait for the next iteration.
        if (!q1Text || (hasQ2 && !q2Text)) {
          logMsg("Security question labels are empty. Waiting for them to load...");
          return;
        }

        logMsg("Security questions page detected. Autofilling questions...");
        logMsg(`Question 1: "${q1Text}"`);
        if (hasQ2) {
          logMsg(`Question 2: "${q2Text}"`);
        }

        let q1Answer = "";
        let q2Answer = "";

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

        if (q1Text) {
          q1Answer = matchQuestion(q1Text);
          if (q1Answer) {
            logMsg(`Matched Q1. Autofilling: ${q1Answer}`);
            await kba1R.fill(q1Answer);
          } else {
            logMsg(`WARNING: Could not match Q1: "${q1Text}". Please answer manually.`);
          }
        }

        if (hasQ2 && q2Text) {
          q2Answer = matchQuestion(q2Text);
          if (q2Answer) {
            logMsg(`Matched Q2. Autofilling: ${q2Answer}`);
            await kba2R.fill(q2Answer);
          } else {
            logMsg(`WARNING: Could not match Q2: "${q2Text}". Please answer manually.`);
          }
        }

        const canSubmit = q1Answer && (!hasQ2 || q2Answer);
        if (canSubmit) {
          const continueBtn = page.locator('#continue, #next, button:text("Continue"), button:text("Next")').first();
          if (await continueBtn.count() > 0) {
            logMsg("Clicking continue button on security questions page...");
            await continueBtn.click();
          }
        } else {
          logMsg("Cannot auto-submit yet. Answers are missing or couldn't be matched.");
        }

      } else {
        // --- STANDARD LOGIN PAGE FLOW ---
        const emailInput = page.locator('#email, #logonIdentifier, input[type="email"], input[placeholder*="username" i]').first();
        const passwordInput = page.locator('#password, input[type="password"]').first();
        
        if (config.portalUsername && await emailInput.count() > 0) {
          const currentVal = await emailInput.inputValue().catch(() => "");
          if (!currentVal) {
            logMsg("Autofilling portal username...");
            await emailInput.fill(config.portalUsername);
          }
        }
        
        if (config.portalPassword && await passwordInput.count() > 0) {
          const currentVal = await passwordInput.inputValue().catch(() => "");
          const id = await passwordInput.getAttribute('id').catch(() => "");
          const isKbaResponse = id && id.includes("kba");
          if (!currentVal && !isKbaResponse) {
            logMsg("Autofilling portal password...");
            await passwordInput.fill(config.portalPassword);
          }
        }
      }
    }
  } catch (err) {
    logMsg(`Auto-login helper error: ${err.message}`);
  }
}

async function waitForLoginAsync(page, timeoutSeconds) {
  const timeoutMs = (timeoutSeconds || 600) * 1000;
  const startTime = Date.now();
  let reachedLoginPage = false;
  
  // Give a small wait for the initial redirect to b2clogin.com to begin
  await page.waitForTimeout(4000);
  
  while (Date.now() - startTime < timeoutMs) {
    if (!activeBrowser) {
      logMsg("Login waiting canceled – browser was closed.");
      return;
    }
    
    try {
      const url = page.url();
      const hostname = await page.evaluate(() => window.location.hostname);
      
      // If we see the login domain, we flag that we have reached the login page
      if (url.includes(LOGIN_DOMAIN) || hostname.includes(LOGIN_DOMAIN)) {
        reachedLoginPage = true;
      }
      
      // Call autofill helper only if we are on the login domain (or if we have reached it)
      if (reachedLoginPage) {
        await handleAutoLoginHelper(page);
      }
      
      // Success Criteria check:
      // We must be back on the portal domain AND not on the login domain
      const onPortal = !hostname.includes(LOGIN_DOMAIN) && hostname.includes("usvisascheduling.com");
      
      if (onPortal) {
        let isSuccess = false;
        
        if (reachedLoginPage) {
          // Case A: We went to b2clogin.com, and now we are back on the portal. This is a successful manual login.
          isSuccess = true;
        } else {
          // Case B: We loaded the page and were never redirected to b2clogin.com (e.g. cookies are alive).
          // We check if a logged-in element is visible (e.g., text including Logout, Sign Out, or Dashboard).
          const loggedInIndicator = page.locator('text=Sign Out, text=Logout, text=Dashboard, #schedule-appointment');
          if (await loggedInIndicator.count() > 0) {
            isSuccess = true;
          }
        }
        
        if (isSuccess) {
          logMsg("Login verified successfully!");
          monitorState.status = "running";
          triggerDesktopNotification("US Visa Slot Monitor", "Login verified. Direct monitoring active!");
          sendTelegram("✅ <b>Login Verified</b>. The browser monitor is now checking slots.", config.telegramToken, config.telegramChatId);
          
          // Trigger check cycle immediately
          setTimeout(runCycle, 2000);
          return;
        }
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
  sendTelegram("❌ <b>Login Timeout</b>. Slot monitor has been stopped.", config.telegramToken, config.telegramChatId);
  cleanupBrowser();
}

async function waitForLoginContribution(page, timeoutSeconds) {
  const timeoutMs = (timeoutSeconds || 180) * 1000;
  const startTime = Date.now();
  let reachedLoginPage = false;
  
  await page.waitForTimeout(4000);
  
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

  let browserContext = null;
  let page = null;

  try {
    logMsg("Launching Chromium for contribution check...");
    browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      slowMo: 50,
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    page = browserContext.pages()[0] || await browserContext.newPage();
    logMsg("Navigating to login page for contribution...");
    await page.goto(HOME_URL);

    const isSuccess = await waitForLoginContribution(page, 180);
    if (isSuccess) {
      logMsg("Contribution login verified. Loading OFC page...");
      await page.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
  const { chromium } = require('patchright');

  // Launch browser if not running
  if (!activeBrowser) {
    monitorState.status = "starting";
    logMsg("Launching Chromium via Patchright stealth...");
    try {
      const userDataDir = path.join(rootDir, 'browser_profile');
      const extensionPath = path.join(__dirname, 'extension');

      activeContext = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        slowMo: 50,
        viewport: { width: 1280, height: 800 },
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`
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
      monitorState.status = "awaiting_login";
      logMsg("Waiting for manual login inside browser window...");
      
      triggerDesktopNotification("US Visa Action Required", "Please complete the portal login flow.");
      sendTelegram("🤖 <b>Visa Monitor</b>: Awaiting portal login in Chromium window.", config.telegramToken, config.telegramChatId);
      
      await activePage.goto(HOME_URL);
      
      // Async poll for login
      waitForLoginAsync(activePage, config.loginTimeoutSeconds);
      return;
    } catch (err) {
      logMsg(`Failed to launch browser: ${err.message}`);
      monitorState.status = "error";
      config.isActive = false;
      saveConfig();
      cleanupBrowser();
      return;
    }
  }

  // If waiting for login, let the async check handle it
  if (monitorState.status === "awaiting_login" || monitorState.status === "awaiting_relogin") {
    logMsg("Currently waiting for credentials / CAPTCHAs in the browser.");
    return;
  }

  // Load the OFC scheduling page once to start the checking process and check session validity
  logMsg("Loading OFC scheduling page...");
  try {
    await activePage.goto(OFC_SCHEDULE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await activePage.waitForTimeout(2000);
    
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
  } catch (err) {
    logMsg(`Failed to load OFC page: ${err.message}`);
    if (!activeBrowser) return; // Browser closed
    monitorState.errors.push({ time: new Date().toISOString(), message: `Failed to load OFC page: ${err.message}` });
    return;
  }

  // Run checks
  monitorState.status = "running";
  const foundSlots = [];
  const results = {};

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
    } else {
      logMsg("No slots detected in CheckVisaSlots data.");
    }
  } catch (err) {
    logMsg(`API check cycle failed: ${err.message}`);
    monitorState.errors.push({ time: new Date().toISOString(), message: err.message });
  }
}

// ── Background Interval Manager ─────────────────────────────────────────────

let schedulerIntervalId = null;
let contributionIntervalId = null;
let hourlySummaryIntervalId = null;
let isChecking = false;

// Track history over the last hour for cumulative notifications
let hourlyChecksCount = 0;
let hourlySuccessfulChecks = 0;
let hourlyCreditsStart = null;
let hourlyCreditsEnd = null;

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
    logMsg("Active check cycle in progress. Skipping duplicate loop.");
    return;
  }
  isChecking = true;

  try {
    monitorState.lastCheckTime = new Date().toISOString();
    hourlyChecksCount++;
    if (hourlyCreditsStart === null && monitorState.apiCreditsRemaining !== null) {
      hourlyCreditsStart = monitorState.apiCreditsRemaining;
    }

    if (config.engine === "browser") {
      await runBrowserCycle();
      hourlySuccessfulChecks++;
    } else {
      await runApiCycle();
      hourlySuccessfulChecks++;
      hourlyCreditsEnd = monitorState.apiCreditsRemaining;
    }
  } catch (err) {
    logMsg(`Scheduler execution failed: ${err.message}`);
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
    saveHistory();
  }
}

function startScheduler() {
  if (schedulerIntervalId) clearInterval(schedulerIntervalId);
  if (contributionIntervalId) clearInterval(contributionIntervalId);
  if (hourlySummaryIntervalId) clearInterval(hourlySummaryIntervalId);
  
  logMsg("Starting background scheduler loop...");
  config.isActive = true;
  saveConfig();
  
  // Set up hourly stat counters
  hourlyChecksCount = 0;
  hourlySuccessfulChecks = 0;
  hourlyCreditsStart = monitorState.apiCreditsRemaining;

  runCycle(); // Initial immediate check
  
  const intervalMs = Math.max((config.checkIntervalSeconds || 120), 60) * 1000;
  schedulerIntervalId = setInterval(runCycle, intervalMs);
  
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
  
  monitorState.status = config.engine === "browser" ? "starting" : "running";
}

function stopScheduler() {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
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
}

// Auto-start scheduler if configured active
if (config.isActive) {
  startScheduler();
}


function formatToIST(gmtStr) {
  if (gmtStr === "N/A" || gmtStr === undefined || gmtStr === null) return "N/A";
  try {
    const d = new Date(gmtStr);
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
  } catch (e) {
    return gmtStr;
  }
}

// ── REST API Endpoints ──────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const originalActive = config.isActive;
  config = { ...config, ...req.body };
  
  // Do not allow editing isActive directly via this config update endpoint to avoid race conditions
  config.isActive = originalActive; 
  saveConfig();
  
  logMsg("Configuration updated via API.");
  
  // If scheduler is currently running, restart it to apply new intervals/filters
  if (config.isActive) {
    startScheduler();
  }
  res.json({ message: "Configuration updated successfully", config });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: monitorState.status,
    isActive: config.isActive,
    engine: config.engine,
    lastCheckTime: monitorState.lastCheckTime,
    availableSlots: monitorState.availableSlots,
    errors: monitorState.errors.slice(-10), // Only send recent errors
    apiCreditsRemaining: monitorState.apiCreditsRemaining
  });
});

app.get('/api/history', (req, res) => {
  res.json(historyLogs.slice(-100)); // Send last 100 entries
});

app.post('/api/scheduler/toggle', (req, res) => {
  const { start } = req.body;
  if (start) {
    startScheduler();
    res.json({ message: "Scheduler started", status: monitorState.status });
  } else {
    stopScheduler();
    res.json({ message: "Scheduler stopped", status: monitorState.status });
  }
});

app.post('/api/test-alert', (req, res) => {
  const { channel } = req.body;
  const timeStr = new Date().toLocaleTimeString();
  logMsg(`Triggering test alert on channel: ${channel}`);

  if (channel === "desktop") {
    triggerDesktopNotification("US Visa Alert Test", "This is a test notification from US Visa Slot Monitor. Audio check active.");
    res.json({ message: "Desktop alert triggered" });
  } else if (channel === "telegram") {
    sendTelegram(`🤖 <b>US Visa Monitor Test</b>\n\nThis is a test message confirming your Telegram notification settings are correct!\n🕐 Sent at: ${timeStr}`, config.telegramToken, config.telegramChatId);
    res.json({ message: "Telegram alert sent" });
  } else if (channel === "email") {
    sendEmail(
      "US Visa Slot Alert - SMTP Test Connection",
      `Hello!\n\nThis email confirms that your SMTP configurations are functional.\n\nChecked at: ${timeStr}\nUS Visa Slot Monitor`,
      config
    );
    res.json({ message: "SMTP test email dispatched" });
  } else {
    res.status(400).json({ error: "Invalid notification channel requested" });
  }
});

app.get('/api/logs', (req, res) => {
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

app.listen(PORT, () => {
  logMsg(`Server listening on port ${PORT}`);
});
