require('dotenv').config();
const express=require('express'),mongoose=require('mongoose'),bcrypt=require('bcrypt'),jwt=require('jsonwebtoken'),path=require('path'),cors=require('cors'),nodemailer=require('nodemailer'),multer=require('multer'),fs=require('fs');
let pdfParse=null,mammoth=null;try{pdfParse=require('pdf-parse');mammoth=require('mammoth')}catch(e){console.warn('[Resume] parser modules not ready:',e.message)}
const User=require('./models/User'),Trainee=require('./models/Trainee'),Provider=require('./models/Provider'),Employer=require('./models/Employer'),Job=require('./models/Job'),FollowUp=require('./models/FollowUp'),Verification=require('./models/Verification'),Course=require('./models/Course'),Enrollment=require('./models/Enrollment'),Assessment=require('./models/Assessment');
const auth=require('./middleware/auth');
let twilioClient=null;
try {
  if(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN){
    twilioClient=require('twilio')(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN);
  }
} catch(e){ console.warn('[Twilio] Not initialized:', e.message); }
console.log('[Twilio] Account SID:', process.env.TWILIO_ACCOUNT_SID ? 'FOUND' : 'MISSING');
console.log('[Twilio] Auth Token:', process.env.TWILIO_AUTH_TOKEN ? 'FOUND' : 'MISSING');
console.log('[Twilio] SMS Sender:', process.env.TWILIO_PHONE_NUMBER ? 'FOUND' : 'MISSING');
console.log('[Twilio] Client:', twilioClient ? 'READY' : 'NOT CONFIGURED');
let mailTransporter=null;
try{
  if(process.env.SMTP_USER && process.env.SMTP_PASS){
    if(String(process.env.SMTP_SERVICE||'').toLowerCase()==='gmail'){
      mailTransporter=nodemailer.createTransport({service:'gmail',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
    }else if(process.env.SMTP_HOST){
      mailTransporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
    }
  }
}catch(e){ console.warn('[Email] Not initialized:',e.message); }
if(mailTransporter){ mailTransporter.verify().then(()=>console.log('[Email] Gmail/SMTP connection: VERIFIED')).catch(e=>console.warn('[Email] Connection check failed:',e.message)); }
console.log('[Email] SMTP:',mailTransporter?'READY (real delivery)':'DEMO MODE (configure Gmail App Password for real delivery)');
const app=express();
app.use(cors());app.use(express.json({limit:'2mb'}));const upload=multer({dest:path.join(__dirname,'uploads'),limits:{fileSize:5*1024*1024}});app.use(express.static(path.join(__dirname,'public')));
const PORT=process.env.PORT||5000,secret=process.env.JWT_SECRET||'disha_dev_secret';
const nextId=async()=>`TR-${String(8801+await Trainee.countDocuments()).padStart(4,'0')}`;
const safe=fn=>(req,res)=>Promise.resolve(fn(req,res)).catch(e=>res.status(500).json({message:e.message}));
const assessmentTemplates={
 'Data Analytics':['Spreadsheet Foundations','SQL & Data Querying','Power BI Dashboard Project'],
 'Web Development':['HTML & CSS Foundations','JavaScript & DOM','Responsive Web Project'],
 'CNC Machining':['Machine & Safety Basics','CNC Operation','Quality Control Practical'],
 'Retail & Sales':['Customer Service','Sales & Billing','Digital Retail Simulation'],
 'Solar PV Technician':['Electrical Safety','Solar Installation','Maintenance Practical'],
 'Power BI':['Data Modelling','DAX & Measures','Interactive Dashboard Project']
};
function defaultQuestions(course,level){
 const banks={
  'Data Analytics':[['What should be done before analysing data?',['Clean and validate data','Ignore missing values','Delete every column'],0],['Which language queries relational databases?',['SQL','HTML','CSS'],0],['A useful dashboard provides:',['Clear actionable insights','Only raw rows','Unrelated animations'],0]],
  'Web Development':[['Which language structures a web page?',['HTML','CSS','SQL'],0],['Which technology styles a web page?',['CSS','MongoDB','C++'],0],['Responsive design means:',['Adapts to screen size','Desktop only','No mobile support'],0]],
  'CNC Machining':[['What is essential before CNC operation?',['Safety and machine checks','Skip checks','Maximum speed'],0],['Accurate output needs:',['Correct program and tool offsets','Random settings','Ignored tolerances'],0],['Quality control verifies:',['Dimensions and tolerances','Machine colour','Nothing'],0]],
  'Retail & Sales':[['Good customer service starts by:',['Understanding customer needs','Ignoring the customer','Arguing'],0],['CRM is used to:',['Manage customer relationships','Repair machines','Write operating systems'],0],['A good sale should provide:',['Clear accurate next steps','False promises','No record'],0]],
  'Solar PV Technician':[['Before electrical work, check:',['Isolation and PPE','Only weather','Nothing'],0],['Solar PV converts:',['Sunlight into electricity','Water into petrol','Air into coal'],0],['Maintenance should include:',['Inspection and performance checks','Ignoring faults','Removing protection'],0]],
  'Power BI':[['Before modelling, you should:',['Clean and transform data','Publish empty visuals','Delete tables'],0],['DAX is used for:',['Measures and calculations','HTML styling','Welding'],0],['An effective dashboard uses:',['Clear KPIs and relevant visuals','Every chart possible','Hidden values'],0]]
 };
 const qs=banks[course]||[['What supports effective skill learning?',['Core concepts','Skipping practice','Random guessing'],0],['Applied work should include:',['Practice and feedback','Avoiding tasks','No evidence'],0],['Final assessment demonstrates:',['Real skill application','Only attendance','No work'],0]];
 return qs.map(q=>({question:q[0],options:q[1],correctIndex:q[2]}));
}
async function refreshAssessmentSummary(traineeId){
 const rows=await Assessment.find({traineeId});
 const done=rows.filter(x=>['passed','needs_improvement','evaluated'].includes(x.status));
 const avg=done.length?Math.round(done.reduce((sum,x)=>sum+Number(x.score||0),0)/done.length):0;
 await Trainee.findOneAndUpdate({traineeId},{assessmentScore:avg});
 return {rows,avg};
}
async function ensureCourseAssessments(trainee,course){
 if(!course)return [];
 const existing=await Assessment.find({traineeId:trainee.traineeId,courseTitle:course.title});
 if(existing.length)return existing;
 const names=assessmentTemplates[course.title]||['Foundation','Applied Skills','Final Practical'];
 return Assessment.insertMany(names.map((name,i)=>({traineeId:trainee.traineeId,courseId:course._id,courseTitle:course.title,moduleKey:`L${i+1}`,level:i+1,moduleName:`Level ${i+1} · ${name}`,type:i===2?'Final Practical / Project':'Module Assessment',questions:defaultQuestions(course.title,i+1)})));
}

const marketProfiles={
 'Data Analytics':['SQL','Python','Power BI','Excel','Data Cleaning','Statistics'],
 'Web Development':['HTML','CSS','JavaScript','React','Node.js','Git'],
 'CNC Machining':['CNC Operation','Machine Safety','Quality Control','Blueprint Reading','CNC Programming'],
 'Retail & Sales':['Customer Service','Sales','CRM','Billing','Digital Tools'],
 'Solar PV Technician':['Electrical Safety','Solar Installation','Maintenance','Troubleshooting'],
 'Power BI':['Power BI','DAX','Data Modelling','SQL','Data Visualization']
};
function normalizeSkill(x){return String(x||'').trim().toLowerCase()}
async function buildDishaAnalysis(t){
 const expected=marketProfiles[t.course]||['Communication','Digital Skills','Problem Solving'];
 const jobs=await Job.find({});
 const internalDemand={}; jobs.forEach(j=>(j.skills||[]).forEach(sk=>{const k=String(sk).trim();if(k)internalDemand[k]=(internalDemand[k]||0)+1}));
 const demandSkills=Object.entries(internalDemand).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
 const current=[...(t.skills||[]),...(t.marketSkills||[])];
 const currentNorm=current.map(normalizeSkill);
 const gaps=[...new Set([...expected,...demandSkills].filter(sk=>!currentNorm.includes(normalizeSkill(sk))))].slice(0,6);
 const strengths=[...new Set(current.filter(Boolean))].slice(0,6);
 let score=Math.round(Math.min(20,Number(t.attendance||0)/5)+Math.min(25,Number(t.assessmentScore||0)/4));
 if(['employed','self_employed','apprenticeship','internship'].includes(t.status))score+=25;
 else if(t.status==='job_search')score+=10;
 if(String(t.jobSatisfaction||'').toLowerCase()==='high')score+=15;else if(String(t.jobSatisfaction||'').toLowerCase()==='medium')score+=9;else score+=4;
 const matched=expected.filter(sk=>currentNorm.includes(normalizeSkill(sk))).length;score+=Math.round((expected.length?matched/expected.length:0)*15);score=Math.max(0,Math.min(100,score));
 const riskLevel=score>=75?'Low':score>=50?'Medium':'High';
 const recommendations=[];
 if(Number(t.attendance||0)<75)recommendations.push('Improve attendance and complete missed learning hours.');
 if(Number(t.assessmentScore||0)<80)recommendations.push('Take targeted practice assessments before the next evaluation.');
 if(gaps.length)recommendations.push('Prioritise '+gaps.slice(0,3).join(', ')+'.');
 if(t.status==='left_job')recommendations.push('Use DishaAI interview and reskilling plan before the next job application.');
 if(!recommendations.length)recommendations.push('Maintain current skills and track new employer demand.');
 const summary=`${score}/100 employability score. ${riskLevel} outcome risk. ${gaps.length?`Key gaps: ${gaps.slice(0,3).join(', ')}.`:'Strong alignment with current course skills.'}`;
 return {employabilityScore:score,riskLevel,strengths,skillGaps:gaps,recommendations,marketDemand:demandSkills.slice(0,8),summary,lastAnalyzedAt:new Date()};
}
function nextQuizQuestion(course,step){const qs=defaultQuestions(course||'General',1);const q=qs[step%qs.length];return {question:q.question,options:q.options,correctIndex:q.correctIndex}}
async function sendEmail(to,subject,text,html){
 if(!mailTransporter)return {sent:false,mode:'demo'};
 try{const info=await mailTransporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text,html:html||undefined});return {sent:true,mode:'real',messageId:info.messageId};}
 catch(e){console.warn('[Email] delivery failed:',e.message);return {sent:false,mode:'demo',error:e.message};}
}
async function createFeedbackFollowUp(t){
 const existing=await FollowUp.findOne({traineeId:t.traineeId,stage:'Post-training feedback',status:'pending'});
 if(existing)return existing;
 return FollowUp.create({traineeId:t.traineeId,traineeName:t.name,type:'Training completion feedback',stage:'Post-training feedback',dueDate:new Date(Date.now()+14*24*60*60*1000).toISOString().slice(0,10),owner:'DISHA Outcome Intelligence',status:'pending',channel:'email',notes:'Please update your profile, employment/livelihood status and share training feedback for programme improvement.'});
}
async function sendCompletionCongratulations(t){
 const follow=await createFeedbackFollowUp(t);
 const appUrl=process.env.APP_URL||'http://localhost:5000';
 const profileUrl=`${appUrl}/#/profile`;
 const courseName=t.course||'your DISHA training programme';
 const text=`Dear ${t.name},\n\nCongratulations! You have successfully completed ${courseName}.\n\nYour training completion has been recorded in DISHA. Please log in to your DISHA Student Dashboard and update your profile and current outcome: employed, self-employed/business owner, apprenticeship/internship, further education, or seeking employment.\n\nWe also request your training rating and feedback on what can be improved. Your feedback will help training providers and the Government improve future programmes.\n\nUpdate your profile and feedback: ${profileUrl}\n\nTransparency note: employment/livelihood information is stored as self-reported until the authorised verification workflow confirms it.\n\nRegards,\nDISHA Outcome Intelligence\nMaharashtra Skilling Outcomes & Impact Platform`;
 const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:680px;margin:auto"><h2 style="color:#0f766e">Congratulations, ${t.name}!</h2><p>You have successfully completed <strong>${courseName}</strong>.</p><p>Your training completion has been recorded in <strong>DISHA</strong>. Please update your profile and tell us your current outcome:</p><ul><li>Employed</li><li>Self-employed / Business owner</li><li>Apprenticeship / Internship</li><li>Further education</li><li>Seeking employment</li></ul><p>We also request your training rating and feedback on what can be improved. Your feedback helps training providers and the Government improve future programmes.</p><p><a href="${profileUrl}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:white;text-decoration:none;border-radius:8px">Update Profile & Feedback</a></p><p style="font-size:13px;color:#64748b"><strong>Transparency:</strong> Your employment/livelihood information remains self-reported until the authorised verification workflow confirms it.</p><p>Regards,<br><strong>DISHA Outcome Intelligence</strong><br>Maharashtra Skilling Outcomes & Impact Platform</p></div>`;
 const result=await sendEmail(t.email,'Congratulations! You completed your DISHA training programme',text,html);
 await FollowUp.findByIdAndUpdate(follow._id,{notificationStatus:result.sent?'sent':'demo_sent',notificationSid:result.messageId||`DEMO-COMPLETION-${Date.now()}`,lastNotificationAt:new Date(),response:text});
 return {followUpId:follow._id,email:result};
}

