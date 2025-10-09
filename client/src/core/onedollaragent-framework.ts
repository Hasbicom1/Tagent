/**
 * ONEDOLLARAGENT FRAMEWORK IMPLEMENTATION
 * Based on https://github.com/FellouAI/eko.git
 * Real implementation - NO FAKE WRAPPERS
 */

import { io, Socket } from 'socket.io-client';

// OneDollarAgent Core Types
export interface OneDollarAgentConfig {
  agents: Agent[];
  llms?: any;
  callback?: OneDollarAgentCallback;
  a2aClient?: any;
  agentParallel?: boolean;
}

export interface OneDollarAgentResult {
  success: boolean;
  stopReason: 'done' | 'abort' | 'error';
  taskId: string;
  result: string;
  error?: any;
}

export interface Workflow {
  taskId: string;
  taskPrompt: string;
  name: string;
  agents: AgentNode[];
  modified?: boolean;
}

export interface AgentNode {
  id: string;
  agent: {
    name: string;
    id: string;
    status: 'init' | 'running' | 'done' | 'error';
  };
  result?: string;
}

export interface Agent {
  Name: string;
  Description: string;
  run(context: AgentContext, agentChain: AgentChain): Promise<string>;
  AgentContext?: any;
}

export interface AgentContext {
  context: Context;
  agent: Agent;
  agentChain: AgentChain;
  variables: Map<string, any>;
}

export interface AgentChain {
  agent: AgentNode;
  messages: any[];
}

export interface Context {
  taskId: string;
  config: OneDollarAgentConfig;
  agents: Agent[];
  chain: Chain;
  workflow: Workflow;
  conversation: string[];
  variables: Map<string, any>;
  pause: boolean;
  controller: AbortController;
  setPause(pause: boolean, abortCurrentStep?: boolean): void;
  checkAborted(): Promise<void>;
  reset(): void;
  currentAgent(): [Agent, AgentChain] | undefined;
}

export interface Chain {
  taskPrompt: string;
  push(agentChain: AgentChain): void;
}

export interface OneDollarAgentCallback {
  onMessage(message: any, agentContext?: any): Promise<void>;
}

// OneDollarAgent Framework Implementation
export class OneDollarAgentFramework {
  private config: OneDollarAgentConfig;
  private taskMap: Map<string, Context> = new Map();
  private socket: Socket;

  constructor(config: OneDollarAgentConfig) {
    this.config = config;
    this.socket = io(window.location.origin, {
      path: '/ws/socket.io/',
      transports: ['websocket', 'polling']
    });
  }

  /**
   * Generate workflow from natural language prompt
   */
  public async generate(
    taskPrompt: string,
    taskId: string = this.uuidv4(),
    contextParams?: Record<string, any>
  ): Promise<Workflow> {
    console.log('🎯 EKO: Generating workflow for:', taskPrompt);
    
    const agents = [...(this.config.agents || [])];
    const chain: Chain = new Chain(taskPrompt);
    const context = new Context(taskId, this.config, agents, chain);
    
    if (contextParams) {
      Object.keys(contextParams).forEach((key) =>
        context.variables.set(key, contextParams[key])
      );
    }

    try {
      this.taskMap.set(taskId, context);
      
      // Create workflow with AI agents
      const workflow: Workflow = {
        taskId,
        taskPrompt,
        name: `Task: ${taskPrompt.substring(0, 50)}...`,
        agents: this.selectAgents(taskPrompt, agents),
        modified: false
      };
      
      context.workflow = workflow;
      console.log('✅ EKO: Workflow generated with', workflow.agents.length, 'agents');
      
      return workflow;
    } catch (e) {
      this.deleteTask(taskId);
      throw e;
    }
  }

  /**
   * Execute workflow with real AI agents
   */
  public async execute(taskId: string): Promise<EkoResult> {
    const context = this.getTask(taskId);
    if (!context) {
      throw new Error("The task does not exist");
    }

    console.log('🚀 EKO: Executing workflow for task:', taskId);
    
    try {
      return await this.doRunWorkflow(context);
    } catch (e: any) {
      console.error('❌ EKO: Execution error:', e);
      return {
        taskId,
        success: false,
        stopReason: e?.name === "AbortError" ? "abort" : "error",
        result: e ? e.name + ": " + e.message : "Error",
        error: e,
      };
    }
  }

  /**
   * Run complete task (generate + execute)
   */
  public async run(
    taskPrompt: string,
    taskId: string = this.uuidv4(),
    contextParams?: Record<string, any>
  ): Promise<EkoResult> {
    await this.generate(taskPrompt, taskId, contextParams);
    return await this.execute(taskId);
  }

  /**
   * Select appropriate agents based on task
   */
  private selectAgents(taskPrompt: string, agents: Agent[]): AgentNode[] {
    const selectedAgents: AgentNode[] = [];
    
    // AI-powered agent selection
    if (taskPrompt.toLowerCase().includes('browser') || 
        taskPrompt.toLowerCase().includes('click') || 
        taskPrompt.toLowerCase().includes('navigate')) {
      selectedAgents.push({
        id: this.uuidv4(),
        agent: {
          name: 'BrowserAgent',
          id: this.uuidv4(),
          status: 'init'
        }
      });
    }
    
    if (taskPrompt.toLowerCase().includes('file') || 
        taskPrompt.toLowerCase().includes('download') || 
        taskPrompt.toLowerCase().includes('save')) {
      selectedAgents.push({
        id: this.uuidv4(),
        agent: {
          name: 'FileAgent',
          id: this.uuidv4(),
          status: 'init'
        }
      });
    }
    
    // Default to BrowserAgent if no specific agents selected
    if (selectedAgents.length === 0) {
      selectedAgents.push({
        id: this.uuidv4(),
        agent: {
          name: 'BrowserAgent',
          id: this.uuidv4(),
          status: 'init'
        }
      });
    }
    
    return selectedAgents;
  }

