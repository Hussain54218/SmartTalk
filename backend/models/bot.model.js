import mongoose from "mongoose";
const botSchema=new mongoose.Schema({
   text:{
    type:String,
    required:true
   }
},{timestamps:true})
const Bot= mongoose.model("Bot",botSchema);
export default Bot