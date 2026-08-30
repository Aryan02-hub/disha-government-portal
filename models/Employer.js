const mongoose=require('mongoose');
module.exports=mongoose.model('Employer',new mongoose.Schema({company:{type:String,required:true},industry:String,district:String,contact:String,website:String,hired:{type:Number,default:0},verified:{type:Boolean,default:false},avgWage:{type:Number,default:0},createdAt:{type:Date,default:Date.now}}));
