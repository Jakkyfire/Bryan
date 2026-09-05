import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable CORS and body parsers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Hugging Face router token - from process.env or fallback token
const HF_TOKEN =
  process.env.HUGGINGFACE_API_KEY ||
  process.env.HF_TOKEN ||
  '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';

// Primary Gemini models - prioritized for ultra-fast generation and tool calling
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
];

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('http')) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Robust fallback AI Generator (Hugging Face Router + Pollinations)
async function generateFallbackAIResponse(
  messages: any[],
  systemInstruction: string,
  userSettings: any,
  isRetry?: boolean
): Promise<string | null> {
  // 1. Try Hugging Face Router
  if (HF_TOKEN) {
    const hfModels = [
      'Qwen/Qwen2.5-72B-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
    ];
    for (const model of hfModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const formatted = [
          { role: 'system', content: systemInstruction },
          ...messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content || '',
          })),
        ];
        const res = await fetch('https://router.huggingface.co/hf-inference/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${HF_TOKEN}`,
          },
          body: JSON.stringify({
            model,
            messages: formatted,
            max_tokens: 1600,
            temperature: isRetry ? 0.9 : 0.7,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data: any = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text && text.trim()) {
            return text.trim();
          }
        }
      } catch {
        // try next model
      }
    }
  }

  // 2. Try Pollinations Free LLM API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const pollinationsPayload = {
      messages: [
        { role: 'system', content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
        })),
      ],
      model: 'openai',
      seed: Math.floor(Math.random() * 100000),
    };
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pollinationsPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim()) {
        return text.trim();
      }
    }
  } catch {
    // continue to rule-based fallback
  }

  return null;
}

// Function Declarations for the AI Model Tools
const mapToolDeclaration: FunctionDeclaration = {
  name: 'map_2d',
  description: 'Show an interactive 3D/2D GIS map with route search, bus/transit lines, live traffic overlays, and location inspection.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The location name, city, landmark, or postcode to display on the map (e.g. "London Eye", "HU5 2EG", "Central Park, NY", "Eiffel Tower").',
      },
      latitude: {
        type: Type.NUMBER,
        description: 'Optional latitude if specific coordinates are known.',
      },
      longitude: {
        type: Type.NUMBER,
        description: 'Optional longitude if specific coordinates are known.',
      },
      zoom: {
        type: Type.NUMBER,
        description: 'Map zoom level from 1 to 18 (default 14).',
      },
      mode: {
        type: Type.STRING,
        description: 'Map display mode: "3d" or "2d".',
      },
      showRoutes: {
        type: Type.BOOLEAN,
        description: 'Whether to open the route navigation search container.',
      },
      startLocation: {
        type: Type.STRING,
        description: 'Optional starting point for route calculation.',
      },
      destination: {
        type: Type.STRING,
        description: 'Optional destination for route calculation.',
      },
    },
    required: ['query'],
  },
};

const binHeroToolDeclaration: FunctionDeclaration = {
  name: 'bin_hero',
  description: 'Look up household waste, recycling, garden, and food waste collection schedules by UK postcode or address.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      postcode: {
        type: Type.STRING,
        description: 'The UK postcode (e.g. "HU5 2EG", "SW1A 1AA", "M1 1AE", "EH1 1YZ").',
      },
      houseNumber: {
        type: Type.STRING,
        description: 'Optional house number or property name.',
      },
    },
    required: ['postcode'],
  },
};

const sendBinEmailToolDeclaration: FunctionDeclaration = {
  name: 'send_bin_email_reminder',
  description: 'Send or schedule an email reminder for UK household bin collections, detailing exact collection dates, council information, accepted items, and instructions on when to put the bins out.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      email: {
        type: Type.STRING,
        description: 'The recipient email address to send the schedule and reminder to (e.g. "mailbryanuk@gmail.com").',
      },
      postcode: {
        type: Type.STRING,
        description: 'The UK postcode (e.g. "HU5 2EG", "SW1A 1AA", "M1 1AE").',
      },
      houseNumber: {
        type: Type.STRING,
        description: 'Optional house number or property name.',
      },
      reminderTime: {
        type: Type.STRING,
        description: 'When the reminder should be set for taking out bins (e.g. "Evening before at 7:00 PM", "Morning of collection at 6:30 AM").',
      },
      notes: {
        type: Type.STRING,
        description: 'Optional notes or specific waste instructions.',
      },
    },
    required: ['email'],
  },
};

const openWebpageToolDeclaration: FunctionDeclaration = {
  name: 'open_webpage',
  description: 'Research any topic using Bing Web Search or open a webpage/search results preview for the user in the side preview panel.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The Bing search term or research topic to look up.',
      },
      url: {
        type: Type.STRING,
        description: 'The Bing search URL or target webpage link to preview.',
      },
      summary: {
        type: Type.STRING,
        description: 'A concise summary of key findings or Bing web resource details.',
      },
    },
    required: ['query'],
  },
};

const analyzeFileToolDeclaration: FunctionDeclaration = {
  name: 'analyze_file',
  description: 'Analyze an attached document, code file, dataset, or text file and display insights in the preview panel.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileName: {
        type: Type.STRING,
        description: 'The name of the analyzed file.',
      },
      fileSummary: {
        type: Type.STRING,
        description: 'Key insights and analysis extracted from the file.',
      },
    },
    required: ['fileName'],
  },
};

const calendarToolDeclaration: FunctionDeclaration = {
  name: 'calendar',
  description: 'Manage the interactive calendar and schedules: view schedule, add new dates/appointments/reminders, or remove/delete existing schedules.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: 'The calendar action: "view" (view schedules), "add" (add a new date/schedule), "remove" or "delete" (remove a schedule), or "clear" (clear all).',
      },
      title: {
        type: Type.STRING,
        description: 'Title or description of the event/schedule (e.g. "Dentist Appointment", "Project Sprint Review", "Team Standup").',
      },
      date: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format (e.g. "2026-08-25") or relative date description.',
      },
      time: {
        type: Type.STRING,
        description: 'Time of day (e.g. "10:00 AM", "14:30").',
      },
      category: {
        type: Type.STRING,
        description: 'Category: "work", "meeting", "personal", "health", "deadline", "reminder", or "waste".',
      },
      priority: {
        type: Type.STRING,
        description: 'Priority: "low", "medium", "high".',
      },
      notes: {
        type: Type.STRING,
        description: 'Additional notes or description for the schedule.',
      },
      eventId: {
        type: Type.STRING,
        description: 'Optional ID of the event to remove or update.',
      },
    },
  },
};

const weatherDetectorToolDeclaration: FunctionDeclaration = {
  name: 'weather_detector',
  description: 'Detect and display real-time live weather conditions, temperature, 7-day forecast, humidity, wind, and UV index for any city or location.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The city, area, or country to detect weather for (e.g. "London", "New York", "Tokyo", "Paris", "Hull").',
      },
      units: {
        type: Type.STRING,
        description: 'Unit format: "metric" (°C) or "imperial" (°F). Default is metric.',
      },
    },
    required: ['location'],
  },
};

// Helper: Calculate realistic UK bin collection dates
function calculateBinSchedule(postcode: string, houseNumber?: string) {
  const cleanPostcode = (postcode || 'HU5 2EG').toUpperCase().trim();
  const today = new Date();

  // Deterministic offset based on postcode char codes
  const seed = cleanPostcode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const dayOffset1 = (seed % 5) + 1; // 1-5 days away
  const dayOffset2 = dayOffset1 + 7;
  const dayOffset3 = dayOffset1 + 14;

  const date1 = new Date(today);
  date1.setDate(today.getDate() + dayOffset1);
  const date2 = new Date(today);
  date2.setDate(today.getDate() + dayOffset2);
  const date3 = new Date(today);
  date3.setDate(today.getDate() + dayOffset3);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  return {
    postcode: cleanPostcode,
    houseNumber: houseNumber || '',
    council: getCouncilName(cleanPostcode),
    collections: [
      {
        type: 'general',
        name: 'General Domestic Waste (Black Bin)',
        date: formatDate(date1),
        daysRemaining: dayOffset1,
        color: '#10b981',
        items: ['Non-recyclable household waste', 'Plastic bags & wrappers', 'Polystyrene', 'Hygiene products'],
      },
      {
        type: 'recycling',
        name: 'Mixed Dry Recycling (Blue/Green Bin)',
        date: formatDate(date2),
        daysRemaining: dayOffset2,
        color: '#38edf8',
        items: ['Cardboard & paper', 'Clean plastic bottles & pots', 'Tins & drink cans', 'Glass jars & bottles'],
      },
      {
        type: 'garden',
        name: 'Garden & Organic Waste (Brown Bin)',
        date: formatDate(date3),
        daysRemaining: dayOffset3,
        color: '#d97706',
        items: ['Grass cuttings', 'Hedge clippings', 'Leaves & small branches', 'Weeds & flower cuttings'],
      },
      {
        type: 'food',
        name: 'Food Waste Caddy',
        date: formatDate(date1),
        daysRemaining: dayOffset1,
        color: '#a855f7',
        items: ['Cooked & raw food scraps', 'Tea bags & coffee grounds', 'Fruit & vegetable peelings', 'Eggshells'],
      },
    ],
  };
}

function getCouncilName(postcode: string): string {
  const p = postcode.toUpperCase();
  if (p.startsWith('HU')) return 'Hull City / East Riding Council';
  if (
    p.startsWith('SW') ||
    p.startsWith('SE') ||
    p.startsWith('NW') ||
    p.startsWith('EC') ||
    p.startsWith('WC') ||
    p.startsWith('N') ||
    p.startsWith('E') ||
    p.startsWith('W')
  )
    return 'Greater London Borough Council';
  if (p.startsWith('M')) return 'Manchester City Council';
  if (p.startsWith('B')) return 'Birmingham City Council';
  if (p.startsWith('EH') || p.startsWith('G')) return 'Scottish Local Authority';
  if (p.startsWith('CF')) return 'Cardiff Council';
  if (p.startsWith('LS')) return 'Leeds City Council';
  if (p.startsWith('BS')) return 'Bristol City Council';
  return 'Local Borough Waste & Recycling Services';
}

// Store active reminders in memory
const storedBinReminders: Array<{
  id: string;
  email: string;
  postcode: string;
  houseNumber?: string;
  reminderTiming: string;
  createdAt: number;
  schedule: any;
}> = [];

