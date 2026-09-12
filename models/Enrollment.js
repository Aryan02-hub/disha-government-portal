const mongoose=require('mongoose');
const EnrollmentSchema=new mongoose.Schema({
 traineeId:String,courseId:{type:mongoose.Schema.Types.ObjectId,ref:'Course'},courseCode:String,courseTitle:String,
 status:{type:String,enum:['applied','enrolled','training','completed','certified','rejected','dropped_out'],default:'applied'},
 appliedAt:{type:Date,default:Date.now},enrolledAt:Date,completedAt:Date,certificateId:String
},{timestamps:true});
module.exports=mongoose.model('Enrollment',EnrollmentSchema);
