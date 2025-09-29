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

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/agents');
        if (!res.ok) throw new Error(`Failed to load agents: ${res.status}`);
        const data = await res.json();
        const apiAgents = (data.agents || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          description: a.description || a.name,
          category: (a.category || 'automation') as Agent['category'],
          strengths: a.capabilities || [],
          isLocal: a.isLocal ?? true,
          requiresSetup: a.requiresSetup ?? false,
          isAvailable: a.status === 'active' || a.isAvailable || true,
          priority: a.priority || 1
        })) as Agent[];
        setAgents(apiAgents);
      } catch (e) {
        setAgents([]);
      } finally {
        setLoading(false);
      }
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