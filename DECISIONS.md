# Decision Log

1. **Framework Choice**: Next.js App Router
   * *Options considered*: Express/React, Vite, Next.js.
   * *Decision*: Next.js was chosen because it allows seamless integration of backend APIs and frontend React components without maintaining two separate repositories, speeding up deployment and reducing complexity.

2. **Database Choice**: SQLite with Prisma
   * *Options considered*: PostgreSQL, MongoDB, SQLite.
   * *Decision*: SQLite provides zero-configuration local persistence, which is ideal for a flat expenses app that does not require massive horizontal scaling. Prisma simplifies database interactions through type-safe schemas.

3. **Currency Conversion Logic**: Time-of-Import vs Real-time
   * *Options considered*: Keeping multiple currency columns, querying live APIs for exchange rates, or locking a fixed rate during ingestion.
   * *Decision*: Locked a static `EXCHANGE_RATE` at the point of ingestion (import script) to avoid complex multi-currency arithmetic in the views, while preserving the `originalAmt` and `currency` in the database for auditing purposes.

4. **Balance Resolution Algorithm**: Net Balances
   * *Options considered*: Mapping every exact expense to the person who paid it, vs pooling debts.
   * *Decision*: Used a pooled Net Balance approach. It calculates what each person inherently owes vs what they paid. If positive, they owe the group. A greedy simplification algorithm calculates the exact path of payouts to ensure "Everyone is settled up" with the minimum number of transactions.

5. **Anomaly Handling**: Soft-Skips vs Hard Fails
   * *Options considered*: Crashing the script when encountering an error vs logging it and continuing.
   * *Decision*: Soft-skips were used. The ingestion script never crashes. Instead, it creates an `ImportAnomaly` database record documenting exactly what data failed or was corrected, and the action taken. This serves as the Import Report.
