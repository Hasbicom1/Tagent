import OpenAI from "openai";
import { browserAgent } from "./browserAutomation";
import UITarsAgent from "./agents/ui-tars-agent";
import LocalAgentManager from "./agents/local-agent-manager";

// MCP (Message Control Protocol) Orchestrator
// Routes commands to appropriate AI agents transparently

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
    name: "UI-TARS",
    id: "ui-tars",
    description: "Advanced GUI automation with computer vision (7.8k GitHub stars)",
    strengths: ["visual elements", "complex interactions", "game automation", "screenshot analysis", "form filling"],
    priority: 1
  },
  {
    name: "Browser-Use",
    id: "browser-use",
    description: "Primary automation engine for standard browser tasks",
    strengths: ["form filling", "navigation", "clicking", "typing", "general automation"],
    priority: 2
  },
  {
    name: "Skyvern", 
    id: "skyvern",
    description: "Visual AI tasks requiring computer vision",
    strengths: ["visual elements", "screenshots", "image recognition", "dynamic content"],
    priority: 3
  },
  {
    name: "LaVague",
    id: "lavague", 
    description: "Complex multi-step workflows and RAG-powered automation",
    strengths: ["complex workflows", "multi-step", "context awareness", "planning"],
    priority: 4
  },
  {
    name: "Stagehand",
    id: "stagehand",
    description: "TypeScript/JavaScript-based browser control",
    strengths: ["javascript tasks", "dynamic web apps", "spa automation"],
    priority: 5
  },
  {
    name: "UI.Vision",
    id: "ui-vision",
    description: "Extension-based automation and local execution", 
    strengths: ["local tasks", "privacy focused", "extension automation"],
    priority: 6
  }
];

class MCPOrchestrator {
  private activeCommands: Map<string, CommandResponse> = new Map();
  private uiTarsAgent: UITarsAgent | null = null;
  private localAgentManager: LocalAgentManager | null = null;

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
      
      // Route to appropriate agent based on selection
      if (selectedAgent.id === 'ui-tars') {
        await this.executeWithUITars(request, response);
      } else if (this.isLocalAgent(selectedAgent.id)) {
        await this.executeWithLocalAgent(request, response, selectedAgent.id);
      } else {
        // Fallback to existing browser agent for other agents
        await this.executeWithBrowserAgent(request, response);
      }
      
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

      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }

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

  /**
   * Initialize UI-TARS agent
   */
  async initializeUITars(): Promise<void> {
    if (!this.uiTarsAgent) {
      this.uiTarsAgent = new UITarsAgent({
        apiEndpoint: process.env.UI_TARS_API_ENDPOINT || 'https://api.huggingface.co/models/ByteDance-Seed/UI-TARS-1.5-7B',
        apiKey: process.env.UI_TARS_API_KEY,
        model: 'ui-tars-1.5-7b',
        maxRetries: 3,
        timeout: 30000
      });
      
      await this.uiTarsAgent.initialize();
    }
  }

  /**
   * Execute command with UI-TARS agent
   */
  private async executeWithUITars(request: CommandRequest, response: CommandResponse): Promise<void> {
    try {
      // Initialize UI-TARS if not already done
      if (!this.uiTarsAgent) {
        await this.initializeUITars();
      }

      if (!this.uiTarsAgent) {
        throw new Error('UI-TARS agent not available');
      }

      // Create automation task
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: request.sessionId,
        description: request.command,
        type: 'automation',
        timestamp: new Date().toISOString()
      };

      // Execute with UI-TARS
      const result = await this.uiTarsAgent.executeTask(task);
      
      if (result.success) {
        response.status = 'completed';
        response.result = result.result?.message || 'Task completed successfully with UI-TARS';
      } else {
        response.status = 'failed';
        response.error = 'UI-TARS execution failed';
      }
      
      this.activeCommands.set(response.commandId, response);
    } catch (error) {
      response.status = 'failed';
      response.error = error instanceof Error ? error.message : 'UI-TARS execution error';
      this.activeCommands.set(response.commandId, response);
    }
  }

  /**
   * Check if agent is a local agent
   */
  private isLocalAgent(agentId: string): boolean {
    const localAgents = ['browser-use', 'skyvern', 'lavague', 'stagehand'];
    return localAgents.includes(agentId);
  }

  /**
   * Initialize local agent manager
   */
  async initializeLocalAgents(): Promise<void> {
    if (!this.localAgentManager) {
      this.localAgentManager = new LocalAgentManager();
      await this.localAgentManager.initialize();
    }
  }

  /**
   * Execute command with local agent
   */
  private async executeWithLocalAgent(request: CommandRequest, response: CommandResponse, agentId: string): Promise<void> {
    try {
      // Initialize local agent manager if not already done
      if (!this.localAgentManager) {
        await this.initializeLocalAgents();
      }

      if (!this.localAgentManager) {
        throw new Error('Local agent manager not available');
      }

      // Create task for local agent
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: request.sessionId,
        instruction: request.command,
        selectedAgent: agentId
      };

      // Execute with local agent
      const result = await this.localAgentManager.executeTask(task, agentId);
      
      if (result.success) {
        response.status = 'completed';
        response.result = result.reasoning || `Task completed successfully with ${result.agent}`;
      } else {
        response.status = 'failed';
        response.error = result.error || `${result.agent} execution failed`;
      }
      
      this.activeCommands.set(response.commandId, response);
    } catch (error) {
      response.status = 'failed';
      response.error = error instanceof Error ? error.message : 'Local agent execution error';
      this.activeCommands.set(response.commandId, response);
    }
  }

  /**
   * Execute command with browser agent (fallback)
   */
  private async executeWithBrowserAgent(request: CommandRequest, response: CommandResponse): Promise<void> {
    try {
      const taskId = await browserAgent.createTask(request.sessionId, request.command);
      
      // Execute task asynchronously
      browserAgent.executeTask(taskId).then(async () => {
        const task = await browserAgent.getTask(taskId);
        if (task) {
          response.status = task.status === 'completed' ? 'completed' : 'failed';
          response.result = task.result?.summary || 'Task completed successfully';
          response.error = task.error;
          this.activeCommands.set(response.commandId, response);
        }
      }).catch(error => {
        response.status = 'failed';
        response.error = error.message;
        this.activeCommands.set(response.commandId, response);
      });
    } catch (error) {
      response.status = 'failed';
      response.error = error instanceof Error ? error.message : 'Browser agent execution error';
      this.activeCommands.set(response.commandId, response);
    }
  }
}

// Singleton instance
export const mcpOrchestrator = new MCPOrchestrator();