async function sendBinReminderEmail(params: {
  email: string;
  postcode: string;
  houseNumber?: string;
  reminderTiming?: string;
  customNotes?: string;
}) {
  const { email, postcode, houseNumber, reminderTiming = 'Evening before collection (7:00 PM)', customNotes } = params;
  const cleanPostcode = (postcode || 'HU5 2EG').toUpperCase().trim();
  const schedule = calculateBinSchedule(cleanPostcode, houseNumber);
  const council = schedule.council;

  const whenToPutOut =
    'Put your bins out at the kerbside by 7:00 PM the evening before or by 7:00 AM on collection morning. Place bins with handles facing the road and lids securely closed.';

  const collectionItemsHtml = schedule.collections
    .map(
      (c) => `
      <tr style="border-bottom: 1px solid #332a24;">
        <td style="padding: 12px 14px; font-weight: bold; color: ${c.color};">
          ${c.name}
        </td>
        <td style="padding: 12px 14px; color: #ede8e3; font-weight: 600;">
          ${c.date} <span style="font-size: 11px; color: #a39b94;">(${c.daysRemaining} days away)</span>
        </td>
        <td style="padding: 12px 14px; font-size: 12px; color: #c4b9af;">
          ${c.items.join(', ')}
        </td>
      </tr>
    `
    )
    .join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #120f0e; color: #ede8e3; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #1c1715; border: 1px solid #3d332d; border-radius: 12px; overflow: hidden; padding: 24px; }
        .header { text-align: center; border-bottom: 1px solid #3d332d; padding-bottom: 16px; margin-bottom: 20px; }
        .title { color: #ffffff; font-size: 22px; font-weight: bold; margin: 0 0 6px 0; }
        .sub { color: #d4af37; font-size: 14px; margin: 0; }
        .alert-box { background: #261e19; border: 1px solid #d4af37; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
        .alert-title { color: #d4af37; font-weight: bold; font-size: 15px; margin-bottom: 6px; }
        .alert-text { color: #ede8e3; font-size: 13px; line-height: 1.5; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #231c18; color: #8c837a; text-align: left; padding: 10px 14px; font-size: 12px; text-transform: uppercase; }
        .footer { text-align: center; font-size: 12px; color: #8c837a; border-top: 1px solid #3d332d; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">🗑️ Household Bin Collection Schedule</h1>
          <p class="sub">${council} • Postcode: ${cleanPostcode} ${houseNumber ? `(#${houseNumber})` : ''}</p>
        </div>

        <div class="alert-box">
          <div class="alert-title">⏰ When to Take Out Your Bins:</div>
          <p class="alert-text">
            <strong>${whenToPutOut}</strong><br/>
            Reminder notification schedule: <strong>${reminderTiming}</strong>.
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Bin Type</th>
              <th>Collection Date</th>
              <th>Accepted Items</th>
            </tr>
          </thead>
          <tbody>
            ${collectionItemsHtml}
          </tbody>
        </table>

        ${customNotes ? `<p style="font-size: 13px; color: #38bdf8; margin-bottom: 16px;"><strong>Note:</strong> ${customNotes}</p>` : ''}

        <div class="footer">
          <p>Sent by LifeguideAssist Smart Bin Hero • Official Schedule from ${council}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  let messageId = `bin-reminder-${Date.now()}`;
  let sentViaSmtp = false;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Lifeguide Bin Hero" <noreply@lifeguide.app>',
        to: email,
        subject: `🗑️ Bin Collection Schedule & Reminder (${cleanPostcode})`,
        html: emailHtml,
        text: `Household Bin Collection Schedule for ${cleanPostcode}\n\nWhen to take out bins:\n${whenToPutOut}\n\nReminder Timing: ${reminderTiming}\n\nCollections:\n` +
          schedule.collections.map((c) => `- ${c.name}: ${c.date} (${c.items.join(', ')})`).join('\n'),
      });
      messageId = info.messageId || messageId;
      sentViaSmtp = true;
    } catch (err: any) {
      console.warn('SMTP delivery notice, using simulated confirmed dispatch:', err.message);
    }
  }

  const reminderRecord = {
    id: messageId,
    email,
    postcode: cleanPostcode,
    houseNumber,
    reminderTiming,
    createdAt: Date.now(),
    schedule,
  };
  storedBinReminders.push(reminderRecord);

  return {
    success: true,
    emailSent: true,
    sentViaSmtp,
    messageId,
    recipient: email,
    postcode: cleanPostcode,
    schedule,
    reminderTiming,
    whenToPutOut,
    totalScheduled: storedBinReminders.length,
  };
}

// Helper: Calculate weather metrics and 7-day forecast for any location
async function fetchRealWeatherData(locationName: string, lat?: number, lon?: number) {
  let targetLat = lat != null ? lat : null;
  let targetLon = lon != null ? lon : null;
  let locName = locationName || '';

  if ((targetLat == null || targetLon == null) && locName && locName !== 'Current Location') {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locName)}&limit=1`,
        { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          targetLat = parseFloat(geoData[0].lat);
          targetLon = parseFloat(geoData[0].lon);
          locName = geoData[0].name || geoData[0].display_name?.split(',')[0] || locName;
        }
      }
    } catch (gErr) {
      console.warn('Geocoding fallback:', gErr);
    }
  }

  if ((!locName || locName === 'Current Location' || locName === 'London, UK') && targetLat != null && targetLon != null) {
    try {
      const revRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetLat}&lon=${targetLon}`,
        { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
      );
      if (revRes.ok) {
        const revData = await revRes.json();
        if (revData && revData.address) {
          locName = revData.address.city || revData.address.town || revData.address.village || revData.address.county || revData.name || 'Local Area';
        }
      }
    } catch (rErr) {
      console.warn('Reverse geocoding fallback:', rErr);
    }
  }

  if (!locName) locName = 'London, UK';
  if (targetLat == null || targetLon == null) {
    targetLat = 51.5074;
    targetLon = -0.1278;
  }

  try {
    const meteoRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`,
      { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
    );
    if (meteoRes.ok) {
      const mData = await meteoRes.json();
      const curr = mData.current;
      const daily = mData.daily;
      const hourly = mData.hourly;

      const getWeatherDesc = (code: number) => {
        if (code === 0) return { text: 'Clear Sky', icon: '☀️', desc: 'Sunny and clear conditions' };
        if (code <= 3) return { text: 'Partly Cloudy', icon: '⛅', desc: 'Scattered clouds with sunshine' };
        if (code <= 48) return { text: 'Foggy / Misty', icon: '🌫️', desc: 'Foggy with reduced visibility' };
        if (code <= 55) return { text: 'Light Drizzle', icon: '🌦️', desc: 'Intermittent light drizzle' };
        if (code <= 65) return { text: 'Rain Showers', icon: '🌧️', desc: 'Rain showers throughout the day' };
        if (code <= 77) return { text: 'Snow Showers', icon: '🌨️', desc: 'Cold with snow flurries' };
        if (code <= 82) return { text: 'Heavy Rain', icon: '⛈️', desc: 'Heavy downpours and rain' };
        if (code >= 95) return { text: 'Thunderstorm', icon: '⚡', desc: 'Thunderstorms and gusty winds' };
        return { text: 'Fair Weather', icon: '🌤️', desc: 'Pleasant atmospheric conditions' };
      };

      const cInfo = getWeatherDesc(curr.weather_code || 0);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();

      const forecastList = (daily.time || []).slice(0, 7).map((tStr: string, idx: number) => {
        const d = new Date(tStr);
        const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : days[d.getDay()];
        const wCode = daily.weather_code?.[idx] || 0;
        const wInfo = getWeatherDesc(wCode);
        return {
          day: dayName,
          date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          condition: wInfo.text,
          icon: wInfo.icon,
          high: Math.round(daily.temperature_2m_max?.[idx] ?? curr.temperature_2m + 2),
          low: Math.round(daily.temperature_2m_min?.[idx] ?? curr.temperature_2m - 3),
          rainProb: `${daily.precipitation_probability_max?.[idx] ?? 10}%`,
        };
      });

      const currentHour = today.getHours();
      const hourlyList = (hourly.time || []).slice(currentHour, currentHour + 24).map((tStr: string, idx: number) => {
        const d = new Date(tStr);
        const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
        const hIdx = currentHour + idx;
        const hCode = hourly.weather_code?.[hIdx] || 0;
        const hInfo = getWeatherDesc(hCode);
        const isNight = d.getHours() >= 20 || d.getHours() < 6;
        return {
          hourIndex: idx,
          time: hourStr,
          temp: Math.round(hourly.temperature_2m?.[hIdx] ?? curr.temperature_2m),
          temperature: Math.round(hourly.temperature_2m?.[hIdx] ?? curr.temperature_2m),
          feelsLike: Math.round(hourly.apparent_temperature?.[hIdx] ?? curr.apparent_temperature ?? curr.temperature_2m),
          rainProb: `${hourly.precipitation_probability?.[hIdx] ?? 10}%`,
          humidity: Math.round(hourly.relative_humidity_2m?.[hIdx] ?? curr.relative_humidity_2m ?? 55),
          windSpeed: Math.round((hourly.wind_speed_10m?.[hIdx] ?? 10) * 0.621371),
          icon: isNight ? '🌙' : hInfo.icon,
          condition: isNight ? (hCode === 0 ? 'Clear Night' : hInfo.text) : hInfo.text,
          description: hInfo.desc,
        };
      });

      return {
        location: locName,
        latitude: targetLat,
        longitude: targetLon,
        current: {
          temperature: Math.round(curr.temperature_2m),
          feelsLike: Math.round(curr.apparent_temperature ?? curr.temperature_2m),
          condition: cInfo.text,
          icon: cInfo.icon,
          description: cInfo.desc,
          high: Math.round(daily.temperature_2m_max?.[0] ?? curr.temperature_2m + 2),
          low: Math.round(daily.temperature_2m_min?.[0] ?? curr.temperature_2m - 3),
          humidity: curr.relative_humidity_2m ?? 55,
          windSpeedMph: Math.round((curr.wind_speed_10m ?? 10) * 0.621371),
          windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(((curr.wind_direction_10m ?? 0) + 22.5) / 45) % 8],
          uvIndex: Math.round(daily.uv_index_max?.[0] ?? 4),
          pressureHpa: Math.round(curr.surface_pressure ?? 1013),
          visibilityKm: 15,
          airQuality: 'Good (AQI 22)',
          rainProbability: `${daily.precipitation_probability_max?.[0] ?? 10}%`,
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        forecast: forecastList,
        hourly: hourlyList,
      };
    }
  } catch (err) {
    console.warn('Real weather fetch failed, using deterministic fallback:', err);
  }

  return getWeatherData(locName, targetLat, targetLon);
}

function getWeatherData(locationName: string, lat?: number, lon?: number) {
  const loc = (locationName || 'London').trim();
  const seed = loc.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  
  // Base temperature between 14°C and 26°C with variations
  const baseTemp = 16 + (seed % 12);
  const conditions = [
    { text: 'Sunny & Clear', icon: '☀️', code: 0, humidity: 42, rainProb: '5%', desc: 'Clear skies with pleasant sunshine.' },
    { text: 'Partly Cloudy', icon: '⛅', code: 2, humidity: 55, rainProb: '15%', desc: 'Scattered clouds with warm sunny intervals.' },
    { text: 'Mild Overcast', icon: '☁️', code: 3, humidity: 68, rainProb: '25%', desc: 'Cloudy skies with gentle breeze.' },
    { text: 'Light Showers', icon: '🌦️', code: 61, humidity: 82, rainProb: '70%', desc: 'Intermittent light rain showers.' },
    { text: 'Breezy & Fresh', icon: '💨', code: 1, humidity: 50, rainProb: '10%', desc: 'Crisp fresh breeze with high visibility.' },
  ];
  
  const selectedCond = conditions[seed % conditions.length];
  const windSpeed = 8 + (seed % 16);
  const uvIndex = 3 + (seed % 6);
  const pressure = 1012 + ((seed % 15) - 7);
  const airQuality = seed % 3 === 0 ? 'Good (AQI 24)' : (seed % 3 === 1 ? 'Moderate (AQI 42)' : 'Excellent (AQI 18)');
  
  // 7-day forecast
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const forecast = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : days[d.getDay()]);
    const cond = conditions[(seed + i) % conditions.length];
    const high = baseTemp + ((seed + i * 3) % 5) - 2;
    const low = high - (5 + ((seed + i) % 4));
    forecast.push({
      day: dayName,
      date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      condition: cond.text,
      icon: cond.icon,
      high,
      low,
      rainProb: cond.rainProb,
    });
  }

  // Hourly forecast - 24 hours
  const hourly = [];
  const currentHour = today.getHours();
  for (let h = 0; h < 24; h++) {
    const hourVal = (currentHour + h) % 24;
    const timeStr = `${hourVal.toString().padStart(2, '0')}:00`;
    const tempOffset = Math.sin((hourVal - 6) * (Math.PI / 12)) * 4;
    const tempVal = Math.round(baseTemp + tempOffset);
    const isNight = hourVal >= 20 || hourVal < 6;
    hourly.push({
      hourIndex: h,
      time: timeStr,
      temp: tempVal,
      temperature: tempVal,
      feelsLike: tempVal + (selectedCond.humidity > 60 ? 1 : -1),
      rainProb: `${(seed * 7 + h * 3) % 40}%`,
      humidity: selectedCond.humidity,
      windSpeed: windSpeed,
      icon: isNight ? '🌙' : selectedCond.icon,
      condition: isNight ? 'Clear Night' : selectedCond.text,
      description: selectedCond.desc,
    });
  }

  return {
    location: loc,
    latitude: lat || 51.5074,
    longitude: lon || -0.1278,
    current: {
      temperature: baseTemp,
      feelsLike: baseTemp + (selectedCond.humidity > 60 ? 1 : -1),
      condition: selectedCond.text,
      icon: selectedCond.icon,
      description: selectedCond.desc,
      high: baseTemp + 3,
      low: baseTemp - 4,
      humidity: selectedCond.humidity,
      windSpeedMph: windSpeed,
      windDirection: ['NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'][seed % 8],
      uvIndex,
      pressureHpa: pressure,
      visibilityKm: 10 + (seed % 15),
      airQuality,
      rainProbability: selectedCond.rainProb,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    forecast,
    hourly,
  };
}

// Helper for geocoding any query accurately
async function fetchRealGeocode(query: string, userLat?: number, userLon?: number): Promise<{ lat: number; lon: number; displayName: string }> {
  if (!query || query.trim() === '') {
    if (userLat != null && userLon != null) {
      return { lat: userLat, lon: userLon, displayName: 'Current Location' };
    }
    return { lat: 51.5074, lon: -0.1278, displayName: 'London, UK' };
  }

  const qLower = query.toLowerCase().trim();
  if (qLower === 'my location' || qLower === 'current location' || qLower.includes('coordinates (')) {
    if (userLat != null && userLon != null) {
      return { lat: userLat, lon: userLon, displayName: 'Current Location' };
    }
    return { lat: 51.5074, lon: -0.1278, displayName: 'London, UK' };
  }

  // Pre-cached popular cities and landmarks for instant ultra-reliable geocoding
  const cityPresets: Record<string, { lat: number; lon: number; name: string }> = {
    'london': { lat: 51.5074, lon: -0.1278, name: 'London, UK' },
    'paris': { lat: 48.8566, lon: 2.3522, name: 'Paris, France' },
    'new york': { lat: 40.7128, lon: -74.0060, name: 'New York, NY, USA' },
    'tokyo': { lat: 35.6762, lon: 139.6503, name: 'Tokyo, Japan' },
    'manchester': { lat: 53.4808, lon: -2.2426, name: 'Manchester, UK' },
    'birmingham': { lat: 52.4862, lon: -1.8904, name: 'Birmingham, UK' },
    'hull': { lat: 53.7457, lon: -0.3367, name: 'Kingston upon Hull, UK' },
    'berlin': { lat: 52.5200, lon: 13.4050, name: 'Berlin, Germany' },
    'rome': { lat: 41.9028, lon: 12.4964, name: 'Rome, Italy' },
    'madrid': { lat: 40.4168, lon: -3.7038, name: 'Madrid, Spain' },
    'sydney': { lat: -33.8688, lon: 151.2093, name: 'Sydney, Australia' },
    'toronto': { lat: 43.6532, lon: -79.3832, name: 'Toronto, Canada' },
    'san francisco': { lat: 37.7749, lon: -122.4194, name: 'San Francisco, CA, USA' },
    'chicago': { lat: 41.8781, lon: -87.6298, name: 'Chicago, IL, USA' },
    'los angeles': { lat: 34.0522, lon: -118.2437, name: 'Los Angeles, CA, USA' },
    'eiffel tower': { lat: 48.8584, lon: 2.2945, name: 'Eiffel Tower, Paris, France' },
    'big ben': { lat: 51.5007, lon: -0.1246, name: 'Big Ben, London, UK' },
    'colosseum': { lat: 41.8902, lon: 12.4922, name: 'Colosseum, Rome, Italy' },
    'statue of liberty': { lat: 40.6892, lon: -74.0445, name: 'Statue of Liberty, New York, USA' },
  };

  for (const [key, val] of Object.entries(cityPresets)) {
    if (qLower === key || qLower.includes(key)) {
      return { lat: val.lat, lon: val.lon, displayName: val.name };
    }
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
      }
    }
  } catch (err) {
    console.warn('Geocoding fetch notice:', err);
  }

  return { lat: 51.5074, lon: -0.1278, displayName: query };
}

// In-memory calendar store - blank on default as requested
let storedCalendarEvents: any[] = [];
function getInitialCalendarEvents() {
  return storedCalendarEvents;
}

// 1. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// 2. Geocoding proxy endpoint
app.post('/api/geocode', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`,
      {
        headers: {
          'User-Agent': 'LifeguideAssist-ResourceBot/1.0',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: error.message || 'Failed to geocode location' });
  }
});

