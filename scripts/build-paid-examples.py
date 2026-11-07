# Build src/paid-examples.json: realistic PAID-response shapes for big hitters (buyer sheet /buy/*, 402 body expected_response).
# Source data: local runs of src/uk-company.ts + src/kyb.ts + src/uk-dd.ts (public CH data for TESCO PLC 00445790, 2026-11-07),
# remapped to the companies_house_api field layout that live paid calls return; arrays trimmed. Sanctions rows from live free preview.
import json, re
uk = json.load(open("/tmp/uk-full.json")); kyb = json.load(open("/tmp/kyb-full.json")); dd = json.load(open("/tmp/more.json"))["dd"]
MON = {m: i + 1 for i, m in enumerate("January February March April May June July August September October November December".split())}
def iso(d):
  m = re.match(r"(\d{1,2}) (\w+) (\d{4})", d or "")
  if not m: return d
  mo = MON.get(m.group(2)) or MON.get(next((k for k in MON if k.startswith(m.group(2))), ""), 0)
  return f"{m.group(3)}-{mo:02d}-{int(m.group(1)):02d}"
p = uk["profile"]; ro = p["registered_office"]
CH = "https://api.company-information.service.gov.uk/company/00445790"
officers = [{"name": o["name"], "role": o["role"].lower(), "appointed_on": iso(o["appointed_on"]), "resigned_on": None, "nationality": o["nationality"], "country_of_residence": "United Kingdom" if o["nationality"] == "British" else None, "occupation": None, "address": o["address"]} for o in uk["officers"]["items"][:3]]
filings = [{"date": iso(f["date"]), "type": f["type"], "category": "capital", "description": f["description"][:120], "action_date": None} for f in uk["filing_history_highlights"]["items"][:2]]
ukc = {
  "ok": True, "mode": "companies_house_api", "company_number": "00445790",
  "profile": {"name": "TESCO PLC", "number": "00445790", "status": "active", "status_detail": None, "type": "plc",
    "incorporation_date": "1947-11-27", "dissolution_date": None, "jurisdiction": "england-wales", "sic_codes": ["47110"],
    "registered_office": {"address_line_1": "Tesco House, Shire Park", "address_line_2": "Kestrel Way", "locality": "Welwyn Garden City", "country": "United Kingdom", "postal_code": "AL7 1GA"},
    "registered_office_text": uk["profile"]["registered_office_text"],
    "accounts": {"accounting_reference_date": {"day": "26", "month": "02"}, "last_accounts": {"made_up_to": "2026-02-28", "type": "group"}, "next_due": "2027-08-26", "overdue": False},
    "confirmation_statement": {"overdue": False}, "has_been_liquidated": False, "has_insolvency_history": False, "has_charges": True,
    "previous_company_names": [{"name": "TESCO STORES (HOLDINGS) PUBLIC LIMITED COMPANY", "ceased_on": "1983-08-25"}], "source": CH},
  "officers": {"active_count": uk["officers"]["total_results"], "resigned_count": None, "total_results": 74, "items": officers, "source": CH + "/officers?items_per_page=50"},
  "persons_with_significant_control": {"available": False, "persons": [], "reason": "likely exempt (e.g. listed/public company with no PSC resource items)", "source": CH + "/persons-with-significant-control?items_per_page=50"},
  "filing_history_highlights": {"items": filings, "source": CH + "/filing-history?items_per_page=25"},
  "charges": {"total_count": 9, "outstanding": 2, "satisfied": 7, "part_satisfied": 0, "items": [{"status": "outstanding", "created_on": "<date>", "delivered_on": "<date>", "classification": "<charge type>", "persons_entitled": ["<lender>"]}], "source": CH + "/charges"},
  "insolvency": {"cases": [], "has_insolvency_history": False, "note": "no insolvency resource", "source": CH + "/insolvency"},
  "compliance": {"accounts_overdue": False, "confirmation_statement_overdue": False},
  "mass_formation_office": uk["mass_formation_office"],
  "red_flags": uk["red_flags"],
  "sources": {"profile": CH, "web": "https://find-and-update.company-information.service.gov.uk/company/00445790"},
  "queried_at": "2026-11-07T11:00:00.000Z", "search": None, "cache": "MISS",
}
NOTE = "Shape of a real paid response for TESCO PLC (00445790), captured 2026-11-07 from Companies House public data; arrays trimmed to 2-3 items; values in <angle brackets> vary per company."
sanc = {"skipped": False, "disclaimer": kyb["sanctions"]["disclaimer"], "possible_match": False, "highest_score": 0,
  "screened": [{"role": "entity", "name": "TESCO PLC", "possible_match": False, "highest_score": 0, "matches": []},
               {"role": "director", "name": "BETHELL, Melissa", "possible_match": False, "highest_score": 0, "matches": []},
               {"role": "director", "name": "BODSON, Bertrand Jean Francois", "possible_match": False, "highest_score": 0, "matches": []}]}
