# Design Decision Log

This log documents the key engineering decisions, options considered, and rationales for the architecture and product design of the Shared Expenses App.

---

### 1. Framework: Next.js App Router (React + TS)
- **Options considered**: Express.js + Vite SPA, Next.js.
- **Decision**: Next.js App Router. It allows fullstack server-side APIs (App Router endpoints) and React client pages in a single repository. This simplified deploying and sharing type signatures between front and back.

### 2. Database: SQLite with Prisma ORM
- **Options considered**: PostgreSQL, MongoDB, SQLite.
- **Decision**: SQLite. Perfect for local dev environments and serverless deployments (such as Vercel + SQLite or simple self-contained deployments). Prisma ORM provides type-safety, automatic migration generation, and transaction rollback protection.

### 3. Roommate Passcode Auth (Login Module)
- **Options considered**: Full Firebase/Auth0 OAuth, NextAuth, or Roommate Passcode-based cookie sessions.
- **Decision**: Roommate Passcode sessions. Roommates select their name from a dropdown and input a 4-digit passcode (seeded as `1234`). We set a secure, HTTP-only cookie with the user ID. This is simple, high-performance, requires no external accounts, and secures the API endpoints in a shared roommate environment.

### 4. Group-Based Membership Timelines (Sam & Meera's Requests)
- **Options considered**: Global user join/leave dates, or a dynamic `GroupMember` link table storing `joinedAt` and `leftAt` dates per group.
- **Decision**: Dynamic `GroupMember` timelines. Storing the date range in the link table allows a roommate's membership to be group-specific. If Meera was in the "Flat Expenses" group until March 31, 2026, and Sam joined April 15, 2026, the balance engine automatically filters their split eligibility by comparing the expense date against these boundaries. This satisfies both Sam's and Meera's timeline requests.

### 5. Interactive In-App Import Queue (Meera's Request)
- **Options considered**: CLI auto-migration, silent backend guess, or frontend Interactive Review Wizard.
- **Decision**: **Interactive Review Wizard**. Instead of importing immediately, the app parses the CSV and surfaces anomalies in the UI. For duplicates (Meera's request), it displays them side-by-side and lets the user choose which to delete or keep. For missing fields (like missing payers or ambiguous dates), it allows inline correction in the UI. This keeps the user in control of database changes.

### 6. Currency Conversion Policy (Priya's Request)
- **Options considered**: Dual currency bookkeeping in all tables, or automatic conversion to a base currency (INR) at ingestion.
- **Decision**: Conversion at ingestion with dual auditing. We convert USD to INR using a locked exchange rate of 1 USD = 83 INR. To satisfy Priya's request for verification, we store both the `amount` (INR) and `originalAmt` + `currency` (USD) in the schema so that roommates can verify the exact conversion logic in Rohan's breakdown modal.

### 7. Net Debt Simplification Algorithm (Aisha's & Rohan's Requests)
- **Options considered**: Direct peer-to-peer tracking (e.g. 15 separate transactions) or Greedy Debt Simplification.
- **Decision**: **Greedy Debt Simplification**. We compute the net credit/debit for each roommate (Aisha's Request: "one number per person"). We then sort debtors and creditors and greedily match them to minimize the total number of payback transactions. To satisfy Rohan's request for audit verification, clicking a roommate's balance opens a modal containing the list of every exact expense and share that composed their balance.

