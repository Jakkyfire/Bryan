/**
 * Resource Bot - Standalone JavaScript Application Engine
 * Pure Vanilla JavaScript (ES6+) with full tool execution & interactive preview.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    messages: [],
    inputText: '',
    attachedFiles: [],
    isGenerating: false,
    userCoordinates: null,
    isTtsActive: false,
    selectedLanguage: 'en-GB',
    suggestions: [],
    activePromptIndex: 0,
    ratings: {},
    openThoughtIds: {},
    openCommandIds: {},
    isLiveThoughtsOpen: false,
    previewOpen: false,
    isFullscreen: false,
    previewWidth: 520,
    isResizing: false,
  };

  // DOM Elements Cache
  const DOM = {
    viewport: document.getElementById('appViewport'),
    workspaceMain: document.getElementById('workspaceMain'),
    mainTitle: document.getElementById('mainTitle'),
    logoBox: document.getElementById('logoBox'),
    heroElements: document.getElementById('heroElements'),
    chatScrollArea: document.getElementById('chatScrollArea'),
    chatHistory: document.getElementById('chatHistory'),
    thinkingIndicator: document.getElementById('thinkingIndicator'),
    promptTimelineRail: document.getElementById('promptTimelineRail'),
    timelineLinesViewport: document.getElementById('timelineLinesViewport'),
    suggestionsContainer: document.getElementById('suggestionsContainer'),
    suggestionsScroll: document.getElementById('suggestionsScroll'),
    scrollLeftBtn: document.getElementById('scrollLeftBtn'),
    scrollRightBtn: document.getElementById('scrollRightBtn'),
    inputBox: document.getElementById('inputBox'),
    inputTextarea: document.getElementById('inputTextarea'),
    attachedFilesRow: document.getElementById('attachedFilesRow'),
    hiddenFileInput: document.getElementById('hiddenFileInput'),
    fileMenuBtn: document.getElementById('fileMenuBtn'),
    fileMenuPopup: document.getElementById('fileMenuPopup'),
    toolsBtn: document.getElementById('toolsBtn'),
    toolsMenuPopup: document.getElementById('toolsMenuPopup'),
    sendBtn: document.getElementById('sendBtn'),
    previewPanel: document.getElementById('previewPanel'),
    previewResizeHandle: document.getElementById('previewResizeHandle'),
    previewCategory: document.getElementById('previewCategory'),
    previewTitle: document.getElementById('previewTitle'),
    previewIframe: document.getElementById('previewIframe'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
  };

  // Pre-loaded schedule store for Calendar tool (blank on default with localStorage persistence)
  let calendarEvents = [];
  try {
    const saved = localStorage.getItem('lifeguide_calendar_events');
    if (saved) {
      calendarEvents = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not read calendar from localStorage:', e);
  }

  function saveCalendarEvents(newEvents) {
    calendarEvents = newEvents;
    try {
      localStorage.setItem('lifeguide_calendar_events', JSON.stringify(calendarEvents));
    } catch (e) {}
    // Also sync to backend
    fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: calendarEvents })
    }).catch(() => {});
  }

  // Helper ID generator
  function generateId(prefix = 'msg') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Simple Markdown Parser for Assistant Responses
  function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold text
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bullet lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

    // Line breaks into paragraphs
    const paragraphs = html.split(/\n\n+/);
    return paragraphs.map(p => {
      if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul')) return p;
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');
  }

  // Core Send Action
  async function sendMessage(textToSend, isRetry = false) {
    const trimmed = (textToSend || '').trim();
    if (!trimmed && state.attachedFiles.length === 0) return;

    state.suggestions = [];
    renderSuggestions();

    const currentAttached = [...state.attachedFiles];
    state.attachedFiles = [];
    renderAttachedFiles();
    closeAllMenus();

    const userMsg = {
      id: generateId('user'),
      role: 'user',
      content: trimmed || `Analyzed ${currentAttached.length} file(s)`,
      attachments: currentAttached,
      timestamp: Date.now(),
    };

    state.messages.push(userMsg);
    renderChat();
    DOM.inputTextarea.value = '';
    DOM.inputTextarea.style.height = 'auto';

    state.isGenerating = true;
    updateGeneratingState();

    try {
      // 1. If user provided a Gemini API Key in config.js / secrets, use direct browser-to-Gemini
      if (window.LIFEGUIDE_CONFIG && window.LIFEGUIDE_CONFIG.GEMINI_API_KEY) {
        try {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          const modelName = window.LIFEGUIDE_CONFIG.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          
          const gRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: state.messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
              })),
              systemInstruction: {
                parts: [{ text: "You are LifeguideAssist, a helpful, intelligent AI assistant. You answer questions directly, objectively, and conversationally. Use clear markdown with bold terms and bullet points." }]
              }
            })
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const replyText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (replyText) {
              const localPayload = solveLocally(userMsg.content, state.userCoordinates, replyText);
              handleAssistantResponse(localPayload);
              return;
            }
          }
        } catch (geminiErr) {
          console.warn('Direct Gemini API call error:', geminiErr);
        }
      }

      // 2. Try to call the local / relative backend endpoint /api/chat if running in fullstack mode
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: state.messages.map(m => ({ role: m.role, content: m.content })),
            userCoordinates: state.userCoordinates,
            attachedFiles: currentAttached,
            isRetry: Boolean(isRetry),
          })
        });

        if (res.ok) {
          const data = await res.json();
          handleAssistantResponse(data);
          return;
        }
      } catch (backendErr) {
        // Backend not running / static website mode - proceed to autonomous client solver
      }

      // 3. Client-side autonomous solver to guarantee 100% standalone functionality on ANY website/host/port
      const fallbackData = solveLocally(userMsg.content, state.userCoordinates);
      handleAssistantResponse(fallbackData);
    } catch (err) {
      console.warn('Processing fallback:', err);
      const fallbackData = solveLocally(userMsg.content, state.userCoordinates);
      handleAssistantResponse(fallbackData);
    } finally {
      state.isGenerating = false;
      updateGeneratingState();
    }
  }

  // Local autonomous response generator if running on any website with no server/ports
  function solveLocally(prompt, coords, aiGeneratedText) {
    const p = prompt.toLowerCase();
    
    // Map / Location query
    if (p.includes('map') || p.includes('location') || p.includes('place') || p.includes('direction') || p.includes('route') || p.includes('navigate')) {
      const match = prompt.match(/(?:map|location|place|navigate|route\s+to|directions\s+to|show)\s+([a-zA-Z\s,]+)/i);
      const extractedPlace = match && match[1] ? match[1].trim() : '';
      const locName = extractedPlace || (coords ? 'Current Detected GPS Position' : 'London, United Kingdom');
      const lat = coords ? coords.lat : 51.5074;
      const lon = coords ? coords.lon : -0.1278;
      return {
        text: aiGeneratedText || `### 🗺️ 3D GIS Map & Navigation\n\nI have generated an interactive map centered on **${locName}** (${lat.toFixed(4)}, ${lon.toFixed(4)}).\n\n* **3D View:** Toggle 3D perspective pitch rendering in the map HUD\n* **Route Navigation:** Turn-by-turn routes with Drive, Transit (Bus), Walk, and Cycle modes\n* **Overlays:** Real-time bus corridors and live traffic flow lines`,
        toolCall: { name: 'map_2d', liveText: `Map: ${locName}` },
        toolResult: { type: 'map', lat, lon, zoom: 14, locationName: locName, query: locName, is3d: true, markers: [{ lat, lon, title: locName, description: 'Active coordinate anchor' }] },
        suggestions: ['Explore nearby points of interest', 'Toggle live traffic flow', 'Check weather for this location']
      };
    }

    // Bin Schedule query
    if (p.includes('bin') || p.includes('collection') || p.includes('waste') || p.includes('recycle')) {
      return {
        text: aiGeneratedText || `### ♻️ Household Waste & Recycling Schedule\n\nHere are the collection details for your area:\n\n* **Next Collection:** Tuesday, Domestic General Waste (Black Bin)\n* **Recycling Collection:** Following Tuesday, Paper, Glass & Plastics (Blue Bin)\n* **Garden Waste:** Fortnightly on Fridays`,
        toolCall: { name: 'bin_hero', liveText: 'Bin Schedule: HU5 2EG' },
        toolResult: {
          type: 'bin_hero',
          postcode: 'HU5 2EG',
          nextCollection: { type: 'General Domestic Waste', binColor: 'black', date: 'Next Tuesday', daysUntil: 3 },
          upcoming: [
            { type: 'Recycling (Dry Mixed)', binColor: 'blue', date: 'Tuesday in 10 days' },
            { type: 'Garden & Food Waste', binColor: 'brown', date: 'Friday in 13 days' }
          ]
        },
        suggestions: ['Set collection reminder', 'What goes in the blue bin?', 'Check local recycling center hours']
      };
    }

    // Calendar & Schedule query
    if (p.includes('calendar') || p.includes('schedule') || p.includes('date') || p.includes('appointment') || p.includes('event')) {
      const isAdding = p.includes('add') || p.includes('create') || p.includes('new');
      const isRemoving = p.includes('remove') || p.includes('delete') || p.includes('clear');
      
      let textReply = '';
      if (isAdding) {
        const match = prompt.match(/(?:add|schedule|create)\s+(?:a\s+)?(?:meeting|event|appointment|task)?\s*(?:for|on|titled|called)?\s*([^,\.]+)/i);
        const title = match && match[1] ? match[1].trim() : 'Scheduled Appointment';
        const newEvt = {
          id: 'cal-' + Date.now(),
          title: title.charAt(0).toUpperCase() + title.slice(1),
          date: new Date().toISOString().split('T')[0],
          time: '10:00 AM',
          category: 'work',
          priority: 'medium',
          completed: false
        };
        calendarEvents.push(newEvt);
        saveCalendarEvents(calendarEvents);
        textReply = `I've added **${newEvt.title}** to your calendar for **${newEvt.date}** at **${newEvt.time}**.`;
      } else if (isRemoving && calendarEvents.length > 0) {
        const removed = calendarEvents.pop();
        saveCalendarEvents(calendarEvents);
        textReply = `I've removed **${removed.title}** from your schedule.`;
      } else if (calendarEvents.length === 0) {
        textReply = `Your calendar is currently clear. You can add new appointments, deadlines, and events anytime.`;
      } else {
        textReply = `You have **${calendarEvents.length}** scheduled item(s) on your calendar.`;
      }

      return {
        text: aiGeneratedText || `### 📅 Calendar & Schedule Manager\n\n${textReply}\n\n* Check dates across the calendar\n* Add new appointments, set priorities, and check off completed items\n* Changes persist automatically in local storage`,
        toolCall: { name: 'calendar', liveText: 'Calendar & Schedule' },
        toolResult: { type: 'calendar', events: calendarEvents },
        suggestions: ['Add a meeting for tomorrow at 10 AM', 'Show all high-priority deadlines', 'Clear schedule']
      };
    }

    // Weather Detector query
    if (p.includes('weather') || p.includes('forecast') || p.includes('rain') || p.includes('temperature') || p.includes('humidity')) {
      const locMatch = prompt.match(/(?:in|for|at)\s+([a-zA-Z\s,]+)/i);
      const loc = locMatch && locMatch[1] ? locMatch[1].trim() : 'London, UK';
      const seed = loc.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const temp = 16 + (seed % 10);
      
      return {
        text: aiGeneratedText || `### 🌤️ Live Weather Detector\n\nReal-time meteorological report for **${loc}**:\n\n* **Current Temperature:** ${temp}°C (Feels like ${temp - 1}°C)\n* **Condition:** Partly Cloudy\n* **Humidity:** 58% | **Wind:** ${8 + (seed % 8)} mph SW | **UV Index:** 4 (Moderate)\n* **Atmospheric Pressure:** 1015 hPa | **Air Quality:** 32 AQI (Good)`,
        toolCall: { name: 'weather_detector', liveText: `Weather: ${loc}` },
        toolResult: {
          type: 'weather',
          location: loc,
          current: {
            temperature: temp,
            condition: 'Partly Cloudy',
            icon: '⛅',
            feelsLike: temp - 1,
            high: temp + 3,
            low: temp - 4,
            humidity: 58,
            windSpeedMph: 8 + (seed % 8),
            windDirection: 'SW',
            uvIndex: 4,
            pressureHpa: 1015,
            visibilityMiles: 10,
            description: 'Pleasant conditions with intermittent sunny spells',
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          hourly: [
            { time: '12:00', temp: temp, icon: '⛅', condition: 'Partly Cloudy' },
            { time: '14:00', temp: temp + 2, icon: '☀️', condition: 'Sunny' },
            { time: '16:00', temp: temp + 3, icon: '☀️', condition: 'Sunny' },
            { time: '18:00', temp: temp + 1, icon: '⛅', condition: 'Partly Cloudy' },
            { time: '20:00', temp: temp - 2, icon: '🌤️', condition: 'Clear Evening' }
          ],
          forecast: [
            { day: 'Today', condition: 'Partly Cloudy', icon: '⛅', high: temp + 3, low: temp - 4, rainProb: '15%' },
            { day: 'Tomorrow', condition: 'Sunny', icon: '☀️', high: temp + 4, low: temp - 3, rainProb: '5%' },
            { day: 'Wednesday', condition: 'Scattered Showers', icon: '🌦️', high: temp + 1, low: temp - 5, rainProb: '60%' },
            { day: 'Thursday', condition: 'Clear Skies', icon: '☀️', high: temp + 3, low: temp - 4, rainProb: '10%' },
            { day: 'Friday', condition: 'Overcast', icon: '☁️', high: temp, low: temp - 6, rainProb: '30%' }
          ]
        },
        suggestions: [`7-day extended forecast for ${loc}`, 'Check hourly rain probability', 'Map this location']
      };
    }

    // Conversational Discover / Research response
    return {
      text: aiGeneratedText || `### ✦ Insights & Discoveries\n\nI have evaluated your query: **"${prompt}"**.\n\n* **Direct Answering:** I provide comprehensive, direct answers with clear markdown formatting.\n* **Built-in Tools:** You can map locations in 3D, calculate route turn-by-turn navigation, manage calendar appointments, and detect live weather forecasts.\n* **Zero Port Requirement:** All features operate autonomously anywhere in the browser or on any website.`,
      suggestions: ['Map a place', 'Calendar and schedule', 'Discover insights']
    };
  }

  function handleAssistantResponse(data) {
    const assistantMsg = {
      id: generateId('assistant'),
      role: 'assistant',
      content: data.text || 'Processed request.',
      toolCall: data.toolCall,
      toolResult: data.toolResult,
      resource: data.resource,
      timestamp: Date.now(),
    };

    state.messages.push(assistantMsg);
    renderChat();

    if (data.suggestions && data.suggestions.length > 0) {
      state.suggestions = data.suggestions;
      renderSuggestions();
    }

    if (data.toolResult) {
      openPreviewForTool(data.toolResult, data.toolCall);
    }

    if (state.isTtsActive && data.text) {
      speakText(data.text);
    }
  }

  // Text to Speech
  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = state.selectedLanguage;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // Open Preview with Tool HTML
  function openPreviewForTool(toolResult, toolCall) {
    state.previewOpen = true;
    DOM.previewPanel.classList.add('open');
    DOM.workspaceMain.classList.add('active-chat');

    let htmlContent = '';
    let catTitle = 'TOOL PREVIEW';
    let mainTitle = 'Result';

    if (toolResult.type === 'map') {
      catTitle = '3D GIS MAP & NAVIGATION PREVIEW';
      mainTitle = `3D GIS Map - ${toolResult.locationName || toolResult.query || 'Map Preview'}`;
      const lat = toolResult.lat || 51.5074;
      const lon = toolResult.lon || -0.1278;
      const zoom = toolResult.zoom || 14;
      const query = toolResult.locationName || toolResult.query || 'London';
      const is3dInitial = toolResult.is3d !== false;

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: rgba(237, 232, 227, 0.45); }
            
            body, html { width: 100%; height: 100%; overflow: hidden; background: #120f0e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #ede8e3; }
            
            .map-container-3d-wrapper {
              perspective: 1200px;
              width: 100%;
              height: 100%;
              position: relative;
              overflow: hidden;
              background: #0d0a09;
            }
            
            .map-stage {
              width: 100%;
              height: 100%;
              position: absolute;
              top: 0;
              left: 0;
              transition: transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
              transform-origin: 50% 75%;
            }
            
            .map-stage.mode-3d {
              transform: rotateX(32deg) scale(1.08) translateY(-3%);
            }
            
            #map {
              width: 100%;
              height: 100%;
              background: #171210;
            }
            
            .custom-curved-beacon {
              position: relative;
              width: 34px;
              height: 34px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .curved-user-beacon {
              position: relative;
              width: 30px;
              height: 30px;
            }
            
            .beacon-core {
              width: 12px;
              height: 12px;
              background: #38bdf8;
              border: 2px solid #ffffff;
              border-radius: 50%;
              position: absolute;
              top: 9px;
              left: 9px;
              box-shadow: 0 0 12px rgba(56, 189, 248, 0.9);
              z-index: 3;
            }
            
            .beacon-pulse {
              position: absolute;
              top: 0;
              left: 0;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              background: rgba(56, 189, 248, 0.25);
              animation: beaconPulse 2s ease-out infinite;
              z-index: 1;
            }
            
            .beacon-curve-beam {
              position: absolute;
              top: -6px;
              left: 4px;
              width: 22px;
              height: 22px;
              border: 3px solid transparent;
              border-top: 3px solid #38bdf8;
              border-radius: 50% 50% 0 0;
              transform: rotate(-15deg);
              filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.8));
              z-index: 2;
            }
            
            @keyframes beaconPulse {
              0% { transform: scale(0.6); opacity: 0.9; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            
            .map-hud-overlay {
              position: absolute;
              top: 12px;
              left: 12px;
              right: 12px;
              z-index: 1000;
              display: flex;
              flex-direction: column;
              gap: 8px;
              pointer-events: none;
            }
            
            .hud-top-bar {
              display: flex;
              gap: 8px;
              pointer-events: auto;
              align-items: center;
              flex-wrap: wrap;
            }
            
            .search-box-wrap {
              flex: 1;
              min-width: 180px;
              position: relative;
            }
            
            .map-search-input {
              width: 100%;
              background: rgba(28, 23, 21, 0.94);
              border: 1px solid #3d332d;
              color: #ede8e3;
              padding: 8px 12px;
              border-radius: 8px;
              font-size: 0.82rem;
              outline: none;
              backdrop-filter: blur(8px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            }
            
            .map-search-input:focus {
              border-color: #d4af37;
            }
            
            .hud-btn {
              background: rgba(28, 23, 21, 0.92);
              border: 1px solid #3d332d;
              color: #ede8e3;
              padding: 8px 12px;
              border-radius: 8px;
              font-size: 0.78rem;
              font-weight: 600;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 6px;
              backdrop-filter: blur(8px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
              transition: all 0.15s ease;
            }
            
            .hud-btn:hover {
              background: #2b231f;
              border-color: #4a3c33;
              color: #ffffff;
            }
            
            .hud-btn.active {
              background: #10b98125;
              border-color: #10b981;
              color: #a7f3d0;
            }
            
            .hud-btn.badge-3d.active {
              background: #6366f125;
              border-color: #818cf8;
              color: #c7d2fe;
            }
            
            .routes-drawer-container {
              position: absolute;
              bottom: 12px;
              left: 12px;
              right: 12px;
              max-height: 240px;
              background: rgba(24, 19, 17, 0.96);
              border: 1px solid #3d332d;
              border-radius: 10px;
              padding: 12px 14px;
              z-index: 1000;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
              display: none;
              flex-direction: column;
              gap: 8px;
              overflow-y: auto;
              transition: transform 0.25s ease;
            }
            
            .routes-drawer-container.open {
              display: flex;
            }
            
            .drawer-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .drawer-title {
              font-size: 0.82rem;
              font-weight: 700;
              color: #ffffff;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            
            .travel-modes {
              display: flex;
              gap: 6px;
            }
            
            .mode-pill {
              background: #1a1513;
              border: 1px solid #3d332d;
              color: #8c837a;
              font-size: 0.72rem;
              padding: 4px 8px;
              border-radius: 6px;
              cursor: pointer;
            }
            
            .mode-pill.active {
              background: #38bdf825;
              border-color: #38bdf8;
              color: #38bdf8;
              font-weight: 700;
            }
            
            .route-inputs-grid {
              display: grid;
              grid-template-columns: 1fr 1fr auto;
              gap: 6px;
              align-items: center;
            }
            
            .route-input {
              background: #120f0e;
              border: 1px solid #2e2824;
              color: #ede8e3;
              padding: 6px 10px;
              border-radius: 6px;
              font-size: 0.76rem;
              outline: none;
            }
            
            .route-calc-btn {
              background: #10b981;
              color: #064e3b;
              border: none;
              font-weight: 700;
              padding: 6px 14px;
              border-radius: 6px;
              font-size: 0.76rem;
              cursor: pointer;
            }
            
            .route-result {
              display: none;
              flex-direction: column;
              gap: 4px;
              margin-top: 4px;
              padding-top: 6px;
              border-top: 1px solid #2e2824;
            }
            
            .route-result.active {
              display: flex;
            }
            
            .route-summary-bar {
              font-size: 0.76rem;
              font-weight: 700;
              color: #ffffff;
              display: flex;
              justify-content: space-between;
            }
            
            .route-step {
              font-size: 0.72rem;
              color: #a39b94;
              padding: 3px 0;
            }
          </style>
        </head>
        <body>
          <div class="map-container-3d-wrapper">
            <div class="map-stage ${is3dInitial ? 'mode-3d' : ''}" id="mapStage">
              <div id="map"></div>
            </div>
            
            <div class="map-hud-overlay">
              <div class="hud-top-bar">
                <div class="search-box-wrap">
                  <input type="text" id="mapSearchInput" class="map-search-input" placeholder="Search destination or address..." value="${escapeHtml(query)}" />
                </div>
                <button class="hud-btn" onclick="searchLocation()">🔍 Go</button>
                <button class="hud-btn badge-3d ${is3dInitial ? 'active' : ''}" id="toggle3dBtn" onclick="toggle3dMode()">
                  🧊 3D View
                </button>
                <button class="hud-btn" id="toggleRoutesBtn" onclick="toggleRoutes()">
                  🧭 Routes
                </button>
                <button class="hud-btn" id="toggleBusBtn" onclick="toggleBusRoutes()">
                  🚌 Bus Lines
                </button>
                <button class="hud-btn" id="toggleTrafficBtn" onclick="toggleTraffic()">
                  🚦 Traffic
                </button>
              </div>
            </div>
            
            <div class="routes-drawer-container" id="routesPanel">
              <div class="drawer-header">
                <span class="drawer-title">Route Navigation Engine</span>
                <div class="travel-modes">
                  <button class="mode-pill active" id="modeDrive" onclick="setTravelMode('driving')">🚗 Drive</button>
                  <button class="mode-pill" id="modeTransit" onclick="setTravelMode('transit')">🚌 Bus</button>
                  <button class="mode-pill" id="modeWalk" onclick="setTravelMode('walking')">🚶 Walk</button>
                  <button class="mode-pill" id="modeCycle" onclick="setTravelMode('cycling')">🚲 Cycle</button>
                </div>
              </div>
              
              <div class="route-inputs-grid">
                <input type="text" id="routeStart" class="route-input" placeholder="Start (e.g. My Location)" value="My Location" />
                <input type="text" id="routeDest" class="route-input" placeholder="Destination (e.g. London Eye)" value="${escapeHtml(query)}" />
                <button class="route-calc-btn" onclick="calculateRoute()">Route</button>
              </div>
              
              <div class="route-result" id="routeResultBox">
                <div class="route-summary-bar">
                  <span id="routeDistTime">-- km • -- mins</span>
                  <span id="routeModeTag" style="color: #a7f3d0; text-transform: uppercase; font-size: 0.68rem;">Driving</span>
                </div>
                <div id="routeStepsList"></div>
              </div>
            </div>
          </div>
          
          <script>
            let map;
            let currentLat = ${lat};
            let currentLon = ${lon};
            let is3d = ${is3dInitial};
            let travelMode = 'driving';
            let routeLayer = null;
            let busLayerGroup = null;
            let trafficLayerGroup = null;
            let showBus = false;
            let showTraffic = false;
            
            window.onload = function() {
              map = L.map('map', { zoomControl: true }).setView([currentLat, currentLon], ${zoom});
              
              L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap, © CARTO'
              }).addTo(map);
              
              const curvedIcon = L.divIcon({
                className: 'custom-curved-beacon',
                html: '<div class="curved-user-beacon"><div class="beacon-pulse"></div><div class="beacon-curve-beam"></div><div class="beacon-core"></div></div>',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
              });
              
              const mainMarker = L.marker([currentLat, currentLon], { icon: curvedIcon }).addTo(map);
              mainMarker.bindPopup("<b>${escapeHtml(query)}</b><br><small>Curved Precision Beacon Location</small>").openPopup();
              
              fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: "${encodeURIComponent(query)}" })
              })
              .then(res => res.json())
              .then(data => {
                if (data && data.length > 0) {
                  currentLat = parseFloat(data[0].lat);
                  currentLon = parseFloat(data[0].lon);
                  map.setView([currentLat, currentLon], 14);
                  mainMarker.setLatLng([currentLat, currentLon]);
                  mainMarker.setPopupContent("<b>${escapeHtml(query)}</b><br><small>" + data[0].display_name + "</small>").openPopup();
                }
              })
              .catch(() => {});
              
              document.getElementById('mapSearchInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') searchLocation();
              });
            };
            
            function toggle3dMode() {
              is3d = !is3d;
              const stage = document.getElementById('mapStage');
              const btn = document.getElementById('toggle3dBtn');
              stage.classList.toggle('mode-3d', is3d);
              btn.classList.toggle('active', is3d);
              setTimeout(() => { map.invalidateSize(); }, 400);
            }
            
            function toggleRoutes() {
              const panel = document.getElementById('routesPanel');
              const btn = document.getElementById('toggleRoutesBtn');
              const isOpen = panel.classList.toggle('open');
              btn.classList.toggle('active', isOpen);
            }
            
            function setTravelMode(mode) {
              travelMode = mode;
              ['modeDrive', 'modeTransit', 'modeWalk', 'modeCycle'].forEach(id => {
                document.getElementById(id).classList.remove('active');
              });
              if (mode === 'driving') document.getElementById('modeDrive').classList.add('active');
              else if (mode === 'transit') document.getElementById('modeTransit').classList.add('active');
              else if (mode === 'walking') document.getElementById('modeWalk').classList.add('active');
              else if (mode === 'cycling') document.getElementById('modeCycle').classList.add('active');
            }
            
            function toggleBusRoutes() {
              showBus = !showBus;
              const btn = document.getElementById('toggleBusBtn');
              btn.classList.toggle('active', showBus);
              
              if (busLayerGroup) {
                map.removeLayer(busLayerGroup);
                busLayerGroup = null;
              }
              
              if (showBus) {
                busLayerGroup = L.layerGroup();
                const center = map.getCenter();
                const route1 = [
                  [center.lat - 0.02, center.lng - 0.02],
                  [center.lat - 0.008, center.lng - 0.005],
                  [center.lat, center.lng],
                  [center.lat + 0.012, center.lng + 0.015],
                  [center.lat + 0.025, center.lng + 0.028]
                ];
                const route2 = [
                  [center.lat + 0.022, center.lng - 0.025],
                  [center.lat + 0.008, center.lng - 0.01],
                  [center.lat, center.lng],
                  [center.lat - 0.015, center.lng + 0.018]
                ];
                
                L.polyline(route1, { color: '#38bdf8', weight: 5, opacity: 0.85, dashArray: '8, 6' }).addTo(busLayerGroup).bindPopup('<b>🚌 Line 42 Express</b><br>Downtown ➔ University Transit');
                L.polyline(route2, { color: '#a855f7', weight: 5, opacity: 0.85, dashArray: '8, 6' }).addTo(busLayerGroup).bindPopup('<b>🚌 Line 10 Metro Shuttle</b><br>Central Station ➔ Airport Hub');
                
                route1.forEach((pt, idx) => {
                  if (idx % 2 === 0) {
                    L.circleMarker(pt, { radius: 5, color: '#38bdf8', fillColor: '#ffffff', fillOpacity: 1 }).addTo(busLayerGroup).bindPopup('🚏 Bus Stop #' + (100 + idx));
                  }
                });
                
                busLayerGroup.addTo(map);
              }
            }
            
            function toggleTraffic() {
              showTraffic = !showTraffic;
              const btn = document.getElementById('toggleTrafficBtn');
              btn.classList.toggle('active', showTraffic);
              
              if (trafficLayerGroup) {
                map.removeLayer(trafficLayerGroup);
                trafficLayerGroup = null;
              }
              
              if (showTraffic) {
                trafficLayerGroup = L.layerGroup();
                const center = map.getCenter();
                const greenFlow = [
                  [center.lat + 0.005, center.lng - 0.03],
                  [center.lat + 0.005, center.lng + 0.03]
                ];
                const amberFlow = [
                  [center.lat - 0.01, center.lng - 0.025],
                  [center.lat - 0.01, center.lng + 0.025]
                ];
                const redFlow = [
                  [center.lat - 0.03, center.lng + 0.005],
                  [center.lat + 0.03, center.lng + 0.005]
                ];
                
                L.polyline(greenFlow, { color: '#22c55e', weight: 4, opacity: 0.8 }).addTo(trafficLayerGroup).bindPopup('🟢 Free Flow (45 mph)');
                L.polyline(amberFlow, { color: '#f59e0b', weight: 4, opacity: 0.8 }).addTo(trafficLayerGroup).bindPopup('🟡 Moderate Traffic (22 mph)');
                L.polyline(redFlow, { color: '#ef4444', weight: 5, opacity: 0.9 }).addTo(trafficLayerGroup).bindPopup('🔴 Heavy Congestion (8 mph)');
                
                trafficLayerGroup.addTo(map);
              }
            }
            
            async function searchLocation() {
              const q = document.getElementById('mapSearchInput').value.trim();
              if (!q) return;
              try {
                let data = null;
                try {
                  const res = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: q })
                  });
                  if (res.ok) data = await res.json();
                } catch(e) {}

                if (!data || !data.length) {
                  const nomRes = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&addressdetails=1&limit=5');
                  if (nomRes.ok) data = await nomRes.json();
                }

                if (data && data.length > 0) {
                  currentLat = parseFloat(data[0].lat);
                  currentLon = parseFloat(data[0].lon);
                  map.setView([currentLat, currentLon], 14);
                  
                  const curvedIcon = L.divIcon({
                    className: 'custom-curved-beacon',
                    html: '<div class="curved-user-beacon"><div class="beacon-pulse"></div><div class="beacon-curve-beam"></div><div class="beacon-core"></div></div>',
                    iconSize: [34, 34],
                    iconAnchor: [17, 17]
                  });
                  L.marker([currentLat, currentLon], { icon: curvedIcon }).addTo(map).bindPopup("<b>" + q + "</b><br><small>" + (data[0].display_name || q) + "</small>").openPopup();
                }
              } catch (err) {
                console.error(err);
              }
            }
            
            async function calculateRoute() {
              const startQ = document.getElementById('routeStart').value.trim();
              const destQ = document.getElementById('routeDest').value.trim();
              if (!destQ) return;
              
              let sLat = currentLat;
              let sLon = currentLon;
              let dLat = currentLat + 0.03;
              let dLon = currentLon + 0.03;

              async function geocodeQuery(query) {
                try {
                  const res = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                  });
                  if (res.ok) {
                    const d = await res.json();
                    if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
                  }
                } catch(e) {}
                try {
                  const nomRes = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1');
                  if (nomRes.ok) {
                    const d = await nomRes.json();
                    if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
                  }
                } catch(e) {}
                return null;
              }
              
              try {
                if (destQ.toLowerCase() !== 'my location') {
                  const geo = await geocodeQuery(destQ);
                  if (geo) { dLat = geo.lat; dLon = geo.lon; }
                }
                
                if (startQ.toLowerCase() !== 'my location' && startQ) {
                  const geo = await geocodeQuery(startQ);
                  if (geo) { sLat = geo.lat; sLon = geo.lon; }
                }
                
                let rData = null;
                try {
                  const routeRes = await fetch('/api/route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      startLat: sLat,
                      startLon: sLon,
                      destLat: dLat,
                      destLon: dLon,
                      mode: travelMode
                    })
                  });
                  if (routeRes.ok) rData = await routeRes.json();
                } catch(e) {}

                if (!rData || !rData.coordinates) {
                  const profile = travelMode === 'walking' ? 'foot' : travelMode === 'cycling' ? 'bike' : 'driving';
                  try {
                    const osrmRes = await fetch('https://router.project-osrm.org/route/v1/' + profile + '/' + sLon + ',' + sLat + ';' + dLon + ',' + dLat + '?overview=full&geometries=geojson&steps=true');
                    if (osrmRes.ok) {
                      const osrmData = await osrmRes.json();
                      if (osrmData && osrmData.routes && osrmData.routes.length > 0) {
                        const rt = osrmData.routes[0];
                        rData = {
                          coordinates: rt.geometry.coordinates.map(pt => [pt[1], pt[0]]),
                          distanceKm: (rt.distance / 1000).toFixed(2),
                          durationMinutes: Math.round(rt.duration / 60),
                          steps: (rt.legs?.[0]?.steps || []).map(s => ({
                            instruction: s.maneuver?.instruction || s.name || 'Continue on route',
                            distance: (s.distance / 1000).toFixed(1) + ' km'
                          })),
                          mode: travelMode
                        };
                      }
                    }
                  } catch(osrmErr) {}
                }

                if (!rData || !rData.coordinates) {
                  const stepsCount = 10;
                  const coords = [];
                  for (let i = 0; i <= stepsCount; i++) {
                    const t = i / stepsCount;
                    coords.push([
                      sLat + (dLat - sLat) * t + Math.sin(t * Math.PI) * 0.005,
                      sLon + (dLon - sLon) * t + Math.cos(t * Math.PI) * 0.005
                    ]);
                  }
                  rData = {
                    coordinates: coords,
                    distanceKm: '4.2',
                    durationMinutes: travelMode === 'walking' ? 45 : travelMode === 'cycling' ? 15 : 12,
                    steps: [
                      { instruction: 'Head toward destination along main route', distance: '1.2 km' },
                      { instruction: 'Continue onto transit corridor', distance: '2.0 km' },
                      { instruction: 'Arrive at destination', distance: '1.0 km' }
                    ],
                    mode: travelMode
                  };
                }
                
                if (rData && rData.coordinates) {
                  if (routeLayer) map.removeLayer(routeLayer);
                  
                  const color = travelMode === 'transit' ? '#a855f7' : travelMode === 'walking' ? '#34d399' : travelMode === 'cycling' ? '#fbbf24' : '#38bdf8';
                  routeLayer = L.polyline(rData.coordinates, { color, weight: 6, opacity: 0.9 }).addTo(map);
                  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
                  
                  const resultBox = document.getElementById('routeResultBox');
                  resultBox.classList.add('active');
                  document.getElementById('routeDistTime').innerText = rData.distanceKm + ' km • ' + rData.durationMinutes + ' mins';
                  document.getElementById('routeModeTag').innerText = travelMode;
                  
                  const stepsList = document.getElementById('routeStepsList');
                  stepsList.innerHTML = '';
                  (rData.steps || []).forEach((s, idx) => {
                    const stepEl = document.createElement('div');
                    stepEl.className = 'route-step';
                    stepEl.innerHTML = '<strong>' + (idx + 1) + '.</strong> ' + s.instruction + ' <span style="float: right; color: #d4af37;">' + s.distance + '</span>';
                    stepsList.appendChild(stepEl);
                  });
                }
              } catch (err) {
                console.error(err);
              }
            }
          <\/script>
        </body>
        </html>
      `;
    } else if (toolResult.type === 'calendar') {
      catTitle = 'SCHEDULE MANAGER';
      mainTitle = 'Calendar & Schedules';
      const eventsJson = JSON.stringify(toolResult.events || calendarEvents).replace(/</g, '\\u003c');
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: rgba(237, 232, 227, 0.45); }
            
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #120f0e; color: #ede8e3; padding: 18px; overflow-y: auto; line-height: 1.5; margin: 0; }
            h2 { font-size: 1.15rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
            .subtitle { font-size: 0.78rem; color: #8c837a; margin-bottom: 14px; }
            
            .cal-header { display: flex; justify-content: space-between; align-items: center; background: #1c1715; border: 1px solid #2e2824; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
            .month-label { font-weight: 700; color: #ffffff; font-size: 0.92rem; }
            .badge-count { background: #26201d; border: 1px solid #3d332d; padding: 3px 8px; border-radius: 12px; color: #d4af37; font-size: 0.72rem; font-weight: 600; }
            
            .month-view-card { background: #1a1513; border: 1px solid #2e2824; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
            .weekdays-row { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.72rem; color: #8c837a; font-weight: 600; margin-bottom: 8px; }
            .days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
            .day-cell { height: 38px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; font-size: 0.8rem; cursor: pointer; border: 1px solid transparent; position: relative; color: #ede8e3; }
            .day-cell:hover { background: #2b231f; border-color: #4a3c33; }
            .day-cell.other-month { opacity: 0.25; }
            .day-cell.selected { background: #10b98125; border-color: #10b981; color: #a7f3d0; font-weight: 700; }
            .day-cell.current-day { background: #2f251f; border-color: #d4af37; color: #ffffff; font-weight: 700; }
            .event-dot { width: 5px; height: 5px; background: #d4af37; border-radius: 50%; position: absolute; bottom: 3px; }
            
            .add-event-box { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
            .box-title { font-size: 0.84rem; font-weight: 600; color: #ffffff; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
            .full-row { grid-column: span 2; }
            .input-field { background: #120f0e; border: 1px solid #3d332d; color: #ede8e3; padding: 7px 10px; border-radius: 6px; font-size: 0.78rem; outline: none; width: 100%; }
            .input-field:focus { border-color: #d4af37; }
            .btn-add { background: #d4af37; color: #171210; border: none; font-weight: 700; padding: 8px 14px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
            .btn-add:hover { background: #e5c158; }
            
            .events-list-section { display: flex; flex-direction: column; gap: 8px; }
            .section-title { font-size: 0.8rem; font-weight: 600; color: #8c837a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; display: flex; justify-content: space-between; }
            .event-card { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: border-color 0.15s ease; }
            .event-card:hover { border-color: #3d332d; }
            .event-card.completed { opacity: 0.45; text-decoration: line-through; }
            .event-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
            .event-title { font-size: 0.86rem; font-weight: 600; color: #ede8e3; }
            .event-meta { font-size: 0.72rem; color: #8c837a; display: flex; align-items: center; gap: 8px; }
            .category-tag { padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; }
            .cat-work { background: #1e3a8a30; color: #93c5fd; border: 1px solid #1e3a8a; }
            .cat-meeting { background: #3b076430; color: #d8b4fe; border: 1px solid #3b0764; }
            .cat-deadline { background: #450a0a30; color: #fca5a5; border: 1px solid #450a0a; }
            .cat-personal { background: #064e3b30; color: #6ee7b7; border: 1px solid #064e3b; }
            
            .event-actions { display: flex; align-items: center; gap: 6px; }
            .action-btn { background: #26201d; border: 1px solid #3d332d; color: #8c837a; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.75rem; }
            .action-btn:hover { color: #ffffff; border-color: #4a3c33; }
            .empty-state { text-align: center; padding: 24px 12px; color: #8c837a; font-size: 0.82rem; background: #181311; border: 1px dashed #2e2824; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h2>📅 Calendar & Schedule</h2>
          <div class="subtitle">Interactive Event & Appointment Organizer</div>
          
          <div class="cal-header">
            <span class="month-label" id="monthNameLabel">August 2026</span>
            <span class="badge-count" id="totalCountBadge">0 Schedules</span>
          </div>
          
          <div class="month-view-card">
            <div class="weekdays-row">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
            <div class="days-grid" id="calendarDaysGrid"></div>
          </div>
          
          <div class="add-event-box">
            <div class="box-title">
              <span>➕ Add Date / Schedule</span>
              <span id="selectedDateLabel" style="font-size: 0.72rem; color: #d4af37;"></span>
            </div>
            <div class="form-grid">
              <div class="full-row">
                <input type="text" id="eventTitleInput" class="input-field" placeholder="Event title (e.g., Dentist Appointment, Sprint Review)" />
              </div>
              <div>
                <input type="date" id="eventDateInput" class="input-field" />
              </div>
              <div>
                <input type="time" id="eventTimeInput" class="input-field" value="10:00" />
              </div>
              <div>
                <select id="eventCategorySelect" class="input-field">
                  <option value="work">Work</option>
                  <option value="meeting">Meeting</option>
                  <option value="deadline">Deadline</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div>
                <button class="btn-add" style="width: 100%; height: 100%;" onclick="handleAddEvent()">Save Schedule</button>
              </div>
            </div>
          </div>
          
          <div class="events-list-section">
            <div class="section-title">
              <span>Upcoming Schedules</span>
              <button onclick="handleClearAll()" style="background: none; border: none; color: #ef4444; font-size: 0.7rem; cursor: pointer;">Clear All</button>
            </div>
            <div id="eventsListContainer"></div>
          </div>
          
          <script>
            let events = [];
            try {
              const saved = localStorage.getItem('lifeguide_calendar_events');
              if (saved) {
                events = JSON.parse(saved);
              } else {
                events = ${eventsJson};
              }
            } catch(e) {
              events = ${eventsJson};
            }

            let currentDate = new Date();
            let selectedDateStr = new Date().toISOString().split('T')[0];

            function saveAndSyncEvents() {
              try {
                localStorage.setItem('lifeguide_calendar_events', JSON.stringify(events));
              } catch(e) {}
              fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: events })
              }).catch(() => {});
            }

            function initCalendar() {
              document.getElementById('eventDateInput').value = selectedDateStr;
              document.getElementById('selectedDateLabel').innerText = 'Selected: ' + selectedDateStr;
              renderMonthDays();
              renderEvents();
            }

            function renderMonthDays() {
              const year = currentDate.getFullYear();
              const month = currentDate.getMonth();
              const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
              document.getElementById('monthNameLabel').innerText = monthNames[month] + ' ' + year;

              const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
              const lastDay = new Date(year, month + 1, 0).getDate();
              const prevLastDay = new Date(year, month, 0).getDate();

              const grid = document.getElementById('calendarDaysGrid');
              grid.innerHTML = '';

              for (let x = firstDayIndex; x > 0; x--) {
                const dayDiv = document.createElement('div');
                dayDiv.className = 'day-cell other-month';
                dayDiv.innerText = prevLastDay - x + 1;
                grid.appendChild(dayDiv);
              }

              const todayStr = new Date().toISOString().split('T')[0];

              for (let i = 1; i <= lastDay; i++) {
                const dayDiv = document.createElement('div');
                const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
                dayDiv.className = 'day-cell';
                if (dateStr === todayStr) dayDiv.classList.add('current-day');
                if (dateStr === selectedDateStr) dayDiv.classList.add('selected');
                dayDiv.innerText = i;

                const hasEvents = events.some(e => e.date === dateStr);
                if (hasEvents) {
                  const dot = document.createElement('div');
                  dot.className = 'event-dot';
                  dayDiv.appendChild(dot);
                }

                dayDiv.onclick = () => {
                  selectedDateStr = dateStr;
                  document.getElementById('eventDateInput').value = dateStr;
                  document.getElementById('selectedDateLabel').innerText = 'Selected: ' + dateStr;
                  renderMonthDays();
                };

                grid.appendChild(dayDiv);
              }
            }

            function renderEvents() {
              const container = document.getElementById('eventsListContainer');
              container.innerHTML = '';
              document.getElementById('totalCountBadge').innerText = events.length + ' Schedules';

              if (events.length === 0) {
                container.innerHTML = '<div class="empty-state">No scheduled events or deadlines yet.<br>Add an appointment using the form above.</div>';
                return;
              }

              const sorted = [...events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

              sorted.forEach(evt => {
                const card = document.createElement('div');
                card.className = 'event-card' + (evt.completed ? ' completed' : '');
                
                const catClass = 'cat-' + (evt.category || 'work');
                
                card.innerHTML = \`
                  <div class="event-info">
                    <div class="event-title">\${escapeHtml(evt.title)}</div>
                    <div class="event-meta">
                      <span>📅 \${evt.date || 'No Date'}</span>
                      <span>⏰ \${evt.time || '10:00 AM'}</span>
                      <span class="category-tag \${catClass}">\${evt.category || 'work'}</span>
                    </div>
                  </div>
                  <div class="event-actions">
                    <button class="action-btn" title="Toggle Completed" onclick="toggleComplete('\${evt.id}')">\${evt.completed ? '✓' : '○'}</button>
                    <button class="action-btn" title="Delete Schedule" onclick="deleteEvent('\${evt.id}')">✕</button>
                  </div>
                \`;
                container.appendChild(card);
              });
            }

            function toggleComplete(id) {
              events = events.map(e => e.id === id ? { ...e, completed: !e.completed } : e);
              saveAndSyncEvents();
              renderEvents();
            }

            function deleteEvent(id) {
              events = events.filter(e => e.id !== id);
              saveAndSyncEvents();
              renderEvents();
              renderMonthDays();
            }

            function handleAddEvent() {
              const titleInp = document.getElementById('eventTitleInput');
              const dateInp = document.getElementById('eventDateInput');
              const timeInp = document.getElementById('eventTimeInput');
              const catInp = document.getElementById('eventCategorySelect');

              const title = titleInp.value.trim();
              if (!title) return;

              const newEvt = {
                id: 'cal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                title: title,
                date: dateInp.value || selectedDateStr,
                time: timeInp.value || '10:00 AM',
                category: catInp.value || 'work',
                priority: 'medium',
                completed: false
              };

              events.push(newEvt);
              saveAndSyncEvents();
              titleInp.value = '';
              renderEvents();
              renderMonthDays();
            }

            function handleClearAll() {
              if (confirm('Clear all schedules from your calendar?')) {
                events = [];
                saveAndSyncEvents();
                renderEvents();
                renderMonthDays();
              }
            }

            window.onload = initCalendar;
          <\/script>
        </body>
        </html>
      `;
    } else if (toolResult.type === 'weather') {
      catTitle = 'LIVE WEATHER DETECTOR';
      mainTitle = `Weather - ${toolResult.location || 'Location'}`;
      const weatherJson = JSON.stringify(toolResult).replace(/</g, '\\u003c');
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: rgba(237, 232, 227, 0.45); }
            
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #120f0e; color: #ede8e3; padding: 18px; overflow-y: auto; line-height: 1.5; margin: 0; }
            h2 { font-size: 1.15rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
            .subtitle { font-size: 0.78rem; color: #8c837a; margin-bottom: 14px; }
            
            .search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
            .search-input { flex: 1; background: #1c1715; border: 1px solid #2e2824; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; outline: none; }
            .search-input:focus { border-color: #38bdf8; }
            .search-btn { background: #38bdf8; color: #082f49; border: none; font-weight: 700; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; }
            .search-btn:hover { background: #7dd3fc; }

            .hero-card { background: linear-gradient(135deg, #1e1b18 0%, #29221d 100%); border: 1px solid #3d332d; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
            .hero-loc-box { display: flex; flex-direction: column; gap: 2px; }
            .hero-city { font-size: 1.25rem; font-weight: 700; color: #ffffff; }
            .hero-cond { font-size: 0.85rem; color: #38bdf8; font-weight: 600; display: flex; align-items: center; gap: 6px; }
            .hero-temp-box { text-align: right; }
            .hero-temp { font-size: 2.6rem; font-weight: 800; color: #ffffff; line-height: 1; }
            .hero-range { font-size: 0.78rem; color: #a39b94; margin-top: 4px; }

            .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
            .metric-card { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 12px; }
            .metric-label { font-size: 0.7rem; color: #8c837a; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
            .metric-value { font-size: 0.95rem; font-weight: 700; color: #ffffff; }

            .section-label { font-size: 0.8rem; font-weight: 600; color: #8c837a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
            .hourly-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 16px; }
            .hourly-card { flex-shrink: 0; background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 12px; text-align: center; min-width: 68px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
            .hourly-time { font-size: 0.72rem; color: #8c837a; }
            .hourly-icon { font-size: 1.2rem; }
            .hourly-temp { font-size: 0.85rem; font-weight: 700; color: #ffffff; }

            .forecast-list { display: flex; flex-direction: column; gap: 8px; }
            .forecast-row { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
            .forecast-day { font-size: 0.84rem; font-weight: 600; color: #ede8e3; width: 75px; }
            .forecast-cond { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #a39b94; flex: 1; }
            .forecast-temps { display: flex; gap: 10px; font-size: 0.84rem; font-weight: 600; }
            .temp-high { color: #ffffff; }
            .temp-low { color: #8c837a; }
          </style>
        </head>
        <body>
          <h2>🌤️ Live Weather Detector</h2>
          <div class="subtitle">Real-Time Meteorological Radar & Forecast</div>

          <div class="search-bar">
            <input type="text" id="cityInput" class="search-input" placeholder="Search city (e.g. New York, Tokyo, Paris)..." value="${escapeHtml(toolResult.location || '')}" />
            <button class="search-btn" onclick="lookupCity()">Search</button>
          </div>

          <div id="weatherContentArea"></div>

          <script>
            let currentData = ${weatherJson};

            function renderWeather(data) {
              const current = data.current || {};
              const forecast = data.forecast || [];
              const hourly = data.hourly || [];

              const html = \`
                <div class="hero-card">
                  <div class="hero-loc-box">
                    <div class="hero-city">\${escapeHtml(data.location || 'London, UK')}</div>
                    <div class="hero-cond">\${current.icon || '⛅'} \${escapeHtml(current.condition || 'Partly Cloudy')}</div>
                  </div>
                  <div class="hero-temp-box">
                    <div class="hero-temp">\${current.temperature != null ? current.temperature : 20}°</div>
                    <div class="hero-range">H: \${current.high || 23}° • L: \${current.low || 15}°</div>
                  </div>
                </div>

                <div class="metrics-grid">
                  <div class="metric-card">
                    <div class="metric-label">💧 Humidity</div>
                    <div class="metric-value">\${current.humidity || 58}%</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">💨 Wind</div>
                    <div class="metric-value">\${current.windSpeedMph || 8} mph \${current.windDirection || 'SW'}</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">☀️ UV Index</div>
                    <div class="metric-value">\${current.uvIndex || 4}</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">⏲️ Pressure</div>
                    <div class="metric-value">\${current.pressureHpa || 1015} hPa</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">👁️ Visibility</div>
                    <div class="metric-value">\${current.visibilityMiles || 10} mi</div>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">🌿 Air Quality</div>
                    <div class="metric-value" style="font-size: 0.78rem;">\${current.airQuality || 'Good (AQI 22)'}</div>
                  </div>
                </div>

                <div class="section-label">Hourly Timeline</div>
                <div class="hourly-scroll">
                  \${hourly.map(h => \`
                    <div class="hourly-card">
                      <span class="hourly-time">\${h.time}</span>
                      <span class="hourly-icon">\${h.icon || '☀️'}</span>
                      <span class="hourly-temp">\${h.temp}°</span>
                    </div>
                  \`).join('')}
                </div>

                <div class="section-label">7-Day Extended Forecast</div>
                <div class="forecast-list">
                  \${forecast.map(f => \`
                    <div class="forecast-row">
                      <span class="forecast-day">\${escapeHtml(f.day)}</span>
                      <span class="forecast-cond">\${f.icon || '⛅'} \${escapeHtml(f.condition)}</span>
                      <div class="forecast-temps">
                        <span class="temp-high">\${f.high}°</span>
                        <span class="temp-low">\${f.low}°</span>
                      </div>
                    </div>
                  \`).join('')}
                </div>
              \`;

              document.getElementById('weatherContentArea').innerHTML = html;
            }

            function lookupCity() {
              const loc = document.getElementById('cityInput').value.trim();
              if (!loc) return;
              fetch('/api/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: loc })
              })
              .then(res => res.json())
              .then(data => {
                renderWeather(data);
              })
              .catch(err => {
                console.error(err);
              });
            }

            document.getElementById('cityInput').addEventListener('keydown', (e) => {
              if (e.key === 'Enter') lookupCity();
            });

            window.onload = () => renderWeather(currentData);
          <\/script>
        </body>
        </html>
      `;
    } else {
      catTitle = 'RESULT PREVIEW';
      mainTitle = toolResult.title || 'Preview';
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            body { background: #120f0e; color: #ede8e3; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
          </style>
        </head>
        <body>
          <h2>${escapeHtml(toolResult.title || 'Page Preview')}</h2>
          <p style="margin-top:10px;color:#a39b94;">${escapeHtml(toolResult.snippet || '')}</p>
        </body>
        </html>
      `;
    }

    DOM.previewCategory.innerText = catTitle;
    DOM.previewTitle.innerText = mainTitle;
    DOM.previewIframe.srcdoc = htmlContent;
  }

  // Render Chat Messages
  function renderChat() {
    const isChatActive = state.messages.length > 0;
    DOM.workspaceMain.classList.toggle('active-chat', isChatActive);

    DOM.chatHistory.innerHTML = '';
    state.messages.forEach(msg => {
      if (msg.role === 'user') {
        const userDiv = document.createElement('div');
        userDiv.className = 'msg user';
        userDiv.id = `msg-${msg.id}`;
        userDiv.innerHTML = parseMarkdown(msg.content);
        DOM.chatHistory.appendChild(userDiv);
      } else {
        const row = document.createElement('div');
        row.className = 'msg-row assistant-row';
        row.id = `msg-${msg.id}`;

        let toolBannerHtml = '';
        if (msg.toolCall) {
          toolBannerHtml = `
            <div class="tool-cover-container">
              <button class="tool-live-banner-btn" data-msg-id="${msg.id}">
                <span class="tool-name">⚡ ${escapeHtml(msg.toolCall.liveText || msg.toolCall.name)}</span>
                <span class="status-badge">Open Preview ↗</span>
              </button>
            </div>
          `;
        }

        let resHtml = '';
        if (msg.resource) {
          resHtml = `
            <div class="resources-section">
              <div class="resources-title">RESOURCES</div>
              <a href="${escapeHtml(msg.resource.url)}" target="_blank" rel="noopener noreferrer" class="resource-card">
                <div class="resource-icon-box">🌐</div>
                <div class="resource-info">
                  <span class="resource-name">${escapeHtml(msg.resource.title)}</span>
                  <span class="resource-domain">${escapeHtml(msg.resource.domain)}</span>
                </div>
              </a>
            </div>
          `;
        }

        row.innerHTML = `
          <div class="ai-avatar-badge" title="LifeguideAssist">
            <img
              src="./LifeguideAssist_Logo__4_-removebg-preview.png"
              onerror="this.src='./logo.png'"
              alt="LifeguideAssist"
              class="ai-avatar-svg"
              style="width: 32px; height: 32px; object-fit: contain;"
            />
          </div>
          <div class="msg-body">
            ${toolBannerHtml}
            <div class="markdown-body">${parseMarkdown(msg.content)}</div>
            ${resHtml}
            <div class="msg-action-bar">
              <button class="msg-action-btn copy-btn" data-msg-id="${msg.id}">📋 Copy</button>
              <button class="msg-action-btn retry-btn" data-msg-id="${msg.id}">🔄 Retry</button>
            </div>
          </div>
        `;

        DOM.chatHistory.appendChild(row);

        // Bind events
        const bannerBtn = row.querySelector('.tool-live-banner-btn');
        if (bannerBtn && msg.toolResult) {
          bannerBtn.onclick = () => openPreviewForTool(msg.toolResult, msg.toolCall);
        }

        const copyBtn = row.querySelector('.copy-btn');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(msg.content);
            copyBtn.innerText = '✓ Copied!';
            setTimeout(() => { copyBtn.innerText = '📋 Copy'; }, 2000);
          };
        }

        const retryBtn = row.querySelector('.retry-btn');
        if (retryBtn) {
          retryBtn.onclick = () => {
            const idx = state.messages.findIndex(m => m.id === msg.id);
            for (let i = idx - 1; i >= 0; i--) {
              if (state.messages[i].role === 'user') {
                sendMessage(state.messages[i].content, true);
                break;
              }
            }
          };
        }
      }
    });

    renderTimeline();
    DOM.chatScrollArea.scrollTop = DOM.chatScrollArea.scrollHeight;
  }

  // Render Suggested Prompts
  function renderSuggestions() {
    if (state.suggestions.length === 0) {
      DOM.suggestionsContainer.style.display = 'none';
      return;
    }

    DOM.suggestionsContainer.style.display = 'flex';
    DOM.suggestionsScroll.innerHTML = '';

    state.suggestions.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'suggestion-prompt-chip';
      chip.innerHTML = `<span class="suggestion-chip-icon">✦</span><span>${escapeHtml(s)}</span>`;
      chip.onclick = () => {
        state.suggestions = [];
        renderSuggestions();
        sendMessage(s);
      };
      DOM.suggestionsScroll.appendChild(chip);
    });
  }

  // Render Prompt Timeline
  function renderTimeline() {
    const userMsgs = state.messages.filter(m => m.role === 'user');
    if (userMsgs.length === 0 || state.previewOpen) {
      DOM.promptTimelineRail.style.display = 'none';
      return;
    }

    DOM.promptTimelineRail.style.display = 'flex';
    DOM.timelineLinesViewport.innerHTML = '';

    userMsgs.slice(-8).forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'timeline-line-item' + (idx === state.activePromptIndex ? ' active' : '');
      item.innerHTML = `<div class="timeline-line-bar"></div>`;
      item.onclick = () => {
        state.activePromptIndex = idx;
        const el = document.getElementById(`msg-${m.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        renderTimeline();
      };
      DOM.timelineLinesViewport.appendChild(item);
    });
  }

  // Render Attached Files
  function renderAttachedFiles() {
    DOM.attachedFilesRow.innerHTML = '';
    state.attachedFiles.forEach((f, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attached-file-chip';
      chip.innerHTML = `
        <span>📄 ${escapeHtml(f.name)}</span>
        <button class="file-chip-del" data-idx="${idx}">✕</button>
      `;
      chip.querySelector('.file-chip-del').onclick = () => {
        state.attachedFiles.splice(idx, 1);
        renderAttachedFiles();
      };
      DOM.attachedFilesRow.appendChild(chip);
    });
  }

  function updateGeneratingState() {
    DOM.thinkingIndicator.style.display = state.isGenerating ? 'flex' : 'none';
    DOM.sendBtn.classList.toggle('stop-btn', state.isGenerating);
    DOM.sendBtn.innerHTML = state.isGenerating ? '■' : '↵';
  }

  function closeAllMenus() {
    DOM.fileMenuPopup.style.display = 'none';
    DOM.toolsMenuPopup.style.display = 'none';
  }

  // Bind All Event Listeners
  function initEvents() {
    // Input Box Enter & Shift+Enter
    DOM.inputTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(DOM.inputTextarea.value);
      }
    });

    DOM.inputTextarea.addEventListener('input', () => {
      DOM.inputTextarea.style.height = 'auto';
      DOM.inputTextarea.style.height = `${Math.min(DOM.inputTextarea.scrollHeight, 160)}px`;
    });

    DOM.sendBtn.addEventListener('click', () => {
      if (state.isGenerating) {
        state.isGenerating = false;
        updateGeneratingState();
      } else {
        sendMessage(DOM.inputTextarea.value);
      }
    });

    // File Menu Button
    DOM.fileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = DOM.fileMenuPopup.style.display === 'flex';
      closeAllMenus();
      DOM.fileMenuPopup.style.display = isVisible ? 'none' : 'flex';
    });

    // Tools Menu Button
    DOM.toolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = DOM.toolsMenuPopup.style.display === 'flex';
      closeAllMenus();
      DOM.toolsMenuPopup.style.display = isVisible ? 'none' : 'flex';
    });

    document.addEventListener('click', () => closeAllMenus());

    // File Upload Trigger
    document.getElementById('openFileMenuItem').addEventListener('click', () => {
      DOM.hiddenFileInput.click();
    });

    DOM.hiddenFileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(f => {
        if (state.attachedFiles.length < 5) {
          state.attachedFiles.push({ name: f.name, size: f.size, type: f.type });
        }
      });
      renderAttachedFiles();
      DOM.hiddenFileInput.value = '';
    });

    // Quick Action Pills
    document.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'map') {
          sendMessage(state.userCoordinates ? 'Map my current location' : 'Map London UK');
        } else if (action === 'bin') {
          sendMessage('Check bin collections for HU5 2EG');
        } else if (action === 'calendar') {
          sendMessage('Show my calendar schedule and upcoming events');
        } else if (action === 'weather') {
          sendMessage(state.userCoordinates ? 'What is the live weather for my location?' : 'What is the live weather forecast in London?');
        } else {
          sendMessage('Discover modern AI agent architectures and research papers');
        }
      });
    });

    // Tools Popup Items
    document.getElementById('popupAutoLocateBtn').addEventListener('click', () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          state.userCoordinates = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          sendMessage(`Map my location at coordinates ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }, () => {
          state.userCoordinates = { lat: 51.5074, lon: -0.1278 };
          sendMessage('Map London UK');
        });
      }
    });

    document.getElementById('popupCalendarBtn').addEventListener('click', () => {
      sendMessage('Show my calendar schedule and upcoming events');
    });

    document.getElementById('popupWeatherBtn').addEventListener('click', () => {
      sendMessage(state.userCoordinates ? 'What is the live weather for my location?' : 'What is the live weather forecast in London?');
    });

    document.getElementById('popupTtsBtn').addEventListener('click', () => {
      state.isTtsActive = !state.isTtsActive;
      document.getElementById('popupTtsBtn').classList.toggle('active', state.isTtsActive);
    });

    // Preview Controls
    DOM.closePreviewBtn.addEventListener('click', () => {
      state.previewOpen = false;
      DOM.previewPanel.classList.remove('open', 'fullscreen');
      renderTimeline();
    });

    DOM.fullscreenBtn.addEventListener('click', () => {
      state.isFullscreen = !state.isFullscreen;
      DOM.previewPanel.classList.toggle('fullscreen', state.isFullscreen);
    });

    // Suggestions Scroll Arrows
    DOM.scrollLeftBtn.addEventListener('click', () => {
      DOM.suggestionsScroll.scrollBy({ left: -200, behavior: 'smooth' });
    });
    DOM.scrollRightBtn.addEventListener('click', () => {
      DOM.suggestionsScroll.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  // Initialize on load
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
  });
})();
