# Swift Ride Backend

Backend proxy server for Swift Ride application. Handles CORS and routes requests to Supabase Edge Functions.

## Environment Variables

Required environment variables:

```
PORT=3001
SUPABASE_URL=https://gpdnebrvlwwdenaboyxk.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
GOOGLE_MAPS_API_KEY=your_maps_api_key_here
```

## Local Development

```bash
npm install
npm start
```

## Deployment to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following:
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Root Directory:** Leave empty (or set to `backend`)
4. Add environment variables in Render dashboard

## API Endpoints

All endpoints proxy to Supabase Edge Functions:

- POST `/api/get-maps-key` - Get Google Maps API key
- POST `/api/get-nearby-captains` - Find nearby captains
- POST `/api/calculate-fare` - Calculate ride fare
- POST `/api/get-directions` - Get route directions
- POST `/api/match-captain-v2` - Match rider with captain
- POST `/api/respond-to-offer` - Captain responds to ride offer
- POST `/api/handle-cancellation` - Handle ride cancellation
- POST `/api/send-notification` - Send push notification
