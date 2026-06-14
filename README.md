# Shared Expenses App

A premium, full-stack Next.js web application built to track roommate expenses and resolve debts. It features an interactive CSV import validation pipeline, roommate authentication, multi-currency conversion, timeline-based group membership boundaries, and manual split controls.

---

## 🚀 Setup & Execution Instructions

Follow these steps to run the application locally on your machine:

### 1. Install Dependencies
Ensure you have **Node.js** (v18+) installed. Clone the repository and run:
```bash
npm install
```

### 2. Set Up the Relational Database
Create the SQLite database file and sync the Prisma schema:
```bash
npx prisma db push
```

### 3. Seed the Roommates Profile Data
Seed the initial users (Aisha, Rohan, Priya, Meera, Sam, Dev, and Kabir) with their respective move-in/move-out timeline configurations:
```bash
node prisma/seed.js
```

### 4. Run the Dev Server
Start the local development server:
```bash
npm run dev
```

### 5. Access the Web App
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Application Features & How to Navigate

### 1. Roommate Login
- Secure page guards will redirect you to `/login`.
- Select your roommate profile from the dropdown.
- Input the default passcode: **`1234`** to sign in.

### 2. Interactive CSV Import Wizard
- Navigate to **Import CSV** from the dashboard.
- Select or create a billing group (e.g. create a group named "Flat Expenses").
- Select/upload the `Expenses Export.csv` file from the repository root.
- The wizard parses the rows and highlights anomalies. 
- **Meera's Request (Duplicate Approval)**: Select which duplicate to keep or merge.
- **Ambiguous Dates / Missing Payers**: Correct values inline before finalizing the import.
- Click **Confirm & Finalize Import** to commit rows to the SQLite database.

### 3. Group wise Timeline Calculations
- Go to **Manage Groups** to add/remove members and configure their joined/left timelines.
- **Sam's Request**: If Sam is active after April 15, expenses logged before that date will automatically exclude him.
- **Meera's Request**: If Meera left March 31, expenses logged in April automatically exclude her.
- Select your active group on the dashboard to see instant net balances (Aisha's Request).

### 4. Expense Breakdown & Auditing
- On the dashboard, click on any roommate's name.
- **Rohan's Request**: A detailed modal pops up, showing the exact itemized history of expenses they paid and shares they owe that make up their net balance.
- **Priya's Request (USD conversions)**: Verify the Goa trip dollar expenses converted at the locked rate of **1 USD = 83 INR** inside the breakdowns.

---

## 🛠️ Technology Stack & AI Collaborators
- **Frontend & Backend**: Next.js App Router (React, TypeScript)
- **Styling**: Custom Glassmorphism Theme (Vanilla CSS, Inter typography, slide animations)
- **Database ORM**: Prisma ORM with SQLite
- **Primary AI Pairing Collaborator**: Gemini 3.5 Flash (via Antigravity Agent)