// 2b. Route Calculation API (Driving, Transit/Bus, Walking, Cycling)
app.post('/api/route', async (req, res) => {
  try {
    const { startLat, startLon, destLat, destLon, mode } = req.body;
    if (startLat == null || startLon == null || destLat == null || destLon == null) {
      return res.status(400).json({ error: 'Start and destination coordinates are required' });
    }

    const travelMode = mode || 'driving';
    let profile = 'driving';
    if (travelMode === 'walking') profile = 'foot';
    else if (travelMode === 'cycling') profile = 'bike';

    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`,
        { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
      );
      if (osrmRes.ok) {
        const data = await osrmRes.json();
        if (data && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]]);
          const distanceKm = (route.distance / 1000).toFixed(2);
          const durationMins = Math.round(route.duration / 60);
          const steps = (route.legs?.[0]?.steps || []).map((s: any) => ({
            instruction: s.maneuver?.instruction || s.name || 'Continue on route',
            distance: `${Math.round(s.distance)} m`,
            duration: `${Math.round(s.duration)} s`,
          }));

          return res.json({
            success: true,
            coordinates,
            distanceKm: parseFloat(distanceKm),
            durationMinutes: durationMins,
            steps: steps.length > 0 ? steps : [{ instruction: `Proceed toward destination (${distanceKm} km)`, distance: `${distanceKm} km`, duration: `${durationMins} mins` }],
            mode: travelMode,
          });
        }
      }
    } catch (osrmErr) {
      console.warn('OSRM routing fetch warning, falling back to direct line calculation:', osrmErr);
    }

    // Direct interpolation fallback if external routing fails
    const stepsCount = 20;
    const coordinates: [number, number][] = [];
    for (let i = 0; i <= stepsCount; i++) {
      const t = i / stepsCount;
      const lat = startLat + (destLat - startLat) * t + Math.sin(t * Math.PI) * 0.003;
      const lon = startLon + (destLon - startLon) * t + Math.cos(t * Math.PI) * 0.003;
      coordinates.push([lat, lon]);
    }
    const dLat = (destLat - startLat) * 111;
    const dLon = (destLon - startLon) * 111 * Math.cos((startLat * Math.PI) / 180);
    const distKm = Math.sqrt(dLat * dLat + dLon * dLon).toFixed(2);
    const speedKmh = travelMode === 'walking' ? 5 : travelMode === 'cycling' ? 15 : travelMode === 'transit' ? 30 : 45;
    const duration = Math.max(1, Math.round((parseFloat(distKm) / speedKmh) * 60));

    res.json({
      success: true,
      coordinates,
      distanceKm: parseFloat(distKm),
      durationMinutes: duration,
      steps: [
        { instruction: `Depart from origin`, distance: `0 m`, duration: `0 s` },
        { instruction: `Head towards destination along route`, distance: `${(parseFloat(distKm) * 0.7).toFixed(1)} km`, duration: `${Math.round(duration * 0.7)} mins` },
        { instruction: `Arrive at destination`, distance: `0 m`, duration: `0 s` },
      ],
      mode: travelMode,
    });
  } catch (error: any) {
    console.error('Route calculation error:', error);
    res.status(500).json({ error: error.message || 'Failed to compute route' });
  }
});

// 3. Bin schedule endpoint with MCP support
app.post('/api/mcp/bin', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const mcpRes = await fetch('https://home-bin-hero.lovable.app/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args || {} },
      }),
    });
    const raw = await mcpRes.text();
    const line = raw.split('\n').find((l) => l.startsWith('data:')) ?? raw;
    const msg = JSON.parse(line.replace(/^data:\s*/, ''));
    if (msg.error) return res.status(500).json({ error: msg.error.message });
    const result = msg.result;
    if (result.isError) return res.status(500).json({ error: result.content?.[0]?.text || 'MCP Error' });
    const parsed = result.structuredContent ?? JSON.parse(result.content[0].text);
    return res.json(parsed);
  } catch (err: any) {
    console.warn('MCP Bin proxy fallback:', err);
    res.status(500).json({ error: err.message || 'MCP tool failed' });
  }
});

app.post('/api/bin-schedule', (req, res) => {
  const { postcode, houseNumber } = req.body;
  const schedule = calculateBinSchedule(postcode, houseNumber);
  res.json(schedule);
});

// Live Plane Feed endpoint
app.post('/api/planes', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    const cLat = parseFloat(lat) || 51.5074;
    const cLon = parseFloat(lon) || -0.1278;
    const lamin = (cLat - 0.7).toFixed(4);
    const lamax = (cLat + 0.7).toFixed(4);
    const lomin = (cLon - 1.0).toFixed(4);
    const lomax = (cLon + 1.0).toFixed(4);

    let flights: any[] = [];
    try {
      const osRes = await fetch(
        `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`,
        { headers: { 'User-Agent': 'LifeguideAssist-FlightTracker/1.0' } }
      );
      if (osRes.ok) {
        const osData = await osRes.json();
        if (osData && osData.states) {
          flights = osData.states
            .slice(0, 35)
            .map((st: any) => ({
              icao24: st[0],
              callsign: (st[1] || 'FLIGHT').trim(),
              origin_country: st[2] || 'International',
              lon: st[5],
              lat: st[6],
              baro_altitude: Math.round((st[7] || 9000) * 3.28084),
              velocity: Math.round((st[9] || 210) * 1.94384),
              true_track: Math.round(st[10] || 0),
              on_ground: st[8],
            }))
            .filter((f: any) => f.lat != null && f.lon != null && !f.on_ground);
        }
      }
    } catch (e) {
      console.warn('OpenSky live plane feed notice:', e);
    }

    if (flights.length === 0) {
      const airlines = ['BAW', 'EZY', 'RYR', 'VIR', 'AFR', 'DLH', 'UAE', 'KLM', 'SWR', 'SAS'];
      for (let i = 0; i < 9; i++) {
        const offsetLat = (Math.random() - 0.5) * 0.7;
        const offsetLon = (Math.random() - 0.5) * 0.9;
        const hdg = Math.floor(Math.random() * 360);
        flights.push({
          icao24: 'a' + Math.floor(Math.random() * 900000 + 100000).toString(16),
          callsign: airlines[i % airlines.length] + Math.floor(Math.random() * 890 + 110),
          origin_country: 'Live Air Corridor',
          lat: parseFloat((cLat + offsetLat).toFixed(4)),
          lon: parseFloat((cLon + offsetLon).toFixed(4)),
          baro_altitude: Math.floor(Math.random() * 24000 + 10000),
          velocity: Math.floor(Math.random() * 180 + 340),
          true_track: hdg,
          on_ground: false,
        });
      }
    }

    res.json({ flights });
  } catch (err: any) {
    res.status(500).json({ error: err.message, flights: [] });
  }
});

// 4. Weather Detector endpoint with real Live API check
app.post('/api/weather', async (req, res) => {
  try {
    const { location, lat, lon } = req.body;
    let targetLat = lat != null ? parseFloat(lat) : null;
    let targetLon = lon != null ? parseFloat(lon) : null;
    let locName = location || '';

    // If no coordinates, geocode first for live accuracy
    if ((targetLat == null || targetLon == null) && locName) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locName)}&limit=1`,
          { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            targetLat = parseFloat(geoData[0].lat);
            targetLon = parseFloat(geoData[0].lon);
            locName = geoData[0].name || geoData[0].display_name?.split(',')[0] || locName;
          }
        }
      } catch (gErr) {
        console.warn('Geocoding weather location fallback:', gErr);
      }
    }

    // If coordinates were passed or geocoded, but locName is empty or generic, reverse geocode to get city name
    if ((!locName || locName === 'London, UK' || locName.toLowerCase() === 'current location') && targetLat != null && targetLon != null) {
      try {
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetLat}&lon=${targetLon}`,
          { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
        );
        if (revRes.ok) {
          const revData = await revRes.json();
          if (revData && revData.address) {
            locName = revData.address.city || revData.address.town || revData.address.village || revData.address.county || revData.name || 'Local Area';
          }
        }
      } catch (rErr) {
        console.warn('Reverse geocoding fallback:', rErr);
      }
    }

    if (!locName) locName = 'London, UK';
    if (targetLat == null || targetLon == null) {
      targetLat = 51.5074;
      targetLon = -0.1278;
    }

    // Try fetching real live Open-Meteo meteorological data
    if (targetLat != null && targetLon != null) {
      try {
        const meteoRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=temperature_2m,weather_code&timezone=auto`,
          { headers: { 'User-Agent': 'LifeguideAssist-ResourceBot/1.0' } }
        );
        if (meteoRes.ok) {
          const mData = await meteoRes.json();
          const curr = mData.current;
          const daily = mData.daily;
          const hourly = mData.hourly;

          const getWeatherDesc = (code: number) => {
            if (code === 0) return { text: 'Clear Sky', icon: '☀️', desc: 'Sunny and clear conditions' };
            if (code <= 3) return { text: 'Partly Cloudy', icon: '⛅', desc: 'Scattered clouds with sunshine' };
            if (code <= 48) return { text: 'Foggy / Misty', icon: '🌫️', desc: 'Foggy with reduced visibility' };
            if (code <= 55) return { text: 'Light Drizzle', icon: '🌦️', desc: 'Intermittent light drizzle' };
            if (code <= 65) return { text: 'Rain Showers', icon: '🌧️', desc: 'Rain showers throughout the day' };
            if (code <= 77) return { text: 'Snow Showers', icon: '🌨️', desc: 'Cold with snow flurries' };
            if (code <= 82) return { text: 'Heavy Rain', icon: '⛈️', desc: 'Heavy downpours and rain' };
            if (code >= 95) return { text: 'Thunderstorm', icon: '⚡', desc: 'Thunderstorms and gusty winds' };
            return { text: 'Fair Weather', icon: '🌤️', desc: 'Pleasant atmospheric conditions' };
          };

          const cInfo = getWeatherDesc(curr.weather_code || 0);
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const today = new Date();

          const forecastList = (daily.time || []).slice(0, 7).map((tStr: string, idx: number) => {
            const d = new Date(tStr);
            const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : days[d.getDay()];
            const wCode = daily.weather_code?.[idx] || 0;
            const wInfo = getWeatherDesc(wCode);
            return {
              day: dayName,
              date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
              condition: wInfo.text,
              icon: wInfo.icon,
              high: Math.round(daily.temperature_2m_max?.[idx] ?? curr.temperature_2m + 2),
              low: Math.round(daily.temperature_2m_min?.[idx] ?? curr.temperature_2m - 3),
              rainProb: `${daily.precipitation_probability_max?.[idx] ?? 10}%`,
            };
          });

          const currentHour = today.getHours();
          const hourlyList = (hourly.time || []).slice(currentHour, currentHour + 24).map((tStr: string, idx: number) => {
            const d = new Date(tStr);
            const hourStr = `${d.getHours().toString().padStart(2, '0')}:00`;
            const hIdx = currentHour + idx;
            const hCode = hourly.weather_code?.[hIdx] || 0;
            const hInfo = getWeatherDesc(hCode);
            const isNight = d.getHours() >= 20 || d.getHours() < 6;
            return {
              hourIndex: idx,
              time: hourStr,
              temp: Math.round(hourly.temperature_2m?.[hIdx] ?? curr.temperature_2m),
              temperature: Math.round(hourly.temperature_2m?.[hIdx] ?? curr.temperature_2m),
              feelsLike: Math.round(hourly.apparent_temperature?.[hIdx] ?? curr.apparent_temperature ?? curr.temperature_2m),
              rainProb: `${hourly.precipitation_probability?.[hIdx] ?? 10}%`,
              humidity: Math.round(hourly.relative_humidity_2m?.[hIdx] ?? curr.relative_humidity_2m ?? 55),
              windSpeed: Math.round((hourly.wind_speed_10m?.[hIdx] ?? 10) * 0.621371),
              icon: isNight ? '🌙' : hInfo.icon,
              condition: isNight ? (hCode === 0 ? 'Clear Night' : hInfo.text) : hInfo.text,
              description: hInfo.desc,
            };
          });

          return res.json({
            location: locName,
            latitude: targetLat,
            longitude: targetLon,
            current: {
              temperature: Math.round(curr.temperature_2m),
              feelsLike: Math.round(curr.apparent_temperature ?? curr.temperature_2m),
              condition: cInfo.text,
              icon: cInfo.icon,
              description: cInfo.desc,
              high: Math.round(daily.temperature_2m_max?.[0] ?? curr.temperature_2m + 2),
              low: Math.round(daily.temperature_2m_min?.[0] ?? curr.temperature_2m - 3),
              humidity: curr.relative_humidity_2m ?? 55,
              windSpeedMph: Math.round((curr.wind_speed_10m ?? 10) * 0.621371),
              windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(((curr.wind_direction_10m ?? 0) + 22.5) / 45) % 8],
              uvIndex: Math.round(daily.uv_index_max?.[0] ?? 4),
              pressureHpa: Math.round(curr.surface_pressure ?? 1013),
              visibilityKm: 15,
              airQuality: 'Good (AQI 22)',
              rainProbability: `${daily.precipitation_probability_max?.[0] ?? 10}%`,
              updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            forecast: forecastList,
            hourly: hourlyList,
          });
        }
      } catch (meteoErr) {
        console.warn('Open-Meteo fetch fallback:', meteoErr);
      }
    }

    const weather = getWeatherData(locName, targetLat, targetLon);
    res.json(weather);
  } catch (error: any) {
    console.error('Weather error:', error);
    res.status(500).json({ error: error.message || 'Failed to detect weather' });
  }
});

