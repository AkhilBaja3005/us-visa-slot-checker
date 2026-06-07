// US Visa Slot Checker — Cloudflare Worker API Proxy
// Acts as a proxy gateway to bypass WAF blocks for Render/local backends

export default {
  async fetch(request, env, ctx) {
    // Enable CORS so your Render frontend/backend can easily communicate with it
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, extversion, origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Forward the request to CheckVisaSlots API
    const targetUrl = "https://app.checkvisaslots.com/slots/v3";
    
    // Copy the critical headers from Render request
    const headers = new Headers();
    headers.set("x-api-key", request.headers.get("x-api-key") || env.CHECK_VISA_SLOTS_API_KEY || "");
    headers.set("extversion", "4.7.0.2");
    headers.set("origin", "chrome-extension://beepaenfejnphdgnkmccjcfiieihhogl");
    headers.set("accept", "*/*");
    headers.set("user-agent", request.headers.get("user-agent") || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36");

    try {
      console.log("Forwarding slot request to CheckVisaSlots...");
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: headers
      });

      const data = await response.text();

      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
};
