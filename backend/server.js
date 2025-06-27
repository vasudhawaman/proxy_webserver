const http = require('http');
const { getHomepageRoute } = require('./controllers/homepage.controller');
const { checkSafety } = require('./controllers/safety.controller');
const { renderFile } = require('./utils/render');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT

//Our main proxy server
const proxy = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {   //Sending homepage - index.html
    getHomepageRoute(req, res);
  } else if (req.url === '/isSafe' && req.method === 'POST') {  //receives data(url) from client 
    checkSafety(req, res);
  } else if (  //sending bg.img for homepage
    req.url === '/frontend/assets/images/bg.jpg' &&
    req.method === 'GET'
  ) {
    renderFile(
      res,
      path.join(__dirname, '..', 'frontend/assets/images/bg.jpg'),
      'Error rendering image'
    );
  } else if ( //sending style for homepage
    req.url === '/frontend/assets/css/style.css' &&
    req.method === 'GET'
  ) {
    renderFile(
      res,
      path.join(__dirname, '..', '/frontend/assets/css/style.css'),
      'Error rendering styles'
    );
  } else {
    res.writeHead(404);
    res.end('Route not found');
  }
});

proxy.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
