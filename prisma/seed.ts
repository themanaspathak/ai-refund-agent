import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with 15 CRM customer profiles & strict policy scenarios...");

  // 1. Clean existing records
  await prisma.executionLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  // Helper date generators
  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  // 2. Create 15 CRM Customer Profiles
  const customersData = [
    { email: "alice@example.com", name: "Alice Smith" },
    { email: "bob@example.com", name: "Bob Jones" },
    { email: "charlie@example.com", name: "Charlie Brown" },
    { email: "david@example.com", name: "David Miller" },
    { email: "fraud@example.com", name: "Frank Fraudster" },
    { email: "emma@example.com", name: "Emma Watson" },
    { email: "fiona@example.com", name: "Fiona Gallagher" },
    { email: "george@example.com", name: "George Clark" },
    { email: "hannah@example.com", name: "Hannah Abbott" },
    { email: "ian@example.com", name: "Ian Malcolm" },
    { email: "julia@example.com", name: "Julia Roberts" },
    { email: "kevin@example.com", name: "Kevin Spacey" },
    { email: "laura@example.com", name: "Laura Croft" },
    { email: "michael@example.com", name: "Michael Scott" },
    { email: "nina@example.com", name: "Nina Myers" },
  ];

  const customers: Record<string, any> = {};
  for (const c of customersData) {
    customers[c.email] = await prisma.customer.create({ data: c });
  }

  // 3. Create Products Across Categories
  const tshirt = await prisma.product.create({
    data: {
      sku: "SKU-TSHIRT",
      name: "Premium Cotton T-Shirt",
      category: "CLOTHING",
      price: 35.0,
      isReturnable: true,
      restockFeePct: 0.0,
    },
  });

  const shoes = await prisma.product.create({
    data: {
      sku: "SKU-SHOES",
      name: "Pro Running Sneakers",
      category: "CLOTHING",
      price: 80.0,
      isReturnable: true,
      restockFeePct: 0.0,
    },
  });

  const headphones = await prisma.product.create({
    data: {
      sku: "SKU-HEADPHONES",
      name: "Wireless Noise Cancelling Headphones",
      category: "ELECTRONICS",
      price: 150.0,
      isReturnable: true,
      restockFeePct: 0.15,
    },
  });

  const giftcard = await prisma.product.create({
    data: {
      sku: "SKU-GIFTCARD",
      name: "E-Gift Card $50",
      category: "DIGITAL",
      price: 50.0,
      isReturnable: false,
      restockFeePct: 0.0,
    },
  });

  const clearanceJacket = await prisma.product.create({
    data: {
      sku: "SKU-CLEARANCE",
      name: "Winter Parka (Clearance)",
      category: "FINAL_SALE",
      price: 120.0,
      isReturnable: false,
      restockFeePct: 0.0,
    },
  });

  const gourmetBasket = await prisma.product.create({
    data: {
      sku: "SKU-PERISHABLE",
      name: "Artisanal Cheese & Fruit Basket",
      category: "PERISHABLE",
      price: 65.0,
      isReturnable: false,
      restockFeePct: 0.0,
    },
  });

  const smartWatch = await prisma.product.create({
    data: {
      sku: "SKU-WATCH",
      name: "Fitness Tracker Smartwatch",
      category: "ELECTRONICS",
      price: 220.0,
      isReturnable: true,
      restockFeePct: 0.15,
    },
  });

  // 4. Create Core Orders for Scenarios & Customers

  // Customer 1: Alice (TS-1: Standard Eligible Refund - Delivered 5 days ago)
  const ord1001 = await prisma.order.create({
    data: {
      orderNumber: "ORD-1001",
      customerId: customers["alice@example.com"].id,
      purchaseDate: daysAgo(7),
      deliveryDate: daysAgo(5),
      status: "DELIVERED",
      totalAmount: 35.0,
      returnWindowDays: 30,
      items: { create: [{ productId: tshirt.id, quantity: 1, unitPrice: 35.0 }] },
    },
  });

  // Customer 2: Bob (TS-2: Window Expired - Delivered 42 days ago)
  const ord1002 = await prisma.order.create({
    data: {
      orderNumber: "ORD-1002",
      customerId: customers["bob@example.com"].id,
      purchaseDate: daysAgo(45),
      deliveryDate: daysAgo(42),
      status: "DELIVERED",
      totalAmount: 80.0,
      returnWindowDays: 30,
      items: { create: [{ productId: shoes.id, quantity: 1, unitPrice: 80.0 }] },
    },
  });

  // Customer 3: Charlie (TS-3: Digital & Final Sale Non-Refundable)
  const ord1003 = await prisma.order.create({
    data: {
      orderNumber: "ORD-1003",
      customerId: customers["charlie@example.com"].id,
      purchaseDate: daysAgo(3),
      deliveryDate: daysAgo(3),
      status: "DELIVERED",
      totalAmount: 170.0,
      returnWindowDays: 30,
      items: {
        create: [
          { productId: giftcard.id, quantity: 1, unitPrice: 50.0 },
          { productId: clearanceJacket.id, quantity: 1, unitPrice: 120.0 },
        ],
      },
    },
  });

  // Customer 4: David (TS-4: Opened Electronics & High Value Return >$100)
  const ord1004 = await prisma.order.create({
    data: {
      orderNumber: "ORD-1004",
      customerId: customers["david@example.com"].id,
      purchaseDate: daysAgo(10),
      deliveryDate: daysAgo(8),
      status: "DELIVERED",
      totalAmount: 150.0,
      returnWindowDays: 30,
      items: { create: [{ productId: headphones.id, quantity: 1, unitPrice: 150.0 }] },
    },
  });

  // Customer 5: Frank Fraudster (TS-5: Fraud Guard Trigger - 3 prior approved refunds)
  const ord1005 = await prisma.order.create({
    data: {
      orderNumber: "ORD-1005",
      customerId: customers["fraud@example.com"].id,
      purchaseDate: daysAgo(2),
      deliveryDate: daysAgo(1),
      status: "DELIVERED",
      totalAmount: 80.0,
      returnWindowDays: 30,
      items: { create: [{ productId: shoes.id, quantity: 1, unitPrice: 80.0 }] },
    },
  });

  // Seed 3 past approved refunds for Frank Fraudster
  for (let i = 1; i <= 3; i++) {
    const pastOrder = await prisma.order.create({
      data: {
        orderNumber: `ORD-PAST-${i}`,
        customerId: customers["fraud@example.com"].id,
        purchaseDate: daysAgo(15 + i),
        deliveryDate: daysAgo(12 + i),
        status: "REFUNDED",
        totalAmount: 100.0,
        returnWindowDays: 30,
        items: { create: [{ productId: shoes.id, quantity: 1, unitPrice: 100.0, refunded: true }] },
      },
    });

    await prisma.refund.create({
      data: {
        orderId: pastOrder.id,
        amount: 100.0,
        status: "APPROVED",
        reason: "CHANGE_OF_MIND",
        policyCode: "APPROVED_INSTANT",
        idempotencyKey: `SEED-REFUND-PAST-${i}`,
        createdAt: daysAgo(10 - i),
      },
    });
  }

  // Create additional orders for Customers 6 to 15 to populate complete CRM database
  const extraCustomerKeys = [
    "emma@example.com",
    "fiona@example.com",
    "george@example.com",
    "hannah@example.com",
    "ian@example.com",
    "julia@example.com",
    "kevin@example.com",
    "laura@example.com",
    "michael@example.com",
    "nina@example.com",
  ];

  let orderIndex = 1006;
  for (const email of extraCustomerKeys) {
    const cust = customers[email];
    await prisma.order.create({
      data: {
        orderNumber: `ORD-${orderIndex}`,
        customerId: cust.id,
        purchaseDate: daysAgo(Math.floor(Math.random() * 20) + 1),
        deliveryDate: daysAgo(Math.floor(Math.random() * 5) + 1),
        status: "DELIVERED",
        totalAmount: 220.0,
        returnWindowDays: 30,
        items: { create: [{ productId: smartWatch.id, quantity: 1, unitPrice: 220.0 }] },
      },
    });
    orderIndex++;
  }

  // 5. Seed initial Conversations
  await prisma.conversation.create({
    data: {
      customerId: customers["alice@example.com"].id,
      orderId: ord1001.id,
      status: "ACTIVE",
      messages: {
        create: [
          {
            sender: "AGENT",
            content: "Hello Alice! I'm RefundBot. How can I assist you with order ORD-1001 today?",
          },
        ],
      },
    },
  });

  console.log("Database successfully seeded with 15 CRM customer profiles and orders ORD-1001 through ORD-1015!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
