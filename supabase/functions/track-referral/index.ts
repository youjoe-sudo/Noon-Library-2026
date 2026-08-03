import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const referralCode = url.searchParams.get("code");
    const visitorId = url.searchParams.get("visitor_id");
    const userAgent = req.headers.get("user-agent") || null;

    if (!referralCode || !visitorId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing code or visitor_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call the track_referral_click function
    const { data, error } = await supabase.rpc("track_referral_click", {
      p_referral_code: referralCode,
      p_visitor_id: visitorId,
      p_user_agent: userAgent,
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: "Tracking failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
