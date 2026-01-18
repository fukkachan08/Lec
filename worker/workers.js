export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
    }

    const prompt = String(body.prompt ?? "").trim();
    const nRaw = Number(body.n ?? 5);
    const maxOutRaw = Number(body.max_output_tokens ?? 90);

    if (!prompt) {
      return new Response("prompt is required", { status: 400, headers: corsHeaders });
    }

    // ガード（授業用に暴発防止）
    const N_MAX = 10;
    const TOK_MAX = 160;
    const n = Math.min(N_MAX, Math.max(1, Number.isFinite(nRaw) ? Math.floor(nRaw) : 5));
    const max_output_tokens = Math.min(TOK_MAX, Math.max(20, Number.isFinite(maxOutRaw) ? Math.floor(maxOutRaw) : 90));

    const outputs = [];
    for (let i = 0; i < n; i++) {
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: prompt,
          max_output_tokens,
        }),
      });

      if (!r.ok) {
        const t = await r.text();
        return new Response(`OpenAI error: ${t}`, { status: 502, headers: corsHeaders });
      }

      const data = await r.json();
      outputs.push((data.output_text ?? "").trim());
    }

    return new Response(JSON.stringify({ outputs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