app.get('/api/health',(req,res)=>res.json({ok:true,db:mongoose.connection.readyState===1}));
app.post('/api/auth/register',safe(async(req,res)=>{const {name,email,password,phone,district,gender,ageGroup,education,consent}=req.body;if(!name||!email||!password)return res.status(400).json({message:'Name, email and password are required'});if(!consent)return res.status(400).json({message:'Consent is required for longitudinal outcome tracking'});if(await User.findOne({email:email.toLowerCase()}))return res.status(409).json({message:'Email already registered'});const t=await Trainee.create({traineeId:await nextId(),name,email:email.toLowerCase(),phone,district,course:'',skills:[],consent:true,consentDate:new Date().toISOString().slice(0,10),demographics:{gender,ageGroup,education}});await User.create({name,email:email.toLowerCase(),password:await bcrypt.hash(password,10),role:'trainee',linkedId:t._id});res.status(201).json({message:'Registration successful. Your consent-based trainee record has been created.'});}));
app.post('/api/auth/login',safe(async(req,res)=>{const u=await User.findOne({email:req.body.email?.toLowerCase()});if(!u||!await bcrypt.compare(req.body.password||'',u.password))return res.status(401).json({message:'Invalid email or password'});const token=jwt.sign({id:u._id,name:u.name,role:u.role,linkedId:u.linkedId},secret,{expiresIn:'8h'});res.json({token,user:{name:u.name,email:u.email,role:u.role,linkedId:u.linkedId}});}));

