import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const CSV_PATH = path.resolve(process.cwd(), '../Expenses Export.csv');
const EXCHANGE_RATE = 83; // 1 USD = 83 INR

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // handle "Mar-14"
  if (dateStr.match(/^[A-Za-z]{3}-\d{1,2}$/)) {
    const [month, day] = dateStr.split('-');
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(month) + 1;
    return new Date(`2026-${m.toString().padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
  }
  // handle "DD-MM-YYYY"
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // Check if it's "04-05-2026" ambiguous. Assuming DD-MM-YYYY standard for India.
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
  }
  return null;
}

async function main() {
  console.log('Starting CSV Import...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  
  // Basic CSV parser to handle quotes
  const rows: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cell = '';
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    if (char === '"' && csvContent[i+1] === '"') {
      cell += '"'; i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell); cell = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const records = rows.slice(1);

  await prisma.user.createMany({
    data: [
      { name: 'Aisha' },
      { name: 'Rohan' },
      { name: 'Priya' },
      { name: 'Meera', moveOutDate: new Date('2026-03-31T00:00:00Z') },
      { name: 'Sam', moveInDate: new Date('2026-04-15T00:00:00Z') },
      { name: 'Dev' },
      { name: 'Kabir' }
    ]
  });
  
  const users = await prisma.user.findMany();
  const userMap = new Map(users.map(u => [u.name.toLowerCase().trim(), u]));
  
  const seenTransactions = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.length < 5) continue;
    
    let dateStr = record[0]?.trim();
    let desc = record[1]?.trim();
    let payerStr = record[2]?.trim().toLowerCase();
    let amtStr = record[3]?.trim();
    let currencyStr = record[4]?.trim().toUpperCase();
    let splitType = record[5]?.trim().toLowerCase();
    let splitWithStr = record[6]?.trim();
    let splitDetailsStr = record[7]?.trim();
    let notes = record[8]?.trim();
    
    const rawRowStr = record.join(',');

    // Map payers like 'priya s' to 'priya'
    if (payerStr === 'priya s') payerStr = 'priya';

    const payer = userMap.get(payerStr);
    if (!payer) {
      if (desc && amtStr) {
        await prisma.importAnomaly.create({
          data: { rowData: rawRowStr, description: `Missing or unknown payer: ${payerStr || 'Empty'}`, actionTaken: 'Skipped row' }
        });
      }
      continue;
    }

    const date = parseDate(dateStr);
    if (!date || isNaN(date.getTime())) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Invalid Date: ${dateStr}`, actionTaken: 'Skipped row' }
      });
      continue;
    }

    let amount = parseFloat(amtStr.replace(/[^0-9.-]+/g, ""));
    if (isNaN(amount) || amount === 0) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Invalid or 0 amount: ${amtStr}`, actionTaken: 'Skipped row' }
      });
      continue;
    }

    // Settlements
    if (desc.toLowerCase().includes('settlement') || notes?.toLowerCase().includes('settlement')) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Settlement logged as expense: ${desc}`, actionTaken: 'Logged as Settlement' }
      });
      
      const payeeName = splitWithStr.split(';')[0].trim().toLowerCase();
      const payee = userMap.get(payeeName);
      if (payee) {
        await prisma.settlement.create({
          data: { date, amount, payerId: payer.id, payeeId: payee.id }
        });
      }
      continue;
    }

    // Currencies
    if (!currencyStr) {
      currencyStr = 'INR';
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Missing currency for ${desc}`, actionTaken: 'Assumed INR' }
      });
    }

    let originalAmt = null;
    if (currencyStr === 'USD') {
      originalAmt = amount;
      amount = amount * EXCHANGE_RATE;
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `USD expense ${desc}.`, actionTaken: `Converted to INR (${originalAmt} * ${EXCHANGE_RATE} = ${amount})` }
      });
    }

    // Duplicate logic: same date, same amount, same payer (fuzzy)
    // There's a case of Aisha and Rohan both logging "Thalassa dinner".
    if (desc.toLowerCase().includes('thalassa') && dateStr === '11-03-2026') {
      if (payer.name === 'Aisha') {
        await prisma.importAnomaly.create({
          data: { rowData: rawRowStr, description: `Duplicate/Conflict for Thalassa dinner`, actionTaken: 'Skipped Aisha\'s entry based on note' }
        });
        continue;
      }
    }

    // Deduplication key
    const uniqKey = `${date.getTime()}-${Math.round(amount)}-${payer.id}`;
    if (seenTransactions.has(uniqKey)) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Duplicate expense detected for ${desc}`, actionTaken: 'Skipped row' }
      });
      continue;
    }
    seenTransactions.add(uniqKey);

    // Negative amounts (Refunds)
    if (amount < 0) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Negative amount (Refund) for ${desc}`, actionTaken: 'Logged as negative expense' }
      });
    }

    // Beneficiaries list
    let beneficiaries = splitWithStr.split(';').map(s => s.trim().toLowerCase()).filter(Boolean).map(n => userMap.get(n)).filter(Boolean) as typeof users;

    // Filter beneficiaries by move dates
    let originalBeneficiaryCount = beneficiaries.length;
    beneficiaries = beneficiaries.filter(b => {
      if (b.moveOutDate && date > b.moveOutDate) return false;
      if (b.moveInDate && date < b.moveInDate) return false;
      return true;
    });

    if (beneficiaries.length < originalBeneficiaryCount) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `Removed inactive beneficiaries from ${desc} based on move-in/out dates`, actionTaken: 'Filtered beneficiaries' }
      });
    }

    if (beneficiaries.length === 0) {
      await prisma.importAnomaly.create({
        data: { rowData: rawRowStr, description: `No active beneficiaries for ${desc}`, actionTaken: 'Skipped' }
      });
      continue;
    }

    const expense = await prisma.expense.create({
      data: {
        date,
        description: desc,
        amount,
        currency: currencyStr,
        originalAmt,
        payerId: payer.id,
        splitType: splitType || 'equal',
        splitDetails: splitDetailsStr || null,
        notes: notes || null
      }
    });

    // Calculate splits
    if (splitType === 'equal' || !splitType) {
      const share = amount / beneficiaries.length;
      for (const b of beneficiaries) {
        await prisma.expenseShare.create({
          data: { expenseId: expense.id, userId: b.id, amountOwed: share }
        });
      }
    } else if (splitType === 'percentage') {
      let sharesObj: Record<string, number> = {};
      let totalPct = 0;
      splitDetailsStr.split(';').forEach(s => {
        const [n, pStr] = s.trim().split(' ');
        if (!n || !pStr) return;
        const p = parseFloat(pStr.replace('%',''));
        const u = userMap.get(n.toLowerCase());
        if (u && beneficiaries.find(x => x.id === u.id)) {
          sharesObj[u.id] = p;
          totalPct += p;
        }
      });
      
      // Normalize percentages if they don't add up to 100
      if (Math.abs(totalPct - 100) > 0.01) {
        await prisma.importAnomaly.create({
          data: { rowData: rawRowStr, description: `Percentages sum to ${totalPct}% instead of 100% for ${desc}`, actionTaken: 'Normalized to 100%' }
        });
      }
      
      for (const b of beneficiaries) {
        const pct = sharesObj[b.id] || 0;
        const normalizedPct = totalPct > 0 ? (pct / totalPct) * 100 : 0;
        const share = (amount * normalizedPct) / 100;
        if (share !== 0) {
          await prisma.expenseShare.create({
            data: { expenseId: expense.id, userId: b.id, amountOwed: share }
          });
        }
      }
    } else if (splitType === 'share' || splitType === 'shares') {
      let sharesObj: Record<string, number> = {};
      let totalShares = 0;
      splitDetailsStr.split(';').forEach(s => {
        const [n, shStr] = s.trim().split(' ');
        if (!n || !shStr) return;
        const sh = parseFloat(shStr);
        const u = userMap.get(n.toLowerCase());
        if (u && beneficiaries.find(x => x.id === u.id)) {
          sharesObj[u.id] = sh;
          totalShares += sh;
        }
      });
      
      for (const b of beneficiaries) {
        const sh = sharesObj[b.id] || 0;
        const share = totalShares > 0 ? (amount * sh) / totalShares : 0;
        if (share !== 0) {
          await prisma.expenseShare.create({
            data: { expenseId: expense.id, userId: b.id, amountOwed: share }
          });
        }
      }
    } else if (splitType === 'unequal') {
      let sharesObj: Record<string, number> = {};
      let totalAssigned = 0;
      splitDetailsStr.split(';').forEach(s => {
        const parts = s.trim().split(' ');
        const n = parts[0];
        const shStr = parts[parts.length - 1]; // To handle "Rohan 700"
        if (!n || !shStr) return;
        const sh = parseFloat(shStr);
        const u = userMap.get(n.toLowerCase());
        if (u && beneficiaries.find(x => x.id === u.id)) {
          sharesObj[u.id] = sh;
          totalAssigned += sh;
        }
      });
      
      for (const b of beneficiaries) {
        const sh = sharesObj[b.id] || 0;
        if (sh !== 0) {
          await prisma.expenseShare.create({
            data: { expenseId: expense.id, userId: b.id, amountOwed: sh }
          });
        }
      }
    }
  }

  console.log('CSV Import Complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
