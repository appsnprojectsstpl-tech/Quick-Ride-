import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('Starting backend proxy...');
console.log('Supabase URL:', SUPABASE_URL);

// Helper function to call Supabase Edge Functions
async function callEdgeFunction(functionName, body) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  console.log(`Calling edge function: ${functionName}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body)
  });

  return response;
}

// Route handlers
app.post('/api/get-maps-key', async (req, res) => {
  console.log('========================================');
  console.log('Received request for get-maps-key');
  console.log('Method:', req.method);

  // Instead of calling the broken Edge Function, return the API key directly
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not found in environment');
    return res.status(500).json({ error: 'Maps API key not configured' });
  }

  console.log('Returning Maps API key from environment');
  res.json({ apiKey });
});

app.post('/api/get-nearby-captains', async (req, res) => {
  console.log('Received request for get-nearby-captains');
  try {
    const response = await callEdgeFunction('get-nearby-captains', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/get-directions', async (req, res) => {
  console.log('Received request for get-directions');
  try {
    const response = await callEdgeFunction('get-directions', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calculate-fare', async (req, res) => {
  console.log('Received request for calculate-fare');
  try {
    const response = await callEdgeFunction('calculate-fare', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/match-captain-v2', async (req, res) => {
  console.log('Received request for match-captain-v2');
  try {
    const response = await callEdgeFunction('match-captain-v2', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/respond-to-offer', async (req, res) => {
  console.log('Received request for respond-to-offer');
  try {
    const response = await callEdgeFunction('respond-to-offer', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/handle-cancellation', async (req, res) => {
  console.log('Received request for handle-cancellation');
  try {
    const response = await callEdgeFunction('handle-cancellation', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/handle-reassignment', async (req, res) => {
  console.log('Received request for handle-reassignment');
  try {
    const response = await callEdgeFunction('handle-reassignment', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/send-notification', async (req, res) => {
  console.log('Received request for send-notification');
  try {
    const response = await callEdgeFunction('send-notification', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/match-captain', async (req, res) => {
  console.log('Received request for match-captain');
  try {
    const response = await callEdgeFunction('match-captain', req.body);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', routes: app._router.stack.filter(r => r.route).map(r => r.route.path) });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend proxy running on http://localhost:${PORT}`);
  console.log('Available routes:');
  console.log('  POST /api/get-maps-key');
  console.log('  POST /api/get-nearby-captains');
  console.log('  POST /api/get-directions');
  console.log('  POST /api/calculate-fare');
  console.log('  POST /api/match-captain-v2');
  console.log('  POST /api/respond-to-offer');
  console.log('  POST /api/handle-cancellation');
  console.log('  POST /api/handle-reassignment');
  console.log('  POST /api/send-notification');
  console.log('  POST /api/match-captain');
  console.log('  GET  /health');
});
