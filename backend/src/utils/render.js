import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function renderFile(res, filePath, errMsg) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end(errMsg);
    }
    res.writeHead(200);
    return res.end(data);
  });
}

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


export { renderFile, renderEjs };
