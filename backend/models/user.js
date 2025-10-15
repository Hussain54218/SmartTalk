import mongoose from "mongoose";
const userSchema=new mongoose.Schema({
    sender:{
        type:String,
        required:true,
        enum:["user"]
    },
    text:{
        type:String,
        required:true
    }
},{timestamps:true})
const User= mongoose.model("User",userSchema);
export default User