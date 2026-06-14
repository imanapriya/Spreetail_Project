# AI Usage Log

## AI Tools Used
- DeepMind Antigravity IDE Agent

## Prompts Used
- "Build a Shared Expenses App based on the provided CSV."
- "Parse the CSV into a SQLite database using Prisma, catching anomalies like Meera moving out early."

## 3 Cases where AI Produced Something Wrong

1. **Prisma 7 Compatibility**:
   - *Error*: The AI generated a `schema.prisma` file that included `url = "file:./dev.db"` inside the `datasource` block. This was standard in Prisma 5, but Prisma 7 removed this feature and strictly enforces URL declarations in a separate `prisma.config.ts`.
   - *How it was caught*: Running `npx prisma db push` threw a schema validation error (Error code: P1012).
   - *Change*: The AI downgraded the project from Prisma 7 back to Prisma 5 to ensure stability and compatibility with existing SQLite patterns rather than risking further breaking changes with the newly released V7 alpha.

2. **Database Seed Method (`skipDuplicates`)**:
   - *Error*: The AI used `prisma.user.createMany({ data: [...], skipDuplicates: true })` during the CSV import process.
   - *How it was caught*: Running the `importCsv.ts` script threw an "Unknown argument `skipDuplicates`" error because the SQLite provider in Prisma does not support `skipDuplicates` for `createMany`.
   - *Change*: The AI removed the `skipDuplicates` argument, correctly deducing that since the DB was fresh, duplicates wouldn't exist natively on the initial seed, and adjusted the script logic to map and cache users safely.

3. **CSV Parsing Assumptions**:
   - *Error*: The AI originally generated a generic mock CSV with columns like `Date,Description,Payer,Amount,Beneficiaries`.
   - *How it was caught*: The user eventually opened the true file `Expenses Export.csv`. The AI immediately recognized that the schema was drastically different (`date,description,paid_by,amount,currency,split_type,split_with,split_details,notes`).
   - *Change*: The AI performed a complete rewrite of the ingestion script to support `split_type` (equal, unequal, percentage, share) and specific anomalies like `notes` flags and commas inside amount strings (`"1,200"`).
