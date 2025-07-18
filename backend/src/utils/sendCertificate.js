import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function sendCertificate(req, res) {
  try {
    const filePath = path.join(__dirname, '..', 'certs', 'rootCA.crt');

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error('Error reading certificate file:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: Could not read certificate file');
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Disposition': 'attachment; filename="rootCA.crt"',
        'Content-Length': data.length,
        // 'Access-Control-Allow-Origin': '*', // CORS header
      });

      res.end(data);
    });
  } catch (error) {
    console.error('Unexpected error in sendCertificate:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}
