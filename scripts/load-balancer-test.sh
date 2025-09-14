#!/bin/bash

# Load Balancer Integration Testing Script
# Tests multiple upstream servers and failover scenarios

set -e

# Configuration
UPSTREAM_SERVERS=${1:-"http://localhost:5000,http://localhost:5001,http://localhost:5002"}
TEST_DURATION=${2:-60}  # seconds
CONCURRENT_USERS=${3:-50}
REQUEST_RATE=${4:-100}  # requests per second

echo "🌐 Load Balancer Integration Testing"
echo "======================================"
echo "Upstream servers: $UPSTREAM_SERVERS"
echo "Test duration: ${TEST_DURATION}s"
echo "Concurrent users: $CONCURRENT_USERS"
echo "Request rate: $REQUEST_RATE rps"
echo ""

# Convert comma-separated servers to array
IFS=',' read -ra SERVERS <<< "$UPSTREAM_SERVERS"

# Create test results directory
mkdir -p test-results/load-balancer
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULT_DIR="test-results/load-balancer/test_$TIMESTAMP"
mkdir -p "$RESULT_DIR"

echo "📊 Results will be saved to: $RESULT_DIR"
echo ""

# Test individual servers first
echo "🔍 Phase 1: Individual Server Health Checks"
echo "--------------------------------------------"

healthy_servers=()
for server in "${SERVERS[@]}"; do
    echo "Testing $server..."
    
    if curl -s -f --max-time 5 "$server/api/health" > "$RESULT_DIR/health_$(echo $server | tr '/:' '_').json"; then
        echo "✅ $server is healthy"
        healthy_servers+=("$server")
    else
        echo "❌ $server is unhealthy or unreachable"
    fi
done

echo ""
echo "📈 Healthy servers: ${#healthy_servers[@]}/${#SERVERS[@]}"

if [ ${#healthy_servers[@]} -eq 0 ]; then
    echo "❌ No healthy servers found. Exiting."
    exit 1
fi

echo ""

# Test load distribution
echo "🎯 Phase 2: Load Distribution Testing"
echo "-------------------------------------"

# Create simple Node.js load balancer simulator
cat > "$RESULT_DIR/load-balancer-sim.js" << 'EOF'
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
EOF

echo "Starting load balancer simulator..."
node "$RESULT_DIR/load-balancer-sim.js" "${healthy_servers[@]}" &
LB_PID=$!

# Wait for load balancer to start
sleep 2

echo "🚀 Testing load distribution..."

# Test load distribution with autocannon
if command -v autocannon &> /dev/null; then
    autocannon -c $CONCURRENT_USERS -d $TEST_DURATION -R $REQUEST_RATE \
        --json-output > "$RESULT_DIR/load-distribution.json" \
        http://localhost:8080/api/health
        
    echo "✅ Load distribution test completed"
else
    echo "⚠️  autocannon not found, using curl for basic testing"
    
    # Basic curl-based testing
    echo "Running basic load test..."
    for i in {1..100}; do
        curl -s -H "X-Test-Request: $i" http://localhost:8080/api/health >> "$RESULT_DIR/responses.txt" &
        
        # Limit concurrent requests
        if (( i % 10 == 0 )); then
            wait
        fi
    done
    wait
    echo "✅ Basic load test completed"
fi

echo ""

# Test failover scenarios
echo "🛠️  Phase 3: Failover Testing"
echo "------------------------------"

if [ ${#healthy_servers[@]} -gt 1 ]; then
    echo "Simulating server failures..."
    
    # Record server distribution before failure
    echo "Recording baseline server distribution..."
    for i in {1..20}; do
        curl -s -D- http://localhost:8080/api/health | grep "x-upstream-server" >> "$RESULT_DIR/baseline-distribution.txt" &
    done
    wait
    
    echo "✅ Baseline recorded"
    
    # Test would continue with actual server shutdown simulation
    echo "ℹ️  Note: Actual failover testing requires orchestration of multiple server instances"
    echo "ℹ️  In production, this would:"
    echo "   - Shutdown one upstream server"
    echo "   - Verify traffic redistributes to remaining servers"
    echo "   - Measure failover detection time"
    echo "   - Test health check intervals"
    
else
    echo "⚠️  Only one healthy server available - skipping failover tests"
fi

echo ""

# WebSocket load balancing test
echo "🔌 Phase 4: WebSocket Load Balancing"
echo "------------------------------------"

cat > "$RESULT_DIR/websocket-lb-test.js" << 'EOF'
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
EOF

echo "Testing WebSocket load balancing..."
if [ ${#healthy_servers[@]} -gt 0 ]; then
    timeout 15s node "$RESULT_DIR/websocket-lb-test.js" "${healthy_servers[@]}" 2>&1 | tee "$RESULT_DIR/websocket-results.txt"
else
    echo "⚠️  No healthy servers for WebSocket testing"
fi

echo ""

# Cleanup
echo "🧹 Phase 5: Cleanup"
echo "-------------------"

echo "Stopping load balancer simulator..."
kill $LB_PID 2>/dev/null || true
sleep 1

echo ""

# Generate summary report
echo "📋 Generating Summary Report"
echo "----------------------------"

cat > "$RESULT_DIR/summary.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "test_duration": $TEST_DURATION,
  "concurrent_users": $CONCURRENT_USERS,
  "request_rate": $REQUEST_RATE,
  "upstream_servers": [$(printf '"%s",' "${SERVERS[@]}" | sed 's/,$//')],
  "healthy_servers": [$(printf '"%s",' "${healthy_servers[@]}" | sed 's/,$//')],
  "health_ratio": "$(echo "scale=2; ${#healthy_servers[@]}/${#SERVERS[@]}" | bc -l)",
  "test_phases": [
    "individual_health_checks",
    "load_distribution",
    "failover_simulation",
    "websocket_load_balancing"
  ],
  "results_directory": "$RESULT_DIR"
}
EOF

echo "✅ Load balancer integration testing completed!"
echo ""
echo "📁 Results saved to: $RESULT_DIR"
echo "📊 Summary: $RESULT_DIR/summary.json"
echo ""

# Display quick summary
echo "🎯 Quick Summary:"
echo "  • Tested servers: ${#SERVERS[@]}"
echo "  • Healthy servers: ${#healthy_servers[@]}"
echo "  • Health ratio: $(echo "scale=1; ${#healthy_servers[@]}*100/${#SERVERS[@]}" | bc -l)%"

if [ -f "$RESULT_DIR/load-distribution.json" ]; then
    echo "  • Load test results: $RESULT_DIR/load-distribution.json"
fi

echo ""
echo "🔗 To run load balancer testing:"
echo "  ./scripts/load-balancer-test.sh \"http://server1:5000,http://server2:5000\" 60 50 100"