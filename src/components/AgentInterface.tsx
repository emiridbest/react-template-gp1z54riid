import React, { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, Square, Play, PauseIcon, BookOpen } from 'lucide-react';
import { ChatOpenAI } from '@langchain/openai';
import { createChatModel } from '../pages/api/hyper-agent';
import ReactMarkdown from "react-markdown";
type MessageType = 'user' | 'agent' | 'error';
type ChatMessage = {
  type: MessageType;
  content: string;
};
type AgentData = {
  agent: any;
  config: any;
};

const AgentInterface = () => {
  const [mode, setMode] = useState<'chat' | 'auto' | 'learn' | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrls, setAudioUrls] = useState<{ [key: number]: string }>({});
  const [isPlaying, setIsPlaying] = useState<{ [key: number]: boolean }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const hyperRef = useRef<ChatOpenAI | null>(null);

  const generateAudio = async (text: string, messageIndex: number) => {
    try {
      const response = await fetch('https://api.hyperbolic.xyz/v1/audio/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_HYPERBOLIC_API_KEY}`,
        },
        body: JSON.stringify({
          text: text,
          speed: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setAudioUrls(prev => ({ ...prev, [messageIndex]: data.audio_url }));
    } catch (error) {
      console.error('Error generating audio:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

        // Send audio to Hyperbolic for transcription
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await fetch('https://api.hyperbolic.xyz/v1/audio/transcription', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.HYPERBOLIC_API_KEY}`,
            },
            body: formData
          });

          if (!response.ok) throw new Error('Transcription failed');

          const data = await response.json();
          setInput(data.text);
          handleSendMessage(data.text); // Use transcribed text as prompt
        } catch (error) {
          console.error('Transcription error:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };



  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleAudioPlayback = (messageIndex: number) => {
    const audio = new Audio(audioUrls[messageIndex]);

    if (isPlaying[messageIndex]) {
      audio.pause();
      setIsPlaying(prev => ({ ...prev, [messageIndex]: false }));
    } else {
      audio.play();
      setIsPlaying(prev => ({ ...prev, [messageIndex]: true }));

      audio.onended = () => {
        setIsPlaying(prev => ({ ...prev, [messageIndex]: false }));
      };
    }
  };



  useEffect(() => {
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    if (lastMessage?.type === 'agent') {
      generateAudio(lastMessage.content, lastIndex);
    }
  }, [messages]);

  const initializeAgent = async (): Promise<AgentData> => {
    try {
      const response = await fetch('/api/init-agent', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to initialize agent');
      }

      return await response.json();
    } catch (error) {
      console.error('Error initializing agent:', error);
      throw error;
    }
  };
  
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        if (!hyperRef.current) {
          hyperRef.current = createChatModel();
        }
      } catch (error) {
        console.error('Failed to initialize chat model:', error);
        setMessages(prev => [...prev, {
          type: 'error',
          content: 'Failed to initialize chat. Please check configuration.'
        }]);
      }
    };

    initializeChat();
    return () => { mounted = false; };
  }, []);

  const handleLearnMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { type: 'user', content: input }]);

    try {
      const response = await hyperRef.current?.call([
        {
          role: 'system',
          content: 'You are a knowledgeable guide specializing in Web3, blockchain technology, and investment strategies. Provide clear, accurate, and beginner-friendly explanations.'
        },
        {
          role: 'user',
          content: input
        }
      ]);

      if (response) {
        setMessages(prev => [...prev, {
          type: 'agent',
          content: String(response.content)
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };
  const handleSendMessage = async (prompt?: string) => {
    if (mode === 'learn') {
      await handleLearnMessage();
    } else {
    const message = prompt || input;
    if (!message.trim()) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { type: 'user', content: message }]);

    try {
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const newMessageIndex = messages.length;
      setMessages(prev => [...prev, {
        type: 'agent',
        content: data.response
      }]);
      generateAudio(data.response, newMessageIndex); // Convert response to audio
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  }
};

  const handleModeSelect = async (selectedMode: 'chat' | 'auto' | 'learn') => {
    setMode(selectedMode);
    setMessages([]); // Clear messages when switching modes
    
    if (selectedMode === 'learn') {
      setMessages([{
        type: 'agent',
        content: "Welcome to the learning mode! I'm here to help you understand Web3, blockchain technology, and investment strategies. What would you like to learn about?"
      }]);
    } else if (selectedMode === 'auto') {
      const agentData = await initializeAgent();
      startAutonomousMode(agentData.agent, agentData.config);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };



  const startAutonomousMode = async (agent: any, config: any) => {
    setIsLoading(true);

    while (mode === 'auto') {
      try {
        const response = await fetch('/api/agent-auto', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to run autonomous mode');
        }

        const data = await response.json();

        setMessages(prev => [...prev, {
          type: 'agent',
          content: data.response
        }]);

        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        setMessages(prev => [...prev, {
          type: 'error',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]);
        setMode(null);
        break;
      }
    }

    setIsLoading(false);
  };

  if (!mode) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Choose Agent Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full flex items-center justify-center space-x-2"
            onClick={() => handleModeSelect('chat')}
          >
            <span className="text-lg">💬</span>
            <span>Chat Mode</span>
          </Button>
          <Button
            className="w-full flex items-center justify-center space-x-2"
            onClick={() => handleModeSelect('auto')}
          >
            <span className="text-lg">🤖</span>
            <span>Autonomous Mode</span>
          </Button>
          <Button
            className="w-full flex items-center justify-center space-x-2"
            onClick={() => handleModeSelect('learn')}
          >
            <BookOpen className="mr-2" size={20} />
            <span>Learn Web3 and Investing</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span className="text-lg">
            {mode === 'chat' ? '💬' : mode === 'learn' ? '📚' : '🤖'}
          </span>
          <span>
            {mode === 'chat' 
              ? 'Chat Mode' 
              : mode === 'learn' 
                ? 'Learning Mode' 
                : 'Autonomous Mode'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-96 overflow-y-auto space-y-4 p-4 border rounded-lg">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-100 ml-auto max-w-[80%]'
                  : message.type === 'error'
                    ? 'bg-red-100'
                    : 'bg-gray-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <ReactMarkdown className="flex-grow">
                  {message.content}
                </ReactMarkdown>
                {message.type === 'agent' && audioUrls[index] && (
                  <Button
                    onClick={() => toggleAudioPlayback(index)}
                    className="ml-2"
                  >
                    {isPlaying[index] ? <PauseIcon size={16} /> : <Play size={16} />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {(mode === 'chat' || mode === 'learn') && (
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'learn' ? "Ask about Web3 or investing..." : "Type your message..."}
              onKeyPress={handleKeyPress}
              disabled={isLoading || isRecording}
              className="flex-1"
            />
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className="w-12"
            >
              {isRecording ? <Square size={16} /> : <Mic size={16} />}
            </Button>
            <Button 
              onClick={() => handleSendMessage()}
              disabled={isLoading || isRecording}
            >
              Send
            </Button>
          </div>
        )}

        {mode === 'auto' && (
          <Button 
            onClick={() => setMode(null)} 
            className="w-full"
            disabled={isLoading}
          >
            Stop Autonomous Mode
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentInterface;