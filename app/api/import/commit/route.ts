import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { groupId, transactions, anomalies } = await request.json();

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });
    if (!group) {
      return NextResponse.json({ error: 'Selected group does not exist' }, { status: 404 });
    }

    const dbUsers = await prisma.user.findMany();
    const userMap = new Map(dbUsers.map(u => [u.name.toLowerCase().trim(), u]));

    // Perform database insertions inside a transaction
    await prisma.$transaction(async (tx) => {
      // Clear previous anomalies for a clean report log
      await tx.importAnomaly.deleteMany();

      // Clear previous group expenses and settlements to avoid duplicating the CSV import
      await tx.expense.deleteMany({ where: { groupId } });
      await tx.settlement.deleteMany({ where: { groupId } });

      // 1. Insert expenses and settlements
      for (const t of transactions) {
        const date = new Date(t.date);
        
        if (t.isSettlement) {
          // Identify payee from split members
          if (!t.beneficiaries || t.beneficiaries.length === 0) continue;
          
          const payeeId = t.beneficiaries[0].id;
          
          await tx.settlement.create({
            data: {
              date,
              amount: parseFloat(t.amount),
              payerId: t.payerId,
              payeeId,
              groupId
            }
          });
        } else {
          // Standard Expense
          const expense = await tx.expense.create({
            data: {
              date,
              description: t.description,
              amount: parseFloat(t.amount),
              currency: t.currency || 'INR',
              originalAmt: t.originalAmt ? parseFloat(t.originalAmt) : null,
              payerId: t.payerId,
              groupId,
              splitType: t.splitType || 'equal',
              splitDetails: t.splitDetails || null,
              notes: t.notes || null
            }
          });

          // Insert Shares
          const splitType = t.splitType || 'equal';
          const beneficiaries = t.beneficiaries || [];
          const amount = parseFloat(t.amount);

          if (beneficiaries.length === 0) continue;

          if (splitType === 'equal') {
            const shareAmount = amount / beneficiaries.length;
            for (const b of beneficiaries) {
              await tx.expenseShare.create({
                data: {
                  expenseId: expense.id,
                  userId: b.id,
                  amountOwed: shareAmount
                }
              });
            }
          } else if (splitType === 'percentage') {
            // Parse split details: e.g. "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"
            let sharesObj: Record<string, number> = {};
            let totalPct = 0;

            t.splitDetails.split(';').forEach((s: string) => {
              const parts = s.trim().split(' ');
              const name = parts[0]?.toLowerCase();
              const pStr = parts[parts.length - 1];
              if (!name || !pStr) return;

              const p = parseFloat(pStr.replace('%', ''));
              let cleanName = name;
              if (cleanName === 'priya s') cleanName = 'priya';
              
              const u = userMap.get(cleanName);
              if (u) {
                sharesObj[u.id] = p;
                totalPct += p;
              }
            });

            for (const b of beneficiaries) {
              const pct = sharesObj[b.id] || 0;
              // Normalize to sum of totalPct to fix Pizza sum 110%
              const normalizedPct = totalPct > 0 ? (pct / totalPct) * 100 : 0;
              const shareAmount = (amount * normalizedPct) / 100;
              
              await tx.expenseShare.create({
                data: {
                  expenseId: expense.id,
                  userId: b.id,
                  amountOwed: shareAmount
                }
              });
            }
          } else if (splitType === 'share' || splitType === 'shares') {
            // Parse split details: e.g. "Aisha 1; Rohan 2; Priya 1; Dev 2"
            let sharesObj: Record<string, number> = {};
            let totalShares = 0;

            t.splitDetails.split(';').forEach((s: string) => {
              const parts = s.trim().split(' ');
              const name = parts[0]?.toLowerCase();
              const shStr = parts[parts.length - 1];
              if (!name || !shStr) return;

              const sh = parseFloat(shStr);
              let cleanName = name;
              if (cleanName === 'priya s') cleanName = 'priya';

              const u = userMap.get(cleanName);
              if (u) {
                sharesObj[u.id] = sh;
                totalShares += sh;
              }
            });

            for (const b of beneficiaries) {
              const sh = sharesObj[b.id] || 0;
              const shareAmount = totalShares > 0 ? (amount * sh) / totalShares : 0;

              await tx.expenseShare.create({
                data: {
                  expenseId: expense.id,
                  userId: b.id,
                  amountOwed: shareAmount
                }
              });
            }
          } else if (splitType === 'unequal') {
            // Parse split details: e.g. "Rohan 700; Priya 400; Meera 400"
            let sharesObj: Record<string, number> = {};

            t.splitDetails.split(';').forEach((s: string) => {
              const parts = s.trim().split(' ');
              const name = parts[0]?.toLowerCase();
              const shStr = parts[parts.length - 1];
              if (!name || !shStr) return;

              const sh = parseFloat(shStr);
              let cleanName = name;
              if (cleanName === 'priya s') cleanName = 'priya';

              const u = userMap.get(cleanName);
              if (u) {
                sharesObj[u.id] = sh;
              }
            });

            for (const b of beneficiaries) {
              const shareAmount = sharesObj[b.id] || 0;
              
              await tx.expenseShare.create({
                data: {
                  expenseId: expense.id,
                  userId: b.id,
                  amountOwed: shareAmount
                }
              });
            }
          }
        }
      }

      // 2. Insert logged anomalies for the report screen
      if (Array.isArray(anomalies)) {
        for (const a of anomalies) {
          await tx.importAnomaly.create({
            data: {
              rowData: a.rowData || '',
              description: a.description,
              actionTaken: a.actionTaken
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Commit CSV error:', error);
    return NextResponse.json({ error: 'Failed to commit CSV records to database' }, { status: 500 });
  }
}
