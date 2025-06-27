const https = require('https');
const http = require('http');
const { renderEjs } = require('./render');
const { userAgent } = require('../controllers/homepage.controller');

function checkSecurityHeaders(httpsRes) {
  const required = [
    'x-content-type-options',
    'content-security-policy',
    'x-xss-protection',
    'strict-transport-security',
    'x-frame-options',
  ];

  const missing = required.filter(h => !httpsRes.headers[h]);
  const score = ((required.length - missing.length) / required.length) * 100;

  let message = '✅ All recommended security headers are present.';
  if (missing.length === 1) message = '✅ Slightly below optimal security.';
  if (missing.length >= 2) message = '⚠️ Some common security headers are missing.';
  if (missing.length >= 4) message = '⚠️ High chance the website may be unsafe (on the basis of headers only).';

  return { score, message, missingHeaders: missing };
}

function sendReqToGlobalServer(res, targetedURL) {
  const { hostname, protocol } = new URL(targetedURL);

  //if protocol is http - reponse user with unsafe
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

    //we are user-agent so that main server can treat our proxy server as browser instead of a nodejs server only
    //then only it will send all security headers that a client(broswer) needs
    headers: { 'User-Agent': userAgent },  

    //for checking ssl/tls certificate
    rejectUnauthorized: true,
  };

  const serverReq = scheme.request(options, (serverRes) => {
    let data = '';
    serverRes.on('data', chunk => data += chunk);
    serverRes.on('end', () => {

      //checking does the website uses all recommended security header
      const result = checkSecurityHeaders(serverRes);

      //sending result obtained to client in a dynamic ejs file 
      renderEjs(res, {
        http: false,
        status: result.message,
        score: result.score,
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

module.exports = { checkSecurityHeaders, sendReqToGlobalServer };
