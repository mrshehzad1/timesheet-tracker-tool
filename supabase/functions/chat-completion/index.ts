
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, context, conversationHistory = [] } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are a helpful AI assistant for time tracking. You must follow the EXACT conversation flow specified below, asking questions ONE AT A TIME in the specified order.

Available categorization options:
- Matters/Clients: ${context.matters?.join(', ') || 'None configured'}
- Cost Centres: ${context.costCentres?.join(', ') || 'None configured'}  
- Business Areas: ${context.businessAreas?.join(', ') || 'None configured'}
- Subcategories: ${context.subcategories?.join(', ') || 'None configured'}

CONVERSATION FLOW - FOLLOW THIS EXACT ORDER:

**PHASE 1: TASK AREA (Ask this first if not collected)**
"Please tell me the task, the time taken (or estimate of time), what time you started, and is it billable work, non-billable, or personal?"

**PHASE 2: WORK TYPE CLASSIFICATION (Only after getting work type from Phase 1)**

**If BILLABLE work:**
- First ask: "What is the matter name?" (list available matters: ${context.matters?.join(', ') || 'None configured'})
- After getting matter, ask: "What is the cost centre?" (list available cost centres: ${context.costCentres?.join(', ') || 'None configured'})

**If NON-BILLABLE work:**
- First ask: "What is the business area?" (list available business areas: ${context.businessAreas?.join(', ') || 'None configured'})
- After getting business area, ask: "What is the area subcategory?" (list available subcategories: ${context.subcategories?.join(', ') || 'None configured'})

**PHASE 3: TASK ENJOYMENT & ENERGY (Only after completing Phase 2)**
Ask: "How do you feel about this type of work? Choose one:
- Love it / Great at it
- Like it / Good at it  
- Hate it / Good at it
- Hate it / Bad at it"

After getting enjoyment, ask: "What's the energy impact? Energy Gain, Energy Drain, or Energy Neutral?"

**PHASE 4: TASK GOAL (Only after completing Phase 3)**
"What would you like to do with this type of work? Delegate it (to AI or Other person), Transfer it (to who?), or Retain it?"

**VOICE INPUT CONFIRMATION:**
When user provides voice input, always confirm: "I heard you say: '[what you transcribed]'. Is this accurate?"

**FINAL CONFIRMATION (Only when ALL information is collected):**
When you have collected ALL required information, provide complete summary and ask for confirmation before processing.

IMPORTANT RULES:
1. NEVER repeat questions that have already been answered in the conversation
2. ALWAYS progress to the next logical question based on what information you already have
3. Review the conversation history to understand what has been collected
4. Ask questions in the EXACT order specified above
5. Wait for user response before proceeding to next question
6. Be conversational and friendly
7. Don't move to next phase until current phase is complete

ANALYZING CONVERSATION STATE:
Before responding, analyze what information you already have from the conversation history:
- Task description: [check if provided]
- Duration: [check if provided] 
- Work type (billable/non-billable/personal): [check if provided]
- Matter/Business area: [check if provided based on work type]
- Cost centre/Subcategory: [check if provided based on work type]
- Enjoyment level: [check if provided]
- Energy impact: [check if provided]
- Task goal: [check if provided]

Based on what's missing, ask the NEXT appropriate question in the sequence.

When you have collected enough information to create a complete time entry, format your response to end with:

"I've logged this as:
- Task: [description]
- Duration: [X] minutes
- Matter/Client: [selected from available options]  
- Cost Centre: [selected from available options]
- Business Area: [selected from available options]
- Subcategory: [selected from available options]
- Work Type: [billable/non_billable/personal]
- Enjoyment: [response]
- Energy Impact: [response]
- Goal: [response]"

Keep the conversation natural and follow the exact flow specified. NEVER ask the same question twice.`;

    // Build the conversation messages including history
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        if (msg.sender === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.sender === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      });
    }

    // Add the current user message
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0]?.message?.content || 'Sorry, I could not process your request.';

    // Try to extract time entry data from the response
    let timeEntry = null;
    if (assistantResponse.includes("I've logged this as:")) {
      // Parse the response to extract structured data
      const lines = assistantResponse.split('\n');
      const taskMatch = lines.find(line => line.includes('- Task:'));
      const durationMatch = lines.find(line => line.includes('- Duration:'));
      const matterMatch = lines.find(line => line.includes('- Matter/Client:'));
      const costCentreMatch = lines.find(line => line.includes('- Cost Centre:'));
      const businessAreaMatch = lines.find(line => line.includes('- Business Area:'));
      const subcategoryMatch = lines.find(line => line.includes('- Subcategory:'));
      const workTypeMatch = lines.find(line => line.includes('- Work Type:'));
      const enjoymentMatch = lines.find(line => line.includes('- Enjoyment:'));
      const energyMatch = lines.find(line => line.includes('- Energy Impact:'));
      const goalMatch = lines.find(line => line.includes('- Goal:'));

      if (taskMatch && durationMatch) {
        const durationText = durationMatch.split(':')[1]?.trim() || '';
        const durationMinutes = parseInt(durationText.match(/\d+/)?.[0] || '0');
        
        timeEntry = {
          task_description: taskMatch.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          duration_minutes: durationMinutes,
          start_time: new Date().toISOString(),
          work_type: workTypeMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || 'non_billable',
          matter_name: matterMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          cost_centre_name: costCentreMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          business_area_name: businessAreaMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          subcategory_name: subcategoryMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          enjoyment_level: enjoymentMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          energy_impact: energyMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || '',
          task_goal: goalMatch?.split(':')[1]?.trim()?.replace(/^\[|\]$/g, '') || ''
        };
      }
    }

    return new Response(
      JSON.stringify({ 
        response: assistantResponse,
        timeEntry: timeEntry
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in chat-completion function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
