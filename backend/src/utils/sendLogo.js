import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function sendLogo(req, res) {
  const imagePath = path.join(__dirname, '../assets/imgs/logo.jpg');

  fs.readFile(imagePath, (err, data) => {
    if (err) {
      console.error('Error reading image:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': data.length,
    });
    res.end(data);
  });
}
