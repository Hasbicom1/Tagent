/**
 * Eko Agent Selector Component
 * 
 * Allows users to select and configure different Eko agent types
 * for various automation tasks.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Monitor, 
  FileText, 
  Bot, 
  Settings, 
  Zap,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { isEkoInitialized } from '@/eko/real-eko-integration';

export type EkoAgentType = 'browser' | 'file' | 'general';

interface EkoAgent {
  type: EkoAgentType;
  name: string;
  description: string;
  icon: React.ReactNode;
  capabilities: string[];
  examples: string[];
}

interface EkoAgentSelectorProps {
  selectedAgent: EkoAgentType;
  onAgentChange: (agent: EkoAgentType) => void;
  onConfigChange?: (config: any) => void;
}

const AVAILABLE_AGENTS: EkoAgent[] = [
  {
    type: 'browser',
    name: 'Browser Agent',
    description: 'Automates web browser interactions, navigation, and data extraction',
    icon: <Monitor className="w-5 h-5" />,
    capabilities: [
      'Web page navigation',
      'Form filling and submission',
      'Element clicking and interaction',
      'Data extraction and scraping',
      'Screenshot capture',
      'Multi-tab management'
    ],
    examples: [
      'Navigate to Google and search for "AI automation"',
      'Fill out a contact form on a website',
      'Extract product information from an e-commerce site',
      'Take a screenshot of the current page'
    ]
  },
  {
    type: 'file',
    name: 'File Agent',
    description: 'Handles file operations, document processing, and data manipulation',
    icon: <FileText className="w-5 h-5" />,
    capabilities: [
      'File reading and writing',
      'Document parsing (PDF, Word, Excel)',
      'Data transformation and analysis',
      'File system operations',
      'Batch file processing',
      'Content extraction'
    ],
    examples: [
      'Read and summarize a PDF document',
      'Convert CSV data to JSON format',
      'Extract text from multiple Word documents',
      'Organize files in a directory by date'
    ]
  },
  {
    type: 'general',
    name: 'General Agent',
    description: 'Multi-purpose agent for various automation and AI tasks',
    icon: <Bot className="w-5 h-5" />,
    capabilities: [
      'Natural language processing',
      'Task planning and execution',
      'API integrations',
      'Data analysis and reporting',
      'Workflow orchestration',
      'Custom automation scripts'
    ],
    examples: [
      'Analyze customer feedback and generate insights',
      'Create a detailed project plan from requirements',
      'Integrate with external APIs for data sync',
      'Generate automated reports from multiple sources'
    ]
  }
];

export function EkoAgentSelector({ 
  selectedAgent, 
  onAgentChange, 
  onConfigChange 
}: EkoAgentSelectorProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [agentConfig, setAgentConfig] = useState<any>({});
  const [customInstructions, setCustomInstructions] = useState('');

  useEffect(() => {
    setIsInitialized(isEkoInitialized());
  }, []);

  const currentAgent = AVAILABLE_AGENTS.find(agent => agent.type === selectedAgent);

  const handleAgentChange = (agentType: string) => {
    const newAgent = agentType as EkoAgentType;
    onAgentChange(newAgent);
    
    // Reset config when agent changes
    setAgentConfig({});
    setCustomInstructions('');
    onConfigChange?.({});
  };

  const handleConfigUpdate = (key: string, value: any) => {
    const newConfig = { ...agentConfig, [key]: value };
    setAgentConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleInstructionsChange = (instructions: string) => {
    setCustomInstructions(instructions);
    handleConfigUpdate('customInstructions', instructions);
  };

  return (
    <div className="space-y-4">
      {/* Initialization Status */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            {isInitialized ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-500">Eko Framework Initialized</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-500">Eko Framework Not Initialized</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Agent Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-select">Choose Agent Type</Label>
            <Select value={selectedAgent} onValueChange={handleAgentChange}>
              <SelectTrigger id="agent-select">
                <SelectValue placeholder="Select an agent type" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_AGENTS.map((agent) => (
                  <SelectItem key={agent.type} value={agent.type}>
                    <div className="flex items-center gap-2">
                      {agent.icon}
                      <span>{agent.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Details */}
          {currentAgent && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {currentAgent.icon}
                <h3 className="font-semibold">{currentAgent.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentAgent.description}
              </p>

              {/* Capabilities */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Capabilities</h4>
                <div className="flex flex-wrap gap-1">
                  {currentAgent.capabilities.map((capability, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {capability}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Examples */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Example Tasks</h4>
                <div className="space-y-1">
                  {currentAgent.examples.map((example, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{example}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Agent Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label htmlFor="custom-instructions">Custom Instructions</Label>
            <Textarea
              id="custom-instructions"
              placeholder={`Enter specific instructions for the ${currentAgent?.name || 'selected agent'}...`}
              value={customInstructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Provide detailed instructions to customize the agent's behavior for your specific task.
            </p>
          </div>

          {/* Agent-specific Configuration */}
          {selectedAgent === 'browser' && (
            <div className="space-y-4 p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
              <h4 className="text-sm font-medium text-blue-700">Browser Agent Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headless">Headless Mode</Label>
                  <Select 
                    value={agentConfig.headless || 'false'} 
                    onValueChange={(value) => handleConfigUpdate('headless', value)}
                  >
                    <SelectTrigger id="headless">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Visible Browser</SelectItem>
                      <SelectItem value="true">Headless Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Page Timeout (seconds)</Label>
                  <Select 
                    value={agentConfig.timeout || '30'} 
                    onValueChange={(value) => handleConfigUpdate('timeout', value)}
                  >
                    <SelectTrigger id="timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">60 seconds</SelectItem>
                      <SelectItem value="120">120 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {selectedAgent === 'file' && (
            <div className="space-y-4 p-4 bg-green-500/5 rounded-lg border border-green-500/20">
              <h4 className="text-sm font-medium text-green-700">File Agent Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="file-encoding">File Encoding</Label>
                  <Select 
                    value={agentConfig.encoding || 'utf-8'} 
                    onValueChange={(value) => handleConfigUpdate('encoding', value)}
                  >
                    <SelectTrigger id="file-encoding">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utf-8">UTF-8</SelectItem>
                      <SelectItem value="ascii">ASCII</SelectItem>
                      <SelectItem value="latin-1">Latin-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-file-size">Max File Size (MB)</Label>
                  <Select 
                    value={agentConfig.maxFileSize || '10'} 
                    onValueChange={(value) => handleConfigUpdate('maxFileSize', value)}
                  >
                    <SelectTrigger id="max-file-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 MB</SelectItem>
                      <SelectItem value="10">10 MB</SelectItem>
                      <SelectItem value="50">50 MB</SelectItem>
                      <SelectItem value="100">100 MB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {selectedAgent === 'general' && (
            <div className="space-y-4 p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
              <h4 className="text-sm font-medium text-purple-700">General Agent Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="creativity">Creativity Level</Label>
                  <Select 
                    value={agentConfig.creativity || 'balanced'} 
                    onValueChange={(value) => handleConfigUpdate('creativity', value)}
                  >
                    <SelectTrigger id="creativity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="response-length">Response Length</Label>
                  <Select 
                    value={agentConfig.responseLength || 'medium'} 
                    onValueChange={(value) => handleConfigUpdate('responseLength', value)}
                  >
                    <SelectTrigger id="response-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="detailed">Very Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}