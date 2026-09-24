# AutoTube AI — Phase 4: Stripe Payments & Subscription Gating

## New files

**Frontend (`autotube-ai-frontend`):**
```
app/api/stripe/checkout/route.ts   # creates a Checkout Session
app/api/stripe/webhook/route.ts    # verifies + processes Stripe events (source of truth)
app/api/stripe/portal/route.ts     # billing portal (manage/cancel subscription)
app/pricing/page.tsx               # public pricing page
components/PricingSection.tsx      # monthly/yearly toggle + both tier cards
components/PricingCard.tsx
components/UpgradePrompt.tsx       # shown to Free users on the Automation page
lib/stripe/client.ts               # Stripe SDK instance + price ID map
lib/subscription.ts                # getSubscriptionStatus() — the "is this user Pro" check
lib/supabase/admin.ts              # service-role client, webhook-only
```
`app/dashboard/automation/page.tsx` was also updated: Free-tier users now see `UpgradePrompt`
instead of the automation form.

**Backend (`autotube-ai`):**
```
app/db.py    # added is_pro_user(user_id) — the real enforcement point
app/agent.py # run_schedule() now calls is_pro_user() before doing any work
```

No new SQL — Phase 1's `subscriptions` table (`status`, `stripe_customer_id`,
`stripe_subscription_id`, `price_id`, `current_period_end`) and `profiles.tier` already have
everything this phase needs.

## Why gating lives in the Python agent, not just the frontend

The Automation page hiding the form from Free users is a UX nicety — it is **not** what
actually stops an automation from running. A schedule row can exist and still be `is_active`
even after a subscription lapses (failed payment, cancellation), because nothing automatically
deletes it. `agent.py`'s `run_schedule()` now calls `db.is_pro_user(user_id)` fresh, every single
time it runs, before generating a script, rendering, or uploading anything. If the check fails,
the schedule's `next_run_at` still advances (so it doesn't spin-retry every poll interval) but
no video is created and nothing is uploaded. That's the real gate.

## 1. Create your Stripe account + products

1. Go to the [Stripe Dashboard](https://dashboard.stripe.com/) (use **Test mode**, top-right toggle, for everything below).
2. **Products → Add product** → name it "AutoTube AI Pro."
3. Add two prices on that product:
   - Recurring, **Monthly**, e.g. $29.00
   - Recurring, **Yearly**, e.g. $290.00
4. Copy both **Price IDs** (they look like `price_1Pxxxxx...`) — these go in `.env.local` as
   `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY`.

## 2. Get your API keys

**Developers → API keys** → copy the **Secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY`.
Never expose this to the browser — it's only used in `lib/stripe/client.ts`, which is
server-only code.

## 3. Get your Supabase service role key

**Supabase Dashboard → Settings → API** → copy the **service_role** key into
`SUPABASE_SERVICE_ROLE_KEY` in the frontend's `.env.local`. This is what lets the webhook
handler write subscription status without a logged-in user session. Treat it like a password —
it bypasses every RLS policy from Phase 1.

## 4. Set up the webhook — local testing

Stripe needs to reach your webhook endpoint. Locally, that means the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# macOS
brew install stripe/stripe-cli/stripe

# then log in
stripe login

# forward events to your local dev server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The `stripe listen` command prints a webhook signing secret (`whsec_...`) — copy that into
`STRIPE_WEBHOOK_SECRET` in `.env.local`. **This local secret is different from the one you'll
get in production** (step 6) — the CLI generates its own for forwarded events.

Keep `stripe listen` running in its own terminal alongside `npm run dev`.

## 5. Test the full checkout flow

```bash
npm run dev
```

1. Log in, visit `/pricing`, click **Upgrade to Pro**.
2. You'll land on Stripe's hosted Checkout. Use a [Stripe test card](https://stripe.com/docs/testing):
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
3. On success you're redirected to `/dashboard?checkout=success`.
4. Check your terminal running `stripe listen` — you should see `checkout.session.completed` fire
   and get a `200` response from your webhook route.
5. Check Supabase → Table Editor → `subscriptions`: a row should now exist with
   `status = 'active'` and your Stripe customer/subscription IDs. Check `profiles.tier` — it
   should now read `'pro'`.
6. Visit `/dashboard/automation` — you should now see the automation form instead of the
   upgrade prompt.

You can also trigger individual events without going through Checkout, useful for testing
cancellation/failure handling in isolation:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

## 6. Set up the webhook — production

1. **Developers → Webhooks → Add endpoint** in the Stripe Dashboard.
2. Endpoint URL: `https://your-production-domain.com/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Stripe shows you a **Signing secret** (`whsec_...`) for this endpoint specifically — put that
   in your production environment's `STRIPE_WEBHOOK_SECRET` (not the CLI one from step 4).
5. Switch all your Stripe keys from test mode to live mode when you're ready to charge real
   cards — live and test keys/webhooks are entirely separate.

## 7. Confirm the backend gate works end to end

1. With a Pro subscription active (from step 5), create an automation schedule and either wait
   for the scheduler or hit `POST /schedules/{id}/run` (Phase 2) — it should run normally.
2. In Stripe, cancel that test subscription (Dashboard → Customers → find them → Cancel
   subscription), or run `stripe trigger customer.subscription.deleted`.
3. Confirm in Supabase that `subscriptions.status` flipped to `canceled` and `profiles.tier`
   flipped to `free`.
4. Trigger the same schedule again — `run_schedule()` should now return
   `{"skipped": true, "reason": "not_pro", ...}` and no video record should be created. Check
   your backend logs to confirm.

## What's intentionally deferred

- **Free-tier usage caps** (e.g. "1 manual video per week") — the schema/gating here is a hard
  Pro/Free line for automation; metered limits on the Free tier are a natural next addition to
  `is_pro_user`'s caller in `agent.py` if you want them.
- **Proration / plan-switch UI** — the billing portal (`/api/stripe/portal`) already lets users
  switch monthly ↔ yearly and cancel without any custom UI, since that's what Stripe's hosted
  portal is for.
- **Dunning emails / in-app past_due banners** — `invoice.payment_failed` is captured in
  `subscriptions.status`, but nothing currently surfaces that to the user in the dashboard UI.

---

That's all four phases: database, backend agent, frontend dashboard, and billing. From here,
natural next steps are usage limits on the Free tier, deploying both projects (Vercel for the
frontend, a container/VM with a process manager for the always-on Python scheduler), and
encrypting the OAuth tokens at rest as flagged back in Phase 1.
