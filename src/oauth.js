// Shared "sign in through the browser" helper for installed apps:
// opens the provider's page in the default browser, catches the redirect on a
// short-lived local web server (loopback), and uses PKCE so no code can be replayed.
const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');

let cancelCurrent = null; // ends the sign-in that is waiting, if any
function cancelSignIn() {
  if (cancelCurrent) cancelCurrent();
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const page = (ok, msg) => `<!doctype html><meta charset="utf-8"><title>Sky Reminders</title>
<body style="font-family:Segoe UI,system-ui,sans-serif;background:#fdf6ec;color:#2b2d42;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><div style="font-size:56px">${ok ? '🎈' : '😕'}</div><h2>${msg}</h2><p>You can close this tab and go back to Sky Reminders.</p></div></body>`;

// Listens on both 127.0.0.1 and ::1 (same port) so "localhost" works whichever one the browser picks.
function listenLoopback(handler) {
  return new Promise((resolve, reject) => {
    const v4 = http.createServer(handler);
    v4.once('error', reject);
    v4.listen(0, '127.0.0.1', () => {
      const port = v4.address().port;
      const v6 = http.createServer(handler);
      v6.once('error', () => resolve({ port, close: () => v4.close() })); // no IPv6: fine
      v6.listen(port, '::1', () => resolve({ port, close: () => (v4.close(), v6.close()) }));
    });
  });
}

/**
 * @param {object} o
 * @param {string} o.authUrl   provider authorize endpoint
 * @param {string} o.host      'localhost' or '127.0.0.1' (what the provider has registered)
 * @param {object} o.params    extra query params (client_id, scope, ...)
 * @param {(r: {code: string, redirectUri: string, verifier: string}) => Promise<{email: string}>} o.finish
 *        exchanges the code for tokens; its result is returned from loopbackSignIn
 */
async function loopbackSignIn({ authUrl, host, params, finish }) {
  cancelSignIn(); // only one sign-in at a time
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  let redirectUri;

  return new Promise(async (resolve, reject) => {
    let server;
    let done = false;
    const end = (err, value) => {
      if (done) return;
      done = true;
      cancelCurrent = null;
      clearTimeout(timer);
      if (server) server.close();
      err ? reject(err) : resolve(value);
    };
    const timer = setTimeout(() => end(new Error('Sign-in timed out after 5 minutes')), 5 * 60000);
    cancelCurrent = () => end(new Error('cancelled'));

    server = await listenLoopback(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname !== '/') return res.writeHead(404).end();
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      if (err || !code || url.searchParams.get('state') !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(page(false, 'Sign-in was cancelled'));
        const desc = url.searchParams.get('error_description');
        return end(new Error(err ? `${err}${desc ? ': ' + desc : ''}` : 'Sign-in failed'));
      }
      try {
        const result = await finish({ code, redirectUri, verifier });
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(page(true, `Connected ${result.email}`));
        end(null, result);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' }).end(page(false, 'Could not finish sign-in'));
        end(e);
      }
    }).catch((e) => (end(e), null));
    if (!server) return;

    redirectUri = `http://${host}:${server.port}`;
    const q = new URLSearchParams({
      ...params,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    shell.openExternal(`${authUrl}?${q}`);
  });
}

async function postForm(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error_description || json.error || `HTTP ${res.status}`);
    e.code = json.error;
    throw e;
  }
  return json;
}

function jwtClaims(idToken) {
  return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64').toString());
}

module.exports = { loopbackSignIn, cancelSignIn, postForm, jwtClaims };
