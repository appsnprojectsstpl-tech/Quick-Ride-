# Test the Render backend deployment

# Replace YOUR_RENDER_URL with your actual Render URL
# Example: https://swift-ride-backend.onrender.com

# Test 1: Health check (if you add one)
curl https://YOUR_RENDER_URL.onrender.com/

# Test 2: Get Maps API Key
curl -X POST https://YOUR_RENDER_URL.onrender.com/api/get-maps-key \
  -H "Content-Type: application/json"

# Test 3: Get Nearby Captains
curl -X POST https://YOUR_RENDER_URL.onrender.com/api/get-nearby-captains \
  -H "Content-Type: application/json" \
  -d '{"lat": 12.9716, "lng": 77.5946, "radius_km": 5}'

# If you see valid responses, the backend is working!
