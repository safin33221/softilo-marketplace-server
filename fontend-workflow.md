# 🎨 Softilo Marketplace — Frontend Implementation Guide & Architecture (fontend-workflow.md)

**Target Stack:** Next.js 15+ (App Router), TypeScript, Tailwind CSS, Lucide Icons, Shadcn UI / Radix UI, TanStack Query (React Query) / Axios, React Hook Form + Zod.  
**Backend Reference:** NestJS REST API (`http://localhost:3000` / `/api/v1`) — see `api-doc.md`.

---

## 🏗️ ১. ২-ডোমেইন আর্কিটেকচার ও রাউটিং কনসেপ্ট (seller.myapp.com & myapp.com)

আপনার রিকোয়ারমেন্ট অনুযায়ী সিস্টেমে দুটি প্রধান ডোমেইন থাকবে:
1. **`myapp.com` (Customer & Marketplace Storefront):**
   - কাস্টমারদের জন্য সেন্ট্রাল মার্কেটপ্লেস ব্রাউজিং ও প্রোডাক্ট সার্চ।
   - যেকোনো সেলারের শপ পেজ (যেমন: `myapp.com/store/[slug]` অথবা `[slug].myapp.com`)।
   - ১-ক্লিক গেস্ট চেকআউট ও ক্যাশ-অন-ডেলিভারি (COD) অর্ডার।
2. **`seller.myapp.com` (Seller Portal & Dashboard):**
   - সেলারদের ৪-ডিজিট মোবাইল ওটিপি লগইন।
   - নতুন সেলার অনবোর্ডিং (দোকানের নাম, স্লাগ ও লোগো সেট করা)।
   - প্রোডাক্ট ম্যানেজমেন্ট (অ্যাড/এডিট/স্টক আপডেট)।
   - অর্ডার ম্যানেজমেন্ট ও কুরিয়ার ট্র্যাকিং কোড বসানো।
   - ওয়ালেট লেজার স্ক্রিন (পেন্ডিং ও উইথড্রয়েবল ব্যালেন্স)।

### Next.js Middleware Domain Router (`middleware.ts`)
যদি আপনি একটি সিঙ্গেল Next.js রিপোজিটরি ব্যবহার করেন, তাহলে `middleware.ts` দিয়ে রিকোয়েস্টের হোস্ট অনুযায়ী রুট আলাদা করা যাবে:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // ১. সেলার পোর্টাল: seller.myapp.com (অথবা লোকালহোস্টে seller.localhost:3000)
  if (hostname.startsWith('seller.')) {
    // URL rewrite to /seller/... ফোল্ডার
    return NextResponse.rewrite(new URL(`/seller${url.pathname}`, req.url));
  }

  // ২. কাস্টমার মার্কেটপ্লেস: myapp.com
  // কাস্টমার সরাসরি মেইন মার্কেটপ্লেস ও স্টোরফ্রন্ট দেখবে
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 📁 ২. প্রস্তাবিত ফ্রন্টএন্ড ফোল্ডার স্ট্রাকচার

