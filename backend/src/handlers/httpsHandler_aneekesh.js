import https from 'https';
import net from 'net';
import url from 'url';
import { createFakeCert } from '../utils/createCert.js';
import { renderEjs } from '../utils/render.js';
import { useGoogleAPI } from '../utils/googleSafeBrowsing.js';
import { checkSecurityHeaders } from '../utils/securityHeaders.js';
import { checkSSL } from '../utils/checkSsl.js';
import { Parser } from 'htmlparser2';

// List of malicious patterns for HTML
const MALICIOUS_HTML_PATTERNS = [
  { name: '<script>', regex: /<script[\s>]/gi },
  { name: 'javascript:', regex: /javascript:/gi },
  { name: 'inline event handler', regex: /on\w+\s*=/gi },
  { name: '<iframe>', regex: /<iframe[\s>]/gi }
  // Add more as needed
];

// List of malicious patterns for JavaScript
const MALICIOUS_JS_PATTERNS = [
  { name: 'eval', regex: /\beval\s*\(/gi },
  { name: 'Function constructor', regex: /\bnew Function\s*\(/gi },
  { name: 'setTimeout string', regex: /setTimeout\s*\(\s*['"`]/gi },
  { name: 'setInterval string', regex: /setInterval\s*\(\s*['"`]/gi },
  { name: 'document.write', regex: /document\.write\s*\(/gi },
  { name: 'window.location', regex: /window\.location\s*=/gi },
  { name: 'script src', regex: /src\s*=\s*['"`].*\.js['"`]/gi },
  { name: 'XMLHttpRequest', regex: /XMLHttpRequest/gi },
  { name: 'fetch(', regex: /\bfetch\s*\(/gi }
  // Add more as needed
];

function countMaliciousPatterns(text, patterns) {
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

function isLikelyJS(contentType, path) {
  if (!contentType && !path) return false;
  if (contentType && contentType.includes('application/javascript')) return true;
  if (contentType && contentType.includes('text/javascript')) return true;
  if (path && path.match(/\.js(\?.*)?$/i)) return true;
  return false;
}

export const handleHttpsConnect = (req, clientSocket, head) => {
  clientSocket.on('error', (err) => {
    console.error('clientSocket error:', err.message);
  });

  const [host, port] = req.url.split(':');
  const { cert, key } = createFakeCert(host);

  const httpsServer = https.createServer(
    { key, cert },
    (httpsReq, httpsRes) => {
      httpsReq.on('error', (err) => {
        console.error('httpsReq error:', err.message);
      });

      try {
        const parsedUrl = url.parse(httpsReq.url, true);
        const options = {
          hostname: parsedUrl.hostname || host,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: httpsReq.method,
          headers: httpsReq.headers,
        };

        const fullUrl = `https://${options.hostname}:${options.port}${options.path}`;
        const proxyReq = https.request(options, async (proxyRes) => {
          // SSL certificate extraction
          const { sslTlsStatus, sslDetails } = checkSSL(proxyRes);

          // Only show response page if ?continue is not present
          if (!parsedUrl.query.continue) {
            const googleApiResult = await useGoogleAPI(fullUrl);
            const headersResult = checkSecurityHeaders(
              proxyRes.headers,
              'https'
            );

            const valueObj = {
              protocol: 'https',
              googleApiResult,
              headerScore: headersResult.headersScore,
              headerMessage: headersResult.headersMessage,
              missingHeaders: headersResult.missingHeaders,
              sslTlsStatus,
              sslDetails,
              redirectTo: fullUrl,
              visit: true,
            };

            return renderEjs(httpsRes, valueObj);
          }

          // Detect content type and path
          const contentType = proxyRes.headers['content-type'] || '';
          const isJS = isLikelyJS(contentType, parsedUrl.pathname);
          const isHTML = contentType.includes('text/html');

          if (isHTML || isJS) {
            // Buffer the proxy response
            let bodyChunks = [];
            proxyRes.on('data', chunk => {
              bodyChunks.push(chunk);
            });
            proxyRes.on('end', () => {
              const body = Buffer.concat(bodyChunks).toString('utf-8');
              let result, warningText = '';

              if (isHTML) {
                result = countMaliciousPatterns(body, MALICIOUS_HTML_PATTERNS);
                if (result.total > 0) {
                  warningText = `<div style="background:#ffdddd;border:1px solid #ff8888;padding:1em;margin-bottom:1em;">
                    <strong>Warning:</strong> Detected <b>${result.total}</b> potentially malicious HTML keyword(s) in this response.<br>
                    ${result.found.map(f => `<span>${f.name}: ${f.count}</span>`).join('<br>')}
                  </div>`;
                }
              } else if (isJS) {
                result = countMaliciousPatterns(body, MALICIOUS_JS_PATTERNS);
                if (result.total > 0) {
                  warningText = `/* WARNING: Detected ${result.total} potentially malicious JavaScript keyword(s):\n` +
                                result.found.map(f => `   - ${f.name}: ${f.count}`).join('\n') +
                                '\n*/\n';
                }
              }

              httpsRes.writeHead(proxyRes.statusCode, proxyRes.headers);
              if (isJS && result.total > 0) {
                httpsRes.end(warningText + body);
              } else if (isHTML && result.total > 0) {
                httpsRes.end(warningText + body);
              } else {
                httpsRes.end(body);
              }
            });
            proxyRes.on('error', (err) => {
              console.error('proxyRes error (buffering):', err.message);
              httpsRes.writeHead(502);
              httpsRes.end('Bad Gateway');
            });
          } else {
            // Non-HTML/JS: stream as usual
            httpsRes.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(httpsRes);
          }
        });

        proxyReq.on('error', (err) => {
          console.error('proxyReq (HTTPS) error:', err.message);
          httpsRes.writeHead(502);
          httpsRes.end('Bad Gateway');
        });

        httpsReq.pipe(proxyReq);
      } catch (error) {
        console.log('Error in https server cb :', error.message);
        httpsRes.end('Error in https server cb');
      }
    }
  );

  httpsServer.on('error', (err) => {
    console.error('httpsServer error:', err.message);
    clientSocket.end();
  });

  httpsServer.listen(0, () => {
    const address = httpsServer.address();
    const tunnelSocket = net.connect(address.port, '127.0.0.1', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      tunnelSocket.write(head);
      clientSocket.pipe(tunnelSocket);
      tunnelSocket.pipe(clientSocket);
    });

    tunnelSocket.on('error', (err) => {
      console.error('tunnelSocket error:', err.message);
      clientSocket.end();
    });
  });
};
