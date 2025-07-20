// httpHandler.js
import http from 'http';
import url from 'url';
import https from 'https';
import zlib from 'zlib';

import { useGoogleAPI } from '../utils/googleSafeBrowsing.js';
import { renderEjs, setupHttpEjs } from '../utils/render.js';
import { checkSecurityHeaders } from '../utils/securityHeaders.js';
import { checkSSL } from '../utils/checkSsl.js';
import { feedbackHandler } from './feedbackHandler.js';
import { getFeedbackStatus } from '../utils/feedback.js';
import { sendCertificate } from '../utils/sendCertificate.js';
import { detectMaliciousCode } from '../parser/htmlParser.js';

// Exported so httpsHandler can access it
export let isParserActive = false;

export const handleHttpRequest = async (clientReq, clientRes) => {
  clientReq.on('error', (err) => {
    console.error('clientReq error:', err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
    }
    clientRes.end('Client Request Error');
  });

  // CORS
  clientRes.setHeader('Access-Control-Allow-Origin', '*');
  clientRes.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, DELETE, OPTIONS'
  );
  clientRes.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (clientReq.method === 'OPTIONS') {
    clientRes.writeHead(204);
    return clientRes.end();
  }

  const parsedUrl = url.parse(clientReq.url, true);
  let fullUrl = '';
  let options = {};

  if (parsedUrl.pathname === '/parser-state' && clientReq.method === 'POST') {
    let body = '';
    clientReq.on('data', (chunk) => (body += chunk));
    clientReq.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        isParserActive = parsed.isParserActive;
        clientRes.writeHead(201, { 'Content-Type': 'text/plain' });
        clientRes.end('State Received');
      } catch (err) {
        console.error('Invalid JSON:', err);
        clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
        clientRes.end('Invalid JSON');
      }
    });
    return;
  }

  if (parsedUrl.pathname === '/feedback') {
    return feedbackHandler(clientReq, clientRes);
  }

  if (parsedUrl.pathname === '/get-certificate' && clientReq.method === 'GET') {
    return sendCertificate(clientReq, clientRes);
  }

  if (parsedUrl.pathname === '/manual') {
    const inputUrl = url.parse(parsedUrl.query.url);
    if (!inputUrl.hostname) {
      return setupHttpEjs(
        null,
        null,
        clientRes,
        false,
        false,
        'Invalid URL provided for manual check.',
        null
      );
    }

    fullUrl = parsedUrl.query.url.endsWith('/')
      ? parsedUrl.query.url
      : parsedUrl.query.url + '/';

    switch (getFeedbackStatus(fullUrl)) {
      case 'unsafe':
        return setupHttpEjs(
          null,
          null,
          clientRes,
          false,
          false,
          'Website already marked as unsafe',
          null
        );
      case 'safe':
        return setupHttpEjs(
          null,
          null,
          clientRes,
          false,
          false,
          'Website already marked safe',
          null
        );
    }

    const protocol = inputUrl.protocol?.replace(':', '') || 'http';
    options = {
      hostname: inputUrl.hostname,
      port: inputUrl.port || (protocol === 'https' ? 443 : 80),
      path: inputUrl.path || '/',
      method: 'GET',
      headers: {
        'User-Agent':
          clientReq.headers['user-agent'] || 'Mozilla/5.0 (Node.js Proxy)',
      },
    };

    const serverRequestFn = protocol === 'https' ? https.request : http.request;
    const serverReq = serverRequestFn(options, async (serverRes) => {
      try {
        const googleApiResult = await useGoogleAPI(fullUrl);
        const headersResult = checkSecurityHeaders(serverRes.headers, protocol);
        const { sslTlsStatus, sslDetails } =
          protocol === 'https' && serverRes.socket
            ? checkSSL(serverRes)
            : { sslTlsStatus: null, sslDetails: null };

        const valueObj = {
          checking: true,
          checkMsg: '',
          protocol,
          googleApiResult,
          headerScore: headersResult.headersScore,
          headerMessage: headersResult.headersMessage,
          missingHeaders: headersResult.missingHeaders,
          sslTlsStatus,
          sslDetails,
          redirectTo: fullUrl,
          visit: false,
          parserResult: null,
        };

        return renderEjs(clientRes, valueObj);
      } catch (error) {
        console.log('Error in manual handler:', error.message);
        if (!clientRes.headersSent) {
          clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        clientRes.end('Error in manual URL check');
      }
    });

    serverReq.on('error', (err) => {
      console.error('manual serverReq error:', err);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      clientRes.end('Bad Gateway for manual URL');
    });

    clientReq.pipe(serverReq);
    return;
  }

  // ----------- Proxy Logic ------------- //
  options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method: clientReq.method,
    headers: clientReq.headers,
  };

  fullUrl = `http://${options.hostname}${options.path}`;
  const proxyReq = http.request(options, async (proxyRes) => {
    try {
      if (!isParserActive) {
        if (getFeedbackStatus(fullUrl) === 'unsafe') {
          return setupHttpEjs(
            null,
            null,
            clientRes,
            false,
            false,
            'Website marked unsafe you cant continue',
            null
          );
        }

        if (
          !parsedUrl.query.continue &&
          getFeedbackStatus(fullUrl) === undefined
        ) {
          return setupHttpEjs(
            fullUrl,
            proxyRes,
            clientRes,
            true,
            true,
            '',
            null
          );
        }

        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        return proxyRes.pipe(clientRes);
      }

      // isParserActive = true
      const headers = proxyRes.headers;

      if (getFeedbackStatus(fullUrl) === 'unsafe') {
        return setupHttpEjs(
          null,
          null,
          clientRes,
          false,
          false,
          'Website marked unsafe you cant continue',
          null
        );
      }

      if (headers['content-type']?.includes('text/html')) {
        let body = '';
        let stream = proxyRes;

        const encoding = headers['content-encoding']?.toLowerCase();
        if (encoding === 'gzip' || encoding === 'deflate') {
          stream = proxyRes.pipe(zlib.createUnzip());
        } else if (encoding === 'br') {
          stream = proxyRes.pipe(zlib.createBrotliDecompress());
        }

        delete headers['content-length'];

        stream.on('data', (chunk) => (body += chunk.toString()));
        stream.on('end', () => {
          if (parsedUrl.query.continue) {
            clientRes.writeHead(proxyRes.statusCode, headers);
            clientRes.end(body);
          } else if (getFeedbackStatus(fullUrl) === undefined) {
            const parserResult = detectMaliciousCode(body);
            return setupHttpEjs(
              fullUrl,
              proxyRes,
              clientRes,
              true,
              true,
              '',
              parserResult
            );
          } else {
            clientRes.writeHead(proxyRes.statusCode, headers);
            clientRes.end(body);
          }
        });

        stream.on('error', (err) => {
          console.error('Decompression error:', err);
          if (!clientRes.headersSent) {
            clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
          }
          clientRes.end('Error during decompression.');
        });
      } else {
        clientRes.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(clientRes);
      }
    } catch (error) {
      console.log('Proxy error:', error.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      clientRes.end('Internal proxy error.');
    }
  });

  proxyReq.on('error', (err) => {
    console.error('proxyReq error:', err);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    clientRes.end('Bad Gateway');
  });

  clientReq.pipe(proxyReq);
};
