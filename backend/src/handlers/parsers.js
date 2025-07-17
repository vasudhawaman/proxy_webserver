// backend/src/handlers/parsers.js

export const MALICIOUS_HTML_PATTERNS = [
  { name: '<script>', regex: /<script[\s>]/gi },
  { name: 'javascript:', regex: /javascript:/gi },
  { name: 'inline event handler', regex: /on\w+\s*=/gi },
  { name: '<iframe>', regex: /<iframe[\s>]/gi }
];

export const MALICIOUS_JS_PATTERNS = [
  { name: 'eval', regex: /\beval\s*\(/gi },
  { name: 'Function constructor', regex: /\bnew Function\s*\(/gi },
  { name: 'setTimeout string', regex: /setTimeout\s*\(\s*['"`]/gi },
  { name: 'setInterval string', regex: /setInterval\s*\(\s*['"`]/gi },
  { name: 'document.write', regex: /document\.write\s*\(/gi },
  { name: 'window.location', regex: /window\.location\s*=/gi },
  { name: 'script src', regex: /src\s*=\s*['"`].*\.js['"`]/gi },
  { name: 'XMLHttpRequest', regex: /XMLHttpRequest/gi },
  { name: 'fetch(', regex: /\bfetch\s*\(/gi }
];

export function countMaliciousPatterns(text, patterns) {
  let total = 0;
  let found = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern.regex);
    if (matches) {
      total += matches.length;
      found.push({ name: pattern.name, count: matches.length });
    }
  });
  return { total, found };
}

export function generateHtmlWarning(result) {
  if (result.total === 0) return '';
  return `<div style="background:#ffdddd;border:1px solid #ff8888;padding:1em;margin-bottom:1em;">
    <strong>Warning:</strong> Detected <b>${result.total}</b> potentially malicious HTML keyword(s) in this response.<br>
    ${result.found.map(f => `<span>${f.name}: ${f.count}</span>`).join('<br>')}
  </div>`;
}

export function generateJsWarning(result) {
  if (result.total === 0) return '';
  return `/* WARNING: Detected ${result.total} potentially malicious JavaScript keyword(s):\n` +
    result.found.map(f => `   - ${f.name}: ${f.count}`).join('\n') +
    '\n*/\n';
}

export function isLikelyJS(contentType, path) {
  if (!contentType && !path) return false;
  if (contentType && contentType.includes('application/javascript')) return true;
  if (contentType && contentType.includes('text/javascript')) return true;
  if (path && path.match(/\.js(\?.*)?$/i)) return true;
  return false;
}
