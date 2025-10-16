import dotenv from "dotenv";
import fetch from "node-fetch";
import User from "../models/user.js";
import Bot from "../models/bot.model.js";

dotenv.config();

const BIGMODEL_KEY = process.env.BIGMODEL_API_KEY;
const BIGMODEL_URL = process.env.BIGMODEL_BASE_URL + "/api/paas/v4/chat/completions";

export const message = async (req, res) => {
  try {
    const { text } = req.query;
    if (!text?.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Store user message immediately
    await User.create({ sender: "user", text });

    const response = await fetch(BIGMODEL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BIGMODEL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-4.6",
        stream: true,
        messages: [
          { role: "system", content: "You are a helpful AI chatbot." },
          { role: "user", content: text }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", errorText);
      return res.status(500).json({ error: "Model request failed" });
    }

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    let fullContent = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data.trim() === '[DONE]') {
              // Save the complete bot message to database
              if (fullContent.trim()) {
                await Bot.create({ sender: "bot", text: fullContent });
              }
              
              res.write(`data: ${JSON.stringify({ type: "done", content: fullContent })}\n\n`);
              res.end();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                fullContent += content;
                res.write(`data: ${JSON.stringify({ 
                  type: "token", 
                  token: content,
                  fullContent: fullContent 
                })}\n\n`);
              }
            } catch (parseError) {
              console.error('Parse error:', parseError);
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final save if stream ends without [DONE]
    if (fullContent.trim()) {
      await Bot.create({ sender: "bot", text: fullContent });
    }

    res.write(`data: ${JSON.stringify({ type: "done", content: fullContent })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Streaming error:", error);
    
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: "error", 
      error: "Internal server error" 
    })}\n\n`);
    res.end();
  }
};