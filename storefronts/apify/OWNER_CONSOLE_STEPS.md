# Apify Store — owner Console steps (cannot be done via API)

Account: `ultramarine_gusto` · email `info@axiomworks.co.uk` · Free plan  
All 7 Actors are built, tested SUCCEEDED, SEO/title/categories set via API.  
Blocked on API with:
- `username-required` — need **public profile** before `isPublic: true`
- `cannot-monetize-without-payout-billing-info` — need **billing + payout** before PPE

Do these once at account level, then publish each Actor.

---

## A. Make profile public (required to publish ANY Actor)

1. Open https://console.apify.com/settings/account  
   (or avatar → Settings → Account / Public profile)
2. Confirm username is `ultramarine_gusto`
3. Enable **Make profile publicly available**
4. Optional: set display name to **Axiom Works**, bio e.g.  
   `Structured public-data Actors for KYB, UK company leads, SEC, VAT and AI agents.`
5. Save. Wait ~1–2 minutes for profile to propagate:  
   https://apify.com/ultramarine_gusto

## B. Accept Store Publishing Terms

1. Open any Actor → **Publishing** tab, e.g.  
   https://console.apify.com/actors/fYu5LY6QWDOcH6Pz0/publication
2. Accept **Apify Store Publishing Terms and Conditions** when prompted  
   (https://docs.apify.com/legal/store-publishing-terms-and-conditions)

## C. Billing details + payout method (required for PPE monetization)

1. From any Actor Publishing → Monetization → **Billing details and payment method setup**  
   or https://console.apify.com/organization → **Insights → Payouts**
2. Fill **beneficiary / billing details** (Axiom Works / your legal entity, UK address, VAT if applicable)
3. Choose payout method (PayPal ≥$20 min, or bank ≥$100 min)
4. Save

## D. Identity / KYC verification (required because several Actors use FULL_PERMISSIONS + for payouts)

Actors needing FULL_PERMISSIONS (read named KVS `axiom-secrets` for CH/Charity keys):
- uk-company-dd
- uk-new-company-leads
- agent-kyb-check
- uk-charity-check

Apify requires identity verification to publish FULL_PERMISSIONS Actors and to receive payouts.

1. Console → Development → **Insights → Payouts** → **Verify identity**
2. Complete KYC (gov ID, proof of address, UBO if company)

Until KYC is done you can still publish LIMITED Actors (us-sec-edgar-snapshot, eu-vat-vies-check, web-to-markdown) after A+B.

## E. Per-Actor: set PPE + Publish on Store

For each Actor below, open the **publication** URL → Monetization → **Pay per event**:

| Store name | Console publication | Primary event | Price USD | Optional start fee |
|---|---|---|---|---|
| uk-company-dd | https://console.apify.com/actors/fYu5LY6QWDOcH6Pz0/publication | `company-report` | **0.025** | `apify-actor-start` 0.001 |
| uk-new-company-leads | https://console.apify.com/actors/7EGoag8Dqp6h2Vac7/publication | `company-lead` | **0.040** | 0.001 |
| agent-kyb-check | https://console.apify.com/actors/MQ47ap9c6oxBOvj3u/publication | `kyb-check` | **0.120** | 0.001 |
| us-sec-edgar-snapshot | https://console.apify.com/actors/pH8pufdY36jIPgMDq/publication | `sec-snapshot` | **0.030** | 0.001 |
| eu-vat-vies-check | https://console.apify.com/actors/OW9lltL6cVgkY6adF/publication | `vat-check` | **0.010** | 0.001 |
| uk-charity-check | https://console.apify.com/actors/U5SXH0NdSJYbd4wcE/publication | `charity-check` | **0.030** | 0.001 |
| web-to-markdown | https://console.apify.com/actors/LuMtxOYvNwMjjPi1S/publication | `page-markdown` | **0.005** | 0.001 |

Event titles/descriptions are already in each Actor’s `MONETIZATION.md`.  
Mark primary event = the named event above.  
Then complete Display information (logo optional — titles/descriptions/SEO already set via API), Sample output (auto from last success run), and click **Publish on Store**.

Verify: https://apify.com/ultramarine_gusto/<actor-name> loads in a private window.

## F. Secrets already on platform (no action unless rotated)

Named Key-Value Store **`axiom-secrets`** (id `BSactKpUaHhmjLMR6`) holds:
- `CH_API_KEY` — used by uk-company-dd, uk-new-company-leads, agent-kyb-check
- `CHARITY_KEY` — used by uk-charity-check

Do **not** put these in Actor env as plaintext in the Store listing. Actors load via KVS at runtime with FULL_PERMISSIONS.

## G. After you finish A–E

Ping the agent / re-run publish: we will set `isPublic: true` + `pricingInfos` via API if still needed, update dashboard Store URLs, and smoke-test a paid Store run.

Profit model reminder: creator gets ~80% of PPE revenue minus platform compute for those runs. Prices above are set for positive EV vs free registry APIs + Apify CU.
