// utils/securityCheck.js
import https from 'https';
import http from 'http';
import { renderEjs } from './render.js';

function checkSecurityHeaders(headers, protocol) {
  const required = [
    'x-content-type-options',
    'content-security-policy',
    'x-xss-protection',
    protocol === 'https' ? 'strict-transport-security' : null,
    'x-frame-options',
  ];

  const missing = required.filter((h) => h && !headers[h]);
  const score = ((required.length - missing.length) / required.length) * 100;

  let message = '✅ All recommended security headers are present.';
  if (missing.length === 1) {
    message = '✅ Slightly below optimal security.';
  }
  if (missing.length >= 2) {
    message = '⚠️ Some common security headers are missing.';
  }
  if (missing.length === 4) {
    message =
      '⚠️ High chance the website may be unsafe (on the basis of headers only).';
  }
  if (missing.length === 5) {
    message =
      '❌ No security headers detected. It is strongly advised not to use or browse this website.';
  }

  return { headersScore: score, headersMessage: message, missingHeaders: missing };
}

function sendReqToGlobalServer(res, targetedURL) {
  const { hostname, protocol } = new URL(targetedURL);

  if (protocol === 'http:') {
    return renderEjs(res, {
      http: true,
      status: null,
      score: null,
      missingHeaders: null,
      redirectURL: targetedURL,
    });
  }

  const scheme = protocol === 'https:' ? https : http;

  const options = {
    hostname,
    path: '/',
    method: 'GET',
    headers: { 'User-Agent': userAgent },
    rejectUnauthorized: true,
  };

  const serverReq = scheme.request(options, (serverRes) => {
    let data = '';
    serverRes.on('data', (chunk) => (data += chunk));
    serverRes.on('end', () => {
      const result = checkSecurityHeaders(serverRes.headers, protocol.slice(0, -1));

      renderEjs(res, {
        http: false,
        status: result.headersMessage,
        score: result.headersScore,
        missingHeaders: result.missingHeaders,
        redirectURL: targetedURL,
      });
    });
  });

  serverReq.on('error', () => {
    res.writeHead(500);
    res.end('Error connecting to target website.');
  });

  serverReq.end();
}

export { checkSecurityHeaders, sendReqToGlobalServer };
