import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useConfig } from '@/contexts/ConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface TimeEntry {
  task_description: string;
  duration_minutes: number;
  start_time: string;
  work_type: 'billable' | 'non_billable' | 'personal';
  matter_name: string;
  cost_centre_name: string;
  business_area_name: string;
  subcategory_name: string;
  enjoyment_level: string;
  energy_impact: string;
  task_goal: string;
}

export function ChatInterface() {
  const { toast } = useToast();
  const { config } = useConfig();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Hi there! 👋 I'm your AI time tracking assistant. I'm here to help you log your work activities in a quick and natural way.

What did you work on today? Just tell me about any task, and I'll help you categorize it properly!`,
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendWebhook = async (timeEntry: TimeEntry) => {
    try {
      // Fetch webhook configuration
      const { data: webhookConfig, error } = await supabase
        .from('webhook_config')
        .select('*')
        .eq('is_enabled', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching webhook config:', error);
        return;
      }

      if (!webhookConfig || !webhookConfig.url) {
        console.log('No webhook configured');
        return;
      }

      const webhookPayload = {
        user_id: user?.id,
        user_name: user?.name,
        user_email: user?.email,
        timestamp: new Date().toISOString(),
        time_entry: timeEntry
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

      if (response.ok) {
        console.log('Webhook sent successfully');
        toast({
          title: "Data Sent",
          description: "Time entry data has been sent to your configured webhook.",
        });
      } else {
        console.error('Webhook failed:', response.status, response.statusText);
        toast({
          title: "Webhook Error",
          description: "Failed to send data to webhook endpoint.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending webhook:', error);
      toast({
        title: "Webhook Error",
        description: "Failed to send data to webhook endpoint.",
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          message: inputValue,
          context: {
            matters: config.matters,
            costCentres: config.costCentres,
            businessAreas: config.businessAreas,
            subcategories: config.subcategories,
            user: user
          }
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Check if the response contains time entry data and send webhook
      if (data.timeEntry) {
        console.log('Time entry detected:', data.timeEntry);
        await sendWebhook(data.timeEntry);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await processAudioInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    setIsLoading(true);
    
    try {
      // Convert audio to text using speech recognition API or send to backend
      // For now, we'll show a placeholder message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: "Voice message received (processing...)",
        sender: 'user',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);
      
      toast({
        title: "Voice Processing",
        description: "Voice message received. Text processing is not yet implemented.",
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process voice input.",
        variant: "destructive"
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
    <Card className="w-full max-w-4xl mx-auto h-[600px] flex flex-col">
      <CardContent className="flex-1 flex flex-col p-4">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`flex items-start space-x-2 max-w-[80%] ${
                    message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.sender === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {message.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <p className="text-sm text-gray-900">Thinking...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        <div className="flex items-center space-x-2 mt-4">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Tell me about your work activities..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
