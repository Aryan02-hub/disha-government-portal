const mongoose=require('mongoose');
const WageSchema=new mongoose.Schema({amount:Number,month:String,source:{type:String,default:'self'},verified:{type:Boolean,default:false}},{_id:false});
const TraineeSchema=new mongoose.Schema({
 traineeId:{type:String,unique:true},name:String,email:{type:String,unique:true,sparse:true},phone:String,
 district:String,course:String,provider:String,trainer:String,batch:String,
 demographics:{gender:String,ageGroup:String,education:String,category:String},
 consent:{type:Boolean,default:false},consentDate:String,contactStatus:{type:String,default:'reachable'},
 trainingStatus:{type:String,enum:['enrolled','training','completed','certified','dropped_out'],default:'enrolled'},
 status:{type:String,enum:['training','certified','job_search','employed','self_employed','apprenticeship','internship','further_education','left_job','dropped_out'],default:'training'},
 attendance:{type:Number,default:0},assessmentScore:{type:Number,default:0},certificateId:String,
 skills:[String],skillGap:[String],marketSkills:[String],
 employer:String,designation:String,employmentStart:String,employerVerified:{type:Boolean,default:false},verificationStatus:{type:String,enum:['not_requested','pending','verified','disputed'],default:'not_requested'},
 wage:{type:Number,default:0},wageHistory:[WageSchema],retention:{month3:Boolean,month6:Boolean,month12:Boolean,month24:Boolean,month36:Boolean,month60:Boolean},
 trainingCompletionDate:String,
 selfEmployment:{businessName:String,sector:String,monthlyIncome:Number},
 apprenticeship:{organization:String,trade:String,stipend:Number,startDate:String},
 nonPlacementReason:String,attritionReason:String,currentAddress:String,jobLocation:String,jobRelatedToTraining:String,jobSatisfaction:String,salarySatisfaction:String,workLifeBalance:String,careerGrowth:String,jobEndDate:String,jobLeaveReason:String,currentlyJobSearching:String,expectedSalary:Number,reskillingNeeded:String,preferredJobRole:String,resumeSummary:String,profileUpdatedAt:Date,feedbackRating:{type:Number,min:1,max:5},feedbackText:String,improvementSuggestions:String,aiAnalysis:{employabilityScore:Number,riskLevel:String,strengths:[String],skillGaps:[String],recommendations:[String],marketDemand:[String],summary:String,lastAnalyzedAt:Date},lastOutcomeUpdate:String,createdAt:{type:Date,default:Date.now}
});
module.exports=mongoose.model('Trainee',TraineeSchema);
