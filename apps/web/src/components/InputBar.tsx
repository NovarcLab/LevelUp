'use client';

import { useState, type ReactElement } from 'react';

interface InputBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  onSubmit?: (v: string) => void;
  disabled?: boolean;
  showCursor?: boolean;
}

export default function InputBar({
  placeholder = 'Tell me what you moved today…',
  value,
  onChange,
  onSubmit,
  disabled,
  showCursor = false,
}: InputBarProps): ReactElement {
  const [internal, setInternal] = useState('');
  const [focused, setFocused] = useState(false);
  const current = value ?? internal;
  const active = focused || current.length > 0;

  return (
    <div className="input-row">
      <div className={`input-inner ${active ? 'focus' : ''}`}>
        <span className={`input-caret ${active ? 'active' : ''}`}>›</span>
        <input
          className="input-field"
          placeholder={placeholder}
          value={current}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            if (onChange) onChange(e.target.value);
            else setInternal(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              onSubmit(current);
              if (!value) setInternal('');
            }
          }}
        />
        {showCursor && <div className="input-cursor" />}
        <span className="input-kbd-hint">⌘↵</span>
      </div>
    </div>
  );
}
