import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./configs/db.js";
import chatbot from "./routes/chatbot.rout.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/bot/v1", chatbot);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error("MongoDB connection failed:", err));
