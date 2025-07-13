
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Mic, MicOff, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export function ChatInterface() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(parsedMessages);
      } catch (error) {
        console.error('Error parsing saved messages:', error);
      }
    }
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({
          title: "Speech Recognition Error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [toast]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    localStorage.removeItem('chatMessages');
    toast({
      title: "New Chat Started",
      description: "Previous conversation has been cleared.",
    });
  };

  const extractTimeEntryData = (conversation: Message[]) => {
    const conversationText = conversation.map(msg => `${msg.sender}: ${msg.text}`).join('\n');
    
    console.log('Extracting data from conversation:', conversationText);
    
    // Enhanced extraction logic with multiple patterns
    const extractors = {
      duration: [
        /(?:spent|took|worked for|duration.*?)\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/i,
        /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:on|working|spent)/i,
        /(\d+)\s*minutes?/i
      ],
      task: [
        /(?:worked on|task was|doing|completed)\s*[:\-]?\s*([^.!?\n]+)/i,
        /task[:\-]?\s*([^.!?\n]+)/i,
        /(?:I|we)\s+([^.!?\n]*(?:meeting|call|review|analysis|development|coding|design)[^.!?\n]*)/i
      ],
      workType: [
        /(?:this (?:was|is)|work (?:was|is))\s*(billable|non-billable|personal)/i,
        /(billable|non-billable|personal)\s*(?:work|task|time)/i
      ],
      matter: [
        /(?:matter|client|project)[:\-]?\s*([^.!?\n]+)/i,
        /(?:for|on)\s+([A-Z][^.!?\n]*(?:project|client|matter)[^.!?\n]*)/i
      ],
      enjoyment: [
        /(?:enjoyed|enjoyment|liked|loved|hated|disliked)[:\-]?\s*([^.!?\n]+)/i,
        /(?:it was|felt)\s*(great|good|okay|bad|terrible|amazing|awful)/i
      ],
      energy: [
        /(?:energy|tired|energized|drained|exhausted)[:\-]?\s*([^.!?\n]+)/i,
        /(?:felt|feeling)\s*(energized|tired|drained|exhausted|refreshed)/i
      ]
    };

    const extractedData: any = {};

    // Extract duration (convert to minutes if needed)
    for (const pattern of extractors.duration) {
      const match = conversationText.match(pattern);
      if (match) {
        let duration = parseFloat(match[1]);
        if (pattern.source.includes('hours')) {
          duration *= 60; // Convert hours to minutes
        }
        extractedData.duration_minutes = Math.round(duration);
        break;
      }
    }

    // Extract other fields
    Object.entries(extractors).forEach(([key, patterns]) => {
      if (key === 'duration') return; // Already handled above
      
      for (const pattern of patterns) {
        const match = conversationText.match(pattern);
        if (match && match[1]) {
          extractedData[key] = match[1].trim();
          break;
        }
      }
    });

    // Set defaults for missing data
    return {
      task_description: extractedData.task || 'General work',
      duration_minutes: extractedData.duration_minutes || 30,
      work_type: extractedData.workType || 'billable',
      matter_name: extractedData.matter || 'General',
      cost_centre_name: 'Development',
      business_area_name: 'Software Development',
      subcategory_name: 'General Work',
      enjoyment_level: extractedData.enjoyment || 'neutral',
      energy_impact: extractedData.energy || 'neutral',
      task_goal: 'Productivity'
    };
  };

  const sendWebhook = async (timeEntryData: any) => {
    try {
      console.log('Attempting to send webhook with data:', timeEntryData);
      
      // Fetch webhook configuration from database
      const { data: webhookConfig, error } = await supabase
        .from('webhook_config')
        .select('*')
        .eq('is_enabled', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching webhook config:', error);
        return;
      }

      if (!webhookConfig || !webhookConfig.url) {
        console.log('No active webhook configuration found');
        return;
      }

      console.log('Using webhook config:', { url: webhookConfig.url, enabled: webhookConfig.is_enabled });

      const webhookPayload = {
        user_id: user?.id || 'anonymous',
        user_name: user?.name || 'Anonymous User',
        user_email: user?.email || 'anonymous@example.com',
        timestamp: new Date().toISOString(),
        time_entry: {
          ...timeEntryData,
          start_time: new Date(Date.now() - (timeEntryData.duration_minutes * 60 * 1000)).toISOString()
        }
      };

      console.log('Sending webhook payload:', webhookPayload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (webhookConfig.api_key) {
        headers['Authorization'] = `Bearer ${webhookConfig.api_key}`;
      }

      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(webhookPayload)
      });

      console.log('Webhook response status:', response.status);
      
      if (response.ok) {
        console.log('Webhook sent successfully');
        toast({
          title: "Time Entry Recorded",
          description: "Your time entry has been sent to the external system.",
        });
      } else {
        console.error('Webhook failed with status:', response.status);
        const errorText = await response.text();
        console.error('Webhook error response:', errorText);
      }
    } catch (error) {
      console.error('Error sending webhook:', error);
    }
  };

  const detectTaskCompletion = (messages: Message[]) => {
    const lastFewMessages = messages.slice(-3);
    const conversationText = lastFewMessages.map(msg => msg.text.toLowerCase()).join(' ');
    
    const completionIndicators = [
      'that completes', 'finished', 'done', 'completed', 'wrapped up',
      'that concludes', 'end of session', 'logging this time', 'record this time',
      'save this entry', 'submit this', 'log the time', 'time entry complete'
    ];
    
    return completionIndicators.some(indicator => conversationText.includes(indicator));
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: { 
          message: inputValue,
          conversationHistory: newMessages.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        }
      });

      if (error) throw error;

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'I apologize, but I encountered an error processing your request.',
        sender: 'ai',
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);

      // Check if this looks like a task completion
      if (detectTaskCompletion(finalMessages)) {
        console.log('Task completion detected, extracting time entry data');
        const timeEntryData = extractTimeEntryData(finalMessages);
        console.log('Extracted time entry data:', timeEntryData);
        await sendWebhook(timeEntryData);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages([...newMessages, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">TimeTracker AI Assistant</h2>
          <p className="text-muted-foreground">
            Track your time by describing your work activities naturally
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={startNewChat}
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <h3 className="text-lg font-medium mb-2">Welcome to TimeTracker AI!</h3>
                <p>Start by describing what you've been working on today.</p>
                <p className="text-sm mt-2">
                  Example: "I spent 2 hours working on the client presentation for Project Alpha"
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
        
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your work activity..."
              disabled={isLoading}
              className="flex-1"
            />
            
            <Button
              onClick={isListening ? stopListening : startListening}
              variant="outline"
              size="icon"
              disabled={isLoading}
              className={isListening ? 'bg-red-100 hover:bg-red-200' : ''}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            
            <Button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
