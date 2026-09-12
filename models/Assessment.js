const mongoose=require('mongoose');
const AssessmentSchema=new mongoose.Schema({
 traineeId:{type:String,index:true},
 courseId:{type:mongoose.Schema.Types.ObjectId,ref:'Course',index:true},
 courseTitle:String,
 moduleKey:String,
 level:Number,
 moduleName:String,
 type:{type:String,default:'Module Assessment'},
 maxScore:{type:Number,default:100},
 score:{type:Number,default:0},
 status:{type:String,enum:['locked','not_started','in_progress','submitted','evaluated','passed','needs_improvement'],default:'not_started'},
 required:{type:Boolean,default:true},
 providerFeedback:String,
 questions:[{question:String,options:[String],correctIndex:{type:Number,default:0}}],
 skillGaps:[String],
 attempts:{type:Number,default:0},
 evaluatedBy:String,
 evaluatedAt:Date
},{timestamps:true});
AssessmentSchema.index({traineeId:1,courseId:1,moduleKey:1},{unique:true});
module.exports=mongoose.model('Assessment',AssessmentSchema);
