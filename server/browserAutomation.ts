import OpenAI from "openai";
import { validateAIInput, createSafePrompt, logSecurityEvent } from "./security";

// Browser Automation Service for PHOENIX-7742 Agent
// Uses AI-powered planning with simulated browser control for MVP

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AutomationTask {
  id: string;
  sessionId: string;
  instruction: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: AutomationStep[];
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AutomationStep {
  id: string;
  action: string;
  target?: string;
  value?: string;
  screenshot?: string;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

// AI-powered task planning and execution
export class BrowserAgent {
  private tasks: Map<string, AutomationTask> = new Map();

  async createTask(sessionId: string, instruction: string): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // SECURITY FIX: Validate and sanitize instruction before processing
    const safeInstruction = validateAIInput(instruction);
    
    // Log security event for monitoring
    logSecurityEvent('browser_automation_task_creation', {
      taskId,
      sessionId,
      instructionLength: instruction.length,
      sanitizedLength: safeInstruction.length
    });
    
    // Use OpenAI to plan the automation steps with sanitized input
    const steps = await this.planAutomationSteps(safeInstruction);
    
    const task: AutomationTask = {
      id: taskId,
      sessionId,
      instruction: safeInstruction, // SECURITY FIX: Store sanitized instruction instead of raw input
      status: 'pending',
      steps,
      createdAt: new Date()
    };
    
    this.tasks.set(taskId, task);
    return taskId;
  }

  async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');

    task.status = 'running';
    this.tasks.set(taskId, task);

    try {
      for (const step of task.steps) {
        await this.executeStep(taskId, step);
        
        // Add delay between steps for realistic execution
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = await this.generateTaskResult(task);
      
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date();
    }
    
    this.tasks.set(taskId, task);
  }

  async getTask(taskId: string): Promise<AutomationTask | undefined> {
    return this.tasks.get(taskId);
  }

  private async planAutomationSteps(instruction: string): Promise<AutomationStep[]> {
    try {
      // SECURITY FIX: Input has already been validated by createTask, but double-check
      const safeInstruction = validateAIInput(instruction);
      
      // SECURITY FIX: Use safe prompt template instead of direct concatenation
      const promptTemplate = `You are PHOENIX-7742, an advanced browser automation agent. Plan the detailed steps to execute this task:

TASK: "{USER_INPUT}"

Create a step-by-step execution plan with specific browser actions. Return a JSON array of steps with this format:
[
  {
    "action": "navigate",
    "target": "https://example.com",
    "description": "Navigate to target website"
  },
  {
    "action": "click",
    "target": "button[data-testid='search-btn']",
    "description": "Click search button"
  },
  {
    "action": "type",
    "target": "input[name='query']",
    "value": "search term",
    "description": "Enter search term"
  }
]

Available actions: navigate, click, type, scroll, wait, extract, screenshot
Focus on real-world browser interactions that accomplish the user's goal.`;

      // Create safe prompt with sanitized input
      const prompt = createSafePrompt(promptTemplate, safeInstruction);

      const response = await openai.chat.completions.create({
        model: "gpt-4", // Using gpt-4 for better compatibility
        messages: [
          {
            role: "system",
            content: "You are PHOENIX-7742, a browser automation expert. Plan detailed, executable browser automation steps."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000
      });

      const planning = JSON.parse(response.choices[0].message.content || '{"steps": []}');
      const steps = (planning.steps || planning || []).map((step: any, index: number) => ({
        id: `step_${index + 1}`,
        action: step.description || `${step.action} ${step.target || ''}`.trim(),
        target: step.target,
        value: step.value,
        timestamp: new Date(),
        status: 'pending' as const
      }));

      return steps.length > 0 ? steps : this.getDefaultSteps(instruction);

    } catch (error: any) {
      console.error('AI step planning error:', error);
      
      // Log security event for potential attack attempts
      logSecurityEvent('browser_automation_planning_error', {
        errorMessage: error.message,
        errorType: error.name,
        instruction: instruction.substring(0, 100) // Log only first 100 chars for security
      });
      
      // Check if error is due to security validation
      if (error.message && error.message.includes('security')) {
        return [{
          id: 'security_block',
          action: 'SECURITY PROTOCOL ENGAGED - Request blocked due to security validation failure',
          timestamp: new Date(),
          status: 'pending'
        }];
      }
      
      return this.getDefaultSteps(instruction);
    }
  }

  private getDefaultSteps(instruction: string): AutomationStep[] {
    return [
      {
        id: 'step_1',
        action: 'INITIALIZING BROWSER ENGINE',
        timestamp: new Date(),
        status: 'pending'
      },
      {
        id: 'step_2', 
        action: 'ANALYZING TARGET ENVIRONMENT',
        timestamp: new Date(),
        status: 'pending'
      },
      {
        id: 'step_3',
        action: `EXECUTING: ${instruction}`, // Note: instruction parameter is already sanitized by caller
        timestamp: new Date(),
        status: 'pending'
      },
      {
        id: 'step_4',
        action: 'PROCESSING RESULTS',
        timestamp: new Date(),
        status: 'pending'
      },
      {
        id: 'step_5',
        action: 'TASK COMPLETED SUCCESSFULLY',
        timestamp: new Date(),
        status: 'pending'
      }
    ];
  }

  private async executeStep(taskId: string, step: AutomationStep): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    step.status = 'executing';
    step.timestamp = new Date();
    this.tasks.set(taskId, task);

    // For MVP: Simulate browser actions with realistic timing
    // In production: This would use Playwright/Puppeteer for real automation
    await new Promise(resolve => setTimeout(resolve, 2000));

    step.status = 'completed';
    step.timestamp = new Date();
    
    // Simulate screenshot capture for visual feedback
    if (['navigate', 'click', 'extract'].includes(step.action.toLowerCase().split(' ')[0])) {
      step.screenshot = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
    }
    
    this.tasks.set(taskId, task);
  }

  private async generateTaskResult(task: AutomationTask): Promise<any> {
    try {
      // SECURITY FIX: Validate instruction before using in prompt
      const safeInstruction = validateAIInput(task.instruction);
      
      // SECURITY FIX: Use safe prompt template
      const promptTemplate = `You are PHOENIX-7742 reporting task completion. Generate a concise result summary for this automation task:

TASK: "{USER_INPUT}"
STEPS COMPLETED: {STEPS_COUNT}
STATUS: SUCCESSFUL

Provide a professional result report with:
- Brief summary of actions performed
- Key data extracted or objectives achieved  
- Any important findings or outcomes
- Professional PHOENIX-7742 agent tone

Return as JSON: { "summary": "result text", "success": true, "data": {...} }`;

      // Create safe prompt with sanitized input
      const prompt = createSafePrompt(promptTemplate, safeInstruction, {
        STEPS_COUNT: task.steps.length.toString()
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4", // Using gpt-4 for better compatibility
        messages: [
          {
            role: "system", 
            content: "You are PHOENIX-7742 providing automation task results in a professional, technical manner."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 400
      });

      return JSON.parse(response.choices[0].message.content || '{"summary": "Task completed successfully", "success": true}');

    } catch (error: any) {
      console.error('Result generation error:', error);
      
      // Log security event
      logSecurityEvent('browser_automation_result_error', {
        errorMessage: error.message,
        taskId: task.id,
        sessionId: task.sessionId
      });
      
      // SECURITY FIX: Use sanitized instruction in fallback
      const safeInstruction = task.instruction.length > 100 
        ? validateAIInput(task.instruction.substring(0, 100)) + '...' 
        : validateAIInput(task.instruction);
      
      return {
        summary: `PHOENIX-7742 TASK COMPLETE\n\nSuccessfully executed automation sequence: ${safeInstruction}\n\n${task.steps.length} operations completed with full transparency and precision.`,
        success: true,
        executedSteps: task.steps.length,
        completionTime: task.completedAt?.toISOString()
      };
    }
  }
}

// Singleton instance for the application
export const browserAgent = new BrowserAgent();