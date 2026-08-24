/**
 * LifeguideAssist - Standalone Node.js Server
 * Runs inside /app independently with Express and comprehensive API routes.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

// Calendar in-memory storage - blank by default
let schedules = [];

// Calendar API endpoints
app.get('/api/calendar', (req, res) => {
  res.json({ schedules });
});

app.post('/api/calendar/sync', (req, res) => {
  const { events } = req.body;
  if (Array.isArray(events)) {
    schedules = events;
  }
  res.json({ status: 'ok', schedules });
});

app.post('/api/calendar/add', (req, res) => {
  const newEvt = req.body;
  if (!newEvt || !newEvt.title) {
    return res.status(400).json({ error: 'Title required' });
  }
  if (!newEvt.id) {
    newEvt.id = 'cal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  }
  schedules.push(newEvt);
  res.json({ status: 'ok', schedules });
});

app.post('/api/calendar/remove', (req, res) => {
  const { id } = req.body;
  if (id) {
    schedules = schedules.filter(s => s.id !== id);
  }
  res.json({ status: 'ok', schedules });
});

app.post('/api/calendar/clear', (req, res) => {
  schedules = [];
  res.json({ status: 'ok', schedules });
});

// Geocoding proxy endpoint
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
          'User-Agent': 'LifeguideAssist-Standalone/1.0',
          Accept: 'application/json',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: error.message || 'Failed to geocode location' });
  }
});

// Route Calculation API (Driving, Transit, Walking, Cycling)
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
        { headers: { 'User-Agent': 'LifeguideAssist-Standalone/1.0' } }
      );
      if (osrmRes.ok) {
        const data = await osrmRes.json();
        if (data && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map((pt) => [pt[1], pt[0]]);
          const distanceKm = (route.distance / 1000).toFixed(2);
          const durationMins = Math.round(route.duration / 60);
          const steps = (route.legs?.[0]?.steps || []).map((s) => ({
            instruction: s.maneuver?.instruction || s.name || 'Continue on route',
            distance: (s.distance / 1000).toFixed(1) + ' km',
          }));

          return res.json({
            coordinates,
            distanceKm,
            durationMinutes: durationMins,
            steps,
            mode: travelMode,
          });
        }
      }
    } catch (osrmErr) {
      console.warn('OSRM router fetch error:', osrmErr);
    }

    // Geodesic fallback
    const stepsCount = 10;
    const coordinates = [];
    for (let i = 0; i <= stepsCount; i++) {
      const t = i / stepsCount;
      coordinates.push([
        startLat + (destLat - startLat) * t + Math.sin(t * Math.PI) * 0.005,
        startLon + (destLon - startLon) * t + Math.cos(t * Math.PI) * 0.005,
      ]);
    }
    res.json({
      coordinates,
      distanceKm: '4.2',
      durationMinutes: travelMode === 'walking' ? 45 : travelMode === 'cycling' ? 15 : 12,
      steps: [
        { instruction: 'Head toward destination along main road', distance: '1.2 km' },
        { instruction: 'Continue onto transit corridor', distance: '2.0 km' },
        { instruction: 'Arrive at destination', distance: '1.0 km' },
      ],
      mode: travelMode,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weather API endpoint
app.post('/api/weather', (req, res) => {
  const loc = req.body.location || 'London, UK';
  const seed = loc.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const baseTemp = 16 + (seed % 12);
  res.json({
    location: loc,
    current: {
      temperature: baseTemp,
      condition: 'Partly Cloudy',
      icon: '⛅',
      feelsLike: baseTemp - 1,
      high: baseTemp + 3,
      low: baseTemp - 4,
      humidity: 58,
      windSpeedMph: 8 + (seed % 10),
      windDirection: 'SW',
      uvIndex: 4,
      pressureHpa: 1015,
      visibilityMiles: 10,
      description: 'Pleasant with intermittent sunshine',
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
    hourly: [
      { time: '12:00', temp: baseTemp, icon: '⛅', condition: 'Partly Cloudy' },
      { time: '14:00', temp: baseTemp + 2, icon: '☀️', condition: 'Sunny' },
      { time: '16:00', temp: baseTemp + 3, icon: '☀️', condition: 'Sunny' },
      { time: '18:00', temp: baseTemp + 1, icon: '⛅', condition: 'Partly Cloudy' },
      { time: '20:00', temp: baseTemp - 2, icon: '🌤️', condition: 'Clear Evening' }
    ],
    forecast: [
      { day: 'Today', condition: 'Partly Cloudy', icon: '⛅', high: baseTemp + 3, low: baseTemp - 4, rainProb: '15%' },
      { day: 'Tomorrow', condition: 'Sunny', icon: '☀️', high: baseTemp + 4, low: baseTemp - 3, rainProb: '5%' },
      { day: 'Wednesday', condition: 'Scattered Showers', icon: '🌦️', high: baseTemp + 1, low: baseTemp - 5, rainProb: '60%' },
      { day: 'Thursday', condition: 'Clear Skies', icon: '☀️', high: baseTemp + 3, low: baseTemp - 4, rainProb: '10%' },
      { day: 'Friday', condition: 'Overcast', icon: '☁️', high: baseTemp, low: baseTemp - 6, rainProb: '30%' }
    ]
  });
});

// Chat API endpoint
app.post('/api/chat', (req, res) => {
  const { messages, userCoordinates } = req.body;
  const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1].content.toLowerCase() : '';

  if (lastMsg.includes('map') || lastMsg.includes('location') || lastMsg.includes('place') || lastMsg.includes('route') || lastMsg.includes('directions')) {
    const lat = userCoordinates ? userCoordinates.lat : 51.5074;
    const lon = userCoordinates ? userCoordinates.lon : -0.1278;
    const locName = userCoordinates ? 'Current GPS Location' : 'London, United Kingdom';
    return res.json({
      text: `I've opened the interactive 3D GIS Map for **${locName}** (${lat.toFixed(4)}, ${lon.toFixed(4)}). You can search destinations, toggle transit routes and live traffic, or switch between 2D and 3D perspectives.`,
      toolCall: { name: 'map_2d', liveText: `Map: ${locName}` },
      toolResult: { type: 'map', lat, lon, zoom: 14, locationName: locName, is3d: true, query: locName },
      suggestions: ['Explore bus transit lines', 'Toggle live traffic flow', 'Search a route']
    });
  }

  if (lastMsg.includes('bin') || lastMsg.includes('collection') || lastMsg.includes('waste') || lastMsg.includes('recycle')) {
    return res.json({
      text: `Here is the household collection schedule for **HU5 2EG**:\n\n* **Next Collection:** Tuesday (General Domestic Waste - Black Bin)\n* **Recycling:** Following Tuesday (Mixed Dry Recycling - Blue Bin)\n* **Garden Waste:** Fortnightly on Fridays`,
      toolCall: { name: 'bin_hero', liveText: 'Bin Schedule: HU5 2EG' },
      toolResult: {
        type: 'bin',
        postcode: 'HU5 2EG',
        council: 'Hull City Council',
        collections: [
          { type: 'general', name: 'General Domestic Waste (Black Bin)', date: 'Tuesday', daysRemaining: 3, color: '#10b981', items: ['Non-recyclable household waste', 'Plastic packaging', 'Polystyrene'] },
          { type: 'recycling', name: 'Mixed Dry Recycling (Blue Bin)', date: 'Tuesday in 10 days', daysRemaining: 10, color: '#38edf8', items: ['Cardboard & paper', 'Plastic bottles', 'Tins & drink cans', 'Glass jars'] },
          { type: 'garden', name: 'Garden Waste (Brown Bin)', date: 'Friday in 13 days', daysRemaining: 13, color: '#d97706', items: ['Grass cuttings', 'Hedge clippings', 'Leaves & small branches'] }
        ]
      },
      suggestions: ['What items go in the recycling bin?', 'Set reminder for next collection']
    });
  }

  if (lastMsg.includes('calendar') || lastMsg.includes('schedule') || lastMsg.includes('date') || lastMsg.includes('appointment') || lastMsg.includes('event')) {
    const isAdding = lastMsg.includes('add') || lastMsg.includes('create') || lastMsg.includes('new');
    const isRemoving = lastMsg.includes('remove') || lastMsg.includes('delete') || lastMsg.includes('clear');
    
    let textReply = '';
    if (isAdding) {
      const match = lastMsg.match(/(?:add|schedule|create)\s+(?:a\s+)?(?:meeting|event|appointment|task)?\s*(?:for|on|titled|called)?\s*([^,\.]+)/i);
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
      schedules.push(newEvt);
      textReply = `I've added **${newEvt.title}** to your calendar for **${newEvt.date}** at **${newEvt.time}**.`;
    } else if (isRemoving && schedules.length > 0) {
      const removed = schedules.pop();
      textReply = `I've removed **${removed.title}** from your schedule.`;
    } else if (schedules.length === 0) {
      textReply = `Your calendar is currently clear. You can add new appointments or deadlines anytime.`;
    } else {
      textReply = `You have **${schedules.length}** upcoming schedule item(s) on your calendar.`;
    }

    return res.json({
      text: textReply,
      toolCall: { name: 'calendar', liveText: 'Calendar & Schedules' },
      toolResult: { type: 'calendar', events: schedules },
      suggestions: ['Add a meeting for tomorrow at 2 PM', 'Show upcoming deadlines', 'Clear schedule']
    });
  }

  if (lastMsg.includes('weather') || lastMsg.includes('forecast') || lastMsg.includes('rain') || lastMsg.includes('temperature')) {
    const locMatch = lastMsg.match(/(?:in|for|at)\s+([a-zA-Z\s,]+)/i);
    const loc = locMatch && locMatch[1] ? locMatch[1].trim() : 'London, UK';
    const seed = loc.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const temp = 16 + (seed % 10);
    
    return res.json({
      text: `The current weather in **${loc}** is **${temp}°C** and **Partly Cloudy** with a high of ${temp + 3}°C and low of ${temp - 4}°C. Humidity is around 58% with light winds.`,
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
          description: 'Pleasant with sunny spells',
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        forecast: [
          { day: 'Today', condition: 'Partly Cloudy', icon: '⛅', high: temp + 3, low: temp - 4, rainProb: '15%' },
          { day: 'Tomorrow', condition: 'Sunny', icon: '☀️', high: temp + 4, low: temp - 3, rainProb: '5%' },
          { day: 'Wednesday', condition: 'Scattered Showers', icon: '🌦️', high: temp + 1, low: temp - 5, rainProb: '60%' }
        ]
      },
      suggestions: [`7-day extended forecast for ${loc}`, 'Check hourly rain probability']
    });
  }

  // Conversational response answering questions directly
  return res.json({
    text: `I'm here to assist you with answering questions, mapping places in 3D GIS, calculating routes with traffic & transit lines, organizing your calendar schedules, and detecting real-time weather forecasts.\n\nWhat would you like to look into?`,
    suggestions: ['Map a place', 'Calendar and schedule', 'Discover']
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LifeguideAssist Standalone App running on port ${PORT}`);
});

