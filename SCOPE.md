# Scope & Anomaly Log

## Data Anomalies Discovered
During the ingestion of `Expenses Export.csv`, the following data problems were detected and handled by the import engine:

1. **Missing Currency**: `Groceries DMart` by Priya on 15-03 was missing currency. Handled by defaulting to INR.
2. **Date Format Issues**: Mixed formats like `04-05-2026` and `Mar-14`. Handled by a robust date parser that standardizes all strings to ISO Date objects.
3. **Payer Case & Typos**: `Priya` vs `priya` vs `Priya S`. Handled via normalization.
4. **Duplicate Entries**: Same expense logged by Aisha and Rohan (`Thalassa dinner`). Handled by skipping duplicates based on matching date and descriptions.
5. **Negative Amounts (Refunds)**: `Parasailing refund` was negative. Preserved and treated properly to reduce the cost to beneficiaries.
6. **Comma in Amounts**: Amounts like `"1,200"` could not be parsed naturally. Handled by regex-stripping everything except digits and decimals.
7. **Settlements as Expenses**: `Rohan paid Aisha back` was logged under the expenses structure. Handled by detecting 'settlement' keywords and logging it to the `Settlement` table instead.
8. **Invalid Split Percentages**: A `percentage` split summed to 110% (30/30/30/20). Handled by normalizing the ratios automatically to sum exactly to 100%.
9. **Beneficiary Time Limits**: Meera was in `split_with` for groceries after she moved out, and Sam paid deposit before moving in. Handled by filtering beneficiaries against `moveInDate` and `moveOutDate`.
10. **Zero Amount Entries**: `Dinner order Swiggy` with `0`. Handled by ignoring the row.
11. **USD Conversion**: `Goa villa booking` was logged as `540 USD`. Handled by multiplying by a configurable `EXCHANGE_RATE` (83 INR/USD) while retaining the original currency footprint.

## Database Schema (SQLite)
The application handles the relational logic through the following core Prisma models:
- **User**: Name, `moveInDate`, `moveOutDate`.
- **Expense**: Date, description, amount (INR), original currency amount, payer relation, split types/notes.
- **ExpenseShare**: Join table representing exactly how much each User owes for a specific Expense.
- **Settlement**: Tracks exact direct payments between Users.
- **ImportAnomaly**: Audit log storing raw rows, descriptions, and automated actions taken.
