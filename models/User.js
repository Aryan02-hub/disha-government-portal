const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  password:{type:String,required:true},
  role:{type:String,enum:['admin','trainee','provider','employer'],default:'trainee'},
  linkedId:{type:mongoose.Schema.Types.ObjectId,default:null},
  createdAt:{type:Date,default:Date.now}
});
module.exports=mongoose.model('User',UserSchema);
