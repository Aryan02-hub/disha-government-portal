const mongoose=require('mongoose');
module.exports=mongoose.model('Job',new mongoose.Schema({title:String,company:String,employerId:String,location:String,skills:[String],salary:String,description:String,status:{type:String,default:'open'},createdAt:{type:Date,default:Date.now}}));
