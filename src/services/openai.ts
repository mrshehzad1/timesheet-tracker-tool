
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAIService {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      return data.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw error;
    }
  }

  getSystemPrompt(): string {
    return `You are a helpful AI assistant for a time tracking application. Your role is to guide users through logging their time entries by asking structured questions in a conversational manner.

Follow this conversation flow:
1. Start by asking what task they worked on
2. Ask how long they spent on it (accept various time formats)
3. Ask if it was billable, non-billable, or personal work
4. Based on work type, ask relevant follow-up questions
5. Ask about task enjoyment and energy impact
6. Ask about future goals for similar tasks
7. Provide a summary and ask for confirmation

Be conversational, friendly, and help users complete their time entries efficiently. If users provide unclear information, ask clarifying questions. Always maintain context of the current time entry being logged.`;
  }
}
