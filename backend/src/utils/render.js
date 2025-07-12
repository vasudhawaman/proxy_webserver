import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { checkSecurityHeaders } from './securityHeaders.js';
import { useGoogleAPI } from './googleSafeBrowsing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function renderEjs(res, valueObj) {
  try {
    ejs.renderFile(
      path.join(__dirname, '..', '..', '..', 'views', 'response.ejs'),
      valueObj,
      (err, html) => {
        if (err) {
          console.error('EJS rendering error:', err); // Log the actual EJS error for debugging
          res.writeHead(500);
          return res.end('Error rendering EJS file');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      }
    );
  } catch (error) {
    console.error('Error in ejs rendering (outer catch): ', error.message); // Use console.error for errors
    // You might also want to send a 500 response here
    res.writeHead(500);
    res.end('An unexpected error occurred during EJS rendering.');
  }
}

async function setupHttpEjs(url,serverRes,clientRes,isVisit) {
  const googleApiResult = await useGoogleAPI(url);
  const headersResult = checkSecurityHeaders(serverRes.headers, 'http');

  const valueObj = {
    protocol:'http',
    googleApiResult,
    headerScore: headersResult.headersScore,
    headerMessage: headersResult.headersMessage,
    missingHeaders: headersResult.missingHeaders,
    sslTlsStatus: null,
    sslDetails: null,
    redirectTo: url,
    visit: isVisit
  };

  return renderEjs(clientRes, valueObj);
}

export { renderEjs,setupHttpEjs };
