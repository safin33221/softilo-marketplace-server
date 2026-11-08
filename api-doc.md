# Softilo Marketplace API Documentation — Version 1.0 (Startup MVP)

Welcome to the **Softilo Marketplace API** specification for Version 1.0. This API powers a zero-subscription, multi-tenant marketplace platform tailored for Bangladeshi e-commerce, offering frictionless seller onboarding, 1-click cash-on-delivery (COD) guest checkout, automated commission calculations, and atomic wallet ledger settlements.

---

## 🏛️ Core Architectural Principles

1. **Strict Tenant Isolation (`tenantId` Enforcement):**
   - Sellers can only access, modify, or list resources belonging to their own tenant.
   - The `tenantId` is extracted directly from the verified JWT payload. Caller-supplied `req.body.tenantId` is never trusted for authenticated seller actions.
2. **100% Bangladeshi Phone Number Identity:**
   - Primary identifier for all users and customers is a normalized 11-digit BD phone number (`01XXXXXXXXX`).
   - Bangla numerals (`০-৯`), spaces, dashes, and country prefixes (`+880`, `880`) are normalized automatically.
3. **Zero-Subscription, Commission-Ledger Model:**
   - Sellers pay zero monthly or upfront platform fees.
   - For every order, the platform automatically deducts a commission (default `5.00%` on subtotal) and credits the seller's `pendingBalance`.
4. **Idempotent Atomic Transactions:**
   - Financial movements and order status transitions run strictly inside `prisma.$transaction([])`.
   - When an order transitions to `DELIVERED`, funds move atomically from `pendingBalance` to `availableBalance` and `totalEarned`.

---

## 🌐 Base URL & Common Headers

- **Base URL:** `http://localhost:3000` (or production domain)
- **Content-Type:** `application/json`

### Authentication Header (for Protected Endpoints)
```http
Authorization: Bearer <your_jwt_access_token>
```

---

## 📑 Endpoints Summary Table

