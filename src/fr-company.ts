import { UserError } from "./core";

const API = "https://recherche-entreprises.api.gouv.fr/search";
const UA = "AgentReader/1.0 (+https://api.axiomworks.co.uk; French company research via API Recherche d'entreprises)";
const DISCLAIMER =
  "French company profile from the official API Recherche d'entreprises (INSEE / RNE / BODACC open data). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at source before onboarding, contracting, or paying.";

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function pickQuery(input: { siren?: string; siret?: string; name?: string; q?: string }): { q: string; mode: "siren" | "siret" | "name" } {
  const siren = digits(String(input.siren || ""));
  const siret = digits(String(input.siret || ""));
  const name = String(input.name || input.q || "").trim();
  if (siret) {
    if (siret.length !== 14) throw new UserError("siret must be exactly 14 digits", 400);
    return { q: siret, mode: "siret" };
  }
  if (siren) {
    if (siren.length !== 9) throw new UserError("siren must be exactly 9 digits", 400);
    return { q: siren, mode: "siren" };
  }
  if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    return { q: name, mode: "name" };
  }
  throw new UserError("provide siren, siret, or name", 400);
}

function mapDirigeant(d: any) {
  if (!d || typeof d !== "object") return null;
  if (d.type_dirigeant === "personne morale" || d.siren || d.denomination) {
    return {
      type: "legal_entity",
      siren: d.siren || null,
      name: d.denomination || null,
      role: d.qualite || null,
    };
  }
  const nom = [d.prenoms, d.nom].filter(Boolean).join(" ").trim() || d.nom || null;
  return {
    type: "person",
    name: nom,
    role: d.qualite || null,
    birth_year: d.annee_de_naissance || (d.date_de_naissance ? String(d.date_de_naissance).slice(0, 4) : null),
    nationality: d.nationalite || null,
  };
}

function mapSiege(s: any) {
  if (!s || typeof s !== "object") return null;
  return {
    siret: s.siret || null,
    address: s.adresse || null,
    postal_code: s.code_postal || null,
    city: s.libelle_commune || null,
    department: s.departement || null,
    region: s.region || null,
    lat: s.latitude != null ? Number(s.latitude) : null,
    lon: s.longitude != null ? Number(s.longitude) : null,
    activity_code: s.activite_principale || null,
    status: s.etat_administratif || null,
    created: s.date_creation || null,
    closed: s.date_fermeture || null,
  };
}

function redFlags(r: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const etat = String(r.etat_administratif || "").toUpperCase();
  if (etat && etat !== "A") {
    flags.push({
      code: "not_active",
      severity: "high",
      detail: `Administrative status is ${etat} (A=active). Confirm before contracting.`,
    });
  }
  if (r.date_fermeture) {
    flags.push({ code: "closed", severity: "high", detail: `Closure date recorded: ${r.date_fermeture}` });
  }
  const comps = r.complements || {};
  if (comps.est_association) flags.push({ code: "association", severity: "low", detail: "Entity flagged as association" });
  if (comps.est_ess) flags.push({ code: "ess", severity: "low", detail: "Social/solidarity economy (ESS) flag" });
  if (r.opposition_diffusion_commerciale) {
    flags.push({ code: "diffusion_opposition", severity: "medium", detail: "Commercial data diffusion opposition on file" });
  }
  return flags;
}

function slimRecord(r: any, lite = false) {
  const dirigeants = Array.isArray(r.dirigeants) ? r.dirigeants.map(mapDirigeant).filter(Boolean) : [];
  const finances = r.finances && typeof r.finances === "object" ? r.finances : null;
  const out: any = {
    siren: r.siren || null,
    name: r.nom_complet || r.nom_raison_sociale || null,
    legal_name: r.nom_raison_sociale || null,
    sigle: r.sigle || null,
    status: r.etat_administratif || null,
    status_label: r.etat_administratif === "A" ? "active" : r.etat_administratif === "C" ? "ceased" : r.etat_administratif || null,
    created: r.date_creation || null,
    closed: r.date_fermeture || null,
    activity_code: r.activite_principale || null,
    activity_section: r.section_activite_principale || null,
    legal_form: r.nature_juridique || null,
    category: r.categorie_entreprise || null,
    employee_band: r.tranche_effectif_salarie || null,
    establishments: r.nombre_etablissements ?? null,
    establishments_open: r.nombre_etablissements_ouverts ?? null,
    vat_intra: r.tva || null,
    siege: mapSiege(r.siege),
    dirigeants: lite ? dirigeants.slice(0, 2) : dirigeants,
    dirigeants_count: dirigeants.length,
    red_flags: redFlags(r),
    updated: r.date_mise_a_jour || r.date_mise_a_jour_rne || r.date_mise_a_jour_insee || null,
  };
  if (!lite && finances) out.finances = finances;
  if (lite) out.preview_omitted = ["full dirigeants list", "finances", "complements"];
  return out;
}

/** French company lookup via API Recherche d'entreprises (free official open data). */
export async function frCompany(input: { siren?: string; siret?: string; name?: string; q?: string; lite?: boolean; limit?: number }) {
  const { q, mode } = pickQuery(input);
  const lite = !!input.lite;
  const limit = Math.min(Math.max(Number(input.limit) || (mode === "name" ? 5 : 1), 1), 10);
  const url = `${API}?q=${encodeURIComponent(q)}&per_page=${limit}`;
  let data: any;
  try {
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 429) throw new UserError("French company API rate limited — retry shortly", 429);
    if (!r.ok) throw new Error(`recherche-entreprises http ${r.status}`);
    data = await r.json();
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`French company lookup failed: ${e?.message || e}`);
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) {
    throw new UserError(`no French company found for ${mode}=${q}`, 404);
  }

  // Prefer exact SIREN/SIRET hit when identifier search returns multiples
  let chosen = results[0];
  if (mode === "siren") {
    chosen = results.find((x: any) => String(x.siren) === q) || chosen;
  } else if (mode === "siret") {
    chosen =
      results.find((x: any) => String(x.siege?.siret || "") === q) ||
      results.find((x: any) => String(x.siren) === q.slice(0, 9)) ||
      chosen;
  }

  const primary = slimRecord(chosen, lite);
  const matches =
    mode === "name"
      ? results.slice(0, limit).map((r: any) => ({
          siren: r.siren,
          name: r.nom_complet || r.nom_raison_sociale,
          status: r.etat_administratif,
          city: r.siege?.libelle_commune || null,
          activity_code: r.activite_principale || null,
        }))
      : undefined;

  return {
    product: "fr-company",
    price: "$0.25",
    disclaimer: DISCLAIMER,
    query: { mode, q },
    total_results: data?.total_results ?? results.length,
    ...primary,
    ...(matches ? { matches } : {}),
    source: "API Recherche d'entreprises (annuaire-entreprises.data.gouv.fr) — INSEE / RNE open data",
    source_url: url,
    upsell: {
      kyb: { path: "/kyb", price: "$2.50", why: "attach FR registry into one-shot KYB with VAT + LEI + sanctions" },
      eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate FR TVA via VIES (use vat_intra or FR+SIREN)" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity / dirigeants names" },
      siren_offline: { path: "/siren", price: "$0.001", why: "offline SIREN Luhn only (unlisted micro)" },
    },
  };
}

export function frCompanySlim(d: any) {
  return {
    siren: d.siren,
    name: d.name,
    status: d.status,
    status_label: d.status_label,
    city: d.siege?.city || null,
    activity_code: d.activity_code,
    dirigeants_count: d.dirigeants_count,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["full dirigeants", "finances", "siege detail", "matches"],
  };
}