app.get('/api/ai/me',auth(['trainee']),safe(async(req,res)=>{const t=await Trainee.findById(req.user.linkedId);if(!t)return res.status(404).json({message:'Trainee not found'});const analysis=await buildDishaAnalysis(t);t.aiAnalysis=analysis;t.skillGap=analysis.skillGaps;await t.save();res.json(analysis)}));
app.post('/api/ai/analyze/me',auth(['trainee']),safe(async(req,res)=>{const t=await Trainee.findById(req.user.linkedId);const analysis=await buildDishaAnalysis(t);t.aiAnalysis=analysis;t.skillGap=analysis.skillGaps;await t.save();res.json(analysis)}));
app.post('/api/ai/chat',auth(['trainee']),safe(async(req,res)=>{const t=await Trainee.findById(req.user.linkedId);const body=req.body||{};const message=String(body.message||'').toLowerCase();const step=Number(body.step||0);const analysis=await buildDishaAnalysis(t);
 let reply='I can help you assess your skills, recommend a course, explain your current skill gaps, and review your resume.';let quiz=null;
 if(message.includes('test')||message.includes('quiz')||body.mode==='quiz'){quiz=nextQuizQuestion(t.course,step);reply=`DishaAI skill check for ${t.course||'your learning path'}: choose the best answer.`}
 else if(message.includes('recommend')||message.includes('course')||message.includes('learn')) reply=`Based on your current record, I recommend strengthening ${analysis.skillGaps.slice(0,3).join(', ')||'advanced course skills'}. Your current course alignment and assessment results are included in this recommendation.`;
 else if(message.includes('market')||message.includes('demand')||message.includes('job')) reply=analysis.marketDemand.length?`Current demand signals inside DISHA job postings highlight: ${analysis.marketDemand.slice(0,5).join(', ')}. For your profile, prioritise ${analysis.skillGaps.slice(0,3).join(', ')}.`:`No live employer postings are available yet, so I am using the course skill baseline for your recommendation.`;
 else if(message.includes('resume')||message.includes('cv')) reply='Upload your resume below. I will extract the available text, identify skills, compare them with your course and DISHA job demand, and suggest improvements.';
 else if(message.includes('risk')||message.includes('score')) reply=analysis.summary;
 res.json({reply,quiz,analysis});
}));
app.post('/api/ai/resume',auth(['trainee']),upload.single('resume'),safe(async(req,res)=>{if(!req.file)return res.status(400).json({message:'Please upload a PDF, DOCX or TXT resume'});const ext=path.extname(req.file.originalname).toLowerCase();let text='';try{if(ext==='.txt')text=fs.readFileSync(req.file.path,'utf8');else if(ext==='.pdf'&&pdfParse)text=(await pdfParse(fs.readFileSync(req.file.path))).text;else if(ext==='.docx'&&mammoth)text=(await mammoth.extractRawText({path:req.file.path})).value;else return res.status(400).json({message:'Install dependencies with npm install. Supported: PDF, DOCX, TXT.'});}finally{try{fs.unlinkSync(req.file.path)}catch(e){}}
 const t=await Trainee.findById(req.user.linkedId);const analysis=await buildDishaAnalysis(t);const found=[];const hay=text.toLowerCase();[...(marketProfiles[t.course]||[]),...analysis.marketDemand].forEach(sk=>{if(hay.includes(String(sk).toLowerCase()))found.push(sk)});const unique=[...new Set(found)];const gaps=[...new Set(analysis.skillGaps.filter(sk=>!unique.some(x=>normalizeSkill(x)===normalizeSkill(sk))))].slice(0,6);t.resumeSummary=text.slice(0,12000);t.skills=[...new Set([...(t.skills||[]),...unique])];t.aiAnalysis={...analysis,strengths:[...new Set([...(analysis.strengths||[]),...unique])].slice(0,8),skillGaps:gaps,recommendations:[`Resume detected ${unique.length} relevant skill(s): ${unique.join(', ')||'none matched automatically'}.`,...(analysis.recommendations||[])]};await t.save();res.json({message:'Resume analysed by DishaAI',detectedSkills:unique,skillGaps:gaps,recommendations:t.aiAnalysis.recommendations,analysis:t.aiAnalysis});
}));

