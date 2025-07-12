import https from 'https';
import net from 'net';
import url from 'url';
import { createFakeCert } from '../utils/createCert.js';
import { renderEjs } from '../utils/render.js';
import { useGoogleAPI } from '../utils/googleSafeBrowsing.js';
import { checkSecurityHeaders } from '../utils/securityHeaders.js';
import { checkSSL } from '../utils/checkSsl.js';

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
          const {sslTlsStatus,sslDetails,} = checkSSL(proxyRes)

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

          httpsRes.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(httpsRes);
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
