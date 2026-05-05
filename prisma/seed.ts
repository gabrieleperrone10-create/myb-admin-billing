import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Products
  const [sub, coaching, consulting, digital] = await Promise.all([
    prisma.product.create({
      data: { name: "MYB Membership", description: "Abbonamento mensile alla community e ai contenuti", type: "SUBSCRIPTION", basePrice: 297 },
    }),
    prisma.product.create({
      data: { name: "Percorso Business 1:1", description: "Coaching individuale 3 mesi", type: "COACHING", basePrice: 1500 },
    }),
    prisma.product.create({
      data: { name: "Consulenza Strategica", description: "Sessione consulenza 2h", type: "CONSULTING", basePrice: 500 },
    }),
    prisma.product.create({
      data: { name: "Marketing Mastery Course", description: "Corso digitale avanzato", type: "DIGITAL", basePrice: 997 },
    }),
  ]);

  // Clients
  const [marco, sara, luca, anna, roberto] = await Promise.all([
    prisma.client.create({ data: { name: "Marco Bianchi", email: "marco.bianchi@email.com", company: "MB Solutions SRL", country: "Italia", phone: "+39 333 1234567" } }),
    prisma.client.create({ data: { name: "Sara Conti", email: "sara.conti@gmail.com", country: "Italia", phone: "+39 347 9876543" } }),
    prisma.client.create({ data: { name: "Luca Ferrari", email: "luca@lucastudio.it", company: "Luca Studio", country: "Italia" } }),
    prisma.client.create({ data: { name: "Anna Russo", email: "anna.russo@business.com", company: "Russo Consulting", country: "Francia" } }),
    prisma.client.create({ data: { name: "Roberto Esposito", email: "r.esposito@gmail.com", country: "Italia", phone: "+39 320 5554433" } }),
  ]);

  // Contracts
  const contractMarco = await prisma.contract.create({
    data: { clientId: marco.id, productId: coaching.id, type: "RECURRING", amount: 1500, startDate: new Date("2025-02-01"), billingDay: 1, active: true },
  });
  const contractSara = await prisma.contract.create({
    data: { clientId: sara.id, productId: sub.id, type: "RECURRING", amount: 297, startDate: new Date("2025-01-15"), billingDay: 15, active: true },
  });
  const contractLuca = await prisma.contract.create({
    data: { clientId: luca.id, productId: consulting.id, type: "ONE_SHOT", amount: 500, startDate: new Date("2025-03-10"), active: false },
  });
  const contractAnna = await prisma.contract.create({
    data: { clientId: anna.id, productId: coaching.id, type: "RECURRING", amount: 1800, startDate: new Date("2025-03-01"), billingDay: 1, active: true },
  });
  const contractRoberto = await prisma.contract.create({
    data: { clientId: roberto.id, productId: digital.id, type: "ONE_SHOT", amount: 997, startDate: new Date("2025-04-01"), active: false },
  });

  // Deposits
  await prisma.deposit.create({ data: { contractId: contractMarco.id, amount: 500, status: "PAID", paidAt: new Date("2025-01-28") } });
  await prisma.deposit.create({ data: { contractId: contractAnna.id, amount: 500, status: "PAID", paidAt: new Date("2025-02-25") } });
  await prisma.deposit.create({ data: { contractId: contractRoberto.id, amount: 300, status: "PENDING" } });

  // Invoices & Payments (Marco - coaching recurring Feb-May 2025)
  const inv1 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0001", clientId: marco.id, contractId: contractMarco.id,
      amount: 1500, status: "PAID", issueDate: new Date("2025-02-01"), dueDate: new Date("2025-02-15"), paidAt: new Date("2025-02-10"),
      lineItems: [{ description: "Percorso Business 1:1 - Febbraio 2025", quantity: 1, unitPrice: 1500, total: 1500 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv1.id, amount: 1500, method: "BANK_TRANSFER", reference: "BON-2025-001", paidAt: new Date("2025-02-10") } });

  const inv2 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0002", clientId: marco.id, contractId: contractMarco.id,
      amount: 1500, status: "PAID", issueDate: new Date("2025-03-01"), dueDate: new Date("2025-03-15"), paidAt: new Date("2025-03-08"),
      lineItems: [{ description: "Percorso Business 1:1 - Marzo 2025", quantity: 1, unitPrice: 1500, total: 1500 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv2.id, amount: 1500, method: "STRIPE", stripePaymentId: "pi_test_001", paidAt: new Date("2025-03-08") } });

  const inv3 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0003", clientId: marco.id, contractId: contractMarco.id,
      amount: 1500, status: "PAID", issueDate: new Date("2025-04-01"), dueDate: new Date("2025-04-15"), paidAt: new Date("2025-04-12"),
      lineItems: [{ description: "Percorso Business 1:1 - Aprile 2025", quantity: 1, unitPrice: 1500, total: 1500 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv3.id, amount: 1500, method: "STRIPE", stripePaymentId: "pi_test_002", paidAt: new Date("2025-04-12") } });

  const inv4 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0004", clientId: marco.id, contractId: contractMarco.id,
      amount: 1500, status: "OVERDUE", issueDate: new Date("2025-05-01"), dueDate: new Date("2025-05-15"),
      lineItems: [{ description: "Percorso Business 1:1 - Maggio 2025", quantity: 1, unitPrice: 1500, total: 1500 }],
    },
  });

  // Sara - membership
  const inv5 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0005", clientId: sara.id, contractId: contractSara.id,
      amount: 297, status: "PAID", issueDate: new Date("2025-02-15"), dueDate: new Date("2025-03-01"), paidAt: new Date("2025-02-16"),
      lineItems: [{ description: "MYB Membership - Febbraio 2025", quantity: 1, unitPrice: 297, total: 297 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv5.id, amount: 297, method: "STRIPE", stripePaymentId: "pi_test_003", paidAt: new Date("2025-02-16") } });

  const inv6 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0006", clientId: sara.id, contractId: contractSara.id,
      amount: 297, status: "PAID", issueDate: new Date("2025-03-15"), dueDate: new Date("2025-04-01"), paidAt: new Date("2025-03-15"),
      lineItems: [{ description: "MYB Membership - Marzo 2025", quantity: 1, unitPrice: 297, total: 297 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv6.id, amount: 297, method: "STRIPE", stripePaymentId: "pi_test_004", paidAt: new Date("2025-03-15") } });

  const inv7 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0007", clientId: sara.id, contractId: contractSara.id,
      amount: 297, status: "SENT", issueDate: new Date("2025-04-15"), dueDate: new Date("2025-05-01"),
      lineItems: [{ description: "MYB Membership - Aprile 2025", quantity: 1, unitPrice: 297, total: 297 }],
    },
  });

  // Luca - consulenza one shot
  const inv8 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0008", clientId: luca.id, contractId: contractLuca.id,
      amount: 500, status: "PAID", issueDate: new Date("2025-03-10"), dueDate: new Date("2025-03-25"), paidAt: new Date("2025-03-20"),
      lineItems: [{ description: "Consulenza Strategica - 2h", quantity: 1, unitPrice: 500, total: 500 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv8.id, amount: 500, method: "PAYPAL", paypalOrderId: "PP-TEST-001", paidAt: new Date("2025-03-20") } });

  // Anna - coaching
  const inv9 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0009", clientId: anna.id, contractId: contractAnna.id,
      amount: 1800, status: "PAID", issueDate: new Date("2025-03-01"), dueDate: new Date("2025-03-15"), paidAt: new Date("2025-03-05"),
      lineItems: [{ description: "Percorso Business 1:1 - Marzo 2025", quantity: 1, unitPrice: 1800, total: 1800 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv9.id, amount: 1800, method: "BANK_TRANSFER", reference: "BON-2025-002", paidAt: new Date("2025-03-05") } });

  const inv10 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0010", clientId: anna.id, contractId: contractAnna.id,
      amount: 1800, status: "OVERDUE", issueDate: new Date("2025-04-01"), dueDate: new Date("2025-04-15"),
      lineItems: [{ description: "Percorso Business 1:1 - Aprile 2025", quantity: 1, unitPrice: 1800, total: 1800 }],
    },
  });

  // Roberto - corso digitale
  const inv11 = await prisma.invoice.create({
    data: {
      number: "MYB-2025-0011", clientId: roberto.id, contractId: contractRoberto.id,
      amount: 997, status: "PAID", issueDate: new Date("2025-04-01"), dueDate: new Date("2025-04-10"), paidAt: new Date("2025-04-02"),
      lineItems: [{ description: "Marketing Mastery Course - Accesso completo", quantity: 1, unitPrice: 997, total: 997 }],
    },
  });
  await prisma.payment.create({ data: { invoiceId: inv11.id, amount: 997, method: "STRIPE", stripePaymentId: "pi_test_005", paidAt: new Date("2025-04-02") } });

  console.log("✅ Seed completato con successo!");
  console.log(`   Clienti: 5 | Prodotti: 4 | Contratti: 5 | Fatture: 11 | Pagamenti: 8`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
