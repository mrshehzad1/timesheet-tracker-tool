import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Send, Mic, MicOff, User, Bot, MessageSquare } from 'lucide-react';
import { OpenAIService } from '@/services/openai';

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
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  messages: Message[];
  chatHistory: ChatMessage[];
  timestamp: number;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const { config } = useConfig();
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const openaiServiceRef = useRef<OpenAIService>(new OpenAIService());

  const STORAGE_KEY = `chat_session_${user?.id || 'anonymous'}`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadChatSession();
  }, []);

  // Save chat session to localStorage whenever state changes
  useEffect(() => {
    if (messages.length > 0 || chatHistory.length > 0) {
      saveChatSession();
    }
  }, [messages, chatHistory]);

  const saveChatSession = () => {
    const session: ChatSession = {
      messages,
      chatHistory,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  };

  const loadChatSession = () => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY);
      if (savedSession) {
        const session: ChatSession = JSON.parse(savedSession);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = session.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
        setChatHistory(session.chatHistory);
        
        // If we have an existing session, don't initialize a new one
        if (session.messages.length > 0) {
          return;
        }
      }
    } catch (error) {
      console.error('Error loading chat session:', error);
    }
    
    // Initialize new chat if no session exists
    initializeChat();
  };

  const startNewChat = () => {
    // Clear current session
    setMessages([]);
    setChatHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    
    // Initialize new chat
    initializeChat();
    
    toast({
      title: "New Chat Started",
      description: "Your previous conversation has been cleared.",
    });
  };

  const initializeChat = async () => {
    const systemPrompt = openaiServiceRef.current.getSystemPrompt();
    const systemMessage: ChatMessage = {
      role: 'system',
      content: systemPrompt
    };

    const initialMessages = [systemMessage];
    setChatHistory(initialMessages);

    try {
      setIsLoading(true);
      const aiResponse = await openaiServiceRef.current.generateResponse([
        ...initialMessages,
        {
          role: 'user',
          content: 'Hello, I need to log my time.'
        }
      ]);

      addAIMessage(aiResponse);
      setChatHistory(prev => [...prev, 
        { role: 'user', content: 'Hello, I need to log my time.' },
        { role: 'assistant', content: aiResponse }
      ]);
    } catch (error) {
      console.error('Error initializing chat:', error);
      addAIMessage("Hello! I'm here to help you log your time. What task did you work on today?");
      toast({
        title: "Notice",
        description: "Using fallback mode. Some features may be limited.",
        variant: "default",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = (content: string, sender: 'user' | 'ai') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addAIMessage = (content: string) => {
    addMessage(content, 'ai');
  };

  const addUserMessage = (content: string) => {
    addMessage(content, 'user');
  };

  const extractTimeEntryFromChat = (): Partial<TimeEntry> | null => {
    try {
      // Look for the final confirmation message that contains structured data
      const chatContent = chatHistory.map(msg => msg.content).join('\n');
      
      // Extract task description
      const taskMatch = chatContent.match(/Task:\s*([^\n]+)/i);
      const taskDescription = taskMatch ? taskMatch[1].trim() : 'Task from chat';
      
      // Extract duration - look for various formats
      const durationMatches = [
        chatContent.match(/Duration:\s*(\d+)\s*hours?/i),
        chatContent.match(/Duration:\s*(\d+)\s*minutes?/i),
        chatContent.match(/Duration:\s*(\d+)h/i),
        chatContent.match(/(\d+)\s*hours?/i),
        chatContent.match(/(\d+)\s*minutes?/i)
      ];
      
      let durationMinutes = 30; // default
      for (const match of durationMatches) {
        if (match) {
          const value = parseInt(match[1]);
          if (match[0].toLowerCase().includes('hour')) {
            durationMinutes = value * 60;
          } else {
            durationMinutes = value;
          }
          break;
        }
      }
      
      // Extract work type
      let workType: 'billable' | 'non_billable' | 'personal' = 'billable';
      if (chatContent.toLowerCase().includes('non-billable') || chatContent.toLowerCase().includes('non billable')) {
        workType = 'non_billable';
      } else if (chatContent.toLowerCase().includes('personal')) {
        workType = 'personal';
      }
      
      // Extract matter/client for billable work
      let matterName = undefined;
      const matterMatch = chatContent.match(/(?:Matter|Client):\s*([^\n]+)/i);
      if (matterMatch && workType === 'billable') {
        matterName = matterMatch[1].trim();
      }
      
      // Extract cost centre for billable work
      let costCentreName = undefined;
      const costCentreMatch = chatContent.match(/Cost Centre:\s*([^\n]+)/i);
      if (costCentreMatch && workType === 'billable') {
        costCentreName = costCentreMatch[1].trim();
      }
      
      // Extract business area for non-billable work
      let businessAreaName = undefined;
      const businessAreaMatch = chatContent.match(/Business Area:\s*([^\n]+)/i);
      if (businessAreaMatch && workType === 'non_billable') {
        businessAreaName = businessAreaMatch[1].trim();
      }
      
      // Extract subcategory for non-billable work
      let subcategoryName = undefined;
      const subcategoryMatch = chatContent.match(/Subcategory:\s*([^\n]+)/i);
      if (subcategoryMatch && workType === 'non_billable') {
        subcategoryName = subcategoryMatch[1].trim();
      }
      
      // Extract enjoyment level
      let enjoymentLevel = undefined;
      const enjoymentPatterns = [
        /Enjoyment Level:\s*([^\n]+)/i,
        /(Love it|Like it|Hate it).*?(Great at it|Good at it|Bad at it)/i
      ];
      for (const pattern of enjoymentPatterns) {
        const match = chatContent.match(pattern);
        if (match) {
          enjoymentLevel = match[1].trim();
          break;
        }
      }
      
      // Extract energy impact
      let energyImpact = undefined;
      const energyPatterns = [
        /Energy Impact:\s*([^\n]+)/i,
        /(Energy Gain|Energy Drain|Energy Neutral)/i
      ];
      for (const pattern of energyPatterns) {
        const match = chatContent.match(pattern);
        if (match) {
          energyImpact = match[1].trim();
          break;
        }
      }
      
      // Extract task goal
      let taskGoal = undefined;
      const goalPatterns = [
        /Future Goal:\s*([^\n]+)/i,
        /(Delegate it to AI|Delegate it to another person|Transfer it to someone|Retain it)/i
      ];
      for (const pattern of goalPatterns) {
        const match = chatContent.match(pattern);
        if (match) {
          taskGoal = match[1].trim();
          break;
        }
      }
      
      console.log('Extracted time entry data:', {
        taskDescription,
        durationMinutes,
        workType,
        matterName,
        costCentreName,
        businessAreaName,
        subcategoryName,
        enjoymentLevel,
        energyImpact,
        taskGoal
      });
      
      return {
        taskDescription,
        durationMinutes,
        startTime: new Date().toISOString(),
        workType,
        matterName,
        costCentreName,
        businessAreaName,
        subcategoryName,
        enjoymentLevel,
        energyImpact,
        taskGoal
      };
    } catch (error) {
      console.error('Error extracting time entry data:', error);
      return null;
    }
  };

  const processUserInput = async (input: string) => {
    addUserMessage(input);
    setIsLoading(true);

    try {
      const userMessage: ChatMessage = { role: 'user', content: input };
      const newChatHistory = [...chatHistory, userMessage];
      
      const aiResponse = await openaiServiceRef.current.generateResponse(newChatHistory);
      
      addAIMessage(aiResponse);
      setChatHistory([...newChatHistory, { role: 'assistant', content: aiResponse }]);

      // Check if the response indicates completion and extract time entry data
      const completionKeywords = [
        'save this to your timesheet',
        'updating your timesheet',
        'time entry has been saved',
        'save to timesheet',
        'log this entry'
      ];
      
      const shouldSave = completionKeywords.some(keyword => 
        aiResponse.toLowerCase().includes(keyword.toLowerCase())
      );

      if (shouldSave) {
        console.log('Detected completion signal, attempting to save time entry');
        handleTimeEntryCompletion();
      }
    } catch (error) {
      console.error('Error processing user input:', error);
      addAIMessage("I'm sorry, I encountered an error. Please try again.");
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeEntryCompletion = async () => {
    console.log('Starting time entry completion process');
    
    // Extract time entry data from chat history
    const timeEntry = extractTimeEntryFromChat();
    
    if (!timeEntry) {
      console.error('Failed to extract time entry data from chat');
      toast({
        title: "Error",
        description: "Failed to extract time entry data. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const webhookPayload = {
        user_id: user?.id,
        user_name: user?.name || user?.email,
        user_email: user?.email,
        timestamp: new Date().toISOString(),
        time_entry: timeEntry
      };

      console.log('Webhook payload:', webhookPayload);

      if (config.webhook.isEnabled && config.webhook.url) {
        console.log('Sending webhook to:', config.webhook.url);
        
        const response = await fetch(config.webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.webhook.apiKey && { 'Authorization': `Bearer ${config.webhook.apiKey}` })
          },
          body: JSON.stringify(webhookPayload)
        });

        console.log('Webhook response status:', response.status);
        console.log('Webhook response headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const responseText = await response.text();
          console.log('Webhook response body:', responseText);
          
          toast({
            title: "Time Entry Saved",
            description: "Your time has been logged successfully!",
          });
        } else {
          const errorText = await response.text();
          console.error('Webhook error response:', errorText);
          throw new Error(`Webhook failed with status ${response.status}: ${errorText}`);
        }
      } else {
        console.log('Webhook not configured or disabled');
        toast({
          title: "Webhook Not Configured",
          description: "Time entry extracted but webhook is not configured in settings.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error saving time entry:', error);
      toast({
        title: "Error",
        description: `Failed to save time entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      {/* Header with New Chat button */}
      <div className="p-4 bg-white border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Time Tracking Assistant</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={startNewChat}
          className="flex items-center space-x-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.sender === 'user' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                {message.sender === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <Card className={`p-3 ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </Card>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3 max-w-xs lg:max-w-md">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-600">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <Card className="p-3 bg-white">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </Card>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your response..."
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVoiceInput}
            className={isListening ? 'bg-red-100 border-red-300' : ''}
            disabled={isLoading}
          >
            {isListening ? <MicOff className="h-4 w-4 text-red-600" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
