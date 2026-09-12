require('dotenv').config();
const mongoose=require('mongoose'),bcrypt=require('bcrypt');
const User=require('./models/User'),Trainee=require('./models/Trainee'),Provider=require('./models/Provider'),Employer=require('./models/Employer'),Job=require('./models/Job'),FollowUp=require('./models/FollowUp'),Verification=require('./models/Verification'),Course=require('./models/Course'),Enrollment=require('./models/Enrollment'),Assessment=require('./models/Assessment');

const districts=['Mumbai City','Thane','Ratnagiri','Pune','Sangli','Kolhapur','Dhule','Ahilyanagar','Chhatrapati Sambhajinagar','Parbhani','Beed','Dharashiv','Nagpur','Bhandara','Gadchiroli','Amravati','Yavatmal','Washim','Mumbai Suburban','Raigad','Sindhudurg','Satara','Solapur','Nashik','Jalgaon','Nandurbar','Jalna','Nanded','Latur','Hingoli','Wardha','Chandrapur','Gondia','Akola','Buldhana','Palghar'];
const coursesDef=[
 {code:'GOV-DA-101',title:'Data Analytics',sector:'IT & Data',skills:['Excel','SQL','Power BI','Python'],duration:'3 Months'},
 {code:'GOV-WEB-102',title:'Web Development',sector:'IT',skills:['HTML','CSS','JavaScript','React'],duration:'4 Months'},
 {code:'GOV-CNC-103',title:'CNC Machining',sector:'Manufacturing',skills:['CNC Operation','Safety','Quality Control'],duration:'6 Months'},
 {code:'GOV-RET-104',title:'Retail & Sales',sector:'Retail',skills:['Sales','Customer Service','CRM'],duration:'3 Months'},
 {code:'GOV-SOL-105',title:'Solar PV Technician',sector:'Green Jobs',skills:['Electrical Basics','Solar Installation','Safety'],duration:'4 Months'},
 {code:'GOV-PBI-106',title:'Power BI',sector:'IT & Data',skills:['Power BI','DAX','SQL','Data Visualization'],duration:'3 Months'}
];
const providersDef=[
 ['Udaan Kaushalya Training Centre – Nashik','Nashik'],['Maharashtra Skills & Livelihood Centre – Pune','Pune'],['Vidarbha Technical Skills Centre – Nagpur','Nagpur'],['Konkan Employment & Skills Centre – Thane','Thane']
];
const employersDef=[
 ['TechNova Manufacturing','Manufacturing','Pune',22000],['DataEdge Services','IT Services','Nashik',28500],['Retail Connect Maharashtra','Retail','Thane',17500],['SunGrid Energy','Renewable Energy','Nagpur',24000],['QualityWorks Industries','Manufacturing','Aurangabad',23000]
];
const names=['Aarav Patil','Atharva Gaikwad','Om Deshmukh','Ananya Kulkarni','Riya Jadhav','Siddharth Shinde','Sneha Pawar'];
const statuses=['employed','self_employed','apprenticeship','job_search','certified','training','dropped_out'];
const gaps=[['Power BI','Communication'],['React','Applied problem solving'],['Quality Control','Safety'],['Digital Sales','Communication'],['Solar Troubleshooting','Electrical Basics'],['DAX','SQL'],['Interview Skills','Digital Skills']];
const moduleTemplates={
 'Data Analytics':['Spreadsheet Foundations','SQL & Data Querying','Power BI Dashboard Project'],
 'Web Development':['HTML & CSS Foundations','JavaScript & DOM','Responsive Web Project'],
 'CNC Machining':['Machine & Safety Basics','CNC Operation','Quality Control Practical'],
 'Retail & Sales':['Customer Service','Sales & Billing','Digital Retail Simulation'],
 'Solar PV Technician':['Electrical Safety','Solar Installation','Maintenance Practical'],
 'Power BI':['Data Modelling','DAX & Measures','Interactive Dashboard Project']
};