```
frontend/
├── src/
│   ├── app/
│   │   ├── (marketplace)/         # softilo.com মেইন মার্কেটপ্লেস
│   │   │   ├── page.tsx           # সেন্ট্রাল হোমপেজ ও কিউরেটেড ডিলস
│   │   │   ├── explore/page.tsx   # গ্লোবাল প্রোডাক্ট সার্চ
│   │   │   └── onboard/page.tsx   # সেলার অনবোর্ডিং (দোকান খোলার পেজ)
│   │   │
│   │   ├── store/[slug]/          # টেন্যান্টের নিজস্ব স্টোরফ্রন্ট ([slug].softilo.com)
│   │   │   ├── page.tsx           # সেলারের হোমপেজ ও ব্যানার
│   │   │   ├── products/[id]/     # প্রোডাক্ট ডিটেইলস ও ১-ক্লিক অর্ডার
│   │   │   └── checkout/page.tsx  # ১-ক্লিক গেস্ট চেকআউট ফর্ম
│   │   │
│   │   ├── seller/                # সেলার অ্যাডমিন ড্যাশবোর্ড
│   │   │   ├── layout.tsx         # সেলার সাইডবার ও নটিফিকেশন
│   │   │   ├── dashboard/page.tsx # সেলস চার্ট ও সামারি
│   │   │   ├── products/page.tsx  # প্রোডাক্ট টেবিল ও অ্যাড প্রোডাক্ট মোডাল
│   │   │   ├── orders/page.tsx    # অর্ডার ম্যানেজমেন্ট ও কুরিয়ার আপডেট
│   │   │   └── wallet/page.tsx    # রিয়েল-টাইম ব্যালেন্স ও উইথড্র
│   │   │
│   │   └── auth/
│   │       └── login/page.tsx     # ৪-ডিজিট মোবাইল ওটিপি লগইন মোডাল/পেজ
│   │
│   ├── components/
│   │   ├── ui/                    # বাটন, ইনপুট, ডায়লগ, ড্রপডাউন (Shadcn)
│   │   ├── common/
│   │   │   ├── phone-input.tsx    # বাংলা-টু-ইংলিশ অটো কনভার্ট ফোন ইনপুট
│   │   │   └── otp-modal.tsx      # ৪-ডিজিট ওটিপি পপআপ
│   │   ├── storefront/
│   │   │   ├── product-card.tsx   # প্রোডাক্ট কার্ড উইথ কুইক অর্ডার বাটন
│   │   │   └── quick-checkout.tsx # বটম-শিট বা মোডাল ১-ক্লিক ফর্ম
│   │   └── seller/
│   │       ├── status-badge.tsx   # PENDING, IN_COURIER, DELIVERED ব্যাজ
│   │       └── wallet-card.tsx    # পেন্ডিং ও অ্যাভেইলেবল ব্যালেন্স কার্ড
│   │
│   ├── lib/
│   │   ├── api-client.ts          # Axios / Fetch ইন্সট্যান্স উইথ JWT ইন্টারসেপ্টর
│   │   └── utils.ts               # কারেন্সি ফরম্যাটার (৳), ডেট ফরম্যাট
│   ├── hooks/
│   │   ├── use-auth.ts            # ইউজার স্টেট ও লগআউট
│   │   ├── use-tenant.ts          # বর্তমান টেন্যান্ট ডেটা হুক
│   │   └── use-cart.ts            # লোকাল কার্ট / কুইক বাই স্টেট
│   └── types/
│       └── api.ts                 # ব্যাকএন্ড থেকে হুবহু টাইপ ডেফিনিশন
```

---

## 🔌 ৩. ব্যাকএন্ড API ক্লায়েন্ট সেটআপ (`lib/api-client.ts`)

```typescript
// src/lib/api-client.ts
import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// রিকোয়েস্টে স্বয়ংক্রিয়ভাবে JWT টোকেন যুক্ত করা
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('softilo_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// টোকেন এক্সপায়ার হলে অটোমেটিক হ্যান্ডেলিং
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('softilo_token');
      localStorage.removeItem('softilo_user');
      // window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 📱 ৪. ফোন নাম্বার ইনপুট ইউটিলিটি (`components/common/phone-input.tsx`)

ব্যাকএন্ডে যাতে কোনো এরর না খায়, কাস্টমার বাংলা কিবোর্ড দিয়ে টাইপ করলেও ফ্রন্টএন্ড থেকে স্বয়ংক্রিয়ভাবে ইংরেজিতে কনভার্ট হবে:

```typescript
// src/components/common/phone-input.tsx
'use client';

const banglaToEnglishDigits: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

export function cleanBdPhoneInput(input: string): string {
  // ১. বাংলা সংখ্যা ইংরেজিতে কনভার্ট
  let cleaned = input.split('').map((char) => banglaToEnglishDigits[char] ?? char).join('');
  // ২. শুধুমাত্র ডিজিট রাখা
  cleaned = cleaned.replace(/\D/g, '');
  // ৩. 880 থাকলে 01 দিয়ে রাখা
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    cleaned = cleaned.slice(2);
  }
  return cleaned.slice(0, 11); // সর্বোচ্চ ১১ ডিজিট
}
```

---

## 🚀 ৫. প্রধান ফ্রন্টএন্ড ওয়ার্কফ্লো ইমপ্লিমেন্টেশন গাইড

### Workflow ১: Phone + 4-Digit OTP Authentication
- **স্টেপ ১:** ইউজার ১১ ডিজিটের মোবাইল নাম্বার ইনপুট দিবে।
- **স্টেপ ২:** কল করুন `POST /api/v1/auth/send-otp` -> বডি: `{ "phone": "017XXXXXXXX" }`।
- **স্টেপ ৩:** ওটিপি ইনপুট ফিল্ড ও ৬০ সেকেন্ডের কাউন্টডাউন টাইমার দেখান (ডেভেলপমেন্ট মোডে `devOtp: "1234"` রেসপন্সে আসবে)।
- **স্টেপ ৪:** ৪-ডিজিট কোড পেলে কল করুন `POST /api/v1/auth/verify-otp` -> বডি: `{ "phone": "017...", "otp": "1234", "name": "...", "role": "SELLER_OWNER" }`।
- **স্টেপ ৫:** রেসপন্স থেকে `accessToken` এবং `user` ডেটা `localStorage` অথবা কুকিতে সংরক্ষণ করে সেলার ড্যাশবোর্ডে রিডাইরেক্ট করুন।

---

### Workflow ২: সেলার অনবোর্ডিং (Zero-Fee Storefront Creation)
- **রুট:** `/onboard`
- **স্টেপ ১:** ফর্ম ফিল্ডস:
  - দোকানের নাম (`name`): যেমন "Rahim Fashion"
  - শপ স্লাগ (`slug`): টাইপ করার সাথে সাথে লোয়ারকেস ও হাইফেন হবে (যেমন: `rahim-fashion`)
  - কাস্টম ডোমেইন (`customDomain`, অপশনাল)
  - লোগো ও ব্যানার ইমেজ URL
- **স্টেপ ২:** সাবমিট করার সময় কল করুন `POST /api/v1/tenant/onboard` (হেডারে Bearer Token সহ)।
- **স্টেপ ৩:** সাকসেস হলে রেসপন্সে পাওয়া নতুন টেন্যান্ট ডেটা স্টেট-এ সেট করুন এবং সরাসরি সেলার ড্যাশবোর্ড `/seller/dashboard`-এ নিয়ে যান।

---

### Workflow ৩: স্টোরফ্রন্ট রিজলভ ও প্রোডাক্ট প্রদর্শন (`store/[slug]/page.tsx`)
Next.js Server Component দিয়ে সরাসরি সার্ভার-সাইডে টেন্যান্ট ও তার প্রোডাক্ট ফেচ করুন:

```typescript
// src/app/store/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api-client';

