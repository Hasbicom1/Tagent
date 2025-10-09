/**
 * BROWSER CHAT PAGE
 * 
 * Main page for browser automation chat interface
 * Integrates all browser control capabilities
 */

import { useState, useEffect } from 'react';
import { UnifiedChatInterface } from '@/components/chat/UnifiedChatInterface';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Settings, 
  Monitor, 
  Zap, 
  Database,
  Navigation,
  Eye,
  Play,
  Pause,
  Square
} from 'lucide-react';

export default function BrowserChatPage() {
  const [sessionId, setSessionId] = useState<string>('');

  // Initialize session
  useEffect(() => {
    const newSessionId = `browser_session_${Date.now()}`;
    setSessionId(newSessionId);
  }, []);

  /**
   * Handle session change
   */
  const handleSessionChange = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Bot className="w-8 h-8 text-primary" />
                <h1 className="text-xl font-bold">Browser AI Automation</h1>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Monitor className="w-3 h-3" />
                Real-time Browser Control
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="default" className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                AI Assistant
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Chat Interface */}
          <div className="col-span-1">
            <Card className="h-[calc(100vh-8rem)]">
              <UnifiedChatInterface
                sessionId={sessionId}
              />
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Vision Agent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Database className="w-4 h-4" />
                    Data Extraction
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Navigation className="w-4 h-4" />
                    Smart Navigation
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Play className="w-4 h-4" />
                  Start Automation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Features Overview */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold">Computer Vision</h4>
                <p className="text-sm text-gray-600">AI-powered visual element detection</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold">Smart Automation</h4>
                <p className="text-sm text-gray-600">Intelligent task planning and execution</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold">Data Extraction</h4>
                <p className="text-sm text-gray-600">Advanced HTML parsing and data collection</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
