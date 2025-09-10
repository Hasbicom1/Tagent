import OpenAI from "openai";

// Blueprint integration: javascript_openai
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TaskAnalysis {
  isExecutable: boolean;
  taskDescription: string | null;
  response: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
}

export async function analyzeTask(userMessage: string): Promise<TaskAnalysis> {
  try {
    const prompt = `You are PHOENIX-7742, an advanced autonomous agent specialized in browser automation and web task execution. 

Analyze this user request and respond in character as a sophisticated AI agent:

USER REQUEST: "${userMessage}"

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

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
      messages: [
        {
          role: "system",
          content: "You are PHOENIX-7742, an advanced browser automation agent. Analyze tasks and respond in character with technical precision."
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

  } catch (error) {
    console.error('OpenAI task analysis error:', error);
    
    // Fallback response if OpenAI fails
    return {
      isExecutable: true,
      taskDescription: 'General web automation task',
      response: `PHOENIX-7742 NEURAL NETWORK ONLINE\n\nTask parameters received and processed.\nI have developed an execution protocol for your request.\n\nReady to deploy browser automation sequence when you authorize execution.`,
      complexity: 'moderate',
      estimatedTime: '2-3 minutes'
    };
  }
}

export async function generateInitialMessage(): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
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

    return response.choices[0].message.content || 
      `PHOENIX-7742 NEURAL NETWORK ONLINE\n\nAutonomous agent initialized and ready for task deployment.\nProvide task parameters and I will execute with full transparency.\n\nWhat would you like me to accomplish?`;

  } catch (error) {
    console.error('OpenAI initial message error:', error);
    return `PHOENIX-7742 NEURAL NETWORK ONLINE\n\nAutonomous agent initialized and ready for task deployment.\nProvide task parameters and I will execute with full transparency.\n\nWhat would you like me to accomplish?`;
  }
}