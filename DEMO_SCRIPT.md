# R-NLAM demo video: script

_SIH 2026 · PS 26016 · Team GAP BRIDGERS · "Connecting Land, Law & People"._

## 1. Before you record

### Start-up, in this order (from the repo root)

**1. Database**, about 200 MB. It lives at `C:\dev\rnlam-pg` and keeps running until you stop it.
```powershell
powershell -ExecutionPolicy Bypass -File scripts\db-start.ps1
```

**2. Build the frontend** once after any code change (about 4 min; peaks around 1 GB). Nothing else heavy should be running while it builds.
```powershell
cd frontend; npx next build
```

**3. Reset the demo data**, before every take (about 11 s).
```powershell
cd backend; npm run seed:demo
```

**4. Backend API** on :4000, about 250 MB. Leave its window open.
```powershell
cd backend; npm run start:demo
```

**5. Frontend** on :3000, about 150 MB. Leave its window open.
```powershell
cd frontend; npx next start
```

**6. AI service**, only for segment 8 (Ask the Act and Read fields). About 100 MB; it's ready when the log says "Application startup complete".
```powershell
cd ai-service; .venv\Scripts\python -m uvicorn app.main:app --port 8000
```

### Memory
- **Measured together:** with all four running (DB, backend, frontend, AI) there were 3.9 GB free; the whole stack uses about 0.5 GB.
- **If RAM is tight:**
  - Segments 1–7 need only the DB, backend and frontend.
  - Start the AI service just before segment 8.
  - Never run `next build` or `npm run dev` while recording.

### Screen
- **Browser:** Chrome, one window, 1920×1080 (or 1280×720), zoom 100%.
- **Sign-in:** start every segment at http://localhost:3000/login. Personas are one click; no passwords.
- **Citizen sign-in:** at `/citizen/login`. The OTP code is shown on screen (demo mode).
- **Parcel IDs:** these change on every reseed, so always reach parcels by clicking, never by a saved URL.

### Retakes
- **Any segment:** `npm run seed:demo`, then sign in again. The reseed logs everyone out, and resets all of these:
  - decisions, court links, complaints and replies;
  - field evidence, field-check tasks and uploaded documents;
  - the audit trail.
- **Field app (segment 6):** also go to **Sync → Reset this device**. That clears the phone-side queue, and turns off *Work offline* if it was left on.
- **Audit tamper (segment 5):** `npm run demo:restore` (or reseed).
- **Citizen language:** the portal remembers the last language. Tap **English / हिन्दी / मराठी** at the top.

## 2. Shot list

Timings are rough; the whole path is about 10 minutes.

### Segment 1: Opening and the national picture (1 min)
**Deck:** live interest liability.

**Persona:** Login page, then **Anita Deshpande** (National administrator).

**Clicks:**
1. Hold on the login page for 3 s.
2. Click **Anita Deshpande**. The Command dashboard opens.
3. Click the **full-screen** icon (top right).
4. Hold 5 s on the ticking "Statutory cost of delay".
5. Pan down to **Top 10 stuck projects**.
6. Press Esc.

**Shown:**
- The live cost of delay (about ₹3.8 crore, rising by about ₹75,000 a day).
- GIS-blocked parcels, SLA breaches, and families waiting for resettlement.
- Every project's stage mix.
- The ten most stuck projects, each with its brief, owner and deadline.

**Narration:**
> "This is R-NLAM's national command screen. Every rupee here is computed from the Act itself: this counter is the interest and additional amount that delay is costing the exchequer, ticking up every second."
> "Below it, the ten projects most stuck in the country, each with what is blocked, who owns it, and by when."

### Segment 2: Why is this project stuck? (1.5 min)
**Deck:** Why-Stuck.

**Persona:** Anita (continue).

**Clicks:**
1. In the sidebar, click **Why is it stuck?**.
2. Point at the Wardha–Yavatmal card (priority 62).
3. The #1 brief is open: "Wadgaon & Dhanora: the preliminary notification lapses on 5 Nov 2026…". Scroll through **What is blocked / Why / Impact / Recommended next step / Evidence / How the priority is computed**.
4. Click **Dispute**, type "Hearings concluded yesterday", and confirm. The brief shows the dispute, and it is audited.

