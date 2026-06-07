import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000/api' : '/api';

// ── Custom SVG Icons ────────────────────────────────────────────────────────
const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
);
const IconPause = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
);
const IconSave = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);
const IconBell = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
);
const IconTerminal = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
);
const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const IconKey = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
);
const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

const INDIA_VACs = [
  "CHENNAI VAC",
  "HYDERABAD VAC",
  "KOLKATA VAC",
  "MUMBAI VAC",
  "NEW DELHI VAC"
];

export default function App() {
  // Config state (binds to forms)
  const [formConfig, setFormConfig] = useState({
    engine: "browser",
    telegramToken: "",
    telegramChatId: "",
    emailSmtpHost: "",
    emailSmtpPort: 587,
    emailSmtpUser: "",
    emailSmtpPass: "",
    emailTo: "",
    applicantName: "",
    checkIntervalSeconds: 300,
    loginTimeoutSeconds: 600,
    checkVisaSlotsApiKey: "",
    ofcCities: [...INDIA_VACs],
    portalUsername: "",
    portalPassword: "",
    securityJob: "",
    securityCar: "",
    securitySchool: "",
    securityFood: "",
    proxyUrl: ""
  });

  // Live status state
  const [status, setStatus] = useState({
    status: "stopped",
    isActive: false,
    engine: "browser",
    lastCheckTime: null,
    availableSlots: {},
    errors: [],
    apiCreditsRemaining: null
  });

  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: "", message: "" });
  const [alertStatus, setAlertStatus] = useState({ type: "", message: "" });

  const terminalBodyRef = useRef(null);

  // Fetch initial config and system status
  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchLogs();
    fetchHistory();

    // Setup polling
    const timer = setInterval(() => {
      fetchStatus();
      fetchLogs();
      fetchHistory();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll logs terminal container only (avoids page scrolling)
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setFormConfig(data);
      setIsOffline(false);
    } catch (err) {
      setIsOffline(true);
      console.error("Failed to fetch config:", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setStatus(data);
      setIsOffline(false);
    } catch (err) {
      setIsOffline(true);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/logs`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      // Don't flood console if offline
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setHistory(data || []);
    } catch (err) {
      // Don't flood console if offline
    }
  };

  // Toggle scheduler running state
  const handleToggleScheduler = async () => {
    const newState = !status.isActive;
    try {
      const res = await fetch(`${API_BASE}/scheduler/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: newState })
      });
      if (!res.ok) throw new Error();
      fetchStatus();
      fetchLogs();
    } catch (err) {
      setAlertStatus({ type: "error", message: "Failed to toggle slot monitor." });
      setTimeout(() => setAlertStatus({ type: "", message: "" }), 3000);
    }
  };

  // Save config changes
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSaveStatus({ type: "info", message: "Saving configurations..." });
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig)
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormConfig(data.config);
      setSaveStatus({ type: "success", message: "Configurations saved successfully!" });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 3000);
      fetchStatus();
    } catch (err) {
      setSaveStatus({ type: "error", message: "Failed to update configurations." });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 4000);
    }
  };

  // Switch engines (immediately saves and toggles)
  const handleSwitchEngine = async (engine) => {
    const updated = { ...formConfig, engine };
    setFormConfig(updated);
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error();
      fetchStatus();
    } catch (err) {
      console.error("Failed to switch engine:", err);
    }
  };

  // Trigger test alerts
  const handleTestAlert = async (channel) => {
    try {
      const res = await fetch(`${API_BASE}/test-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed");
      }
      setAlertStatus({ type: "success", message: `Test alert sent to ${channel}!` });
      setTimeout(() => setAlertStatus({ type: "", message: "" }), 3500);
    } catch (err) {
      setAlertStatus({ type: "error", message: `Test failed: ${err.message}` });
      setTimeout(() => setAlertStatus({ type: "", message: "" }), 4000);
    }
  };

  const handleCityToggle = (city) => {
    const isSelected = formConfig.ofcCities.includes(city);
    let updated;
    if (isSelected) {
      updated = formConfig.ofcCities.filter(c => c !== city);
    } else {
      updated = [...formConfig.ofcCities, city];
    }
    setFormConfig({ ...formConfig, ofcCities: updated });
  };

  return (
    <div className="app-container">
      {/* Offline Alert banner */}
      {isOffline && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          color: '#f87171',
          padding: '0.75rem 1.25rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ Backend Connection Offline: Please make sure the Express Server is running on port 8000.</span>
          <button onClick={fetchConfig} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="title-area">
          <h1>US Visa Slot Alert Center 🇮🇳</h1>
          <p>OFC Appointment Monitor (India Scheduling)</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Status Indicator */}
          <div className={`status-pill ${status.status}`}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'currentColor',
              display: 'inline-block'
            }}></span>
            {status.status.replace('_', ' ')}
          </div>

          {/* Start/Stop Button */}
          <button
            onClick={handleToggleScheduler}
            disabled={isOffline}
            className={`btn ${status.isActive ? 'btn-danger' : 'btn-success'}`}
          >
            {status.isActive ? <IconPause /> : <IconPlay />}
            {status.isActive ? 'Stop Scanning' : 'Start Scanning'}
          </button>
        </div>
      </header>

      {/* Dashboard Main Grid */}
      <main className="dashboard-grid">
        
        {/* Left Column: Config Panel */}
        <section>
          <div className="glass-card">
            <div className="card-title">
              <IconSettings /> Engine Selection
            </div>

            {/* Engine Tabs */}
            <div className="engine-tabs">
              <button
                type="button"
                className={`engine-tab ${formConfig.engine === 'browser' ? 'active' : ''}`}
                onClick={() => handleSwitchEngine('browser')}
              >
                Browser Automation (direct)
              </button>
              <button
                type="button"
                className={`engine-tab ${formConfig.engine === 'api' ? 'active' : ''}`}
                onClick={() => handleSwitchEngine('api')}
              >
                CheckVisaSlots API (silent)
              </button>
            </div>

            <form onSubmit={handleSaveConfig}>
              <div className="settings-grid">
                
                {/* Engine Specific Options */}
                {formConfig.engine === 'browser' ? (
                  <>
                    <div className="form-group full-width">
                      <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#a5b4fc', lineHeight: 1.4 }}>
                        <strong>Direct Browser Automation</strong>: Uses a patched Chromium instance. Once started, a browser window will open, autofill your credentials, solve security questions automatically, and check OFC slots. You only need to solve the CAPTCHA code.
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Applicant Name (Group member match)</label>
                      <input
                        type="text"
                        placeholder="e.g. JOHN DOE (matches table row exactly)"
                        value={formConfig.applicantName}
                        onChange={(e) => setFormConfig({ ...formConfig, applicantName: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Login Timeout (seconds)</label>
                      <input
                        type="number"
                        min="60"
                        value={formConfig.loginTimeoutSeconds}
                        onChange={(e) => setFormConfig({ ...formConfig, loginTimeoutSeconds: parseInt(e.target.value) || 600 })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Portal Username / Email</label>
                      <input
                        type="text"
                        placeholder="Portal Username"
                        value={formConfig.portalUsername || ""}
                        onChange={(e) => setFormConfig({ ...formConfig, portalUsername: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Portal Password</label>
                      <input
                        type="password"
                        placeholder="Portal Password"
                        value={formConfig.portalPassword || ""}
                        onChange={(e) => setFormConfig({ ...formConfig, portalPassword: e.target.value })}
                      />
                    </div>

                    <div className="form-group full-width" style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ color: '#818cf8', fontSize: '0.75rem', fontWeight: 'bold' }}>Security Question Autofills</label>
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 1' }}>
                      <label>Job Answer</label>
                      <input
                        type="text"
                        placeholder="e.g. J"
                        value={formConfig.securityJob || ""}
                        onChange={(e) => setFormConfig({ ...formConfig, securityJob: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 1' }}>
                      <label>Car Answer</label>
                      <input
                        type="text"
                        placeholder="e.g. C"
                        value={formConfig.securityCar || ""}
                        onChange={(e) => setFormConfig({ ...formConfig, securityCar: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 1' }}>
                      <label>School Answer</label>
                      <input
                        type="text"
                        placeholder="e.g. S"
                        value={formConfig.securitySchool || ""}
                        onChange={(e) => setFormConfig({ ...formConfig, securitySchool: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 1' }}>
                      <label>Food Answer</label>
                      <input
                        type="text"
                        placeholder="e.g. F"
                        value={formConfig.securityFood || ""}
                        onChange={(e) => setFormConfig({ ...formConfig, securityFood: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group full-width">
                      <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#c084fc', lineHeight: 1.4 }}>
                        <strong>Silent API Monitor</strong>: Pulls crowdsourced slot data from the CheckVisaSlots platform. Requires no browser runtime. Enter your API key / Access Code below to query.
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label>CheckVisaSlots API Key / Access Code</label>
                      <div className="input-container">
                        <input
                          type="password"
                          placeholder="Paste your checkvisaslots token here"
                          value={formConfig.checkVisaSlotsApiKey}
                          onChange={(e) => setFormConfig({ ...formConfig, checkVisaSlotsApiKey: e.target.value })}
                        />
                      </div>
                    </div>

                  </>
                )}

                {/* Target VACs Selection */}
                <div className="form-group full-width" style={{ marginTop: '0.5rem' }}>
                  <label>Target OFC Consulates (Select to check)</label>
                  <div className="checkbox-grid">
                    {INDIA_VACs.map(city => {
                      const isChecked = formConfig.ofcCities.includes(city);
                      return (
                        <label key={city} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleCityToggle(city)}
                          />
                          <span className="checkbox-box"></span>
                          {city.replace(' VAC', '')}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Telegram Settings */}
                <div className="form-group full-width" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <label style={{ color: '#818cf8', fontWeight: 700 }}>Telegram Notification Settings</label>
                </div>

                <div className="form-group">
                  <label>Bot Token</label>
                  <input
                    type="password"
                    placeholder="Enter Telegram Bot Token"
                    value={formConfig.telegramToken}
                    onChange={(e) => setFormConfig({ ...formConfig, telegramToken: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Chat ID</label>
                  <input
                    type="text"
                    placeholder="Enter Telegram Chat ID"
                    value={formConfig.telegramChatId}
                    onChange={(e) => setFormConfig({ ...formConfig, telegramChatId: e.target.value })}
                  />
                </div>

                {/* Email (SMTP) Settings */}
                <div className="form-group full-width" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <label style={{ color: '#818cf8', fontWeight: 700 }}>SMTP Email Settings (Optional)</label>
                </div>

                <div className="form-group">
                  <label>SMTP Host</label>
                  <input
                    type="text"
                    placeholder="smtp.gmail.com"
                    value={formConfig.emailSmtpHost}
                    onChange={(e) => setFormConfig({ ...formConfig, emailSmtpHost: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>SMTP Port</label>
                  <input
                    type="number"
                    value={formConfig.emailSmtpPort}
                    onChange={(e) => setFormConfig({ ...formConfig, emailSmtpPort: parseInt(e.target.value) || 587 })}
                  />
                </div>

                <div className="form-group">
                  <label>SMTP Username / User Email</label>
                  <input
                    type="text"
                    placeholder="example@gmail.com"
                    value={formConfig.emailSmtpUser}
                    onChange={(e) => setFormConfig({ ...formConfig, emailSmtpUser: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>SMTP Password / App Key</label>
                  <input
                    type="password"
                    placeholder="Gmail App Password"
                    value={formConfig.emailSmtpPass}
                    onChange={(e) => setFormConfig({ ...formConfig, emailSmtpPass: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Recipient Email Alert Destination</label>
                  <input
                    type="text"
                    placeholder="alert-destination@domain.com"
                    value={formConfig.emailTo}
                    onChange={(e) => setFormConfig({ ...formConfig, emailTo: e.target.value })}
                  />
                </div>

                {/* Submit Panel */}
                <div className="form-group full-width" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button type="submit" disabled={isOffline} className="btn btn-primary" style={{ width: '100%' }}>
                    <IconSave /> Save All Configurations
                  </button>

                  {saveStatus.message && (
                    <div style={{
                      padding: '0.5rem',
                      fontSize: '0.8rem',
                      borderRadius: '0.25rem',
                      textAlign: 'center',
                      background: saveStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                      color: saveStatus.type === 'success' ? 'var(--success)' : '#a5b4fc',
                      border: `1px solid ${saveStatus.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`
                    }}>
                      {saveStatus.message}
                    </div>
                  )}
                </div>

              </div>
            </form>
          </div>

          {/* Test Notifications card */}
          <div className="glass-card">
            <div className="card-title">
              <IconBell /> Test Alert Routing
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.775rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              Instantly test if your alert configurations are functional by triggering dummy notifications.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: alertStatus.message ? '0.75rem' : '0' }}>
              <button onClick={() => handleTestAlert('desktop')} disabled={isOffline} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.6rem 0.25rem' }}>
                macOS Sound
              </button>
              <button onClick={() => handleTestAlert('telegram')} disabled={isOffline || !formConfig.telegramToken} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.6rem 0.25rem' }}>
                Telegram Bot
              </button>
              <button onClick={() => handleTestAlert('email')} disabled={isOffline || !formConfig.emailSmtpHost} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.6rem 0.25rem' }}>
                SMTP Email
              </button>
            </div>

            {alertStatus.message && (
              <div style={{
                padding: '0.5rem',
                fontSize: '0.8rem',
                borderRadius: '0.25rem',
                textAlign: 'center',
                background: alertStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: alertStatus.type === 'success' ? 'var(--success)' : '#f87171',
                border: `1px solid ${alertStatus.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}>
                {alertStatus.message}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Status, Log output, and History */}
        <section>
          
          {/* Current Slots Availability Card */}
          <div className="glass-card">
            <div className="card-title">
              <IconCalendar /> Target Slot Openings
            </div>
            
            <div className="slots-container">
              {INDIA_VACs.map(city => {
                const isConfigured = formConfig.ofcCities.includes(city);
                const hasSlots = status.availableSlots[city];
                
                let cardClass = "unknown";
                let statusText = "Not Monitored";
                
                if (isConfigured) {
                  if (hasSlots === true) {
                    cardClass = "available";
                    statusText = "Slots Open! 🎉";
                  } else if (hasSlots === false) {
                    cardClass = "unavailable";
                    statusText = "No Slots";
                  } else {
                    cardClass = "unknown";
                    statusText = "Pending Check";
                  }
                }

                return (
                  <div key={city} className={`slot-card ${cardClass}`}>
                    <div className="slot-city">{city.replace(' VAC', '')}</div>
                    <div className={`slot-status-text ${cardClass}`}>
                      {statusText}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Engine: <strong>{status.engine === 'browser' ? 'Browser Automation' : 'CheckVisaSlots API'}</strong></span>
              {status.engine === 'api' && typeof status.apiCreditsRemaining === 'number' && (
                <span>Credits: <strong style={{ color: status.apiCreditsRemaining < 100 ? '#f87171' : '#34d399' }}>{status.apiCreditsRemaining}</strong></span>
              )}
              <span>Last Scan: <strong>{status.lastCheckTime ? new Date(status.lastCheckTime).toLocaleTimeString() : 'Never'}</strong></span>
            </div>
          </div>

          {/* Terminal Console Logs Card */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconTerminal /> Terminal Stream
              </span>
              <button 
                onClick={fetchLogs} 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}
              >
                <IconRefresh /> Refresh
              </button>
            </div>

            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot red"></span>
                  <span className="terminal-dot yellow"></span>
                  <span className="terminal-dot green"></span>
                </div>
                <span>app.log</span>
              </div>
              <div className="terminal-body" ref={terminalBodyRef}>
                {logs.length > 0 ? (
                  logs.map((log, idx) => (
                    <div key={idx} className="log-line">{log}</div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>Console log is empty. Click Start Scanning to begin logging...</div>
                )}
              </div>
            </div>
          </div>

          {/* History Records Panel */}
          <div className="glass-card">
            <div className="card-title">
              History Logs (Last Checks)
            </div>
            
            <div className="history-table-container">
              {history.length > 0 ? (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Engine</th>
                      <th>System Status</th>
                      <th>Scan Results</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(-6).reverse().map((record, idx) => {
                      const time = new Date(record.timestamp).toLocaleTimeString();
                      const openList = Object.keys(record.slots).filter(c => record.slots[c] === true);
                      
                      return (
                        <tr key={idx}>
                          <td>{time}</td>
                          <td><code style={{ fontSize: '0.75rem' }}>{record.engine}</code></td>
                          <td><span className={`status-pill ${record.status}`} style={{ padding: '0.15rem 0.5rem', fontSize: '0.65rem' }}>{record.status}</span></td>
                          <td>
                            {openList.length > 0 ? (
                              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                                Open: {openList.map(c => c.replace(' VAC', '')).join(', ')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>No Slots</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--text-dark)', fontSize: '0.775rem', fontStyle: 'italic', padding: '0.5rem 0' }}>No history recorded yet.</div>
              )}
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
