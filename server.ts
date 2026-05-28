import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with a limit to handle potential image files
app.use(express.json({ limit: "15mb" }));

// Lazy initializer for Google GenAI client
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("A chave GEMINI_API_KEY não está configurada nos Secrets.");
    }
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAI;
}

// 1. API: Analyze Lyrics and Estimate Timestamps
app.post("/api/analyze-lyrics", async (req, res) => {
  try {
    const { title, artist, lyrics } = req.body;
    if (!lyrics) {
      return res.status(400).json({ error: "Letra da música é obrigatória." });
    }

    const ai = getGenAI();

    const prompt = `Analise a letra da música abaixo${title ? ` intitulada "${title}"` : ""}${artist ? ` do artista "${artist}"` : ""}.
Divida-a em frases ou linhas lógicas cantadas individualmente. Para cada linha, estime uma minutagem aproximada de início (startTime) e fim (endTime) em segundos, prevendo um ritmo musical médio ou normal.
O tempo de início de cada linha deve ser sequencial e cronológico (sem sobrepor tempos de maneira inválida, exceto pausas instrumentais normais).
Retorne os itens na ordem da música.

Letra da música:
${lyrics}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Você é um produtor profissional de karaokê. Seu papel é analisar letras e prever com precisão os tempos de sincronização de cada frase da música para servir de rascunho inicial.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "O texto exato da linha da música"
              },
              startTime: {
                type: Type.NUMBER,
                description: "Tempo estimado em segundos de quando a linha começa a ser cantada"
              },
              endTime: {
                type: Type.NUMBER,
                description: "Tempo estimado em segundos de quando a frase termina"
              }
            },
            required: ["text", "startTime", "endTime"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "[]");
    return res.json({ lines: parsedData });
  } catch (error: any) {
    console.error("Erro ao analisar letra:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao analisar a letra." });
  }
});

// 2. API: Generate background image with Gemini 2.5 Image model
app.post("/api/generate-bg", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt de imagem é obrigatório." });
    }

    const ai = getGenAI();

    const imagePrompt = `A high quality, aesthetic background image for a karaoke screen video overlay, description: ${prompt}. Clean, beautiful aesthetic, non-intrusive elements, plenty of dark space, gradient, styled. No text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { text: imagePrompt },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("O modelo de IA não retornou uma imagem válida.");
    }

    return res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
  } catch (error: any) {
    console.error("Erro ao gerar imagem de fundo:", error);
    const errorMsg = error.message || "";
    if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("429")) {
      return res.status(429).json({
        error: "Quota gratuita de geração de imagem excedida no Gemini (Erro 429). Limites de uso diário deste modelo foram atingidos. Prossiga sem problemas selecionando um dos lindos degradês ou enviando uma imagem de fundo de sua escolha!",
        isQuotaExceeded: true
      });
    }
    return res.status(500).json({ error: errorMsg || "Erro ao gerar imagem com IA." });
  }
});

// Start server setup with Vite
async function startServer() {
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
