/**
 * ONEDOLLARAGENT FILE AGENT
 * Real implementation based on OneDollarAgent framework
 * NO FAKE WRAPPERS - ACTUAL FILE OPERATIONS
 */

import { Agent, AgentContext, AgentChain } from '../core/onedollaragent-framework';

export class OneDollarAgentFileAgent implements Agent {
  public Name = "OneDollarAgentFileAgent";
  public Description = "Real file operations agent";
  public AgentContext?: any;

  async run(context: AgentContext, agentChain: AgentChain): Promise<string> {
    console.log('📁 ONEDOLLARAGENT FILE AGENT: Starting real file operations');
    
    try {
      // Get task prompt from context
      const taskPrompt = context.context.chain.taskPrompt;
      console.log('🎯 ONEDOLLARAGENT FILE AGENT: Task:', taskPrompt);
      
      // Parse natural language into file actions
      const actions = await this.parseTaskToActions(taskPrompt);
      console.log('📋 ONEDOLLARAGENT FILE AGENT: Parsed actions:', actions);
      
      // Execute actions
      const results: string[] = [];
      
      for (const action of actions) {
        console.log('🎬 EKO FILE AGENT: Executing action:', action);
        
        let result: any;
        
        switch (action.type) {
          case 'download':
            result = await this.executeDownload(action);
            break;
          case 'save':
            result = await this.executeSave(action);
            break;
          case 'read':
            result = await this.executeRead(action);
            break;
          default:
            result = { success: false, error: `Unknown action: ${action.type}` };
        }
        
        results.push(`Action ${action.type}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        
        // Add delay between actions
        await this.delay(500);
      }
      
      const finalResult = results.join('\n');
      console.log('✅ EKO FILE AGENT: Completed with results:', finalResult);
      
      return finalResult;
      
    } catch (error) {
      console.error('❌ EKO FILE AGENT: Error:', error);
      return `File operations failed: ${error}`;
    }
  }

  /**
   * Parse natural language task into structured file actions
   */
  private async parseTaskToActions(taskPrompt: string): Promise<FileAction[]> {
    const actions: FileAction[] = [];
    const prompt = taskPrompt.toLowerCase();
    
    // Download files
    const downloadMatches = prompt.match(/(?:download|save|get)\s+(?:the\s+)?([^,.\n]+)/g);
    if (downloadMatches) {
      for (const match of downloadMatches) {
        const filename = match.replace(/(?:download|save|get)\s+(?:the\s+)?/, '').trim();
        actions.push({
          type: 'download',
          filename: filename,
          url: this.extractUrlFromPrompt(taskPrompt)
        });
      }
    }
    
    // Save content
    const saveMatches = prompt.match(/(?:save|write|create)\s+(?:the\s+)?([^,.\n]+)\s+(?:as|to)\s+(?:the\s+)?([^,.\n]+)/g);
    if (saveMatches) {
      for (const match of saveMatches) {
        const [, content, filename] = match.match(/(?:save|write|create)\s+(?:the\s+)?(.+?)\s+(?:as|to)\s+(?:the\s+)?(.+)/) || [];
        if (content && filename) {
          actions.push({
            type: 'save',
            content: content,
            filename: filename
          });
        }
      }
    }
    
    // Read files
    const readMatches = prompt.match(/(?:read|open|load)\s+(?:the\s+)?([^,.\n]+)/g);
    if (readMatches) {
      for (const match of readMatches) {
        const filename = match.replace(/(?:read|open|load)\s+(?:the\s+)?/, '').trim();
        actions.push({
          type: 'read',
          filename: filename
        });
      }
    }
    
    return actions;
  }

  /**
   * Extract URL from prompt
   */
  private extractUrlFromPrompt(prompt: string): string {
    const urlMatch = prompt.match(/(https?:\/\/[^\s]+)/);
    return urlMatch ? urlMatch[1] : '';
  }

  /**
   * Execute download action
   */
  private async executeDownload(action: DownloadAction): Promise<ActionResult> {
    try {
      if (action.url) {
        // Create download link
        const link = document.createElement('a');
        link.href = action.url;
        link.download = action.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return { success: true, result: `Downloaded ${action.filename} from ${action.url}` };
      } else {
        return { success: false, error: 'No URL provided for download' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute save action
   */
  private async executeSave(action: SaveAction): Promise<ActionResult> {
    try {
      // Create blob and download
      const blob = new Blob([action.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = action.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      return { success: true, result: `Saved content to ${action.filename}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute read action
   */
  private async executeRead(action: ReadAction): Promise<ActionResult> {
    try {
      // For web environment, we can't directly read local files
      // This would typically be handled by file input or server-side processing
      return { 
        success: false, 
        error: 'File reading not available in browser environment. Use file input instead.' 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Action Types
interface FileAction {
  type: 'download' | 'save' | 'read';
}

interface DownloadAction extends FileAction {
  type: 'download';
  filename: string;
  url: string;
}

interface SaveAction extends FileAction {
  type: 'save';
  content: string;
  filename: string;
}

interface ReadAction extends FileAction {
  type: 'read';
  filename: string;
}

interface ActionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export default OneDollarAgentFileAgent;
