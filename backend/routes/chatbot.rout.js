import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import User from "../models/user.js";
import Bot from "../models/bot.model.js";

dotenv.config();
const router = express.Router();
const BIGMODEL_KEY = process.env.BIGMODEL_API_KEY;
const BIGMODEL_URL = process.env.BIGMODEL_BASE_URL + "/api/paas/v4/chat/completions";

// گرفتن پیام‌های قبلی
const getMessageHistory = async () => {
  const userMsgs = await User.find().sort({ createdAt: 1 });
  const botMsgs = await Bot.find().sort({ createdAt: 1 });
  const allMsgs = [];

  let i = 0, j = 0;
  while (i < userMsgs.length || j < botMsgs.length) {
    if (i < userMsgs.length) {
      allMsgs.push({ role: "user", content: userMsgs[i].text });
      i++;
    }
    if (j < botMsgs.length) {
      allMsgs.push({ role: "assistant", content: botMsgs[j].text });
      j++;
    }
  }
  return allMsgs;
};

// ارسال پیام به ربات
router.post("/message", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "پیام نمی‌تواند خالی باشد" });

    // ذخیره پیام کاربر
    const userMessage = await User.create({ text, sender: "user" });

    // تاریخچه پیام‌ها
    const messagesHistory = await getMessageHistory();

    // پیام برای API
    const messagesForAPI = [
      { role: "system", content: "You are a helpful AI assistant. پاسخ‌ها را به فارسی و انگلیسی روان بده." },
      ...messagesHistory,
      { role: "user", content: text }
    ];

    // درخواست به BigModel
    const response = await axios.post(BIGMODEL_URL, {
      model: "glm-4.6",
      messages: messagesForAPI,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 1024
    }, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BIGMODEL_KEY}`
      }
    });

    const botReply = response.data.choices?.[0]?.message?.content || "متاسفم، پاسخی دریافت نشد.";

    // ذخیره پاسخ ربات
    const botMessage = await Bot.create({ text: botReply, sender: "bot" });

    res.status(200).json({ userMessage: userMessage.text, botMessage: botMessage.text });

  } catch (error) {
    console.error("AI message error:", error.response?.data || error.message);
    res.status(500).json({ error: "خطا در پردازش پیام" });
  }
});

// پاک کردن همه پیام‌ها برای چت جدید
router.post("/new-chat", async (req, res) => {
  try {
    await User.deleteMany({});
    await Bot.deleteMany({});
    res.status(200).json({ message: "چت جدید ایجاد شد." });
  } catch (err) {
    res.status(500).json({ error: "خطا در ایجاد چت جدید" });
  }
});

export default router;