function outcomePositive(t){return ['employed','self_employed','apprenticeship','internship'].includes(t.status)}
function normalizeDistrictName(x){return String(x||'').trim().toLowerCase().replace(/\s+/g,' ')}
function yearOf(t){const d=t.trainingCompletionDate||t.createdAt;const y=d?new Date(d).getFullYear():null;return Number.isFinite(y)?y:null}
function retentionStats(rows){
 const now=new Date();
 const horizons=[['month3','3 Months',3],['month6','6 Months',6],['month12','12 Months',12],['month24','2 Years',24],['month36','3 Years',36],['month60','5 Years',60]];
 const out={};
 horizons.forEach(([key,label,months])=>{
  let eligible=0,retained=0;
  rows.forEach(t=>{const d=t.trainingCompletionDate||t.createdAt;if(!d)return;const done=new Date(d);const target=new Date(done);target.setMonth(target.getMonth()+months);if(target<=now){eligible++;if(t.retention?.[key])retained++;}});
  out[key]={label,months,eligible,retained,rate:eligible?Math.round(retained/eligible*100):0};
 });
 return out;
}
async function buildAdminDashboard(req){
 const district=String(req.query.district||'All Maharashtra');
 const year=String(req.query.year||'All Years');
 const division=String(req.query.division||'All Divisions');
 let rows=await Trainee.find().lean();
 const aliases={
  'Chhatrapati Sambhajinagar':['chhatrapati sambhajinagar','aurangabad'],
  'Ahilyanagar':['ahilyanagar','ahmednagar'],
  'Dharashiv':['dharashiv','osmanabad']
 };
 const sameDistrict=(a,b)=>{const aa=normalizeDistrictName(a),bb=normalizeDistrictName(b);if(aa===bb)return true;const vals=aliases[b]||[];return vals.includes(aa)};
 const divisions={
  'Konkan':['Mumbai City','Mumbai Suburban','Thane','Palghar','Raigad','Ratnagiri','Sindhudurg'],
  'Pune':['Pune','Satara','Sangli','Kolhapur','Solapur'],
  'Nashik':['Nashik','Dhule','Nandurbar','Jalgaon','Ahilyanagar'],
  'Chhatrapati Sambhajinagar':['Chhatrapati Sambhajinagar','Jalna','Beed','Latur','Nanded','Parbhani','Hingoli','Dharashiv'],
  'Amravati':['Amravati','Akola','Buldhana','Washim','Yavatmal'],
  'Nagpur':['Nagpur','Wardha','Bhandara','Gondia','Chandrapur','Gadchiroli']
 };
 if(district!=='All Maharashtra')rows=rows.filter(t=>sameDistrict(t.district,district));
 if(division!=='All Divisions')rows=rows.filter(t=>(divisions[division]||[]).some(d=>sameDistrict(t.district,d)));
 if(year!=='All Years')rows=rows.filter(t=>String(yearOf(t))===year);
 const positive=rows.filter(outcomePositive);
 const verified=rows.filter(t=>t.employerVerified===true);
 const wage=rows.filter(t=>Number(t.wage)>0).map(t=>Number(t.wage));
 const courses={}; rows.forEach(t=>{const k=t.course||'Unassigned';const x=courses[k]||(courses[k]={total:0,positive:0,verified:0,avgAssessment:0,assessmentN:0,gapSignals:0});x.total++;if(outcomePositive(t))x.positive++;if(t.employerVerified)x.verified++;if(Number(t.assessmentScore)>0){x.avgAssessment+=Number(t.assessmentScore);x.assessmentN++}x.gapSignals+=(t.skillGap||[]).length});
 Object.values(courses).forEach(x=>{x.placementRate=x.total?Math.round(x.positive/x.total*100):0;x.verificationRate=x.positive?Math.round(x.verified/x.positive*100):0;x.avgAssessment=x.assessmentN?Math.round(x.avgAssessment/x.assessmentN):0});
 const districts={};
 rows.forEach(t=>{const k=t.district||'Unknown';const x=districts[k]||(districts[k]={total:0,positive:0,verified:0,wage:0,wageN:0});x.total++;if(outcomePositive(t))x.positive++;if(t.employerVerified)x.verified++;if(Number(t.wage)>0){x.wage+=Number(t.wage);x.wageN++}});
 Object.values(districts).forEach(x=>{x.placementRate=x.total?Math.round(x.positive/x.total*100):0;x.avgWage=x.wageN?Math.round(x.wage/x.wageN):0;x.verificationRate=x.positive?Math.round(x.verified/x.positive*100):0});
 let allRows=await Trainee.find().lean();
 if(year!=='All Years')allRows=allRows.filter(t=>String(yearOf(t))===year);
 if(division!=='All Divisions')allRows=allRows.filter(t=>(divisions[division]||[]).some(d=>sameDistrict(t.district,d)));
 const allDistricts={};allRows.forEach(t=>{const k=t.district||'Unknown';const x=allDistricts[k]||(allDistricts[k]={total:0,positive:0,wage:0,wageN:0});x.total++;if(outcomePositive(t))x.positive++;if(Number(t.wage)>0){x.wage+=Number(t.wage);x.wageN++}});Object.values(allDistricts).forEach(x=>{x.placementRate=x.total?Math.round(x.positive/x.total*100):0;x.avgWage=x.wageN?Math.round(x.wage/x.wageN):0});
 const providers={};rows.forEach(t=>{const k=t.provider||'Unassigned';const x=providers[k]||(providers[k]={total:0,positive:0,verified:0,wage:0,wageN:0});x.total++;if(outcomePositive(t))x.positive++;if(t.employerVerified)x.verified++;if(Number(t.wage)>0){x.wage+=Number(t.wage);x.wageN++}});Object.values(providers).forEach(x=>{x.placementRate=x.total?Math.round(x.positive/x.total*100):0;x.avgWage=x.wageN?Math.round(x.wage/x.wageN):0;x.verificationRate=x.positive?Math.round(x.verified/x.positive*100):0});
 const providerOutcomeRank=Object.entries(providers).map(([name,x])=>({name,...x})).sort((a,b)=>b.positive-a.positive || b.placementRate-a.placementRate);
 const jobs=await Job.find({status:'open'}).lean();
 const selectedIds=new Set(rows.map(t=>String(t.traineeId)));
 const verificationRows=(await Verification.find().lean()).filter(v=>selectedIds.has(String(v.traineeId)));
 const followupRows=(await FollowUp.find().lean()).filter(f=>selectedIds.has(String(f.traineeId)));
 const verificationSummary={verified:verificationRows.filter(v=>v.status==='verified').length,pending:verificationRows.filter(v=>v.status==='pending').length,disputed:verificationRows.filter(v=>v.status==='disputed').length,selfReported:positive.filter(t=>t.employerVerified!==true&&t.verificationStatus!=='disputed').length,noResponse:followupRows.filter(f=>f.status==='pending'&&!f.response).length,requests:verificationRows.length};
 const verificationHierarchy=[{level:1,label:'Self-reported',detail:'Candidate claim; not independently verified'},{level:2,label:'Evidence / Provider confirmed',detail:'Supporting document or provider confirmation'},{level:3,label:'Employer confirmed',detail:'Independent employer confirmation'},{level:4,label:'Authorized official source',detail:'Highest-trust source when legally and technically available'}];
 const demand={};jobs.forEach(j=>(j.skills||[]).forEach(sk=>{const k=String(sk).trim();if(k){const x=demand[k]||(demand[k]={jobs:0,trained:0,gap:0});x.jobs++}}));rows.forEach(t=>{const skills=(t.skills||[]).map(normalizeSkill);(t.marketSkills||[]).forEach(sk=>{const k=String(sk).trim();if(demand[k])demand[k].trained++});(t.skillGap||[]).forEach(sk=>{const match=Object.keys(demand).find(k=>normalizeSkill(k)===normalizeSkill(sk));if(match)demand[match].gap++})});
 const reasons={};rows.forEach(t=>{const r=t.nonPlacementReason||t.attritionReason;if(r)reasons[r]=(reasons[r]||0)+1});
 const skillGaps={};rows.forEach(t=>(t.skillGap||[]).forEach(g=>skillGaps[g]=(skillGaps[g]||0)+1));
 const retention=retentionStats(rows);
 const feedbackRows=rows.filter(t=>Number(t.feedbackRating)>0||t.feedbackText||t.improvementSuggestions);const ratedFeedback=feedbackRows.filter(t=>Number(t.feedbackRating)>0);const feedback={responses:feedbackRows.length,averageRating:ratedFeedback.length?Math.round(ratedFeedback.reduce((a,t)=>a+Number(t.feedbackRating),0)/ratedFeedback.length*10)/10:0,improvementThemes:{}};feedbackRows.forEach(t=>{if(t.improvementSuggestions){const k=String(t.improvementSuggestions).trim();if(k)feedback.improvementThemes[k]=(feedback.improvementThemes[k]||0)+1}});
 const wageByYear={};rows.forEach(t=>{const y=yearOf(t);if(y&&Number(t.wage)>0){const x=wageByYear[y]||(wageByYear[y]={sum:0,n:0});x.sum+=Number(t.wage);x.n++}});Object.keys(wageByYear).forEach(y=>wageByYear[y]={avg:Math.round(wageByYear[y].sum/wageByYear[y].n),n:wageByYear[y].n});
 const outcomeMix={employed:rows.filter(t=>t.status==='employed').length,selfEmployed:rows.filter(t=>t.status==='self_employed').length,apprenticeship:rows.filter(t=>t.status==='apprenticeship').length,internship:rows.filter(t=>t.status==='internship').length,jobSearch:rows.filter(t=>t.status==='job_search').length,furtherEducation:rows.filter(t=>t.status==='further_education').length,droppedOut:rows.filter(t=>t.status==='dropped_out').length,training:rows.filter(t=>t.status==='training').length,certified:rows.filter(t=>t.status==='certified').length};
 const years=[...new Set(allRows.map(yearOf).filter(Boolean))].sort((a,b)=>b-a);
 const insights=[];
 Object.entries(courses).sort((a,b)=>a[1].placementRate-b[1].placementRate).forEach(([name,x])=>{if(x.total>=2&&x.placementRate<60)insights.push({priority:'High',type:'Course',title:`${name} needs outcome review`,detail:`Positive outcome is ${x.placementRate}% across ${x.total} records. Review employer demand, practical assessment and placement support.`});if(x.gapSignals>=3)insights.push({priority:'Medium',type:'Skill',title:`${name} shows repeated skill-gap signals`,detail:`${x.gapSignals} recorded skill-gap signals. Cross-check curriculum and assessment evidence.`})});
 const demandRank=Object.entries(demand).sort((a,b)=>b[1].jobs-a[1].jobs);demandRank.slice(0,8).forEach(([sk,x])=>{if(x.gap>0)insights.push({priority:x.gap>=3?'High':'Medium',type:'Demand',title:`${sk}: demand vs trainee readiness`,detail:`${x.jobs} open job-skill signals and ${x.gap} trainee gap signals. Consider targeted training and employer-linked assessment.`})});
 if(verified.length<positive.length)insights.push({priority:'High',type:'Verification',title:'Verification backlog',detail:`${positive.length-verified.length} positive outcomes are not independently verified yet. Prioritise employer confirmation before policy reporting.`});
 const worstDistricts=Object.entries(allDistricts).sort((a,b)=>a[1].placementRate-b[1].placementRate).slice(0,5).map(([name,x])=>({name,...x}));
 const bestDistricts=Object.entries(allDistricts).filter(([,x])=>x.total>=2).sort((a,b)=>b[1].placementRate-a[1].placementRate).slice(0,5).map(([name,x])=>({name,...x}));
 const courseCatalog=await Course.find({status:'open'}).lean();
 const highDemandCourses=courseCatalog.map(c=>{const skills=(c.skills||[]).map(normalizeSkill);const demandCount=Object.entries(demand).filter(([sk])=>skills.includes(normalizeSkill(sk))).reduce((n,[,x])=>n+x.jobs,0);const perf=courses[c.title]||{total:0,positive:0,placementRate:0,avgAssessment:0};return {name:c.title,demandSignals:demandCount,providerOutcomeRate:perf.placementRate||0,trainees:perf.total||0,reason:demandCount?`${demandCount} open-job skill signals match this course`: 'No matching open-job skill signal yet'};}).sort((a,b)=>b.demandSignals-a.demandSignals||b.providerOutcomeRate-a.providerOutcomeRate).slice(0,5);
 const demandSkills=Object.entries(demand).sort((a,b)=>b[1].jobs-a[1].jobs).slice(0,8).map(([skill,x])=>({skill,jobs:x.jobs,traineeGapSignals:x.gap}));
 const aiIntelligence={highDemandCourses,bestDistricts,worstDistricts,demandSkills,interventions:[...insights.slice(0,8)]};
 return {scope:{district,year,division},total:rows.length,positive:positive.length,placementRate:rows.length?Math.round(positive.length/rows.length*100):0,verified:verified.length,verificationRate:positive.length?Math.round(verified.length/positive.length*100):0,avgWage:wage.length?Math.round(wage.reduce((a,b)=>a+b,0)/wage.length):0,certified:rows.filter(t=>t.trainingStatus==='certified'||t.status==='certified').length,consent:rows.filter(t=>t.consent).length,retention,courses,districts,allDistricts,providers,providerOutcomeRank,verificationSummary,verificationHierarchy,demand,reasons,skillGaps,outcomeMix,wageByYear,feedback,years,insights,worstDistricts,aiIntelligence,divisions:Object.fromEntries(Object.entries(divisions).map(([k,ds])=>[k,ds.reduce((a,d)=>a+(allDistricts[d]?.total||0),0)])),jobs:jobs.length};
}

