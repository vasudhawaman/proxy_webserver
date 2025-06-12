const cache = new Map();

function checkCache(req, res) {
    const key = req.url;
    if (cache.has(key)) {
        const { headers, body, statusCode } = cache.get(key);
        res.writeHead(statusCode, headers);
        res.end(body);
        console.log(`Cache hit: ${key}`);
        return true;
    }
    return false;
}

function storeInCache(url, res, body) {
    const key = url;
    cache.set(key, {
        statusCode: res.statusCode,
        headers: res.headers,
        body
    });
    console.log(`Stored in cache: ${key}`);
}

module.exports = { checkCache, storeInCache };
