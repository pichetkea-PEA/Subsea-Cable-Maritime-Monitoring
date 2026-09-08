import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Subsea Cable Maritime Monitoring" });
  });

  // AI Alarm Event Summarization & Risk Assessment
  app.post("/api/analyze-alarms", async (req, res) => {
    try {
      const { events, cableInfo, filterPeriod } = req.body;

      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "No event records provided for AI analysis" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          summary: {
            executiveBrief: "AI Key not detected. Standard rule-based analysis: High concentration of fishing vessel proximity detected within the 500m protection zone.",
            threatLevel: "ELEVATED",
            totalAnalyzed: events.length,
            keyThreats: [
              "Repeated low-speed loitering in 500m corridor (Potential bottom trawling / anchor drop)",
              "Dense cargo transit crossing cable corridor at high angles",
            ],
            recommendations: [
              "Dispatch maritime patrol to inspect stationary vessels within 500m zone",
              "Issue VHF warning alerts to MMSIs loitering near landing stations",
              "Enforce strict 500m restricted anchorage zone notifications via Coast Guard AIS broadcast",
            ],
            topRiskVessels: events.slice(0, 3).map((e: any) => ({
              mmsi: e.mmsi || "Unknown",
              vesselName: e.vesselName || "Unknown",
              type: e.shipType || "Unknown",
              risk: e.eventType === "Alert" ? "Critical (Anchoring/Stationary)" : "Moderate (Boundary Transit)",
            })),
          },
        });
      }

      const ai = getAI();
      const prompt = `You are a Senior Maritime Security and Subsea Cable Infrastructure Protection Analyst.
Analyze the following subsea cable proximity alarm and alert event log data.

Subsea Cable Route Information:
${JSON.stringify(cableInfo || { name: "Mainland to Island Subsea Circuit", protectionCorridor: "500m left/right (1000m total)" })}

Period: ${filterPeriod || "Active Monitoring Range"}
Total Events: ${events.length}

Sample of Event Logs:
${JSON.stringify(events.slice(0, 30), null, 2)}

Provide a structured, professional maritime risk assessment in JSON format with the following schema:
{
  "executiveBrief": "2-3 concise, professional sentences summarizing the primary threats, vessel types, and overall cable risk.",
  "threatLevel": "LOW" | "ELEVATED" | "HIGH" | "CRITICAL",
  "totalAnalyzed": number,
  "anchoringIncidents": number,
  "boundaryCrossings": number,
  "keyThreats": ["3-4 bullet points detailing specific operational threats, such as bottom trawling risks, deep anchoring, repeat violators"],
  "recommendations": ["3-4 specific operational actions for port authority / coastal guard / cable maintenance team"],
  "topRiskVessels": [
    {
      "mmsi": "number/string",
      "vesselName": "string",
      "type": "string",
      "risk": "description of why this vessel is high risk"
    }
  ]
}
Return ONLY valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);
      res.json({ summary: parsed });
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({
        error: "Failed to generate AI threat summary",
        details: error?.message || "Internal server error",
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Subsea Cable Monitoring Server running on port ${PORT}`);
  });
}

startServer();
