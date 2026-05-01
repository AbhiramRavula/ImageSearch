import React from 'react';
import { applyTheme, saveTheme, type Theme } from '../../shared/theme';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function SettingsPanel({ isOpen, onClose, theme, onThemeChange }: SettingsPanelProps) {
  if (!isOpen) return null;

  const handleTheme = (t: Theme) => {
    onThemeChange(t);
    saveTheme(t);
    applyTheme(t);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">⚙️ Settings</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* Theme */}
          <div className="settings-group">
            <div className="settings-group-label">Appearance</div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Theme</div>
                <div className="settings-row-desc">Choose light, dark, or follow your system</div>
              </div>
              <div className="theme-toggle">
                <button
                  className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleTheme('light')}
                >
                  ☀️ Light
                </button>
                <button
                  className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => handleTheme('system')}
                >
                  🖥️ System
                </button>
                <button
                  className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleTheme('dark')}
                >
                  🌙 Dark
                </button>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="settings-group">
            <div className="settings-group-label">About</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <p><strong>Image Similarity Search v1.0.0</strong></p>
              <p style={{ marginTop: '8px' }}>
                AI-powered reverse image search using TensorFlow.js MobileNet embeddings.
                All processing happens locally in your browser — no images are uploaded to external servers.
              </p>
              <p style={{ marginTop: '8px' }}>
                <strong>Privacy:</strong> Your images and embeddings are stored locally in IndexedDB.
                Google Drive integration only accesses files you explicitly select via Google Picker.
              </p>
            </div>
          </div>

          {/* Google Drive Setup */}
          <div className="settings-group">
            <div className="settings-group-label">Google Drive Setup</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <p>To enable Google Drive integration:</p>
              <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li>Create a project in Google Cloud Console</li>
                <li>Enable Drive API and Picker API</li>
                <li>Create an OAuth 2.0 Client ID (type: Chrome Extension)</li>
                <li>Add your extension ID to the allowed origins</li>
                <li>Update the client ID in the extension's constants</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
