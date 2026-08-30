const mongoose=require('mongoose');
module.exports=mongoose.model('Provider',new mongoose.Schema({name:{type:String,required:true},district:String,contact:String,courses:[String],trainees:{type:Number,default:0},placementRate:{type:Number,default:0},verified:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now}}));