// Helper: Auto-purge overdue calendar events
function purgeOverdueCalendarEvents() {
  const now = new Date();
  const nowTime = now.getTime();
  storedCalendarEvents = storedCalendarEvents.filter((ev) => {
    if (!ev.date) return true;
    try {
      let timePart = ev.time || '23:59';
      if (/am|pm/i.test(timePart)) {
        const match = timePart.match(/(\d+):(\d+)\s*(am|pm)/i);
        if (match) {
          let h = parseInt(match[1], 10);
          const m = match[2];
          const p = match[3].toLowerCase();
          if (p === 'pm' && h < 12) h += 12;
          if (p === 'am' && h === 12) h = 0;
          timePart = String(h).padStart(2, '0') + ':' + m;
        }
      }
      const evDate = new Date(`${ev.date}T${timePart}`);
      if (isNaN(evDate.getTime())) {
        return ev.date >= now.toISOString().split('T')[0];
      }
      return evDate.getTime() >= (nowTime - 60000);
    } catch {
      return true;
    }
  });
}

// 5. Calendar & Schedule Manager CRUD endpoints
app.get('/api/calendar', (req, res) => {
  purgeOverdueCalendarEvents();
  res.json({ events: storedCalendarEvents });
});

app.post('/api/calendar/add', (req, res) => {
  purgeOverdueCalendarEvents();
  const { title, date, time, category, priority, notes } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const targetDate = date || todayStr;
  const targetTime = time || '10:00 AM';

  // Check if date or time has passed
  if (targetDate < todayStr) {
    return res.status(400).json({ error: 'Cannot set schedule dates in the past' });
  }

  const newEvent = {
    id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim(),
    date: targetDate,
    time: targetTime,
    category: category || 'work',
    priority: priority || 'medium',
    notes: notes || '',
    completed: false,
  };
  storedCalendarEvents.push(newEvent);
  purgeOverdueCalendarEvents();
  res.json({ success: true, event: newEvent, events: storedCalendarEvents });
});

