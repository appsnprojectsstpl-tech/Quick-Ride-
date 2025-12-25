import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY');
    if (!firebaseServerKey) {
      console.error('FIREBASE_SERVER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Firebase not configured' }),
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
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
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
    console.error('Error in send-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
