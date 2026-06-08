import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import fs from "fs";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get("/", (req, res) => res.send("AI Agent is working"));

app.post("/ask-agent", upload.array("pdfs", 10), async (req, res) => {
  try {
    const { message, history, pdfContents } = req.body;
    const parsedHistory = history ? JSON.parse(history) : [];
    const parsedPdfContents = pdfContents ? JSON.parse(pdfContents) : [];

    console.log("Question:", message);
    console.log(
      "Docs:",
      parsedPdfContents.length,
      "History:",
      parsedHistory.length,
    );

    const hasDocs =
      parsedPdfContents.length > 0 || (req.files && req.files.length > 0);

    const newFileParts = (req.files || []).map((file) => {
      const data = fs.readFileSync(file.path).toString("base64");
      fs.unlinkSync(file.path);
      return { inlineData: { mimeType: "application/pdf", data } };
    });

    const storedFileParts = parsedPdfContents.map((pdf) => ({
      inlineData: { mimeType: "application/pdf", data: pdf.data },
    }));

    const allFileParts = [...storedFileParts, ...newFileParts];

    let contents = [];

    if (parsedHistory.length <= 1) {
      contents = [
        {
          role: "user",
          parts: [...allFileParts, { text: message }],
        },
      ];
    } else {
      const [firstMsg, ...restHistory] = parsedHistory.slice(0, -1);
      contents = [
        {
          role: "user",
          parts: [...allFileParts, { text: firstMsg?.content || message }],
        },
        ...restHistory.map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        {
          role: "user",
          parts: [{ text: message }],
        },
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
    console.error("ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