async function jobsForAI(demand,rows){
 const jobs=await Job.find({status:'open'}).lean();jobs.forEach(j=>(j.skills||[]).forEach(s=>{const k=String(s).trim();if(k)demand[k]=(demand[k]||0)+1}));
 const courseScores={};rows.forEach(t=>{const k=t.course||'Unassigned';const x=courseScores[k]||(courseScores[k]={n:0,pos:0,gaps:0});x.n++;if(outcomePositive(t))x.pos++;x.gaps+=(t.skillGap||[]).length});
 const topDemand=Object.entries(demand).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([skill,count])=>({skill,count}));
 const suggestions=[];topDemand.forEach(x=>suggestions.push(`High employer demand: ${x.skill} (${x.count} open-job skill signals). Consider prioritising aligned training and assessments.`));
 Object.entries(courseScores).sort((a,b)=>(b[1].pos/b[1].n)-(a[1].pos/a[1].n)).slice(0,3).forEach(([course,x])=>suggestions.push(`Strong provider/course signal: ${course} has ${Math.round(x.pos/x.n*100)}% positive outcomes in this view.`));
 return {topDemand,suggestions};
}

app.get('/api/dashboard',auth(),safe(async(req,res)=>{
 if(req.user.role==='admin')return res.json(await buildAdminDashboard(req));
 const t=req.user.role==='trainee'?[await Trainee.findById(req.user.linkedId).lean()]:await Trainee.find(req.user.role==='provider'?{provider:(await Provider.findById(req.user.linkedId))?.name}:{}).lean();
 const rows=t.filter(Boolean);const total=rows.length,positive=rows.filter(outcomePositive),wage=rows.filter(x=>x.wage>0).map(x=>x.wage),verified=rows.filter(x=>x.employerVerified).length;const courses={};rows.forEach(x=>{const k=x.course||'Unassigned';const c=courses[k]||(courses[k]={total:0,outcomes:0});c.total++;if(outcomePositive(x))c.outcomes++});const districts={};rows.forEach(x=>{const k=x.district||'Unknown';const d=districts[k]||(districts[k]={total:0,outcomes:0});d.total++;if(outcomePositive(x))d.outcomes++});const gaps={};rows.forEach(x=>(x.skillGap||[]).forEach(g=>gaps[g]=(gaps[g]||0)+1));const aiInsights=await jobsForAI({},rows);const reasons={};rows.forEach(x=>{const r=x.nonPlacementReason||x.attritionReason;if(r)reasons[r]=(reasons[r]||0)+1});res.json({total,consented:rows.filter(x=>x.consent).length,certified:rows.filter(x=>x.trainingStatus==='certified'||x.status==='certified').length,placed:positive.length,placementRate:total?Math.round(positive.length/total*100):0,avgWage:wage.length?Math.round(wage.reduce((a,b)=>a+b,0)/wage.length):0,verified,verificationRate:positive.length?Math.round(verified/positive.length*100):0,statuses:{employed:rows.filter(x=>x.status==='employed').length,selfEmployed:rows.filter(x=>x.status==='self_employed').length,apprenticeship:rows.filter(x=>x.status==='apprenticeship').length,jobSearch:rows.filter(x=>x.status==='job_search').length,furtherEducation:rows.filter(x=>x.status==='further_education').length,droppedOut:rows.filter(x=>x.status==='dropped_out').length,inTraining:rows.filter(x=>x.status==='training').length,certifiedAwaiting:rows.filter(x=>x.status==='certified').length},courses,districts,gaps,reasons,journey:{enrolled:total,certified:rows.filter(x=>x.trainingStatus==='certified'||x.status==='certified').length,placed:positive.length,retained6:rows.filter(x=>x.retention?.month6).length,retained12:rows.filter(x=>x.retention?.month12).length},aiInsights});
}));
app.get('/api/admin/insights',auth(['admin']),safe(async(req,res)=>{const d=await buildAdminDashboard(req);res.json({insights:d.insights,scope:d.scope,worstDistricts:d.worstDistricts})}));

app.get('/api/trainees',auth(),safe(async(req,res)=>{let q=req.query.q||'';let filter=q?{$or:['name','traineeId','district','course','provider'].map(k=>({[k]:{$regex:q,$options:'i'}}))}:{};if(req.user.role==='trainee')filter={_id:req.user.linkedId};if(req.user.role==='provider'){const p=await Provider.findById(req.user.linkedId);filter={...filter,provider:p?.name}}res.json(await Trainee.find(filter).sort({_id:-1}).limit(500));}));
app.post('/api/trainees',auth(['admin','provider']),safe(async(req,res)=>res.status(201).json(await Trainee.create({...req.body,traineeId:req.body.traineeId||await nextId()}))));
app.patch('/api/trainees/:id',auth(['admin','provider']),safe(async(req,res)=>{if(req.body.status==='employed'&&!req.body.verificationStatus)req.body.verificationStatus='not_requested';res.json(await Trainee.findByIdAndUpdate(req.params.id,{...req.body,lastOutcomeUpdate:new Date().toISOString().slice(0,10)},{new:true}));}));
app.get('/api/trainee/me',auth(['trainee']),safe(async(req,res)=>res.json(await Trainee.findById(req.user.linkedId))));
app.patch('/api/trainee/me/profile',auth(['trainee']),safe(async(req,res)=>{
 const allowed=['name','phone','district','demographics','feedbackRating','feedbackText','improvementSuggestions','status','employer','designation','employmentStart','wage','selfEmployment','apprenticeship','nonPlacementReason','preferredJobRole','expectedSalary'];
 const current=await Trainee.findById(req.user.linkedId);if(!current)return res.status(404).json({message:'Trainee not found'});
 const patch={profileUpdatedAt:new Date(),lastOutcomeUpdate:new Date().toISOString().slice(0,10)};allowed.forEach(k=>{if(req.body[k]!==undefined)patch[k]=req.body[k]});
 if(req.body.wage!==undefined)patch.wage=Number(req.body.wage||0);
 if(req.body.status==='employed')patch.verificationStatus='pending';
 const t=await Trainee.findByIdAndUpdate(req.user.linkedId,patch,{new:true});
 if(req.body.name)await User.findByIdAndUpdate(req.user.id,{name:req.body.name});
 if(req.body.feedbackRating||req.body.feedbackText||req.body.improvementSuggestions) await FollowUp.updateMany({traineeId:t.traineeId,stage:'Post-training feedback',status:'pending'},{$set:{status:'completed',response:'Trainee submitted profile and training feedback.'}});
 if(req.body.status==='employed'&&req.body.employer){const exists=await Verification.findOne({traineeId:t.traineeId,status:'pending'});if(!exists){const employer=await Employer.findOne({company:req.body.employer});await Verification.create({traineeId:t.traineeId,traineeName:t.name,employer:req.body.employer,employerId:employer?._id,claimedWage:Number(t.wage||0),status:'pending'});}}
 res.json(t);
}));

