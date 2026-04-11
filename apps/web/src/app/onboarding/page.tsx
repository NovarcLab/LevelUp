'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import Halo from '@/components/Halo';
import WordStream from '@/components/WordStream';

type Scene = 1 | 2 | 3 | 4;

export default function OnboardingPage(): ReactElement {
  const [scene, setScene] = useState<Scene>(1);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    return undefined;
  }, [scene]);

  const sceneLabel =
    scene === 1
      ? '01 / SILENCE'
      : scene === 2
        ? '02 / LIGHT'
        : scene === 3
          ? '03 / FIRST QUESTION'
          : '04 / IDENTIFICATION';

  const sceneFooter =
    scene === 1
      ? 'LEVELUP · THE FIRST 60 SECONDS ARE A THEATER'
      : scene === 2
        ? 'AMBIENT HALO · ACCENT DOT · 4 × 4 PX'
        : scene === 3
          ? 'NO PLACEHOLDER · NO BUTTON · RETURN TO SUBMIT'
          : 'WORD STREAM · NO CURSOR · NO AVATAR';

  return (
    <div className="scene">
      <div className="scene-label">{sceneLabel}</div>
      <div className="scene-footer">{sceneFooter}</div>

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
            <div
              className="scene-mini-dot"
              style={{ background: 'var(--accent)' }}
            />
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
              <div className="scene-line accent">
                <WordStream
                  text="What's the one thing you're trying to move forward right now?"
                  startDelay={4200}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
