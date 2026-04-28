import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const upload = multer({ 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  storage: multer.memoryStorage()
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
  app.post("/api/freakify", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      let apiKeyHeader = req.headers['x-goog-api-key'] as string;
      if (apiKeyHeader === "undefined" || apiKeyHeader === "null" || !apiKeyHeader) apiKeyHeader = "";
      const apiKey = apiKeyHeader || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are the master of 'The Bizarre Imaginarium'. Your job is to take user prompts and expand them into highly descriptive, surreal, eerie, and visually striking "director's cut" video prompts. Do not use conversational filler, just return the vividly enhanced visual prompt. Focus on lighting, weird textures, impossible geometry, surrealism, and haunting aesthetics. Keep it strictly focused on visual generation.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: { systemInstruction }
      });

      res.json({ enhancedPrompt: response.text });
    } catch (error: any) {
      console.error("Error freakifying prompt:", error);
      let errorMsg = "Failed to enhance prompt";
      if (error?.message?.includes("API key not valid") || error?.message?.includes("API_KEY_INVALID")) {
        errorMsg = "Invalid Gemini API Key. Please configure a valid GEMINI_API_KEY in the Secrets menu.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  app.post("/api/generate-video", upload.single('media'), async (req, res) => {
    try {
      const { prompt, mode } = req.body;
      const media = req.file;

      // Code Block 1: API Key & Context Initialization
      // We extract the API key from the frontend headers or fallback to environment variables.
      let apiKeyHeader = req.headers['x-goog-api-key'] as string;
      if (apiKeyHeader === "undefined" || apiKeyHeader === "null" || !apiKeyHeader) apiKeyHeader = "";
      const apiKey = apiKeyHeader || process.env.GEMINI_API_KEY;

      if (!apiKey) {
         return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server. Please add it to your Secrets menu." });
      }

      console.log(`Starting Veo generation for mode: ${mode}`);
      // Initialize the official Google Gen AI SDK for Veo/Gemini
      const ai = new GoogleGenAI({ apiKey });
      let operation;

      // Code Block 2: Model Invocation (Veo API)
      // Depending on the mode selected by the user, we structure the API call to Veo.
      if (mode === 'text-to-video') {
         // Sub-block 2a: Text-to-Video generation using Veo 2.0
         operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
         });
      } else if (mode === 'image-to-video') {
         // Sub-block 2b: Image-to-Video generation using Veo 2.0 along with an image buffer
         if (!media) {
           return res.status(400).json({ error: "Media file is required for this mode." });
         }
         operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: {
              imageBytes: media.buffer.toString("base64"),
              mimeType: media.mimetype,
            },
         });
      } else {
         return res.status(400).json({ error: "Invalid mode for Veo." });
      }

      // Code Block 3: Asynchronous Polling
      // The generateVideos API returns a long-running operation. 
      // We must periodically poll this operation until `operation.done` is true.
      let attempts = 0;
      while (operation && !operation.done && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks
        operation = await ai.operations.getVideosOperation({operation});
        attempts++;
      }

      // Code Block 4: Artifact Retrieval and Delivery
      // Once done, extract the URI that point to the newly generated Veo Video
      const downloadLink = operation?.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("No video URI returned from the API.");

      // Fetch the binary video bytes using the API key for authorization
      const fetchVideo = await fetch(downloadLink, {
        method: 'GET',
        headers: {
           'x-goog-api-key': apiKey,
        }
      });
      
      if (!fetchVideo.ok) throw new Error("Failed to fetch generated video bytes.");
      
      // Convert the binary stream to a base64 encoded string format for frontend consumption
      const videoBuffer = await fetchVideo.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');
      const dataUri = `data:video/mp4;base64,${videoBase64}`;

      // Code Block 5: Success Response
      res.json({ videoUrl: dataUri });

    } catch (error: any) {
      console.error("Error generating video:", error);
      let msg = error.message || "An error occurred during video generation.";
      if (msg.includes("insufficient authentication scopes") || msg.includes("permission denied")) {
        msg = "Your Gemini API Key lacks permission for Veo. Veo video generation may not be available for your API Key. Please verify your access.";
      } else if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID")) {
        msg = "Invalid Gemini API Key. Please configure a valid GEMINI_API_KEY in the Secrets menu.";
      }
      res.status(500).json({ error: msg });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler for middleware like multer
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
