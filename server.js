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

app.post("/ask-agent", upload.array("pdfs", 10), async (req, res) => {
  try {
    const { message, history, pdfContents } = req.body;
    const parsedHistory = history ? JSON.parse(history) : [];
    const parsedPdfContents = pdfContents ? JSON.parse(pdfContents) : [];

    console.log("Question:", message);
    console.log("Question:", message);

    // Build system instruction based on uploaded docs
    const hasDocs =
      parsedPdfContents.length > 0 || (req.files && req.files.length > 0);
    const systemInstruction = hasDocs
      ? "ענה אך ורק על סמך המסמכים שצורפו. אם המידע לא נמצא במסמכים, אמור זאת בבירור."
      : undefined;

    // Convert new uploaded files to base64
    const newFileParts = (req.files || []).map((file) => {
      const data = fs.readFileSync(file.path).toString("base64");
      fs.unlinkSync(file.path);
      return { inlineData: { mimeType: "application/pdf", data } };
    });

    // Convert stored base64 pdfs from previous turns
    const storedFileParts = parsedPdfContents.map((pdf) => ({
      inlineData: { mimeType: "application/pdf", data: pdf.data },
    }));

    const allFileParts = [...storedFileParts, ...newFileParts];

    // Build contents — attach docs to first user message
    let contents = [];

    if (parsedHistory.length <= 1) {
      // First message: attach all docs
      contents = [
        {
          role: "user",
          parts: [...allFileParts, { text: message }],
        },
      ];
    } else {
      // Subsequent messages: re-attach docs to first message, rest is history
      const [firstMsg, ...restHistory] = parsedHistory.slice(0, -1);
      contents = [
        {
          role: "user",
          parts: [...allFileParts, { text: firstMsg?.content || "" }],
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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents,
      ...(systemInstruction && { config: { systemInstruction } }),
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
