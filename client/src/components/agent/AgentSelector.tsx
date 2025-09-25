/**
 * AGENT SELECTOR COMPONENT
 * 
 * Interface for users to select and manage AI agents
 * Shows all available free agents with their capabilities
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, 
  Eye, 
  Zap, 
  Search, 
  Navigation, 
  Database,
  Settings,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  category: 'vision' | 'automation' | 'planning' | 'extraction' | 'navigation';
  strengths: string[];
  isLocal: boolean;
  requiresSetup: boolean;
  isAvailable: boolean;
  priority: number;
}

interface AgentSelectorProps {
  onAgentSelect: (agentId: string) => void;
  selectedAgent?: string;
  disabled?: boolean;
}

export function AgentSelector({ onAgentSelect, selectedAgent, disabled = false }: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock agents data - in real implementation, this would come from the API
  const mockAgents: Agent[] = [
    {
      id: 'playwright-vision',
      name: 'Playwright Vision',
      description: 'Computer vision automation using Playwright with screenshot analysis',
      category: 'vision',
      strengths: ['screenshot analysis', 'visual element detection', 'image recognition', 'form filling'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    },
    {
      id: 'playwright-smart',
      name: 'Playwright Smart',
      description: 'Intelligent Playwright automation with AI-powered element selection',
      category: 'automation',
      strengths: ['smart element selection', 'form automation', 'navigation', 'data extraction'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    },
    {
      id: 'puppeteer-ai',
      name: 'Puppeteer AI',
      description: 'Puppeteer with AI-powered task planning and execution',
      category: 'automation',
      strengths: ['headless automation', 'PDF generation', 'screenshot capture', 'performance monitoring'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    },
    {
      id: 'selenium-ai',
      name: 'Selenium AI',
      description: 'Selenium WebDriver with AI-enhanced automation capabilities',
      category: 'automation',
      strengths: ['cross-browser testing', 'web application testing', 'form automation', 'data scraping'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 3
    },
    {
      id: 'rule-based-planner',
      name: 'Rule-Based Planner',
      description: 'Intelligent task planning using rule-based AI without external APIs',
      category: 'planning',
      strengths: ['task decomposition', 'step planning', 'workflow optimization', 'error handling'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    },
    {
      id: 'pattern-recognition',
      name: 'Pattern Recognition',
      description: 'Pattern-based automation using machine learning algorithms',
      category: 'planning',
      strengths: ['pattern matching', 'behavior prediction', 'adaptive automation', 'learning from examples'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    },
    {
      id: 'cheerio-extractor',
      name: 'Cheerio Extractor',
      description: 'Fast HTML parsing and data extraction using Cheerio',
      category: 'extraction',
      strengths: ['HTML parsing', 'data extraction', 'content analysis', 'text processing'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    },
    {
      id: 'puppeteer-extractor',
      name: 'Puppeteer Extractor',
      description: 'Advanced data extraction using Puppeteer with JavaScript execution',
      category: 'extraction',
      strengths: ['dynamic content extraction', 'JavaScript execution', 'API data extraction', 'complex data structures'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    },
    {
      id: 'smart-navigator',
      name: 'Smart Navigator',
      description: 'Intelligent web navigation with adaptive strategies',
      category: 'navigation',
      strengths: ['smart navigation', 'link following', 'form submission', 'redirect handling'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 1
    },
    {
      id: 'spa-handler',
      name: 'SPA Handler',
      description: 'Single Page Application automation with dynamic content handling',
      category: 'navigation',
      strengths: ['SPA automation', 'dynamic content', 'AJAX handling', 'state management'],
      isLocal: true,
      requiresSetup: false,
      isAvailable: true,
      priority: 2
    }
  ];

  useEffect(() => {
    // Simulate loading agents
    const loadAgents = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setAgents(mockAgents);
      setLoading(false);
    };

    loadAgents();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'vision': return <Eye className="w-4 h-4" />;
      case 'automation': return <Zap className="w-4 h-4" />;
      case 'planning': return <Settings className="w-4 h-4" />;
      case 'extraction': return <Database className="w-4 h-4" />;
      case 'navigation': return <Navigation className="w-4 h-4" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'vision': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'automation': return 'bg-green-100 text-green-800 border-green-200';
      case 'planning': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'extraction': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'navigation': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredAgents = selectedCategory === 'all' 
    ? agents 
    : agents.filter(agent => agent.category === selectedCategory);

  const categories = [
    { id: 'all', name: 'All Agents', count: agents.length },
    { id: 'vision', name: 'Vision', count: agents.filter(a => a.category === 'vision').length },
    { id: 'automation', name: 'Automation', count: agents.filter(a => a.category === 'automation').length },
    { id: 'planning', name: 'Planning', count: agents.filter(a => a.category === 'planning').length },
    { id: 'extraction', name: 'Extraction', count: agents.filter(a => a.category === 'extraction').length },
    { id: 'navigation', name: 'Navigation', count: agents.filter(a => a.category === 'navigation').length }
  ];

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Loading AI agents...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">AI AGENT SELECTOR</h2>
        <p className="text-muted-foreground">Choose the best AI agent for your automation task</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map(category => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            className="flex items-center gap-2"
          >
            {getCategoryIcon(category.id)}
            {category.name}
            <Badge variant="secondary" className="ml-1">
              {category.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map(agent => (
          <Card 
            key={agent.id}
            className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedAgent === agent.id 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-card/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onAgentSelect(agent.id)}
          >
            <div className="space-y-3">
              {/* Agent Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(agent.category)}
                  <h3 className="font-semibold text-lg">{agent.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {agent.isAvailable ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  {agent.isLocal && (
                    <Badge variant="outline" className="text-xs">
                      Local
                    </Badge>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>

              {/* Category Badge */}
              <div className="flex items-center gap-2">
                <Badge className={getCategoryColor(agent.category)}>
                  {agent.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Priority {agent.priority}
                </Badge>
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Strengths:</h4>
                <div className="flex flex-wrap gap-1">
                  {agent.strengths.slice(0, 3).map(strength => (
                    <Badge key={strength} variant="secondary" className="text-xs">
                      {strength}
                    </Badge>
                  ))}
                  {agent.strengths.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{agent.strengths.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {agent.requiresSetup && (
                    <Badge variant="destructive" className="text-xs">
                      Setup Required
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={selectedAgent === agent.id ? 'default' : 'outline'}
                  disabled={disabled || !agent.isAvailable}
                  className="flex items-center gap-1"
                >
                  {selectedAgent === agent.id ? (
                    <>
                      <Pause className="w-3 h-3" />
                      Selected
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Select
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Showing {filteredAgents.length} of {agents.length} AI agents
          {selectedCategory !== 'all' && ` in ${selectedCategory} category`}
        </p>
        <p className="mt-1">
          All agents work locally without API keys • No external dependencies required
        </p>
      </div>
    </div>
  );
}