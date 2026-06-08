import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import fs from "fs";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors({ origin: "*" }));
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("AI Agent is working");
});

app.post("/ask-agent", upload.single("pdf"), async (req, res) => {
  try {
    const { message, history } = req.body;
    const parsedHistory = history ? JSON.parse(history) : [];

    console.log("Question:", message);

    let contents = [];

    if (req.file) {
      // קרא את הPDF כ-base64
      const pdfData = fs.readFileSync(req.file.path);
      const base64Pdf = pdfData.toString("base64");

      // מחק את הקובץ הזמני
      fs.unlinkSync(req.file.path);

      contents = [
        ...parsedHistory.slice(0, -1).map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf,
              },
            },
            {
              text: `ענה רק על סמך המסמך שצורף. השאלה: ${message}`,
            },
          ],
        },
      ];
    } else {
      contents = [
        ...parsedHistory.slice(0, -1).map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        {
          role: "user",
          parts: [{ text: message }],
        },
      ];
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents,
    });

    res.json({ answer: response.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
