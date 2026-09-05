import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  Cpu,
  User,
  Mail,
  MapPin,
  Moon,
  Sun,
  Palette,
  Sliders,
  Type,
  Clock,
  Thermometer,
  Shield,
  Download,
  Trash2,
  RotateCcw,
  Sparkles,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { UserSettings, ChatSession } from '../types';

interface SettingsPageProps {
  settings: UserSettings;
  chatSessions: ChatSession[];
  onSave: (newSettings: UserSettings) => void;
  onClose: () => void;
  onClearHistory: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  chatSessions,
  onSave,
  onClose,
  onClearHistory,
}) => {
  const [formData, setFormData] = useState<UserSettings>({
    theme: settings.theme || 'light',
    model: settings.model && !settings.model.includes('2.5') && !settings.model.includes('2.0') && !settings.model.includes('1.5') ? settings.model : 'gemini-3.7-flash',
    userName: settings.userName !== undefined ? settings.userName : 'Bryan',
    userEmail: settings.userEmail || '',
    defaultLocation: settings.defaultLocation || 'Liverpool, UK',
    postcode: settings.postcode || 'HU5 2EG',
    darkness: settings.darkness || 'espresso',
    accentColor: settings.accentColor || 'gold',
    fontSize: settings.fontSize || 'standard',
    temperature: settings.temperature ?? 0.7,
    aiTone: settings.aiTone || 'friendly',
    timeFormat: settings.timeFormat || '24h',
    tempUnits: settings.tempUnits || 'c',
    enableToolGrounding: settings.enableToolGrounding ?? true,
    enableSuggestions: settings.enableSuggestions ?? true,
  });

  const [savedToast, setSavedToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Check if form has unsaved modifications
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(settings);
  }, [formData, settings]);

  const handleFieldChange = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      // If theme changed, immediately apply preview attribute
      if (key === 'theme') {
        document.documentElement.setAttribute('data-theme', String(value));
        document.body.className = value === 'light' ? 'light-theme' : 'dark-theme';
        if (value === 'dark') {
          document.documentElement.setAttribute('data-darkness', updated.darkness || 'espresso');
          document.body.setAttribute('data-darkness', updated.darkness || 'espresso');
        } else {
          document.documentElement.removeAttribute('data-darkness');
          document.body.removeAttribute('data-darkness');
        }
      }
      // If darkness changed, immediately apply preview attribute
      if (key === 'darkness') {
        document.documentElement.setAttribute('data-darkness', String(value));
        document.body.setAttribute('data-darkness', String(value));
      }
      // If accent changed, immediately apply preview attribute
      if (key === 'accentColor') {
        document.documentElement.setAttribute('data-accent', String(value));
        document.body.setAttribute('data-accent', String(value));
      }
      return updated;
    });
  };

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData);
    setSavedToast(true);
    setShowUnsavedWarning(false);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 450);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(chatSessions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lgpai_chat_history_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMarkdown = () => {
    let md = `# LGPAI (Life Guide Personal AI Assistant) Chat Export\nGenerated: ${new Date().toLocaleString()}\n\n---\n\n`;
    chatSessions.forEach((s, idx) => {
      md += `## Session ${idx + 1}: ${s.title}\n*Date: ${new Date(s.createdAt).toLocaleString()}*\n\n`;
      s.messages.forEach((m) => {
        const author = m.role === 'user' ? (formData.userName || 'User') : 'LGPAI';
        md += `### **${author}** (${new Date(m.timestamp).toLocaleTimeString()}):\n${m.content}\n\n`;
      });
      md += `\n---\n\n`;
    });

    const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lgpai_chat_history_${new Date().toISOString().split('T')[0]}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleResetDefaults = () => {
    const defaults: UserSettings = {
      theme: 'light',
      model: 'gemini-3.7-flash',
      userName: 'Bryan',
      userEmail: '',
      defaultLocation: 'Liverpool, UK',
      postcode: 'HU5 2EG',
      darkness: 'espresso',
      accentColor: 'gold',
      fontSize: 'standard',
      temperature: 0.7,
      aiTone: 'friendly',
      timeFormat: '24h',
      tempUnits: 'c',
      enableToolGrounding: true,
      enableSuggestions: true,
    };
    setFormData(defaults);
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.className = 'light-theme';
    document.documentElement.setAttribute('data-darkness', 'espresso');
    document.body.setAttribute('data-darkness', 'espresso');
    document.documentElement.setAttribute('data-accent', 'gold');
    document.body.setAttribute('data-accent', 'gold');
  };

  return (
    <div className="settings-page-wrapper" id="settingsPage">
      {/* Top Header without Save Changes button (Save is only in the bottom bar as requested) */}
      <header className="settings-page-header">
        <div className="settings-header-left">
          <button
            type="button"
            className="settings-back-btn"
            id="settingsBackBtn"
            onClick={handleAttemptClose}
            title="Return to Chat"
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            <span>Back to Chat</span>
          </button>
          <div className="settings-header-titles">
            <h1 className="settings-page-main-title">Settings & Preferences</h1>
            <p className="settings-page-sub-title">Configure AI engine, theme darkness, regional defaults & privacy</p>
          </div>
        </div>
      </header>

      {/* Main Content Containers Grid */}
      <div className="settings-page-content">
        <div className="settings-containers-grid">
          
          {/* CONTAINER 1: Profile & AI Persona */}
          <section className="settings-card-container" id="settingsProfileContainer">
            <div className="settings-container-header">
              <div className="settings-container-icon-box profile-icon">
                <User style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h2 className="settings-container-title">Profile & Identity</h2>
                <p className="settings-container-desc">Manage your personal identification and AI address format</p>
              </div>
            </div>

            <div className="settings-fields-stack">
              {/* User Name */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label htmlFor="settingsInputUserName" className="settings-field-label">
                    What should the AI call you?
                  </label>
                  <span className="settings-field-sub">Addresses you naturally in conversations and welcomes.</span>
                </div>
                <div className="settings-field-control">
                  <input
                    id="settingsInputUserName"
                    type="text"
                    className="settings-input-control"
                    placeholder="e.g. Bryan, Sarah, Alex"
                    value={formData.userName}
                    onChange={(e) => handleFieldChange('userName', e.target.value)}
                  />
                </div>
              </div>

              {/* User Email */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label htmlFor="settingsInputEmail" className="settings-field-label">
                    Email Address
                  </label>
                  <span className="settings-field-sub">Used for bin collection reminders and daily schedules.</span>
                </div>
                <div className="settings-field-control">
                  <input
                    id="settingsInputEmail"
                    type="email"
                    className="settings-input-control"
                    placeholder="e.g. yourname@example.com"
                    value={formData.userEmail}
                    onChange={(e) => handleFieldChange('userEmail', e.target.value)}
                  />
                </div>
              </div>

              {/* AI Personality Banner */}
              <div className="settings-ai-badge-row">
                <div className="settings-ai-badge">
                  <Sparkles style={{ width: 15, height: 15, color: '#d4af37' }} />
                  <span>AI Assistant: <strong>LGPAI (Life Guide Personal AI Assistant)</strong></span>
                </div>
              </div>

              {/* Conversational Tone */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Conversational Tone</label>
                  <span className="settings-field-sub">Controls phrasing style and communication nuance.</span>
                </div>
                <div className="settings-field-control">
                  <select
                    className="settings-select-control"
                    value={formData.aiTone}
                    onChange={(e) => handleFieldChange('aiTone', e.target.value as any)}
                  >
                    <option value="friendly">Friendly & Contextual (Default)</option>
                    <option value="concise">Direct & Concise</option>
                    <option value="technical">Technical & Code-Oriented</option>
                    <option value="creative">Visionary & Creative</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* CONTAINER 2: Darkness & Appearance */}
          <section className="settings-card-container" id="settingsAppearanceContainer">
            <div className="settings-container-header">
              <div className="settings-container-icon-box appearance-icon">
                <Moon style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h2 className="settings-container-title">Appearance & Darkness</h2>
                <p className="settings-container-desc">Adjust UI darkness, contrast levels, and display typography</p>
              </div>
            </div>

            <div className="settings-fields-stack">
              {/* Theme Mode Selector (Light vs Dark) */}
              <div className="settings-field-row vertical-control">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Interface Theme Mode</label>
                  <span className="settings-field-sub">Choose between standard clean Light Mode (Default) or immersive Dark Mode.</span>
                </div>
                <div className="settings-theme-mode-selector">
                  <button
                    type="button"
                    className={`theme-mode-btn ${formData.theme !== 'dark' ? 'active' : ''}`}
                    onClick={() => handleFieldChange('theme', 'light')}
                  >
                    <div className="theme-mode-icon-box light">
                      <Sun style={{ width: 18, height: 18, color: '#f59e0b' }} />
                    </div>
                    <div className="theme-mode-info">
                      <span className="theme-mode-title">Light Mode (Default)</span>
                      <span className="theme-mode-sub">Crisp, clean, high-contrast light styling</span>
                    </div>
                    {formData.theme !== 'dark' && (
                      <Check style={{ width: 16, height: 16, color: '#10b981', marginLeft: 'auto' }} />
                    )}
                  </button>

                  <button
                    type="button"
                    className={`theme-mode-btn ${formData.theme === 'dark' ? 'active' : ''}`}
                    onClick={() => handleFieldChange('theme', 'dark')}
                  >
                    <div className="theme-mode-icon-box dark">
                      <Moon style={{ width: 18, height: 18, color: '#a78bfa' }} />
                    </div>
                    <div className="theme-mode-info">
                      <span className="theme-mode-title">Dark Mode</span>
                      <span className="theme-mode-sub">Deep, borderless dark tones for low-light focus</span>
                    </div>
                    {formData.theme === 'dark' && (
                      <Check style={{ width: 16, height: 16, color: '#10b981', marginLeft: 'auto' }} />
                    )}
                  </button>
                </div>
              </div>

              {/* Theme Darkness Level (shown if dark mode selected or configured) */}
              {formData.theme === 'dark' && (
                <div className="settings-field-row vertical-control">
                  <div className="settings-field-meta">
                    <label className="settings-field-label">Darkness Preset</label>
                    <span className="settings-field-sub">Choose your preferred dark canvas depth from pitch black to dark slate.</span>
                  </div>
                  <div className="settings-darkness-selector">
                    {[
                      { id: 'pitch', label: 'Pitch Black', hex: '#000000', desc: '100% OLED Pure Black' },
                      { id: 'oled', label: 'Deep Midnight', hex: '#090807', desc: '90% Midnight Obsidian' },
                      { id: 'espresso', label: 'Dark Espresso', hex: '#15110e', desc: '75% Refined Warm (Default)' },
                      { id: 'slate', label: 'Warm Slate', hex: '#1a1715', desc: '60% Graphite Charcoal' },
                      { id: 'titanium', label: 'Titanium Dark', hex: '#201c1a', desc: '45% High Contrast Dark' },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`darkness-preset-btn ${formData.darkness === preset.id ? 'active' : ''}`}
                        onClick={() => handleFieldChange('darkness', preset.id as any)}
                      >
                        <div className="darkness-swatch" style={{ background: preset.hex }} />
                        <div className="darkness-preset-info">
                          <span className="darkness-preset-name">{preset.label}</span>
                          <span className="darkness-preset-desc">{preset.desc}</span>
                        </div>
                        {formData.darkness === preset.id && (
                          <Check style={{ width: 14, height: 14, color: '#d4af37', marginLeft: 'auto' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Accent Color */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Accent Highlight</label>
                  <span className="settings-field-sub">Accent hue for active indicators, icons, and highlights.</span>
                </div>
                <div className="settings-accent-chips">
                  {[
                    { id: 'gold', label: 'Warm Gold', hex: '#d4af37' },
                    { id: 'sky', label: 'Sky Blue', hex: '#38bdf8' },
                    { id: 'emerald', label: 'Emerald', hex: '#10b981' },
                    { id: 'rose', label: 'Rose Coral', hex: '#fb7185' },
                    { id: 'violet', label: 'Violet', hex: '#c084fc' },
                  ].map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      className={`accent-chip-btn ${formData.accentColor === accent.id ? 'active' : ''}`}
                      onClick={() => handleFieldChange('accentColor', accent.id as any)}
                    >
                      <span className="accent-dot" style={{ background: accent.hex }} />
                      <span>{accent.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Font Size */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Text Scale</label>
                  <span className="settings-field-sub">Adjust readability and reading comfort.</span>
                </div>
                <div className="settings-field-control">
                  <select
                    className="settings-select-control"
                    value={formData.fontSize}
                    onChange={(e) => handleFieldChange('fontSize', e.target.value as any)}
                  >
                    <option value="compact">Compact (14px)</option>
                    <option value="standard">Standard (15px • Default)</option>
                    <option value="comfortable">Comfortable (16px)</option>
                    <option value="large">Large (18px)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* CONTAINER 3: AI Model Architecture & Grounding */}
          <section className="settings-card-container" id="settingsAIContainer">
            <div className="settings-container-header">
              <div className="settings-container-icon-box ai-icon">
                <Cpu style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h2 className="settings-container-title">AI Engine & Grounding</h2>
                <p className="settings-container-desc">Select Gemini neural architecture and tool capabilities</p>
              </div>
            </div>

            <div className="settings-fields-stack">
              {/* Model Choice */}
              <div className="settings-field-row vertical-control">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Active Gemini Model</label>
                  <span className="settings-field-sub">All models run on high-performance Gemini endpoints.</span>
                </div>
                <div className="settings-field-control" style={{ width: '100%' }}>
                  <select
                    className="settings-select-control"
                    id="settingsModelSelectPage"
                    value={formData.model}
                    onChange={(e) => handleFieldChange('model', e.target.value)}
                  >
                    <option value="gemini-3.7-flash">Gemini 3.7 Flash (Default • Fast, Autonomous & Intelligent)</option>
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Throughput & Tool Calling)</option>
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash (Responsive & Precise)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra Lightweight)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep Reasoning & Complex Code)</option>
                  </select>
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Creativity / Temperature</label>
                  <span className="settings-field-sub">
                    {formData.temperature! <= 0.4
                      ? 'Deterministic & Precise (0.2)'
                      : formData.temperature! <= 0.75
                      ? 'Balanced & Focused (0.7)'
                      : 'High Creativity & Brainstorming (0.95)'}
                  </span>
                </div>
                <div className="settings-slider-wrapper">
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    className="settings-range-slider"
                    value={formData.temperature}
                    onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                  />
                  <span className="settings-slider-val">{formData.temperature}</span>
                </div>
              </div>

              {/* Tool Grounding Toggle */}
              <div className="settings-toggle-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Smart Tool Grounding</label>
                  <span className="settings-field-sub">
                    Enables interactive 3D GIS Maps, live Open-Meteo weather, bin collection schedules, and Bing search.
                  </span>
                </div>
                <button
                  type="button"
                  className={`settings-toggle-switch ${formData.enableToolGrounding ? 'active' : ''}`}
                  onClick={() => handleFieldChange('enableToolGrounding', !formData.enableToolGrounding)}
                  aria-pressed={formData.enableToolGrounding}
                >
                  <span className="toggle-slider-knob" />
                </button>
              </div>

              {/* Desktop Prompt Suggestions */}
              <div className="settings-toggle-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Desktop Prompt Suggestions</label>
                  <span className="settings-field-sub">Shows quick contextual suggestion pills on computer view.</span>
                </div>
                <button
                  type="button"
                  className={`settings-toggle-switch ${formData.enableSuggestions ? 'active' : ''}`}
                  onClick={() => handleFieldChange('enableSuggestions', !formData.enableSuggestions)}
                  aria-pressed={formData.enableSuggestions}
                >
                  <span className="toggle-slider-knob" />
                </button>
              </div>
            </div>
          </section>

          {/* CONTAINER 4: Regional & Location */}
          <section className="settings-card-container" id="settingsRegionalContainer">
            <div className="settings-container-header">
              <div className="settings-container-icon-box regional-icon">
                <MapPin style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h2 className="settings-container-title">Location & Regional Defaults</h2>
                <p className="settings-container-desc">Set permanent location coordinates for fast map and weather queries</p>
              </div>
            </div>

            <div className="settings-fields-stack">
              {/* Default Location */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label htmlFor="settingsInputLoc" className="settings-field-label">Default City / Area</label>
                  <span className="settings-field-sub">Your primary city for local maps, weather, and traffic.</span>
                </div>
                <div className="settings-field-control">
                  <input
                    id="settingsInputLoc"
                    type="text"
                    className="settings-input-control"
                    placeholder="e.g. Liverpool, UK or London, UK"
                    value={formData.defaultLocation}
                    onChange={(e) => handleFieldChange('defaultLocation', e.target.value)}
                  />
                </div>
              </div>

              {/* Default Postcode */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label htmlFor="settingsInputPostcode" className="settings-field-label">UK Postcode</label>
                  <span className="settings-field-sub">Used for instant household bin schedules and council lookup.</span>
                </div>
                <div className="settings-field-control">
                  <input
                    id="settingsInputPostcode"
                    type="text"
                    className="settings-input-control"
                    placeholder="e.g. HU5 2EG or L1 8JQ"
                    value={formData.postcode}
                    onChange={(e) => handleFieldChange('postcode', e.target.value)}
                  />
                </div>
              </div>

              {/* Units */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Temperature Unit</label>
                  <span className="settings-field-sub">Weather forecast display metric.</span>
                </div>
                <div className="settings-field-control">
                  <select
                    className="settings-select-control"
                    value={formData.tempUnits}
                    onChange={(e) => handleFieldChange('tempUnits', e.target.value as any)}
                  >
                    <option value="c">Celsius (°C)</option>
                    <option value="f">Fahrenheit (°F)</option>
                  </select>
                </div>
              </div>

              {/* Time Format */}
              <div className="settings-field-row">
                <div className="settings-field-meta">
                  <label className="settings-field-label">Clock & Time Format</label>
                  <span className="settings-field-sub">Calendar and timestamp format.</span>
                </div>
                <div className="settings-field-control">
                  <select
                    className="settings-select-control"
                    value={formData.timeFormat}
                    onChange={(e) => handleFieldChange('timeFormat', e.target.value as any)}
                  >
                    <option value="24h">24-Hour (14:30)</option>
                    <option value="12h">12-Hour (2:30 PM)</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* CONTAINER 5: Data Storage & History Export */}
          <section className="settings-card-container" id="settingsDataContainer">
            <div className="settings-container-header">
              <div className="settings-container-icon-box data-icon">
                <Shield style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <h2 className="settings-container-title">Data Storage & Privacy</h2>
                <p className="settings-container-desc">Export conversation history or manage local workspace cache</p>
              </div>
            </div>

            <div className="settings-fields-stack">
              <div className="settings-data-summary">
                <div className="data-stat-card">
                  <span className="data-stat-num">{chatSessions.length}</span>
                  <span className="data-stat-label">Saved Sessions</span>
                </div>
                <div className="data-stat-card">
                  <span className="data-stat-num">
                    {chatSessions.reduce((acc, s) => acc + s.messages.length, 0)}
                  </span>
                  <span className="data-stat-label">Total Messages</span>
                </div>
              </div>

              <div className="settings-actions-group">
                <button
                  type="button"
                  className="settings-action-btn export-btn"
                  onClick={handleExportJSON}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  <span>Export History (JSON)</span>
                </button>

                <button
                  type="button"
                  className="settings-action-btn export-btn"
                  onClick={handleExportMarkdown}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  <span>Export History (Markdown)</span>
                </button>

                <button
                  type="button"
                  className="settings-action-btn reset-btn"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  <span>Reset All Settings to Defaults</span>
                </button>

                {!showClearConfirm ? (
                  <button
                    type="button"
                    className="settings-action-btn delete-btn"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                    <span>Clear All Chat History</span>
                  </button>
                ) : (
                  <div className="settings-delete-confirm-box">
                    <span>Are you sure? This cannot be undone.</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="delete-confirm-yes"
                        onClick={() => {
                          onClearHistory();
                          setShowClearConfirm(false);
                        }}
                      >
                        Yes, Delete All
                      </button>
                      <button
                        type="button"
                        className="delete-confirm-no"
                        onClick={() => setShowClearConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>

        {/* Bottom Save Bar */}
        <div className="settings-bottom-bar">
          <button
            type="button"
            className="settings-btn-cancel-large"
            id="settingsCancelBottomBtn"
            onClick={handleAttemptClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="settings-btn-save-large"
            id="settingsSaveBottomBtn"
            onClick={handleSubmit}
          >
            {savedToast ? (
              <>
                <Check style={{ width: 16, height: 16 }} />
                <span>Saved Preferences!</span>
              </>
            ) : (
              <span>Save & Apply Preferences</span>
            )}
          </button>
        </div>
      </div>

      {/* Unsaved Changes Blocker Notification Popup */}
      {showUnsavedWarning && (
        <div className="settings-unsaved-warning-backdrop" id="unsavedWarningModal">
          <div className="settings-unsaved-warning-card">
            <div className="settings-unsaved-icon-wrap">
              <AlertTriangle style={{ width: 24, height: 24 }} />
            </div>
            <h3 className="settings-unsaved-title">Unsaved Changes</h3>
            <p className="settings-unsaved-text">
              You must save your changes before leaving settings. Please click the <strong>Save & Apply Preferences</strong> button to preserve your changes.
            </p>
            <div className="settings-unsaved-actions">
              <button
                type="button"
                className="settings-unsaved-save-btn"
                id="warningSaveAndApplyBtn"
                onClick={handleSubmit}
              >
                Save Changes Now
              </button>
              <button
                type="button"
                className="settings-unsaved-dismiss-btn"
                onClick={() => setShowUnsavedWarning(false)}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