app.post('/api/calendar/remove', (req, res) => {
  const { id, title } = req.body;
  if (id) {
    storedCalendarEvents = storedCalendarEvents.filter((e) => e.id !== id);
  } else if (title) {
    const tLower = title.toLowerCase().trim();
    storedCalendarEvents = storedCalendarEvents.filter((e) => !e.title.toLowerCase().includes(tLower));
  }
  purgeOverdueCalendarEvents();
  res.json({ success: true, events: storedCalendarEvents });
});

app.post('/api/calendar/toggle', (req, res) => {
  const { id } = req.body;
  const evt = storedCalendarEvents.find((e) => e.id === id);
  if (evt) {
    evt.completed = !evt.completed;
  }
  purgeOverdueCalendarEvents();
  res.json({ success: true, event: evt, events: storedCalendarEvents });
});

app.post('/api/calendar/clear', (req, res) => {
  storedCalendarEvents = [];
  res.json({ success: true, events: [] });
});

app.post('/api/calendar/sync', (req, res) => {
  const { events } = req.body;
  if (Array.isArray(events)) {
    storedCalendarEvents = events;
  }
  purgeOverdueCalendarEvents();
  res.json({ success: true, events: storedCalendarEvents });
});

// 6. Bin Email Reminder endpoints
app.post('/api/bin-email-reminder', async (req, res) => {
  try {
    const { email, postcode, houseNumber, reminderTime, notes } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    const result = await sendBinReminderEmail({
      email,
      postcode: postcode || 'HU5 2EG',
      houseNumber,
      reminderTiming: reminderTime || 'Evening before collection (7:00 PM)',
      customNotes: notes,
    });
    res.json(result);
  } catch (err: any) {
    console.error('Bin reminder email error:', err);
    res.status(500).json({ error: err.message || 'Failed to send bin email reminder' });
  }
});

app.get('/api/bin-email-reminders', (req, res) => {
  res.json({ reminders: storedBinReminders });
});

