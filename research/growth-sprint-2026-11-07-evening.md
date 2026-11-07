# Growth sprint — 2026-11-07 evening (London)

## ~17:50 GMT — Singapore ACRA /sg-company ($0.25), v1.45.0

- **Why:** Singapore is a top high-AI-adoption market; Liam wants expansion weighted to those markets.
- **Source:** data.gov.sg CKAN datastore, ACRA "Entities with UEN" resource `d_3f960c10fed6145404ca7b821f263b87`. Free, no key, official. Licence: Singapore Open Data Licence v1.0 (attributed in every response). Anonymous calls are rate-limited, so 429 maps to a clear 503 error. Timeout is 8s.
- **Behaviour:** an exact UEN filter (normalised to uppercase, spaces stripped, 9-10 alphanumeric ending in a letter). A name lookup tries an exact `entity_name` filter first. If that finds no live entity, it falls back to full-text `q` with punctuation stripped, because data.gov.sg returns 409 "q is invalid" for symbols such as "LTD.". There is a red flag whenever the status is not Registered/Live, and it is high severity for Deregistered/Struck/Cancelled etc.
- **Wiring:** /kyb (`sg`/`uen`), /registry-batch (`sg=`), /company-full soft-attach (.sg TLD / UEN / Singapore keywords), OpenAPI, llms.txt, samples, path alias `/sg-company/{uen}`, MCP `sg_company` + registry_batch `sg`, SDK `sgCompany`, npm MCP package tool. The MCP kyb_report schema now also accepts ie/ee/lv/sg/uen. Before this it silently dropped ie/ee/lv.
- **Shipped:** commits 7492bf4 (feat) + 82afe06 (kyb preview shows IE/EE/LV/SG hits). Worker deploy bc1ffc7d-02de-4007-82a0-93a625ac5f20. npm 1.45.0 published for both packages. Homepage axiomworks.co.uk high-AI line now reads "US, UK, Singapore, Ireland, …" with an /sg-company row (site-proxy deploy 9995fd0f).
- **Verified live:** openapi 1.45.0 includes /sg-company; unpaid GET → 402 with 250000 atomic USDC on Base to PAY_TO; preview → DBS BANK LTD. (196800306E, Registered, Local Company, 1968-07-16, MARINA BOULEVARD 018982); /kyb and /registry-batch 402 OK; registry-batch preview with sg= found DBS; MCP tools/list includes sg_company.
- **Spend:** $0. No paid test.
- **Grow/cut review:** 2026-11-14 (7 days). Count paid /sg-company calls plus /kyb and /registry-batch calls that use sg=.
