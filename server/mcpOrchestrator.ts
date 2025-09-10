import OpenAI from "openai";
import { browserAgent } from "./browserAutomation";

// MCP (Message Control Protocol) Orchestrator
// Routes commands to appropriate AI agents transparently

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CommandRequest {
  sessionId: string;
  command: string;
  timestamp: string;
}

export interface CommandResponse {
  commandId: string;
  agent: string;
  status: 'executing' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface AgentCapability {
  name: string;
  id: string;
  description: string;
  strengths: string[];
  priority: number;
}

// Available AI agents and their capabilities
const AVAILABLE_AGENTS: AgentCapability[] = [
  {
    name: "Browser-Use",
    id: "browser-use",
    description: "Primary automation engine for standard browser tasks",
    strengths: ["form filling", "navigation", "clicking", "typing", "general automation"],
    priority: 1
  },
  {
    name: "Skyvern", 
    id: "skyvern",
    description: "Visual AI tasks requiring computer vision",
    strengths: ["visual elements", "screenshots", "image recognition", "dynamic content"],
    priority: 2
  },
  {
    name: "LaVague",
    id: "lavague", 
    description: "Complex multi-step workflows and RAG-powered automation",
    strengths: ["complex workflows", "multi-step", "context awareness", "planning"],
    priority: 3
  },
  {
    name: "Stagehand",
    id: "stagehand",
    description: "TypeScript/JavaScript-based browser control",
    strengths: ["javascript tasks", "dynamic web apps", "spa automation"],
    priority: 4
  },
  {
    name: "UI.Vision",
    id: "ui-vision",
    description: "Extension-based automation and local execution", 
    strengths: ["local tasks", "privacy focused", "extension automation"],
    priority: 5
  }
];

class MCPOrchestrator {
  private activeCommands: Map<string, CommandResponse> = new Map();

  async routeCommand(request: CommandRequest): Promise<CommandResponse> {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Analyze command and select optimal agent
      const selectedAgent = await this.selectAgent(request.command);
      
      // Create command response
      const response: CommandResponse = {
        commandId,
        agent: selectedAgent.name,
        status: 'executing'
      };
      
      this.activeCommands.set(commandId, response);
      
      // Route to appropriate agent (currently all route through our existing browserAgent)
      // In production, this would route to specific agent implementations
      const taskId = await browserAgent.createTask(request.sessionId, request.command);
      
      // Execute task asynchronously
      browserAgent.executeTask(taskId).then(async () => {
        const task = await browserAgent.getTask(taskId);
        if (task) {
          response.status = task.status === 'completed' ? 'completed' : 'failed';
          response.result = task.result?.summary || 'Task completed successfully';
          response.error = task.error;
          this.activeCommands.set(commandId, response);
        }
      }).catch(error => {
        response.status = 'failed';
        response.error = error.message;
        this.activeCommands.set(commandId, response);
      });
      
      return response;
      
    } catch (error: any) {
      const response: CommandResponse = {
        commandId,
        agent: 'AI RAi',
        status: 'failed',
        error: error.message
      };
      
      this.activeCommands.set(commandId, response);
      return response;
    }
  }

  async selectAgent(command: string): Promise<AgentCapability> {
    try {
      const prompt = `Analyze this browser automation command and select the best agent:

COMMAND: "${command}"

AVAILABLE AGENTS:
${AVAILABLE_AGENTS.map(agent => 
  `${agent.name}: ${agent.description} (strengths: ${agent.strengths.join(', ')})`
).join('\n')}

Select the most appropriate agent based on the command requirements. Consider:
- Task complexity and type
- Required capabilities
- Agent strengths

Respond with JSON: { "selectedAgent": "agent-id", "reasoning": "brief explanation" }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an intelligent agent router. Analyze commands and select optimal agents for execution."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 300
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      const selectedAgentId = analysis.selectedAgent;
      
      const agent = AVAILABLE_AGENTS.find(a => a.id === selectedAgentId) || AVAILABLE_AGENTS[0];
      
      console.log(`MCP Orchestrator: Selected ${agent.name} for command: "${command}"`);
      
      return agent;
      
    } catch (error) {
      console.error('Agent selection error:', error);
      // Fallback to Browser-Use as default
      return AVAILABLE_AGENTS[0];
    }
  }

  getCommandStatus(commandId: string): CommandResponse | undefined {
    return this.activeCommands.get(commandId);
  }

  getActiveCommands(): CommandResponse[] {
    return Array.from(this.activeCommands.values());
  }

  generateAIResponse(command: string, agentName: string): string {
    // Generate natural AI RAi responses that don't reveal specific agent names
    const responses = [
      `I'll handle that task for you right away.`,
      `Processing your request now.`,
      `Working on that automation for you.`,
      `I'll take care of that browser task.`,
      `Executing your command with precision.`,
      `Let me automate that for you.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// Singleton instance
export const mcpOrchestrator = new MCPOrchestrator();