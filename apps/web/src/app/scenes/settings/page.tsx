import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';

export default function SettingsScene(): ReactElement {
  return (
    <div className="app">
      <TopBar context="Settings" right="esc" />
      <div className="settings-body">
        <div className="settings-col">
          <div className="settings-head">
            <div className="settings-title">Settings</div>
            <div className="settings-subtitle">
              The product adjusts around you. Everything here is optional.
            </div>
          </div>

          <section className="settings-section">
            <div className="settings-section-label">PROFILE</div>
            <div className="settings-row">
              <span className="settings-row-label">Name</span>
              <span className="settings-row-value">Anna</span>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">Timezone</span>
              <span className="settings-row-value">UTC+8 · Shanghai</span>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-label">WHAT I REMEMBER</div>
            <div className="settings-section-sub">
              You can delete anything here. Deletions may soften the continuity of our conversation.
            </div>
            <div className="mem-card">
              <div className="mem-row">
                <div className="mem-row-text">
                  <div className="mem-row-title">Side project MVP</div>
                  <div className="mem-row-meta">APR 10 · SESSION DIGEST</div>
                </div>
                <div className="mem-row-x">×</div>
              </div>
              <div className="mem-row">
                <div className="mem-row-text">
                  <div className="mem-row-title">Daily writing rhythm</div>
                  <div className="mem-row-meta">APR 09 · HABIT TREND</div>
                </div>
                <div className="mem-row-x">×</div>
              </div>
              <div className="mem-row">
                <div className="mem-row-text">
                  <div className="mem-row-title">Avoiding scope creep</div>
                  <div className="mem-row-meta">APR 07 · LESSON</div>
                </div>
                <div className="mem-row-x">×</div>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-label">APPEARANCE</div>
            <div className="settings-row">
              <span className="settings-row-label">Theme</span>
              <span className="settings-row-value">Dark</span>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">Sound</span>
              <div className="toggle" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
