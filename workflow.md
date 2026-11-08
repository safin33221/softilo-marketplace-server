## ⚠️ AI AGENT MANDATORY CODING RULES (READ FIRST)

You MUST strictly follow these engineering standards across every file, component, and module:

1. **Minimalist & Concise Code (KISS & YAGNI):** Write the shortest, cleanest code possible to solve the problem. Avoid over-engineering, redundant wrappers, or unnecessary boilerplate.
2. **Maximum Reusability (DRY Principle):** Build modular, reusable components, hooks, utilities, and services. Never duplicate logic—extract shared code into `utils/`, `hooks/`, or `common/`.
3. **Industry-Grade Maintainability:** Enforce strict TypeScript types (no `any`), clear separation of concerns, single-responsibility functions, and clean folder architecture.
4. **Line-by-Line & Workflow Commenting:** Explain the "WHY" and "HOW" clearly. Add concise JSDoc/header comments for every workflow, function, and API route, plus inline comments on critical business logic, multi-tenant filtering, and complex lines.


-------------------------------------------------------------------------------------------------------------


⚙️ Backend Architecture, API Design & Versioned Roadmap (backend-workflow.md)Target Readers: AI Coding Agents (Cursor, Windsurf, Copilot, Claude) & Backend Engineers.Architecture Option: Full-Stack Next.js 15+ (App Router Route Handlers + Server Actions) OR Modular NestJS API (Shared Prisma Schema).Database & Infra: PostgreSQL (Row-Level Multi-Tenancy), Prisma ORM, Redis (OTP, Rate-Limiting & Job Queues), Cloudflare R2 / AWS S3 (Product Media).Core Principle: Build & Launch iteratively. Never implement v2.0 or v3.0 logic until v1.0 (Startup MVP) is live and stable in production.১. কোর ব্যাকএন্ড আর্কিটেকচার ও গোল্ডেন রুলস (Core Backend Rules)যে কোনো এআই এজেন্ট ব্যাকএন্ডে কোড লেখার সময় নিচের ৪টি নিয়ম কঠোরভাবে মেনে চলবে:Strict Tenant Isolation (tenantId Guard):প্রতিটি সেলারের ডেটা (Product, Order, Wallet, Transaction) একই PostgreSQL ডাটাবেসে থাকবে কিন্তু tenantId কলাম দিয়ে সম্পূর্ণ আলাদা থাকবে।কোনো সেলার API কল করলে সেশন টোকেন থেকে tenantId বের করে কুয়েরি করতে হবে। কখনোই রিকোয়েস্ট বডি (req.body.tenantId) থেকে পাওয়া টেন্যান্ট আইডি বিশ্বাস করা যাবে না।100% Phone Number Identity (No Email Dependency):ডাটাবেসে User এবং Customer-এর প্রাইমারি ইউনিক আইডেন্টিফায়ার হলো Normalized BD Phone Number (01XXXXXXXXX)।যেকোনো ফোন নাম্বার ডাটাবেসে ঢোকার আগে ব্যাকএন্ড ইউটিলিটি ফাংশন দিয়ে +88, স্পেস বা বাংলা ডিজিট (০-৯) পরিষ্কার করে ১১ ডিজিটের ইংরেজি স্ট্রিংয়ে রূপান্তর করতে হবে।Zero-Subscription, Commission-Ledger Architecture:সেলার রেজিস্ট্রেশন বা প্রোডাক্ট আপলোডে কোনো পেমেন্ট ওয়াল থাকবে না।প্রতিটি অর্ডারের জন্য ডাটাবেসে স্পষ্ট ৩টি কলাম থাকবে:totalAmount (কাস্টমার যা দেবে)platformFee (প্ল্যাটফর্মের কমিশন শতাংশ অনুযায়ী অটো-ক্যালকুলেটেড টাকা)netSellerAmount (totalAmount - platformFee = সেলার যা পাবে)Idempotent Order & Wallet Operations:কাস্টমার ডাবল ক্লিক করলে যেন ২বার অর্ডার না পড়ে বা সেলারের ওয়ালেটে যেন ডাবল টাকা যোগ না হয়, সেজন্য প্রতিটি ফিন্যান্সিয়াল অপারেশন prisma.$transaction([])-এর ভেতরে হতে হবে।২. ব্যাকএন্ড ফোল্ডার স্ট্রাকচার (Next.js Backend / API Layer)একই রিপোজিটরিতে ফ্রন্টএন্ড ও ব্যাকএন্ড (Full-stack Next.js) অথবা আলাদা API সার্ভিস হিসেবে কাজ করার জন্য মডুলার স্ট্রাকচার:src/
├── lib/
│   ├── db/
│   │   ├── prisma.ts              # Singleton Prisma Client + Tenant Isolation Extension
│   │   └── redis.ts               # Upstash / Local Redis for OTP & Caching
│   ├── auth/
│   │   ├── otp.service.ts         # BD Bulk SMS Gateway + 4-digit OTP hash & verify
│   │   └── session.ts             # JWT / HTTP-Only Cookie Session (Role & tenantId)
│   ├── logistics/
│   │   ├── courier-aggregator.ts  # Steadfast, Pathao, RedX API wrappers (v2.0)
│   │   └── fraud-checker.ts       # Phone number delivery success ratio calculator (v2.0)
│   └── ai/
│       ├── catalog-enhancer.ts    # Auto product description & SEO tags (v2.0)
│       └── seller-agent.ts        # Autonomous Agentic AI tools & cron triggers (v3.0)
│
├── app/api/v1/
│   ├── auth/
│   │   ├── send-otp/route.ts      # POST: Validate BD phone & send OTP (Rate limited)
│   │   └── verify-otp/route.ts    # POST: Verify OTP & issue JWT cookie
│   ├── tenant/
│   │   ├── onboard/route.ts       # POST: Create shop slug, logo, KYC request
│   │   └── resolve/route.ts       # GET: Resolve subdomain/customDomain to tenant metadata
│   ├── products/
│   │   ├── route.ts               # GET (Public/Tenant), POST (Seller add product)
│   │   └── [id]/route.ts          # PATCH (Update stock/price), DELETE
│   ├── orders/
│   │   ├── quick-checkout/route.ts# POST: 1-Click guest/OTP order + auto user creation
│   │   └── [id]/status/route.ts   # PATCH: Update status & trigger wallet settlement
│   └── webhooks/
│       ├── courier/route.ts       # POST: Auto status update from Steadfast/Pathao (v2.0)
│       └── payment/route.ts       # POST: bKash / SSLCommerz callback (v2.0)
└── prisma/
    └── schema.prisma              # Single source of truth for v1, v2, and v3 models
