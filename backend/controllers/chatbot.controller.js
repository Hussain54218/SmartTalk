import axios from "axios";
import dotenv from "dotenv";
import User from "../models/user.js";
import Bot from "../models/bot.model.js";

dotenv.config();

const BIGMODEL_KEY = process.env.BIGMODEL_API_KEY;
const BIGMODEL_URL = process.env.BIGMODEL_BASE_URL + "/api/paas/v4/chat/completions";

export const message = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) return res.status(400).json({ error: "Message cannot be empty" });

   
    const userMessage = await User.create({ sender: "user", text });

 
    const response = await axios.post(
      BIGMODEL_URL,
      {
        model: "glm-4.6",  
        messages: [
          { role: "system", content: "You are a helpful and friendly AI chatbot." },
          { role: "user", content: text }
        ],
        temperature: 0.6,
        max_tokens: 1024
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${BIGMODEL_KEY}`
        }
      }
    );

    const botReply = response.data.choices?.[0]?.message?.content || "متاسفم، پاسخی دریافت نشد.";

    // ذخیره پاسخ ربات
    const botMessage = await Bot.create({ sender: "bot", text: botReply });

    res.status(200).json({ userMessage: userMessage.text, botMessage: botMessage.text });

  } catch (error) {
    console.error("AI message error:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
