'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import InputBar from '@/components/InputBar';
import InlineCard from '@/components/InlineCard';
import Halo from '@/components/Halo';
import { MOCK_GOALS } from '@/lib/mock';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  card?: { title: string; percent: number; current: string; next: string } | null;
}

export default function Home(): ReactElement {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const streamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setLoggedIn(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: 999999, behavior: 'smooth' });
  }, [messages, pending]);

  async function handleLogin(): Promise<void> {
    const target = email.trim() || 'you@example.com';
    const res = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: target }),
    });
    if (res.ok) setLoggedIn(true);
  }

  async function ensureConversation(): Promise<string> {
    if (convId) return convId;
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: '{}',
    });
    const data = (await res.json()) as { id: string };
    setConvId(data.id);
    return data.id;
  }

  async function handleSend(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);

    const id = await ensureConversation();
    const userMsgId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: userMsgId, role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    const res = await fetch(`/api/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: trimmed }),
    });

    if (!res.body) {
      setPending(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const block of events) {
        const lines = block.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLine = lines.find((l) => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;
        const eventName = eventLine.slice('event:'.length).trim();
        const data = JSON.parse(dataLine.slice('data:'.length).trim());
        if (eventName === 'token') {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + data.delta }
                : msg,
            ),
          );
        } else if (eventName === 'replace') {
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, content: '' } : msg)),
          );
        } else if (eventName === 'card' && data.type === 'progress') {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    card: {
                      title: data.title,
                      percent: data.percent,
                      current: data.nextStep ?? '—',
                      next: '—',
                    },
                  }
                : msg,
            ),
          );
        } else if (eventName === 'done' || eventName === 'error') {
          setPending(false);
        }
      }
    }
  }

  if (!loggedIn) {
    return (
      <div className="app">
        <TopBar right="none" />
        <div className="body-center">
          <Halo size={1000} opacity={0.5} />
          <div className="login-stack">
            <div className="login-q">What should I call you?</div>
            <div className="login-input-wrap">
              <input
                className="login-input"
                placeholder=""
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                type="email"
              />
              <div className="login-input-line" />
            </div>
            <div className="login-hint">↵</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar context="Side Project MVP" />
      <div className="body">
        <Sidebar collapsed={false} goals={MOCK_GOALS} />
        <main className="main">
          <div className="msg-area" ref={streamRef}>
            <div className="msg-col">
              {messages.length === 0 && (
                <div className="msg-ai" style={{ color: 'var(--fg-1)' }}>
                  Start talking. I&apos;ll remember what you say.
                </div>
              )}
              {messages.map((m) => {
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="msg-user">
                      <div className="msg-user-text">{m.content}</div>
                      <div className="msg-user-line" />
                    </div>
                  );
                }
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {m.content && <div className="msg-ai">{m.content}</div>}
                    {m.card && (
                      <InlineCard
                        title={m.card.title}
                        percent={m.card.percent}
                        current={m.card.current}
                        next={m.card.next}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <InputBar
            placeholder="Tell me what you moved today…"
            onSubmit={handleSend}
            disabled={pending}
          />
        </main>
      </div>
    </div>
  );
}
