/**
 * ONEDOLLARAGENT ORCHESTRATOR
 * Real implementation based on Eko framework
 * Coordinates multiple agents and natural language processing
 */

import { OneDollarAgentFramework, OneDollarAgentConfig, OneDollarAgentResult } from './onedollaragent-framework';
import { OneDollarAgentBrowserAgent } from '../agents/onedollaragent-browser-agent';
import { OneDollarAgentFileAgent } from '../agents/onedollaragent-file-agent';
import { io, Socket } from 'socket.io-client';

export class OneDollarAgentOrchestrator {
  private framework: OneDollarAgentFramework;
  private socket: Socket;
  private isRunning: boolean = false;
  private currentTaskId: string | null = null;

  constructor() {
    // Initialize OneDollarAgent framework with real agents
    const config: OneDollarAgentConfig = {
      agents: [
        new OneDollarAgentBrowserAgent(),
        new OneDollarAgentFileAgent()
      ],
      callback: {
        onMessage: async (message) => {
          console.log('📨 ONEDOLLARAGENT CALLBACK:', message);
          this.handleAgentMessage(message);
        }
      },
      agentParallel: false // Sequential execution for better control
    };

    this.framework = new OneDollarAgentFramework(config);
    
    // Initialize Socket.IO connection
    this.socket = io(window.location.origin, {
      path: '/ws/socket.io/',
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  /**
   * Execute natural language command
   */
  public async executeCommand(command: string): Promise<EkoResult> {
    console.log('🎯 EKO ORCHESTRATOR: Executing command:', command);
    
    try {
      this.isRunning = true;
      
      // Generate and execute workflow
      const result = await this.eko.run(command);
      
      this.isRunning = false;
      this.currentTaskId = null;
      
      console.log('✅ EKO ORCHESTRATOR: Command completed:', result);
      
      // Emit completion event
      this.socket.emit('eko:completed', {
        command,
        result,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error) {
      this.isRunning = false;
      this.currentTaskId = null;
      
      console.error('❌ EKO ORCHESTRATOR: Command failed:', error);
      
      // Emit error event
      this.socket.emit('eko:error', {
        command,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Handle agent messages and emit to frontend
   */
  private handleAgentMessage(message: any): void {
    console.log('📨 EKO ORCHESTRATOR: Agent message:', message);
    
    // Emit to frontend for real-time updates
    this.socket.emit('eko:agent:message', message);
    
    // Handle different message types
    switch (message.type) {
      case 'agent_start':
        this.handleAgentStart(message);
        break;
      case 'agent_result':
        this.handleAgentResult(message);
        break;
      case 'agent_error':
        this.handleAgentError(message);
        break;
    }
  }

  /**
   * Handle agent start
   */
  private handleAgentStart(message: any): void {
    console.log('🚀 EKO ORCHESTRATOR: Agent started:', message.agentName);
    
    // Show visual feedback
    this.showAgentStatus(`🤖 ${message.agentName} is starting...`, 'info');
  }

  /**
   * Handle agent result
   */
  private handleAgentResult(message: any): void {
    console.log('✅ EKO ORCHESTRATOR: Agent completed:', message.agentName);
    
    // Show visual feedback
    this.showAgentStatus(`✅ ${message.agentName} completed successfully`, 'success');
  }

  /**
   * Handle agent error
   */
  private handleAgentError(message: any): void {
    console.log('❌ EKO ORCHESTRATOR: Agent error:', message.agentName, message.error);
    
    // Show visual feedback
    this.showAgentStatus(`❌ ${message.agentName} failed: ${message.error}`, 'error');
  }

  /**
   * Show agent status in UI
   */
  private showAgentStatus(message: string, type: 'info' | 'success' | 'error'): void {
    // Create status element
    const status = document.createElement('div');
    status.id = 'eko-agent-status';
    status.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#00ff00' : '#333'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 999999;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 400px;
      word-wrap: break-word;
    `;
    
    status.textContent = message;
    document.body.appendChild(status);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (status.parentNode) {
        status.parentNode.removeChild(status);
      }
    }, 3000);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Socket.IO events
    this.socket.on('connect', () => {
      console.log('🔌 EKO ORCHESTRATOR: Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 EKO ORCHESTRATOR: Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ EKO ORCHESTRATOR: Connection error:', error);
    });

    // Listen for external commands
    this.socket.on('eko:command', async (data) => {
      console.log('📨 EKO ORCHESTRATOR: Received command:', data);
      try {
        await this.executeCommand(data.command);
      } catch (error) {
        console.error('❌ EKO ORCHESTRATOR: Command execution failed:', error);
      }
    });

    // Listen for task control
    this.socket.on('eko:abort', (data) => {
      console.log('🛑 EKO ORCHESTRATOR: Aborting task:', data.taskId);
      this.eko.abortTask(data.taskId, 'User requested abort');
    });

    this.socket.on('eko:pause', (data) => {
      console.log('⏸️ EKO ORCHESTRATOR: Pausing task:', data.taskId);
      this.eko.pauseTask(data.taskId, true, 'User requested pause');
    });

    this.socket.on('eko:resume', (data) => {
      console.log('▶️ EKO ORCHESTRATOR: Resuming task:', data.taskId);
      this.eko.pauseTask(data.taskId, false, 'User requested resume');
    });
  }

  /**
   * Get current status
   */
  public getStatus(): {
    isRunning: boolean;
    currentTaskId: string | null;
    connected: boolean;
  } {
    return {
      isRunning: this.isRunning,
      currentTaskId: this.currentTaskId,
      connected: this.socket.connected
    };
  }

  /**
   * Abort current task
   */
  public abortCurrentTask(): boolean {
    if (this.currentTaskId) {
      return this.eko.abortTask(this.currentTaskId, 'User requested abort');
    }
    return false;
  }

  /**
   * Pause current task
   */
  public pauseCurrentTask(): boolean {
    if (this.currentTaskId) {
      return this.eko.pauseTask(this.currentTaskId, true, 'User requested pause');
    }
    return false;
  }

  /**
   * Resume current task
   */
  public resumeCurrentTask(): boolean {
    if (this.currentTaskId) {
      return this.eko.pauseTask(this.currentTaskId, false, 'User requested resume');
    }
    return false;
  }
}

// Global instance
export const ekoOrchestrator = new EkoOrchestrator();

export default EkoOrchestrator;
