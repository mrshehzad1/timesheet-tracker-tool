
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIService {
  async generateResponse(messages: ChatMessage[]): Promise<string> {
    try {
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: { messages }
      });

      if (error) {
        throw error;
      }

      return data.content;
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
