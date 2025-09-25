/**
 * BROWSER MCP SERVER
 * 
 * Model Context Protocol integration for browser automation
 * Provides MCP-compliant browser control capabilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserChatAgent } from '../agents/browser-chat-agent.js';
import { logger } from '../logger.js';

export class BrowserMCPServer {
  private server: Server;
  private browserAgent: BrowserChatAgent;
  private sessions: Map<string, any> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'browser-automation-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.browserAgent = new BrowserChatAgent();
    this.setupHandlers();
  }

  /**
   * Setup MCP handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'browser_navigate',
            description: 'Navigate to a URL in the browser',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to navigate to',
                },
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID',
                },
              },
              required: ['url', 'sessionId'],
            },
          },
          {
            name: 'browser_click',
            description: 'Click an element on the page',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector of the element to click',
                },
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID',
                },
              },
              required: ['selector', 'sessionId'],
            },
          },
          {
            name: 'browser_type',
            description: 'Type text into an input field',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector of the input field',
                },
                text: {
                  type: 'string',
                  description: 'Text to type',
                },
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID',
                },
              },
              required: ['selector', 'text', 'sessionId'],
            },
          },
          {
            name: 'browser_screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID',
                },
                fullPage: {
                  type: 'boolean',
                  description: 'Whether to capture the full page',
                  default: true,
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'browser_extract_data',
            description: 'Extract data from the current page',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID',
                },
                selectors: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'CSS selectors to extract data from',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'browser_execute_task',
            description: 'Execute a natural language task in the browser',
            inputSchema: {
              type: 'object',
              properties: {
                instruction: {
                  type: 'string',
                  description: 'Natural language instruction for the task',
                },
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID',
                },
                url: {
                  type: 'string',
                  description: 'Optional URL to start from',
                },
              },
              required: ['instruction', 'sessionId'],
            },
          },
          {
            name: 'browser_create_session',
            description: 'Create a new browser session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Unique session identifier',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'browser_close_session',
            description: 'Close a browser session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Browser session ID to close',
                },
              },
              required: ['sessionId'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'browser_create_session':
            return await this.handleCreateSession(args);
          
          case 'browser_close_session':
            return await this.handleCloseSession(args);
          
          case 'browser_navigate':
            return await this.handleNavigate(args);
          
          case 'browser_click':
            return await this.handleClick(args);
          
          case 'browser_type':
            return await this.handleType(args);
          
          case 'browser_screenshot':
            return await this.handleScreenshot(args);
          
          case 'browser_extract_data':
            return await this.handleExtractData(args);
          
          case 'browser_execute_task':
            return await this.handleExecuteTask(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('❌ Browser MCP: Tool execution failed', {
          tool: name,
          error: error instanceof Error ? error.message : 'unknown error'
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : 'unknown error'}`,
            },
          ],
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'browser://sessions',
            name: 'Browser Sessions',
            description: 'List of active browser sessions',
            mimeType: 'application/json',
          },
          {
            uri: 'browser://screenshots',
            name: 'Browser Screenshots',
            description: 'Recent browser screenshots',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'browser://sessions':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  sessions: Array.from(this.sessions.keys()),
                  activeCount: this.sessions.size,
                }, null, 2),
              },
            ],
          };
        
        case 'browser://screenshots':
          const screenshots = Array.from(this.sessions.values()).map(session => ({
            sessionId: session.id,
            screenshots: session.screenshots || [],
            lastActivity: session.lastActivity,
          }));
          
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ screenshots }, null, 2),
              },
            ],
          };
        
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  /**
   * Handle create session tool
   */
  private async handleCreateSession(args: any) {
    const { sessionId } = args;
    
    try {
      const session = await this.browserAgent.createSession(sessionId);
      this.sessions.set(sessionId, session);
      
      return {
        content: [
          {
            type: 'text',
            text: `Browser session created successfully: ${sessionId}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle close session tool
   */
  private async handleCloseSession(args: any) {
    const { sessionId } = args;
    
    try {
      await this.browserAgent.closeSession(sessionId);
      this.sessions.delete(sessionId);
      
      return {
        content: [
          {
            type: 'text',
            text: `Browser session closed: ${sessionId}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to close session: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle navigate tool
   */
  private async handleNavigate(args: any) {
    const { url, sessionId } = args;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      await session.page.goto(url, { waitUntil: 'networkidle' });
      session.currentUrl = url;
      session.lastActivity = new Date();
      
      return {
        content: [
          {
            type: 'text',
            text: `Navigated to: ${url}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to navigate: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle click tool
   */
  private async handleClick(args: any) {
    const { selector, sessionId } = args;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      await session.page.click(selector);
      session.lastActivity = new Date();
      
      return {
        content: [
          {
            type: 'text',
            text: `Clicked element: ${selector}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to click: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle type tool
   */
  private async handleType(args: any) {
    const { selector, text, sessionId } = args;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      await session.page.fill(selector, text);
      session.lastActivity = new Date();
      
      return {
        content: [
          {
            type: 'text',
            text: `Typed "${text}" into: ${selector}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to type: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle screenshot tool
   */
  private async handleScreenshot(args: any) {
    const { sessionId, fullPage = true } = args;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      const screenshot = await session.page.screenshot({ 
        type: 'png',
        fullPage 
      });
      const base64Screenshot = screenshot.toString('base64');
      
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot captured (${fullPage ? 'full page' : 'viewport'})`,
          },
          {
            type: 'image',
            data: base64Screenshot,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to take screenshot: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle extract data tool
   */
  private async handleExtractData(args: any) {
    const { sessionId, selectors = [] } = args;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      const data = await session.page.evaluate((selectors) => {
        const result: any = {};
        
        if (selectors.length === 0) {
          // Extract common data
          result.title = document.title;
          result.url = window.location.href;
          result.headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent?.trim());
          result.links = Array.from(document.querySelectorAll('a[href]')).map(link => ({
            text: link.textContent?.trim(),
            href: link.href
          }));
        } else {
          // Extract specific selectors
          selectors.forEach((selector: string) => {
            const elements = document.querySelectorAll(selector);
            result[selector] = Array.from(elements).map(el => el.textContent?.trim());
          });
        }
        
        return result;
      }, selectors);
      
      return {
        content: [
          {
            type: 'text',
            text: `Extracted data: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to extract data: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Handle execute task tool
   */
  private async handleExecuteTask(args: any) {
    const { instruction, sessionId, url } = args;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    try {
      const task = {
        id: `task_${Date.now()}`,
        sessionId,
        instruction,
        context: url ? { url } : undefined
      };
      
      const result = await this.browserAgent.executeTask(sessionId, task);
      
      return {
        content: [
          {
            type: 'text',
            text: `Task executed: ${result.success ? 'Success' : 'Failed'}\nActions: ${result.actions.length}\nExecution time: ${result.executionTime}ms`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute task: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('✅ Browser MCP Server: Started successfully');
    } catch (error) {
      logger.error('❌ Browser MCP Server: Failed to start', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
      throw error;
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    try {
      // Close all sessions
      for (const sessionId of this.sessions.keys()) {
        await this.browserAgent.closeSession(sessionId);
      }
      
      this.sessions.clear();
      logger.info('✅ Browser MCP Server: Stopped successfully');
    } catch (error) {
      logger.error('❌ Browser MCP Server: Failed to stop', {
        error: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }
}

export default BrowserMCPServer;
