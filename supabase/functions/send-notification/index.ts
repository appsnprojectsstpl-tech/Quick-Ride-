import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to allowed origins
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedPatterns = [
    /^https:\/\/.*\.lovableproject\.com$/,
    /^https:\/\/.*\.lovable\.app$/,
    /^capacitor:\/\/localhost$/,
    /^http:\/\/localhost:\d+$/,
  ];
  
  const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://lovable.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Sanitize error messages for client responses
function sanitizeError(error: unknown): string {
  // Return generic message to client, log detailed error server-side
  console.error('[send-notification] Internal error:', error);
  return 'An error occurred while processing your request';
}

interface NotificationPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTHENTICATION CHECK
    // This function should only be called by other edge functions using the service role key
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Validate that the request is coming from an internal service using service role key
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    
    if (!isServiceRole) {
      // For non-service calls, validate JWT and check admin role
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
      });
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      
      if (authError || !user) {
        console.log('[send-notification] Authentication failed:', authError?.message);
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Only admins can send notifications via direct API call
      const { data: roleData } = await supabaseAuth
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
        
      if (!roleData) {
        console.log('[send-notification] Admin access denied for user:', user.id);
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!firebaseServerKey) {
      console.error('FIREBASE_SERVER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { user_ids, title, body, data = {}, priority = 'high' } = payload;

    console.log(`[send-notification] Sending to ${user_ids.length} users:`, { title, body });

    if (!user_ids || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user_ids provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active device tokens for the users
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('id, token, platform, user_id')
      .in('user_id', user_ids)
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to process notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('[send-notification] No active device tokens found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No active device tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-notification] Found ${tokens.length} device tokens`);

    // Send to FCM
    const fcmResults = await Promise.allSettled(
      tokens.map(async (tokenData) => {
        const fcmPayload = {
          to: tokenData.token,
          priority,
          notification: {
            title,
            body,
            sound: 'default',
            badge: 1,
          },
          data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        };

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${firebaseServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });

        const result = await response.json();
        
        // Check for invalid token errors
        if (result.failure === 1 && result.results?.[0]?.error) {
          const error = result.results[0].error;
          if (error === 'NotRegistered' || error === 'InvalidRegistration') {
            // Mark token as inactive
            console.log(`[send-notification] Deactivating invalid token: ${tokenData.id}`);
            await supabase
              .from('device_tokens')
              .update({ is_active: false })
              .eq('id', tokenData.id);
          }
          throw new Error(error);
        }

        return { tokenId: tokenData.id, success: true };
      })
    );

    const successful = fcmResults.filter(r => r.status === 'fulfilled').length;
    const failed = fcmResults.filter(r => r.status === 'rejected').length;

    console.log(`[send-notification] Results: ${successful} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        failed,
        total: tokens.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
