import http from 'http';
import url from 'url';
import https from 'https';
import { useGoogleAPI } from '../utils/googleSafeBrowsing.js';
import { renderEjs, setupHttpEjs } from '../utils/render.js';
import { checkSecurityHeaders } from '../utils/securityHeaders.js';
import { checkSSL } from '../utils/checkSsl.js';

export const handleHttpRequest = async (clientReq, clientRes) => {
  clientReq.on('error', (err) => {
    console.error('clientReq error:', err.message);
    clientRes.writeHead(400);
    clientRes.end('Client Request Error');
  });

  const parsedUrl = url.parse(clientReq.url, true);
  let fullUrl = '';
  let options = {};

  if (parsedUrl.pathname === '/inspect' && parsedUrl.query.manual === '1') {
    // handling manual input
    const inputUrl = url.parse(parsedUrl.query.url); // ← Parse the actual input URL
    fullUrl = parsedUrl.query.url;

    const manualProtocol = inputUrl.protocol.replace(':', '');
    const scheme = manualProtocol === 'http' ? http : https;

    options = {
      hostname: inputUrl.hostname,
      path: inputUrl.path || '/',
      method: 'GET',
      headers: { 'User-Agent': clientReq.headers['user-agent'] },
    };

    if (manualProtocol === 'http') {
      const serverReq = http.request(options, async (serverRes) => {
        try {
          return setupHttpEjs(fullUrl, serverRes, clientRes, false);
        } catch (error) {
          console.log('Error in serverReq cb in http server: ', error.message);
          clientRes.end('Error in serverReq cb in http server');
        }
      });

      serverReq.on('error', (err) => {
        console.error('serverReq error:', err);
        clientRes.writeHead(502);
        clientRes.end('Bad Gateway');
      });

      clientReq.on('data', (chunk) => serverReq.write(chunk));
      clientReq.on('end', () => serverReq.end());
    } else {
      // define for https
      const serverReq = https.request(options, async (serverRes) => {
        try {
          const googleApiResult = await useGoogleAPI(fullUrl);
          const headersResult = checkSecurityHeaders(
            serverRes.headers,
            'https'
          );

          // ssl certificate
          const { sslTlsStatus, sslDetails } = checkSSL(serverRes);

          const valueObj = {
            protocol: 'https',
            googleApiResult,
            headerScore: headersResult.headersScore,
            headerMessage: headersResult.headersMessage,
            missingHeaders: headersResult.missingHeaders,
            sslTlsStatus,
            sslDetails,
            redirectTo: fullUrl,
            visit: false,
          };

          return renderEjs(clientRes, valueObj);
        } catch (error) {
          console.log(
            'Error in serverReq cb in http server shelly: ',
            error.message
          );
          clientRes.end('Error in serverReq cb in http server shelly');
        }
      });

      serverReq.on('error', (err) => {
        console.error('serverReq error:', err);
        clientRes.writeHead(502);
        clientRes.end('Bad Gateway');
      });

      clientReq.on('data', (chunk) => serverReq.write(chunk));
      clientReq.on('end', () => serverReq.end());
    }
  } else {
    options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.path,
      method: clientReq.method,
      headers: { ...clientReq.headers },
    };
    fullUrl = `http://${options.hostname}:${options.port}${options.path}`;

    const proxyReq = http.request(options, async (proxyRes) => {
      try {
        if (!parsedUrl.query.continue) {
          return setupHttpEjs(fullUrl, proxyRes, clientRes, true);
        }

        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.on('data', (chunk) => clientRes.write(chunk));
        proxyRes.on('end', () => clientRes.end());
      } catch (error) {
        console.log('Error in proxyReq cb in http server: ', error.message);
        clientRes.end('Error in proxyReq cb in http server');
      }
    });

    proxyReq.on('error', (err) => {
      console.error('proxyReq error:', err);
      clientRes.writeHead(502);
      clientRes.end('Bad Gateway');
    });

    clientReq.on('data', (chunk) => proxyReq.write(chunk));
    clientReq.on('end', () => proxyReq.end());
  }
};
