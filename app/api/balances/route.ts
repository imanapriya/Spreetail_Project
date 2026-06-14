import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    const expenses = await prisma.expense.findMany({ include: { shares: true } });
    const settlements = await prisma.settlement.findMany();

    // Calculate net balances for each user
    // positive = user owes money to the group
    // negative = group owes user money
    const balances: Record<string, number> = {};
    users.forEach(u => balances[u.id] = 0);

    // 1. Add their shares (amount they owe)
    for (const exp of expenses) {
      for (const share of exp.shares) {
        balances[share.userId] += share.amountOwed;
      }
      // 2. Subtract what they paid
      if (balances[exp.payerId] !== undefined) {
        balances[exp.payerId] -= exp.amount;
      }
    }

    // 3. Handle settlements
    for (const s of settlements) {
      if (balances[s.payerId] !== undefined) balances[s.payerId] -= s.amount;
      if (balances[s.payeeId] !== undefined) balances[s.payeeId] += s.amount;
    }

    // Rounding to avoid float precision issues
    Object.keys(balances).forEach(k => {
      balances[k] = Math.round(balances[k] * 100) / 100;
    });

    // Simplify debts
    const debtors = [];
    const creditors = [];

    for (const userId of Object.keys(balances)) {
      const b = balances[userId];
      if (b > 0.01) debtors.push({ userId, amount: b });
      else if (b < -0.01) creditors.push({ userId, amount: -b });
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const amount = Math.min(debtor.amount, creditor.amount);
      transactions.push({
        from: users.find(u => u.id === debtor.userId)?.name,
        to: users.find(u => u.id === creditor.userId)?.name,
        amount: Math.round(amount * 100) / 100
      });

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    // Prepare detailed breakdown per user
    const breakdown = users.map(u => {
      const userExpenses = expenses.filter(e => e.payerId === u.id);
      const userShares = expenses.filter(e => e.shares.some(s => s.userId === u.id)).map(e => {
        const share = e.shares.find(s => s.userId === u.id)!;
        return { ...e, myShare: share.amountOwed };
      });
      const userSettlementsPaid = settlements.filter(s => s.payerId === u.id);
      const userSettlementsRcvd = settlements.filter(s => s.payeeId === u.id);

      return {
        user: u.name,
        netBalance: balances[u.id],
        paidExpensesCount: userExpenses.length,
        totalPaid: userExpenses.reduce((sum, e) => sum + e.amount, 0),
        shareCount: userShares.length,
        totalShareOwed: userShares.reduce((sum, e) => sum + e.myShare, 0),
        expenses: userExpenses,
        shares: userShares,
        settlementsPaid: userSettlementsPaid,
        settlementsRcvd: userSettlementsRcvd
      };
    });

    return NextResponse.json({
      transactions,
      breakdown
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}
