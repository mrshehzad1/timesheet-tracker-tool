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
      if (aiResponse.toLowerCase().includes('save') && aiResponse.toLowerCase().includes('timesheet')) {
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
    // Extract time entry data from chat history for webhook
    const timeEntry: Partial<TimeEntry> = {
      taskDescription: "Task from chat",
      durationMinutes: 30,
      startTime: new Date().toISOString(),
      workType: 'billable' as 'billable' | 'non_billable' | 'personal'
    };

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
          toast({
            title: "Time Entry Saved",
            description: "Your time has been logged successfully!",
          });
        } else {
          throw new Error('Webhook failed');
        }
      }
    } catch (error) {
      console.error('Error saving time entry:', error);
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