**Narration:**
> "R-NLAM doesn't just show red dots. It tells the Collector exactly why a project is stuck, what the law says happens if nothing is done (here the whole notification lapses on 5 November), and the one next step, with the evidence and the section behind it."
> "Priority is statutory risk times money times families, and every part is explained. Officers can accept or dispute a brief, and that is recorded too."

*Optional add-on, 30 s, court links:*
1. Sign in as **Sameer Khan** (Collector, Yavatmal) and open **Court case links**.
2. Show the match reasons, then click **Confirm link** on **SCS 131/2025** (the forest-land suit).
3. Open **Why is it stuck?**: a new *Litigation* brief appears, carrying the case's CNR.

### Segment 3: The GIS consent gate (1.5 min)
**Deck:** GIS gate.

**Persona:** Anita (or Sameer Khan).

**Clicks:**
1. In the sidebar, click **GIS consent gate**. The map opens on the red parcel inside the Kharshi Reserved Forest.
2. Scroll the list to **YTL-KRS-004** and open the parcel.
3. Click **Declare award**, then **Preview calculation**. Every line of the award shows its section: market value, the 1.8 factor, solatium, and the 12% additional amount.
4. Click **Declare award**. The backend refuses: "Blocked by law…". Two blockers appear: forest clearance, and the FRA settlement certificate.

**Narration:**
> "Every parcel is intersected in PostGIS with forest, Scheduled Area, forest-rights and coastal layers. Half of this parcel is reserved forest."
> "The award calculation is right here, line by line, each line citing its section. But when the Collector tries to declare it, the system refuses, citing the Forest Conservation Act and the Forest Rights Act, until the clearance is on file. The law is enforced in the backend, not just shown on a map."

### Segment 4: Live interest liability (45 s)
**Deck:** live interest liability.

**Persona:** Anita.

**Clicks:**
1. In the sidebar, click **Interest liability**. Hold on the ticking total.
2. Scroll to **Trend**: s.80 interest ₹1.7 L → ₹6.9 L (+311%) in 12 months.
3. Scroll to the drill-down table (State → District → Village → Parcel) and click **Maharashtra**.

**Narration:**
> "Section 80 of the Act: when land is taken before the owner is paid, interest runs at nine percent, then fifteen. R-NLAM computes it live, parcel by parcel. Here it has grown fourfold in a year."
> "It shows exactly which payments to release this week to stop the meter."

### Segment 5: Tamper-evident audit, Merkle (1 min)
**Deck:** Merkle audit.

**Persona:** Anita.

**Clicks:**
1. **Governance → Audit trail**, or go straight to `/central/audit`.
2. Click **Verify now**. The badge reads **Integrity: Verified ✓**, and the Merkle roots are listed below.
3. Off camera, in the backend folder, run:
   ```powershell
   npm run demo:tamper
   ```
   This silently edits one award amount in the database.
4. Click **Verify now** again. The badge reads **Integrity: BROKEN**, "Entry #157 was modified after it was written".
5. Off camera, restore it:
   ```powershell
   npm run demo:restore
   ```

**Narration:**
> "Every action in R-NLAM is hash-chained and sealed every day into a Merkle root, the same technique certificate-transparency logs use."
> "Watch: someone with database access quietly changes an award amount. One click, and the system pinpoints exactly which record was altered."

### Segment 6: Offline field app (1.5 min)
**Deck:** offline field app.

**Persona:** **Kiran Bhosale** (Field survey, Wardha).

**Clicks:**
1. The Field app opens.
2. Tick **Work offline** in the green bar. It turns amber: "Offline: capture still works…".
3. Go to **Capture evidence**, choose parcel **WRD-BRG-006**, and pick the **Walk the boundary** tab.
4. Tick **Demo without a GNSS receiver: simulate a walk…**, then click **Start GNSS**.
5. Click **Add corner here** four times, about 2 seconds apart. Watch the sketch trace the boundary and the area appear.
6. Click **Seal and queue**. The dialog shows the SHA-256 seal. Close it.
7. Open **Sync**: "Waiting to upload: 1".
8. Untick **Work offline**. Within a few seconds the item turns **Accepted by server**, with "Server re-checked the seal ✓ · matches the recorded boundary ~98% (IoU)".

**Narration:**
> "Surveyors work where there is no network. The field app captures GNSS points and walked boundaries offline, and seals each capture with SHA-256 on the phone itself."
> "The moment the connection returns, it syncs, and the server re-checks the seal, so nobody can alter evidence in between. It even measures how well the walk matches the recorded boundary."

