/**
 * VNC Test Page
 * Dedicated page for testing VNC WebSocket security fixes
 */

import VNCTest from '@/components/vnc-test';

export default function VNCTestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">VNC Security Test</h1>
        <p className="text-muted-foreground mt-2">
          Test the secure VNC WebSocket proxy with cookie-based authentication
        </p>
      </div>
      
      <VNCTest />
    </div>
  );
}