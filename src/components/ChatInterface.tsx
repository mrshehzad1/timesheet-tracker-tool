
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Send, Mic, MicOff, User, Bot } from 'lucide-react';

export interface TimeEntry {
  taskDescription: string;
  durationMinutes: number;
  startTime: string;
  workType: 'billable' | 'non_billable' | 'personal';
  matterName?: string;
  costCentreName?: string;
  businessAreaName?: string;
  subcategoryName?: string;
  enjoymentLevel?: string;
  energyImpact?: string;
  taskGoal?: string;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  options?: string[];
  type?: 'text' | 'select' | 'confirmation';
}

interface ConversationState {
  step: 'greeting' | 'task' | 'time' | 'workType' | 'matter' | 'costCentre' | 'businessArea' | 'subcategory' | 'enjoyment' | 'energy' | 'goal' | 'confirmation' | 'complete';
  timeEntry: Partial<TimeEntry>;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({
    step: 'greeting',
    timeEntry: {}
  });
  const { config } = useConfig();
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Initialize with greeting
    addAIMessage("Hi! I'm here to help you log your time. Let me ask you a few questions to update your timesheet. What task did you work on?");
  }, []);

  const addMessage = (content: string, sender: 'user' | 'ai', options?: string[], type?: 'text' | 'select' | 'confirmation') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender,
      timestamp: new Date(),
      options,
      type
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addAIMessage = (content: string, options?: string[], type?: 'text' | 'select' | 'confirmation') => {
    addMessage(content, 'ai', options, type);
  };

  const addUserMessage = (content: string) => {
    addMessage(content, 'user');
  };

  const processUserInput = (input: string) => {
    addUserMessage(input);
    handleConversationFlow(input);
  };

  const handleConversationFlow = (userInput: string) => {
    const { step, timeEntry } = conversationState;

    switch (step) {
      case 'greeting':
        setConversationState({
          step: 'task',
          timeEntry: { ...timeEntry, taskDescription: userInput }
        });
        addAIMessage("Great! How long did you spend on this task? You can tell me in hours/minutes or give me start and end times.");
        break;

      case 'task':
        setConversationState({
          step: 'time',
          timeEntry: { ...timeEntry, taskDescription: userInput }
        });
        addAIMessage("Perfect! How long did you spend on this task? You can tell me in hours/minutes or give me start and end times.");
        break;

      case 'time':
        const duration = parseTimeInput(userInput);
        setConversationState({
          step: 'workType',
          timeEntry: { 
            ...timeEntry, 
            durationMinutes: duration,
            startTime: new Date().toISOString()
          }
        });
        addAIMessage(
          "Thanks! Was this billable work, non-billable work, or personal time?",
          ['Billable', 'Non-billable', 'Personal'],
          'select'
        );
        break;

      case 'workType':
        const workType = userInput.toLowerCase().includes('billable') ? 'billable' : 
                         userInput.toLowerCase().includes('non-billable') ? 'non_billable' : 'personal';
        
        const newTimeEntry = { ...timeEntry, workType };
        setConversationState({
          step: workType === 'billable' ? 'matter' : workType === 'non_billable' ? 'businessArea' : 'enjoyment',
          timeEntry: newTimeEntry
        });

        if (workType === 'billable') {
          addAIMessage(
            "Which matter/client is this for?",
            config.matters,
            'select'
          );
        } else if (workType === 'non_billable') {
          addAIMessage(
            "Which business area does this fall under?",
            config.businessAreas,
            'select'
          );
        } else {
          addAIMessage(
            "How do you feel about this task?",
            ['Love it/Great at it', 'Like it/Good at it', 'Hate it/Good at it', 'Hate it/Bad at it'],
            'select'
          );
        }
        break;

      case 'matter':
        setConversationState({
          step: 'costCentre',
          timeEntry: { ...timeEntry, matterName: userInput }
        });
        addAIMessage(
          "What cost centre should this be assigned to?",
          config.costCentres,
          'select'
        );
        break;

      case 'costCentre':
        setConversationState({
          step: 'enjoyment',
          timeEntry: { ...timeEntry, costCentreName: userInput }
        });
        addAIMessage(
          "How do you feel about this task?",
          ['Love it/Great at it', 'Like it/Good at it', 'Hate it/Good at it', 'Hate it/Bad at it'],
          'select'
        );
        break;

      case 'businessArea':
        setConversationState({
          step: 'subcategory',
          timeEntry: { ...timeEntry, businessAreaName: userInput }
        });
        addAIMessage(
          "What subcategory best describes this work?",
          config.subcategories,
          'select'
        );
        break;

      case 'subcategory':
        setConversationState({
          step: 'enjoyment',
          timeEntry: { ...timeEntry, subcategoryName: userInput }
        });
        addAIMessage(
          "How do you feel about this task?",
          ['Love it/Great at it', 'Like it/Good at it', 'Hate it/Good at it', 'Hate it/Bad at it'],
          'select'
        );
        break;

      case 'enjoyment':
        setConversationState({
          step: 'energy',
          timeEntry: { ...timeEntry, enjoymentLevel: userInput }
        });
        addAIMessage(
          "Did this task give you energy, drain energy, or feel neutral?",
          ['Gave me energy', 'Drained energy', 'Neutral'],
          'select'
        );
        break;

      case 'energy':
        setConversationState({
          step: 'goal',
          timeEntry: { ...timeEntry, energyImpact: userInput }
        });
        addAIMessage(
          "What would you like to do with this type of task in the future?",
          ['Delegate to AI', 'Delegate to person', 'Transfer to someone', 'Keep doing it'],
          'select'
        );
        break;

      case 'goal':
        const finalTimeEntry = { ...timeEntry, taskGoal: userInput };
        setConversationState({
          step: 'confirmation',
          timeEntry: finalTimeEntry
        });
        
        const summary = generateSummary(finalTimeEntry as TimeEntry);
        addAIMessage(
          `Here's a summary of your time entry:\n\n${summary}\n\nDoes this look correct? Should I save this to your timesheet?`,
          ['Yes, save it', 'No, let me start over'],
          'confirmation'
        );
        break;

      case 'confirmation':
        if (userInput.toLowerCase().includes('yes')) {
          handleSaveTimeEntry(conversationState.timeEntry as TimeEntry);
        } else {
          setConversationState({ step: 'greeting', timeEntry: {} });
          addAIMessage("No problem! Let's start over. What task did you work on?");
        }
        break;
    }
  };

  const parseTimeInput = (input: string): number => {
    // Simple time parsing - could be enhanced with NLP
    const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*h/i);
    const minuteMatch = input.match(/(\d+)\s*m/i);
    
    let totalMinutes = 0;
    if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;
    if (minuteMatch) totalMinutes += parseInt(minuteMatch[1]);
    
    // Default to 30 minutes if parsing fails
    return totalMinutes || 30;
  };

  const generateSummary = (timeEntry: TimeEntry): string => {
    const duration = `${Math.floor(timeEntry.durationMinutes / 60)}h ${timeEntry.durationMinutes % 60}m`;
    let summary = `• Task: ${timeEntry.taskDescription}\n• Duration: ${duration}\n• Work Type: ${timeEntry.workType}`;
    
    if (timeEntry.matterName) summary += `\n• Matter: ${timeEntry.matterName}`;
    if (timeEntry.costCentreName) summary += `\n• Cost Centre: ${timeEntry.costCentreName}`;
    if (timeEntry.businessAreaName) summary += `\n• Business Area: ${timeEntry.businessAreaName}`;
    if (timeEntry.subcategoryName) summary += `\n• Subcategory: ${timeEntry.subcategoryName}`;
    if (timeEntry.enjoymentLevel) summary += `\n• Enjoyment: ${timeEntry.enjoymentLevel}`;
    if (timeEntry.energyImpact) summary += `\n• Energy Impact: ${timeEntry.energyImpact}`;
    if (timeEntry.taskGoal) summary += `\n• Future Goal: ${timeEntry.taskGoal}`;
    
    return summary;
  };

  const handleSaveTimeEntry = async (timeEntry: TimeEntry) => {
    try {
      const webhookPayload = {
        user_id: user?.id,
        user_name: user?.name,
        user_email: user?.email,
        timestamp: new Date().toISOString(),
        time_entry: timeEntry
      };

      if (config.webhook.isEnabled && config.webhook.url) {
        const response = await fetch(config.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.webhook.apiKey}`
          },
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
          addAIMessage("Perfect! I've successfully sent your time entry for processing. Your timesheet will be updated shortly. Is there anything else you'd like to log?");
        } else {
          throw new Error('Webhook failed');
        }
      } else {
        // Simulate success for demo
        addAIMessage("Great! I've saved your time entry. Your timesheet will be updated shortly. Is there anything else you'd like to log?");
      }

      setConversationState({ step: 'greeting', timeEntry: {} });
      
      toast({
        title: "Time Entry Saved",
        description: "Your time has been logged successfully!",
      });
    } catch (error) {
      addAIMessage("I'm sorry, there was an issue saving your time entry. Please try again or contact your administrator.");
      toast({
        title: "Error",
        description: "Failed to save time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      processUserInput(inputValue.trim());
      setInputValue('');
    }
  };

  const handleOptionSelect = (option: string) => {
    processUserInput(option);
  };

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Voice input not supported",
        description: "Your browser doesn't support voice input.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Voice input error",
          description: "There was an error with voice input. Please try again.",
          variant: "destructive",
        });
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.sender === 'user' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                {message.sender === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <Card className={`p-3 ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                <p className="text-sm whitespace-pre-line">{message.content}</p>
                {message.options && (
                  <div className="mt-3 space-y-2">
                    {message.options.map((option, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full text-left justify-start"
                        onClick={() => handleOptionSelect(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your response..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVoiceInput}
            className={isListening ? 'bg-red-100 border-red-300' : ''}
          >
            {isListening ? <MicOff className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSend} disabled={!inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