*Optional add-on:* sign in as **Priya Wagh** (Collector, Wardha) and open **Field evidence → Conflicts**. Two surveyors disagree about WRD-KRG-005, and the Collector chooses; nothing is overwritten.

### Segment 7: Citizen portal in Marathi and Hindi (1.5 min)
**Deck:** multilingual citizen portal.

**Persona:** Citizen **Namdeo** (9800000002).

**Clicks:**
1. From the login page, click **Land holder? See your land…**.
2. Tap **मराठी**. Enter `9800000002`, tap **OTP पाठवा**, type the code shown, then tap **साइन इन करा**.
3. **Home:** stage in plain Marathi, plus the progress bar.
4. **माझी जमीन:** his parcel on the map, and the dates the law guarantees him.
5. **तक्रार:** his registered complaint in Marathi ("DOLR/SYN/2026/…").
6. Tap **हिन्दी**. The whole portal switches.

*Optional:* sign in as **Sameer Khan**, open **Citizen grievances**, and reply to Namdeo's complaint. Then show the reply on Namdeo's phone.

**Narration:**
> "Land holders are not officers. R-NLAM's citizen portal speaks English, Hindi and Marathi, works on any phone, and spells out the dates the law guarantees them."
> "Namdeo can see his land, how his money will be worked out, and raise a complaint in his own language. The Collector's office sees it and answers."

### Segment 8: Change detection and AI (2 min)
**Deck:** change detection and AI.

**Persona:** **Priya Wagh** (Collector, Wardha). The AI service must be running.

**Clicks:**
1. **Change detection:**
   1. In the sidebar, click **Change detection**. **WRD-BRG-001** (New structures) is selected.
   2. Drag the slider from left to right. The red region appears: "New structures · 210 m²".
   3. Point at "Preliminary notification published 10 Jun 2025… s.11(4)".
   4. Click **Create field-check task**. A green box appears: "Field check raised… due …".
   5. Optionally, click the **Boundary moved** and **Trees felled** cards.
2. **Ask the Act:** ask the three questions below, clicking each chip. Each answer is a big one-line answer, then the Act's own words with the section.
3. **Read fields:**
   1. Go to **Documents** and click **Read fields** on **Award under section 23, WRD-BRG-006**, then **Propose fields**.
   2. Point at each field's confidence and the line it was read from, and at **Reference no.** flagged "check this".

**Narration:**
> "After a notification, nothing may be built or sold on the land. R-NLAM compares satellite passes against every notified parcel; here, two new structures appeared on land already under acquisition. One click sends a surveyor, with a seven-day deadline."
> "Officers can ask the Act directly. Every answer quotes the law and cites the section; if it can't find the answer, it says so."
> "And award papers are read automatically: each field with its confidence and the exact line it came from. Anything uncertain must be confirmed by a person."

## 3. The three Ask the Act questions

They are clickable chips on the page, all checked to answer correctly:

1. **"Within how many days can a person object after the preliminary notification?"** Answer **60 days**, RFCTLARR 2013, s.15(1).
2. **"What interest is payable if compensation is not paid before possession?"** Answer **9% per annum**, s.80. The note adds 15% after the first year.
3. **"Is Gram Sabha consent needed in Scheduled Areas?"** Answer **Gram Sabha consent**, s.41(3), not overridable.

Spare: **"When does the award lapse?"** Answer **12 months**, s.25.

Don't type your own questions on camera: retrieval is weak on reworded questions.

## 4. Avoid on camera

- **Screens not polished:**
  - Analytics / natural-language query, Reports, Workflows, Integrations and Settings.
  - The GIS cell's Import / Export / Data quality / Spatial analytics.
  - The PIA and Finance portals.
  - The field app's **Map** and **Completed** pages.
  - Swagger (`/api/docs`).
- **Merkle root list on the audit page:** it shows ISO dates and raw hashes. That's fine for a technical audience, but don't linger on it.
- **Free-typed questions** in Ask the Act (see above).
- **Browser DevTools and the terminal windows**, except the one tamper command, which you can cut.
- **Installing the field app as a PWA:** the service worker was not verified in a normal browser.
- **The yellow "Demonstration build: all records are synthetic" banner** stays on every officer screen on purpose. Don't crop it out: it keeps the demo honest.
