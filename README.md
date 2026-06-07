# US Visa Slot Checker & Management Suite 🇮🇳

An enterprise-grade, high-performance monitoring system and dashboard for US Visa slots (India VAC scheduling). This suite provides a unified management control plane supporting dual monitoring engines: direct browser-based automation via Patchright and silent, lightweight, crowdsourced API monitoring via CheckVisaSlots. 

---

## 🏗️ Technical Architecture & Network Design

To bypass Cloud WAF restrictions (e.g., AWS WAF blocking cloud provider IP ranges of platforms like Hugging Face or Render), this project utilizes a **hybrid dual-platform architecture**:

```
                                      +---------------------------------------------+
                                      |            Local Mac / Device               |
                                      | (Runs Browser Automation & Screen Contribs) |
                                      +---------------------------------------------+
                                                             |
                                                       Refills Credits
                                                             v
+------------------------+  === HTTP ===>  +-------------------------+  === HTTP ===>  +---------------------+
|     Render Service     |   (Key/Token)   |   Cloudflare Worker     |                 | CheckVisaSlots API  |
|  - Web Dashboard UI    |                 |   - WAF Proxy Gateway   |                 | - Crowdsourced Data |
|  - Scheduler Loop      |                 |   - Edge Network IP     |                 | - 1 Credit/Request  |
|  - Telegram Alerts     |                 |                         |                 |                     |
+------------------------+                 +-------------------------+                 +---------------------+
```

1. **Dashboard & Scheduler Orchestrator (Render)**: Runs the Express server, hosts the React dashboard, logs slot history, and handles Telegram, Email, and macOS Desktop notification logic.
2. **API Proxy (Cloudflare Workers)**: Runs on Cloudflare's globally distributed Edge Network. Requests routed through the Cloudflare Worker utilize edge IPs which are not blocked by AWS WAF, serving as a reliable gateway.

---

## 🚀 Live Deployments
- **Render Dashboard Web Interface**: [https://us-visa-slot-checker.onrender.com](https://us-visa-slot-checker.onrender.com)
- **Cloudflare API Proxy URL**: `https://us-visa-slot-checker.akhilkumarbaja.workers.dev`

---

## ⚙️ How the Engines Work

### 1. Browser Automation Engine (Direct Local Scan)
Uses **Patchright** (a security-focused fork of Playwright) to run a stealth Chromium browser locally on your Mac.
- **Autofill Login**: Feeds in `portalUsername` and `portalPassword` on the Atlasauth B2C Login portal.
- **Autofill Security Questions**: Identifies the question text on screen and matches it with your stored answers (`securityJob`, `securityCar`, `securitySchool`, `securityFood`).
- **Applicant Selection**: Selects the primary applicant checkbox matching `applicantName` on the OFC scheduling screen.
- **Visual Validation**: Scrapes the calendar DOM tables (`a.ui-state-default`, `td.available`) to verify real dates instead of "No Slots Available" overlays.

### 2. Crowdsourced API Engine (Cloud/Proxy Scan)
Uses **CheckVisaSlots** crowdsourced data.
- **Authentication**: Authenticates via header `x-api-key`.
- **IP Masking**: The backend routes queries through the Cloudflare Worker URL, transforming it into a secure gateway.
- **API Credits**: Tracks remaining user credits in real-time. If the credit balance falls below 100, the system triggers an automated low-credit alert via Telegram.

---

## 🛠️ Step-by-Step Setup Guide

### 1. Cloudflare Workers Setup (API Proxy)
1. Navigate to the `cloudflare-worker/` subdirectory:
   ```bash
   cd cloudflare-worker
   ```
2. Log in to your Cloudflare account using Wrangler CLI:
   ```bash
   npx wrangler login
   ```
3. Set your CheckVisaSlots API key as a secure secret in Cloudflare:
   ```bash
   echo "YOUR_API_KEY" | npx wrangler secret put CHECK_VISA_SLOTS_API_KEY
   ```
4. Deploy the proxy worker to Cloudflare:
   ```bash
   npx wrangler deploy
   ```
5. Note the deployed URL (e.g., `https://us-visa-slot-checker.akhilkumarbaja.workers.dev`).

### 2. Render Deployment Setup (Dashboard)
1. Connect your private GitHub repository to your [Render account](https://render.com).
2. Create a new **Web Service** pointing to this repository.
3. Configure the runtime settings:
   - **Runtime**: `Docker`
   - **Instance Type**: `Free`
4. Add the following **Environment Variables** in Render Settings:

| Environment Variable | Example Value | Description |
| :--- | :--- | :--- |
| `ENGINE` | `api` | Switches the scan engine to crowdsourced API mode (`api` or `browser`) |
| `CHECK_VISA_SLOTS_API_KEY` | `UMDWWV` | Your access token for CheckVisaSlots API |
| `TELEGRAM_TOKEN` | `8896801436:AAGBJEQX...` | Your Telegram Bot token |
| `TELEGRAM_CHAT_ID` | `-5246461181` | Destination Group or Channel Chat ID |
| `PORT` | `7860` | Web Service listener port |

Render will automatically compile the Docker container, run the Vite frontend build task, and host the dashboard.

---

## 💻 Local Development & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- Chrome / Chromium (installed on Mac for browser automation)

### 2. Installation
1. Clone the repository and install dependencies in the root:
   ```bash
   npm install
   ```
2. Install frontend and backend specific packages:
   ```bash
   npm run install-all
   ```

### 3. Local Config Setup
Create a file named `config.json` in the root folder of the project. Since it contains credentials, it is ignored by Git:
```json
{
  "engine": "api",
  "telegramToken": "YOUR_TELEGRAM_TOKEN",
  "telegramChatId": "YOUR_TELEGRAM_CHAT_ID",
  "emailSmtpHost": "",
  "emailSmtpPort": 587,
  "emailSmtpUser": "",
  "emailSmtpPass": "",
  "emailTo": "",
  "applicantName": "Akhil Baja",
  "checkIntervalSeconds": 180,
  "loginTimeoutSeconds": 600,
  "checkVisaSlotsApiKey": "UMDWWV",
  "ofcCities": [
    "CHENNAI VAC",
    "HYDERABAD VAC",
    "KOLKATA VAC",
    "MUMBAI VAC",
    "NEW DELHI VAC"
  ],
  "isActive": true,
  "portalUsername": "AkhilB2026",
  "portalPassword": "YOUR_PASSWORD",
  "securityJob": "J",
  "securityCar": "C",
  "securitySchool": "S",
  "securityFood": "F"
}
```

### 4. Running the Project Locally
Run the concurrent dev command:
```bash
npm run dev
```
Open **`http://localhost:5173`** to access the web dashboard interface.

---

## ⚠️ Troubleshooting & Credit Maintenance

### 1. Credit Recharge
The API engine consumes **1 credit per scan**. To keep the system running 24/7 on the cloud:
1. Keep the CheckVisaSlots Extension running in your local Chrome browser.
2. Log into `usvisascheduling.com` on your Mac.
3. Keep the tab open; the extension will automatically take encrypted screenshots of slot details and upload them to the crowdsourcing pool, rewarding you with slot credits.

### 2. AWS WAF Block (403 Forbidden Error)
If the Render log stream indicates `API error code 403: {"message":"Forbidden"}`, it means the API target is being queried directly instead of through the Cloudflare proxy worker. Double-check that your `backend/server.js` is targeting your custom Cloudflare Worker URL:
```javascript
const url = "https://us-visa-slot-checker.akhilkumarbaja.workers.dev";
```