(async()=>{
 try{
  await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/disha');
  await Promise.all([User.deleteMany({}),Trainee.deleteMany({}),Provider.deleteMany({}),Employer.deleteMany({}),Job.deleteMany({}),FollowUp.deleteMany({}),Verification.deleteMany({}),Course.deleteMany({}),Enrollment.deleteMany({}),Assessment.deleteMany({})]);

  const providers=await Provider.insertMany(providersDef.map((p,i)=>({name:p[0],district:p[1],contact:`provider${i+1}@disha.gov.in`,courses:coursesDef.map(c=>c.title),trainees:0,placementRate:0,verified:true})));
  const employers=await Employer.insertMany(employersDef.map((e,i)=>({company:e[0],industry:e[1],district:e[2],contact:`hr${i+1}@disha.gov.in`,hired:0,verified:i<4,avgWage:e[3]})));
  const courses=await Course.insertMany(coursesDef.map(c=>({...c,description:`Government-supported ${c.title} training with practical, assessment-linked skill development.`,mode:'Hybrid / Offline',eligibility:'10th / 12th / ITI / Graduate as applicable',fee:'Government Sponsored',certification:true,certificateName:'DISHA Outcome Certificate',scheme:'Mahaswayam-linked Government Skilling Programme',startDate:'2026-09-15'})));

  const traineeDocs=[];
  let seq=9001;
  districts.forEach((district,di)=>{
   for(let j=0;j<7;j++){
    const provider=providers[(di+j)%providers.length], course=courses[(di+j)%courses.length];
    const year=2026-j; const status=statuses[j];
    const outcomeWage=status==='employed'?18000+(di%5)*1800:status==='self_employed'?21000+(di%4)*1000:status==='apprenticeship'?12000:0;
    const positive=['employed','self_employed','apprenticeship'].includes(status);
    const verified=status==='employed' && di%3===0;
    const gap=gaps[(di+j)%gaps.length];
    traineeDocs.push({
      traineeId:`MH-${seq++}`,name:`${names[j]} · ${district}`,email:`demo-mh-${di+1}-${j+1}@disha.example`,district,course:course.title,provider:provider.name,
      batch:`MH-${year}-${String(di+1).padStart(2,'0')}`,trainingStatus:status==='training'?'training':status==='dropped_out'?'dropped_out':status==='certified'?'certified':'completed',status,
      attendance:status==='dropped_out'?35:65+(di+j)%31,assessmentScore:status==='dropped_out'?38:62+(di*3+j*4)%36,
      certificateId:['certified','employed','self_employed','apprenticeship'].includes(status)?`DISHA-CERT-${year}-MH-${di+1}-${j+1}`:'',
      skills:course.skills.slice(0,Math.max(1,course.skills.length-((di+j)%2))),skillGap:gap,marketSkills:course.skills,
      consent:true,consentDate:`${year}-04-15`,contactStatus:'reachable',employer:positive?employers[(di+j)%employers.length].company:'',
      employerVerified:verified,verificationStatus:verified?'verified':positive?'pending':'not_requested',wage:outcomeWage,
      wageHistory:outcomeWage?[{amount:outcomeWage,month:`${year}-08`,source:verified?'employer':'self',verified}]:[],
      demographics:{gender:j%2?'Female':'Male',ageGroup:j%3===0?'18-24':j%3===1?'25-34':'35+',education:j%2?'Graduate':'12th'},
      retention:{month3:positive,month6:positive&&year<=2025,month12:positive&&year<=2024,month24:positive&&year<=2024,month36:positive&&year<=2023,month60:positive&&year<=2021},
      trainingCompletionDate:`${year}-07-15`,
      selfEmployment:status==='self_employed'?{businessName:'Local Services Enterprise',sector:course.sector,monthlyIncome:outcomeWage}:{},
      apprenticeship:status==='apprenticeship'?{organization:employers[(di+j)%employers.length].company,trade:course.title,stipend:12000,startDate:`${year}-06-01`}:{},
      nonPlacementReason:status==='job_search'?gap[0]+' skill gap / portfolio needs improvement':status==='certified'?'Awaiting suitable vacancy':'',
      attritionReason:status==='dropped_out'?'Relocation / personal constraints':'',
      createdAt:new Date(`${year}-02-01`)
    });
   }
  });
  const trainees=await Trainee.insertMany(traineeDocs);

  const enrollments=trainees.map(t=>{const c=courses.find(x=>x.title===t.course);let status='completed';if(t.status==='training')status='training';else if(t.status==='dropped_out')status='dropped_out';else if(t.status==='certified')status='certified';return {traineeId:t.traineeId,courseId:c._id,courseCode:c.code,courseTitle:c.title,status,enrolledAt:new Date(`${t.createdAt.getFullYear()}-02-01`),completedAt:['completed','certified','employed','self_employed','apprenticeship'].includes(t.status)?new Date(`${t.createdAt.getFullYear()}-07-15`):undefined,certificateId:t.certificateId||''};});
  await Enrollment.insertMany(enrollments);

  const assessments=[]; trainees.forEach((t,idx)=>{const c=courses.find(x=>x.title===t.course),mods=moduleTemplates[t.course];const base=t.assessmentScore;mods.forEach((m,i)=>{const score=i===0?Math.min(100,base+8):i===1?Math.max(0,base):Math.max(0,base-4);assessments.push({traineeId:t.traineeId,courseId:c._id,courseTitle:t.course,moduleKey:`L${i+1}`,level:i+1,moduleName:`Level ${i+1} · ${m}`,type:i===2?'Final Practical / Project':'Module Assessment',score,status:score===0?'not_started':score>=80?'passed':'needs_improvement',skillGaps:score>=80?[]:[gaps[idx%gaps.length][i%2]],attempts:score?1:0,evaluatedBy:score?providers[idx%providers.length].name:'',evaluatedAt:score?new Date():undefined});});});
  await Assessment.insertMany(assessments);

  const jobs=[
   ['CNC Operator','TechNova Manufacturing','Pune',['CNC Operation','Safety','Quality Control'],'₹18,000–₹26,000'],
   ['Junior Data Analyst','DataEdge Services','Nashik',['Excel','SQL','Power BI'],'₹22,000–₹32,000'],
   ['Retail Associate','Retail Connect Maharashtra','Thane',['Sales','Customer Service','CRM'],'₹14,000–₹20,000'],
   ['Solar Technician','SunGrid Energy','Nagpur',['Solar Installation','Electrical Basics','Safety'],'₹20,000–₹28,000'],
   ['Quality Executive','QualityWorks Industries','Pune',['Quality Control','Safety'],'₹20,000–₹27,000']
  ];
  await Job.insertMany(jobs.map(j=>({title:j[0],company:j[1],location:j[2],skills:j[3],salary:j[4],description:`Employer demand signal for ${j[0]}.`})));
  await FollowUp.insertMany(trainees.filter(t=>t.status==='job_search'||t.status==='employed').slice(0,12).map(t=>({traineeId:t.traineeId,traineeName:t.name,type:'Outcome follow-up',stage:'Longitudinal',dueDate:'2026-09-15',owner:'DISHA Placement Officer',status:'pending',channel:'dashboard',notes:'Update employment, wage and retention evidence.'})));
  await Verification.insertMany(trainees.filter(t=>t.status==='employed'&&!t.employerVerified).slice(0,12).map(t=>({traineeId:t.traineeId,traineeName:t.name,employer:t.employer,claimType:'employment',claimedWage:t.wage,status:'pending'})));

  const pw=await bcrypt.hash('disha123',10);
  const aman=trainees.find(t=>t.name.startsWith('Aarav Patil') && t.district==='Pune')||trainees[0];
  await User.insertMany([
   {name:'DISHA Super Admin',email:'admin@disha.gov.in',password:pw,role:'admin'},
   {name:'Nashik Provider',email:'provider@disha.gov.in',password:pw,role:'provider',linkedId:providers[0]._id},
   {name:'TechNova HR',email:'employer@disha.gov.in',password:pw,role:'employer',linkedId:employers[0]._id},
   {name:aman.name,email:'aman@example.com',password:pw,role:'trainee',linkedId:aman._id}
  ]);
  console.log(`Seed complete: ${trainees.length} Maharashtra trainees across ${districts.length} districts.`);
  console.log('Demo password: disha123');
 }catch(e){console.error('Seed failed:',e);process.exitCode=1}finally{await mongoose.disconnect();}
})();
