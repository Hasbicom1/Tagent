const http = require('http');
const url = require('url');

const servers = process.argv.slice(2);
let currentServer = 0;

// Round-robin load balancer
function getNextServer() {
    const server = servers[currentServer];
    currentServer = (currentServer + 1) % servers.length;
    return server;
}

const server = http.createServer((req, res) => {
    const targetServer = getNextServer();
    const targetUrl = targetServer + req.url;
    
    // Add load balancer headers
    req.headers['x-forwarded-for'] = req.connection.remoteAddress;
    req.headers['x-load-balancer'] = 'test-simulator';
    
    const options = url.parse(targetUrl);
    options.method = req.method;
    options.headers = req.headers;
    
    const proxyReq = http.request(options, (proxyRes) => {
        // Add server identification header
        proxyRes.headers['x-upstream-server'] = targetServer;
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
        console.error(`Error proxying to ${targetServer}:`, err.message);
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq);
});

server.listen(8080, () => {
    console.log('Load balancer simulator running on port 8080');
    console.log('Upstream servers:', servers);
});
