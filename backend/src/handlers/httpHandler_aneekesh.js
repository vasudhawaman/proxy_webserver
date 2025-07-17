import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs/promises';
import { parseDocument, DomUtils } from 'htmlparser2';
import { parse as parseJS } from 'acorn';
import * as acornWalk from 'acorn-walk';

// Helper to check if the request is a direct HTML file
function isHtmlFile(urlPath) {
    return path.extname(urlPath).toLowerCase() === '.html';
}

// Helper to extract inline scripts from a DOM
function extractInlineScripts(dom) {
    return DomUtils.findAll(
        elem => elem.name === 'script' && !elem.attribs?.src,
        dom.children || []
    ).map(scriptElem =>
        scriptElem.children && scriptElem.children[0] && scriptElem.children[0].data
            ? scriptElem.children[0].data
            : ''
    ).filter(Boolean);
}

// Helper to scan JavaScript for suspicious keywords using Acorn AST (just like in httpsHandler)
function containsMaliciousKeyword(jsCode) {
    const suspiciousKeywords = [
        'eval', 'Function', 'setInterval', 'setTimeout',
        'document', 'window', 'XMLHttpRequest', 'fetch', 'WebSocket',
        'importScripts', 'Worker', 'atob', 'btoa'
    ];
    try {
        const ast = parseJS(jsCode, { ecmaVersion: 2020 });
        let found = false;
        acornWalk.simple(ast, {
            Identifier(node) {
                if (suspiciousKeywords.includes(node.name)) {
                    found = true;
                }
            },
            MemberExpression(node) {
                if (node.object && node.property) {
                    const objectName = node.object.name || '';
                    const propName = node.property.name || '';
                    if (suspiciousKeywords.includes(objectName) || suspiciousKeywords.includes(propName)) {
                        found = true;
                    }
                }
            }
        });
        return found;
    } catch (e) {
        // If parsing fails (e.g., obfuscated code), treat as suspicious
        return true;
    }
}

// Helper to scan HTML for suspicious tags and attributes
function containsMaliciousHtml(dom) {
    const suspiciousTags = ['iframe', 'object', 'embed', 'link', 'base'];
    const suspiciousAttrs = [
        /^on/i, // inline event handlers: onclick, onerror, etc.
        /^srcdoc$/i,
        /^src$/i,
        /^data$/i
    ];
    let found = false;

    function scan(node) {
        if (node.type === 'tag') {
            if (suspiciousTags.includes(node.name)) found = true;
            for (const [attr, val] of Object.entries(node.attribs || {})) {
                if (suspiciousAttrs.some(regex => regex.test(attr))) found = true;
                if ((attr === 'src' || attr === 'data') && /javascript:|data:text\/html/i.test(val)) found = true;
            }
        }
        if (node.children) for (const child of node.children) scan(child);
    }
    for (const node of dom.children || []) scan(node);
    return found;
}

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
    const targetUrl = req.url; // adjust if you use a proxy mapping
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
