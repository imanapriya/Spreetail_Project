# AI Tools & Usage Log

This document lists the AI tools used, core prompts executed, and concrete cases where AI code generation produced issues, how they were debugged, and what changes were made.

---

## 1. AI Tools Used
- **Antigravity (by Google DeepMind)**: Served as the primary pairing agent to generate components, compile schemas, and stage incremental git commits.
- **Model**: Gemini 3.5 Flash (Medium).

---

## 2. Core Prompts
- *"Build a Shared Expenses App based on the provided CSV."*
- *"Add user login, group-wise scoping, dynamic timelines, and an interactive import wizard."*
- *"Do not make a single commit. I need a meaningful commit history. also what are we doing to tackle the issues in expenses export csv"*

---

## 3. Five Concrete Cases of AI Code Errors & Resolutions

### Case 1: Prisma 7 Configuration Incompatibility (Ingestion Phase)
- **Error**: The AI generated a database setup assuming Prisma 7 rules but did not verify global lock compatibility for SQLite configuration, breaking runtime schema sync.
- **How caught**: Running `npx prisma db push` threw a schema validation error (Error code: `P1012`) regarding invalid database url resolution rules.
- **Resolution**: We downgraded the Prisma client to `5.22.0` to ensure stability and compatibility with standard SQLite local database files.

### Case 2: Incompatible SQLite Provider Methods (`createMany: skipDuplicates`)
- **Error**: The AI attempted to seed the database with duplicate roommate records using `prisma.user.createMany({ skipDuplicates: true })`.
- **How caught**: Executing the database seed command threw an "Unknown argument `skipDuplicates`" error because SQLite does not natively support `skipDuplicates` in Prisma's `createMany` query executor.
- **Resolution**: Changed the code to clear the table first, then run sequential transactions or simple `create` calls for each roommate.

### Case 3: CSV Format Desynchronization (CLI Script Phase)
- **Error**: The AI initially built a generic CSV parser assuming standard headers like `Date,Amount,Payer,Beneficiaries`.
- **How caught**: Inspecting the true `Expenses Export.csv` file revealed columns: `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes`.
- **Resolution**: Refactored the parser to inspect split types (`percentage`, `shares`, `unequal`) and read the fuzzy formatting in `split_details` (e.g. `Rohan 700; Priya 400`), converting USD and percentage offsets in real-time.

### Case 4: Next.js 15/16 Async Dynamic Route Parameters Type Mismatch
- **Error**: In dynamic API routes like `app/api/groups/[id]/members/route.ts`, the AI defined route context parameters synchronously: `{ params: { id: string } }`.
- **How caught**: Running `npm run build` failed with TypeScript type errors: `Type does not satisfy the constraint RouteHandlerConfig. Property id is missing in type Promise<{ id: string }> but required in type { id: string }`. Next.js 15/16 resolves dynamic parameters asynchronously.
- **Resolution**: Updated all dynamic parameter definitions to `Promise<{ id: string }>` and awaited the resolution `const { id } = await params;` at the beginning of each HTTP handler method.

### Case 5: Out-of-bounds Config File compilation (`prisma.config.ts`)
- **Error**: The AI generated `prisma.config.ts` for database configuration which was imported and compiled during the build.
- **How caught**: Running `npm run build` failed with `TypeScript compilation error: Cannot find module 'prisma/config' or its corresponding type declarations` because Prisma 5.22.0 does not distribute a config module declaration.
- **Resolution**: Deleted `prisma.config.ts` using `git rm` since Prisma 5 relies exclusively on `prisma/schema.prisma` and `.env` files for configuration.

