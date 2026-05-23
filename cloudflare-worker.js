// =======================================================================
// DryBooks Scrubber â€” Cloudflare Worker Proxy
// =======================================================================
// PURPOSE: Holds your Gemini API key on the server side so reviewers don't
// have to manage their own. The HTML calls this Worker; the Worker forwards
// to Gemini using the secret key configured in Cloudflare.
//
// DEPLOYMENT (see README.md for the full step-by-step):
// 1. Create a Cloudflare account at https://dash.cloudflare.com (free)
// 2. Workers & Pages â†’ Create â†’ Create Worker
// 3. Paste THIS ENTIRE FILE into the editor
// 4. Click "Save and Deploy"
// 5. Settings â†’ Variables â†’ "Add variable" â†’ Encrypt
//    Name: GEMINI_API_KEY
//    Value: <your Gemini key from aistudio.google.com/app/apikey>
//    Click Save.
// 6. (Optional) Add another encrypted variable named SHARED_PASSWORD
//    to require reviewers to enter a shared password. Leave blank to skip.
// 7. Copy the Worker URL (e.g. https://drybooks-scrubber.YOURNAME.workers.dev)
//    Paste it into the HTML's Settings â†’ Shared Worker URL field.
// =======================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Anyone with the URL can call. URL secrecy = your security.
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Scrubber-Password',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only POST is allowed for actual scrubs
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
    }

    // Optional shared-password check. If SHARED_PASSWORD is set in Cloudflare
    // secrets, callers must send the matching X-Scrubber-Password header.
    if (env.SHARED_PASSWORD) {
      const provided = request.headers.get('X-Scrubber-Password');
      if (provided !== env.SHARED_PASSWORD) {
        return jsonResponse({ error: 'Invalid or missing password.' }, 401);
      }
    }

    // Validate the Gemini key is configured
    if (!env.GEMINI_API_KEY) {
      return jsonResponse({
        error: 'Server misconfigured: GEMINI_API_KEY secret is not set in Cloudflare.'
      }, 500);
    }

    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    const prompt = body.prompt;
    if (!prompt || typeof prompt !== 'string') {
      return jsonResponse({ error: 'Missing "prompt" field in request body.' }, 400);
    }

    // Reasonable size cap so a runaway prompt can't burn through quota
    if (prompt.length > 200000) {
      return jsonResponse({ error: 'Prompt too large (max 200k characters).' }, 413);
    }

    // Call Gemini Flash
    try {
      // Model name: gemini-flash-latest auto-tracks Google's current stable Flash model.
      // If this stops working, replace with a current model name from https://ai.google.dev/gemini-api/docs/models
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      const upstream = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,  // Lower temperature = more consistent QC analysis
            maxOutputTokens: 8192  // Increased from 4096 â€” full 9-section analysis requires 6kâ€“8k tokens
          }
        })
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        return jsonResponse({
          error: `Gemini API error (${upstream.status}): ${errText.slice(0, 500)}`
        }, upstream.status);
      }

      const data = await upstream.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return jsonResponse({
          error: 'Gemini returned an empty response.',
          raw: data
        }, 502);
      }

      return jsonResponse({ text });
    } catch (e) {
      return jsonResponse({ error: 'Upstream call failed: ' + (e.message || String(e)) }, 502);
    }
  }
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
