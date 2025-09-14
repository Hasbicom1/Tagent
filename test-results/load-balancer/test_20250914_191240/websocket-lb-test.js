const WebSocket = require('ws');

const servers = process.argv.slice(2).map(s => s.replace('http', 'ws') + '/ws');
let connections = [];
let messageCount = 0;
let errorCount = 0;

console.log('Testing WebSocket load balancing across servers:', servers);

// Create connections to load balancer
for (let i = 0; i < 10; i++) {
    setTimeout(() => {
        const ws = new WebSocket('ws://localhost:8080/ws');
        
        ws.on('open', () => {
            connections.push(ws);
            console.log(`Connection ${i + 1} established`);
            
            // Send test message
            ws.send(JSON.stringify({
                type: 'test',
                timestamp: Date.now(),
                connectionId: i + 1
            }));
        });
        
        ws.on('message', (data) => {
            messageCount++;
            try {
                const msg = JSON.parse(data);
                console.log(`Message received on connection ${i + 1}:`, msg.type);
            } catch (e) {
                // Ignore parse errors
            }
        });
        
        ws.on('error', (error) => {
            errorCount++;
            console.error(`WebSocket error on connection ${i + 1}:`, error.message);
        });
        
        ws.on('close', () => {
            console.log(`Connection ${i + 1} closed`);
        });
        
    }, i * 100); // Stagger connections
}

// Report results after 10 seconds
setTimeout(() => {
    console.log('\nWebSocket Load Balancing Results:');
    console.log(`Active connections: ${connections.length}`);
    console.log(`Messages received: ${messageCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Close all connections
    connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
    
    process.exit(0);
}, 10000);
