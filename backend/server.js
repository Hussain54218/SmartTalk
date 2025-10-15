import express from"express"
import dotenv from "dotenv"
import connectDB from "./configs/db.js";
import hatbot from "./routes/chatbot.rout.js"
import chatbot from "./routes/chatbot.rout.js"
dotenv.config()
const app=express();
const port=process.env.PORT
app.use(express.json())
app.use("/bot/v1",chatbot)
app.listen(port,()=>{
    connectDB()
    console.log(`Server listen on port${port}`)
})