async function getTenantData(slug: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/tenant/resolve?slug=${slug}`, {
    next: { revalidate: 60 }, // 1 min ISR cache
  });
  if (!res.ok) return null;
  return res.json();
}

async function getTenantProducts(tenantId: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/products?tenantId=${tenantId}&limit=50`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return { items: [] };
  return res.json();
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantData(slug);

  if (!tenant) notFound();

  const { items: products } = await getTenantProducts(tenant.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shop Header & Banner */}
      <header className="bg-white border-b py-6 px-4 text-center">
        {tenant.logoUrl && <img src={tenant.logoUrl} alt={tenant.name} className="w-16 h-16 rounded-full mx-auto mb-2" />}
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        <p className="text-sm text-gray-500">শপ লিংক: {tenant.slug}.softilo.com</p>
      </header>

      {/* Product Grid */}
      <main className="max-w-6xl mx-auto p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((prod: any) => (
          <div key={prod.id} className="bg-white rounded-lg p-3 shadow-sm border">
            <img src={prod.images[0]} alt={prod.title} className="w-full h-44 object-cover rounded-md mb-2" />
            <h3 className="font-semibold text-sm line-clamp-1">{prod.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-emerald-600 font-bold">৳{prod.discountPrice || prod.price}</span>
              {prod.discountPrice && <span className="text-xs text-gray-400 line-through">৳{prod.price}</span>}
            </div>
            {/* ১-ক্লিক অর্ডার বাটন */}
            <button className="w-full mt-3 bg-emerald-600 text-white py-2 rounded text-xs font-semibold hover:bg-emerald-700">
              অর্ডার করুন
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}
```

---

### Workflow ৪: ১-ক্লিক ক্যাশ-অন-ডেলিভারি (COD) চেকআউট মোডাল
কাস্টমার কোনো প্রোডাক্টে "অর্ডার করুন" চাপলেই এই পপআপ বা বটম-শিট ওপেন হবে:

- **ফিল্ডস:**
  1. আপনার নাম (`customerName`)
  2. মোবাইল নাম্বার (`customerPhone` — ১১ ডিজিট ভ্যালিডেশন)
  3. জেলা (`district` — যেমন: Dhaka, Chittagong ইত্যাদি ড্রপডাউন)
  4. থানা (`thana` — যেমন: Mirpur, Dhanmondi)
  5. সম্পূর্ণ ঠিকানা (`fullAddress` — বাসা/রোড/এরিয়া)
- **অর্ডার সামারি ক্যালকুলেশন:**
  - সাবটোটাল: `৳(দাম × পরিমাণ)`
  - ডেলিভারি চার্জ: `৳৬০` (ঢাকার ভিতরে) বা `৳১২০` (ঢাকার বাইরে)
  - **সর্বমোট প্রদেয় টাকা (Total Payable):** `৳(সাবটোটাল + ডেলিভারি চার্জ)`
- **API Call:**
  `POST /api/v1/orders/quick-checkout`
  ```json
  {
    "tenantId": "tenant-uuid-or-slug",
    "customerName": "করিম উদ্দিন",
    "customerPhone": "01712345678",
    "district": "Dhaka",
    "thana": "Mirpur",
    "fullAddress": "বাড়ি ১২, রোড ৪, ব্লক সি",
    "deliveryCharge": 60,
    "items": [{ "productId": "prod-uuid", "quantity": 1 }]
  }
  ```
- **সাকসেস স্টেট:** একটি গ্রিন টিক মার্ক ও `ORD-XXXXXX` অর্ডার নাম্বার দেখিয়ে "আপনার অর্ডারটি সফল হয়েছে, শীঘ্রই সেলার আপনার সাথে যোগাযোগ করবে" মেসেজ দিন।

---

### Workflow ৫: সেলার ড্যাশবোর্ড — অর্ডার ও কুরিয়ার ট্র্যাকিং
- **রুট:** `/seller/orders`
- **অর্ডার লিস্ট ফেচ:** `GET /api/v1/orders` (হেডারে Bearer Token দিয়ে কল করলে ব্যাকএন্ড স্বয়ংক্রিয়ভাবে শুধুমাত্র ওই সেলারের টেন্যান্টের অর্ডারগুলো ফিল্টার করে পাঠাবে)।
- **কুরিয়ার বুকিং ও ট্র্যাকিং কোড বসানো:**
  - সেলার পার্সেল কুরিয়ারে বুক করার পর একটি ডায়লগে কুরিয়ারের নাম (`STEADFAST` বা `PATHAO`) ও ট্র্যাকিং কোড ইনপুট দিবে।
  - কল করুন:
    `PATCH /api/v1/orders/:id/status`
    ```json
    {
      "status": "IN_COURIER",
      "courierProvider": "STEADFAST",
      "trackingCode": "SF-88991122"
    }
    ```
- **১-ক্লিক ডেলিভারি সেটেলমেন্ট (Mark as Delivered):**
  - কাস্টমার পার্সেল রিসিভ করলে সেলার বা অ্যাডমিন স্ট্যাটাস `DELIVERED` সিলেক্ট করবে:
    `PATCH /api/v1/orders/:id/status` -> `{ "status": "DELIVERED" }`
  - **সেলারকে অ্যালার্ট দিন:** "অর্ডারটি সফলভাবে ডেলিভারি মার্ক করা হয়েছে। প্ল্যাটফর্ম ফি (৫%) কেটে বাকি নিট টাকা আপনার Available Balance-এ যুক্ত হয়েছে।"

---

### Workflow ৬: সেলার ওয়ালেট লেজার স্ক্রিন
- **রুট:** `/seller/wallet`
- **ডেটা ফেচ:** `GET /api/v1/tenant/wallet`
- **UI কম্পোনেন্ট:** ৩টি বড় হাইলাইট কার্ড দেখান:
  1. 🟡 **পেন্ডিং ব্যালেন্স (Pending Balance):** কুরিয়ারে ট্রানজিটে থাকা অর্ডারের প্রাপ্য টাকা।
  2. 🟢 **উত্তোলনযোগ্য ব্যালেন্স (Available Balance):** ডেলিভারি সম্পন্ন হওয়া নিট টাকা (বিকাশ বা ব্যাংক একাউন্টে উইথড্র রিকোয়েস্ট দেওয়ার জন্য প্রস্তুত)।
  3. 🟣 **সর্বমোট আয় (Total Earned):** আজ পর্যন্ত প্ল্যাটফর্ম থেকে মোট কত টাকা আয় হয়েছে।

---

## 🛡️ ৬. ফ্রন্টএন্ড ইঞ্জিনিয়ারদের জন্য কিছু গোল্ডেন রুলস (Best Practices)

1. **কখনোই সেলারের একাউন্ট থেকে অন্য টেন্যান্টের আইডি পাঠাবেন না:**
   - প্রোডাক্ট অ্যাড, এডিট, বা অর্ডার লিস্ট দেখার সময় রিকোয়েস্ট বডিতে `tenantId` পাঠানোর প্রয়োজন নেই; ব্যাকএন্ড ইউজারের JWT সেশন টোকেন থেকে রিয়েল `tenantId` বের করে নিবে।
2. **ক্যাশ অন ডেলিভারি (COD) চেকআউটে কোনো পাসওয়ার্ড ফিল্ড রাখবেন না:**
   - দ্রুততম কনভার্সনের জন্য কাস্টমার শুধু নাম, ফোন ও ঠিকানা দিয়ে ১-ক্লিকে অর্ডার প্লেস করবে।
3. **বাংলা সংখ্যাকে রেসপেক্ট করুন:**
   - ফোন নাম্বার এবং টাকার ঘরে ইউজার যাতে যেকোনো কিবোর্ড থেকে ইনপুট দিতে পারে, সেজন্য `cleanBdPhoneInput` ব্যবহার করবেন।

---

*এই গাইডটি অনুসরণ করে সম্পূর্ণ ফ্রন্টএন্ড (Next.js 15 App Router) ইমপ্লিমেন্ট করা যাবে। ব্যাকএন্ডের সকল API বিস্তারিত জানতে [`api-doc.md`](./api-doc.md) দেখুন।*

