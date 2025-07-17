import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs/promises';
import { parseDocument, DomUtils } from 'htmlparser2';
import {
    isHtmlFile,
    extractInlineScripts,
    containsMaliciousKeyword,
    containsMaliciousHtml
} from './parser.js';

async function serveStaticHtml(filePath, res) {
    try {
        const html = await fs.readFile(filePath, 'utf8');
        const dom = parseDocument(html);

        if (containsMaliciousHtml(dom)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Blocked: Malicious HTML detected in static file.');
            return;
        }

        const inlineScripts = extractInlineScripts(dom);
        if (inlineScripts.some(js => containsMaliciousKeyword(js))) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Blocked: Malicious JavaScript detected in static file.');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(DomUtils.getOuterHTML(dom));
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
    }
}

async function httpHandler(req, res) {
    const targetUrl = req.url;
    const parsedUrl = new URL(targetUrl, `http://${req.headers.host}`);
    const urlPath = parsedUrl.pathname;

    // Serve static .html files with security scan
    if (isHtmlFile(urlPath)) {
        const staticFilePath = path.join(process.cwd(), 'public', urlPath);
        await serveStaticHtml(staticFilePath, res);
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
        proxyRes.on('end', async () => {
            const buffer = Buffer.concat(data);
            const contentType = proxyRes.headers['content-type'] || '';

            if (contentType.includes('text/html')) {
                const html = buffer.toString();
                const dom = parseDocument(html);

                if (containsMaliciousHtml(dom)) {
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end('Blocked: Malicious HTML detected in proxied response.');
                    return;
                }
                const inlineScripts = extractInlineScripts(dom);
                if (inlineScripts.some(js => containsMaliciousKeyword(js))) {
                    res.writeHead(403, { 'Content-Type': 'text/plain' });
                    res.end('Blocked: Malicious JavaScript detected in proxied response.');
                    return;
                }

                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(DomUtils.getOuterHTML(dom));
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

export default httpHandler;
