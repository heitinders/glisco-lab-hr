'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Loader2, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamEvent {
  type: 'text' | 'tool_call' | 'done' | 'error';
  content?: string;
  tool?: string;
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  "Who's on leave today?",
  'Summarize headcount by department',
  'Draft a welcome email for a new hire',
  'Check leave balances for the Engineering team',
  'What are the NJ sick leave requirements?',
  'Show headcount breakdown by region',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || isStreaming) return;

    setInput('');
    const userMessage: ChatMessage = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setToolStatus(null);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event: StreamEvent = JSON.parse(jsonStr);

            if (event.type === 'text' && event.content) {
              assistantContent += event.content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { role: 'assistant', content: assistantContent },
                  ];
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
              setToolStatus(null);
            }

            if (event.type === 'tool_call' && event.tool) {
              const toolLabels: Record<string, string> = {
                lookup_employee: 'Looking up employee...',
                check_leave_balances: 'Checking leave balances...',
                get_whos_on_leave: 'Checking who is on leave...',
                get_headcount_summary: 'Getting headcount summary...',
                draft_email: 'Drafting email...',
              };
              setToolStatus(toolLabels[event.tool] || `Running ${event.tool}...`);
            }

            if (event.type === 'error') {
              assistantContent += `\n\nError: ${event.content || 'Something went wrong.'}`;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { role: 'assistant', content: assistantContent },
                  ];
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }

            if (event.type === 'done') {
              setToolStatus(null);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err?.message || 'Unknown error'}. Please try again.`,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setToolStatus(null);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-gradient-to-br from-[#4B9EFF] to-[#7C3AED] p-2">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-heading text-2xl text-foreground sm:text-3xl">
            AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask about employees, leave, headcount, policies, or draft communications
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/10 p-4">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              How can I help you today?
            </h2>
            <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
              I can look up employee information, check leave balances, summarize
              headcount data, answer policy questions, and draft HR communications.
            </p>
            <div className="grid max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="rounded-lg border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 rounded-full bg-gradient-to-br from-[#4B9EFF] to-[#7C3AED] p-1.5">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#4B9EFF] text-white'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 rounded-full bg-muted p-1.5">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Tool status indicator */}
            {toolStatus && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex-shrink-0 rounded-full bg-gradient-to-br from-[#4B9EFF] to-[#7C3AED] p-1.5">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {toolStatus}
                </div>
              </div>
            )}

            {/* Streaming indicator */}
            {isStreaming && !toolStatus && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex-shrink-0 rounded-full bg-gradient-to-br from-[#4B9EFF] to-[#7C3AED] p-1.5">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about employees, leave, headcount, policies..."
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4B9EFF]"
          disabled={isStreaming}
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isStreaming}
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
