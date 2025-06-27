const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

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
  ejs.renderFile(
    path.join(__dirname, '..', '..', 'src', 'views', 'response.ejs'),
    valueObj,
    (err, html) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error rendering EJS');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    }
  );
}

module.exports = { renderFile, renderEjs };
