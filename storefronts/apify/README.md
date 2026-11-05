# Apify Storefronts (needs owner sign-up)

Publish these Actors to Apify Store after creating an account at https://console.apify.com/sign-up
and completing payout KYC (Apify keeps ~20%).

## Actors prepared
1. `uk-leads` — wraps `https://api.axiomworks.co.uk/uk-leads` (x402 paid upstream; Actor bills Apify users per result).
2. `kyb` — wraps `/kyb`.

## Owner steps
1. Sign up at https://console.apify.com/sign-up (browser).
2. Create Actor from `storefronts/apify/uk-leads` (Apify CLI: `apify create` / push).
3. Enable pay-per-event monetization; price suggestion: **$0.02/company** (lite) and **$0.05/company with directors** — undercuts NewcoSignal monthly while above raw CH.
4. Repeat for `kyb` at **$0.10–0.25 per check**.
5. Tell the assistant the Actor IDs so dashboard-meta listings can be updated.

Do **not** put `.test_wallet_key` or CH keys in Actor input — call the public x402 API with a dedicated low-balance Base wallet funded for COGS, or proxy through a Worker route that uses server-side settlement later.
