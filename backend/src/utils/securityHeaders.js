export function checkSecurityHeaders(headers, protocol) {
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

  return {
    headersScore: score,
    headersMessage: message,
    missingHeaders: missing,
  };
}
