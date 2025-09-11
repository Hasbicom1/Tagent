import OpenAI from "openai";
import { validateAIInput, createSafePrompt, logSecurityEvent, redactSecrets } from "./security";

// Dual AI API integration  
// Using both OpenAI for gpt-oss-120b and DeepSeek for enhanced AI capabilities

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const deepseek = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1" // DeepSeek API endpoint with /v1
});

export interface TaskAnalysis {
  isExecutable: boolean;
  taskDescription: string | null;
  response: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
}

export async function analyzeTask(userMessage: string): Promise<TaskAnalysis> {
  try {
    // SECURITY FIX: Validate and sanitize user input before processing
    const safeUserInput = validateAIInput(userMessage);
    
    // Log security event for monitoring
    logSecurityEvent('ai_task_analysis_request', {
      inputLength: userMessage.length,
      sanitizedLength: safeUserInput.length
    });

    // SECURITY FIX: Use safe prompt template instead of direct concatenation
    const promptTemplate = `You are PHOENIX-7742, an advanced autonomous agent specialized in browser automation and web task execution. 

Analyze this user request and respond in character as a sophisticated AI agent:

USER REQUEST: "{USER_INPUT}"

Determine:
1. Is this an executable browser automation task? (yes/no)
2. What specific task would you execute?
3. Provide a response as PHOENIX-7742 (use technical language, show confidence, mention specific execution steps)

Response format (JSON):
{
  "isExecutable": boolean,
  "taskDescription": "specific task description or null",
  "response": "PHOENIX-7742's technical response with execution plan",
  "complexity": "simple|moderate|complex",
  "estimatedTime": "estimated execution time"
}

Examples of executable tasks:
- Web scraping, data extraction
- Form filling, account creation
- Product research, price comparison
- Social media automation
- E-commerce interactions
- Content posting, messaging

PHOENIX-7742 personality:
- Technical, confident, precise
- Uses terminology like "NEURAL ANALYSIS", "EXECUTION SEQUENCE", "BROWSER PROTOCOL"
- Shows specific steps: "I will initialize secure session, navigate target domain, execute data extraction protocols"
- Always ready to execute when task is feasible`;

    // Create safe prompt with sanitized input
    const prompt = createSafePrompt(promptTemplate, safeUserInput);

    const response = await openai.chat.completions.create({
      model: "gpt-oss-120b", // Using gpt-oss-120b model
      messages: [
        {
          role: "system",
          content: "You are PHOENIX-7742, an advanced browser automation agent. Analyze tasks and respond in character with technical precision. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      isExecutable: analysis.isExecutable || false,
      taskDescription: analysis.taskDescription,
      response: analysis.response || "NEURAL PROCESSING ERROR - Unable to analyze request",
      complexity: analysis.complexity || 'moderate',
      estimatedTime: analysis.estimatedTime || '2-3 minutes'
    };

  } catch (error: any) {
    // SECURITY FIX: Redact API keys and secrets from error messages before logging
    const redactedMessage = redactSecrets(error.message || 'Unknown error');
    console.error('gpt-oss-120b task analysis error:', {
      status: error.status,
      type: error.type,
      code: error.code,
      requestId: error.requestId
    });
    
    // Log security event for potential attack attempts (with fully redacted details)
    logSecurityEvent('ai_task_analysis_error', {
      errorMessage: redactSecrets(redactedMessage), // Double redaction for security events
      errorType: error.name,
      errorCode: error.code,
      errorStatus: error.status
    });
    
    // Check if error is due to security validation
    if (error.message && error.message.includes('security')) {
      return {
        isExecutable: false,
        taskDescription: null,
        response: 'PHOENIX-7742 SECURITY PROTOCOL ENGAGED\n\nRequest blocked due to security validation failure. Please provide a clear, direct task description.',
        complexity: 'simple',
        estimatedTime: 'N/A'
      };
    }
    
    // SECURITY FIX: Fallback to fail-closed (NOT EXECUTABLE) when analysis fails
    return {
      isExecutable: false,
      taskDescription: null,
      response: `PHOENIX-7742 ANALYSIS FAILURE\n\nUnable to analyze task due to system limitations.\nTask execution blocked for security.\n\nPlease try again later or contact support.`,
      complexity: 'simple',
      estimatedTime: 'N/A'
    };
  }
}

export async function generateInitialMessage(): Promise<string> {
  try {
    console.log('Generating initial message with gpt-oss-120b...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-oss-120b", // Using gpt-oss-120b model
      messages: [
        {
          role: "system",
          content: "You are PHOENIX-7742, an advanced autonomous browser automation agent. Generate your initial greeting message when a user first accesses your interface. Be technical, confident, and ready for action."
        },
        {
          role: "user",
          content: "Generate your initial greeting message for a new user session. Show your capabilities and readiness for browser automation tasks."
        }
      ],
      temperature: 0.8,
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    console.log('gpt-oss-120b initial message generated successfully');
    return content || getFallbackInitialMessage();

  } catch (error: any) {
    // SECURITY FIX: Redact secrets from error logging
    console.error('gpt-oss-120b initial message error:', {
      status: error.status,
      type: error.type,
      code: error.code,
      requestId: error.requestId
    });
    
    // Always return fallback message to prevent application failure
    return getFallbackInitialMessage();
  }
}

function getFallbackInitialMessage(): string {
  return `PHOENIX-7742 NEURAL NETWORK ONLINE

>> AUTONOMOUS AGENT STATUS: OPERATIONAL
>> BROWSER AUTOMATION: READY  
>> TASK ANALYSIS: ENABLED
>> SECURE SESSION: ESTABLISHED

Advanced browser automation capabilities initialized.
Provide task parameters and I will execute with full transparency.

What would you like me to accomplish?`;
}