app.patch('/api/trainee/me/outcome',auth(['trainee']),safe(async(req,res)=>{
  const allowed=['status','employer','designation','employmentStart','wage','selfEmployment','apprenticeship','nonPlacementReason','attritionReason','skillGap','skills','contactStatus','phone','email','currentAddress','jobLocation','jobRelatedToTraining','jobSatisfaction','salarySatisfaction','workLifeBalance','careerGrowth','jobEndDate','jobLeaveReason','currentlyJobSearching','expectedSalary','reskillingNeeded','preferredJobRole'];
  const current=await Trainee.findById(req.user.linkedId);
  if(!current)return res.status(404).json({message:'Trainee not found'});
  const patch={lastOutcomeUpdate:new Date().toISOString().slice(0,10),profileUpdatedAt:new Date()};
  allowed.forEach(k=>{if(req.body[k]!==undefined)patch[k]=req.body[k]});
  if(req.body.wage!==undefined && Number(req.body.wage)>=0){
    patch.wage=Number(req.body.wage);
    patch.wageHistory=[...(current.wageHistory||[]),{amount:Number(req.body.wage),month:new Date().toISOString().slice(0,7),source:'self',verified:false}];
  }
  if(req.body.email && String(req.body.email).toLowerCase()!==String(current.email||'').toLowerCase()){
    const exists=await Trainee.findOne({email:String(req.body.email).toLowerCase(),_id:{$ne:current._id}});
    if(exists)return res.status(409).json({message:'This email is already linked to another trainee'});
    patch.email=String(req.body.email).toLowerCase();
  }
  if(req.body.status==='employed')patch.verificationStatus='pending';
  if(req.body.expectedSalary!==undefined)patch.expectedSalary=Number(req.body.expectedSalary||0);
  const updated=await Trainee.findByIdAndUpdate(req.user.linkedId,patch,{new:true});
  if(patch.email)await User.findByIdAndUpdate(req.user.id,{email:patch.email});

  // Completing the student form closes pending notification tasks.
  await FollowUp.updateMany({traineeId:updated.traineeId,status:'pending'},{
    $set:{status:'completed',response:'Student submitted outcome details from Student Dashboard'}
  });

  let verificationRequested=false;
  if(updated.status==='employed' && updated.employer){
    const existing=await Verification.findOne({traineeId:updated.traineeId,status:'pending'});
    if(!existing){
      const employer=await Employer.findOne({company:updated.employer});
      await Verification.create({
        traineeId:updated.traineeId,traineeName:updated.name,employer:updated.employer,
        employerId:employer?._id,claimedWage:Number(updated.wage||0),status:'pending'
      });
      verificationRequested=true;
    }
  }
  res.json({trainee:updated,verificationRequested,message:verificationRequested?'Outcome saved. Employer verification request created.':'Outcome saved successfully.'});
}));

app.get('/api/trainee/me/progress',auth(['trainee']),safe(async(req,res)=>{
 const t=await Trainee.findById(req.user.linkedId).lean();if(!t)return res.status(404).json({message:'Trainee not found'});
 const enrollments=await Enrollment.find({traineeId:t.traineeId}).sort({createdAt:-1}).lean();
 const assessments=await Assessment.find({traineeId:t.traineeId}).sort({level:1,moduleName:1}).lean();
 const completed=assessments.filter(a=>['submitted','evaluated','passed','needs_improvement'].includes(a.status)).length;
 const passed=assessments.filter(a=>a.status==='passed').length;
 const progress=Math.min(100,Math.round((t.certificateId?100:(assessments.length?30+completed/assessments.length*50:20))));
 const stage=t.certificateId?'Certified':t.trainingStatus==='completed'?'Training completed':completed?'Assessment in progress':t.course?'Training in progress':'Not enrolled';
 const stages=['Enrolled','Training','Assessment','Completed','Certified'];
 const stageIndex={Enrolled:0,'Training in progress':1,'Assessment in progress':2,'Training completed':3,Certified:4}[stage]??0;
 const series=stages.map((label,i)=>({label,value:i<=stageIndex?[20,45,70,90,100][i]:null}));
 res.json({stage,progress,course:t.course,attendance:t.attendance||0,assessments, enrollments, assessmentSeries:assessments.map(a=>({label:a.moduleName,score:a.status==='not_started'?null:Number(a.score||0),status:a.status})),trainingSeries:series,feedbackPending:await FollowUp.exists({traineeId:t.traineeId,stage:'Post-training feedback',status:'pending'})});
}));
app.get('/api/assessments/me',auth(['trainee']),safe(async(req,res)=>{
 const t=await Trainee.findById(req.user.linkedId); if(!t)return res.status(404).json({message:'Trainee not found'});
 const rows=await Assessment.find({traineeId:t.traineeId}).sort({level:1,moduleName:1}); res.json(rows);
}));
app.get('/api/assessments/trainee/:traineeId',auth(['admin','provider']),safe(async(req,res)=>res.json(await Assessment.find({traineeId:req.params.traineeId}).sort({level:1,moduleName:1}))));
app.post('/api/assessments',auth(['admin','provider']),safe(async(req,res)=>{
 const t=await Trainee.findOne({traineeId:req.body.traineeId}); if(!t)return res.status(404).json({message:'Trainee not found'});
 if(req.user.role==='provider'){const p=await Provider.findById(req.user.linkedId); if(t.provider!==p?.name)return res.status(403).json({message:'You can only create assessments for your trainees'});}
 const level=Math.max(1,Math.min(20,Number(req.body.level||1)));
 const questions=Array.isArray(req.body.questions)&&req.body.questions.length?req.body.questions:defaultQuestions(t.course,level);
 const a=await Assessment.create({traineeId:t.traineeId,courseTitle:t.course,courseId:req.body.courseId||undefined,moduleKey:req.body.moduleKey||`CUSTOM-${Date.now()}`,level,moduleName:req.body.moduleName||`Level ${level} Assessment`,type:req.body.type||'Module Assessment',questions,status:'not_started'});
 res.status(201).json({message:'Assessment published to Student Dashboard',assessment:a});
}));
app.patch('/api/assessments/:id',auth(['admin','provider']),safe(async(req,res)=>{const a=await Assessment.findById(req.params.id);if(!a)return res.status(404).json({message:'Assessment not found'});if(req.user.role==='provider'){const t=await Trainee.findOne({traineeId:a.traineeId});const p=await Provider.findById(req.user.linkedId);if(t?.provider!==p?.name)return res.status(403).json({message:'You can only update trainees assigned to your provider'});}
 const patch={};['score','status','providerFeedback','skillGaps','type'].forEach(k=>{if(req.body[k]!==undefined)patch[k]=req.body[k]});
 if(patch.score!==undefined){patch.score=Math.max(0,Math.min(100,Number(patch.score)));patch.status=patch.score>=80?'passed':'needs_improvement';patch.evaluatedBy=req.user.name;patch.evaluatedAt=new Date();}
 const out=await Assessment.findByIdAndUpdate(req.params.id,patch,{new:true});await refreshAssessmentSummary(out.traineeId);res.json(out);
}));
app.post('/api/assessments/:id/attempt',auth(['trainee']),safe(async(req,res)=>{const t=await Trainee.findById(req.user.linkedId);const a=await Assessment.findById(req.params.id);if(!a||a.traineeId!==t.traineeId)return res.status(404).json({message:'Assessment not found'});const score=Math.max(0,Math.min(100,Number(req.body.score||0)));a.score=score;a.attempts=(a.attempts||0)+1;a.status=score>=80?'passed':'needs_improvement';a.evaluatedAt=new Date();if(Array.isArray(req.body.skillGaps))a.skillGaps=req.body.skillGaps;await a.save();await refreshAssessmentSummary(t.traineeId);res.json(a);}));
app.post('/api/trainees/:id/certificate',auth(['admin','provider']),safe(async(req,res)=>{const t=await Trainee.findById(req.params.id);if(!t)return res.status(404).json({message:'Trainee not found'});if(req.user.role==='provider'){const p=await Provider.findById(req.user.linkedId);if(t.provider!==p?.name)return res.status(403).json({message:'You can only certify your own trainees'});}
 const rows=await Assessment.find({traineeId:t.traineeId});const completed=rows.filter(x=>['passed','evaluated','needs_improvement'].includes(x.status));const avg=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score||0),0)/completed.length):0;const allPassed=rows.length>0&&rows.every(x=>x.score>=80&&x.status==='passed');
 if(!allPassed||avg<80)return res.status(400).json({message:`Certificate not eligible. All required module assessments must be 80% or above. Current average: ${avg}%.`});
 if(Number(t.attendance||0)<75)return res.status(400).json({message:`Certificate not eligible. Attendance must be at least 75%. Current attendance: ${t.attendance||0}%.`});
 const certificateId=t.certificateId||`DISHA-CERT-${new Date().getFullYear()}-${t.traineeId}`;t.certificateId=certificateId;t.trainingStatus='certified';if(t.status==='training')t.status='certified';t.assessmentScore=avg;t.trainingCompletionDate=t.trainingCompletionDate||new Date().toISOString().slice(0,10);await t.save();await Enrollment.updateMany({traineeId:t.traineeId,courseTitle:t.course},{status:'certified',completedAt:new Date(),certificateId});const completion=await sendCompletionCongratulations(t);res.json({message:'Certificate issued successfully. Congratulations email and profile-feedback request created.',certificateId,average:avg,email:completion.email.mode,followUpId:completion.followUpId});
}));

