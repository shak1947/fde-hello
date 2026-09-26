/* Sensationally OT product dossier — pure logic, no DOM.
   Rubric math is the original scorecard: weighted average, half-up to
   two decimals, GO >= 4.20, Conditional 3.40–4.19, Pass below 3.40.
   N/A, Hide, and weight 0 stay out of both sums. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DossierLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var STORAGE_KEY = "shak-sot-amazon-dossiers-v1";
  var LEGACY_KEY = "shak-sot-amazon-evals-v1";

  var DEFAULTS = [
    { id: "repeat", name: "Repeat purchase / repurchase cycle", short: "Repeat", weight: 5, inverse: false, core: true,
      why: "High when it is a consumable, refill, or habit people buy again inside about 12 months (sooner is better). Low when it is a one-and-done durable with nothing to replenish. 5 = a clear repurchase story under 6 months. 3 = about 12 months. 1 = no repurchase story." },
    { id: "gift", name: "Gift / buy-for-others", short: "Gift", weight: 5, inverse: false, core: true,
      why: "High when it is a natural gift: parent for child, hostess, teacher, wedding, or a sensory gift kit — bought for someone else. Low when it is only personal utility. People spend more when they buy for others." },
    { id: "size", name: "Size / weight (inverse)", short: "Size", weight: 4, inverse: true, core: true,
      why: "Inverse: a high score is the favorable case. 5 = compact and light, small poly or mailer class, easier FBA and lower inbound cost. 1 = bulky, heavy, or dimensional-weight pain." },
    { id: "repack", name: "Repack ease for resale", short: "Repack", weight: 4, inverse: false, core: true,
      why: "High when you can rebrand or repack it into a private-label unit or kit without destroying the product. Low when packaging is sealed and complex, glass is fragile, or multipacks break apart." },
    { id: "moat", name: "China exclusivity / custom moat", short: "Moat", weight: 5, inverse: false, core: true,
      why: "High when a custom mold, formula, print, kit assembly, brand, or tool keeps the supplier from handing the same item to every seller. Low when it is a commodity anyone can reorder tomorrow. 5 = exclusive or custom MOQ, or IP-like differentiation. 1 = identical listing flood risk." },
    { id: "reviews", name: "Review velocity / social proof trend", short: "Reviews", weight: 3, inverse: false, core: false,
      why: "Your read of whether reviews and social proof are building. High when recent proof is accumulating. Low when the trail looks stalled or empty. Judgment after you view the listing — this page does not pull review data." },
    { id: "competition", name: "Competition density / brand strength on search", short: "Compete", weight: 3, inverse: false, core: false,
      why: "Lower competition scores higher. 5 = page one looks sparse or the brands look weak. 1 = entrenched brands own the search. Judge it from the results you looked at." },
    { id: "margin", name: "Margin headroom after FBA + ads", short: "Margin", weight: 4, inverse: false, core: false,
      why: "Room left after FBA fees and ads, from your own estimate. 5 = comfortable headroom. 1 = fees and ads likely eat the offer. The China section suggests this score from Sellerboard net when that field is filled, otherwise from the landed-cost estimate." },
    { id: "returns", name: "Returns / damage risk (inverse)", short: "Returns", weight: 3, inverse: true, core: false,
      why: "Inverse: 5 = low return and damage risk. 1 = fragile, messy, or a high-return category." },
    { id: "season", name: "Seasonality risk (inverse)", short: "Season", weight: 2, inverse: true, core: false,
      why: "Inverse: year-round demand scores higher unless the seasonal peak is huge. 5 = steady all year. 1 = a narrow season with a weak peak. Note a huge peak in the criterion notes if you are still scoring it up." },
    { id: "sensory", name: "Sensory / OT / kids-adjacent fit", short: "OT fit", weight: 3, inverse: false, core: false,
      why: "Fit for the Sensationally OT brand: sensory, occupational therapy, or kids-adjacent. 5 = obvious fit. 1 = off-brand." },
    { id: "channel", name: "Cross-channel potential", short: "Channels", weight: 2, inverse: false, core: false,
      why: "Can the same offer travel across Amazon, Walmart, and Shopify? 5 = strong cross-channel potential. 1 = structured for a single marketplace only." }
  ];

  var MOAT_ITEMS = [
    { id: "brand", name: "Brand / IP", short: "Brand",
      hint: "5 = a name, mark, or design you can defend and that buyers can search. 1 = a generic title anyone can list tomorrow." },
    { id: "custom", name: "Customization / kit complexity", short: "Kit",
      hint: "5 = mold, print, formula, or a multi-part kit that is not one catalog SKU. 1 = a single open-catalog commodity." },
    { id: "exclusive", name: "Supplier exclusivity", short: "Excl.",
      hint: "5 = tooling, contract, or an MOQ the factory will not resell as-is. 1 = the same factory sells this to every Amazon seller." },
    { id: "reviews", name: "Review velocity to catch leaders", short: "Catch-up",
      hint: "5 = you can compete without matching leader review counts. 1 = the only path is a long review catch-up against entrenched listings." },
    { id: "tacos", name: "Ad spend / TACOS pressure", short: "TACOS",
      hint: "5 = the offer can convert with light ads or brand search. 1 = the category only moves with heavy PPC." },
    { id: "copy", name: "China copy risk", short: "Copy",
      hint: "5 = low risk the supplier hands the same unit to other sellers. 1 = expect the same item on many listings next quarter." },
    { id: "regulatory", name: "Regulatory / safety (kids, OT)", short: "Safety",
      hint: "5 = compliance you can document without blocking the launch. 1 = a kids-product, chemical, or safety issue that can stop the listing." },
    { id: "capital", name: "Capital tied in inventory", short: "Capital",
      hint: "5 = modest MOQ, fast turns, light cash. 1 = deep inventory or a long sea lead time locks serious capital." }
  ];

  var LINKED_CRITERIA = { moat: "moat", competition: "competition", margin: "margin" };

  var SAMPLE_SCORE = {
    repeat: 5, gift: 5, size: 5, repack: 5, moat: 4, reviews: 3,
    competition: 3, margin: 4, returns: 4, season: 3, sensory: 5, channel: 4
  };

  /* Locked 2026-09-26 from Pricing & Inventory / Listings / Shopify / Sellerboard.
     China EXW/FOB vs freight is not in this snapshot. $13.50 and $14.00 are all-in
     Products Cost. Do not split them. Referral 15% is a planning rate, not a
     measured slice of the blended fees. */
  var BASELINES = {
    asOf: "2026-09-26",
    source: "Pricing & Inventory / Listings / Shopify / Sellerboard",
    mermaid: {
      id: "baseline-mermaid-dough",
      productName: "Mermaid dough kit",
      asin: "B0CFT7YF1L",
      sku: "KIT-MERMAID",
      price: 39.95,
      listPrice: null,
      productsCost: 13.5,
      amazonFeesBlended: 14.12,
      reportedNet: 8.9,
      trackerFba: null
    },
    farm: {
      id: "baseline-farm-dough",
      productName: "Farm dough",
      asin: "B0GCTV28TN",
      sku: "35-ZREI-MJZW",
      price: 39.95,
      listPrice: 49.95,
      productsCost: 14,
      amazonFeesBlended: 18,
      reportedNet: -3.77,
      trackerFba: 7.55
    }
  };

  /* Oct 2023 Greatwall invoice SENSORY KITGW20231012.
     Kit EXW covers Mermaid and Unicorn. Farm uses the same architecture.
     10.65 + 4.24 + 0.35 = 15.24 before duty. Duty is not entered: 3407.00.20
     is often 0% MFN, and that rate is not a confirmed fact. */
  var GREATWALL = {
    invoice: "SENSORY KITGW20231012",
    asOf: "2023-10",
    source: "Greatwall invoice",
    exw: 10.65,
    seaFreight: 4.24,
    alibabaFee: 0.35,
    beforeDuty: 15.24,
    hts: "3407.00.20"
  };

  /* Planning fee model for a 3.3 lb Large Standard at $39.95.
     Referral is 15% of that price, about $5.99. Not the Sep 2026 blended fees. */
  var FEE_MODEL = {
    sizeTier: "Large Standard",
    weightLb: 3.3,
    lengthIn: 13.39,
    widthIn: 8.47,
    heightIn: 2.76,
    price: 39.95,
    referralPct: 15,
    referral: 5.99,
    fba: 7.38,
    combined: 13.37
  };

  /* COGS Tracker (Drive), 2026-07-22. Use when Amazon Fee Preview is not live.
     Mermaid is modeled at the live $39.95. Farm's tracker row is modeled at
     $35.95 with 0 units; the sample sell price stays $39.95 and referral is
     scaled to 15% of that price. Inbound placement is $0. There is no AWD export.
     June 2025 Inventory figures are older and are not the current COGS. */
  var COGS_TRACKER = {
    asOf: "2026-07-22",
    source: "COGS Tracker (Drive)",
    inboundPlacement: 0,
    awdExport: false,
    mermaid: {
      price: 39.95,
      cogs: 13.5,
      profitBeforeAds: 11.69,
      profitBeforeAdsPct: 29.3,
      profitWithCpa: 8.09,
      profitWithCpaPct: 20.2,
      olderAsOf: "2025-06",
      olderSource: "June 2025 Inventory sheet",
      olderCogs: 13.03,
      olderFees: 13.39,
      olderProfit: 11.74
    },
    farm: {
      modeledPrice: 35.95,
      livePrice: 39.95,
      cogs: 14,
      fba: 7.55,
      referralAtModeled: 5.39,
      profitAtModeled: 9.01,
      profitAtModeledPct: 25.1,
      units: 0,
      liveReferral: 5.99
    }
  };

  function cogsTrackerMath() {
    var m = COGS_TRACKER.mermaid;
    var f = COGS_TRACKER.farm;
    return {
      mermaidImpliedFees: roundCents(m.price - m.cogs - m.profitBeforeAds),
      mermaidCpaGap: roundCents(m.profitBeforeAds - m.profitWithCpa),
      farmModeledProfit: roundCents(f.modeledPrice - f.cogs - f.fba - f.referralAtModeled),
      farmLiveBeforeAds: roundCents(f.livePrice - f.cogs - f.fba - f.liveReferral)
    };
  }

  var FICTIONAL_IDS = {
    "sample-pebble-calm-mini": true,
    "sample-calm-bin-kit": true,
    "sample-bulk-rainbow-rice": true
  };

  function uid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function asString(v, max) {
    var s = typeof v === "string" ? v : (v == null ? "" : String(v));
    return s.slice(0, max);
  }

  function numOrNull(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function clampNum(v, min, max) {
    var n = numOrNull(v);
    if (n == null) return null;
    return Math.min(max, Math.max(min, n));
  }

  function clampWeight(w) {
    var n = Math.round(Number(w));
    if (!Number.isFinite(n)) return 0;
    return Math.min(5, Math.max(0, n));
  }

  function clampScore(s) {
    if (s == null || s === "" || s === "na") return null;
    var n = Math.round(Number(s));
    if (!Number.isFinite(n) || n < 1 || n > 5) return null;
    return n;
  }

  function hundredthsOf(num, den) {
    if (!den) return null;
    var scaled = num * 100;
    var q = Math.trunc(scaled / den);
    var rem = scaled % den;
    return rem * 2 >= den ? q + 1 : q;
  }

  function formatHundredths(h) {
    var whole = Math.floor(Math.abs(h) / 100);
    var frac = String(Math.abs(h) % 100).padStart(2, "0");
    return (h < 0 ? "-" : "") + whole + "." + frac;
  }

  function bandFor(h) {
    if (h >= 420) return { id: "go", label: "GO", detail: "Strong GO" };
    if (h >= 340) return { id: "conditional", label: "Conditional", detail: "Conditional" };
    return { id: "pass", label: "Pass", detail: "Pass" };
  }

  function money(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    var sign = n < 0 ? "-" : "";
    var parts = Math.abs(n).toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "$" + parts.join(".");
  }

  function pct(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    return (Math.round(n * 10) / 10).toFixed(1) + "%";
  }

  function formatInt(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    var sign = n < 0 ? "-" : "";
    return sign + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function roundCents(n) {
    return Math.round(n * 100) / 100;
  }

  function listingHref(value) {
    var v = String(value || "").trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[A-Za-z0-9]{10}$/.test(v)) return "https://www.amazon.com/dp/" + v.toUpperCase();
    return "";
  }

  function blankCriteria() {
    return DEFAULTS.map(function (d) {
      return {
        id: d.id, name: d.name, short: d.short, why: d.why, weight: d.weight,
        score: null, notes: "", inverse: d.inverse, core: d.core, custom: false, hidden: false
      };
    });
  }

  function criteriaFromScores(scoreMap, noteMap) {
    var criteria = blankCriteria();
    for (var i = 0; i < criteria.length; i++) {
      var c = criteria[i];
      if (scoreMap && Object.prototype.hasOwnProperty.call(scoreMap, c.id)) c.score = scoreMap[c.id];
      if (noteMap && noteMap[c.id]) c.notes = noteMap[c.id];
    }
    return criteria;
  }

  function blankMoat() {
    var scores = {};
    var notes = {};
    for (var i = 0; i < MOAT_ITEMS.length; i++) {
      scores[MOAT_ITEMS[i].id] = null;
      notes[MOAT_ITEMS[i].id] = "";
    }
    return { scores: scores, notes: notes, barriersForOthers: "", ourPlan: "" };
  }

  function blankChina() {
    return {
      unitCost: null,
      costBasis: "EXW",
      moq: null,
      shippingMode: "sea",
      freightPerUnit: null,
      alibabaFee: null,
      dutyPct: null,
      inboundPlacement: null,
      amazonInbound: null,
      weightLb: null,
      lengthIn: null,
      widthIn: null,
      heightIn: null,
      packaging: null,
      spoilagePct: null,
      productsCost: null,
      amazonFeesBlended: null,
      reportedNet: null,
      referralPct: 15,
      tacosPct: null,
      notes: ""
    };
  }

  function blankOverview() {
    return {
      category: "",
      sku: "",
      price: null,
      listPrice: null,
      bsr: "",
      reviewCount: null,
      rating: null,
      fbaFees: null,
      notes: ""
    };
  }

  function blankMaker() {
    return {
      why: "",
      whitespace: "",
      kitAngle: "",
      giftOtAngle: "",
      priceBandLow: null,
      priceBandHigh: null,
      monthlyUnits: null,
      shareNote: ""
    };
  }

  function blankDossier() {
    var now = new Date().toISOString();
    return {
      id: uid(),
      productName: "",
      asinOrUrl: "",
      date: todayISO(),
      sample: false,
      baseline: false,
      createdAt: now,
      updatedAt: now,
      overview: blankOverview(),
      competitors: [],
      china: blankChina(),
      maker: blankMaker(),
      moat: blankMoat(),
      criteria: blankCriteria()
    };
  }

  function compRow(partial) {
    return {
      id: partial.id || uid(),
      asin: partial.asin || "",
      title: partial.title || "",
      price: partial.price == null ? null : partial.price,
      monthlySales: partial.monthlySales == null ? null : partial.monthlySales,
      monthlyRevenue: partial.monthlyRevenue == null ? null : partial.monthlyRevenue,
      reviews: partial.reviews == null ? null : partial.reviews,
      rating: partial.rating == null ? null : partial.rating,
      bsr: partial.bsr == null ? "" : String(partial.bsr)
    };
  }

  function baselineCriteria(marginScore, marginNote) {
    var scores = { repeat: 4, gift: 4, sensory: 5, margin: marginScore };
    var notes = {
      repeat: "Product-type starter, not a Sellerboard measure. Dough is a consumable; repurchase timing is not in the 2026-09-26 snapshot. Score 4 is the about-a-year middle of this row.",
      gift: "Product-type starter, not a Sellerboard measure. Giftability was not in the snapshot. Score 4 is a placeholder, not a measured gift rate.",
      sensory: "Product-type starter, not a sales measure. This is a Sensationally OT dough product.",
      margin: marginNote
    };
    var criteria = criteriaFromScores(scores, notes);
    var unknown = "Not in the 2026-09-26 Sellerboard snapshot.";
    for (var i = 0; i < criteria.length; i++) {
      if (criteria[i].score == null) criteria[i].notes = unknown;
    }
    return criteria;
  }

  function fillBaselineShell(d, spec) {
    d.id = spec.id;
    d.productName = spec.productName;
    d.asinOrUrl = spec.asin;
    d.date = BASELINES.asOf;
    d.sample = false;
    d.baseline = true;
    d.createdAt = "2026-09-26T15:00:00.000Z";
    d.competitors = [];
    d.overview.sku = spec.sku;
    d.overview.price = spec.price;
    d.overview.listPrice = spec.listPrice;
    d.overview.category = "";
    d.overview.bsr = "";
    d.overview.reviewCount = null;
    d.overview.rating = null;
    d.overview.fbaFees = spec.trackerFba != null ? spec.trackerFba : FEE_MODEL.fba;
    d.china.inboundPlacement = COGS_TRACKER.inboundPlacement;
    d.china.unitCost = GREATWALL.exw;
    d.china.freightPerUnit = GREATWALL.seaFreight;
    d.china.alibabaFee = GREATWALL.alibabaFee;
    d.china.costBasis = "EXW";
    d.china.shippingMode = "sea";
    d.china.dutyPct = null;
    d.china.amazonInbound = null;
    d.china.packaging = null;
    d.china.spoilagePct = null;
    d.china.moq = null;
    d.china.weightLb = FEE_MODEL.weightLb;
    d.china.lengthIn = FEE_MODEL.lengthIn;
    d.china.widthIn = FEE_MODEL.widthIn;
    d.china.heightIn = FEE_MODEL.heightIn;
    d.china.productsCost = spec.productsCost;
    d.china.amazonFeesBlended = spec.amazonFeesBlended;
    d.china.reportedNet = spec.reportedNet;
    d.china.referralPct = 15;
    d.china.tacosPct = null;
    d.maker.monthlyUnits = null;
    d.maker.priceBandLow = null;
    d.maker.priceBandHigh = null;
    d.moat = blankMoat();
    d.moat.barriersForOthers = "Not scored. Competitor review walls, supplier exclusivity, and copy risk are not in the 2026-09-26 cost snapshot.";
  }

  function sampleMermaid() {
    var spec = BASELINES.mermaid;
    var d = blankDossier();
    fillBaselineShell(d, spec);
    d.updatedAt = "2026-09-26T18:00:00.000Z";
    d.overview.notes = "Sellerboard baseline " + BASELINES.asOf + " (" + BASELINES.source + "). Live sell price $39.95. Mode 1 uses Products Cost $13.50. Sep MTD Amazon fees about $14.12 per unit. Sep MTD net about +$8.90 per unit (about 22% of price). Healthy baseline. Fee Preview is not live. COGS Tracker " + COGS_TRACKER.asOf + " models profit $11.69 (29.3%) before ads and $8.09 (20.2%) with CPA. Mode 2 is the Oct 2023 Greatwall invoice " + GREATWALL.invoice + ": kit EXW $10.65 (Mermaid/Unicorn; Farm is the same architecture), sea freight $4.24, Alibaba $0.35, $15.24 before duty. That freight is not added on top of Products Cost. Duty is blank pending HTS confirmation. No BSR, review count, or competitor sales in this snapshot.";
    d.china.notes = "Mode 1 is in use: Sellerboard Products Cost $13.50. Do not add sea freight on top of it. Mode 2 is Greatwall " + GREATWALL.invoice + " (Oct 2023): EXW $10.65 + sea $4.24 + Alibaba $0.35 = $15.24 before duty. Duty stays blank. HTS " + GREATWALL.hts + " is often 0% MFN and is not entered as a rate. AWD/storage is blank — no AWD Drive export. Fee Preview is not live. COGS Tracker " + COGS_TRACKER.asOf + " at the live $39.95: modeled profit $11.69 (29.3%) before ads, $8.09 (20.2%) with CPA, on COGS $13.50. Implied fees are $14.76 (price minus COGS minus profit before ads), not an FBA versus referral split. June 2025 Inventory had older COGS $13.03, fees per unit $13.39, profit $11.74. Inbound placement is $0 in the tracker. Size-tier fee model remains referral about $5.99 + FBA about $7.38. Sep MTD blended fees about $14.12 stay the fees in use. The $13.50 versus $15.24 difference is not reconciled. The gap to reported net is not an ad cost.";
    d.maker.why = "Healthy baseline. Sep 2026 MTD Sellerboard net about +$8.90 per unit on a $39.95 sell price after Products Cost $13.50 and Amazon fees about $14.12. The Greatwall invoice rebuild is a second mode and is not added to that cost.";
    d.maker.shareNote = "Monthly units are not in this snapshot, so annual profit stays blank.";
    d.moat.ourPlan = "Use this listing as the healthy comparison unit: net about +$8.90 per unit. Products Cost $13.50 stays the cost in use. The Oct 2023 invoice waterfall is visible beside it and is not a second freight charge.";
    d.criteria = baselineCriteria(4, "Sep 2026 MTD Sellerboard net +$8.90 on a $39.95 sell price (about 22% of price). Products Cost $13.50 all-in. Amazon fees about $14.12 per unit blended. Score 4 is the 20%+ band on that net. The gap versus price minus cost minus blended fees is not an ad-cost measure.");
    return d;
  }

  function sampleFarm() {
    var spec = BASELINES.farm;
    var d = blankDossier();
    fillBaselineShell(d, spec);
    d.updatedAt = "2026-09-26T17:00:00.000Z";
    d.overview.notes = "Sellerboard baseline " + BASELINES.asOf + " (" + BASELINES.source + "). Live sell price $39.95, compare-at/list $49.95. SKU 35-ZREI-MJZW. Mode 1 uses Products Cost $14.00. Sep MTD Amazon fees about $18 per unit blended. Ads are high; ad dollars are not broken out. Sep MTD net about −$3.77 per unit. Conditional and underwater at current ads and fees. Fee Preview is not live. The COGS Tracker " + COGS_TRACKER.asOf + " row is modeled at $35.95, not this sell price: FBA fulfill $7.55, referral $5.39, profit $9.01 (25.1%), 0 units. Referral at the live $39.95 is about $5.99 (15%). Mode 2 uses the same Oct 2023 Greatwall kit architecture as Mermaid: EXW $10.65, sea freight $4.24, Alibaba $0.35, $15.24 before duty. That freight is not added on top of Products Cost.";
    d.china.notes = "Mode 1 is in use: Sellerboard Products Cost $14.00. Do not add sea freight on top of it. Mode 2 is the same Greatwall " + GREATWALL.invoice + " architecture as Mermaid (Oct 2023): EXW $10.65 + sea $4.24 + Alibaba $0.35 = $15.24 before duty. Duty stays blank. HTS " + GREATWALL.hts + " is often 0% MFN and is not entered as a rate. AWD/storage is blank — no AWD Drive export. Fee Preview is not live. COGS Tracker " + COGS_TRACKER.asOf + " modeled this SKU at $35.95 (not the live $39.95): FBA fulfill $7.55, referral $5.39, profit $9.01 (25.1%), 0 units. Sample sell price stays $39.95. Referral scaled to 15% is about $5.99. FBA fulfill stays $7.55. Inbound placement is $0. Sep MTD blended fees about $18 stay the fees in use. Ads are high only — there is no TACOS dollar. The $14.00 versus $15.24 difference is not reconciled. The gap versus reported net is not an ad-cost measure.";
    d.maker.why = "Underwater at current ads and fees. Sep 2026 MTD Sellerboard net about −$3.77 per unit on a $39.95 sell price (compare-at $49.95) after Products Cost $14.00 and Amazon fees about $18 per unit. A reorder is Conditional until that stack changes. The Greatwall invoice rebuild is not added on top of Products Cost.";
    d.maker.shareNote = "Monthly units are not in this snapshot, so annual profit stays blank.";
    d.moat.ourPlan = "At current ads and fees the unit is underwater (net about −$3.77). Treat a reorder as Conditional until the fee and ad stack changes. Products Cost $14.00 stays the cost in use. The invoice waterfall is the same kit architecture as Mermaid and is not a second freight charge.";
    d.criteria = baselineCriteria(1, "Sep 2026 MTD Sellerboard net −$3.77 on a $39.95 sell price (compare-at $49.95). Products Cost $14.00 all-in. Amazon fees about $18 per unit blended. Ads are high; ad dollars are not broken out. Score 1 because the net is under 6% of price.");
    return d;
  }

  function sampleLibrary() {
    return [sampleMermaid(), sampleFarm()];
  }

  function applySellerboardPreset(dossier, key) {
    var spec = BASELINES[key];
    if (!spec || !dossier || !dossier.china || !dossier.overview) return null;
    dossier.china.productsCost = spec.productsCost;
    dossier.china.amazonFeesBlended = spec.amazonFeesBlended;
    dossier.china.reportedNet = spec.reportedNet;
    if (dossier.overview.price == null) dossier.overview.price = spec.price;
    if (spec.listPrice != null && dossier.overview.listPrice == null) dossier.overview.listPrice = spec.listPrice;
    return spec;
  }

  function applyInvoicePreset(dossier) {
    if (!dossier || !dossier.china || !dossier.overview) return null;
    dossier.china.unitCost = GREATWALL.exw;
    dossier.china.freightPerUnit = GREATWALL.seaFreight;
    dossier.china.alibabaFee = GREATWALL.alibabaFee;
    dossier.china.costBasis = "EXW";
    dossier.china.shippingMode = "sea";
    dossier.china.dutyPct = null;
    dossier.china.weightLb = FEE_MODEL.weightLb;
    dossier.china.lengthIn = FEE_MODEL.lengthIn;
    dossier.china.widthIn = FEE_MODEL.widthIn;
    dossier.china.heightIn = FEE_MODEL.heightIn;
    dossier.overview.fbaFees = FEE_MODEL.fba;
    if (dossier.china.referralPct == null) dossier.china.referralPct = FEE_MODEL.referralPct;
    if (dossier.overview.price == null) dossier.overview.price = FEE_MODEL.price;
    return GREATWALL;
  }

  function patchShippedBaseline(d) {
    if (!d || (d.id !== BASELINES.mermaid.id && d.id !== BASELINES.farm.id)) return false;
    if (!d.china) return false;
    if (!(d.china.unitCost == null && d.china.freightPerUnit == null && d.china.alibabaFee == null)) return false;
    var fresh = d.id === BASELINES.mermaid.id ? sampleMermaid() : sampleFarm();
    d.china.unitCost = fresh.china.unitCost;
    d.china.freightPerUnit = fresh.china.freightPerUnit;
    d.china.alibabaFee = fresh.china.alibabaFee;
    d.china.costBasis = "EXW";
    d.china.shippingMode = "sea";
    d.china.weightLb = fresh.china.weightLb;
    d.china.lengthIn = fresh.china.lengthIn;
    d.china.widthIn = fresh.china.widthIn;
    d.china.heightIn = fresh.china.heightIn;
    if (d.overview && d.overview.fbaFees == null) d.overview.fbaFees = fresh.overview.fbaFees;
    if (d.china.referralPct == null) d.china.referralPct = FEE_MODEL.referralPct;
    var note = d.china.notes || "";
    if (note.indexOf("until an invoice parse") >= 0) {
      d.china.notes = fresh.china.notes;
      if (d.overview) d.overview.notes = fresh.overview.notes;
      if (d.maker) d.maker.why = fresh.maker.why;
      if (d.moat) d.moat.ourPlan = fresh.moat.ourPlan;
    }
    return true;
  }

  function patchCogsTracker(d) {
    if (!d || (d.id !== BASELINES.mermaid.id && d.id !== BASELINES.farm.id)) return false;
    if (!d.china || !d.overview) return false;
    var fresh = d.id === BASELINES.mermaid.id ? sampleMermaid() : sampleFarm();
    var changed = false;
    if (d.china.inboundPlacement == null) {
      d.china.inboundPlacement = COGS_TRACKER.inboundPlacement;
      changed = true;
    }
    if (d.id === BASELINES.farm.id && (d.overview.fbaFees == null || d.overview.fbaFees === FEE_MODEL.fba)) {
      d.overview.fbaFees = COGS_TRACKER.farm.fba;
      changed = true;
    }
    if (d.overview.price == null) {
      d.overview.price = fresh.overview.price;
      changed = true;
    }
    var note = d.china.notes || "";
    if (note.indexOf("COGS Tracker") < 0 && note.indexOf(GREATWALL.invoice) >= 0) {
      d.china.notes = fresh.china.notes;
      d.overview.notes = fresh.overview.notes;
      changed = true;
    }
    return changed;
  }

  function scoreSummary(criteria) {
    var num = 0;
    var den = 0;
    var counted = [];
    var list = Array.isArray(criteria) ? criteria : [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var weight = clampWeight(c.weight);
      var score = clampScore(c.score);
      var include = !c.hidden && weight > 0 && score != null;
      if (include) {
        num += score * weight;
        den += weight;
        counted.push({ id: c.id, name: c.name, short: c.short || c.name, weight: weight, score: score, inverse: !!c.inverse });
      }
    }
    var hundredths = den ? hundredthsOf(num, den) : null;
    var band = hundredths == null ? null : bandFor(hundredths);
    var drags = [];
    if (den > 0) {
      var avg = num / den;
      for (var j = 0; j < counted.length; j++) {
        var row = counted[j];
        if (row.score < avg) {
          drags.push({
            id: row.id, name: row.name, score: row.score, weight: row.weight,
            pull: (avg - row.score) * row.weight / den
          });
        }
      }
      drags.sort(function (a, b) { return b.pull - a.pull; });
    }
    return { num: num, den: den, hundredths: hundredths, band: band, counted: counted, drags: drags };
  }

  function formatPull(pull) {
    if (!(pull > 0)) return "0.00";
    if (pull < 0.005) return "<0.01";
    return pull.toFixed(2);
  }

  function moatAsCriteria(moat) {
    var scores = moat && moat.scores ? moat.scores : {};
    return MOAT_ITEMS.map(function (item) {
      return {
        id: item.id, name: item.name, short: item.short, weight: 1,
        score: clampScore(scores[item.id]), hidden: false, inverse: false
      };
    });
  }

  function moatSummary(moat) {
    return scoreSummary(moatAsCriteria(moat));
  }

  function suggestMoatRubricScore(summary) {
    if (!summary || summary.hundredths == null) return null;
    return clampScore(Math.floor((summary.hundredths + 50) / 100));
  }

  function marginScoreFromPct(pctValue) {
    if (pctValue == null || !Number.isFinite(pctValue)) return null;
    if (pctValue >= 32) return 5;
    if (pctValue >= 20) return 4;
    if (pctValue >= 12) return 3;
    if (pctValue >= 6) return 2;
    return 1;
  }

  function competitorRevenue(row) {
    if (!row) return null;
    if (row.monthlyRevenue != null && Number.isFinite(Number(row.monthlyRevenue))) {
      return roundCents(Number(row.monthlyRevenue));
    }
    if (row.price != null && row.monthlySales != null && Number.isFinite(Number(row.price)) && Number.isFinite(Number(row.monthlySales))) {
      return roundCents(Number(row.price) * Number(row.monthlySales));
    }
    return null;
  }

  function commercialStatus(econ) {
    if (!econ) return null;
    if (econ.reportedNet != null && econ.price != null && econ.price > 0) {
      if (econ.reportedNet < 0) return { id: "underwater", label: "Underwater" };
      if (econ.marginPctUsed >= 20) return { id: "healthy", label: "Healthy" };
      return { id: "thin", label: "Thin" };
    }
    if (econ.afterAds != null && econ.afterAds < 0) return { id: "underwater", label: "Underwater" };
    return null;
  }

  function economics(d) {
    var overview = d && d.overview ? d.overview : {};
    var china = d && d.china ? d.china : {};
    var maker = d && d.maker ? d.maker : {};
    var price = numOrNull(overview.price);
    var fba = numOrNull(overview.fbaFees);
    var unit = numOrNull(china.unitCost);
    var freight = numOrNull(china.freightPerUnit);
    var alibaba = numOrNull(china.alibabaFee);
    var dutyPct = numOrNull(china.dutyPct);
    var placement = numOrNull(china.inboundPlacement);
    var inbound = numOrNull(china.amazonInbound);
    var packaging = numOrNull(china.packaging);
    var spoilagePct = numOrNull(china.spoilagePct);
    var referralPct = numOrNull(china.referralPct);
    var tacosPct = numOrNull(china.tacosPct);
    var productsCost = numOrNull(china.productsCost);
    var blended = numOrNull(china.amazonFeesBlended);
    var reportedNet = numOrNull(china.reportedNet);
    var moq = numOrNull(china.moq);
    var monthlyUnits = numOrNull(maker.monthlyUnits);
    var result = {
      price: price,
      fba: fba,
      unit: unit,
      freight: freight,
      alibaba: alibaba,
      dutyPct: dutyPct,
      inboundPlacement: placement,
      inbound: inbound,
      packaging: packaging,
      spoilagePct: spoilagePct,
      referralPct: referralPct,
      tacosPct: tacosPct,
      productsCost: productsCost,
      amazonFeesBlended: blended,
      reportedNet: reportedNet,
      moq: moq,
      monthlyUnits: monthlyUnits,
      costBasis: china.costBasis === "FOB" ? "FOB" : "EXW",
      shippingMode: china.shippingMode === "air" ? "air" : "sea",
      landed: null,
      customs: null,
      beforeDuty: null,
      duty: null,
      preBuffer: null,
      buildUp: null,
      coreStack: null,
      cogs: null,
      cogsSource: null,
      referral: null,
      referralApplied: false,
      feeStack: null,
      feeSource: null,
      contribution: null,
      contributionPct: null,
      unexplainedGap: null,
      adPerUnit: null,
      afterAds: null,
      afterAdsPct: null,
      cashTied: null,
      breakevenUnits: null,
      breakevenAfterAds: null,
      annualContribution: null,
      annualAfterAds: null,
      monthlyRevenuePlan: null,
      marginBasis: null,
      marginPctUsed: null,
      marginScore: null,
      blanksAsZero: false,
      commercial: null,
      gapVsMermaidCost: null,
      gapVsFarmCost: null,
      componentReferral: null,
      componentFba: null,
      componentFees: null,
      componentFeesPartial: false,
      rebuildContribution: null,
      doubleFreight: false,
      activeMode: null
    };
    var hasBuild = unit != null || freight != null || alibaba != null;
    if (hasBuild) {
      var unitUsed = unit == null ? 0 : unit;
      var freightUsed = freight == null ? 0 : freight;
      var alibabaUsed = alibaba == null ? 0 : alibaba;
      var dutyUsed = dutyPct == null ? 0 : dutyPct;
      var inboundUsed = inbound == null ? 0 : inbound;
      var packUsed = packaging == null ? 0 : packaging;
      var spoilUsed = spoilagePct == null ? 0 : spoilagePct;
      result.blanksAsZero = unit == null || freight == null || alibaba == null || dutyPct == null || inbound == null || packaging == null || spoilagePct == null;
      var customs = unitUsed + freightUsed;
      var beforeDuty = customs + alibabaUsed;
      var duty = beforeDuty * dutyUsed / 100;
      var coreStack = beforeDuty + duty + inboundUsed;
      var preBuffer = coreStack + packUsed;
      var buildUp = preBuffer * (1 + spoilUsed / 100);
      result.customs = customs;
      result.beforeDuty = beforeDuty;
      result.duty = duty;
      result.coreStack = coreStack;
      result.preBuffer = preBuffer;
      result.buildUp = buildUp;
      result.landed = buildUp;
      result.gapVsMermaidCost = buildUp - BASELINES.mermaid.productsCost;
      result.gapVsFarmCost = buildUp - BASELINES.farm.productsCost;
    }
    result.doubleFreight = productsCost != null && hasBuild;
    result.activeMode = productsCost != null ? "sellerboard" : (hasBuild ? "rebuild" : null);
    if (productsCost != null) {
      result.cogs = productsCost;
      result.cogsSource = "sellerboard";
    } else if (hasBuild) {
      result.cogs = result.buildUp;
      result.cogsSource = "buildup";
    }
    if (moq != null && moq > 0 && result.cogs != null) result.cashTied = moq * result.cogs;
    if (price != null && price > 0 && result.cogs != null) {
      if (blended != null) {
        result.feeStack = blended;
        result.feeSource = "blended";
        result.referralApplied = false;
      } else {
        var refPct = referralPct == null ? 0 : referralPct;
        var fbaUsed = fba == null ? 0 : fba;
        var placementUsed = placement == null ? 0 : placement;
        result.referral = price * refPct / 100;
        result.feeStack = result.referral + fbaUsed + placementUsed;
        result.feeSource = "components";
        result.referralApplied = true;
      }
      result.contribution = price - result.cogs - result.feeStack;
      result.contributionPct = result.contribution / price * 100;
      if (result.feeSource === "components" && tacosPct != null) {
        result.adPerUnit = price * tacosPct / 100;
        result.afterAds = result.contribution - result.adPerUnit;
        result.afterAdsPct = result.afterAds / price * 100;
      }
    }
    if (price != null && price > 0) {
      var refPctShown = referralPct == null ? 0 : referralPct;
      var fbaShown = fba == null ? 0 : fba;
      var placementShown = placement == null ? 0 : placement;
      result.componentReferral = roundCents(price * refPctShown / 100);
      result.componentFba = fba;
      result.componentFees = roundCents(result.componentReferral + fbaShown + placementShown);
      result.componentFeesPartial = referralPct == null || fba == null;
      if (result.buildUp != null && fba != null && referralPct != null) {
        result.rebuildContribution = roundCents(price - result.buildUp - result.componentFees);
      }
    }
    if (reportedNet != null && price != null && price > 0) {
      result.marginBasis = "Sellerboard net";
      result.marginPctUsed = reportedNet / price * 100;
      result.marginScore = marginScoreFromPct(result.marginPctUsed);
      if (result.contribution != null) result.unexplainedGap = result.contribution - reportedNet;
    } else if (result.contribution != null) {
      if (tacosPct != null && result.afterAdsPct != null) {
        result.marginBasis = "after TACOS";
        result.marginPctUsed = result.afterAdsPct;
      } else {
        result.marginBasis = "before ads";
        result.marginPctUsed = result.contributionPct;
      }
      result.marginScore = marginScoreFromPct(result.marginPctUsed);
    }
    if (result.cashTied != null && result.contribution != null && result.contribution > 0) {
      result.breakevenUnits = Math.ceil(result.cashTied / result.contribution);
    }
    if (reportedNet == null && result.cashTied != null && result.afterAds != null && result.afterAds > 0) {
      result.breakevenAfterAds = Math.ceil(result.cashTied / result.afterAds);
    }
    var unitProfit = reportedNet != null ? reportedNet : (result.afterAds != null ? result.afterAds : result.contribution);
    if (monthlyUnits != null && monthlyUnits >= 0 && price != null && price > 0) {
      result.monthlyRevenuePlan = monthlyUnits * price;
      if (result.contribution != null) result.annualContribution = monthlyUnits * 12 * result.contribution;
      if (unitProfit != null) result.annualAfterAds = monthlyUnits * 12 * unitProfit;
    }
    result.commercial = commercialStatus(result);
    return result;
  }

  function competitionInsight(competitors) {
    var rows = [];
    var trackedUnits = 0;
    var unitsKnown = false;
    var list = Array.isArray(competitors) ? competitors : [];
    for (var i = 0; i < list.length; i++) {
      var revenue = competitorRevenue(list[i]);
      var sales = numOrNull(list[i].monthlySales);
      if (sales != null) {
        trackedUnits += sales;
        unitsKnown = true;
      }
      if (revenue == null || !(revenue > 0)) continue;
      rows.push({
        row: list[i],
        revenue: revenue,
        reviews: numOrNull(list[i].reviews) || 0
      });
    }
    if (!rows.length) return null;
    var total = 0;
    var top = rows[0];
    var leaderReviews = 0;
    for (var r = 0; r < rows.length; r++) {
      total += rows[r].revenue;
      if (rows[r].revenue > top.revenue) top = rows[r];
      if (rows[r].reviews > leaderReviews) leaderReviews = rows[r].reviews;
    }
    var share = total > 0 ? top.revenue / total : 0;
    var score = 4;
    var reason = "Several sellers, none dominant in this set.";
    if (share >= 0.55 && leaderReviews >= 5000) {
      score = 1;
      reason = "One listing owns more than half of tracked revenue and the review wall is high.";
    } else if (share >= 0.45 && leaderReviews >= 2500) {
      score = 2;
      reason = "A leader holds at least 45% of tracked revenue and already has thousands of reviews.";
    } else if (share >= 0.25 || leaderReviews >= 800 || rows.length >= 4) {
      score = 3;
      reason = "The set is active: real leader share or a real review wall, without a single listing owning the category.";
    } else if (rows.length <= 2) {
      score = 5;
      reason = "Very few tracked sellers and no dominant revenue share.";
    }
    return {
      score: score,
      reason: reason,
      share: share,
      leaderReviews: leaderReviews,
      leaderTitle: top.row.title || top.row.asin || "Leader",
      leaderRevenue: top.revenue,
      trackedRevenue: total,
      trackedUnits: unitsKnown ? trackedUnits : null,
      n: rows.length
    };
  }

  function findCriterion(d, id) {
    var list = d && d.criteria ? d.criteria : [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function scoreText(c) {
    if (!c || c.hidden || clampWeight(c.weight) <= 0 || c.score == null) return "unscored";
    return String(c.score);
  }

  function decisionBrief(d) {
    var rubric = scoreSummary(d.criteria);
    var econ = economics(d);
    var comp = competitionInsight(d.competitors);
    var moat = moatSummary(d.moat);
    var parts = [];
    if (d.baseline) parts.push("Sellerboard baseline dated " + BASELINES.asOf + ". Mode 1 uses Products Cost. The Oct 2023 Greatwall waterfall is on the page and is not added on top of that cost. Competitor rows are empty until a Helium 10 paste.");
    if (d.sample) parts.push("Fictional sample.");
    if (econ.commercial && econ.commercial.id === "healthy") {
      parts.push("Healthy baseline: Sellerboard net " + money(econ.reportedNet) + " per unit (" + pct(econ.marginPctUsed) + " of the sell price).");
    } else if (econ.commercial && econ.commercial.id === "underwater" && econ.reportedNet != null) {
      parts.push("Underwater at current ads and fees: Sellerboard net " + money(econ.reportedNet) + " per unit. Treat a reorder as Conditional until that stack changes.");
    }
    if (rubric.hundredths == null) {
      parts.push("The rubric has no counted scores yet, so there is no GO, Conditional, or Pass.");
    } else {
      var strong = rubric.band.id === "go" ? " (Strong GO)" : "";
      parts.push("Verdict " + rubric.band.label + strong + " at " + formatHundredths(rubric.hundredths) + ".");
    }
    if (d.baseline) parts.push("Repeat, gift, and OT-fit on this baseline are product-type starters, not Sellerboard measures. The measured margin row is the Sellerboard net. Fee Preview is not live, so the COGS Tracker defaults do not replace that net. Competition, reviews, size, repack, and moat are unknown. Duty is blank until the HTS is confirmed.");
    var coreBits = [];
    ["repeat", "gift", "size", "repack", "moat"].forEach(function (id) {
      var c = findCriterion(d, id);
      if (c && !c.hidden && c.score != null && clampWeight(c.weight) > 0) coreBits.push(c.short + " " + c.score);
    });
    if (coreBits.length) parts.push("Shak’s core screen: " + coreBits.join(", ") + ".");
    if (comp) {
      parts.push(comp.leaderTitle + " is about " + Math.round(comp.share * 100) + "% of tracked competitor revenue" + (comp.leaderReviews ? " (" + formatInt(comp.leaderReviews) + " reviews)" : "") + ". The tracked set suggests competition score " + comp.score + "; the rubric says " + scoreText(findCriterion(d, "competition")) + ". The suggestion only sees the rows on this page.");
    } else {
      parts.push("No competitor revenue yet. Add leaders or paste a Helium 10 export before treating competition as known.");
    }
    if (econ.cogs != null && econ.contribution != null) {
      var costLabel = econ.cogsSource === "sellerboard" ? "Sellerboard Products Cost " : "Landed build-up ";
      var feeLabel = econ.feeSource === "blended" ? "Blended Amazon fees " : "Referral plus FBA fulfillment ";
      var marginLine = costLabel + money(econ.cogs) + ". " + feeLabel + money(econ.feeStack) + ". Price minus those is " + money(econ.contribution) + " (" + pct(econ.contributionPct) + ").";
      if (econ.reportedNet != null) {
        marginLine += " Reported net " + money(econ.reportedNet) + " (" + pct(econ.marginPctUsed) + ").";
        if (econ.unexplainedGap != null) marginLine += " Gap " + money(econ.unexplainedGap) + " is not broken out and is not an ad-cost measure.";
      } else if (econ.afterAds != null) {
        marginLine += " After " + pct(econ.tacosPct) + " TACOS " + money(econ.afterAds) + " (" + pct(econ.afterAdsPct) + ").";
      }
      marginLine += " Calculator suggests margin score " + econ.marginScore + " (" + econ.marginBasis + "); the rubric says " + scoreText(findCriterion(d, "margin")) + ".";
      parts.push(marginLine);
    } else if (econ.cogs != null) {
      parts.push((econ.cogsSource === "sellerboard" ? "Sellerboard Products Cost " : "Landed build-up ") + money(econ.cogs) + ". Add a sell price to see contribution.");
    } else if (econ.reportedNet != null) {
      parts.push("Sellerboard net " + money(econ.reportedNet) + ". Products Cost is empty, so contribution is not estimated.");
    } else {
      parts.push("China EXW/FOB, freight, and Sellerboard Products Cost are empty, so unit cost is not estimated yet.");
    }
    if (moat.hundredths != null) {
      parts.push("Barrier index " + formatHundredths(moat.hundredths) + " (" + moat.band.label + "). That rounds to rubric moat score " + suggestMoatRubricScore(moat) + "; entered score is " + scoreText(findCriterion(d, "moat")) + ".");
    }
    if (econ.monthlyUnits != null && econ.annualAfterAds != null) {
      var annualLabel = econ.tacosPct == null ? "annual contribution before ads" : "rough annual profit after the fee stack and the TACOS assumption";
      parts.push("At " + formatInt(econ.monthlyUnits) + " units a month, " + annualLabel + " is " + money(econ.annualAfterAds) + ". Planning figure, not a forecast.");
    }
    return parts.join(" ");
  }

  function executiveSummary(d) {
    var rubric = scoreSummary(d.criteria);
    var econ = economics(d);
    var comp = competitionInsight(d.competitors);
    var moat = moatSummary(d.moat);
    var name = (d.productName || "").trim() || "(untitled product)";
    var lines = [];
    lines.push("# " + name);
    if (rubric.hundredths == null) lines.push("Verdict: not scored");
    else lines.push("Verdict: **" + rubric.band.label + (rubric.band.id === "go" ? " (Strong GO)" : "") + " " + formatHundredths(rubric.hundredths) + "**");
    if (d.baseline) lines.push("Sellerboard baseline " + BASELINES.asOf + ". Real listing. Mode 1 is Products Cost. Mode 2 is the Oct 2023 Greatwall invoice " + GREATWALL.invoice + " and is not added on top of Products Cost. Competitor table is paste-only and starts empty.");
    if (d.sample) lines.push("FICTIONAL SAMPLE. Not a real Amazon listing and not a Helium 10 or Amazon pull.");
    lines.push("");
    lines.push("## Decision");
    lines.push(decisionBrief(d));
    lines.push("");
    lines.push("## Overview");
    lines.push("- ASIN/URL: " + ((d.asinOrUrl || "").trim() || "(none)"));
    lines.push("- SKU: " + ((d.overview.sku || "").trim() || "(none)"));
    lines.push("- Date: " + (d.date || ""));
    lines.push("- Category: " + ((d.overview.category || "").trim() || "(none)"));
    lines.push("- Sell price: " + money(d.overview.price));
    lines.push("- Compare-at / list: " + money(d.overview.listPrice));
    lines.push("- BSR: " + ((d.overview.bsr || "").trim() || "(none)"));
    lines.push("- Reviews / rating: " + (d.overview.reviewCount == null ? "—" : formatInt(d.overview.reviewCount)) + " / " + (d.overview.rating == null ? "—" : String(d.overview.rating)));
    lines.push("- FBA fulfillment (manual): " + money(d.overview.fbaFees));
    if ((d.overview.notes || "").trim()) lines.push("- Notes: " + d.overview.notes.trim());
    lines.push("");
    lines.push("## Competition");
    if (!d.competitors.length) lines.push("No competitor rows.");
    else {
      lines.push("| Competitor | ASIN | Price | Mo. sales | Mo. revenue | Reviews | Rating | BSR |");
      lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
      for (var i = 0; i < d.competitors.length; i++) {
        var row = d.competitors[i];
        lines.push("| " + (row.title || "—").replace(/\|/g, "/") + " | " + (row.asin || "—") + " | " + money(row.price) + " | " + formatInt(row.monthlySales) + " | " + money(competitorRevenue(row)) + " | " + formatInt(row.reviews) + " | " + (row.rating == null ? "—" : String(row.rating)) + " | " + (row.bsr || "—") + " |");
      }
      if (comp) {
        lines.push("");
        lines.push("Tracked monthly revenue " + money(comp.trackedRevenue) + ". Leader share about " + Math.round(comp.share * 100) + "% (" + comp.leaderTitle + "). Suggested competition score: " + comp.score + ". " + comp.reason);
      }
    }
    if (econ.monthlyRevenuePlan != null) {
      lines.push("Our plan: " + formatInt(econ.monthlyUnits) + " units, about " + money(econ.monthlyRevenuePlan) + " a month at the target price. This bar is a plan, not a measured rank.");
    }
    lines.push("");
    lines.push("## China / landed cost (ESTIMATE)");
    lines.push("Two modes. Mode 1 is Sellerboard Products Cost ($13.50 Mermaid / $14.00 Farm) and it wins when that field is filled. Mode 2 rebuilds Greatwall " + GREATWALL.invoice + " (Oct 2023): EXW " + money(GREATWALL.exw) + " + sea freight " + money(GREATWALL.seaFreight) + " + Alibaba " + money(GREATWALL.alibabaFee) + " = " + money(GREATWALL.beforeDuty) + " before duty, then duty, AWD/storage, and the fee model. Do not add Mode 2 freight on top of Products Cost. Duty is blank until HTS " + GREATWALL.hts + " is confirmed. That code is often 0% MFN and is not entered as a rate. Fee model for " + FEE_MODEL.weightLb + " lb " + FEE_MODEL.sizeTier + " at " + money(FEE_MODEL.price) + ": referral about " + money(FEE_MODEL.referral) + " (" + FEE_MODEL.referralPct + "%) + FBA about " + money(FEE_MODEL.fba) + " = about " + money(FEE_MODEL.combined) + ". Dims about " + FEE_MODEL.lengthIn + "×" + FEE_MODEL.widthIn + "×" + FEE_MODEL.heightIn + " in.");
    if (econ.doubleFreight) lines.push("Warning: Products Cost is filled, so invoice freight is not added again.");
    if (econ.productsCost != null) lines.push("- Mode 1 Sellerboard Products Cost (in use): " + money(econ.productsCost));
    if (econ.buildUp != null) {
      lines.push("- Mode 2 " + econ.costBasis + " " + money(econ.unit) + " + " + econ.shippingMode + " freight " + money(econ.freight) + "/unit + Alibaba " + money(econ.alibaba) + " = " + money(econ.beforeDuty) + " before duty. Duty " + money(econ.duty) + " (blank rate counts as $0). AWD/storage " + money(econ.inbound) + ". Rebuild product cost " + money(econ.buildUp) + (econ.activeMode === "sellerboard" ? " (not added to Products Cost)." : "."));
      lines.push("- Rebuild versus Mermaid Products Cost $13.50: " + money(econ.gapVsMermaidCost) + ". Versus Farm Products Cost $14.00: " + money(econ.gapVsFarmCost) + ". Those gaps are not reconciled.");
    } else if (econ.productsCost == null) lines.push("China EXW/FOB, freight, Alibaba, and Sellerboard Products Cost are blank.");
    if (econ.feeSource === "blended") lines.push("- Mode 1 blended Amazon fees " + money(econ.feeStack) + ". Referral " + (econ.referralPct == null ? "(blank)" : pct(econ.referralPct)) + " and FBA fulfillment are not added on top.");
    else if (econ.contribution != null) lines.push("- Referral " + (econ.referralPct == null ? "blank (counted as 0%)" : pct(econ.referralPct)) + " = " + money(econ.referral) + " · FBA fulfillment " + money(econ.fba));
    if (econ.componentFees != null) lines.push("- Fee model on this price: referral " + money(econ.componentReferral) + " + FBA " + money(econ.componentFba) + " = " + money(econ.componentFees) + (econ.feeSource === "blended" ? " (not the fee in use)." : "."));
    if (econ.contribution != null) lines.push("- Contribution before the unexplained gap: " + money(econ.contribution) + " (" + pct(econ.contributionPct) + ")");
    if (econ.reportedNet != null) {
      lines.push("- Sellerboard net: " + money(econ.reportedNet) + " (" + pct(econ.marginPctUsed) + " of price)");
      if (econ.unexplainedGap != null) lines.push("- Gap versus contribution: " + money(econ.unexplainedGap) + ". Not broken out. Do not assign it to ads.");
    } else if (econ.tacosPct != null) lines.push("- After " + pct(econ.tacosPct) + " TACOS: " + money(econ.afterAds) + " (" + pct(econ.afterAdsPct) + ") per unit");
    else if (econ.contribution != null) lines.push("- TACOS not entered, and Sellerboard net is blank, so after-ads profit is not a separate line.");
    if (econ.cashTied != null) lines.push("- MOQ cash at the cost used above: " + money(econ.cashTied));
    if (econ.breakevenUnits != null) lines.push("- Breakeven units at contribution: " + formatInt(econ.breakevenUnits));
    if (econ.breakevenAfterAds != null) lines.push("- Breakeven units after TACOS: " + formatInt(econ.breakevenAfterAds));
    if ((d.china.notes || "").trim()) lines.push("- Notes: " + d.china.notes.trim());
    lines.push("");
    lines.push("## Maker opportunity");
    lines.push("- Why: " + ((d.maker.why || "").trim() || "(empty)"));
    lines.push("- White space: " + ((d.maker.whitespace || "").trim() || "(empty)"));
    lines.push("- Kit / customization: " + ((d.maker.kitAngle || "").trim() || "(empty)"));
    lines.push("- Gift + OT: " + ((d.maker.giftOtAngle || "").trim() || "(empty)"));
    lines.push("- Price band: " + money(d.maker.priceBandLow) + " – " + money(d.maker.priceBandHigh));
    lines.push("- Expected monthly units: " + formatInt(d.maker.monthlyUnits));
    if (comp && comp.trackedUnits && d.maker.monthlyUnits != null && comp.trackedUnits > 0) {
      lines.push("- Share of tracked units: " + pct(d.maker.monthlyUnits / comp.trackedUnits * 100));
    }
    if ((d.maker.shareNote || "").trim()) lines.push("- Share note: " + d.maker.shareNote.trim());
    if (econ.annualContribution != null) lines.push("- Rough annual contribution: " + money(econ.annualContribution));
    if (econ.tacosPct != null && econ.annualAfterAds != null) lines.push("- Rough annual after TACOS: " + money(econ.annualAfterAds));
    lines.push("");
    lines.push("## Moat and barriers");
    if (moat.hundredths == null) lines.push("Barrier index: not scored");
    else lines.push("Barrier index: " + formatHundredths(moat.hundredths) + " (" + moat.band.label + "). Suggested rubric moat score: " + suggestMoatRubricScore(moat) + ".");
    for (var m = 0; m < MOAT_ITEMS.length; m++) {
      var item = MOAT_ITEMS[m];
      var sc = d.moat.scores ? d.moat.scores[item.id] : null;
      var note = d.moat.notes && d.moat.notes[item.id] ? " — " + d.moat.notes[item.id].trim() : "";
      lines.push("- " + item.name + ": " + (sc == null ? "unscored" : sc + "/5") + note);
    }
    lines.push("- Barriers for others: " + ((d.moat.barriersForOthers || "").trim() || "(empty)"));
    lines.push("- Our moat plan: " + ((d.moat.ourPlan || "").trim() || "(empty)"));
    lines.push("");
    lines.push("## Rubric");
    if (rubric.hundredths == null) {
      lines.push("Weighted average: not scored");
    } else {
      lines.push("Weighted average: " + formatHundredths(rubric.hundredths) + " / 5 (" + rubric.num + " ÷ " + rubric.den + ")");
      lines.push("Verdict: " + rubric.band.label + (rubric.band.id === "go" ? " (Strong GO)" : ""));
    }
    lines.push("Bands: 4.20+ GO (Strong GO) | 3.40–4.19 Conditional | below 3.40 Pass");
    for (var k = 0; k < d.criteria.length; k++) {
      var c = d.criteria[k];
      if (c.hidden) { lines.push("- " + c.name + ": hidden — excluded"); continue; }
      if (clampWeight(c.weight) <= 0) { lines.push("- " + c.name + ": weight 0 — excluded"); continue; }
      if (c.score == null) { lines.push("- " + c.name + ": N/A — excluded"); continue; }
      var noteText = c.notes && c.notes.trim() ? " — " + c.notes.trim() : "";
      lines.push("- " + c.name + ": " + c.score + "/5 × weight " + clampWeight(c.weight) + " = " + (c.score * clampWeight(c.weight)) + noteText);
    }
    if (rubric.drags.length) {
      lines.push("Pulling the score down:");
      for (var p = 0; p < rubric.drags.length; p++) {
        var drag = rubric.drags[p];
        lines.push("- " + drag.name + ": " + drag.score + "/5, weight " + drag.weight + ", about " + formatPull(drag.pull) + " points");
      }
    }
    lines.push("");
    lines.push("Human dossier. Helium 10 figures are paste/import only. No live Amazon or Helium 10 API.");
    return lines.join("\n");
  }

  function normalizeCriterion(raw) {
    if (!raw || typeof raw !== "object") return null;
    var name = asString(raw.name, 80).trim();
    if (!name) return null;
    var known = null;
    for (var i = 0; i < DEFAULTS.length; i++) if (DEFAULTS[i].id === raw.id) known = DEFAULTS[i];
    return {
      id: asString(raw.id, 80) || uid(),
      name: name,
      short: asString(raw.short, 16) || (known ? known.short : name.slice(0, 12)),
      why: asString(raw.why, 800) || (known ? known.why : ""),
      weight: clampWeight(raw.weight),
      score: clampScore(raw.score),
      notes: asString(raw.notes, 800),
      inverse: raw.inverse === true || !!(known && known.inverse),
      core: raw.core === true || !!(known && known.core),
      custom: raw.custom === true || !known,
      hidden: raw.hidden === true
    };
  }

  function normalizeCompetitor(raw) {
    if (!raw || typeof raw !== "object") return null;
    var asin = asString(raw.asin, 80).trim();
    var title = asString(raw.title, 180).trim();
    if (!asin && !title) return null;
    return {
      id: asString(raw.id, 80) || uid(),
      asin: asin,
      title: title,
      price: clampNum(raw.price, 0, 100000),
      monthlySales: clampNum(raw.monthlySales, 0, 100000000),
      monthlyRevenue: clampNum(raw.monthlyRevenue, 0, 1000000000),
      reviews: clampNum(raw.reviews, 0, 100000000),
      rating: clampNum(raw.rating, 0, 5),
      bsr: asString(raw.bsr, 80)
    };
  }

  function normalizeDossier(raw) {
    if (!raw || typeof raw !== "object") return null;
    var base = blankDossier();
    var criteriaSource = Array.isArray(raw.criteria) ? raw.criteria : null;
    var criteria = criteriaSource ? criteriaSource.map(normalizeCriterion).filter(Boolean) : blankCriteria();
    if (!criteria.length) criteria = blankCriteria();
    var date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : todayISO();
    var overviewIn = raw.overview && typeof raw.overview === "object" ? raw.overview : {};
    var chinaIn = raw.china && typeof raw.china === "object" ? raw.china : {};
    var makerIn = raw.maker && typeof raw.maker === "object" ? raw.maker : {};
    var moatIn = raw.moat && typeof raw.moat === "object" ? raw.moat : {};
    var moat = blankMoat();
    var scoreIn = moatIn.scores && typeof moatIn.scores === "object" ? moatIn.scores : {};
    var noteIn = moatIn.notes && typeof moatIn.notes === "object" ? moatIn.notes : {};
    for (var i = 0; i < MOAT_ITEMS.length; i++) {
      var id = MOAT_ITEMS[i].id;
      moat.scores[id] = clampScore(scoreIn[id]);
      moat.notes[id] = asString(noteIn[id], 400);
    }
    moat.barriersForOthers = asString(moatIn.barriersForOthers, 2000);
    moat.ourPlan = asString(moatIn.ourPlan, 2000);
    var notes = asString(overviewIn.notes, 2000);
    if (!notes && raw.categoryNotes) notes = asString(raw.categoryNotes, 2000);
    return {
      id: asString(raw.id, 80) || uid(),
      productName: asString(raw.productName, 140),
      asinOrUrl: asString(raw.asinOrUrl, 500),
      date: date,
      sample: raw.sample === true,
      baseline: raw.baseline === true,
      createdAt: asString(raw.createdAt, 40) || base.createdAt,
      updatedAt: asString(raw.updatedAt || raw.savedAt, 40) || base.updatedAt,
      overview: {
        category: asString(overviewIn.category, 200),
        sku: asString(overviewIn.sku, 80),
        price: clampNum(overviewIn.price, 0, 100000),
        listPrice: clampNum(overviewIn.listPrice, 0, 100000),
        bsr: asString(overviewIn.bsr, 80),
        reviewCount: clampNum(overviewIn.reviewCount, 0, 100000000),
        rating: clampNum(overviewIn.rating, 0, 5),
        fbaFees: clampNum(overviewIn.fbaFees, 0, 100000),
        notes: notes
      },
      competitors: (Array.isArray(raw.competitors) ? raw.competitors : []).map(normalizeCompetitor).filter(Boolean).slice(0, 40),
      china: {
        unitCost: clampNum(chinaIn.unitCost, 0, 100000),
        costBasis: chinaIn.costBasis === "FOB" ? "FOB" : "EXW",
        moq: clampNum(chinaIn.moq, 0, 100000000) == null ? null : Math.round(clampNum(chinaIn.moq, 0, 100000000)),
        shippingMode: chinaIn.shippingMode === "air" ? "air" : "sea",
        freightPerUnit: clampNum(chinaIn.freightPerUnit, 0, 100000),
        alibabaFee: clampNum(chinaIn.alibabaFee, 0, 100000),
        dutyPct: clampNum(chinaIn.dutyPct, 0, 100),
        inboundPlacement: clampNum(chinaIn.inboundPlacement, 0, 100000),
        amazonInbound: clampNum(chinaIn.amazonInbound, 0, 100000),
        weightLb: clampNum(chinaIn.weightLb, 0, 1000),
        lengthIn: clampNum(chinaIn.lengthIn, 0, 1000),
        widthIn: clampNum(chinaIn.widthIn, 0, 1000),
        heightIn: clampNum(chinaIn.heightIn, 0, 1000),
        packaging: clampNum(chinaIn.packaging, 0, 100000),
        spoilagePct: clampNum(chinaIn.spoilagePct, 0, 100),
        productsCost: clampNum(chinaIn.productsCost, 0, 100000),
        amazonFeesBlended: clampNum(chinaIn.amazonFeesBlended, 0, 100000),
        reportedNet: clampNum(chinaIn.reportedNet, -100000, 100000),
        referralPct: clampNum(chinaIn.referralPct, 0, 100),
        tacosPct: clampNum(chinaIn.tacosPct, 0, 100),
        notes: asString(chinaIn.notes, 2000)
      },
      maker: {
        why: asString(makerIn.why, 2000),
        whitespace: asString(makerIn.whitespace, 2000),
        kitAngle: asString(makerIn.kitAngle, 2000),
        giftOtAngle: asString(makerIn.giftOtAngle, 2000),
        priceBandLow: clampNum(makerIn.priceBandLow, 0, 100000),
        priceBandHigh: clampNum(makerIn.priceBandHigh, 0, 100000),
        monthlyUnits: clampNum(makerIn.monthlyUnits, 0, 100000000) == null ? null : Math.round(clampNum(makerIn.monthlyUnits, 0, 100000000)),
        shareNote: asString(makerIn.shareNote, 1000)
      },
      moat: moat,
      criteria: criteria
    };
  }

  function isShippedFiction(raw) {
    return !!(raw && raw.sample === true && FICTIONAL_IDS[raw.id]);
  }

  function isUntouchedPebble(raw) {
    return raw && raw.id === "sample-pebble-calm-mini" && raw.sample === true
      && raw.productName === "Pebble Calm Mini — Sensory Worry Stone Set";
  }

  function seedBaselines(dossiers) {
    var replaced = false;
    var kept = [];
    var list = Array.isArray(dossiers) ? dossiers : [];
    for (var i = 0; i < list.length; i++) {
      if (isShippedFiction(list[i])) { replaced = true; continue; }
      kept.push(list[i]);
    }
    var lib = sampleLibrary();
    for (var j = lib.length - 1; j >= 0; j--) {
      var exists = false;
      for (var k = 0; k < kept.length; k++) if (kept[k].id === lib[j].id) exists = true;
      if (!exists) kept.unshift(lib[j]);
    }
    return { dossiers: kept, replaced: replaced };
  }

  function storeFromStorage(rawV2, rawV1) {
    if (rawV2 != null && rawV2 !== "") {
      try {
        var data = JSON.parse(rawV2);
        var dossiers = data && Array.isArray(data.dossiers) ? data.dossiers.map(normalizeDossier).filter(Boolean) : [];
        if (data && data.baselinesSeeded === true) {
          var patched = false;
          if (data.waterfallSeeded !== true) {
            for (var p = 0; p < dossiers.length; p++) {
              if (patchShippedBaseline(dossiers[p])) patched = true;
            }
          }
          if (data.cogsTrackerSeeded !== true) {
            for (var t = 0; t < dossiers.length; t++) {
              if (patchCogsTracker(dossiers[t])) patched = true;
            }
          }
          return { version: 1, dossiers: dossiers, baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, migrated: false, fresh: false, upgraded: patched, replacedFiction: false };
        }
        var seeded = seedBaselines(dossiers);
        return {
          version: 1,
          dossiers: seeded.dossiers,
          baselinesSeeded: true,
          waterfallSeeded: true,
          cogsTrackerSeeded: true,
          migrated: false,
          upgraded: true,
          fresh: false,
          replacedFiction: seeded.replaced
        };
      } catch (err) {
        return { version: 1, dossiers: sampleLibrary(), baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, migrated: false, fresh: true, corrupt: true };
      }
    }
    if (rawV1 != null && rawV1 !== "") {
      try {
        var legacy = JSON.parse(rawV1);
        var evals = legacy && Array.isArray(legacy.evals) ? legacy.evals : [];
        var kept = [];
        var sawPebble = false;
        for (var i = 0; i < evals.length; i++) {
          if (isUntouchedPebble(evals[i]) || isShippedFiction(evals[i])) { sawPebble = true; continue; }
          var d = normalizeDossier(evals[i]);
          if (d) kept.push(d);
        }
        if (!kept.length) {
          return { version: 1, dossiers: sampleLibrary(), baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, migrated: true, fresh: false, replacedSample: sawPebble, replacedFiction: sawPebble };
        }
        return { version: 1, dossiers: kept, baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, migrated: true, fresh: false, replacedFiction: false };
      } catch (err2) {
        return { version: 1, dossiers: sampleLibrary(), baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, migrated: false, fresh: true, corrupt: true };
      }
    }
    return { version: 1, dossiers: sampleLibrary(), baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, migrated: false, fresh: true };
  }

  function duplicateDossier(d) {
    var copy = clone(normalizeDossier(d));
    copy.id = uid();
    copy.sample = false;
    copy.baseline = false;
    var name = (copy.productName || "Untitled").trim() + " copy";
    copy.productName = name.slice(0, 140);
    var now = new Date().toISOString();
    copy.createdAt = now;
    copy.updatedAt = now;
    for (var i = 0; i < copy.competitors.length; i++) copy.competitors[i].id = uid();
    return copy;
  }

  function normHeader(h) {
    return String(h || "").replace(/^\uFEFF/, "").toLowerCase().replace(/[_/]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  var HEADER_DICT = {
    asin: "asin",
    "child asin": "asin",
    "product asin": "asin",
    title: "title",
    "product title": "title",
    "product name": "title",
    name: "title",
    price: "price",
    "buy box price": "price",
    "buybox price": "price",
    "average price": "price",
    "monthly sales": "monthlySales",
    "asin sales": "monthlySales",
    "parent level sales": "monthlySales",
    "estimated sales": "monthlySales",
    "monthly sales estimate": "monthlySales",
    sales: "monthlySales",
    "monthly revenue": "monthlyRevenue",
    "asin revenue": "monthlyRevenue",
    "estimated revenue": "monthlyRevenue",
    "monthly revenue estimate": "monthlyRevenue",
    revenue: "monthlyRevenue",
    "review count": "reviews",
    reviews: "reviews",
    ratings: "reviews",
    "number of reviews": "reviews",
    "of reviews": "reviews",
    rating: "rating",
    "star rating": "rating",
    "review rating": "rating",
    stars: "rating",
    bsr: "bsr",
    "best seller rank": "bsr",
    "sales rank": "bsr",
    rank: "bsr"
  };

  function parseLooseNumber(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    var s = String(v).trim();
    if (!s || s === "-" || s === "—" || /^n\/?a$/i.test(s) || /^null$/i.test(s)) return null;
    var neg = /^\(.*\)$/.test(s);
    s = s.replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "$1");
    if (!s) return null;
    var n = Number(s);
    if (!Number.isFinite(n)) return null;
    return neg ? -n : n;
  }

  function cleanAsin(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    var url = s.match(/\/(?:dp|gp\/product|ASIN)\/([A-Za-z0-9]{10})/i);
    if (url) return url[1].toUpperCase();
    if (/^[A-Za-z0-9]{10}$/.test(s)) return s.toUpperCase();
    return s.slice(0, 80);
  }

  function finalizeImportRow(obj) {
    if (!obj) return null;
    var asin = cleanAsin(obj.asin || "");
    var title = asString(obj.title, 180).trim();
    if (!asin && !title) return null;
    var bsr = obj.bsr == null ? "" : String(obj.bsr).trim().slice(0, 80);
    return {
      id: uid(),
      asin: asin,
      title: title,
      price: clampNum(parseLooseNumber(obj.price), 0, 100000),
      monthlySales: clampNum(parseLooseNumber(obj.monthlySales), 0, 100000000),
      monthlyRevenue: clampNum(parseLooseNumber(obj.monthlyRevenue), 0, 1000000000),
      reviews: clampNum(parseLooseNumber(obj.reviews), 0, 100000000),
      rating: clampNum(parseLooseNumber(obj.rating), 0, 5),
      bsr: bsr
    };
  }

  function rowFromObject(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    var mapped = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var field = HEADER_DICT[normHeader(keys[i])];
      if (!field) {
        if (HEADER_DICT[normHeader(keys[i].replace(/([A-Z])/g, " $1"))] ) {
          field = HEADER_DICT[normHeader(keys[i].replace(/([A-Z])/g, " $1"))];
        }
      }
      if (field && mapped[field] == null) mapped[field] = obj[keys[i]];
    }
    return finalizeImportRow(mapped);
  }

  function detectDelimiter(headerLine) {
    var counts = { "\t": 0, ",": 0, ";": 0 };
    var inQ = false;
    for (var i = 0; i < headerLine.length; i++) {
      var ch = headerLine[i];
      if (ch === '"') inQ = !inQ;
      else if (!inQ && Object.prototype.hasOwnProperty.call(counts, ch)) counts[ch]++;
    }
    var best = ",";
    var n = -1;
    var keys = ["\t", ",", ";"];
    for (var k = 0; k < keys.length; k++) {
      if (counts[keys[k]] > n) { n = counts[keys[k]]; best = keys[k]; }
    }
    return best;
  }

  function parseDelimited(text, delimiter) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQ = false;
        } else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delimiter) { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }

  function rowsFromTable(text) {
    var cleaned = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!cleaned) return [];
    var firstLine = cleaned.split(/\r?\n/)[0];
    var delimiter = detectDelimiter(firstLine);
    var table = parseDelimited(cleaned, delimiter);
    if (table.length < 2) return [];
    var headers = table[0].map(normHeader);
    var out = [];
    for (var r = 1; r < table.length; r++) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        var field = HEADER_DICT[headers[c]];
        if (field && obj[field] == null) obj[field] = table[r][c] == null ? "" : table[r][c];
      }
      var row = finalizeImportRow(obj);
      if (row) out.push(row);
    }
    return out;
  }

  function parseHeliumPaste(text) {
    var raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return { rows: [], error: "Paste is empty." };
    if (raw[0] === "[" || raw[0] === "{") {
      try {
        var data = JSON.parse(raw);
        var list = null;
        if (Array.isArray(data)) list = data;
        else if (data && typeof data === "object") {
          var candidates = ["competitors", "data", "rows", "products", "results", "items"];
          for (var i = 0; i < candidates.length; i++) {
            if (Array.isArray(data[candidates[i]])) { list = data[candidates[i]]; break; }
          }
        }
        if (!list) return { rows: [], error: "JSON needs an array of competitor rows." };
        var rows = list.map(rowFromObject).filter(Boolean).slice(0, 40);
        if (!rows.length) return { rows: [], error: "No ASIN or title columns matched. Tried ASIN, Title, Price, Monthly Sales, Monthly Revenue, Reviews, Rating, BSR." };
        return { rows: rows, error: "" };
      } catch (err) {
        return { rows: [], error: "That JSON did not parse." };
      }
    }
    var rows2 = rowsFromTable(raw).slice(0, 40);
    if (!rows2.length) return { rows: [], error: "No rows matched. Use a header row with ASIN or Title, plus any of Price, Monthly Sales, Monthly Revenue, Reviews, Rating, BSR." };
    return { rows: rows2, error: "" };
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return "\"" + s.replace(/"/g, "\"\"") + "\"";
    return s;
  }

  function dossiersToCsv(list) {
    var headers = ["row_type", "product_name", "product_id", "asin_or_url", "fictional_sample", "date", "price", "bsr", "review_count", "rating", "fba_fees", "landed_cost", "contribution", "contribution_pct", "after_ads", "after_ads_pct", "monthly_units", "annual_after_ads", "moat_index", "moat_band", "weighted_average", "verdict", "competitor_asin", "competitor_title", "competitor_price", "monthly_sales", "monthly_revenue", "competitor_reviews", "competitor_rating", "competitor_bsr", "criterion", "weight", "score", "points_contributed", "notes", "excluded_reason"];
    var rows = [headers.join(",")];
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      var econ = economics(d);
      var rubric = scoreSummary(d.criteria);
      var moat = moatSummary(d.moat);
      var shared = [
        d.productName, d.id, d.asinOrUrl, d.sample ? "yes" : "no", d.date,
        d.overview.price == null ? "" : d.overview.price,
        d.overview.bsr, d.overview.reviewCount == null ? "" : d.overview.reviewCount,
        d.overview.rating == null ? "" : d.overview.rating,
        d.overview.fbaFees == null ? "" : d.overview.fbaFees,
        (econ.cogs != null ? econ.cogs : econ.landed) == null ? "" : (econ.cogs != null ? econ.cogs : econ.landed).toFixed(2),
        econ.contribution == null ? "" : econ.contribution.toFixed(2),
        econ.contributionPct == null ? "" : econ.contributionPct.toFixed(2),
        (econ.reportedNet != null ? econ.reportedNet : econ.afterAds) == null ? "" : (econ.reportedNet != null ? econ.reportedNet : econ.afterAds).toFixed(2),
        econ.afterAdsPct == null ? "" : econ.afterAdsPct.toFixed(2),
        d.maker.monthlyUnits == null ? "" : d.maker.monthlyUnits,
        econ.annualAfterAds == null ? "" : econ.annualAfterAds.toFixed(2),
        moat.hundredths == null ? "" : formatHundredths(moat.hundredths),
        moat.band ? moat.band.label : "",
        rubric.hundredths == null ? "" : formatHundredths(rubric.hundredths),
        rubric.band ? rubric.band.label : ""
      ];
      function push(type, rest) {
        rows.push([type].concat(shared).concat(rest).map(csvCell).join(","));
      }
      push("product", ["", "", "", "", "", "", "", "", "", "", "", "", ""]);
      for (var c = 0; c < d.competitors.length; c++) {
        var comp = d.competitors[c];
        var rev = competitorRevenue(comp);
        push("competitor", [comp.asin, comp.title, comp.price == null ? "" : comp.price, comp.monthlySales == null ? "" : comp.monthlySales, rev == null ? "" : rev, comp.reviews == null ? "" : comp.reviews, comp.rating == null ? "" : comp.rating, comp.bsr, "", "", "", "", ""]);
      }
      for (var k = 0; k < d.criteria.length; k++) {
        var crit = d.criteria[k];
        var reason = "";
        if (crit.hidden) reason = "hidden";
        else if (clampWeight(crit.weight) <= 0) reason = "weight_0";
        else if (crit.score == null) reason = "na";
        var contrib = reason ? "" : String(crit.score * clampWeight(crit.weight));
        push("criterion", ["", "", "", "", "", "", "", "", crit.name, String(clampWeight(crit.weight)), crit.score == null ? "" : String(crit.score), contrib, crit.notes, reason]);
      }
    }
    return rows.join("\n") + "\n";
  }

  function dossiersToJson(list) {
    return {
      app: "Sensationally OT product dossier",
      brand: "Sensationally OT",
      note: "Manual dossier. Competitor figures are typed or pasted. This file is not a live Amazon or Helium 10 pull.",
      bands: { go: "4.20 and above (Strong GO)", conditional: "3.40 to 4.19", pass: "below 3.40" },
      formula: "sum(score * weight) / sum(weights of counted criteria), rounded half-up to 2 decimals. N/A, Hide, and weight 0 are excluded.",
      exportedAt: new Date().toISOString(),
      dossiers: list.map(function (d) {
        var copy = clone(d);
        var rubric = scoreSummary(d.criteria);
        var econ = economics(d);
        var moat = moatSummary(d.moat);
        copy.weightedAverage = rubric.hundredths == null ? null : formatHundredths(rubric.hundredths);
        copy.verdict = rubric.band ? rubric.band.label : null;
        copy.points = rubric.num;
        copy.weightTotal = rubric.den;
        copy.landedCostEstimate = econ.landed == null ? null : roundCents(econ.landed);
        copy.contributionEstimate = econ.contribution == null ? null : roundCents(econ.contribution);
        copy.moatIndex = moat.hundredths == null ? null : formatHundredths(moat.hundredths);
        copy.moatBand = moat.band ? moat.band.label : null;
        return copy;
      })
    };
  }

  function parseDossierImport(text) {
    var data;
    try { data = JSON.parse(text); }
    catch (err) { return { dossiers: [], error: "That file is not JSON." }; }
    var list = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.dossiers)) list = data.dossiers;
    else if (data && Array.isArray(data.evaluations)) list = data.evaluations;
    else if (data && data.productName) list = [data];
    else return { dossiers: [], error: "JSON needs a dossier, or a dossiers array." };
    var out = list.map(normalizeDossier).filter(Boolean).slice(0, 100);
    if (!out.length) return { dossiers: [], error: "No products found in that file." };
    return { dossiers: out, error: "" };
  }

  function marginBandLabel(score) {
    if (score === 5) return "32% and up";
    if (score === 4) return "20% to just under 32%";
    if (score === 3) return "12% to just under 20%";
    if (score === 2) return "6% to just under 12%";
    if (score === 1) return "under 6%";
    return "";
  }

  function selfCheck() {
    var fails = [];
    function check(name, cond) { if (!cond) fails.push(name); }
    check("4.195 rounds to 4.20", hundredthsOf(4195, 1000) === 420);
    check("4.194 rounds to 4.19", hundredthsOf(4194, 1000) === 419);
    check("3.395 rounds to 3.40", hundredthsOf(3395, 1000) === 340);
    check("3.394 rounds to 3.39", hundredthsOf(3394, 1000) === 339);
    check("exact 4.20", hundredthsOf(42, 10) === 420);
    check("exact 3.40", hundredthsOf(17, 5) === 340);
    check("band 420 go", bandFor(420).id === "go");
    check("band 419 conditional", bandFor(419).id === "conditional");
    check("band 340 conditional", bandFor(340).id === "conditional");
    check("band 339 pass", bandFor(339).id === "pass");
    check("format 4.30", formatHundredths(430) === "4.30");
    check("format 5.00", formatHundredths(500) === "5.00");
    check("format 4.19", formatHundredths(419) === "4.19");

    var handNum = 0;
    var handDen = 0;
    for (var i = 0; i < DEFAULTS.length; i++) {
      var def = DEFAULTS[i];
      handNum += SAMPLE_SCORE[def.id] * def.weight;
      handDen += def.weight;
    }
    check("sample hand total 185/43", handNum === 185 && handDen === 43);

    var hand = scoreSummary(criteriaFromScores(SAMPLE_SCORE, {}));
    check("sample num", hand.num === 185);
    check("sample den", hand.den === 43);
    check("sample hundredths", hand.hundredths === 430);
    check("sample band", hand.band && hand.band.id === "go");
    check("sample drags", hand.drags.map(function (d) { return d.id; }).join(",") === "reviews,competition,season,moat,margin,returns,channel");

    var all5 = blankCriteria();
    for (var a = 0; a < all5.length; a++) all5[a].score = 5;
    var s5 = scoreSummary(all5);
    check("all fives", s5.num === 215 && s5.den === 43 && s5.hundredths === 500 && s5.band.id === "go");

    var all4 = blankCriteria();
    for (var b = 0; b < all4.length; b++) all4[b].score = 4;
    var s4 = scoreSummary(all4);
    check("all fours conditional", s4.hundredths === 400 && s4.band.id === "conditional");

    var all3 = blankCriteria();
    for (var c = 0; c < all3.length; c++) all3[c].score = 3;
    var s3 = scoreSummary(all3);
    check("all threes pass", s3.hundredths === 300 && s3.band.id === "pass");

    var skipped = blankCriteria();
    for (var s = 0; s < skipped.length; s++) skipped[s].score = 5;
    var reviews = skipped.filter(function (row) { return row.id === "reviews"; })[0];
    var competition = skipped.filter(function (row) { return row.id === "competition"; })[0];
    var margin = skipped.filter(function (row) { return row.id === "margin"; })[0];
    reviews.weight = 0;
    reviews.score = 1;
    competition.hidden = true;
    margin.score = null;
    var sk = scoreSummary(skipped);
    check("skip weight 0, hidden, N/A", sk.num === 165 && sk.den === 33 && sk.hundredths === 500);

    var none = blankCriteria();
    var empty = scoreSummary(none);
    check("no scores", empty.den === 0 && empty.hundredths == null && empty.band == null);

    var partial = blankCriteria();
    partial[0].score = 5;
    var one = scoreSummary(partial);
    check("single criterion", one.num === 25 && one.den === 5 && one.hundredths === 500 && one.band.id === "go");

    var mermaid = sampleMermaid();
    var mermaidScore = scoreSummary(mermaid.criteria);
    var mermaidEcon = economics(mermaid);
    check("mermaid competitors empty", mermaid.competitors.length === 0 && competitionInsight(mermaid.competitors) == null);
    check("mermaid invoice waterfall", mermaid.china.unitCost === 10.65 && mermaid.china.freightPerUnit === 4.24 && mermaid.china.alibabaFee === 0.35 && mermaid.china.dutyPct == null && mermaid.china.shippingMode === "sea");
    check("mermaid before duty", Math.abs(mermaidEcon.beforeDuty - 15.24) < 1e-9 && mermaidEcon.duty === 0 && mermaidEcon.doubleFreight === true && mermaidEcon.activeMode === "sellerboard");
    check("mermaid fee model stored", mermaid.overview.fbaFees === 7.38 && mermaid.china.weightLb === 3.3 && mermaid.china.lengthIn === 13.39 && mermaid.china.widthIn === 8.47 && mermaid.china.heightIn === 2.76);
    check("mermaid fee model math", mermaidEcon.componentReferral === 5.99 && mermaidEcon.componentFees === 13.37 && mermaidEcon.referralApplied === false);
    check("mermaid products cost", mermaidEcon.cogsSource === "sellerboard" && mermaidEcon.cogs === 13.5 && mermaidEcon.referralApplied === false);
    check("mermaid fees", mermaidEcon.feeStack === 14.12 && mermaidEcon.feeSource === "blended");
    check("mermaid contribution", Math.abs(mermaidEcon.contribution - 12.33) < 0.001);
    check("mermaid net", mermaidEcon.reportedNet === 8.9 && mermaidEcon.marginScore === 4 && mermaidEcon.commercial.id === "healthy");
    check("mermaid gap", Math.abs(mermaidEcon.unexplainedGap - 3.43) < 0.001);
    check("mermaid rubric conditional", mermaidScore.num === 71 && mermaidScore.den === 17 && mermaidScore.hundredths === 418 && mermaidScore.band.id === "conditional");
    check("mermaid no units", mermaid.maker.monthlyUnits == null && mermaidEcon.annualAfterAds == null);
    var mermaidBrief = decisionBrief(mermaid);
    check("mermaid brief healthy", mermaidBrief.indexOf("Healthy baseline") >= 0 && mermaidBrief.indexOf("not an ad-cost") >= 0);
    var mermaidSummary = executiveSummary(mermaid);
    check("mermaid title", mermaidSummary.indexOf("# Mermaid dough kit") === 0);
    check("mermaid summary estimate", mermaidSummary.indexOf("ESTIMATE") >= 0 && mermaidSummary.indexOf("FICTIONAL SAMPLE") < 0);
    check("mermaid sku", mermaid.overview.sku === "KIT-MERMAID" && mermaid.asinOrUrl === "B0CFT7YF1L" && mermaid.overview.price === 39.95);

    var farm = sampleFarm();
    var farmScore = scoreSummary(farm.criteria);
    var farmEcon = economics(farm);
    check("farm products cost", farmEcon.cogs === 14 && farmEcon.feeStack === 18 && farmEcon.reportedNet === -3.77);
    check("farm contribution", Math.abs(farmEcon.contribution - 7.95) < 0.001);
    check("farm gap", Math.abs(farmEcon.unexplainedGap - 11.72) < 0.001);
    check("farm underwater", farmEcon.marginScore === 1 && farmEcon.commercial.id === "underwater");
    check("farm rubric conditional", farmScore.num === 59 && farmScore.den === 17 && farmScore.hundredths === 347 && farmScore.band.id === "conditional");
    check("farm list", farm.overview.listPrice === 49.95 && farm.overview.sku === "35-ZREI-MJZW" && farm.asinOrUrl === "B0GCTV28TN");
    check("farm same kit architecture", farm.china.unitCost === 10.65 && farm.china.freightPerUnit === 4.24 && farm.china.alibabaFee === 0.35 && farm.china.dutyPct == null && farm.china.amazonInbound == null && farm.overview.fbaFees === 7.55 && farm.overview.price === 39.95 && farmEcon.activeMode === "sellerboard" && Math.abs(farmEcon.beforeDuty - 15.24) < 1e-9);
    var trackerMath = cogsTrackerMath();
    check("mermaid tracker model", mermaid.overview.price === 39.95 && mermaid.china.inboundPlacement === 0 && trackerMath.mermaidImpliedFees === 14.76 && trackerMath.mermaidCpaGap === 3.6 && mermaidEcon.feeStack === 14.12 && mermaidEcon.componentFees === 13.37);
    check("farm tracker model", farm.china.inboundPlacement === 0 && farm.maker.monthlyUnits == null && trackerMath.farmModeledProfit === 9.01 && trackerMath.farmLiveBeforeAds === 12.41 && roundCents(COGS_TRACKER.farm.modeledPrice * 0.15) === 5.39 && farmEcon.componentReferral === 5.99 && farmEcon.componentFba === 7.55 && farmEcon.componentFees === 13.54 && farmEcon.feeSource === "blended");
    check("farm no tacos", farm.china.tacosPct == null && farmEcon.afterAds == null);
    var farmBrief = decisionBrief(farm);
    check("farm brief conditional", farmBrief.indexOf("Underwater") >= 0 && farmBrief.indexOf("Conditional") >= 0);
    check("money negative", money(-3.77) === "-$3.77");

    var buildup = blankDossier();
    buildup.overview.price = 39.95;
    buildup.china.unitCost = 10;
    buildup.china.freightPerUnit = 3.5;
    buildup.china.referralPct = null;
    var buildEcon = economics(buildup);
    check("buildup matches mermaid cost", Math.abs(buildEcon.buildUp - 13.5) < 1e-9 && Math.abs(buildEcon.gapVsMermaidCost) < 1e-9 && buildEcon.cogsSource === "buildup");
    buildup.china.productsCost = 14;
    var overrideEcon = economics(buildup);
    check("products cost overrides buildup", overrideEcon.cogs === 14 && overrideEcon.cogsSource === "sellerboard" && Math.abs(overrideEcon.buildUp - 13.5) < 1e-9);
    var preset = blankDossier();
    preset.china.unitCost = 4;
    applySellerboardPreset(preset, "farm");
    check("preset leaves china split", preset.china.unitCost === 4 && preset.china.freightPerUnit == null && preset.china.productsCost === 14 && preset.china.reportedNet === -3.77 && preset.overview.price === 39.95 && preset.overview.listPrice === 49.95);
    var invoiceBlank = blankDossier();
    invoiceBlank.china.productsCost = 13.5;
    applyInvoicePreset(invoiceBlank);
    var invoiceEcon = economics(invoiceBlank);
    check("invoice preset", invoiceBlank.china.unitCost === 10.65 && invoiceBlank.china.freightPerUnit === 4.24 && invoiceBlank.china.alibabaFee === 0.35 && invoiceBlank.china.dutyPct == null && invoiceBlank.overview.fbaFees === 7.38 && invoiceBlank.overview.price === 39.95 && invoiceBlank.china.productsCost === 13.5 && invoiceEcon.cogsSource === "sellerboard" && Math.abs(invoiceEcon.beforeDuty - GREATWALL.beforeDuty) < 1e-9 && Math.abs((GREATWALL.exw + GREATWALL.seaFreight + GREATWALL.alibabaFee) - GREATWALL.beforeDuty) < 1e-9);
    check("fee model locked sum", roundCents(FEE_MODEL.referral + FEE_MODEL.fba) === FEE_MODEL.combined && roundCents(39.95 * 0.15) === 5.99);
    var moatBlank = moatSummary(mermaid.moat);
    check("baseline moat unscored", moatBlank.hundredths == null);

    var tsv = "ASIN\tProduct Title\tPrice\tMonthly Sales\tASIN Revenue\tReview Count\tRating\tSales Rank\nB0TEST12345\tRainbow Oats\t$19.99\t1,200\t23988\t50\t4.5\t1,200";
    var parsed = parseHeliumPaste(tsv);
    check("tsv row", parsed.rows.length === 1 && parsed.rows[0].asin === "B0TEST12345" && parsed.rows[0].monthlySales === 1200 && parsed.rows[0].price === 19.99 && parsed.rows[0].monthlyRevenue === 23988 && parsed.rows[0].bsr === "1,200");
    var csv = "ASIN,Title,Price\nB0TEST12345,\"Rice, Rainbow\",12.50\n";
    var parsedCsv = parseHeliumPaste(csv);
    check("csv quotes", parsedCsv.rows.length === 1 && parsedCsv.rows[0].title === "Rice, Rainbow" && parsedCsv.rows[0].price === 12.5);
    var json = JSON.stringify([{ asin: "https://www.amazon.com/dp/B0TEST1234", "Product Name": "Kit", "Monthly Sales": "800", Rating: "4.8" }]);
    var parsedJson = parseHeliumPaste(json);
    check("json url asin", parsedJson.rows.length === 1 && parsedJson.rows[0].asin === "B0TEST1234" && parsedJson.rows[0].monthlySales === 800 && parsedJson.rows[0].rating === 4.8);
    check("empty paste", parseHeliumPaste("  ").error.length > 0);
    check("bad json", parseHeliumPaste("{").error.length > 0);

    var legacy = storeFromStorage(null, JSON.stringify({ version: 1, evals: [{
      id: "sample-pebble-calm-mini", productName: "Pebble Calm Mini — Sensory Worry Stone Set",
      asinOrUrl: "B0SOTDEMO1", categoryNotes: "old", date: "2026-09-18", sample: true,
      criteria: criteriaFromScores(SAMPLE_SCORE, {})
    }] }));
    check("legacy pebble replaced", legacy.migrated && legacy.baselinesSeeded && legacy.dossiers.length === 2 && legacy.dossiers[0].id === "baseline-mermaid-dough" && legacy.dossiers[1].id === "baseline-farm-dough");
    var legacyKept = storeFromStorage(null, JSON.stringify({ version: 1, evals: [{
      id: "real-1", productName: "My scoop", asinOrUrl: "B00REAL123", categoryNotes: "notes stay",
      date: "2026-09-01", sample: false, criteria: criteriaFromScores({ repeat: 4 }, {})
    }] }));
    check("legacy real kept", legacyKept.dossiers.length === 1 && legacyKept.baselinesSeeded && legacyKept.dossiers[0].productName === "My scoop" && legacyKept.dossiers[0].overview.notes === "notes stay");
    check("fresh seeds", storeFromStorage(null, null).fresh && storeFromStorage(null, null).baselinesSeeded && storeFromStorage(null, null).dossiers.length === 2);
    var upgraded = storeFromStorage(JSON.stringify({
      version: 1,
      dossiers: [
        { id: "sample-calm-bin-kit", productName: "Calm Bin", sample: true, date: "2026-09-18" },
        { id: "kept-real", productName: "Kept scoop", sample: false, date: "2026-09-01" }
      ]
    }), null);
    check("upgrade drops fiction once", upgraded.upgraded && upgraded.replacedFiction && upgraded.baselinesSeeded && upgraded.dossiers.length === 3 && upgraded.dossiers[0].id === "baseline-mermaid-dough" && upgraded.dossiers[2].id === "kept-real");
    var deleted = storeFromStorage(JSON.stringify({ version: 1, baselinesSeeded: true, dossiers: [{ id: "kept-real", productName: "Kept scoop", sample: false, date: "2026-09-01" }] }), null);
    check("seed flag sticks", deleted.baselinesSeeded && !deleted.upgraded && deleted.dossiers.length === 1 && deleted.dossiers[0].id === "kept-real");
    var waterfallOld = storeFromStorage(JSON.stringify({
      version: 1,
      baselinesSeeded: true,
      dossiers: [{
        id: "baseline-mermaid-dough",
        productName: "Mermaid dough kit",
        baseline: true,
        date: "2026-09-26",
        overview: { price: 39.95, sku: "KIT-MERMAID" },
        china: {
          productsCost: 13.5,
          amazonFeesBlended: 14.12,
          reportedNet: 8.9,
          notes: "Leave China EXW/FOB and freight blank until an invoice parse."
        }
      }]
    }), null);
    check("waterfall patch once", waterfallOld.upgraded && waterfallOld.waterfallSeeded && waterfallOld.dossiers.length === 1 && waterfallOld.dossiers[0].china.unitCost === 10.65 && waterfallOld.dossiers[0].china.freightPerUnit === 4.24 && waterfallOld.dossiers[0].china.alibabaFee === 0.35 && waterfallOld.dossiers[0].china.dutyPct == null && waterfallOld.dossiers[0].china.productsCost === 13.5 && waterfallOld.dossiers[0].overview.fbaFees === 7.38 && waterfallOld.dossiers[0].china.notes.indexOf("KITGW20231012") >= 0);
    waterfallOld.dossiers[0].china.unitCost = null;
    waterfallOld.dossiers[0].china.freightPerUnit = null;
    waterfallOld.dossiers[0].china.alibabaFee = null;
    var waterfallAgain = storeFromStorage(JSON.stringify({ version: 1, baselinesSeeded: true, waterfallSeeded: true, dossiers: waterfallOld.dossiers }), null);
    check("waterfall flag sticks", !waterfallAgain.upgraded && waterfallAgain.dossiers[0].china.unitCost == null && waterfallAgain.cogsTrackerSeeded && waterfallAgain.dossiers[0].china.inboundPlacement === 0);
    var trackerOld = storeFromStorage(JSON.stringify({
      version: 1,
      baselinesSeeded: true,
      waterfallSeeded: true,
      dossiers: [{
        id: "baseline-farm-dough",
        productName: "Farm dough",
        baseline: true,
        date: "2026-09-26",
        overview: { price: 39.95, sku: "35-ZREI-MJZW", fbaFees: 7.38 },
        china: {
          productsCost: 14,
          amazonFeesBlended: 18,
          reportedNet: -3.77,
          unitCost: 10.65,
          freightPerUnit: 4.24,
          alibabaFee: 0.35,
          notes: "Mode 2 is Greatwall SENSORY KITGW20231012."
        }
      }]
    }), null);
    check("cogs tracker patch", trackerOld.upgraded && trackerOld.cogsTrackerSeeded && trackerOld.dossiers[0].overview.price === 39.95 && trackerOld.dossiers[0].overview.fbaFees === 7.55 && trackerOld.dossiers[0].china.inboundPlacement === 0 && trackerOld.dossiers[0].china.amazonInbound == null && trackerOld.dossiers[0].china.notes.indexOf("COGS Tracker") >= 0 && trackerOld.dossiers[0].china.notes.indexOf("$35.95") >= 0);
    var trackerAgain = storeFromStorage(JSON.stringify({ version: 1, baselinesSeeded: true, waterfallSeeded: true, cogsTrackerSeeded: true, dossiers: [{
      id: "baseline-farm-dough", productName: "Farm dough", baseline: true, date: "2026-09-26",
      overview: { price: 39.95, fbaFees: 8 }, china: { inboundPlacement: 0, unitCost: 10.65, notes: "edited" }
    }] }), null);
    check("cogs tracker flag sticks", !trackerAgain.upgraded && trackerAgain.dossiers[0].overview.fbaFees === 8 && trackerAgain.dossiers[0].china.notes === "edited");

    var blankEcon = economics(blankDossier());
    check("blank landed null", blankEcon.landed == null && blankEcon.contribution == null);
    var csvOut = dossiersToCsv([mermaid]);
    check("csv has product and criterion", csvOut.indexOf("product,") >= 0 && csvOut.indexOf("Mermaid dough kit") >= 0 && csvOut.indexOf("criterion,") >= 0 && csvOut.indexOf("B0CFT7YF1L") >= 0 && csvOut.indexOf("13.50") >= 0 && csvOut.indexOf("8.90") >= 0);
    var imported = parseDossierImport(JSON.stringify(dossiersToJson([mermaid, farm])));
    check("roundtrip import", imported.dossiers.length === 2 && imported.dossiers[0].productName === "Mermaid dough kit" && imported.dossiers[0].china.productsCost === 13.5 && imported.dossiers[1].china.reportedNet === -3.77 && imported.dossiers[0].baseline === true && imported.dossiers[0].competitors.length === 0);
    check("money", money(6997.2) === "$6,997.20" && money(null) === "—");
    check("listing href", listingHref("B0CFT7YF1L") === "https://www.amazon.com/dp/B0CFT7YF1L");
    check("margin bands", marginScoreFromPct(32) === 5 && marginScoreFromPct(24) === 4 && marginScoreFromPct(19.9) === 3 && marginScoreFromPct(6) === 2 && marginScoreFromPct(5.9) === 1);
    return fails;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_KEY: LEGACY_KEY,
    DEFAULTS: DEFAULTS,
    MOAT_ITEMS: MOAT_ITEMS,
    LINKED_CRITERIA: LINKED_CRITERIA,
    SAMPLE_SCORE: SAMPLE_SCORE,
    BASELINES: BASELINES,
    GREATWALL: GREATWALL,
    FEE_MODEL: FEE_MODEL,
    COGS_TRACKER: COGS_TRACKER,
    cogsTrackerMath: cogsTrackerMath,
    clampWeight: clampWeight,
    clampScore: clampScore,
    hundredthsOf: hundredthsOf,
    formatHundredths: formatHundredths,
    bandFor: bandFor,
    money: money,
    pct: pct,
    formatInt: formatInt,
    roundCents: roundCents,
    listingHref: listingHref,
    blankCriteria: blankCriteria,
    blankDossier: blankDossier,
    sampleMermaid: sampleMermaid,
    sampleFarm: sampleFarm,
    sampleLibrary: sampleLibrary,
    applySellerboardPreset: applySellerboardPreset,
    applyInvoicePreset: applyInvoicePreset,
    commercialStatus: commercialStatus,
    scoreSummary: scoreSummary,
    formatPull: formatPull,
    moatSummary: moatSummary,
    suggestMoatRubricScore: suggestMoatRubricScore,
    marginScoreFromPct: marginScoreFromPct,
    marginBandLabel: marginBandLabel,
    competitorRevenue: competitorRevenue,
    economics: economics,
    competitionInsight: competitionInsight,
    decisionBrief: decisionBrief,
    executiveSummary: executiveSummary,
    normalizeDossier: normalizeDossier,
    storeFromStorage: storeFromStorage,
    duplicateDossier: duplicateDossier,
    parseHeliumPaste: parseHeliumPaste,
    dossiersToCsv: dossiersToCsv,
    dossiersToJson: dossiersToJson,
    parseDossierImport: parseDossierImport,
    findCriterion: findCriterion,
    uid: uid,
    clone: clone,
    todayISO: todayISO,
    selfCheck: selfCheck
  };
});
