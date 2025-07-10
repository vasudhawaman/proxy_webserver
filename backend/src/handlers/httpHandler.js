import http from 'http';
import url from 'url';
import { useGoogleAPI } from '../utils/googleSafeBrowsing.js';
import { renderEjs } from '../utils/render.js';
import { checkSecurityHeaders } from '../utils/securityHeaders.js';

export const handleHttpRequest = async (clientReq, clientRes) => {
  clientReq.on('error', err => {
    console.error('clientReq error:', err.message);
    clientRes.writeHead(400);
    clientRes.end('Client Request Error');
  });

  const parsedUrl = url.parse(clientReq.url, true);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };
  const fullUrl = `http://${options.hostname}:${options.port}${options.path}`;

  const proxyReq = http.request(options, async (proxyRes) => {
    try {
      if (!parsedUrl.query.continue) {
        const googleApiResult = await useGoogleAPI(fullUrl);
        const headersResult = checkSecurityHeaders(proxyRes.headers, 'http');

        const valueObj = {
          protocol: 'http',
          googleApiResult,
          headerScore: headersResult.headersScore,
          headerMessage: headersResult.headersMessage,
          missingHeaders: headersResult.missingHeaders,
          sslTlsStatus: 'N/A (HTTP)',
          redirectTo: fullUrl,
        };

        return renderEjs(clientRes, valueObj);
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
    console.error('proxyReq error:', err.message);
    clientRes.writeHead(502);
    clientRes.end('Bad Gateway');
  });

  clientReq.on('data', chunk => proxyReq.write(chunk));
  clientReq.on('end', () => proxyReq.end());
};
