'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Halo from '@/components/Halo';
import WordStream from '@/components/WordStream';

type Scene = 1 | 2 | 3 | 4 | 5;

/**
 * Onboarding 5-step flow (PRD §F2):
 * 1. Silence (theater)
 * 2. Light (halo appears)
 * 3. First question — "What should I call you?"
 * 4. AI introduces itself, asks for goal
 * 5. Goal creation via conversation (streamed from backend)
 */
export default function OnboardingPage(): ReactElement {
  const [scene, setScene] = useState<Scene>(1);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const goalRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (scene === 1) {
      const t = setTimeout(() => setScene(2), 1200);
      return () => clearTimeout(t);
    }
    if (scene === 2) {
      const t = setTimeout(() => setScene(3), 1800);
      return () => clearTimeout(t);
    }
    if (scene === 3) {
      inputRef.current?.focus();
    }
    if (scene === 5) {
      goalRef.current?.focus();
    }
    return undefined;
  }, [scene]);

  async function handleGoalSubmit(): Promise<void> {
    const trimmed = goal.trim();
    if (!trimmed || creating) return;
    setCreating(true);

    try {
      // Create goal via API
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: trimmed }),
      });

      if (res.ok) {
        // Create initial conversation with the goal context
        await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        router.push('/');
      }
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="scene">
      <div className="scene-label">
        {scene <= 2 ? `0${scene} / ${scene === 1 ? 'SILENCE' : 'LIGHT'}` :
         scene === 3 ? '03 / FIRST QUESTION' :
         scene === 4 ? '04 / IDENTIFICATION' : '05 / ANCHOR'}
      </div>

      {scene === 1 && (
        <div className="center-stack">
          <div
            className="scene-mini-dot"
            style={{ background: 'var(--fg-3)', opacity: 0.3 }}
          />
        </div>
      )}

      {scene === 2 && (
        <>
          <Halo size={1400} y="30%" opacity={0.8} />
          <Halo size={760} y="60%" soft opacity={0.45} />
          <div className="center-stack">
            <div className="scene-mini-dot" style={{ background: 'var(--accent)' }} />
          </div>
        </>
      )}

      {scene === 3 && (
        <>
          <Halo size={1000} y="40%" opacity={0.6} />
          <div className="center-stack">
            <div className="scene-question">What should I call you?</div>
            <div className="scene-input-row">
              <input
                ref={inputRef}
                className="scene-input-text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) setScene(4);
                }}
              />
              {name.length === 0 && <div className="scene-cursor" />}
              <div className="scene-input-line" />
            </div>
          </div>
          <div className="scene-hint">↵</div>
        </>
      )}

      {scene === 4 && (
        <>
          <Halo size={900} y="60%" opacity={0.45} />
          <div className="center-stack" style={{ alignItems: 'flex-start', paddingLeft: '25%' }}>
            <div className="scene-col">
              <div className="hello">
                <WordStream text={`Hello, ${name || 'friend'}.`} />
              </div>
              <div className="scene-sep" />
              <div className="scene-line">
                <WordStream
                  text="I'm here to walk one stretch of the road with you."
                  startDelay={400}
                />
              </div>
              <div className="scene-line dim">
                <WordStream
                  text="Before we start, I need to hear one thing."
                  startDelay={2400}
                />
              </div>
              <div className="scene-line accent" onClick={() => setScene(5)} style={{ cursor: 'pointer' }}>
                <WordStream
                  text="What's the one thing you're trying to move forward right now? ↵"
                  startDelay={4200}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {scene === 5 && (
        <>
          <Halo size={800} y="50%" opacity={0.5} />
          <div className="center-stack">
            <div className="scene-question" style={{ fontSize: 14, color: 'var(--fg-1)', marginBottom: 16 }}>
              {name ? `${name}, w` : 'W'}hat are you working toward?
            </div>
            <div className="scene-input-row" style={{ maxWidth: 480 }}>
              <input
                ref={goalRef}
                className="scene-input-text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleGoalSubmit();
                }}
                disabled={creating}
                style={{ fontSize: 18 }}
              />
              {goal.length === 0 && <div className="scene-cursor" />}
              <div className="scene-input-line" />
            </div>
            <div className="scene-hint" style={{ marginTop: 24 }}>
              {creating ? 'Creating...' : '↵'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