৩. ভার্সন-ভিত্তিক ডেভেলপমেন্ট রোডম্যাপ (Version-Wise Execution Plan)আমরা একসাথে সব বানাবো না। প্রতিটি ভার্সন স্বয়ংসম্পূর্ণ। AI এজেন্টকে যে ভার্সনের কথা বলা হবে, সে শুধু সেই ভার্সনের স্কোপে কাজ করবে।🚀 Version 1.0: Startup MVP (Core Marketplace & Zero-Fee Storefront)লক্ষ্য: সবচেয়ে দ্রুত সময়ে প্রথম ৫০–১০০ জন ভেরিফায়েড সেলারকে অনবোর্ড করা, প্রোডাক্ট আপলোড করা এবং কাস্টমারের কাছ থেকে ক্যাশ-অন-ডেলিভারি (COD) অর্ডার নেওয়া।v1.0 ফিচার ও এপিআই স্কোপ:Phone + OTP Authentication (POST /api/v1/auth/*):সেলার ও কাস্টমার উভয়ের জন্য মোবাইল নাম্বার ও ৪-ডিজিট ওটিপি লগইন।ডেভেলপমেন্ট মোডে স্ট্যাটিক ওটিপি (1234) এবং প্রোডাকশনে বাংলাদেশি SMS Gateway (যেমন: Greenweb, BulkSMSBD, বা MimSMS) ইন্টিগ্রেশন।Seller Onboarding & Subdomain Creation (POST /api/v1/tenant/onboard):সেলার দোকানের নাম ও স্লাগ (slug: "rahim-fashion") দিলে ব্যাকএন্ড চেক করবে স্লাগটি খালি আছে কিনা।খালি থাকলে Tenant এবং জিরো ব্যালেন্সসহ TenantWallet তৈরি করবে।সুপার অ্যাডমিন অ্যাপ্রুভ (isVerified = true) করলেই সাবডোমেইন লাইভ হয়ে যাবে।Minimal Product CRUD (POST /api/v1/products):সেলার মোবাইল বা পিসি থেকে প্রোডাক্টের নাম, দাম (price), ডিসকাউন্ট প্রাইস, স্টক (stock), এবং ১–৪টি ছবি আপলোড করতে পারবে।অটোমেটিক ইউনিক প্রোডাক্ট স্লাগ জেনারেট হবে।1-Click Guest Checkout & Commission Calculation (POST /api/v1/orders/quick-checkout):কাস্টমার নাম, ফোন নাম্বার, জেলা/থানা ও ঠিকানা দিয়ে অর্ডার প্লেস করবে।ব্যাকএন্ড সাথে সাথে ওই ফোন নাম্বারে কোনো কাস্টমার না থাকলে অটোমেটিক CUSTOMER অ্যাকাউন্ট খুলে ফেলবে।প্ল্যাটফর্মের ডিফল্ট কমিশন (যেমন ৫%) হিসাব করে Order টেবিলে সেভ করবে এবং সেলারের pendingBalance-এ টাকাটা দেখাবে।Basic Order & Manual Courier Tracking:সেলার অর্ডার কনফার্ম করে কুরিয়ারে বুকিং দিয়ে ট্র্যাকিং কোড বসাতে পারবে।অর্ডার DELIVERED মার্ক হলে ব্যাকএন্ড ট্রানজ্যাকশনের মাধ্যমে টাকা pendingBalance থেকে সেলারের availableBalance-এ ট্রান্সফার করবে।🛡️ Version 2.0: Automated Trust, Courier API & AI Assistলক্ষ্য: ফেক অর্ডার বন্ধ করা, কুরিয়ার ও পেমেন্ট অটোমেট করা এবং এআই দিয়ে সেলারের প্রোডাক্ট আপলোড সহজ করা।v2.0 ফিচার ও এপিআই স্কোপ:Automated Courier Fraud & Delivery Ratio Engine (src/lib/logistics/fraud-checker.ts):কাস্টমার অর্ডার করলেই ব্যাকএন্ড কুরিয়ার এপিআই (Steadfast / Pathao / RedX) ও আমাদের নিজস্ব ডাটাবেস চেক করে কাস্টমারের ফোন নাম্বারের অতীত রেকর্ড বের করবে।Formula: $\text{Success Ratio} = \left( \frac{\text{Total Delivered}}{\text{Total Delivered} + \text{Total Returned}} \right) \times 100$অর্ডার অবজেক্টে totalPastOrders, deliveredCount, returnedCount, এবং fraudRiskScore সেভ হবে।1-Click Courier Booking & Webhook Sync:সেলার ড্যাশবোর্ডে "Send to Steadfast/Pathao" বাটনে ক্লিক করলে সরাসরি কুরিয়ার API-তে পার্সেল বুক হবে।কুরিয়ার থেকে ওয়েবহুক (POST /api/v1/webhooks/courier) আসলে অর্ডার স্ট্যাটাস নিজে নিজে DELIVERED বা RETURNED হয়ে যাবে এবং কমিশন কেটে সেলার ওয়ালেট আপডেট হবে।Customer Loyalty Points & Escrow Protection:প্রতিটি সফল ডেলিভারিতে কাস্টমারের ফোন নাম্বারের বিপরীতে ১%–২% লয়্যালটি পয়েন্ট যোগ হবে, যা পরবর্তী অর্ডারে ডিসকাউন্ট হিসেবে ব্যবহার করা যাবে।AI Catalog & Copywriting Assistant (Standard Generative AI):সেলার শুধু প্রোডাক্টের একটি সাধারণ ছবি এবং ২ লাইন তথ্য দিলেই ব্যাকএন্ড LLM API (Gemini 2.5 Flash / OpenAI) ব্যবহার করে আকর্ষণীয় বাংলা ও ইংরেজি প্রোডাক্ট ডেসক্রিপশন, বুলেট পয়েন্ট এবং এসইও ট্যাগ জেনারেট করে দেবে।প্রোডাক্ট ইমেজের অগোছালো ব্যাকগ্রাউন্ড পরিষ্কার করে ক্লিন স্টুডিও ব্যাকগ্রাউন্ড করে দেবে।🤖 Version 3.0: Agentic AI Ecosystem (Autonomous Seller & Marketplace Co-Pilot)লক্ষ্য: ২০২৬–২০২৭ সালের বাজারে প্ল্যাটফর্মকে অপ্রতিরোধ্য করতে Agentic AI চালু করা—যেখানে এআই শুধু টেক্সট লিখবে না, বরং নিজে সিদ্ধান্ত নেবে, টুল কল করবে এবং সেলারের হয়ে কাজ করে দেবে।v3.0 এজেন্টিক এআই ওয়ার্কফ্লো (Autonomous Agents):                    ┌──────────────────────────────────────┐
                    │   Agentic AI Orchestrator (Backend)  │
                    └──────────────────┬───────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
[ 1. Fraud Shield Agent ]   [ 2. Seller Growth Agent ]   [ 3. Customer Dispute Agent ]
- Detects risky COD order   - Analyzes marketplace       - Verifies unboxing video/image
- Auto-triggers IVR/SMS     - Suggests restock & price   - Auto-approves instant refund
  confirmation before         drops via WhatsApp/SMS       from platform escrow for
  bothering the seller      - Auto-selects top products    clear defects
                              for central Meta Ads
Agent 1: Autonomous Fake-Order Shield Agent:কাজ: কোনো নতুন অর্ডারের fraudRiskScore যদি হাই হয় (যেমন কাস্টমারের আগের ৫০% পার্সেল রিটার্ন এসেছে), এজেন্ট সেলারকে বিরক্ত করার আগেই নিজে কাস্টমারের ফোনে একটি ওটিপি ভেরিফিকেশন লিংক বা অটোমেটেড কনফার্মেশন মেসেজ পাঠাবে। কাস্টমার কনফার্ম করলে তবেই অর্ডারটি সেলারের "Ready to Ship" কিউতে যাবে।Agent 2: Seller Growth & Inventory Co-Pilot (Tool-Calling Agent):কাজ: প্রতিদিন রাতে ক্রন জব (Cron Job) এর মাধ্যমে এজেন্ট প্রতিটি সেলারের সেলস ডেটা, স্টক এবং সেন্ট্রাল মার্কেটপ্লেসের সার্চ ট্রেন্ড বিশ্লেষণ করবে।সেলারকে সকালে ড্যাশবোর্ডে ও ফোনে অ্যাকশনেবল ইনসাইট দেবে: "আপনার 'কটন পাঞ্জাবি' আগামী ৪৮ ঘণ্টায় স্টক আউট হবে। গত সপ্তাহে এর কনভার্সন রেট ছিল ১৮%। ১-ক্লিকে ৫০ পিস রিস্টক আপডেট করুন।"Agent 3: Smart Curated Ad-Selector Agent:কাজ: আপনাদের মেইন মার্কেটপ্লেসে যেহেতু সব প্রোডাক্ট একসাথে মার্কেটিং করা হবে, এই এজেন্ট স্বয়ংক্রিয়ভাবে ১০০–১০০০ সেলারের মধ্য থেকে যে প্রোডাক্টগুলোর রিভিউ ভালো, রিটার্ন রেট ১%-এর নিচে এবং স্টক পর্যাপ্ত—শুধু সেগুলোকে বেছে নিয়ে সেন্ট্রাল হোমপেজের "Trending Curated Deals" ও ফেসবুক ক্যাটালগ ফিডে পুশ করবে।৪. ডাটাবেস স্কিমা (Unified Prisma Schema for v1, v2 & v3)বারবার ডাটাবেস মাইগ্রেশন ঝামেলা এড়াতে আমাদের কোর স্কিমাটি এমনভাবে ডিজাইন করা হয়েছে যা v1.0 থেকে শুরু করে v3.0 পর্যন্ত সব ফিচার সাপোর্ট করবে:// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  SUPER_ADMIN
  SELLER_OWNER
  CUSTOMER
}

enum OrderStatus {
  PENDING           // সবেমাত্র অর্ডার পড়েছে
  OTP_VERIFIED      // কাস্টমার ভেরিফায়েড
  CONFIRMED         // সেলার কনফার্ম করেছে
  IN_COURIER        // কুরিয়ারে দেওয়া হয়েছে
  DELIVERED         // সফল ডেলিভারি (কমিশন কেটে ওয়ালেটে টাকা যুক্ত হবে)
  RETURNED          // কাস্টমার ফেরত দিয়েছে (ফ্রড স্কোর বাড়বে)
  CANCELLED         // বাতিল
}

model Tenant {
  id              String        @id @default(uuid())
  name            String
  slug            String        @unique // e.g., "arong-style" -> arong-style.domain.com
  customDomain    String?       @unique
  phone           String        @unique // Seller primary BD phone (01XXXXXXXXX)
  logoUrl         String?
  bannerUrl       String?
  commissionRate  Decimal       @default(5.00) @db.Decimal(5, 2) // 5% platform fee
  trustScore      Float         @default(100.0) // Drops if seller ships bad products
  isVerified      Boolean       @default(false) // Curated gatekeeper flag
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  products        Product[]
  orders          Order[]
  wallet          TenantWallet?
  aiInsights      AiInsight[]   // Used in v3.0

  @@index([slug])
}

model User {
  id              String    @id @default(uuid())
  phone           String    @unique // Normalized 11-digit BD phone (017XXXXXXXX)
  name            String?
  role            Role      @default(CUSTOMER)
  tenantId        String?   // Linked if user is SELLER_OWNER
  loyaltyPoints   Int       @default(0) // v2.0 Customer reward points
  totalDelivered  Int       @default(0) // v2.0 Courier track record
  totalReturned   Int       @default(0) // v2.0 Courier track record
  createdAt       DateTime  @default(now())

  orders          Order[]

  @@index([phone])
}

model Product {
  id              String      @id @default(uuid())
  tenantId        String
  title           String
  slug            String
  description     String
  price           Decimal     @db.Decimal(10, 2)
  discountPrice   Decimal?    @db.Decimal(10, 2)
  stock           Int         @default(0)
  images          String[]
  isCurated       Boolean     @default(false) // Approved for central marketplace homepage
  aiTags          String[]    // v2.0 AI generated search tags
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  orderItems      OrderItem[]

  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([isCurated])
}

model Order {
  id              String        @id @default(uuid())
  orderNumber     String        @unique // e.g., "ORD-10024"
  tenantId        String
  customerId      String
  customerName    String
  customerPhone   String
  district        String
  thana           String
  fullAddress     String
  
  // Financial Breakdown (Zero-hidden-fee transparency)
  subtotal        Decimal       @db.Decimal(10, 2)
  deliveryCharge  Decimal       @db.Decimal(10, 2)
  discountAmount  Decimal       @default(0.00) @db.Decimal(10, 2)
  totalAmount     Decimal       @db.Decimal(10, 2)
  platformFee     Decimal       @db.Decimal(10, 2) // Commission deducted
  netSellerAmount Decimal       @db.Decimal(10, 2) // Credited to seller wallet on delivery

  status          OrderStatus   @default(PENDING)
  courierProvider String?       // "STEADFAST" | "PATHAO" | "REDX"
  trackingCode    String?
  
  // v2.0 & v3.0 Anti-Fraud Metadata
  deliverySuccessRate Float?    // e.g., 88.5 (%)
  isHighRiskOrder     Boolean   @default(false)

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tenant          Tenant        @relation(fields: [tenantId], references: [id])
  customer        User          @relation(fields: [customerId], references: [id])
  items           OrderItem[]

  @@index([tenantId, status])
  @@index([customerPhone])
}

model OrderItem {
  id          String   @id @default(uuid())
  orderId     String
  productId   String
  productName String
  quantity    Int
  unitPrice   Decimal  @db.Decimal(10, 2)

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product  @relation(fields: [productId], references: [id])
}

model TenantWallet {
  id               String   @id @default(uuid())
  tenantId         String   @unique
  pendingBalance   Decimal  @default(0.00) @db.Decimal(12, 2) // Orders in transit
  availableBalance Decimal  @default(0.00) @db.Decimal(12, 2) // Ready to withdraw (bKash/Bank)
  totalEarned      Decimal  @default(0.00) @db.Decimal(12, 2)
  updatedAt        DateTime @updatedAt

  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model AiInsight {
  id          String   @id @default(uuid())
  tenantId    String
  type        String   // "LOW_STOCK" | "PRICE_OPTIMIZATION" | "TRENDING_ALERT"
  message     String   // Bangla actionable prompt for seller
  actionUrl   String?
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, isRead])
}
৫. ক্রিটিক্যাল ব্যাকএন্ড বিজনেস লজিক ব্লু-প্রিন্ট (Code Patterns for AI Agents)৫.১. বাংলাদেশি ফোন নাম্বার নরমালাইজার (src/lib/validators/phone.ts)const banglaToEnglishMap: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

export function normalizeBdPhone(rawPhone: string): string {
  // ১. বাংলা সংখ্যা থাকলে ইংরেজিতে রূপান্তর
  let cleaned = rawPhone
    .split('')
    .map((char) => banglaToEnglishMap[char] ?? char)
    .join('');

  // ২. সব স্পেস, হাইফেন বা ব্র্যাকেট মুছে ফেলা
  cleaned = cleaned.replace(/\D/g, '');

  // ৩. 880 দিয়ে শুরু হলে 88 কেটে ফেলা
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    cleaned = cleaned.slice(2);
  }

  // ৪. ভ্যালিড ১১ ডিজিটের বাংলাদেশি নাম্বার কিনা চেক করা
  if (!/^01[3-9]\d{8}$/.test(cleaned)) {
    throw new Error('সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)');
  }

  return cleaned;
}
৫.২. অটোমেটিক কমিশন ও ওয়ালেট সেটেলমেন্ট লজিক (v1.0 Core)যখন কোনো অর্ডারের স্ট্যাটাস DELIVERED হবে, তখন ব্যাকএন্ড অ্যাটমিক ট্রানজ্যাকশন চালাবে:// Order Delivery & Commission Settlement Transaction
export async function markOrderDelivered(orderId: string, tenantId: string) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order || order.status === 'DELIVERED') {
      throw new Error('অর্ডারটি পাওয়া যায়নি অথবা ইতিমধ্যে ডেলিভারি হয়েছে');
    }

    // ১. অর্ডার স্ট্যাটাস আপডেট
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED' },
    });

    // ২. কাস্টমারের ডেলিভারি সাকসেস রেকর্ড + লয়্যালটি পয়েন্ট বৃদ্ধি
    const earnedPoints = Math.floor(Number(order.subtotal) / 100); // প্রতি ১০০ টাকায় ১ পয়েন্ট
    await tx.user.update({
      where: { id: order.customerId },
      data: {
        totalDelivered: { increment: 1 },
        loyaltyPoints: { increment: earnedPoints },
      },
    });

    // ৩. সেলারের ওয়ালেটে কমিশন কেটে নিট টাকা যোগ করা
    await tx.tenantWallet.update({
      where: { tenantId },
      data: {
        pendingBalance: { decrement: order.netSellerAmount },
        availableBalance: { increment: order.netSellerAmount },
        totalEarned: { increment: order.netSellerAmount },
      },
    });

    return updatedOrder;
  });
}
৬. ব্যাকএন্ড ইমপ্লিমেন্টেশন চেকলিস্ট (Step-by-Step Build Order for v1.0)AI এজেন্ট যখন ব্যাকএন্ড তৈরি শুরু করবে, সে শুধুমাত্র Version 1.0 (Startup MVP) এর এই ৬টি ধাপ প্রথমে সম্পন্ন করবে:[ ] Step 1: prisma/schema.prisma সেটআপ এবং PostgreSQL ডাটাবেস মাইগ্রেশন রান করা।[ ] Step 2: normalizeBdPhone ইউটিলিটি এবং POST /api/v1/auth/send-otp ও verify-otp এপিআই তৈরি করা।[ ] Step 3: সেলার অনবোর্ডিং (POST /api/v1/tenant/onboard) এবং সাবডোমেইন রিজলভার এপিআই তৈরি করা।[ ] Step 4: টেন্যান্ট-আইসোলেটেড প্রোডাক্ট আপলোড ও লিস্টিং এপিআই (GET/POST /api/v1/products) তৈরি করা।[ ] Step 5: ১-ক্লিক গেস্ট চেকআউট এপিআই (POST /api/v1/orders/quick-checkout) তৈরি করা—যেখানে স্বয়ংক্রিয়ভাবে প্ল্যাটফর্ম কমিশন (platformFee) ও সেলারের নিট প্রাপ্য (netSellerAmount) হিসাব হয়ে অর্ডার তৈরি হবে।[ ] Step 6: সেলার অর্ডার স্ট্যাটাস আপডেট এপিআই এবং markOrderDelivered ওয়ালেট সেটেলমেন্ট ফাংশন যুক্ত করা।