# Shared Expenses App

A full-stack Next.js application built to parse, correct, and calculate shared flat expenses. It processes a messy CSV export, detects data anomalies automatically, and calculates final "who owes who" balances.

## Setup Instructions

1. Ensure Node.js and npm are installed.
2. Clone this repository or open the project folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up the database schema and generate the Prisma Client:
   ```bash
   npx prisma db push
   ```
5. Ingest the CSV Data:
   ```bash
   npx tsx scripts/importCsv.ts
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```
7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## AI Used

This application was completely built using an AI Coding Assistant. The core AI architecture parsed the raw CSV, detected the data anomalies programmatically, decided on the best way to handle edge cases (like Meera moving out), and generated the SQLite data models.
