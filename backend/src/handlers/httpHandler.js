const http = require('http');
const https = require('https');
const path = require('path');
const { parseDocument } = require('htmlparser2');
const { DomUtils } = require('htmlparser2');

// Helper to check if the request is a direct HTML file
function isHtmlFile(urlPath) {
    return path.extname(urlPath).toLowerCase() === '.html';
}

async function httpHandler(req, res) {
    const targetUrl = req.url; // adjust if you use a proxy mapping
    const parsedUrl = new URL(targetUrl, `http://${req.headers.host}`);
    const urlPath = parsedUrl.pathname;

    // Serve static .html files without parsing
    if (isHtmlFile(urlPath)) {
        // Your static file serving logic here
        return;
    }

    // Proxy/forward other requests
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = client.request(targetUrl, {
        method: req.method,
        headers: req.headers,
    }, proxyRes => {
        let data = [];

        proxyRes.on('data', chunk => data.push(chunk));
        proxyRes.on('end', () => {
            const buffer = Buffer.concat(data);
            const contentType = proxyRes.headers['content-type'] || '';

            if (contentType.includes('text/html')) {
                const html = buffer.toString();

                // Parse HTML with htmlparser2
                const dom = parseDocument(html);

                // Example: You can modify or inspect the DOM here
                // For example, change the title:
                // const titleTag = DomUtils.find(el => el.name === 'title', dom.children, true, 1)[0];
                // if (titleTag) titleTag.children[0].data = 'New Title';

                // Convert back to HTML string
                const modifiedHtml = DomUtils.getOuterHTML(dom);

                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(modifiedHtml);
            } else {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(buffer);
            }
        });
    });

    proxyReq.on('error', err => {
        res.writeHead(500);
        res.end('Proxy error: ' + err.message);
    });

    req.pipe(proxyReq);
}

module.exports = httpHandler;
