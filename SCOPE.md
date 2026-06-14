# Scope & Anomaly Log

This document details the data anomalies discovered in `Expenses Export.csv` and the relational database schema implemented in SQLite to support the Shared Expenses App.

---

## 1. Data Anomalies Discovered & Resolution Policies

During the ingestion of the raw `Expenses Export.csv`, our import wizard detects at least **14 deliberate data problems** and resolves them according to roommate agreements and user approval rules:

| # | Anomaly Type | Row Example | Issue Description | Resolution Policy & User Approval Action |
|---|---|---|---|---|
| **1** | **Duplicate Entry** | Row 5 & 6 (Marina Bites dinner by Dev, ₹3,200) | Identical date, amount, payer, and split list. | **Meera's Request**: Surfaced in the UI. User decides which duplicate to delete or keep. |
| **2** | **Duplicate Conflict** | Row 24 & 25 (Thalassa dinner, Aisha ₹2,400 vs Rohan ₹2,450) | Overlapping descriptions on the same date with different amounts. | **Meera's Request**: Surfaced in the UI. User decides which roommate's claim is valid (e.g. keeping Rohan's, skipping Aisha's). |
| **3** | **Settlement as Expense** | Row 14 (`Rohan paid Aisha back`, ₹5,000) & Row 38 (`Sam deposit share`, ₹15,000) | Peer-to-peer repayments logged in the expense tracker. | **Aisha's Request**: Automatically parsed and re-classified as **Settlements**. These bypass expense splits to keep net balances correct. |
| **4** | **Move-Out Timeline Violation** | Row 36 (`Groceries BigBasket` on April 2, Meera still in split list) | Meera left March 31, but was included in April expenses. | **Sam's/Meera's Request**: Automatically filters Meera out of splits for dates after March 31 based on her moveOutDate. |
| **5** | **Move-In Timeline Violation** | Row 39 (`Housewarming drinks` on April 10, Sam included in split list) | Sam moved in April 15, but was in splits on April 10. | **Sam's Request**: Automatically filters Sam out of splits for dates before April 15 based on his moveInDate (except for his custom deposit). |
| **6** | **Multi-currency Conversion** | Row 20 (`Goa villa booking`, $540 USD) | Trip spending logged in US dollars. | **Priya's Request**: Converts USD to INR at a locked rate of **1 USD = 83 INR**. Stores the original USD values for audit visibility. |
| **7** | **Percentage Split Sum off** | Row 15 & 32 (`Pizza Friday`, percentages sum to 110%) | Custom split percentages do not add up to 100%. | **Calculated normalization**: Automatically normalizes the percentages proportionally (dividing each by 1.1) to sum exactly to 100%. |
| **8** | **Negative Amounts (Refunds)** | Row 26 (`Parasailing refund`, -$30 USD) | Negative price logged. | **Refund Policy**: Ingests as a negative expense, crediting split members and reducing the payer's overall credit. |
| **9** | **Inconsistent Date Format** | Row 27 (`Mar-14`, Airport cab) | Non-standard date notation. | **Fuzzy Date Parsing**: Normalizes to a standard `YYYY-MM-DD` date object (2026-03-14) during import. |
| **10** | **Ambiguous Date Format** | Row 34 (`04-05-2026`, Deep cleaning) | Unclear if the date is April 5th or May 4th. | **Interactive Date Input**: Flags the date in the UI and forces the user to confirm/select the correct date. |
| **11** | **Missing Payer** | Row 13 (`House cleaning supplies`, payer blank) | No paid_by roommate specified. | **Interactive Payer Selector**: Prompts the user to select the payer from the roommate list before committing. |
| **12** | **Missing Currency** | Row 28 (`Groceries DMart`, currency blank) | Currency column omitted. | **Default Policy**: Automatically defaults to INR with an audit warning. |
| **13** | **Zero Amount Expense** | Row 31 (`Swiggy dinner`, ₹0) | Swiggy dinner amount logged as zero. | **Interactive Edit**: Flags the zero amount. User can adjust the value or exclude the row. |
| **14** | **Split Mismatch** | Row 42 (`split_type` is equal, but shares are listed) | Split details conflict with split type. | **Validation**: Confirms that shares are equal (e.g. 1 share each) and executes as equal split. |

---

## 2. Database Schema (SQLite + Prisma)

To support multiple shared groups, membership timelines, manual entry, and detailed audit trails, we implemented the following relational database schema:

```mermaid
erDiagram
    User ||--o{ GroupMember : "belongs to"
    Group ||--o{ GroupMember : "has"
    User ||--o{ Expense : "pays"
    Group ||--o{ Expense : "has"
    Expense ||--o{ ExpenseShare : "splits into"
    User ||--o{ ExpenseShare : "owes"
    User ||--o{ Settlement : "pays (repayment)"
    User ||--o{ Settlement : "receives"
    Group ||--o{ Settlement : "has"

    User {
        String id PK
        String name UNIQUE
        DateTime moveInDate
        DateTime moveOutDate
        String passcode "Default: 1234"
    }

    Group {
        String id PK
        String name UNIQUE
        DateTime createdAt
    }

    GroupMember {
        String id PK
        String groupId FK
        String userId FK
        DateTime joinedAt
        DateTime leftAt
    }

    Expense {
        String id PK
        DateTime date
        String description
        Float amount
        String currency
        Float originalAmt
        String payerId FK
        String groupId FK
        String splitType
        String splitDetails
        String notes
    }

    ExpenseShare {
        String id PK
        String expenseId FK
        String userId FK
        Float amountOwed
    }

    Settlement {
        String id PK
        DateTime date
        String payerId FK
        String payeeId FK
        Float amount
        String groupId FK
      }

    ImportAnomaly {
        String id PK
        String rowData
        String description
        String actionTaken
        DateTime createdAt
    }
```

### Key Relational Constraints:
1. **Dynamic Splitting via Timeline**: The balance engine maps group memberships dynamically. Whenever an expense is loaded, the split list is filtered against the `joinedAt` and `leftAt` boundaries of each user in `GroupMember` and `User` models.
2. **Simplified Debt Settlements**: We compute a Net balance for each user:
   $$\text{Net Balance} = \sum \text{Shares Owed} - \sum \text{Expenses Paid} \pm \sum \text{Settlements}$$
   A greedy simplification algorithm then minimizes payback transactions, satisfying Aisha's request.
3. **Auditing**: All anomaly corrections are logged into the `ImportAnomaly` table and displayed on the Import Report page, satisfying Meera's request.

