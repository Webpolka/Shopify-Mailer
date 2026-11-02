# DrBerg BIS Mailer App

Embedded Shopify app for sending custom email templates (back-in-stock notifications, welcome emails, etc.) triggered by Shopify Flow. Built on the official Shopify React Router template with Tailwind v4 + shadcn/ui.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick Start for Junior Developers](#quick-start-for-junior-developers)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Storefront Form Setup](#storefront-form-setup)
- [Shopify Flow Configuration](#shopify-flow-configuration)
- [Testing End-to-End](#testing-end-to-end)
- [SMTP Configuration](#smtp-configuration)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Architecture Decisions](#architecture-decisions)
- [File Structure](#file-structure)

---

## Overview

This app replaces paid services like WorkflowMail ($9.99/mo) or Vitals Back in Stock ($29.99/mo) with a self-hosted, fully customizable solution. You own the templates, the data, and the SMTP — no per-email fees beyond the SMTP provider's pricing.

**What it does:**

1. Customer visits a sold-out product page
2. They enter their email in a "Notify me when available" form
3. Shopify creates a customer record tagged with `back-in-stock-{product_id}`
4. When inventory changes from 0 to >0, Shopify Flow triggers
5. Flow finds all customers with that tag, sends their data to your app
6. Your app renders the email template with Liquid variables, sends via SMTP
7. App removes the tag (so customer won't get repeat notifications)

**What it costs:** $0 in dev (Ethereal test SMTP), ~$5/mo in production (VPS + Resend free tier for 3000 emails/mo).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Shopify Admin                                              │
│                                                            │
│   ┌────────────────────┐    ┌──────────────────────────┐  │
│   │ Storefront         │    │ Shopify Flow             │  │
│   │ (theme)            │    │                          │  │
│   │ BIS form:          │    │ Trigger: Inventory       │  │
│   │ {% form 'customer'%}│   │   quantity changed       │  │
│   │ contact[tags]=     │    │                          │  │
│   │   back-in-stock-   │    │ Condition: prior<1       │  │
│   │   {product.id}     │    │   AND current>0          │  │
│   │ contact[accepts_   │    │                          │  │
│   │   marketing]=true  │    │ Get customer data:       │  │
│   │                    │    │   tag:'back-in-stock-    │  │
│   │ Creates customer   │    │     {legacyResourceId}'  │  │
│   │ with tag + opt-in  │    │                          │  │
│   │                    │    │ For each →               │  │
│   └────────────────────┘    │   Send HTTP request ─────┼──┼──┐
│                              │   Remove customer tags   │  │  │
│                              └──────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────┘  │
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────┐
│ Your App (React Router 7 + Tailwind v4 + shadcn/ui)         │
│                                                              │
│   POST /api/send                                            │
│   ├─ Auth: x-flow-secret header                            │
│   ├─ Load template from DB by slug                          │
│   ├─ Render Liquid variables: {{ customerName }}, etc.      │
│   ├─ Send via Nodemailer SMTP                              │
│   └─ Return JSON response                                  │
│                                                              │
│   Prisma + SQLite (dev) / PostgreSQL (prod)                 │
│   Template model: id, name (slug), displayName, subject,    │
│                   htmlBody                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Requirements

- **Node.js ≥ 22.12**
- **npm** or **pnpm**
- **Shopify Partner account** (free): https://partners.shopify.com
- **Development store** (free): create one in Partner dashboard
- **Shopify CLI**: `npm install -g @shopify/cli`

---

## Quick Start for Junior Developers

If you're a junior dev joining the project, follow these steps in order:

```bash
# 1. Clone the project
git clone <repo-url> dr-berg-mailer
cd dr-berg-mailer

# 2. Install dependencies
npm install

# 3. Copy .env.example to .env and fill in
cp .env.example .env
# Edit .env — at minimum, set FLOW_SECRET (see below)

# 4. Generate Prisma client + create DB
npx prisma generate
npx prisma migrate dev --name init

# 5. Seed default templates
npm run seed

# 6. Run dev server (Shopify CLI creates tunnel + registers app)
npm run dev
```

**First run will prompt you to:**
- Log in to Shopify Partner account
- Select a development store
- Confirm app registration

After that — embedded app opens in your browser at the Shopify admin URL.

**Read these sections in order:**
1. [Environment Variables](#environment-variables) — to fill in `.env`
2. [Storefront Form Setup](#storefront-form-setup) — to install the BIS form in the theme
3. [Shopify Flow Configuration](#shopify-flow-configuration) — to wire up the automation
4. [Testing End-to-End](#testing-end-to-end) — to verify it all works

---

## Installation

```bash
# Clone
git clone <repo-url> dr-berg-mailer
cd dr-berg-mailer

# Install deps
npm install

# Install Shopify CLI globally (if not already)
npm install -g @shopify/cli
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

### Generate FLOW_SECRET

```bash
openssl rand -hex 32
```

Copy the output (64-char hex string) into `.env`:

```bash
FLOW_SECRET=18733431c2553d0ad89f7cd6cc5f76db998a16ec1d2e63d3e270b4a999bafccd
```

This is the secret token Shopify Flow must send in the `x-flow-secret` header. **Never commit `.env` to git.**

### Full `.env` reference

```bash
# Shopify App (auto-filled by `shopify app dev`)
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SCOPES=write_products,write_metaobjects,write_metaobject_definitions
SHOP_CUSTOM_DOMAIN=

# SMTP — leave empty for DEV (auto-Ethereal test inbox)
# For PROD, fill with real SMTP credentials (see SMTP Configuration section)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
DEFAULT_FROM=Your Store <hello@yourdomain.com>

# Flow webhook secret — REQUIRED
FLOW_SECRET=<openssl rand -hex 32 output>

# Store URL (used in default templates)
STORE_URL=https://your-store.myshopify.com
```

### About the Shopify vars

`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL` — **don't fill these manually**. They're auto-populated by `shopify app dev` when you first run it.

---

## Database Setup

### Generate Prisma client

```bash
npx prisma generate
```

This reads `prisma/schema.prisma` and generates TypeScript types for `prisma.template`, `prisma.session`, etc.

### Create DB + apply migrations

```bash
npx prisma migrate dev --name init
```

Creates `prisma/dev.sqlite` and applies the schema. You should see:

```
Your database is now in sync with your schema.
```

### Seed default templates

```bash
npm run seed
```

Creates two default templates:
- `back-in-stock` — full HTML email with inline styles
- `welcome` — simple welcome email

You can edit these later through the app UI.

---

## Running the App

```bash
npm run dev
```

This runs `shopify app dev`, which:
1. Starts Cloudflare tunnel to your local app (gives you a public URL)
2. Registers the app in your Shopify Partner account
3. Installs it on your development store
4. Opens embedded app in browser

**First run** prompts you to log in to Shopify Partners and select a store.

**Subsequent runs** reuse the same configuration.

### Find your webhook URL

In the dev server output, look for:
```
Shopify:    https://abc-xyz.trycloudflare.com
```

Your webhook endpoint is: `https://abc-xyz.trycloudflare.com/api/send`

**Important:** Cloudflare tunnel URLs change on every `npm run dev` restart. Update the URL in Shopify Flow when it changes.

### Verify webhook works

```bash
# GET — returns endpoint info
curl https://abc-xyz.trycloudflare.com/api/send

# POST with secret — sends test email
curl -X POST https://abc-xyz.trycloudflare.com/api/send \
  -H "Content-Type: application/json" \
  -H "x-flow-secret: YOUR_FLOW_SECRET" \
  -d '{
    "template": "back-in-stock",
    "customerEmail": "test@example.com",
    "variables": {
      "customerName": "Test",
      "productTitle": "Sample Product",
      "productUrl": "https://example.com/products/sample",
      "shopName": "Test Shop",
      "shopUrl": "https://example.com"
    }
  }'
```

Expected response:
```json
{"success":true,"messageId":"<...>","provider":"ethereal"}
```

---

## Storefront Form Setup

Add the BIS form to your Shopify theme so customers can subscribe to notifications.

### Where to put it

In your theme, find the product page section. Typically `sections/main-product.liquid` (Dawn theme) or similar. Inside the `buy_buttons` block case, add the form **after** the add-to-cart button.

### Form code (Liquid)

```liquid
                    {% comment %} Форма если нет товара чтобы сообщить {% endcomment %}
                    {% if product.available == false %}
                      {% form 'customer' %}
                        <div data-slot="product_available_form"
                            class="tw:text-[#0b0c0e] tw:text-[1.2rem] tw:flex-col tw:gap-[1rem] tw:flex tw:mt-[2rem]">

                          {% if form.posted_successfully? %}
                            {% comment %} Успех — показываем спасибо {% endcomment %}
                            <div class="tw:border tw:border-additional-green tw:bg-additional-green/10 tw:rounded-[1.2rem] tw:p-[1.6rem] tw:flex tw:items-start tw:gap-[1rem]">
                              <svg class="tw:w-[2rem] tw:h-[2rem] tw:text-additional-green tw:flex-shrink-0 tw:mt-[0.2rem]" focusable="false" aria-hidden="true">
                                <use href="#check"></use>
                              </svg>
                              <span class="tw:text-[1.4rem] tw:leading-[1.33] tw:tracking-[-0.01em] tw:text-grayscale-950">
                                Thank you! We'll email you the moment <strong>{{ product.title | escape }}</strong> is back in stock.
                              </span>
                            </div>

                          {% elsif form.errors %}
                            {% comment %} Ошибка — показываем сообщение {% endcomment %}
                            <div class="tw:border tw:border-additional-red tw:bg-additional-red/10 tw:rounded-[1.2rem] tw:p-[1.6rem] tw:flex tw:items-start tw:gap-[1rem]">
                              <svg class="tw:w-[2rem] tw:h-[2rem] tw:text-additional-red tw:flex-shrink-0 tw:mt-[0.2rem]" focusable="false" aria-hidden="true">
                                <use href="#error"></use>
                              </svg>
                              <span class="tw:text-[1.4rem] tw:leading-[1.33] tw:tracking-[-0.01em] tw:text-grayscale-950">
                                {{ form.errors | default_errors }}
                              </span>
                            </div>

                          {% else %}
                            {% comment %} Сама форма {% endcomment %}
                            <input type="hidden" name="contact[tags]" value="back-in-stock-{{ product.id }}">
                            <input type="hidden" name="contact[accepts_marketing]" value="true">

                            <span>Notify me when available</span>
                            <div class="tw:grid tw:grid-cols-1 tw:sm:grid-cols-[7fr_3fr] tw:gap-[1rem]">
                              <input data-slot="field_product_available"
                                    class="tw:text-[#0b0c0e] tw:bg-white tw:!min-w-0 tw:flex-1 tw:min-h-[3rem] tw:rounded-full tw:py-[1rem] tw:px-[2rem]"
                                    type="email"
                                    name="contact[email]"
                                    placeholder="Email"
                                    required>
                              <button class="button button--secondary tw:whitespace-nowrap" type="submit">Notify me</button>
                            </div>
                          {% endif %}

                        </div>
                      {% endform %}
                    {%- endif -%}
```

### What this form does

1. `{% form 'customer' %}` — Shopify form type that creates a customer record (no account registration required)
2. `name="contact[tags]" value="back-in-stock-{{ product.id }}"` — applies a tag like `back-in-stock-1234567890` to the customer
3. `name="contact[accepts_marketing]" value="true"` — opts customer into marketing emails (so Send marketing email action would also work, but we use Send HTTP request for full control)
4. `form.posted_successfully?` — shows success message after form submit
5. `form.errors` — shows errors (invalid email, etc.)

### Why `product.id` and not `variant.id`?

For single-variant products, they're equivalent. If you have multi-variant products in the future, switch to `product.selected_or_first_available_variant.id` and adjust the Flow query accordingly.

### Test the form

1. Open a sold-out product page in your storefront
2. You should see the "Notify me when available" form
3. Submit with your email
4. Should show green "Thank you!" message
5. Check Shopify admin → Customers → your email should have tag `back-in-stock-{product_id}`

---

## Shopify Flow Configuration

This is the automation that fires when inventory changes.

### Step 1. Open Shopify Flow

Shopify admin → **Apps** → **Shopify Flow** (install from App Store if not present, it's free).

Click **Create workflow**.

### Step 2. Trigger

1. Click **Select a trigger**
2. Search for **"Product variant inventory quantity changed"**
3. Select it (no configuration needed)

### Step 3. Condition

After trigger, click **+ Condition**:

```
IF
  Inventory quantity prior (inventoryQuantityPrior) — Less than — 1
AND
  Inventory quantity (productVariant.inventoryQuantity) — Greater than — 0
THEN → true
```

This catches: "stock moved from 0 (or below) to above 0" — i.e., the product just became available.

### Step 4. Get customer data

After `THEN`, click **+ Action** → **"Get customer data"**:

| Field | Value |
|---|---|
| Maximum number of customers | `100` (NOT 10 — limit prevents missing subscribers) |
| Sort by | Created at |
| Sort order | Ascending (oldest first) |
| Advanced → Write a query | `tag:'back-in-stock-{{ productVariant.product.legacyResourceId }}'` |

**Critical:** Use `legacyResourceId` (numeric ID), NOT `id` (global ID like `gid://shopify/Product/123`). The tag in the storefront form is numeric, so the query must also be numeric.

### Step 5. For each loop

After Get customer data, click **+ For each**:

- **Items**: select `Get customer data` from dropdown

### Step 6. Send HTTP request (calls your app!)

Inside the For each loop, click **+ Action** → **"Send HTTP request"**:

**Method:** `POST`

**URL:** `https://YOUR-CLOUDFLARE-URL.trycloudflare.com/api/send`

**Headers:**
```
Content-Type: application/json
x-flow-secret: YOUR_FLOW_SECRET_FROM_ENV
```

**Body (JSON):**
```json
{
  "template": "back-in-stock",
  "customerEmail": "{{ getCustomerDataForeachitem.email }}",
  "variables": {
    "customerName": "{{ getCustomerDataForeachitem.firstName }}",
    "productTitle": "{{ productVariant.product.title }}",
    "productUrl": "https://YOUR-STORE.com/products/{{ productVariant.product.handle }}",
    "productImage": "{{ productVariant.product.featuredImage.url }}",
    "productPrice": "{{ productVariant.price }}",
    "productHandle": "{{ productVariant.product.handle }}",
    "shopName": "Your Store Name",
    "shopUrl": "https://YOUR-STORE.com"
  }
}
```

**Replace:**
- `YOUR-CLOUDFLARE-URL` with your actual tunnel URL
- `YOUR_FLOW_SECRET_FROM_ENV` with the value from your `.env`
- `YOUR-STORE.com` with your actual Shopify store domain

### Step 7. Remove customer tags

Inside For each loop, AFTER Send HTTP request, click **+ Action** → **"Remove customer tags"**:

| Field | Value |
|---|---|
| Customer | `getCustomerDataForeachitem.id` |
| Tags | `back-in-stock-{{ productVariant.product.legacyResourceId }}` |

**Critical:** Again use `legacyResourceId`, not `id`. Otherwise the tag won't be removed and customers get repeat notifications on every restock.

### Step 8. Publish workflow

Top-right toggle: **Draft → Live** (or Unpublished → Published).

### Why the order matters

```
Send HTTP request → Remove customer tags
```

If you reverse this:
- Remove tags first → no customers in For each → no emails sent

If you skip Remove customer tags:
- Same customer gets repeat notifications every time inventory changes (even small adjustments)

---

## Testing End-to-End

### Step 1. Create a test product

Shopify admin → **Products → Add product**:
- Title: `Test BIS Product`
- **Inventory → Track quantity** = ON
- **Quantity** = `0`
- Save

### Step 2. Subscribe as a customer

1. Open the test product in your **storefront** (not admin — open as a visitor)
2. You should see the "Notify me when available" form
3. Enter your real email
4. Click "Notify me"
5. Should see green "Thank you!" message

Verify in Shopify admin → **Customers**:
- Find your email
- Should have tag `back-in-stock-{numeric_product_id}`

### Step 3. Trigger the Flow

Shopify admin → **Products** → Test BIS Product → **Inventory**:
- Change Quantity from `0` to `5`
- Save

### Step 4. Wait 1-5 minutes

Flow doesn't fire instantly. Give it a few minutes.

### Step 5. Check Flow run history

Shopify admin → **Apps → Shopify Flow** → your workflow → **Run history**:
- See the latest run
- Status: `Completed`
- Click into it to see the step tree

### Step 6. Check app logs

In your terminal where `npm run dev` is running, you should see:

```
POST /api/send 200 - - 4000ms
📧 ✅ Email captured (Ethereal)
   To: your@email.com
   Subject: Good news! Test BIS Product is back in stock
   Preview: https://ethereal.email/message/...
```

Click the Preview URL — opens the rendered email in a browser.

### Step 7. Verify tag removal

Shopify admin → **Customers** → your test customer:
- Tag `back-in-stock-{product_id}` should be **gone**
- Confirms Remove customer tags step worked

### Step 8. Test with real SMTP (optional)

If you've configured SMTP (see next section), the email should arrive in your real inbox instead of Ethereal.

---

## SMTP Configuration

For dev: leave `SMTP_*` empty in `.env` — app auto-creates an [Ethereal Email](https://ethereal.email) test account. Emails are captured (not actually sent), preview URL is logged.

For prod: use a real transactional SMTP provider.

### Option A: Resend (recommended, 3000 emails/mo free)

1. Sign up at https://resend.com
2. Get API key (starts with `re_...`)
3. Verify your sending domain in Resend dashboard
4. Set in `.env`:

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_your_api_key
DEFAULT_FROM=Your Store <hello@yourdomain.com>
```

### Option B: SendGrid

1. Sign up at https://sendgrid.com
2. Create API key
3. Set in `.env`:

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your_api_key
DEFAULT_FROM=Your Store <hello@yourdomain.com>
```

### Option C: AWS SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=SES_SMTP_USERNAME
SMTP_PASSWORD=SES_SMTP_PASSWORD
DEFAULT_FROM=Your Store <hello@yourdomain.com>
```

### DNS records for deliverability

**Required** for any SMTP provider, otherwise emails go to spam:

- **SPF** — TXT record: `v=spf1 include:_spf.resend.com ~all` (replace with your provider's include)
- **DKIM** — CNAME records (provided by your SMTP provider)
- **DMARC** — TXT record: `v=DMARC1; p=quarantine; rua=mailto:you@yourdomain.com`

Setup instructions are in your SMTP provider's dashboard.

---

## Deployment

For production, deploy to a host that supports Node.js + a database.

### Option A: Vercel (easiest)

1. Push project to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Build command: `npm run build`
5. Output: `build/server/index.js`
6. Use external PostgreSQL (Neon, Supabase) — Vercel doesn't persist SQLite

### Option B: Railway ($5/mo)

1. Connect GitHub repo
2. Railway auto-detects Node.js
3. Set env vars in dashboard
4. Railway provides PostgreSQL add-on

### Option C: VPS (Hetzner CX22 ~$4.5/mo)

1. SSH to server
2. Clone repo
3. Install Node.js 22 + pnpm
4. `pnpm install && pnpm build`
5. Use `pm2` to keep alive: `pm2 start "pnpm start" --name bis-mailer`
6. Use Caddy for HTTPS: `caddy reverse_proxy --from yourdomain.com --to localhost:3000`

### After deployment

1. Update `SHOPIFY_APP_URL` in Partner dashboard → App settings → URLs
2. Update Shopify Flow workflow → Send HTTP request → URL field with new domain
3. Run `npx prisma migrate deploy` to apply schema to production DB

---

## Troubleshooting

### App won't start

**Error:** `Cannot read properties of undefined (reading 'findMany')`

**Cause:** Prisma client doesn't see the `Template` model.

**Fix:**
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

Then restart dev server.

### Flow webhook returns 401 Unauthorized

**Cause:** `x-flow-secret` header doesn't match `FLOW_SECRET` in `.env`.

**Fix:**
1. Check `.env` has `FLOW_SECRET=...` with a real value (not the default)
2. Restart `npm run dev` after changing `.env`
3. Copy the exact value to the Flow workflow's headers

### Flow webhook returns 404

**Cause:** Wrong URL or Cloudflare tunnel is down.

**Fix:**
1. Check URL ends with `/api/send`
2. Restart `npm run dev` — Cloudflare tunnel URL changes each restart
3. Update Flow workflow with the new URL

### Get customer data returns 0 customers

**Cause:** Customer doesn't have the expected tag.

**Fix:**
1. Check Shopify admin → Customers → does the customer have tag `back-in-stock-{numeric_product_id}`?
2. Check Flow query uses `legacyResourceId` (numeric), not `id` (gid://...)
3. The number in the tag must match the product's numeric ID

### Email doesn't arrive

**If using Ethereal (dev):** Emails are NOT actually sent — they're captured. Check the preview URL in the server logs.

**If using real SMTP:**
1. Check spam folder
2. Verify SPF/DKIM/DMARC DNS records are set on your sending domain
3. Check SMTP provider's logs for bounces

### Remove customer tags doesn't work

**Cause:** Using `productVariant.product.id` (global ID) instead of `legacyResourceId` (numeric).

**Fix:** In the Remove customer tags action, change:
```
back-in-stock-{{ productVariant.product.id }}
```
to:
```
back-in-stock-{{ productVariant.product.legacyResourceId }}
```

### Hydration errors in browser console

**Error:** `Hydration failed because the initial UI does not match what was rendered on the server`

**Fix:** Ensure `<html>` in `app/root.tsx` has `suppressHydrationWarning`:
```tsx
<html lang="en" suppressHydrationWarning>
```

### Base UI button warning

**Error:** `A component that acts as a button expected a native <button>`

**Fix:** Add `nativeButton={false}` to any `<Button render={<Link>...}>` usage:
```tsx
<Button
  nativeButton={false}
  render={<Link to="/app">Back</Link>}
/>
```

---

## Architecture Decisions

### Why a custom app instead of paid BIS apps?

| Option | Cost | Limitations |
|---|---|---|
| **This app** | $0-5/mo | Full control, you own data |
| WorkflowMail Pro | $9.99/mo | 500 actions, raw HTML only |
| Vitals BIS | $29.99/mo | Locked to their UI |
| Klaviyo BIS | $20+/mo | Locked to their templates |

### Why Send HTTP request instead of Send marketing email?

`Send marketing email` action in Shopify Flow has critical limitations:
- Can't use Flow variables like `{{ productVariant.product.title }}` in the email body (different Liquid scope)
- Requires customer to have `accepts_marketing = true` (we set this in the form, but still a constraint)
- Template picker doesn't support custom Liquid

`Send HTTP request` to our own app:
- Full Liquid rendering server-side with `liquidjs`
- Full control over template via raw HTML editor
- Works with any SMTP provider
- No opt-in requirement (we can use transactional SMTP)

### Why `legacyResourceId` instead of `id`?

In Liquid (`storefront`), `{{ product.id }}` returns a **numeric** ID like `1234567890`.

In Flow's GraphQL context, `productVariant.product.id` returns a **global ID** like `gid://shopify/Product/1234567890`.

`legacyResourceId` returns the numeric ID — same format as Liquid's `product.id`.

So the storefront form creates tags like `back-in-stock-1234567890`, and Flow's Get customer data query must use the same numeric format.

### Why `contact[tags]` and not `customer[tags]`?

Inside `{% form 'customer' %}`, the `contact[tags]` parameter is the **working** way to apply tags. `customer[tags]` doesn't work reliably in this form type.

This is documented as a community workaround (March 2024 confirmation on Shopify community forums).

### Why no TipTap visual editor?

Removed in favor of raw HTML editing because:
- TipTap generates HTML **without inline styles** — not suitable for email (Gmail strips `<style>` blocks)
- Email HTML needs inline styles from the start
- Raw HTML editing gives full control over email-safe HTML

### Why no `juice` (CSS inliner)?

Removed because templates are authored with inline styles already. If you want to author with `<style>` blocks and have them auto-inlined, install `juice` and call it in `api.send.tsx` before `sendEmail()`.

---

## File Structure

```
dr-berg-mailer/
├── app/
│   ├── root.tsx                       # HTML shell + globals.css import + anti-FOUC script
│   ├── tailwind.css                    # Tailwind v4 + shadcn theme (HSL CSS variables)
│   ├── shopify.server.ts              # Shopify app config
│   ├── db.server.ts                   # Prisma client
│   ├── mailer.server.ts               # Nodemailer + auto-Ethereal fallback
│   ├── liquid.server.ts               # Liquid renderer (liquidjs)
│   ├── variables.ts                   # Variable list for sidebar UI
│   ├── lib/
│   │   └── utils.ts                   # cn() helper (re-export from cn package)
│   ├── components/
│   │   ├── page-header.tsx            # Shared page header with theme toggle
│   │   ├── theme-toggle.tsx           # Light/dark theme switcher
│   │   ├── variableSidebar.tsx        # Click-to-insert Liquid variables
│   │   └── ui/                        # shadcn/ui components (Base UI variant)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── textarea.tsx
│   │       ├── badge.tsx              # + success/warning variants
│   │       ├── table.tsx
│   │       ├── tabs.tsx               # Base UI Tabs namespace
│   │       └── slot.tsx               # Custom Slot for Button asChild pattern
│   └── routes/
│       ├── _index/                    # Landing redirect (from template)
│       ├── app.tsx                    # App layout (Shopify auth + nav)
│       ├── app._index.tsx             # Dashboard (status + templates grid + webhook URL)
│       ├── app.templates._index.tsx   # Templates list (Table)
│       ├── app.templates.new.tsx      # Create template (HTML + Preview tabs)
│       ├── app.templates.$id.tsx      # Edit template (HTML + Preview + Flow integration + Test send)
│       ├── api.send.tsx               # Public webhook endpoint (x-flow-secret auth)
│       ├── auth.*.tsx                 # Shopify OAuth (from template)
│       └── webhooks.*.tsx             # Shopify mandatory webhooks (app/uninstalled, app/scopes_update)
├── prisma/
│   ├── schema.prisma                  # Session + Template models
│   ├── seed.ts                        # Default templates (back-in-stock, welcome)
│   └── migrations/                    # Auto-generated
├── shopify.app.toml                   # Shopify app config (scopes, webhooks)
├── vite.config.ts                     # Vite + React Router + @tailwindcss/vite
├── tsconfig.json                      # TypeScript + @/* path aliases
├── .env.example                       # All env vars documented
└── package.json
```

### Key files to know

| File | What you change here |
|---|---|
| `app/lib/utils.ts` | `cn()` helper — re-exports from `cn` package |
| `app/variables.ts` | Add new Liquid variables (appears in sidebar) |
| `prisma/schema.prisma` | Database models |
| `prisma/seed.ts` | Default templates |
| `app/mailer.server.ts` | SMTP defaults, fallback logic |
| `app/routes/api.send.tsx` | Webhook auth + payload shape |
| `app/tailwind.css` | Theme colors, dark mode |
| `shopify.app.toml` | Shopify scopes, webhook subscriptions |

---

## License

MIT — see `LICENSE.md`