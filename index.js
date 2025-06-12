const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');

const { checkCache, storeInCache } = require('./caching');

const proxy = http.createServer((req, res) => {
    
    const fullUrl = req.headers.host.startsWith('http')
        ? req.url
        : `http://${req.headers.host}${req.url}`;
    const parsedUrl = url.parse(fullUrl);
    const protocol = parsedUrl.protocol;

    if (!protocol || req.method === 'CONNECT') return;

    
    if (checkCache(req, res)) return;

    
    const requester = protocol === 'https:' ? https : http;

    
    const options = {
        rejectUnauthorized: true, 
    };

    const proxyReq = requester.get(fullUrl, options, (proxyRes) => {
        let data = [];

        proxyRes.on('data', chunk => data.push(chunk));
        proxyRes.on('end', () => {
            const body = Buffer.concat(data);
            storeInCache(fullUrl, proxyRes, body);

            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(body);
        });
    });

    proxyReq.on('error', err => {
        res.writeHead(500);
        res.end(`Error fetching ${fullUrl}: ${err.message}`);
    });

});

proxy.on('connect', (req, clientSocket, head) => {
    const { port, hostname } = url.parse(`http://${req.url}`);

    const serverSocket = net.connect(port || 443, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
        console.error('Server socket error:', err);
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        clientSocket.destroy();
        serverSocket.destroy();
    });

    clientSocket.on('error', (err) => {
        console.error('Client socket error:', err);
        serverSocket.destroy();
        clientSocket.destroy();
    });
});

proxy.listen(8080, () => {
    console.log('Proxy server running on port 8080');
});