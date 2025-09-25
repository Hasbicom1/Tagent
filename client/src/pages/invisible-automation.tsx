/**
 * INVISIBLE AUTOMATION PAGE
 * 
 * Main page for invisible browser automation
 * Users watch their browser being controlled by invisible AI agents
 */

import { useState, useEffect } from 'react';
import { InvisibleAutomationInterface } from '@/components/automation/InvisibleAutomationInterface';
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
  Square,
  Brain,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

export default function InvisibleAutomationPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [taskQueue, setTaskQueue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize session
  useEffect(() => {
    const newSessionId = `invisible_session_${Date.now()}`;
    setSessionId(newSessionId);
    setIsSystemActive(true);
    setActiveAgents(['Browser-Use', 'Skyvern', 'LaVague', 'Stagehand', 'PHOENIX-7742']);
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
                <h1 className="text-xl font-bold">Invisible AI Automation</h1>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Monitor className="w-3 h-3" />
                Real-time Browser Control
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant={isSystemActive ? 'default' : 'secondary'} className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {isSystemActive ? 'System Active' : 'System Inactive'}
              </Badge>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* System Status Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">System Status</h3>
                  <Badge variant={isSystemActive ? 'default' : 'secondary'}>
                    {isSystemActive ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                
                {/* Active Agents */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Invisible AI Agents</h4>
                  <div className="space-y-2">
                    {activeAgents.map(agent => (
                      <div key={agent} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">{agent}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Metrics */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">System Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Tasks in Queue</span>
                      <Badge variant="secondary">{taskQueue}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Processing</span>
                      <Badge variant={isProcessing ? 'default' : 'outline'}>
                        {isProcessing ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Session ID</span>
                      <span className="text-xs text-gray-500 font-mono">
                        {sessionId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Automation Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-8rem)]">
              <InvisibleAutomationInterface
                sessionId={sessionId}
                onSessionChange={handleSessionChange}
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
                <h4 className="font-semibold">Invisible Vision AI</h4>
                <p className="text-sm text-gray-600">Computer vision working behind the scenes</p>
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
                <p className="text-sm text-gray-600">AI agents working invisibly</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold">Large Action Models</h4>
                <p className="text-sm text-gray-600">Advanced AI planning and execution</p>
              </div>
            </div>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">How Invisible Automation Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-medium">1. You Request</h4>
                <p className="text-sm text-gray-600">Describe what you want the browser to do</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Brain className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-medium">2. AI Agents Plan</h4>
                <p className="text-sm text-gray-600">Invisible agents analyze and plan the task</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Monitor className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-medium">3. Browser Control</h4>
                <p className="text-sm text-gray-600">Watch your browser being controlled automatically</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-medium">4. Task Complete</h4>
                <p className="text-sm text-gray-600">Your task is completed successfully</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
