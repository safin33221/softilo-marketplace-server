try {
  process.loadEnvFile('.env');
} catch {}

import { PrismaClient, Role, OrderStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgrespassword@localhost:5432/softilo_marketplace?schema=public';

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting Softilo Marketplace Database Seeding (Version 1.0)...');

  // 1. Super Admin User
  const admin = await prisma.user.upsert({
    where: { phone: '01900000000' },
    update: {},
    create: {
      phone: '01900000000',
      name: 'System Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log('✅ Super Admin created:', admin.phone);

  // 2. Demo Seller User
  const seller = await prisma.user.upsert({
    where: { phone: '01711223344' },
    update: {},
    create: {
      phone: '01711223344',
      name: 'Rahim Khan',
      role: Role.SELLER_OWNER,
    },
  });
  console.log('✅ Demo Seller User created:', seller.phone);

  // 3. Demo Tenant Shop (Rahim Fashion)
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'rahim-fashion' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Rahim Fashion',
        slug: 'rahim-fashion',
        customDomain: 'rahimfashion.com',
        phone: '01711223344',
        logoUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200',
        bannerUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
        commissionRate: 5.0, // 5% platform fee
        trustScore: 98.5,
        isVerified: true,
        isActive: true,
        wallet: {
          create: {
            pendingBalance: 0.0,
            availableBalance: 2500.0,
            totalEarned: 2500.0,
          },
        },
      },
    });
    console.log('✅ Demo Tenant created:', tenant.name, `(${tenant.slug})`);
  }

  // Link seller to tenant
  await prisma.user.update({
    where: { id: seller.id },
    data: { tenantId: tenant.id },
  });

  // 4. Demo Products for Rahim Fashion
  const products = [
    {
      title: 'Fine Cotton Traditional Panjabi',
      slug: 'fine-cotton-traditional-panjabi',
      description: 'Handcrafted fine cotton panjabi with delicate collar embroidery.',
      price: 1850.0,
      discountPrice: 1550.0,
      stock: 35,
      images: [
        'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=600',
        'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600',
      ],
      isCurated: true,
    },
    {
      title: 'Slim Fit Casual Denim Shirt',
      slug: 'slim-fit-casual-denim-shirt',
      description: '100% breathable indigo denim casual shirt with snap buttons.',
      price: 1250.0,
      discountPrice: 990.0,
      stock: 50,
      images: [
        'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600',
      ],
      isCurated: true,
    },
    {
      title: 'Comfort Linen Trousers',
      slug: 'comfort-linen-trousers',
      description: 'Lightweight summer linen trousers with adjustable waistband.',
      price: 1100.0,
      discountPrice: null,
      stock: 20,
      images: [
        'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600',
      ],
      isCurated: false,
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: prod.slug,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        ...prod,
      },
    });
  }
  console.log('✅ Demo Products seeded for tenant:', tenant.slug);

  // 5. Demo Customer User
  const customer = await prisma.user.upsert({
    where: { phone: '01811223344' },
    update: {},
    create: {
      phone: '01811223344',
      name: 'Karim Ahmed',
      role: Role.CUSTOMER,
      loyaltyPoints: 35,
      totalDelivered: 3,
      totalReturned: 0,
    },
  });
  console.log('✅ Demo Customer created:', customer.phone);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

