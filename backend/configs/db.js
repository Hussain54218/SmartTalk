import mongoose from "mongoose";
const connectDB=async()=>{
    try {
     const conn=await mongoose.connect(process.env.MONGO_URI)
     console.log("connect secussfully")
        
    } catch (error) {
        console.log('connection faild')
    }
}
export default connectDB