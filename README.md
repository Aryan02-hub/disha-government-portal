# DISHA Government Skilling Outcomes Platform – Final Integrated v3

## Run
1. Install MongoDB and start it locally.
2. Open this project folder in terminal.
3. Run `npm install`.
4. Run `npm run seed` for demo data.
5. Run `npm start`.
6. Open `http://localhost:5000`.

## Demo accounts
Password for seeded demo accounts: `disha123`
- Government/Admin: `admin@disha.gov.in`
- Provider: `provider@disha.gov.in`
- Employer: `employer@disha.gov.in`
- Trainee: `aman@example.com`

## Direct Student Dashboard workflow
Admin/Provider → Trainee Records → View trainee → **Request Profile & Outcome Update**.
This creates a dashboard-only request. No SMS, WhatsApp or Email is required.

Student → login → Overview → **Update My Profile** or **My Outcome & Verification**.
The adaptive questionnaire asks for contact information, employment status, salary, satisfaction and job-exit reasons when applicable.

## Charts
Charts use current MongoDB trainee records. The final version uses fixed responsive chart containers and CSS conic donuts to prevent chart content from being clipped below cards.

## Optional real delivery
SMS/WhatsApp requires valid Twilio credentials. Email requires SMTP credentials. Leave them blank for Dashboard/Demo mode.

## DishaAI Career Coach
- Adaptive course quiz/chat for trainees
- Data-driven employability score and outcome risk
- Skill-gap analysis using course expectations and live DISHA employer job postings
- Course/reskilling recommendations
- Resume upload and review (PDF, DOCX, TXT)

After updating the project run:
`npm install`
Then run `npm run seed` and `npm start`.
