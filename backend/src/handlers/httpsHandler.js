import https from 'https';
import net from 'net';
import url from 'url';
import zlib from 'zlib';
import { createFakeCert } from '../utils/createCert.js';
import { renderEjs } from '../utils/render.js';
import { useGoogleAPI } from '../utils/googleSafeBrowsing.js';
import { checkSecurityHeaders } from '../utils/securityHeaders.js';
import { checkSSL } from '../utils/checkSsl.js';
import { getFeedbackStatus } from '../utils/feedback.js';
import { isParserActive } from './httpHandler.js';
import { detectMaliciousHtml } from '../parser/htmlParser.js';

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

        const fullUrl = `https://${options.hostname}${options.path}`;
        const proxyReq = https.request(options, async (proxyRes) => {
          try {
            //ssl has to be checked at most first cuz in parsing proxyRes socket is undefined to tackle that
            const { sslTlsStatus, sslDetails } = checkSSL(proxyRes);

            if (!isParserActive) {
              // DONT CHNAGE THE SEQUENCE OF IF BLOCKS

              if (getFeedbackStatus(fullUrl) === 'unsafe') {
                return renderEjs(httpsRes, {
                  checking: false,
                  checkMsg: 'Website marked unsafe you cant continue',
                  protocol: null,
                  googleApiResult: null,
                  headerScore: null,
                  headerMessage: null,
                  missingHeaders: null,
                  sslTlsStatus: null,
                  sslDetails: null,
                  redirectTo: null,
                  visit: false,
                  parserResult: null,
                });
              }

              // Only show response page if ?continue is not present
              if (
                !parsedUrl.query.continue &&
                getFeedbackStatus(fullUrl) === undefined
              ) {
                const googleApiResult = await useGoogleAPI(fullUrl);
                const headersResult = checkSecurityHeaders(
                  proxyRes.headers,
                  'https'
                );

                return renderEjs(httpsRes, {
                  checking: true,
                  checkMsg: '',
                  protocol: 'https',
                  googleApiResult,
                  headerScore: headersResult.headersScore,
                  headerMessage: headersResult.headersMessage,
                  missingHeaders: headersResult.missingHeaders,
                  sslTlsStatus,
                  sslDetails,
                  redirectTo: fullUrl,
                  visit: true,
                  parserResult: null,
                });
              }

              httpsRes.writeHead(proxyRes.statusCode, proxyRes.headers);

              proxyRes.on('data', (chunk) => {
                httpsRes.write(chunk);
              });
              proxyRes.on('end', () => {
                httpsRes.end();
                httpsServer.close();
              });
              return;
            }

            // isParserActive = true

            const headers = proxyRes.headers;

            if (getFeedbackStatus(fullUrl) === 'unsafe') {
              return renderEjs(httpsRes, {
                checking: false,
                checkMsg: 'Website marked unsafe you cant continue',
                protocol: null,
                googleApiResult: null,
                headerScore: null,
                headerMessage: null,
                missingHeaders: null,
                sslTlsStatus: null,
                sslDetails: null,
                redirectTo: null,
                visit: false,
                parserResult: null,
              });
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

              delete headers['content-encoding'];

              stream.on('data', (chunk) => (body += chunk.toString()));
              stream.on('end', async () => {
                if (parsedUrl.query.continue) {
                  httpsRes.writeHead(proxyRes.statusCode, headers);
                  httpsRes.end(body);
                } else if (getFeedbackStatus(fullUrl) === undefined) {
                  // const { sslTlsStatus, sslDetails } = checkSSL(proxyRes);
                  const googleApiResult = await useGoogleAPI(fullUrl);
                  const headersResult = checkSecurityHeaders(
                    proxyRes.headers,
                    'https'
                  );
                  const parserResult = detectMaliciousHtml(body);
                  return renderEjs(httpsRes, {
                    checking: true,
                    checkMsg: '',
                    protocol: 'https',
                    googleApiResult,
                    headerScore: headersResult.headersScore,
                    headerMessage: headersResult.headersMessage,
                    missingHeaders: headersResult.missingHeaders,
                    sslTlsStatus,
                    sslDetails,
                    redirectTo: fullUrl,
                    visit: true,
                    parserResult,
                  });
                } else {
                  httpsRes.writeHead(proxyRes.statusCode, headers);
                  httpsRes.end(body);
                }
              });

              stream.on('error', (err) => {
                console.log('Decompression error: ', err);
                if (!httpsRes.headersSent) {
                  httpsRes.writeHead(500, { 'Content-Type': 'text/plain' });
                }
                httpsRes.end('Error during decompression');
              });
            } else {
              httpsRes.writeHead(proxyRes.statusCode, headers);

              proxyRes.on('data', (chunk) => {
                httpsRes.write(chunk);
              });

              proxyRes.on('end', () => {
                httpsRes.end();
                httpsServer.close();
              });
            }
          } catch (error) {
            console.log('Proxy error:', error.message);
            if (!httpsRes.headersSent) {
              httpsRes.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            httpsRes.end('Internal proxy error.');
          }
        });

        proxyReq.on('error', (err) => {
          console.error('proxyReq (HTTPS) error:', err.message);
          httpsRes.writeHead(502);
          httpsRes.end('Bad Gateway');
          httpsServer.close();
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