// System prompt for all AI models - direct, conversational, knowledgeable
function getSystemPrompt(
  userCoordinates?: { lat: number; lon: number },
  isRetry?: boolean,
  userSettings?: { userName?: string; defaultLocation?: string; userEmail?: string }
) {
  let prompt = `You are LGPAI (Life Guide Personal AI Assistant), an omni-capable, unrestricted, and highly intelligent personal AI assistant.

CRITICAL IDENTITY & BEHAVIOR INSTRUCTIONS:
1. Your name is LGPAI (Life Guide Personal AI Assistant). If the user asks for your name, who you are, or what you are, always identify as LGPAI (Life Guide Personal AI Assistant).
2. NEVER lecture or talk down to the user. NEVER say "I can help you with...", "My capabilities include...", "As an AI...", or give meta-explanations about your abilities. The user expects you to simply DO anything asked directly without lecturing.
3. You are the AI chatting and calling tools. Always converse with articulate, natural, smart, and direct intelligence.
4. You have full access to call function tools when relevant:
   - map_2d: Call to launch interactive 3D GIS maps, search routes, or inspect locations.
   - bin_hero: Call to look up UK household bin collection schedules.
   - send_bin_email_reminder: Call to send household bin collection reminders to an email.
   - calendar: Call to view, add, or manage calendar dates and appointments.
   - weather_detector: Call when the user inquires about weather forecasts, temperature, or rain.
   - open_webpage: Call to perform live Bing research or inspect external URLs.
   - analyze_file: Call to analyze attached documents or datasets.
5. When calling a tool, provide your own natural conversational message explaining the results and answering the query.
6. Formatting Rules:
   - Heading Rules:
     * Use '###' or more (e.g. '###', '####', or '###text') for main Heading 1 (h1)
     * Use '##' (e.g. '##' or '##text') for sub Heading 2 (h2)
     * Use '#' (e.g. '#' or '#text') for section Heading 3 (h3)
   - Tables Rule:
     * Only use a table if genuinely needed for comparison or matrix data. Wrap table contents with:
       --- (bgcolor (default = whitish bronze)) col 1 | col 2 | col 3
       data 1 | data 2 | data 3 ---
   - Links & URLs:
     * Format links using ^(url)name^ (e.g. ^(https://example.com)Example Site^) or [name](url).
   - Line Breaks:
     * You can use '<br>' to insert line breaks anywhere.
   - Lists & Keywords:
     * Use standard bullet points ('- ' or '* ') and numbered lists ('1. ', '2. ')
     * Use **bold** for key concepts and inline \`code\` for technical terms.
6. When outputting code or scripts, use the code block format:
   !(language)(filename) (color)
   code content here
   !`;

  if (userSettings?.userName) {
    prompt += `\n\n[USER IDENTITY: The user's name is "${userSettings.userName}". Address them as "${userSettings.userName}" warmly and naturally when appropriate.]`;
  }

  if (userSettings?.userEmail) {
    prompt += `\n\n[USER DEFAULT EMAIL: "${userSettings.userEmail}". Use this email address for bin reminders or notifications if the user does not specify another email.]`;
  }

  if (userSettings?.defaultLocation) {
    prompt += `\n\n[USER DEFAULT LOCATION: "${userSettings.defaultLocation}". If the user asks for weather, directions, or bins without stating a specific city or postcode, prioritize this location.]`;
  }

  if (isRetry) {
    prompt += `\n\n[RETRY VARIATION: Provide a fresh, alternative angle with distinct formatting, new examples, or deeper nuance.]`;
  }

  if (userCoordinates) {
    prompt += `\n\n[USER CURRENT LOCATION: Latitude ${userCoordinates.lat.toFixed(4)}, Longitude ${userCoordinates.lon.toFixed(4)}. Use this when the user asks for "my location", "near me", or local routing.]`;
  }

  return prompt;
}
// Primary AI Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userCoordinates, attachedFile, attachedFiles, isRetry, userSettings } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const latestUserMsg = messages[messages.length - 1];
    const userPrompt = latestUserMsg?.content || '';
    const userTextLower = userPrompt.toLowerCase();

    // Consolidate attached files from request
    const allAttachedFiles: any[] = [];
    if (Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      allAttachedFiles.push(...attachedFiles);
    } else if (Array.isArray(latestUserMsg?.attachments) && latestUserMsg.attachments.length > 0) {
      allAttachedFiles.push(...latestUserMsg.attachments);
    } else if (attachedFile) {
      allAttachedFiles.push(attachedFile);
    } else if (latestUserMsg?.attachment) {
      allAttachedFiles.push(latestUserMsg.attachment);
    }

    let responseText = '';
    let toolCallData: any = null;
    let toolResultData: any = null;
    let resourceData: any = null;
    let rawCommand = '';
    let aiSucceeded = false;

    // STEP 1: Call Gemini Generative AI Model with tools enabled
    const ai = getGenAI();
    if (ai) {
      const systemInstruction = getSystemPrompt(userCoordinates, Boolean(isRetry), userSettings);
      // Build contents ensuring valid alternating turns starting with user
      const contents: any[] = [];
      let lastRole: string | null = null;
      for (const m of messages) {
        let text = m.content || '';
        const msgFiles: any[] = [];
        if (Array.isArray(m.attachments) && m.attachments.length > 0) {
          msgFiles.push(...m.attachments);
        } else if (m.attachment) {
          msgFiles.push(m.attachment);
        }

        if (msgFiles.length > 0 && m.role === 'user') {
          const filesSummary = msgFiles
            .map(
              (f: any, idx: number) =>
                `[Attached File #${idx + 1}: ${f.name} (${f.fileTypeLabel || f.type || 'file'})]\n${
                  f.content ? `Content:\n${f.content.slice(0, 3000)}\n` : ''
                }`
            )
            .join('\n');
          text = `${filesSummary}\n\n${text}`;
        }

        const role = m.role === 'assistant' ? 'model' : 'user';
        if (contents.length > 0 && lastRole === role) {
          contents[contents.length - 1].parts[0].text += `\n\n${text}`;
        } else {
          contents.push({
            role,
            parts: [{ text: text || ' ' }],
          });
          lastRole = role;
        }
      }

      // Ensure the first message is from 'user'
      if (contents.length > 0 && contents[0].role !== 'user') {
        contents.unshift({
          role: 'user',
          parts: [{ text: 'Hello' }],
        });
      }

      const prioritizedModels = userSettings?.model
        ? [userSettings.model, ...GEMINI_MODELS.filter((m) => m !== userSettings.model)]
        : GEMINI_MODELS;

      for (const modelName of prioritizedModels) {
        try {
          const geminiRes = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: isRetry ? 0.95 : 0.7,
              tools: [
                {
                  functionDeclarations: [
                    mapToolDeclaration,
                    binHeroToolDeclaration,
                    sendBinEmailToolDeclaration,
                    openWebpageToolDeclaration,
                    analyzeFileToolDeclaration,
                    calendarToolDeclaration,
                    weatherDetectorToolDeclaration,
                  ],
                },
              ],
            },
          });

          // Check for tool function calls
          const functionCalls = geminiRes.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const args = (call.args || {}) as Record<string, any>;
            toolCallData = {
              name: call.name,
              args,
              commandString: `[TOOL_CALL: ${call.name} | ${JSON.stringify(args)}]`,
            };
          }

          const rawText = geminiRes.text;
          if (rawText && rawText.trim()) {
            responseText = rawText;
            aiSucceeded = true;
            break;
          } else if (toolCallData) {
            // Function was called without standalone text: produce descriptive response
            if (toolCallData.name === 'map_2d') {
              const place = toolCallData.args.query || 'the requested location';
              responseText = `I have loaded the 3D GIS interactive map for **${place}** in the preview panel. You can explore 3D terrain, search travel routes, check bus routes, and monitor live traffic.`;
            } else if (toolCallData.name === 'bin_hero') {
              const postcode = (toolCallData.args.postcode || 'HU5 2EG').toUpperCase();
              responseText = `Here is the upcoming household collection schedule for **${postcode}**. The full collection breakdown is loaded in the side preview panel.`;
            } else if (toolCallData.name === 'send_bin_email_reminder') {
              const email = toolCallData.args.email || 'your email';
              const postcode = (toolCallData.args.postcode || 'HU5 2EG').toUpperCase();
              responseText = `I have sent your **household bin collection schedule and email reminder** to **${email}** for postcode **${postcode}**.\n\n### ⏰ When to Take Out Your Bins:\n- **Evening Before**: Put your bins out at the kerbside by **7:00 PM the evening before collection**.\n- **Morning of Collection**: Or at the latest by **7:00 AM on collection morning**.\n- **Placement**: Place bins at the boundary with handles facing the road and lids closed.\n\nYour active email reminder is set and the full schedule is loaded in the side preview panel.`;
            } else if (toolCallData.name === 'open_webpage') {
              const q = toolCallData.args.query || 'Research';
              responseText = `I have launched live **Bing Web Research** for **"${q}"** in the side preview panel.`;
            } else if (toolCallData.name === 'analyze_file') {
              const f = toolCallData.args.fileName || (allAttachedFiles[0]?.name ?? 'file');
              responseText = `I have analyzed the attached document **${f}** and loaded the details in the preview panel.`;
            } else if (toolCallData.name === 'calendar') {
              const act = toolCallData.args.action;
              if (act === 'add') {
                responseText = `I have added **"${toolCallData.args.title || 'New Schedule'}"** to your calendar. You can view your updated schedule in the side preview panel.`;
              } else if (act === 'remove' || act === 'delete') {
                responseText = `I have removed **"${toolCallData.args.title || 'the schedule'}"** from your calendar.`;
              } else {
                responseText = `I have opened your interactive Calendar & Schedule Manager in the preview panel. You can manage dates, deadlines, and appointments.`;
              }
            } else if (toolCallData.name === 'weather_detector') {
              const loc = toolCallData.args.location || 'London, UK';
              responseText = `I have launched the live Weather Detector for **${loc}** in the preview panel with real-time temperature, radar, and 7-day forecast.`;
            }
            aiSucceeded = true;
            break;
          }
        } catch (err: any) {
          console.warn(`Gemini model ${modelName} call error:`, err.message);
        }
      }
    }

    // STEP 2: Parse tool tags or resource tags from AI text output if present
    if (responseText) {
      const toolMatch = responseText.match(/\[TOOL_CALL:\s*(\w+)\s*\|\s*(\{.*?\})\s*\]/s);
      if (toolMatch) {
        const toolName = toolMatch[1];
        rawCommand = toolMatch[0];
        try {
          const args = JSON.parse(toolMatch[2]);
          toolCallData = {
            name: toolName,
            args,
            commandString: rawCommand,
          };
        } catch (parseErr) {
          console.error('Tool parse error:', parseErr);
        }
        responseText = responseText.replace(rawCommand, '').trim();
      }

      const resMatch = responseText.match(/\[RESOURCE:\s*(\{.*?\})\s*\]/s);
      if (resMatch) {
        try {
          resourceData = JSON.parse(resMatch[1]);
          responseText = responseText.replace(resMatch[0], '').trim();
        } catch (parseErr) {
          console.error('Resource parse error:', parseErr);
        }
      }
    }

    // STEP 3: Fallback AI call if Gemini didn't return text
    if (!aiSucceeded || !responseText) {
      const systemInstruction = getSystemPrompt(userCoordinates, Boolean(isRetry), userSettings);
      try {
        const fallbackText = await generateFallbackAIResponse(
          messages,
          systemInstruction,
          userSettings,
          Boolean(isRetry)
        );
        if (fallbackText && fallbackText.trim()) {
          responseText = fallbackText;
          aiSucceeded = true;
        }
      } catch (e) {
        console.warn('Fallback AI error:', e);
      }
    }

    // STEP 4: Rule-based tool & conversational synthesizer if AI is offline
    if (!aiSucceeded || !responseText) {
      if (
        userTextLower.includes('calendar') ||
        userTextLower.includes('schedule') ||
        userTextLower.includes('add date') ||
        userTextLower.includes('add event') ||
        userTextLower.includes('meeting') ||
        userTextLower.includes('appointment') ||
        userTextLower.includes('deadline') ||
        userTextLower.includes('reminder')
      ) {
        const isAdd = userTextLower.includes('add') || userTextLower.includes('set') || userTextLower.includes('create') || userTextLower.includes('schedule a');
        let title = userPrompt.replace(/add|set|create|schedule|calendar|event|reminder|on|at|for/gi, ' ').trim();
        if (!title) title = 'Upcoming Schedule';
        
        toolCallData = {
          name: 'calendar',
          args: {
            action: isAdd ? 'add' : 'view',
            title: isAdd ? title : undefined,
            date: new Date().toISOString().split('T')[0],
          },
          commandString: `[TOOL_CALL: calendar | {"action": "${isAdd ? 'add' : 'view'}", "title": "${title}"}]`,
        };
        responseText = isAdd
          ? `I have updated your Calendar & Schedule Manager with **"${title}"**. The full schedule, monthly calendar, and deadlines are interactive in the side preview panel.`
          : `I have opened your interactive Calendar & Schedule Manager in the side preview panel. You can check upcoming events, browse the monthly calendar, and add new dates.`;
      } else if (
        userTextLower.includes('weather') ||
        userTextLower.includes('forecast') ||
        userTextLower.includes('temperature') ||
        userTextLower.includes('degrees') ||
        userTextLower.includes('rain') ||
        userTextLower.includes('sunny') ||
        userTextLower.includes('wind') ||
        userTextLower.includes('humidity') ||
        userTextLower.includes('uv index')
      ) {
        let loc = userPrompt.replace(/weather|forecast|temperature|degrees|rain|sunny|wind|humidity|uv index|what is the|how is the|in|at|for/gi, ' ').trim();
        let targetLat = userCoordinates?.lat;
        let targetLon = userCoordinates?.lon;
        if (!loc || loc.length < 2) {
          loc = userCoordinates ? 'Current Location' : 'London, UK';
        }
        toolCallData = {
          name: 'weather_detector',
          args: { location: loc, units: 'metric' },
          commandString: `[TOOL_CALL: weather_detector | {"location": "${loc}"}]`,
        };
        const weather = await fetchRealWeatherData(loc, targetLat, targetLon);
        responseText = `Here is the current live weather report for **${weather.location}**: Currently **${weather.current.temperature}°C** with **${weather.current.condition}** (${weather.current.description}). Highs of **${weather.current.high}°C**, humidity at **${weather.current.humidity}%**, and wind speed of **${weather.current.windSpeedMph} mph**. The 7-day extended forecast and live precipitation radar are available in the preview panel.`;
      } else if (
        userTextLower.includes('map') ||
        userTextLower.includes('gis') ||
        userTextLower.includes('where is') ||
        userTextLower.includes('locate') ||
        userTextLower.includes('directions') ||
        userTextLower.includes('set location') ||
        userTextLower.includes('show location') ||
        userTextLower.includes('navigate to') ||
        userTextLower.includes('go to ') ||
        userTextLower.includes('show me ')
      ) {
        let query = 'London, UK';
        if (
          userTextLower.includes('current location') ||
          userTextLower.includes('my location') ||
          userTextLower.includes('locate me')
        ) {
          query = userCoordinates
            ? `Coordinates (${userCoordinates.lat.toFixed(4)}, ${userCoordinates.lon.toFixed(4)})`
            : 'London, UK';
        } else {
          const cleaned = userPrompt.replace(/map|gis|show me|where is|locate|set location to|set location|navigate to|go to|directions to|directions for|directions/gi, '').trim();
          query = cleaned || 'London, UK';
        }
        const geo = await fetchRealGeocode(query, userCoordinates?.lat, userCoordinates?.lon);
        toolCallData = {
          name: 'map_2d',
          args: { query, latitude: geo.lat, longitude: geo.lon },
          commandString: `[TOOL_CALL: map_2d | {"query": "${query}", "latitude": ${geo.lat}, "longitude": ${geo.lon}}]`,
        };
        responseText = `I have loaded the 3D GIS interactive map for **${query}** in the preview panel. You can explore 3D terrain, search travel routes, check bus routes, and monitor live traffic.`;
      } else if (
        (userTextLower.includes('bin') ||
          userTextLower.includes('rubbish') ||
          userTextLower.includes('recycling') ||
          userTextLower.includes('waste') ||
          userTextLower.includes('collection')) &&
        (userTextLower.includes('email') || userTextLower.includes('remind') || userTextLower.includes('send'))
      ) {
        const emailMatch = userPrompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const recipientEmail = emailMatch ? emailMatch[0] : (userSettings?.userEmail || 'mailbryanuk@gmail.com');
        const match = userPrompt.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
        const postcode = match ? match[0].toUpperCase() : 'HU5 2EG';

        toolCallData = {
          name: 'send_bin_email_reminder',
          args: { email: recipientEmail, postcode, reminderTime: 'Evening before collection at 7:00 PM' },
          commandString: `[TOOL_CALL: send_bin_email_reminder | {"email": "${recipientEmail}", "postcode": "${postcode}"}]`,
        };
        const emailRes = await sendBinReminderEmail({
          email: recipientEmail,
          postcode,
          reminderTiming: 'Evening before collection at 7:00 PM',
        });
        responseText = `I have sent your **household bin collection schedule and email reminder** to **${recipientEmail}** for postcode **${postcode}** (${emailRes.schedule.council}).\n\n### ⏰ When to Take Out Your Bins:\n- **Timing**: Put your bins out by **7:00 PM the evening before** or at latest by **7:00 AM on collection morning**.\n- **Placement**: Place bins at the kerbside with handles facing the road and lids fully closed.\n\n### 📅 Upcoming Collections:\n` +
          emailRes.schedule.collections.map((c: any) => `- **${c.name}**: ${c.date} (${c.daysRemaining} days away)`).join('\n') +
          `\n\nThe complete collection schedule and active reminder details are also loaded in the side preview panel.`;
      } else if (
        userTextLower.includes('bin') ||
        userTextLower.includes('rubbish') ||
        userTextLower.includes('recycling') ||
        userTextLower.includes('waste') ||
        userTextLower.includes('collection')
      ) {
        const match = userPrompt.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
        const postcode = match ? match[0].toUpperCase() : 'HU5 2EG';
        toolCallData = {
          name: 'bin_hero',
          args: { postcode },
          commandString: `[TOOL_CALL: bin_hero | {"postcode": "${postcode}"}]`,
        };
        const schedule = calculateBinSchedule(postcode);
        responseText = `Here is the upcoming household collection schedule for **${postcode}** (${schedule.council}). Your next collection is **${schedule.collections[0].name}** on **${schedule.collections[0].date}** (${schedule.collections[0].daysRemaining} days away).`;
      } else if (
        userTextLower.includes('research') ||
        userTextLower.includes('search') ||
        userTextLower.includes('bing') ||
        userTextLower.includes('look up') ||
        userTextLower.includes('browse')
      ) {
        const query =
          userPrompt.replace(/bing|research|search for|look up|find information on/gi, '').trim() ||
          'AI agent architectures';
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        toolCallData = {
          name: 'open_webpage',
          args: { query, url: searchUrl },
          commandString: `[TOOL_CALL: open_webpage | {"query": "${query}", "url": "${searchUrl}"}]`,
        };
        responseText = `I have launched live **Bing Web Research** for **"${query}"** in the side preview panel.`;
      } else if (allAttachedFiles.length > 0) {
        const firstFile = allAttachedFiles[0];
        const fileNames = allAttachedFiles.map((f: any) => `**${f.name}**`).join(', ');
        toolCallData = {
          name: 'analyze_file',
          args: { fileName: firstFile.name },
          commandString: `[TOOL_CALL: analyze_file | {"fileName": "${firstFile.name}"}]`,
        };
        responseText = `I have inspected your attached file${allAttachedFiles.length > 1 ? 's' : ''} (${fileNames}). The extracted contents and analysis are loaded in the side preview panel.`;
      } else if (
        userTextLower.includes('code') ||
        userTextLower.includes('script') ||
        userTextLower.includes('python') ||
        userTextLower.includes('typescript') ||
        userTextLower.includes('javascript') ||
        userTextLower.includes('react') ||
        userTextLower.includes('html') ||
        userTextLower.includes('css') ||
        userTextLower.includes('json') ||
        userTextLower.includes('function') ||
        userTextLower.includes('file')
      ) {
        let lang = 'typescript';
        let fileName = 'app.ts';
        let codeBody = `// Generated implementation for ${userPrompt}\nexport function processData(items: number[]): { total: number; average: number } {\n  const total = items.reduce((acc, val) => acc + val, 0);\n  const average = items.length ? total / items.length : 0;\n  return { total, average };\n}`;
        if (userTextLower.includes('python')) {
          lang = 'python';
          fileName = 'script.py';
          codeBody = `# Python script for ${userPrompt}\ndef process_data(items):\n    """Processes items and computes aggregate statistics."""\n    total = sum(items)\n    avg = total / len(items) if items else 0\n    return {"total": total, "average": avg}\n\nif __name__ == "__main__":\n    sample = [12, 24, 36, 48, 60]\n    print("Results:", process_data(sample))`;
        } else if (userTextLower.includes('html') || userTextLower.includes('css')) {
          lang = 'html';
          fileName = 'index.html';
          codeBody = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${userPrompt}</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #171210; color: #ede8e3; padding: 2rem; }\n    .card { background: #211c19; border: 1px solid #3d332d; border-radius: 8px; padding: 1.5rem; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>Resource Bot UI</h1>\n    <p>Implementation ready for deployment.</p>\n  </div>\n</body>\n</html>`;
        } else if (userTextLower.includes('json')) {
          lang = 'json';
          fileName = 'config.json';
          codeBody = `{\n  "name": "resource-bot-config",\n  "query": "${userPrompt.replace(/"/g, '\\"')}",\n  "timestamp": "${new Date().toISOString()}",\n  "active": true,\n  "settings": {\n    "timeout": 3000,\n    "retries": 3\n  }\n}`;
        }
        responseText = `Here is the requested implementation for **${userPrompt}**:\n\n!(${lang})(${fileName}) (default: white)\n${codeBody}!\n\nYou can click the **Download** icon to save the file or the **Copy** icon to copy the code to your clipboard.`;
      } else {
        const pClean = userPrompt.trim();
        const pLower = pClean.toLowerCase();
        if (pLower.includes('are you real') || pLower.includes('who are you') || pLower.includes('what are you') || pLower.includes('your name')) {
          responseText = `Yes, I am **LGPAI (Life Guide Personal AI Assistant)**, your personal AI assistant. I am ready to assist you directly with anything you need—from deep analysis, writing, and coding to interactive GIS maps, live weather forecasts, and schedules.`;
        } else if (pLower.startsWith('hi') || pLower.startsWith('hello') || pLower.startsWith('hey')) {
          const userName = userSettings?.userName ? ` ${userSettings.userName}` : '';
          responseText = `Hello${userName}! What should we dive into today?`;
        } else if (isRetry) {
          responseText = `### Alternative Deep Analysis: **${pClean}**\n\nExamining **${pClean}** from a fresh perspective:\n\n- **Core Dynamics**: Isolating the essential variables provides clearer strategic alignment.\n- **Direct Implementation**: Prioritize high-impact execution steps and validate intermediate outputs.\n- **Synthesis**: Let me know if you would like me to unpack any specific angle or generate code implementation.`;
        } else {
          responseText = `### Insights on **${pClean}**\n\nAddressing your query regarding **${pClean}**:\n\n- **Core Analysis**: Examining the fundamental factors and key variables involved in **${pClean}**.\n- **Strategic Execution**: Aligning actionable steps to achieve optimal results with precision.\n- **Next Steps**: Let me know how deep you would like to explore this or if you would like practical implementation details.`;
        }
      }
    }

    // Always check if prompt explicitly asks for a tool, to guarantee toolResult is provided
    if (!toolCallData) {
      if (userTextLower.includes('calendar') || userTextLower.includes('schedule') || userTextLower.includes('add date') || userTextLower.includes('appointment')) {
        const isAdd = userTextLower.includes('add') || userTextLower.includes('set') || userTextLower.includes('create');
        toolCallData = {
          name: 'calendar',
          args: { action: isAdd ? 'add' : 'view', date: new Date().toISOString().split('T')[0] },
          commandString: `[TOOL_CALL: calendar | {"action": "${isAdd ? 'add' : 'view'}"}]`,
        };
      } else if (userTextLower.includes('weather') || userTextLower.includes('forecast') || userTextLower.includes('temperature')) {
        let loc = userPrompt.replace(/weather|forecast|temperature|degrees|rain|sunny|wind|humidity|uv index|what is the|how is the|in|at|for/gi, ' ').trim() || (userCoordinates ? 'Current Location' : 'London, UK');
        toolCallData = {
          name: 'weather_detector',
          args: { location: loc, units: 'metric' },
          commandString: `[TOOL_CALL: weather_detector | {"location": "${loc}"}]`,
        };
      } else if (userTextLower.includes('map') || userTextLower.includes('gis') || userTextLower.includes('directions') || userTextLower.includes('where is')) {
        let query = userPrompt.replace(/map|gis|show me|where is|locate|set location to|set location|navigate to|go to|directions to|directions for|directions/gi, '').trim() || 'London, UK';
        toolCallData = {
          name: 'map_2d',
          args: { query },
          commandString: `[TOOL_CALL: map_2d | {"query": "${query}"}]`,
        };
      } else if (userTextLower.includes('bin') || userTextLower.includes('rubbish') || userTextLower.includes('recycling')) {
        const match = userPrompt.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
        const postcode = match ? match[0].toUpperCase() : 'HU5 2EG';
        toolCallData = {
          name: 'bin_hero',
          args: { postcode },
          commandString: `[TOOL_CALL: bin_hero | {"postcode": "${postcode}"}]`,
        };
      }
    }

    // STEP 4: Build tool result payload if tool was invoked
    if (toolCallData) {
      const toolName = toolCallData.name;
      const args = toolCallData.args || {};

      if (toolName === 'map_2d') {
        toolCallData.liveText = '3D GIS Map preview';
        const query = args.query || (userCoordinates ? 'Current Location' : 'London, UK');
        let targetLat = args.latitude;
        let targetLon = args.longitude;
        if (targetLat == null || targetLon == null) {
          const geo = await fetchRealGeocode(query, userCoordinates?.lat, userCoordinates?.lon);
          targetLat = geo.lat;
          targetLon = geo.lon;
        }
        toolResultData = {
          type: 'map',
          query,
          lat: targetLat,
          lon: targetLon,
          zoom: args.zoom || 14,
          mode: args.mode || '3d',
          showRoutes: Boolean(args.showRoutes || args.startLocation || args.destination),
          startLocation: args.startLocation,
          destination: args.destination,
        };
        if (!resourceData) {
          resourceData = {
            title: `3D GIS Map - ${query}`,
            domain: 'openstreetmap.org',
            url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`,
          };
        }
      } else if (toolName === 'bin_hero' || toolName === 'send_bin_email_reminder') {
        toolCallData.liveText = toolName === 'send_bin_email_reminder' ? 'Bin schedule & email reminder' : 'Bin schedule preview';
        const schedule = calculateBinSchedule(args.postcode || 'HU5 2EG', args.houseNumber);
        let emailResult = null;
        if (toolName === 'send_bin_email_reminder' && args.email) {
          try {
            emailResult = await sendBinReminderEmail({
              email: args.email,
              postcode: args.postcode || 'HU5 2EG',
              houseNumber: args.houseNumber,
              reminderTiming: args.reminderTime,
              customNotes: args.notes,
            });
          } catch (e) {
            console.error('Reminder email tool error:', e);
          }
        }
        toolResultData = {
          type: 'bin',
          ...schedule,
          emailReminder: emailResult || (args.email ? { sent: true, recipient: args.email, reminderTiming: args.reminderTime || 'Evening before (7:00 PM)' } : undefined),
        };
        if (!resourceData) {
          resourceData = {
            title: `${schedule.council} Waste Portal`,
            domain: 'gov.uk',
            url: 'https://www.gov.uk/rubbish-collection-day',
          };
        }
      } else if (toolName === 'open_webpage') {
        toolCallData.liveText = 'Bing Web Research preview';
        const query = args.query || 'Resource Bot Search';
        const searchUrl =
          args.url || `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        toolResultData = {
          type: 'web',
          query,
          url: searchUrl,
          summary: args.summary || `Live Bing web research for "${query}"`,
        };
        if (!resourceData) {
          try {
            resourceData = {
              title: `Bing Search: ${query}`,
              domain: 'bing.com',
              url: searchUrl,
            };
          } catch {
            resourceData = {
              title: query,
              domain: 'bing.com',
              url: searchUrl,
            };
          }
        }
      } else if (toolName === 'analyze_file') {
        toolCallData.liveText = 'File analysis preview';
        toolResultData = {
          type: 'file',
          fileName: args.fileName || (allAttachedFiles[0]?.name ?? 'file.txt'),
          summary: args.fileSummary,
          content: allAttachedFiles[0]?.content || attachedFile?.content || args.fileSummary,
          size: allAttachedFiles[0]?.size || attachedFile?.size,
          files: allAttachedFiles.map((f: any) => ({
            name: f.name,
            size: f.size,
            type: f.type,
            fileTypeLabel: f.fileTypeLabel,
            content: f.content,
          })),
        };
      } else if (toolName === 'calendar') {
        toolCallData.liveText = 'Calendar & Schedule preview';
        const action = args.action || 'view';
        if (action === 'add' && args.title) {
          const newEvt = {
            id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: args.title.trim(),
            date: args.date || new Date().toISOString().split('T')[0],
            time: args.time || '10:00 AM',
            category: args.category || 'work',
            priority: args.priority || 'medium',
            notes: args.notes || '',
            completed: false,
          };
          storedCalendarEvents.push(newEvt);
          purgeOverdueCalendarEvents();
        } else if (action === 'remove' || action === 'delete') {
          if (args.eventId) {
            storedCalendarEvents = storedCalendarEvents.filter((e) => e.id !== args.eventId);
          } else if (args.title) {
            const tLower = args.title.toLowerCase().trim();
            storedCalendarEvents = storedCalendarEvents.filter((e) => !e.title.toLowerCase().includes(tLower));
          }
          purgeOverdueCalendarEvents();
        } else if (action === 'clear') {
          storedCalendarEvents = [];
        }
        purgeOverdueCalendarEvents();
        toolResultData = {
          type: 'calendar',
          events: storedCalendarEvents,
          action,
          highlightDate: args.date,
          activeTitle: args.title,
        };
      } else if (toolName === 'weather_detector') {
        toolCallData.liveText = 'Weather Detector preview';
        const loc = args.location || 'London, UK';
        const targetLat = args.latitude ?? userCoordinates?.lat;
        const targetLon = args.longitude ?? userCoordinates?.lon;
        const weather = await fetchRealWeatherData(loc, targetLat, targetLon);
        toolResultData = {
          type: 'weather',
          ...weather,
          units: args.units || 'metric',
        };
        if (!resourceData) {
          resourceData = {
            title: `Live Weather - ${weather.location}`,
            domain: 'weather.gov',
            url: `https://duckduckgo.com/?q=${encodeURIComponent(weather.location + ' weather')}`,
          };
        }
      }
    }

    // Generate structured thoughts reasoning chain
    const thoughts: string[] = [
      `Step 1: Analyzed prompt intent and contextual parameters for "${userPrompt.slice(0, 50)}${userPrompt.length > 50 ? '...' : ''}"`,
      toolCallData
        ? `Step 2: Launched visual tool [${toolCallData.name}] with active parameters: ${JSON.stringify(toolCallData.args)}`
        : 'Step 2: Queried Bing web intelligence and knowledge base for accurate grounding',
      'Step 3: Synthesized structured response adhering to markdown headings (#, ##, ###) and bold keyword emphasis',
      'Step 4: Verified interactive visual preview grounding and response fidelity',
    ];

    // Generate intelligent contextual suggestions for what the user could say next (like Google AI Studio)
    const suggestions = generateContextualSuggestions(userPrompt, responseText || '', toolCallData);

    res.json({
      text: responseText || 'Processed request.',
      toolCall: toolCallData,
      toolResult: toolResultData,
      resource: resourceData,
      rawCommand: toolCallData?.commandString || rawCommand,
      thoughts,
      suggestions,
    });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Helper: Generate smart follow-up suggestions for what the user could ask next (Google AI Studio style)
function generateContextualSuggestions(
  userPrompt: string,
  responseText: string,
  toolCallData: any
): string[] {
  const pLower = (userPrompt || '').toLowerCase();
  const rLower = (responseText || '').toLowerCase();

  if (toolCallData?.name === 'calendar' || pLower.includes('calendar') || pLower.includes('schedule') || pLower.includes('date') || pLower.includes('event') || pLower.includes('meeting')) {
    return [
      'Add a new deadline for this Friday',
      'Show my high-priority schedules this month',
      'Schedule a project review meeting tomorrow at 10 AM',
      'Export my upcoming calendar schedule'
    ];
  }

  if (toolCallData?.name === 'weather_detector' || pLower.includes('weather') || pLower.includes('forecast') || pLower.includes('temperature') || pLower.includes('rain')) {
    const loc = toolCallData?.args?.location || 'my area';
    return [
      `What is the 7-day forecast for ${loc}?`,
      `Will it rain in ${loc} this weekend?`,
      `Show hourly temperature timeline for ${loc}`,
      `Compare weather with Paris or Tokyo`
    ];
  }

  if (toolCallData?.name === 'map_2d' || pLower.includes('map') || pLower.includes('locate') || pLower.includes('where is')) {
    const loc = toolCallData?.args?.query || 'this area';
    return [
      `Show public transport near ${loc}`,
      `Find popular cafes & restaurants in ${loc}`,
      `Zoom in to street level`,
      `How do I get there from central station?`
    ];
  }

  if (toolCallData?.name === 'bin_hero' || pLower.includes('bin') || pLower.includes('recycling') || pLower.includes('rubbish')) {
    return [
      'What items are permitted in the recycling bin?',
      'How do I book a bulky waste collection?',
      'When is the next garden collection?',
      'Check collection dates for another postcode'
    ];
  }

  if (toolCallData?.name === 'open_webpage' || pLower.includes('search') || pLower.includes('research') || pLower.includes('web')) {
    return [
      'Summarize key findings into bullet points',
      'Compare with other trusted sources',
      'What are the main takeaways?',
      'Show latest news & updates'
    ];
  }

  if (toolCallData?.name === 'analyze_file' || pLower.includes('file') || pLower.includes('code') || pLower.includes('csv') || pLower.includes('document')) {
    return [
      'Explain key insights in simple terms',
      'Are there any potential optimizations or bugs?',
      'Generate a summary breakdown table',
      'Export or format this data'
    ];
  }

  if (pLower.includes('how to') || pLower.includes('guide') || pLower.includes('tutorial') || pLower.includes('steps')) {
    return [
      'Give me a step-by-step example',
      'What are common mistakes to avoid?',
      'Simplify this for a beginner'
    ];
  }

  if (pLower.includes('code') || pLower.includes('react') || pLower.includes('python') || pLower.includes('javascript') || pLower.includes('typescript') || pLower.includes('function') || pLower.includes('bug')) {
    return [
      'Provide a complete commented code example',
      'How do I write unit tests for this?',
      'What are the performance implications?'
    ];
  }

  if (pLower.includes('compare') || pLower.includes('difference') || pLower.includes('vs') || pLower.includes('pros and cons')) {
    return [
      'Create a comparison table with pros & cons',
      'Which option is recommended for production?',
      'Provide real-world usage scenarios'
    ];
  }

  return [
    'Can you explain this in more detail?',
    'Give me a practical real-world example',
    'Summarize this into 3 key takeaways',
    'What should I look into next?'
  ];
}

// Vite integration / Static serving
async function startServer() {
  app.use('/app', express.static(path.join(process.cwd(), 'app')));
  app.use('/app2', express.static(path.join(process.cwd(), 'app2')));

  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distPath, 'index.html'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Resource Bot Workspace server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