| Category | Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/send-otp` | Public | Send 4-digit OTP to BD phone |
| **Auth** | `POST` | `/api/v1/auth/verify-otp` | Public | Verify OTP, auto-provision user, return JWT |
| **Tenant** | `POST` | `/api/v1/tenant/onboard` | Authenticated | Create shop slug, wallet, and become SELLER_OWNER |
| **Tenant** | `GET` | `/api/v1/tenant/resolve` | Public | Resolve storefront metadata by slug/customDomain |
| **Tenant** | `GET` | `/api/v1/tenant/me` | Seller | Get current seller shop profile |
| **Tenant** | `GET` | `/api/v1/tenant/wallet` | Seller | Check seller ledger balances (pending, available) |
| **Tenant** | `PATCH`| `/api/v1/tenant/:id/verify` | Super Admin | Verify/approve seller shop |
| **Products** | `POST` | `/api/v1/products` | Seller | Create product in seller's store |
| **Products** | `GET` | `/api/v1/products` | Public | List products (filterable by tenant, query, pagination) |
| **Products** | `GET` | `/api/v1/products/:id` | Public | View single product details |
| **Products** | `PATCH`| `/api/v1/products/:id` | Seller | Update product price, stock, images |
| **Products** | `DELETE`| `/api/v1/products/:id`| Seller | Delete product from store |
| **Orders** | `POST` | `/api/v1/orders/quick-checkout` | Public | 1-Click guest/customer checkout + fee calculation |
| **Orders** | `GET` | `/api/v1/orders` | Authenticated | List orders (isolated by seller tenant or customer) |
| **Orders** | `GET` | `/api/v1/orders/:id` | Authenticated | View single order |
| **Orders** | `PATCH`| `/api/v1/orders/:id/status` | Seller / Admin | Update courier tracking & trigger delivery settlement |

---

## 1. Authentication (`/api/v1/auth`)

### 1.1 Send OTP
Dispatches a 4-digit OTP to a Bangladeshi mobile number. In development mode, static OTP `1234` is enabled.

- **Method:** `POST`
- **URL:** `/api/v1/auth/send-otp`
- **Access:** Public

#### Request Body
```json
{
  "phone": "+8801712345678" // Accepts Bangla digits, +88, spaces, etc.
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "৪-ডিজিট ওটিপি কোড পাঠানো হয়েছে (01712345678)",
  "normalizedPhone": "01712345678",
  "devOtp": "1234"
}
```

#### Error Response (`400 Bad Request`)
```json
{
  "statusCode": 400,
  "message": "সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)"
}
```

---

### 1.2 Verify OTP
Verifies the 4-digit code. If user does not exist, provisions a `CUSTOMER` account (or `SELLER_OWNER` if specified). Returns a signed JWT token valid for 7 days.

- **Method:** `POST`
- **URL:** `/api/v1/auth/verify-otp`
- **Access:** Public

#### Request Body
```json
{
  "phone": "01712345678",
  "otp": "1234",
  "name": "Rahim Ahmed",
  "role": "SELLER_OWNER" // Optional: CUSTOMER | SELLER_OWNER (default: CUSTOMER)
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "ওটিপি সফলভাবে যাচাই করা হয়েছে (OTP verified successfully)",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "c138d689-53e7-4b72-88ef-35beee207e91",
    "phone": "01712345678",
    "name": "Rahim Ahmed",
    "role": "SELLER_OWNER",
    "tenantId": null,
    "loyaltyPoints": 0,
    "totalDelivered": 0,
    "totalReturned": 0
  }
}
```

---

## 2. Tenant & Storefront (`/api/v1/tenant`)

### 2.1 Onboard Seller Shop
Allows an authenticated user to create their shop. In an atomic transaction, provisions `Tenant`, initializes `TenantWallet` with `0.00` balance, and promotes the user to `SELLER_OWNER` with linked `tenantId`.

- **Method:** `POST`
- **URL:** `/api/v1/tenant/onboard`
- **Access:** Protected (`Bearer <token>`)

#### Request Body
```json
{
  "name": "Rahim Fashion",
  "slug": "rahim-fashion", // Optional (auto-generated if omitted)
  "customDomain": "rahimfashion.com", // Optional
  "logoUrl": "https://example.com/logo.png", // Optional
  "bannerUrl": "https://example.com/banner.jpg" // Optional
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "সেলার অনবোর্ডিং সফল হয়েছে (Seller onboarded successfully)",
  "tenant": {
    "id": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
    "name": "Rahim Fashion",
    "slug": "rahim-fashion",
    "customDomain": "rahimfashion.com",
    "phone": "01712345678",
    "logoUrl": "https://example.com/logo.png",
    "bannerUrl": "https://example.com/banner.jpg",
    "commissionRate": "5.00",
    "trustScore": 100,
    "isVerified": false,
    "isActive": true,
    "createdAt": "2026-11-08T18:00:00.000Z",
    "updatedAt": "2026-11-08T18:00:00.000Z"
  },
  "wallet": {
    "id": "w1-9988",
    "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
    "pendingBalance": "0.00",
    "availableBalance": "0.00",
    "totalEarned": "0.00"
  },
  "user": {
    "id": "c138d689-53e7-4b72-88ef-35beee207e91",
    "phone": "01712345678",
    "role": "SELLER_OWNER",
    "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1"
  }
}
```

---

### 2.2 Resolve Storefront
Used by customer storefronts (subdomains like `rahim-fashion.domain.com` or custom domains) to resolve public tenant metadata.

- **Method:** `GET`
- **URL:** `/api/v1/tenant/resolve?slug=rahim-fashion`
- **Query Parameters:**
  - `slug`: Shop slug (e.g., `rahim-fashion`)
  - `customDomain`: Custom domain (e.g., `rahimfashion.com`)
  - `id`: Tenant UUID
- **Access:** Public

#### Success Response (`200 OK`)
```json
{
  "id": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
  "name": "Rahim Fashion",
  "slug": "rahim-fashion",
  "customDomain": "rahimfashion.com",
  "logoUrl": "https://example.com/logo.png",
  "bannerUrl": "https://example.com/banner.jpg",
  "trustScore": 100,
  "isVerified": true,
  "isActive": true,
  "createdAt": "2026-11-08T18:00:00.000Z"
}
```

---

### 2.3 Seller Profile Overview
- **Method:** `GET`
- **URL:** `/api/v1/tenant/me`
- **Access:** Protected (`Bearer <token>` with `SELLER_OWNER` role)

#### Success Response (`200 OK`)
Returns the seller's tenant info along with real-time product count and order count.

---

### 2.4 Tenant Wallet Balance
- **Method:** `GET`
- **URL:** `/api/v1/tenant/wallet`
- **Access:** Protected (`Bearer <token>` with `SELLER_OWNER` role)

#### Success Response (`200 OK`)
```json
{
  "id": "w1-9988",
  "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
  "pendingBalance": "1960.00",
  "availableBalance": "3500.00",
  "totalEarned": "5460.00",
  "updatedAt": "2026-11-08T18:05:00.000Z"
}
```

---

### 2.5 Verify Seller Shop (Super Admin)
- **Method:** `PATCH`
- **URL:** `/api/v1/tenant/:id/verify`
- **Access:** Protected (`SUPER_ADMIN` role)

#### Request Body
```json
{
  "isVerified": true
}
```

---

## 3. Products Management (`/api/v1/products`)

### 3.1 Create Product
- **Method:** `POST`
- **URL:** `/api/v1/products`
- **Access:** Protected (`Bearer <token>` with `SELLER_OWNER` role)
- **Tenant Isolation:** Enforced via `tenantId` in JWT token.

#### Request Body
```json
{
  "title": "Premium Cotton Panjabi",
  "description": "100% fine cotton traditional panjabi for Eid.",
  "price": 1800,
  "discountPrice": 1500, // Optional
  "stock": 25,
  "images": [
    "https://example.com/panjabi-front.jpg",
    "https://example.com/panjabi-back.jpg"
  ]
}
```

#### Success Response (`201 Created`)
```json
{
  "id": "49557fc9-4f32-4752-b883-933e144aef42",
  "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
  "title": "Premium Cotton Panjabi",
  "slug": "premium-cotton-panjabi",
  "description": "100% fine cotton traditional panjabi for Eid.",
  "price": "1800.00",
  "discountPrice": "1500.00",
  "stock": 25,
  "images": [
    "https://example.com/panjabi-front.jpg",
    "https://example.com/panjabi-back.jpg"
  ],
  "isCurated": false,
  "createdAt": "2026-11-08T18:10:00.000Z"
}
```

---

### 3.2 List Products
- **Method:** `GET`
- **URL:** `/api/v1/products`
- **Access:** Public
- **Query Parameters:**
  - `tenantId`: Filter by specific tenant UUID
  - `tenantSlug`: Filter by shop slug (e.g. `rahim-fashion`)
  - `search`: Case-insensitive search on title & description
  - `isCurated`: `true` | `false`
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `20`)

#### Success Response (`200 OK`)
```json
{
  "items": [
    {
      "id": "49557fc9-4f32-4752-b883-933e144aef42",
      "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
      "title": "Premium Cotton Panjabi",
      "slug": "premium-cotton-panjabi",
      "price": "1800.00",
      "discountPrice": "1500.00",
      "stock": 25,
      "images": ["https://example.com/panjabi-front.jpg"],
      "isCurated": false,
      "tenant": {
        "id": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
        "name": "Rahim Fashion",
        "slug": "rahim-fashion",
        "logoUrl": "https://example.com/logo.png"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### 3.3 Get Single Product
- **Method:** `GET`
- **URL:** `/api/v1/products/:id`
- **Access:** Public

---

### 3.4 Update Product
- **Method:** `PATCH`
- **URL:** `/api/v1/products/:id`
- **Access:** Protected (`SELLER_OWNER` role, owner only)

#### Request Body
```json
{
  "price": 1750,
  "discountPrice": 1450,
  "stock": 50
}
```

---

### 3.5 Delete Product
- **Method:** `DELETE`
- **URL:** `/api/v1/products/:id`
- **Access:** Protected (`SELLER_OWNER` role, owner only)

---

## 4. Orders & Financial Settlement (`/api/v1/orders`)

### 4.1 1-Click Guest & Customer Quick Checkout
Enables instant Cash on Delivery (COD) order placement without requiring prior customer registration.

#### Checkout Execution Steps:
1. Normalizes `customerPhone` (`01XXXXXXXXX`).
2. Auto-provisions `CUSTOMER` account if the phone number is new.
3. Checks product inventory and reserves stock.
4. Calculates:
   $$\text{subtotal} = \sum (\text{effectivePrice} \times \text{quantity})$$
   $$\text{platformFee} = \text{subtotal} \times \left(\frac{\text{commissionRate}}{100}\right)$$
   $$\text{totalAmount} = \text{subtotal} + \text{deliveryCharge} - \text{discountAmount}$$
   $$\text{netSellerAmount} = \text{totalAmount} - \text{platformFee}$$
5. Generates human-readable `orderNumber` (`ORD-XXXXXX`).
6. Atomically creates `Order` and credits `netSellerAmount` to `TenantWallet.pendingBalance`.

- **Method:** `POST`
- **URL:** `/api/v1/orders/quick-checkout`
- **Access:** Public

#### Request Body
```json
{
  "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1", // Or tenant slug "rahim-fashion"
  "customerName": "Karim Uddin",
  "customerPhone": "+8801811223344",
  "district": "Dhaka",
  "thana": "Dhanmondi",
  "fullAddress": "House 14, Road 7/A, Dhanmondi, Dhaka",
  "deliveryCharge": 60,
  "items": [
    {
      "productId": "49557fc9-4f32-4752-b883-933e144aef42",
      "quantity": 2
    }
  ]
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "অর্ডার সফলভাবে সম্পন্ন হয়েছে (Order placed successfully)",
  "order": {
    "id": "ord-7711",
    "orderNumber": "ORD-5198028471",
    "tenantId": "e88d0fe5-69bc-438d-8a58-6c8c4fbfe4b1",
    "customerId": "user-cust-99",
    "customerName": "Karim Uddin",
    "customerPhone": "01811223344",
    "district": "Dhaka",
    "thana": "Dhanmondi",
    "fullAddress": "House 14, Road 7/A, Dhanmondi, Dhaka",
    "subtotal": "3000.00",
    "deliveryCharge": "60.00",
    "discountAmount": "0.00",
    "totalAmount": "3060.00",
    "platformFee": "150.00",
    "netSellerAmount": "2910.00",
    "status": "PENDING",
    "courierProvider": null,
    "trackingCode": null,
    "createdAt": "2026-11-08T18:20:00.000Z",
    "items": [
      {
        "id": "item-1",
        "orderId": "ord-7711",
        "productId": "49557fc9-4f32-4752-b883-933e144aef42",
        "productName": "Premium Cotton Panjabi",
        "quantity": 2,
        "unitPrice": "1500.00"
      }
    ]
  }
}
```

---

### 4.2 List Orders
Returns orders isolated by role:
- `SELLER_OWNER`: Sees only their store's orders (`where: { tenantId }`).
- `CUSTOMER`: Sees only orders placed by their phone/account (`where: { customerId }`).
- `SUPER_ADMIN`: Sees all orders across all tenants.

- **Method:** `GET`
- **URL:** `/api/v1/orders`
- **Access:** Protected (`Bearer <token>`)
- **Query Parameters:**
  - `status`: Filter by status (`PENDING`, `CONFIRMED`, `IN_COURIER`, `DELIVERED`, `CANCELLED`, `RETURNED`)
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `20`)

#### Success Response (`200 OK`)
```json
{
  "items": [ ... ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### 4.3 Get Single Order
- **Method:** `GET`
- **URL:** `/api/v1/orders/:id`
- **Access:** Protected (`Bearer <token>`, customer or seller owner)

---

### 4.4 Update Order Status & Delivery Settlement
Allows the seller or admin to update tracking details and transition order status.

- **Method:** `PATCH`
- **URL:** `/api/v1/orders/:id/status`
- **Access:** Protected (`SELLER_OWNER` or `SUPER_ADMIN`)

#### Request Body
```json
{
  "status": "DELIVERED", // "CONFIRMED" | "IN_COURIER" | "DELIVERED" | "RETURNED" | "CANCELLED"
  "courierProvider": "STEADFAST", // Optional: "STEADFAST" | "PATHAO" | "REDX"
  "trackingCode": "SF-88990011" // Optional
}
```

#### Status Transition Mechanics:
| Target Status | Impact on Stock | Impact on Seller Wallet | Customer Metric |
| :--- | :--- | :--- | :--- |
| `CONFIRMED` | No change | No change | None |
| `IN_COURIER` | No change | No change | None |
| `DELIVERED` | No change | Deduct `netSellerAmount` from `pendingBalance`, add to `availableBalance` and `totalEarned` | `totalDelivered` +1, `loyaltyPoints` + (subtotal / 100) |
| `CANCELLED` | Restocks all products | Deduct `netSellerAmount` from `pendingBalance` | None |
| `RETURNED` | Restocks all products | Deduct `netSellerAmount` from `pendingBalance` | `totalReturned` +1 |

#### Success Response (`200 OK`)
```json
{
  "id": "ord-7711",
  "orderNumber": "ORD-5198028471",
  "status": "DELIVERED",
  "courierProvider": "STEADFAST",
  "trackingCode": "SF-88990011",
  "netSellerAmount": "2910.00"
}
```

---

## 5. Error Response Standard

All endpoints return uniform HTTP error responses:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "customerPhone",
      "message": "সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)"
    }
  ]
}
```

| HTTP Code | Description | Typical Cause |
| :--- | :--- | :--- |
| `400` | Bad Request | Invalid input data, stock depleted, or invalid OTP |
| `401` | Unauthorized | Missing or expired JWT Bearer token |
| `403` | Forbidden | Attempting to access another seller's tenant data |
| `404` | Not Found | Product, tenant, or order does not exist |
| `409` | Conflict | Shop slug or phone number already registered |

---

*Generated for Softilo Marketplace Version 1.0 (Startup MVP).*

