import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "100mb" }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get("/", (req, res) => res.send("AI Agent is working"));

app.post("/ask-agent", async (req, res) => {
  try {
    const { message, history = [], pdfContents = [] } = req.body;

    console.log("Question:", message);
    console.log("Docs:", pdfContents.length, "History:", history.length);

    const hasDocs = pdfContents.length > 0;

    const allFileParts = pdfContents.map((pdf) => ({
      inlineData: { mimeType: "application/pdf", data: pdf.data },
    }));

    let contents = [];

    if (history.length <= 1) {
      contents = [
        {
          role: "user",
          parts: [...allFileParts, { text: message }],
        },
      ];
    } else {
      const [firstMsg, ...restHistory] = history.slice(0, -1);
      contents = [
        {
          role: "user",
          parts: [...allFileParts, { text: firstMsg?.content || message }],
        },
        ...restHistory.map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ];
    }

    const config = hasDocs
      ? {
          systemInstruction:
            "ענה אך ורק על סמך המסמכים שצורפו. אם המידע לא נמצא במסמכים, אמור זאת בבירור.",
        }
      : undefined;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents,
      ...(config && { config }),
    });

    res.json({ answer: response.text });
  } catch (error) {
    console.error("ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