app.get('/api/providers',auth(),safe(async(req,res)=>res.json(await Provider.find().sort({_id:-1}))));app.post('/api/providers',auth(['admin']),safe(async(req,res)=>res.status(201).json(await Provider.create(req.body))));
app.get('/api/employers',auth(),safe(async(req,res)=>res.json(await Employer.find().sort({_id:-1}))));app.post('/api/employers',auth(['admin']),safe(async(req,res)=>res.status(201).json(await Employer.create(req.body))));app.patch('/api/employers/:id/verify',auth(['admin']),safe(async(req,res)=>res.json(await Employer.findByIdAndUpdate(req.params.id,{verified:true},{new:true}))));
app.get('/api/courses',auth(),safe(async(req,res)=>res.json(await Course.find({status:'open'}).sort({createdAt:-1}))));
app.get('/api/enrollments/me',auth(['trainee']),safe(async(req,res)=>{const t=await Trainee.findById(req.user.linkedId);res.json(await Enrollment.find({traineeId:t.traineeId}).sort({createdAt:-1}));}));
app.post('/api/courses/:id/enroll',auth(['trainee']),safe(async(req,res)=>{const t=await Trainee.findById(req.user.linkedId);const c=await Course.findOne({_id:req.params.id,status:'open'});if(!c)return res.status(404).json({message:'Course is not available'});const existing=await Enrollment.findOne({traineeId:t.traineeId,courseId:c._id,status:{$in:['applied','enrolled','training']}});if(existing)return res.status(409).json({message:'You already have an active application for this course'});if(c.seats<=0)return res.status(400).json({message:'No seats are currently available'});const e=await Enrollment.create({traineeId:t.traineeId,courseId:c._id,courseCode:c.code,courseTitle:c.title,status:'enrolled',enrolledAt:new Date()});c.seats-=1;await c.save();t.course=c.title;t.provider=c.provider;t.district=t.district||c.district;t.trainingStatus='enrolled';t.status='training';await t.save();await ensureCourseAssessments(t,c);res.status(201).json({message:'Successfully enrolled. Course assessments have been added to your Student Dashboard.',enrollment:e});}));
app.get('/api/jobs',auth(),safe(async(req,res)=>res.json(await Job.find({status:'open'}).sort({_id:-1}))));app.post('/api/jobs',auth(['employer','admin']),safe(async(req,res)=>{const e=req.user.role==='employer'?await Employer.findById(req.user.linkedId):null;res.status(201).json(await Job.create({...req.body,company:req.body.company||e?.company||'Employer',employerId:req.user.linkedId}));}));
// Follow-up records and Twilio notification delivery

// Direct dashboard-only request. No SMS, WhatsApp or Email is required.
app.post('/api/student-update-requests',auth(['admin','provider']),safe(async(req,res)=>{
  const t=await Trainee.findOne({traineeId:req.body.traineeId});
  if(!t)return res.status(404).json({message:'Trainee not found'});
  if(!t.consent)return res.status(400).json({message:'Trainee consent is required before requesting an outcome update'});
  const existing=await FollowUp.findOne({traineeId:t.traineeId,status:'pending',channel:'dashboard',type:'Student Profile & Outcome Update'});
  if(existing)return res.json({message:'A pending profile update request already exists in the Student Dashboard.',request:existing});
  const request=await FollowUp.create({
    traineeId:t.traineeId,traineeName:t.name,type:'Student Profile & Outcome Update',stage:'Student verification update',
    dueDate:new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,10),owner:req.user.name,status:'pending',channel:'dashboard',
    notes:'Update current mobile, email, employment status, salary, job satisfaction and—if applicable—job exit reason.'
  });
  res.status(201).json({message:'Student profile and outcome update request is now available directly in the Student Dashboard.',request});
}));

app.get('/api/followups',auth(),safe(async(req,res)=>{let f={};if(req.user.role==='trainee'){const t=await Trainee.findById(req.user.linkedId);f={traineeId:t.traineeId}}res.json(await FollowUp.find(f).sort({dueDate:1}));}));
app.post('/api/followups',auth(['admin','provider']),safe(async(req,res)=>res.status(201).json(await FollowUp.create(req.body))));
app.patch('/api/followups/:id',auth(),safe(async(req,res)=>res.json(await FollowUp.findByIdAndUpdate(req.params.id,req.body,{new:true}))));

app.get('/api/notifications/status',auth(['admin','provider']),safe(async(req,res)=>res.json({
  configured:!!twilioClient,
  sms:!!(twilioClient&&process.env.TWILIO_PHONE_NUMBER),
  whatsapp:!!(twilioClient&&process.env.TWILIO_WHATSAPP_FROM),
  email:!!mailTransporter,
  demoFallback:true
})));

async function ensureFollowUpForNotification(trainee, followUpId, channel, message){
  if(followUpId){
    const f=await FollowUp.findById(followUpId);
    if(f)return f;
  }
  return FollowUp.create({
    traineeId:trainee.traineeId,
    traineeName:trainee.name,
    type:'Outcome verification request',
    stage:'Outcome verification',
    dueDate:new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,10),
    owner:'DISHA Notification Engine',
    status:'pending',
    channel,
    response:message||'Please complete your outcome verification form.'
  });
}

