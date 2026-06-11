const fetch = require('node-fetch');

// Target API endpoint configuration
const API_BASE = 'http://localhost:8000/api';
// Insert your admin OAuth token here (or set as environment variable ADMIN_TOKEN)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

async function triggerBroadcastTest() {
  if (!ADMIN_TOKEN) {
    console.error('❌ Error: Please specify your admin token. Set it using environment variable: export ADMIN_TOKEN="your_token_here"');
    process.exit(1);
  }

  console.log('Sending broadcast test notification payload to all connected clients via server SSE stream...');
  
  try {
    const res = await fetch(`${API_BASE}/test-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({ channel: 'web-push' })
    });

    const data = await res.json();
    if (res.ok) {
      console.log('🎉 Success:', data.message);
    } else {
      console.error('❌ Failed:', data.error || data);
    }
  } catch (err) {
    console.error('❌ Error executing request:', err.message);
  }
}

triggerBroadcastTest();
