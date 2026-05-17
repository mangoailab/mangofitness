const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ScanMetric = number | string | null;

type ParsedScan = {
  source?: string;
  scannedOn?: string;
  bodyWeight?: ScanMetric;
  bodyFatPercent?: ScanMetric;
  fatMass?: ScanMetric;
  skeletalMuscleMass?: ScanMetric;
  bmi?: ScanMetric;
  rmr?: ScanMetric;
  visceralFatLevel?: ScanMetric;
  notes?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function cleanNumber(value: unknown): number | "" {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : "";
}

function cleanDate(value: unknown): string {
  const text = String(value || "").trim();
  const iso = text.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const slash = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})$/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  return "";
}

function validateScan(scan: ParsedScan): ParsedScan {
  const cleaned: ParsedScan = {
    source: scan.source || "AI InBody parser",
    scannedOn: cleanDate(scan.scannedOn),
    bodyWeight: cleanNumber(scan.bodyWeight),
    bodyFatPercent: cleanNumber(scan.bodyFatPercent),
    fatMass: cleanNumber(scan.fatMass),
    skeletalMuscleMass: cleanNumber(scan.skeletalMuscleMass),
    bmi: cleanNumber(scan.bmi),
    rmr: cleanNumber(scan.rmr),
    visceralFatLevel: cleanNumber(scan.visceralFatLevel),
    notes: "Parsed by secure AI scan parser. Review before saving."
  };

  const weight = Number(cleaned.bodyWeight);
  const pbf = Number(cleaned.bodyFatPercent);
  const smm = Number(cleaned.skeletalMuscleMass);
  const fatMass = Number(cleaned.fatMass);

  if (!Number.isFinite(weight) || weight < 70 || weight > 450) cleaned.bodyWeight = "";
  if (!Number.isFinite(pbf) || pbf < 3 || pbf > 60) cleaned.bodyFatPercent = "";
  if (!Number.isFinite(smm) || smm < 25 || smm > 180) cleaned.skeletalMuscleMass = "";
  if (cleaned.bodyWeight && cleaned.skeletalMuscleMass && smm > weight * 0.65) cleaned.skeletalMuscleMass = "";
  if (!Number.isFinite(fatMass) || fatMass < 3 || fatMass > 180) cleaned.fatMass = "";
  if (cleaned.bodyWeight && cleaned.bodyFatPercent && cleaned.fatMass) {
    const expected = weight * pbf / 100;
    if (Math.abs(fatMass - expected) > Math.max(8, weight * 0.08)) cleaned.fatMass = "";
  }
  if (cleaned.bodyWeight && cleaned.bodyFatPercent && !cleaned.fatMass) {
    cleaned.fatMass = Number((weight * pbf / 100).toFixed(1));
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return jsonResponse({ error: "AI parser is not configured yet." }, 503);

  try {
    const { images = [], filename = "InBody scan" } = await req.json();
    if (!Array.isArray(images) || !images.length) return jsonResponse({ error: "No scan image provided." }, 400);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_BODY_SCAN_MODEL") || "gpt-4o-mini",
        temperature: 0,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract only these InBody/body scan fields from the uploaded scan image(s): scan date, body weight in pounds, skeletal muscle mass/SMM in pounds, percent body fat/PBF, body fat mass in pounds if visible, BMI if visible, BMR/RMR if visible, visceral fat level if visible. Filename: ${filename}. Return strict JSON only with keys: source, scannedOn (YYYY-MM-DD), bodyWeight, skeletalMuscleMass, bodyFatPercent, fatMass, bmi, rmr, visceralFatLevel. Use blank string for any uncertain or not visible value. Do not infer SMM from segmental tables. Do not guess.`
            },
            ...images.slice(0, 2).map((image: string) => ({ type: "input_image", image_url: image }))
          ]
        }],
        text: { format: { type: "json_object" } }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return jsonResponse({ error: "AI parser failed.", details }, 502);
    }

    const data = await response.json();
    const raw = data.output_text || data.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text || "{}";
    return jsonResponse({ scan: validateScan(JSON.parse(raw)) });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to parse scan." }, 500);
  }
});