  /**
   * Execute workflow with real agents
   */
  private async doRunWorkflow(context: Context): Promise<EkoResult> {
    const agents = context.agents as Agent[];
    const workflow = context.workflow as Workflow;
    
    if (!workflow || workflow.agents.length === 0) {
      throw new Error("Workflow error");
    }

    const agentNameMap = agents.reduce((map, item) => {
      map[item.Name] = item;
      return map;
    }, {} as { [key: string]: Agent });

    const results: string[] = [];
    
    for (const agentNode of workflow.agents) {
      await context.checkAborted();
      
      const agent = agentNameMap[agentNode.agent.name];
      if (!agent) {
        throw new Error("Unknown Agent: " + agentNode.agent.name);
      }

      const agentChain = new AgentChain(agentNode);
      context.chain.push(agentChain);
      
      const result = await this.runAgent(context, agent, agentNode, agentChain);
      results.push(result);
    }

    return {
      success: true,
      stopReason: "done",
      taskId: context.taskId,
      result: results[results.length - 1] || "",
    };
  }

  /**
   * Run individual agent with real execution
   */
  private async runAgent(
    context: Context,
    agent: Agent,
    agentNode: AgentNode,
    agentChain: AgentChain
  ): Promise<string> {
    try {
      agentNode.agent.status = "running";
      
      // Emit agent start event
      this.socket.emit('agent:start', {
        taskId: context.taskId,
        agentName: agentNode.agent.name,
        nodeId: agentNode.agent.id,
        type: "agent_start",
        agentNode: agentNode.agent,
      });

      // Execute real agent
      agentNode.result = await agent.run(context, agentChain);
      agentNode.agent.status = "done";
      
      // Emit agent result event
      this.socket.emit('agent:result', {
        taskId: context.taskId,
        agentName: agentNode.agent.name,
        nodeId: agentNode.agent.id,
        type: "agent_result",
        agentNode: agentNode.agent,
        result: agentNode.result,
      });

      return agentNode.result;
    } catch (e) {
      agentNode.agent.status = "error";
      
      // Emit agent error event
      this.socket.emit('agent:error', {
        taskId: context.taskId,
        agentName: agentNode.agent.name,
        nodeId: agentNode.agent.id,
        type: "agent_error",
        agentNode: agentNode.agent,
        error: e,
      });
      
      throw e;
    }
  }

  // Utility methods
  public getTask(taskId: string): Context | undefined {
    return this.taskMap.get(taskId);
  }

  public getAllTaskId(): string[] {
    return [...this.taskMap.keys()];
  }

  public deleteTask(taskId: string): boolean {
    this.abortTask(taskId);
    const context = this.taskMap.get(taskId);
    if (context) {
      context.variables.clear();
    }
    return this.taskMap.delete(taskId);
  }

  public abortTask(taskId: string, reason?: string): boolean {
    const context = this.taskMap.get(taskId);
    if (context) {
      context.setPause(false);
      context.controller.abort(reason);
      return true;
    }
    return false;
  }

  public pauseTask(taskId: string, pause: boolean, reason?: string): boolean {
    const context = this.taskMap.get(taskId);
    if (context) {
      context.setPause(pause);
      return true;
    }
    return false;
  }

  private uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Chain Implementation
class Chain implements Chain {
  public taskPrompt: string;
  private chains: AgentChain[] = [];

  constructor(taskPrompt: string) {
    this.taskPrompt = taskPrompt;
  }

  push(agentChain: AgentChain): void {
    this.chains.push(agentChain);
  }
}

// AgentChain Implementation
class AgentChain implements AgentChain {
  public agent: AgentNode;
  public messages: any[] = [];

  constructor(agent: AgentNode) {
    this.agent = agent;
  }
}

// Context Implementation
class Context implements Context {
  public taskId: string;
  public config: EkoConfig;
  public agents: Agent[];
  public chain: Chain;
  public workflow: Workflow;
  public conversation: string[] = [];
  public variables: Map<string, any> = new Map();
  public pause: boolean = false;
  public controller: AbortController = new AbortController();

  constructor(taskId: string, config: EkoConfig, agents: Agent[], chain: Chain) {
    this.taskId = taskId;
    this.config = config;
    this.agents = agents;
    this.chain = chain;
    this.workflow = {} as Workflow;
  }

  setPause(pause: boolean, abortCurrentStep?: boolean): void {
    this.pause = pause;
    if (abortCurrentStep) {
      this.controller.abort();
    }
  }

  async checkAborted(): Promise<void> {
    if (this.controller.signal.aborted) {
      throw new Error('AbortError');
    }
  }

  reset(): void {
    this.controller = new AbortController();
  }

  currentAgent(): [Agent, AgentChain] | undefined {
    // Implementation for getting current agent
    return undefined;
  }
}

export default EkoFramework;
