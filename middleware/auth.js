const jwt=require('jsonwebtoken');
module.exports=(roles=[])=> (req,res,next)=>{
  const header=req.headers.authorization||''; const token=header.startsWith('Bearer ')?header.slice(7):null;
  if(!token) return res.status(401).json({message:'Authentication required'});
  try{const user=jwt.verify(token,process.env.JWT_SECRET||'disha_dev_secret');req.user=user;if(roles.length&&!roles.includes(user.role))return res.status(403).json({message:'Access denied'});next();}
  catch(e){res.status(401).json({message:'Invalid or expired token'});}
};
