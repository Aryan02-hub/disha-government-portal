const mongoose=require('mongoose');
const CourseSchema=new mongoose.Schema({
 code:{type:String,unique:true},title:String,sector:String,description:String,skills:[String],
 duration:String,mode:{type:String,default:'Offline'},language:{type:String,default:'Hindi / English'},
 eligibility:String,provider:String,district:String,seats:{type:Number,default:30},fee:{type:String,default:'Government Sponsored'},
 certification:{type:Boolean,default:true},certificateName:String,status:{type:String,default:'open'},scheme:{type:String,default:'Government Skilling Programme'},startDate:String,endDate:String
},{timestamps:true});
module.exports=mongoose.model('Course',CourseSchema);
