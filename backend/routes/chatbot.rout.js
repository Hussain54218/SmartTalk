import express from "express"
import { message } from "../controllers/chatbot.controller.js"
const router=express.Router()

router.post('/message',message)
export default router