// backend/routes/bot.routes.js
import express from "express";
import dotenv from "dotenv";
import { request } from "undici";
import User from "../models/user.js";
import Bot from "../models/bot.model.js";

dotenv.config();
const router = express.Router();

const BIGMODEL_KEY = process.env.BIGMODEL_API_KEY;
const BIGMODEL_URL = process.env.BIGMODEL_BASE_URL + "/api/paas/v4/chat/completions";

// SSE stream endpoint
router.get("/message/stream", async (req, res) => {
  try {
    const text = req.query.text;
    if (!text?.trim()) return res.status(400).json({ error: "Message cannot be empty" });

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // ذخیره پیام کاربر
    await User.create({ sender: "user", text });

    const messagesForAPI = [
      { role: "system", content: "You are a helpful assistant. پاسخ‌ها را به فارسی و انگلیسی بده." },
      { role: "user", content: text },
    ];

    // ارسال درخواست به BigModel
    const response = await request(BIGMODEL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BIGMODEL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-4.6",
        messages: messagesForAPI,
        stream: true,
      }),
    });

    let fullText = "";
    let buffer = "";
    const decoder = new TextDecoder();

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop(); // بقیه برای chunk بعدی

      for (const part of parts) {
        if (!part.startsWith("data:")) continue;

        const dataStr = part.replace(/^data:\s*/, '');
        if (!dataStr || dataStr === "[DONE]") {
          if (fullText.trim()) await Bot.create({ sender: "bot", text: fullText });
          res.write(`data: ${JSON.stringify({ type: "done", content: fullText })}\n\n`);
          res.end();
          return;
        }

        try {
          const json = JSON.parse(dataStr);
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            fullText += token;
            res.write(`data: ${JSON.stringify({ type: "token", token })}\n\n`);
          }
        } catch (err) {
          // JSON ناقص، صبر می‌کنیم تا chunk بعدی
        }
      }
    }

    // اگر استریم بدون [DONE] تمام شد
    if (fullText.trim()) await Bot.create({ sender: "bot", text: fullText });
    res.write(`data: ${JSON.stringify({ type: "done", content: fullText })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Streaming error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
    res.write(`data: ${JSON.stringify({ type: "error", error: "Internal server error" })}\n\n`);
    res.end();
  }
});

export default router;
