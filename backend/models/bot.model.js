import mongoose from "mongoose";

const botSchema = new mongoose.Schema({
  sender: { type: String, enum: ["bot","user"], default: "bot" },
  text: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Bot", botSchema);
