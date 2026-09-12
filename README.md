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

## Government Command Center update
The Government/Admin overview is now data-driven rather than using synthetic national/state presets. It supports Maharashtra-wide, district, revenue-division and cohort-year filtering; six retention horizons (3M, 6M, 12M, 2Y, 3Y, 5Y); course and provider placement performance; employer skill-demand signals; wage progression; outcome mix; verification backlog; AI evidence-based intervention flags; and an interactive Maharashtra district map. The map uses Leaflet/OpenStreetMap tiles and a public Maharashtra district GeoJSON boundary source at runtime, so an internet connection is required for the map tiles/boundaries.

Seed data is Maharashtra-only across 36 districts. Dropped-out enrollments use the `dropped_out` enrollment status consistently.


## Trainee completion → feedback workflow
When a provider issues the DISHA certificate after all required assessments and attendance checks, the trainee is marked training-complete/certified, the enrollment is closed, and a post-training feedback/update request is created. If SMTP is configured, a real congratulations email is sent to the registered trainee email. Without SMTP, the workflow is recorded in the Student Dashboard as demo delivery. The student can then update current outcome (employed, self-employed, apprenticeship/internship, further education or seeking employment) and submit a 1–5 training rating plus improvement suggestions. Provider and Government views read the same MongoDB trainee record, so the latest profile/outcome is available when their records are refreshed.

## Explainable AI intelligence
Government Overview includes high-demand course signals based on overlap between open-job skill requirements and course skills, best/worst district outcome signals, skill demand and trainee gap signals, plus intervention recommendations. Provider Overview also receives explainable market-demand recommendations. These are evidence-based decision-support signals, not guarantees or automatic policy decisions.
