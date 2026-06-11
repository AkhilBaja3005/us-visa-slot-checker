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
  "CHENNAI",
  "CHENNAI VAC",
  "HYDERABAD",
  "HYDERABAD VAC",
  "KOLKATA",
  "KOLKATA VAC",
  "MUMBAI",
  "MUMBAI VAC",
  "NEW DELHI",
  "NEW DELHI VAC"
];

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  const [activeMobileTab, setActiveMobileTab] = useState('status');

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Config state (binds to forms)
  const [formConfig, setFormConfig] = useState({
    engine: "browser",
    telegramToken: "",
    telegramChatId: "",
    applicantName: "",
    checkIntervalSeconds: 300,
    loginTimeoutSeconds: 600,
    checkVisaSlotsApiKey: "",
    ofcCities: [...INDIA_VACs],
    portalUsername: "",
    portalPassword: "",
    captchaApiKey: "",
    googleClientId: "",
    googleClientSecret: "",
    securitySchool: "",
    securityCar: "",
    securityJob: "",
    securityFood: "",
    allowedEmails: {},
    clearBrowserProfileOnStart: false
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
  
  // Auth states
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [email, setEmail] = useState(localStorage.getItem('email') || '');
  const [needLogin, setNeedLogin] = useState(false);
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userPhoneInput, setUserPhoneInput] = useState('');
  const [userRoleInput, setUserRoleInput] = useState('viewer');
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qrCode: null });

  const terminalBodyRef = useRef(null);

  // Helper for auth headers
  const getAuthHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const authedFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      ...getAuthHeaders()
    };
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 || res.status === 403) {
        const cloned = res.clone();
        const errData = await cloned.json().catch(() => ({}));
        if (errData.error && errData.error.includes("Admin privileges required")) {
          throw new Error("Admin privileges required");
        }
        // Redirect to login only if we had an authentication token to begin with (session expired/invalid)
        if (token) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          localStorage.removeItem('email');
          setToken('');
          setRole('');
          setEmail('');
          setNeedLogin(true);
        }
      }
      return res;
    } catch (e) {
      if (e.message === "Admin privileges required") throw e;
      setIsOffline(true);
      throw e;
    }
  };

  // Handle OAuth Redirect on mount
  useEffect(() => {
    if (window.location.pathname === '/login-success') {
      const params = new URLSearchParams(window.location.search);
      const tokenVal = params.get('token');
      const roleVal = params.get('role');
      const emailVal = params.get('email');
      if (tokenVal) {
        localStorage.setItem('token', tokenVal);
        localStorage.setItem('role', roleVal || '');
        localStorage.setItem('email', emailVal || '');
        setToken(tokenVal);
        setRole(roleVal || '');
        setEmail(emailVal || '');
      }
      window.location.href = '/';
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Watch for slot openings and trigger notifications / audio alerts
  const prevAvailableSlots = useRef({});
  useEffect(() => {
    if (!status.availableSlots) return;

    // Detect if any city has switched from false/pending to true (slots open)
    const newlyOpenCities = [];
    Object.entries(status.availableSlots).forEach(([city, isOpen]) => {
      const wasOpen = prevAvailableSlots.current[city];
      if (isOpen === true && wasOpen !== true) {
        newlyOpenCities.push(city);
      }
    });

    if (newlyOpenCities.length > 0) {
      // Trigger browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        newlyOpenCities.forEach(city => {
          new Notification("US Visa Slot Open!", {
            body: `Slots are OPEN in ${city}! 🎉`,
            requireInteraction: true
          });
        });
      }

      // Play audio alert (synthesized triple beep)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playBeep = (delay, frequency) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);
          gain.gain.setValueAtTime(0.5, audioCtx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.3);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + delay);
          osc.stop(audioCtx.currentTime + delay + 0.4);
        };
        playBeep(0, 880);
        playBeep(0.4, 880);
        playBeep(0.8, 880);
      } catch (e) {
        console.error("Audio play failed:", e);
      }
    }

    prevAvailableSlots.current = { ...status.availableSlots };
  }, [status.availableSlots]);

  // Helper to convert base64 VAPID public key to Uint8Array for browser API
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const requestNotificationPermission = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // Fallback to basic window Notification if push manager not supported (e.g. non-PWA iOS)
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification("Notifications Enabled!", { body: "You will receive real-time alerts." });
        }
      } else {
        alert("This browser/context does not support push notifications.");
      }
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Register/get Service Worker
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      console.log('Service Worker is active and ready:', registration);

      // Subscribe to Push Service
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BAeBCAlv578KGZjer8IA9NxERPojjK_GXFw7l3hFYNTwZQLyU3rELcvjZuT5QAFMaT8t9myvxfuw4QPL-K_cJc4')
      };

      const subscription = await registration.pushManager.subscribe(subscribeOptions);
      
      // Save subscription to backend
      await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      new Notification("PWA Alerts Activated! 📲", {
        body: "You're successfully subscribed to background notifications."
      });
    } catch (err) {
      console.error("Failed to enable background push notifications:", err);
      alert(`Failed to activate background notifications. Error: ${err.message || err}. If on iOS, make sure you added the app to your Homescreen first!`);
    }
  };



  // Sync state and stream updates
  useEffect(() => {
    let eventSource = null;
    let logsTimer = null;
    let currentInterval = 4000;

    const setupTimer = (intervalMs) => {
      if (logsTimer) clearInterval(logsTimer);
      logsTimer = setInterval(() => {
        if (role === 'admin') {
          fetchLogs();
        }
        fetchHistory();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === 'hidden';
      const newInterval = isHidden ? 15000 : 4000;
      if (newInterval !== currentInterval) {
        currentInterval = newInterval;
        setupTimer(currentInterval);
      }
    };

    const initApp = async () => {
      try {
        setNeedLogin(false);
        if (role === 'admin') {
          fetchConfig();
          fetchLogs();
        }
        fetchHistory();

        // Connect to Server-Sent Events (SSE) status stream
        const sseUrl = `${API_BASE}/status/stream` + (token ? `?token=${encodeURIComponent(token)}` : '');
        eventSource = new EventSource(sseUrl);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'notification') {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(data.title || "US Visa Slot Alert", {
                  body: data.body || "",
                  requireInteraction: true
                });
              }
            } else {
              setStatus(data);
              setIsOffline(false);
            }
          } catch (err) {
            console.error("SSE parse error:", err);
          }
        };

        eventSource.onerror = () => {
          setIsOffline(true);
        };

        // Poll logs and history, but NOT status. Only poll logs if role is admin.
        setupTimer(currentInterval);
        document.addEventListener('visibilitychange', handleVisibilityChange);
      } catch (err) {
        setIsOffline(true);
      }
    };

    initApp();

    return () => {
      if (eventSource) eventSource.close();
      if (logsTimer) clearInterval(logsTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, role]);

  // Auto-scroll logs terminal container only
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchConfig = async () => {
    try {
      const res = await authedFetch(`${API_BASE}/config`);
      if (res && res.ok) {
        const data = await res.json();
        setFormConfig(data);
        setIsOffline(false);
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      if (role !== 'admin') return; // Viewers and guests don't pull logs
      const res = await authedFetch(`${API_BASE}/logs`);
      if (res && res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      // Offline fallback
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await authedFetch(`${API_BASE}/history`);
      if (res && res.ok) {
        const data = await res.json();
        setHistory(data || []);
      }
    } catch (err) {
      // Offline fallback
    }
  };

  // Toggle scheduler running state
  const handleToggleScheduler = async () => {
    if (role === 'viewer') return;
    const newState = !status.isActive;
    try {
      const res = await authedFetch(`${API_BASE}/scheduler/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: newState })
      });
      if (!res.ok) throw new Error();
      const sData = await res.json();
      setStatus(prev => ({ ...prev, isActive: newState, status: sData.status }));
      fetchLogs();
    } catch (err) {
      setAlertStatus({ type: "error", message: "Failed to toggle slot monitor." });
      setTimeout(() => setAlertStatus({ type: "", message: "" }), 3000);
    }
  };

  // Save config changes
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    if (role === 'viewer') return;
    setSaveStatus({ type: "info", message: "Saving configurations..." });
    try {
      const res = await authedFetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig)
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormConfig(data.config || data);
      setSaveStatus({ type: "success", message: "Configurations saved successfully!" });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 3000);
    } catch (err) {
      setSaveStatus({ type: "error", message: "Failed to update configurations." });
      setTimeout(() => setSaveStatus({ type: "", message: "" }), 4000);
    }
  };

  // Switch engines (immediately saves and toggles)
  const handleSwitchEngine = async (engine) => {
    if (role === 'viewer') return;
    const updated = { ...formConfig, engine };
    setFormConfig(updated);
    try {
      const res = await authedFetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      console.error("Failed to switch engine:", err);
    }
  };

  // Trigger test alerts
  const handleTestAlert = async (channel) => {
    if (role === 'viewer') return;
    try {
      const res = await authedFetch(`${API_BASE}/test-alert`, {
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    setToken('');
    setRole('');
    setEmail('');
    setNeedLogin(true);
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/google/url?origin=${window.location.origin}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Failed to launch Google auth:", e);
    }
  };

  if (needLogin) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', width: '36px', borderRadius: '0.375rem' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>

        <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 800 }}>US Visa Slot Monitor</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Sign in to access the active slot checker console.</p>
          
          <button 
            onClick={handleGoogleLogin} 
            className="btn btn-success" 
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.75rem', 
              background: 'linear-gradient(135deg, #4285F4, #357ae8)',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
          
          { (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
              <button
                onClick={() => {
                  window.location.href = `${API_BASE}/auth/bypass-dev?origin=${window.location.origin}`;
                }}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Developer Admin Bypass (Local Dev)
              </button>
            </div>
          )}
          
          <div style={{ marginTop: '1.25rem' }}>
            <button
              onClick={() => setNeedLogin(false)}
              className="btn btn-secondary"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Back to Public Dashboard (View Only)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderSlotsCard = () => (
    <div className="glass-card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconCalendar /> Target Slot Openings
        </span>
        {'Notification' in window && Notification.permission !== 'granted' && (
          <button 
            onClick={requestNotificationPermission}
            className="btn-primary"
            style={{ padding: '4px 10px', fontSize: '12px', width: 'auto' }}
          >
            🔔 Enable Notifications
          </button>
        )}
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
              <div className="slot-city">{city}</div>
              <div className={`slot-status-text ${cardClass}`}>
                {statusText}
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Engine: <strong>{status.engine === 'browser' ? 'Browser Automation' : status.engine === 'only_login' ? 'Login Only (Browser)' : 'CheckVisaSlots API'}</strong></span>
        {status.engine === 'api' && typeof status.apiCreditsRemaining === 'number' && (
          <span>Credits: <strong style={{ color: status.apiCreditsRemaining < 100 ? '#f87171' : '#34d399' }}>{status.apiCreditsRemaining}</strong></span>
        )}
        <span>Last Scan: <strong>{status.lastCheckTime ? new Date(status.lastCheckTime).toLocaleTimeString() : 'Never'}</strong></span>
      </div>
    </div>
  );

  const renderHistoryCard = () => (
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
                          Open: {openList.join(', ')}
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
  );

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
        <div className="title-area" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--primary)', width: '38px', height: '38px', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px var(--primary-glow)', flexShrink: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22"><path d="M30 20 v10 M70 20 v10 M20 35 h60 M35 60 l10 10 l25-25" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          </div>
          <div>
            <h1 style={{ margin: 0, lineHeight: 1.2 }}>US Visa Slot Alert Center</h1>
            <p style={{ margin: 0 }}>OFC Appointment Monitor (India Scheduling)</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', width: '36px', borderRadius: '0.375rem' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>

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

          {/* Start/Stop Button / Mode Indicator */}
          {!token ? (
            <div style={{
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-muted)',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              Public View Mode
            </div>
          ) : role === 'viewer' ? (
            <div style={{
              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(217, 119, 6, 0.12)',
              border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(217, 119, 6, 0.4)',
              color: theme === 'dark' ? '#fbbf24' : '#b45309',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              Viewer Mode (Read-Only)
            </div>
          ) : (
            <button
              onClick={handleToggleScheduler}
              disabled={isOffline}
              className={`btn ${status.isActive ? 'btn-danger' : 'btn-success'}`}
            >
              {status.isActive ? <IconPause /> : <IconPlay />}
              {status.isActive ? 'Stop Scanning' : 'Start Scanning'}
            </button>
          )}

          {/* Login / Sign Out Button */}
          {token ? (
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => setNeedLogin(true)}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#fff', fontSize: '0.8rem', padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 600, borderRadius: '0.375rem' }}
            >
              Admin Sign In
            </button>
          )}
        </div>
      </header>

      {/* Dashboard Main Grid */}
      {(!token || role === 'viewer') ? (
        <main style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem 0' }}>
          {renderSlotsCard()}
          {renderHistoryCard()}
        </main>
      ) : (
        <main className="dashboard-grid">
          
          {/* Segmented tabs layout for mobile only */}
          <div className="mobile-tabs-bar">
            <button 
              type="button" 
              onClick={() => setActiveMobileTab('status')} 
              className={`mobile-tab-btn ${activeMobileTab === 'status' ? 'active' : ''}`}
            >
              📊 Slots & Logs
            </button>
            <button 
              type="button" 
              onClick={() => setActiveMobileTab('config')} 
              className={`mobile-tab-btn ${activeMobileTab === 'config' ? 'active' : ''}`}
            >
              ⚙️ Configuration
            </button>
          </div>
        
          {/* Left Column: Config Panel */}
          <section className={activeMobileTab === 'config' ? 'mobile-visible' : 'mobile-hidden'}>
            <div className="glass-card">
              <div className="card-title">
                <IconSettings /> Engine Selection
              </div>

              {/* Engine Tabs */}
              <div className="engine-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                <button
                  type="button"
                  className={`engine-tab ${formConfig.engine === 'browser' ? 'active' : ''}`}
                  onClick={() => handleSwitchEngine('browser')}
                  style={{ fontSize: '0.7rem', padding: '0.5rem 0.25rem' }}
                >
                  Browser Auto
                </button>
                <button
                  type="button"
                  className={`engine-tab ${formConfig.engine === 'only_login' ? 'active' : ''}`}
                  onClick={() => handleSwitchEngine('only_login')}
                  style={{ fontSize: '0.7rem', padding: '0.5rem 0.25rem' }}
                >
                  Login Only
                </button>
                <button
                  type="button"
                  className={`engine-tab ${formConfig.engine === 'api' ? 'active' : ''}`}
                  onClick={() => handleSwitchEngine('api')}
                  style={{ fontSize: '0.7rem', padding: '0.5rem 0.25rem' }}
                >
                  API (Silent)
                </button>
              </div>

              <form onSubmit={handleSaveConfig}>
                <fieldset disabled={role === 'viewer'} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <div className="settings-grid">
                    
                    {/* Engine Specific Options */}
                    {(formConfig.engine === 'browser' || formConfig.engine === 'only_login') ? (
                      <>
                        <div className="form-group full-width">
                          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#a5b4fc', lineHeight: 1.4 }}>
                            {formConfig.engine === 'only_login' ? (
                              <span><strong>Login Only Mode</strong>: Opens the stealth Chromium browser and automatically logs you in (autofilling your credentials & security questions). Once logged in, it remains idle and keeps the session active without checking slots, so you do not get rate-limited.</span>
                            ) : (
                              <span><strong>Direct Browser Automation</strong>: Uses a patched Chromium instance. Once started, a browser window will open, autofill your credentials, solve security questions automatically, and check OFC slots. You only need to solve the CAPTCHA code.</span>
                            )}
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

                         <div className="form-group full-width" style={{ marginTop: '0.25rem' }}>
                           <label className={`checkbox-label ${formConfig.clearBrowserProfileOnStart ? 'checked' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                             <input
                               type="checkbox"
                               checked={formConfig.clearBrowserProfileOnStart || false}
                               onChange={(e) => setFormConfig({ ...formConfig, clearBrowserProfileOnStart: e.target.checked })}
                               style={{ display: 'none' }}
                             />
                             <span className="checkbox-box"></span>
                             <span style={{ fontSize: '0.825rem', color: '#e2e8f0' }}>Clear Browser Cache/Session on Start</span>
                           </label>
                         </div>

                         {/* Security Question Answers */}
                         <div className="form-group full-width" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                           <label style={{ color: '#818cf8', fontWeight: 700 }}>Security Question Answers (Autofill)</label>
                         </div>

                         <div className="form-group">
                           <label>School / Education / College Answer</label>
                           <input
                             type="text"
                             placeholder="e.g. High School or College name"
                             value={formConfig.securitySchool || ""}
                             onChange={(e) => setFormConfig({ ...formConfig, securitySchool: e.target.value })}
                           />
                         </div>

                         <div className="form-group">
                           <label>Car / Vehicle / Automobile Answer</label>
                           <input
                             type="text"
                             placeholder="e.g. First car make/model"
                             value={formConfig.securityCar || ""}
                             onChange={(e) => setFormConfig({ ...formConfig, securityCar: e.target.value })}
                           />
                         </div>

                         <div className="form-group">
                           <label>Job / Work / Company / City Answer</label>
                           <input
                             type="text"
                             placeholder="e.g. First job city or employer"
                             value={formConfig.securityJob || ""}
                             onChange={(e) => setFormConfig({ ...formConfig, securityJob: e.target.value })}
                           />
                         </div>

                         <div className="form-group">
                           <label>Food / Favorite Dish / Restaurant Answer</label>
                           <input
                             type="text"
                             placeholder="e.g. Favorite food"
                             value={formConfig.securityFood || ""}
                             onChange={(e) => setFormConfig({ ...formConfig, securityFood: e.target.value })}
                           />
                         </div>
      
                         <div className="form-group full-width">
                           <label>2Captcha API Key (Optional auto-login solver)</label>
                           <input
                             type="password"
                             placeholder="Enter 2Captcha Key for auto CAPTCHA solving"
                             value={formConfig.captchaApiKey || ""}
                             onChange={(e) => setFormConfig({ ...formConfig, captchaApiKey: e.target.value })}
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
                              {city}
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
                        placeholder="Enter Chat ID (e.g. -100xxx)"
                        value={formConfig.telegramChatId}
                        onChange={(e) => setFormConfig({ ...formConfig, telegramChatId: e.target.value })}
                      />
                    </div>

                    {/* Google OAuth Authentication Settings */}
                    <div className="form-group full-width" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                      <label style={{ color: '#818cf8', fontWeight: 700 }}>Google Authentication Settings</label>
                    </div>

                    <div className="form-group">
                      <label>Google Client ID</label>
                      <input
                        type="text"
                        placeholder="Enter Google Client ID"
                        value={formConfig.googleClientId || ''}
                        onChange={(e) => setFormConfig({ ...formConfig, googleClientId: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Google Client Secret</label>
                      <input
                        type="password"
                        placeholder="Enter Google Client Secret"
                        value={formConfig.googleClientSecret || ''}
                        onChange={(e) => setFormConfig({ ...formConfig, googleClientSecret: e.target.value })}
                      />
                    </div>

                    {/* Submit Panel */}
                    {role !== 'viewer' && (
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
                    )}

                  </div>
                </fieldset>
              </form>

               {/* User Management Section (Admin Only) */}
              {role === 'admin' && (
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                  <h3 style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <IconSettings /> Authorized Users
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Total: {Object.keys(formConfig.allowedEmails || {}).length}
                    </span>
                  </h3>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-glass)' }}>
                    
                    {/* List existing allowed emails */}
                    {Object.keys(formConfig.allowedEmails || {}).length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>No extra users registered yet. Add emails below.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '6px' }}>
                        {Object.entries(formConfig.allowedEmails).map(([emailAddr, userRole]) => {
                          const r = typeof userRole === 'object' ? userRole.role : userRole;
                          return (
                            <div key={emailAddr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                              <span>{emailAddr} <strong style={{ color: r === 'admin' ? '#818cf8' : '#fbbf24', fontSize: '0.75rem' }}>({r})</strong></span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  const updatedEmails = { ...formConfig.allowedEmails };
                                  delete updatedEmails[emailAddr];
                                  const newConfig = { ...formConfig, allowedEmails: updatedEmails };
                                  setFormConfig(newConfig);
                                  setTimeout(() => {
                                    authedFetch(`${API_BASE}/config`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(newConfig)
                                    });
                                  }, 100);
                                }}
                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px 6px', fontSize: '0.75rem' }}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add user form */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="email" 
                        placeholder="friend@gmail.com" 
                        value={userEmailInput}
                        onChange={(e) => setUserEmailInput(e.target.value)}
                        style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '0.25rem', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                      />
                      <select 
                        value={userRoleInput}
                        onChange={(e) => setUserRoleInput(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '0.25rem', border: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!userEmailInput.trim() || !userEmailInput.includes('@')) return;
                          const updatedEmails = { ...formConfig.allowedEmails, [userEmailInput.trim()]: userRoleInput };
                          const newConfig = { ...formConfig, allowedEmails: updatedEmails };
                          setFormConfig(newConfig);
                          setUserEmailInput('');
                          setTimeout(() => {
                            authedFetch(`${API_BASE}/config`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(newConfig)
                            });
                          }, 100);
                        }}
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Notifications card */}
            {role !== 'viewer' && (
              <div className="glass-card">
                <div className="card-title">
                  <IconBell /> Test Alert Routing
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.775rem', marginBottom: '1rem', lineHeight: 1.4 }}>
                  Instantly test if your alert configurations are functional by triggering dummy notifications.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: alertStatus.message ? '0.75rem' : '0' }}>
                  <button onClick={() => handleTestAlert('desktop')} disabled={isOffline} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.6rem 0.1rem' }}>
                    macOS Sound
                  </button>
                  <button onClick={() => handleTestAlert('telegram')} disabled={isOffline || !formConfig.telegramToken} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.6rem 0.1rem' }}>
                    Telegram Bot
                  </button>
                  <button onClick={() => handleTestAlert('web-push')} disabled={isOffline} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.6rem 0.1rem' }}>
                    Browser Push
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
            )}
          </section>

          {/* Right Column: Live Status, Log output, and History */}
          <section className={activeMobileTab === 'status' ? 'mobile-visible' : 'mobile-hidden'}>
            
            {renderSlotsCard()}

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

            {renderHistoryCard()}

          </section>

        </main>
      )}
    </div>
  );
}
