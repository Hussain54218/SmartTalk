import Bot from "../models/bot.model.js";
import User from "../models/user.js";
import user from "../models/user.js";

export const message = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ error: "message cont be empty" });
    }
    const user = await User.create({
      sender: "user",
      text,
    });
    const botresponses = {
      hello: "Hi there! How can I assist you today?",
      "how are you": "I'm just a bot, but I'm doing great! How about you?",
      "what is your name":
        "I'm your friendly AI assistant created by Hussain 🤖",
      "what can you do":
        "I can answer your questions and help you with basic information.",
      "what is html":
        "HTML stands for HyperText Markup Language and is used to create web pages.",
      "what is css":
        "CSS stands for Cascading Style Sheets and is used to style web pages.",
      "what is javascript":
        "JavaScript is a programming language used to make web pages interactive.",
      "what is react":
        "React is a JavaScript library for building user interfaces, created by Facebook.",
      "what is node js":
        "Node.js is a runtime environment that allows JavaScript to run on the server side.",
      "what is express js":
        "Express is a minimal and flexible Node.js web framework for building APIs.",
      "what is mongodb":
        "MongoDB is a NoSQL database that stores data in JSON-like documents.",
      "what is api":
        "API stands for Application Programming Interface. It allows communication between software systems.",
      "what is frontend":
        "Frontend is the part of a website that users interact with directly.",
      "what is backend":
        "Backend refers to the server-side logic, databases, and APIs that power applications.",
      "what is full stack":
        "Full stack development involves both frontend and backend technologies.",
      "who created you":
        "I was created by Hussain while learning how to build chatbots!",
      "thank you": "You're welcome! 😊",
      bye: "Goodbye! Have a nice day 🌸",
    };
    const normalize=text.toLowerCase().trim()
    const botresponse=botresponses[normalize]||"sorry i don't understand that"
    const bot=await Bot.create({
        text:botresponse
    })
    return res.status(200).json({
        userMessage:user.text,
        botMessage:bot.text
    })
  } catch (error) {
    console.log("message error")
    res.status(500).json({error:"internal server error"})
  }
};