k = dict(kyb); k["uk"] = {kk: ukc[kk] for kk in ("ok", "mode", "company_number", "profile", "officers", "charges", "compliance", "mass_formation_office", "red_flags", "sources")}
k["uk"]["officers"] = dict(ukc["officers"], items=officers[:2])
k["inputs"] = {kk: v for kk, v in kyb["inputs"].items() if v} | {"domain": "tesco.com"}
k["sanctions"] = sanc
k["website"] = {"domain": "tesco.com", "homepage": {"url": "https://www.tesco.com/", "status": 200, "title": "<homepage title>"}, "tech_stack": {"detected": ["<e.g. Akamai>", "<e.g. React>"]}, "dns": {"mx": ["<mx hosts>"], "spf": ["v=spf1 ..."], "dmarc_policy": "reject", "email_provider": "<provider>"}, "domain_registration": dd["domain"] and {x: dd["domain"].get(x) for x in ("registrar", "registered", "expires", "age_days")}, "note": "full company research block (key pages, contacts, socials, SSL, sitemap, news) trimmed here"}
k["directors_appointments"] = [{"director": "BETHELL, Melissa", "best_match": "<CH officer name>", "active_appointments": "<int>", "appointments_total": "<int>", "flags": [], "note": "best name match on CH officer search; confirm DOB"}]
k["trust"] = {"flag": "CAUTION", "score": 52, "reasons": ["UK company status active", "outstanding registered charges (secured lending; common for established companies)", "website research completed"], "checks_completed": 2}
k["sources"] = {"uk_companies_house": ukc["sources"], "sanctions_lists": True, "website": True}
for z in ("notes",): k.pop(z, None)
d = dict(dd); d["uk"] = k["uk"]; d["sanctions"] = sanc; d.pop("notes", None)
d["website"] = {"domain": "tesco.com", "homepage": {"title": "<homepage title>", "url": "https://www.tesco.com/", "status": 200}, "tech_stack": ["<e.g. Akamai>"], "contacts": {"email_count": "<int>", "phone_count": "<int>"}, "dns": {"mx_count": "<int>", "email_provider": "<provider>", "spf": True, "dmarc_policy": "reject"}, "domain_registration": k["website"]["domain_registration"]}
d["domain"] = {x: dd["domain"].get(x) for x in ("domain", "registrar", "registered", "expires", "age_days", "status", "flags", "sources")}
out = {"/uk-company": {"_example": NOTE, **ukc}, "/kyb": {"_example": NOTE + " KYB for {domain:'tesco.com',number:'00445790'}.", **k}, "/uk-dd": {"_example": NOTE + " UK DD for {number:'00445790',domain:'tesco.com'}.", **d}}
json.dump(out, open("src/paid-examples.json", "w"), ensure_ascii=False, separators=(",", ":"))
for kk, v in out.items(): print(kk, len(json.dumps(v)))