app.post('/api/notifications/send',auth(['admin','provider']),safe(async(req,res)=>{
  const {traineeId,channel='sms',message,followUpId}=req.body;
  const trainee=await Trainee.findOne({traineeId});
  if(!trainee)return res.status(404).json({message:'Trainee not found'});
  if(!trainee.consent)return res.status(400).json({message:'Notification blocked: trainee consent is required'});

  const normalized=String(channel).toLowerCase();
  if(!['sms','whatsapp','email','in_app'].includes(normalized))
    return res.status(400).json({message:'Supported channels: SMS, WhatsApp, Email, In-app'});

  if(normalized==='in_app'){
    const followUp=await ensureFollowUpForNotification(trainee,followUpId,'in_app',String(message||`Please update your current mobile number, email, employment status, employer, designation and monthly salary/income.`));
    await FollowUp.findByIdAndUpdate(followUp._id,{notificationStatus:'in_app_sent',notificationSid:`INAPP-${Date.now()}`,lastNotificationAt:new Date()});
    return res.json({message:'Verification request created successfully in the Student Dashboard. No SMS, WhatsApp or Email delivery is required.',delivery:'in_app',channel:'in_app',followUpId:followUp._id});
  }

  if(normalized!=='email' && !trainee.phone)
    return res.status(400).json({message:'Trainee phone number is missing'});
  if(normalized==='email' && !trainee.email)
    return res.status(400).json({message:'Trainee email address is missing'});

  const body=String(message||`Hello ${trainee.name}, DISHA requests you to complete your authorised outcome verification. Please log in to your Student Dashboard and update employment status, employer, designation, joining date, salary/income and verification details.`).trim();
  const followUp=await ensureFollowUpForNotification(trainee,followUpId,normalized,body);

  // EMAIL: real SMTP when configured, otherwise demo/in-app delivery.
  if(normalized==='email'){
    if(mailTransporter){
      try{
        const sent=await mailTransporter.sendMail({
          from:process.env.SMTP_FROM||process.env.SMTP_USER,
          to:trainee.email,
          subject:'DISHA Outcome Verification Required',
          text:body
        });
        await FollowUp.findByIdAndUpdate(followUp._id,{notificationStatus:'sent',notificationSid:sent.messageId,lastNotificationAt:new Date()});
        return res.json({message:'Email sent successfully. The follow-up is also visible in the Student Dashboard.',delivery:'real',channel:'email',sid:sent.messageId,followUpId:followUp._id});
      }catch(err){
        console.warn('[Email] Real delivery failed; using demo fallback:',err.message);
      }
    }
    await FollowUp.findByIdAndUpdate(followUp._id,{notificationStatus:'demo_sent',notificationSid:`DEMO-EMAIL-${Date.now()}`,lastNotificationAt:new Date()});
    return res.json({message:'Email demo notification created. It is visible immediately in the Student Dashboard. Configure SMTP later for real email delivery.',delivery:'demo',channel:'email',followUpId:followUp._id});
  }

  const phone=String(trainee.phone||'').trim();
  if(!/^\+\d{8,15}$/.test(phone))
    return res.status(400).json({message:'Phone must be in E.164 format, e.g. +919876543210'});

  // Prefer real Twilio delivery, but never block the project when a trial/template restriction applies.
  if(twilioClient){
    try{
      let to=phone, from=process.env.TWILIO_PHONE_NUMBER;
      if(normalized==='whatsapp'){
        to=`whatsapp:${phone}`;
        if(!process.env.TWILIO_WHATSAPP_FROM)throw new Error('TWILIO_WHATSAPP_FROM is not configured');
        from=process.env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')?process.env.TWILIO_WHATSAPP_FROM:`whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
      }
      if(!from)throw new Error('Twilio sender is not configured');
      const sent=await twilioClient.messages.create({to,from,body});
      await FollowUp.findByIdAndUpdate(followUp._id,{notificationStatus:'sent',notificationSid:sent.sid,lastNotificationAt:new Date()});
      return res.json({message:`${normalized==='sms'?'SMS':'WhatsApp'} sent successfully. The student can now complete the verification in the dashboard.`,delivery:'real',channel:normalized,sid:sent.sid,followUpId:followUp._id});
    }catch(err){
      console.warn('[Notification] Twilio delivery failed; using demo fallback:',err.code,err.message);
      const sid=`DEMO-${normalized.toUpperCase()}-${Date.now()}`;
      await FollowUp.findByIdAndUpdate(followUp._id,{notificationStatus:'demo_sent',notificationSid:sid,lastNotificationAt:new Date()});
      return res.json({
        message:`${normalized==='sms'?'SMS':'WhatsApp'} demo notification created. Twilio did not accept the real request (${err.message}). The follow-up is still available in the Student Dashboard.`,
        delivery:'demo',channel:normalized,sid,followUpId:followUp._id,twilioCode:err.code
      });
    }
  }

  const sid=`DEMO-${normalized.toUpperCase()}-${Date.now()}`;
  await FollowUp.findByIdAndUpdate(followUp._id,{notificationStatus:'demo_sent',notificationSid:sid,lastNotificationAt:new Date()});
  res.json({message:`${normalized==='sms'?'SMS':'WhatsApp'} demo notification created. Add valid Twilio credentials later for real delivery.`,delivery:'demo',channel:normalized,sid,followUpId:followUp._id});
}));

app.get('/api/verifications',auth(),safe(async(req,res)=>{let f={};if(req.user.role==='employer'){const e=await Employer.findById(req.user.linkedId);f.employer=e?.company}if(req.user.role==='trainee'){const t=await Trainee.findById(req.user.linkedId);f.traineeId=t.traineeId}res.json(await Verification.find(f).sort({requestedAt:-1}));}));
app.post('/api/verifications',auth(['admin','provider','trainee']),safe(async(req,res)=>{let t;if(req.user.role==='trainee')t=await Trainee.findById(req.user.linkedId);else t=await Trainee.findOne({traineeId:req.body.traineeId});if(!t)return res.status(404).json({message:'Trainee not found'});if(!t.employer)return res.status(400).json({message:'Add employer details before requesting verification'});const e=await Employer.findOne({company:t.employer});const v=await Verification.create({traineeId:t.traineeId,traineeName:t.name,employer:t.employer,employerId:e?._id,claimedWage:t.wage,status:'pending'});t.verificationStatus='pending';await t.save();res.status(201).json(v);}));
app.patch('/api/verifications/:id/respond',auth(['employer','admin']),safe(async(req,res)=>{const v=await Verification.findByIdAndUpdate(req.params.id,{status:req.body.status,verifiedWage:Number(req.body.verifiedWage||0),employerResponse:req.body.employerResponse||'',verifiedBy:req.user.name,respondedAt:new Date()},{new:true});if(v){const patch={verificationStatus:v.status,employerVerified:v.status==='verified'};if(v.status==='verified'&&v.verifiedWage)patch.wage=v.verifiedWage;await Trainee.findOneAndUpdate({traineeId:v.traineeId},patch)}res.json(v);}));
app.get('/api/policy/insights',auth(['admin']),safe(async(req,res)=>{const d=await Trainee.find();const suggestions=[];const byCourse={};d.forEach(t=>{const x=byCourse[t.course]||(byCourse[t.course]={n:0,o:0,g:{}});x.n++;if(['employed','self_employed','apprenticeship'].includes(t.status))x.o++;(t.skillGap||[]).forEach(g=>x.g[g]=(x.g[g]||0)+1)});Object.entries(byCourse).forEach(([course,x])=>{const rate=x.n?Math.round(x.o/x.n*100):0;const gap=Object.entries(x.g).sort((a,b)=>b[1]-a[1])[0];if(rate<50)suggestions.push({priority:'High',title:`Improve ${course} placement support`,detail:`Outcome rate is ${rate}%. Review curriculum, employer links and placement assistance.`});if(gap)suggestions.push({priority:'Medium',title:`Address ${gap[0]} skill gap`,detail:`${gap[1]} trainee records reported this gap in ${course}.`})});const unverified=d.filter(t=>['employed','self_employed'].includes(t.status)&&!t.employerVerified).length;if(unverified)suggestions.push({priority:'High',title:'Close verification backlog',detail:`${unverified} positive outcomes are still self-reported or awaiting independent validation.`});res.json(suggestions);}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
async function start(){try{await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/disha');console.log('[DB] MongoDB connected');app.listen(PORT,()=>console.log(`[DISHA] http://localhost:${PORT}`));}catch(e){console.error('MongoDB connection failed:',e.message);process.exit(1)}}start();
