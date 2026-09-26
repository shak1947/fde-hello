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
      why: "Room left after FBA fees and ads, from your own estimate. 5 = comfortable headroom. 1 = fees and ads likely eat the offer. The China section can suggest this score from the landed-cost estimate." },
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

  var SAMPLE_NOTES = {
    repeat: "Refill rice is the repurchase. The tin and cards stay; a family using a sensory bin can restock inside a year. Fictional sample.",
    gift: "Tin, scoop, and activity cards read as a birthday or teacher gift. A plain bag of dyed rice does not.",
    size: "Planned as a small tin and about 1 lb of fill — mailer class, not a 5 lb sack.",
    repack: "Loose dyed rice moves into our tin with a scoop and a card set. No glass, no electronics, no sealed clamshell.",
    moat: "Custom tin print, a three-blend recipe, and activity cards. The factory can still sell dyed rice; it cannot hand over this kit without the plate and the cards. Rubric score 4. The broader barrier index stays Conditional because reviews and ads are softer.",
    reviews: "Treated as a young listing with tens of reviews, not thousands. No live review count was pulled.",
    competition: "Rainbow-oat fillers own a lot of the search. Score 3: crowded, but a giftable kit is not the same offer as a 2 lb commodity bag.",
    margin: "From the landed-cost estimate on this page: about 34% contribution, about 24% after a 10% TACOS assumption. Score 4. Manual inputs, not a fee quote.",
    returns: "Dry grain, low breakage. Dye transfer and “too messy” reviews are the watchout, so this is not a 5.",
    season: "Gift demand peaks in Q4. Bins get used all year. Not a pure seasonal.",
    sensory: "Direct sensory-bin / OT fit for Sensationally OT.",
    channel: "The same tin can sit on Shopify and Walmart. Not built for Amazon only."
  };

  var BULK_SCORE = {
    repeat: 3, gift: 2, size: 3, repack: 2, moat: 2, reviews: 2,
    competition: 2, margin: 3, returns: 4, season: 3, sensory: 3, channel: 2
  };

  var BULK_NOTES = {
    repeat: "People do buy more filler, but there is no branded refill. Any dyed rice replaces it. About a year if a bin habit exists, with no lock-in.",
    gift: "A bulk bag is a supply, not a gift. Weak buy-for-others story.",
    size: "A 2 lb bag is shippable and still heavier and less giftable than a tin kit.",
    repack: "You can sticker a poly bag. You are not building a kit, so the repack does not create a new offer.",
    moat: "Open-catalog dyed rice. Any seller with the same factory can list it next week.",
    reviews: "Leaders already have thousands of reviews. A new commodity ASIN starts from zero against them.",
    competition: "Head-on with Rainbow Oats style listings. Score 2: the leader is real, and we would be the same product.",
    margin: "Unit cost is cheap, so contribution looks fine until a commodity TACOS assumption (about 22%). After ads the headroom is ordinary — score 3.",
    returns: "Dry rice, low breakage. Messy-play complaints still happen.",
    season: "Year-round bin use with a Q4 bump.",
    sensory: "On-theme for OT, but it is the commodity version of the theme, not a Sensationally OT kit.",
    channel: "A bulk bag can be listed elsewhere. Nothing about it is built for more than one marketplace."
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
      dutyPct: null,
      amazonInbound: null,
      packaging: null,
      spoilagePct: null,
      referralPct: 15,
      tacosPct: null,
      notes: ""
    };
  }

  function blankOverview() {
    return {
      category: "",
      price: null,
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

  function sampleCalmBin() {
    var d = blankDossier();
    d.id = "sample-calm-bin-kit";
    d.productName = "Calm Bin — OT Sensory Rice Kit";
    d.asinOrUrl = "B0SOTDEMO1";
    d.date = "2026-09-18";
    d.sample = true;
    d.createdAt = "2026-09-18T15:00:00.000Z";
    d.updatedAt = "2026-09-18T18:00:00.000Z";
    d.overview = {
      category: "Toys & Games · sensory bin filler / OT gift kit",
      price: 24.99,
      bsr: "18,400 in Toys & Games",
      reviewCount: 86,
      rating: 4.6,
      fbaFees: 6.15,
      notes: "Fictional sample for Sensationally OT. Not a real ASIN. Stats are hand-built so the desk has a story on first visit — they are not a Helium 10 or Amazon pull. Position: a giftable tin (dyed rice blend, wooden scoop, four activity cards, refill pouch) against rainbow-oats and loose sensory rice."
    };
    d.competitors = [
      compRow({ id: "c-oats", asin: "B0OATS0001", title: "Rainbow Oats Sensory Bin Filler, 2 lb", price: 19.99, monthlySales: 3200, reviews: 8400, rating: 4.7, bsr: "1,120" }),
      compRow({ id: "c-rice", asin: "B0RICE0002", title: "Dyed Sensory Rice Rainbow, 1.5 lb", price: 16.49, monthlySales: 2100, reviews: 3100, rating: 4.5, bsr: "2,860" }),
      compRow({ id: "c-kit", asin: "B0KIT00003", title: "Complete OT Sensory Bin Kit", price: 32.99, monthlySales: 640, reviews: 1260, rating: 4.6, bsr: "6,400" }),
      compRow({ id: "c-bulk", asin: "B0BULK0004", title: "Bulk Colored Rice, 3 lb value bag", price: 18.99, monthlySales: 1500, reviews: 4200, rating: 4.3, bsr: "1,980" }),
      compRow({ id: "c-jars", asin: "B0JARS0005", title: "Mini Calm Jars, set of 3", price: 22.5, monthlySales: 280, reviews: 190, rating: 4.4, bsr: "24,100" })
    ];
    d.china = {
      unitCost: 4.1,
      costBasis: "EXW",
      moq: 500,
      shippingMode: "sea",
      freightPerUnit: 0.95,
      dutyPct: 6.5,
      amazonInbound: 0.55,
      packaging: 0.48,
      spoilagePct: 3,
      referralPct: 15,
      tacosPct: 10,
      notes: "Planning rates, not a freight quote. EXW covers dyed rice, printed tin, scoop, and a card set at MOQ 500. Sea freight is a per-unit planning number. Duty uses unit + freight as a stand-in customs value."
    };
    d.maker = {
      why: "Parents and OTs already buy sensory filler. The repurchase is the rice, and the thing they gift is a tin with a job to do. A plain rainbow-oats bag captures the habit and none of the gift.",
      whitespace: "Leaders sell bulk dyed grain in a poly bag. Few sell a small-parts-conscious tin, a scoop, activity cards, and a refill pouch as one OT-framed kit.",
      kitAngle: "Three-texture blend (rice, oat, lentil), laminated cards, wooden scoop, custom tin print. Not a single SKU of loose rice.",
      giftOtAngle: "Birthday, teacher, and “sensory diet starter” gift. On-brand for Sensationally OT. Refill pouch is the reason to come back inside a year.",
      priceBandLow: 22,
      priceBandHigh: 28,
      monthlyUnits: 280,
      shareNote: "280 units is about 3.6% of this tracked set (7,720 units a month), not of all of Amazon. Year-1 plan, not a rank we expect to hold against Rainbow Oats."
    };
    d.moat = blankMoat();
    var calmScores = { brand: 3, custom: 5, exclusive: 4, reviews: 3, tacos: 3, copy: 4, regulatory: 4, capital: 4 };
    var calmMoatNotes = {
      brand: "Wordmark planned. No patent. Enough to brand the tin, not enough to stop a lookalike.",
      custom: "Print plate, card set, and a three-blend recipe. Harder to copy as one factory SKU.",
      exclusive: "MOQ locks the print plate. The factory can still sell undyed or generically dyed rice.",
      reviews: "Rainbow Oats is in the thousands of reviews. We do not need to match that if the kit is a different search, but we also cannot ignore it.",
      tacos: "Gift kits can convert on a tighter ad set than commodity filler. Still a PPC category.",
      copy: "Tin art and cards slow a straight copy. The grain itself will be copied.",
      regulatory: "Dyed food-contact grain, small parts, CPSIA / Prop 65 watchouts. No battery, no magnet. Documentable if we do the work.",
      capital: "MOQ 500 by sea is a modest first buy for this price point."
    };
    d.moat.scores = calmScores;
    d.moat.notes = calmMoatNotes;
    d.moat.barriersForOthers = "A copycat can buy dyed rice this week. They cannot match the tin print, the card set, and a Sensationally OT gift story without art, a plate, and a brand parents already trust. The review wall on commodity filler is the real barrier — for them and for us.";
    d.moat.ourPlan = "Own the kit, not the grain. Keep the plate and the card artwork exclusive to our PO. Launch against “sensory gift” and “OT bin kit” terms, not only “rainbow oats.” Sell the refill pouch so the second purchase does not depend on winning the commodity keyword.";
    d.criteria = criteriaFromScores(SAMPLE_SCORE, SAMPLE_NOTES);
    return d;
  }

  function sampleBulkRice() {
    var d = blankDossier();
    d.id = "sample-bulk-rainbow-rice";
    d.productName = "Bulk Rainbow Rice — Commodity 2 lb";
    d.asinOrUrl = "B0SOTDEMO2";
    d.date = "2026-09-18";
    d.sample = true;
    d.createdAt = "2026-09-18T16:00:00.000Z";
    d.updatedAt = "2026-09-18T16:00:00.000Z";
    d.overview = {
      category: "Toys & Games · sensory bin filler, commodity bag",
      price: 17.99,
      bsr: "9,800 in Toys & Games",
      reviewCount: 40,
      rating: 4.2,
      fbaFees: 5.4,
      notes: "Second fictional sample: the me-too version of the same aisle. Use it to compare against Calm Bin. Cheap grain, no kit, no gift, no moat. Not a real ASIN and not a live pull."
    };
    d.competitors = [
      compRow({ id: "b-oats", asin: "B0OATS0001", title: "Rainbow Oats Sensory Bin Filler, 2 lb", price: 19.99, monthlySales: 3200, reviews: 8400, rating: 4.7, bsr: "1,120" }),
      compRow({ id: "b-rice", asin: "B0RICE0002", title: "Dyed Sensory Rice Rainbow, 1.5 lb", price: 16.49, monthlySales: 2100, reviews: 3100, rating: 4.5, bsr: "2,860" }),
      compRow({ id: "b-bulk", asin: "B0BULK0004", title: "Bulk Colored Rice, 3 lb value bag", price: 18.99, monthlySales: 1500, reviews: 4200, rating: 4.3, bsr: "1,980" })
    ];
    d.china = {
      unitCost: 1.35,
      costBasis: "EXW",
      moq: 2000,
      shippingMode: "sea",
      freightPerUnit: 0.7,
      dutyPct: 6.5,
      amazonInbound: 0.4,
      packaging: 0.15,
      spoilagePct: 2,
      referralPct: 15,
      tacosPct: 22,
      notes: "Planning rates for a stickered poly bag. Higher MOQ because the unit is cheap. TACOS is punitive on purpose: commodity filler usually buys the click."
    };
    d.maker = {
      why: "Included as the contrast case. The aisle is real, the unit is cheap, and that is not a reason to source it. There is no gift, no refill brand, and no reason a buyer picks us over Rainbow Oats.",
      whitespace: "There isn’t a useful wedge. White space would have to be price, and the leader can follow price down.",
      kitAngle: "None. A poly bag of dyed rice is the product.",
      giftOtAngle: "OT-adjacent only because the grain is used in bins. It is not a gift and it is not a Sensationally OT kit.",
      priceBandLow: 15,
      priceBandHigh: 20,
      monthlyUnits: 400,
      shareNote: "400 units would be a real buy against leaders who already move thousands. That volume is the expensive way to learn the listing is a commodity."
    };
    d.moat = blankMoat();
    d.moat.scores = { brand: 1, custom: 1, exclusive: 1, reviews: 1, tacos: 2, copy: 1, regulatory: 3, capital: 2 };
    d.moat.notes = {
      brand: "No brand a buyer can ask for.",
      custom: "No mold, print, or kit.",
      exclusive: "Any trading company will sell the same rice.",
      reviews: "Catching 8,400 reviews with a me-too bag is the whole ballgame, and we would still be undifferentiated.",
      tacos: "Expect to buy rank. A 22% TACOS assumption is in the China section for that reason.",
      copy: "This is the copy. Shipping it does not create a barrier.",
      regulatory: "Same dye and small-parts questions as any sensory rice, without a brand to absorb a complaint.",
      capital: "MOQ 2,000 of a slow-differentiated bag ties cash up in something we cannot brand."
    };
    d.moat.barriersForOthers = "Almost none. The barrier is the leaders’ reviews, and it blocks us more than it blocks the next seller.";
    d.moat.ourPlan = "Do not source this as a Sensationally OT product. If the grain is useful, it belongs inside the Calm Bin kit as a refill, not as its own listing.";
    d.criteria = criteriaFromScores(BULK_SCORE, BULK_NOTES);
    return d;
  }

  function sampleLibrary() {
    return [sampleCalmBin(), sampleBulkRice()];
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

  function economics(d) {
    var overview = d && d.overview ? d.overview : {};
    var china = d && d.china ? d.china : {};
    var maker = d && d.maker ? d.maker : {};
    var price = numOrNull(overview.price);
    var fba = numOrNull(overview.fbaFees);
    var unit = numOrNull(china.unitCost);
    var freight = numOrNull(china.freightPerUnit);
    var dutyPct = numOrNull(china.dutyPct);
    var inbound = numOrNull(china.amazonInbound);
    var packaging = numOrNull(china.packaging);
    var spoilagePct = numOrNull(china.spoilagePct);
    var referralPct = numOrNull(china.referralPct);
    var tacosPct = numOrNull(china.tacosPct);
    var moq = numOrNull(china.moq);
    var monthlyUnits = numOrNull(maker.monthlyUnits);
    var result = {
      price: price,
      fba: fba,
      unit: unit,
      freight: freight,
      dutyPct: dutyPct,
      inbound: inbound,
      packaging: packaging,
      spoilagePct: spoilagePct,
      referralPct: referralPct,
      tacosPct: tacosPct,
      moq: moq,
      monthlyUnits: monthlyUnits,
      costBasis: china.costBasis === "FOB" ? "FOB" : "EXW",
      shippingMode: china.shippingMode === "air" ? "air" : "sea",
      landed: null,
      customs: null,
      duty: null,
      preBuffer: null,
      referral: null,
      contribution: null,
      contributionPct: null,
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
      blanksAsZero: false
    };
    if (unit == null) return result;
    var freightUsed = freight == null ? 0 : freight;
    var dutyUsed = dutyPct == null ? 0 : dutyPct;
    var inboundUsed = inbound == null ? 0 : inbound;
    var packUsed = packaging == null ? 0 : packaging;
    var spoilUsed = spoilagePct == null ? 0 : spoilagePct;
    result.blanksAsZero = freight == null || dutyPct == null || inbound == null || packaging == null || spoilagePct == null;
    var customs = unit + freightUsed;
    var duty = customs * dutyUsed / 100;
    var preBuffer = customs + duty + inboundUsed + packUsed;
    var landed = preBuffer * (1 + spoilUsed / 100);
    result.customs = customs;
    result.duty = duty;
    result.preBuffer = preBuffer;
    result.landed = landed;
    if (moq != null && moq > 0) result.cashTied = moq * landed;
    if (price != null && price > 0 && fba != null) {
      var refPct = referralPct == null ? 0 : referralPct;
      var referral = price * refPct / 100;
      var contribution = price - referral - fba - landed;
      result.referral = referral;
      result.contribution = contribution;
      result.contributionPct = contribution / price * 100;
      if (tacosPct != null) {
        result.adPerUnit = price * tacosPct / 100;
        result.afterAds = contribution - result.adPerUnit;
        result.afterAdsPct = result.afterAds / price * 100;
        result.marginBasis = "after TACOS";
        result.marginPctUsed = result.afterAdsPct;
      } else {
        result.marginBasis = "before ads";
        result.marginPctUsed = result.contributionPct;
      }
      result.marginScore = marginScoreFromPct(result.marginPctUsed);
      if (result.cashTied != null && contribution > 0) result.breakevenUnits = Math.ceil(result.cashTied / contribution);
      if (result.cashTied != null && result.afterAds != null && result.afterAds > 0) {
        result.breakevenAfterAds = Math.ceil(result.cashTied / result.afterAds);
      }
      if (monthlyUnits != null && monthlyUnits >= 0) {
        result.monthlyRevenuePlan = monthlyUnits * price;
        result.annualContribution = monthlyUnits * 12 * contribution;
        result.annualAfterAds = monthlyUnits * 12 * (result.afterAds == null ? contribution : result.afterAds);
      }
    } else if (price != null && price > 0 && monthlyUnits != null && monthlyUnits >= 0) {
      result.monthlyRevenuePlan = monthlyUnits * price;
    }
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
    if (d.sample) parts.push("Fictional sample.");
    if (rubric.hundredths == null) {
      parts.push("The rubric has no counted scores yet, so there is no GO, Conditional, or Pass.");
    } else {
      var strong = rubric.band.id === "go" ? " (Strong GO)" : "";
      parts.push("Verdict " + rubric.band.label + strong + " at " + formatHundredths(rubric.hundredths) + ".");
    }
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
    if (econ.landed != null && econ.contribution != null) {
      var marginLine = "Landed estimate " + money(econ.landed) + ". Contribution " + money(econ.contribution) + " (" + pct(econ.contributionPct) + ")";
      if (econ.afterAds != null) marginLine += "; after " + pct(econ.tacosPct).replace("%", "") + "% TACOS " + money(econ.afterAds) + " (" + pct(econ.afterAdsPct) + ")";
      marginLine += ". Calculator suggests margin score " + econ.marginScore + " (" + econ.marginBasis + "); the rubric says " + scoreText(findCriterion(d, "margin")) + ".";
      parts.push(marginLine);
    } else if (econ.landed != null) {
      parts.push("Landed estimate " + money(econ.landed) + ". Add a target price and an FBA fee to see contribution.");
    } else {
      parts.push("China unit cost is empty, so landed cost is not estimated yet.");
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
    if (d.sample) lines.push("FICTIONAL SAMPLE. Not a real Amazon listing and not a Helium 10 or Amazon pull.");
    lines.push("");
    lines.push("## Decision");
    lines.push(decisionBrief(d));
    lines.push("");
    lines.push("## Overview");
    lines.push("- ASIN/URL: " + ((d.asinOrUrl || "").trim() || "(none)"));
    lines.push("- Date: " + (d.date || ""));
    lines.push("- Category: " + ((d.overview.category || "").trim() || "(none)"));
    lines.push("- Price: " + money(d.overview.price));
    lines.push("- BSR: " + ((d.overview.bsr || "").trim() || "(none)"));
    lines.push("- Reviews / rating: " + (d.overview.reviewCount == null ? "—" : formatInt(d.overview.reviewCount)) + " / " + (d.overview.rating == null ? "—" : String(d.overview.rating)));
    lines.push("- FBA fees (manual): " + money(d.overview.fbaFees));
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
    lines.push("Manual inputs. Not a freight quote and not a customs ruling. Blank cost lines count as zero once a unit cost is entered. Duty uses unit cost + freight per unit as a stand-in customs value. Spoilage is a buffer on that subtotal.");
    if (econ.unit == null) lines.push("Unit cost not entered.");
    else {
      lines.push("- " + econ.costBasis + " unit " + money(econ.unit) + ", " + econ.shippingMode + " freight " + money(econ.freight) + "/unit, duty " + (econ.dutyPct == null ? "—" : pct(econ.dutyPct)) + ", Amazon inbound " + money(econ.inbound) + ", packaging " + money(econ.packaging) + ", spoilage buffer " + (econ.spoilagePct == null ? "—" : pct(econ.spoilagePct)));
      lines.push("- Customs stand-in " + money(econ.customs) + " · duty " + money(econ.duty) + " · before buffer " + money(econ.preBuffer) + " · landed " + money(econ.landed));
      lines.push("- Referral " + (econ.referralPct == null ? "blank (counted as 0%)" : pct(econ.referralPct)) + " = " + money(econ.referral) + " · FBA " + money(econ.fba));
      lines.push("- Contribution " + money(econ.contribution) + " (" + pct(econ.contributionPct) + ")");
      if (econ.tacosPct != null) lines.push("- After " + pct(econ.tacosPct) + " TACOS: " + money(econ.afterAds) + " (" + pct(econ.afterAdsPct) + ") per unit");
      else lines.push("- TACOS not entered, so after-ads profit is not estimated.");
      if (econ.cashTied != null) lines.push("- MOQ cash at landed cost: " + money(econ.cashTied));
      if (econ.breakevenUnits != null) lines.push("- Breakeven units at contribution (before ads): " + formatInt(econ.breakevenUnits));
      if (econ.breakevenAfterAds != null) lines.push("- Breakeven units after TACOS: " + formatInt(econ.breakevenAfterAds));
      if ((d.china.notes || "").trim()) lines.push("- Notes: " + d.china.notes.trim());
    }
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
      createdAt: asString(raw.createdAt, 40) || base.createdAt,
      updatedAt: asString(raw.updatedAt || raw.savedAt, 40) || base.updatedAt,
      overview: {
        category: asString(overviewIn.category, 200),
        price: clampNum(overviewIn.price, 0, 100000),
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
        dutyPct: clampNum(chinaIn.dutyPct, 0, 100),
        amazonInbound: clampNum(chinaIn.amazonInbound, 0, 100000),
        packaging: clampNum(chinaIn.packaging, 0, 100000),
        spoilagePct: clampNum(chinaIn.spoilagePct, 0, 100),
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

  function isUntouchedPebble(raw) {
    return raw && raw.id === "sample-pebble-calm-mini" && raw.sample === true
      && raw.productName === "Pebble Calm Mini — Sensory Worry Stone Set";
  }

  function storeFromStorage(rawV2, rawV1) {
    if (rawV2 != null && rawV2 !== "") {
      try {
        var data = JSON.parse(rawV2);
        var dossiers = data && Array.isArray(data.dossiers) ? data.dossiers.map(normalizeDossier).filter(Boolean) : [];
        return { version: 1, dossiers: dossiers, migrated: false, fresh: false };
      } catch (err) {
        return { version: 1, dossiers: sampleLibrary(), migrated: false, fresh: true, corrupt: true };
      }
    }
    if (rawV1 != null && rawV1 !== "") {
      try {
        var legacy = JSON.parse(rawV1);
        var evals = legacy && Array.isArray(legacy.evals) ? legacy.evals : [];
        var kept = [];
        var sawPebble = false;
        for (var i = 0; i < evals.length; i++) {
          if (isUntouchedPebble(evals[i])) { sawPebble = true; continue; }
          var d = normalizeDossier(evals[i]);
          if (d) kept.push(d);
        }
        if (!kept.length) return { version: 1, dossiers: sampleLibrary(), migrated: true, fresh: false, replacedSample: sawPebble };
        return { version: 1, dossiers: kept, migrated: true, fresh: false };
      } catch (err2) {
        return { version: 1, dossiers: sampleLibrary(), migrated: false, fresh: true, corrupt: true };
      }
    }
    return { version: 1, dossiers: sampleLibrary(), migrated: false, fresh: true };
  }

  function duplicateDossier(d) {
    var copy = clone(normalizeDossier(d));
    copy.id = uid();
    copy.sample = false;
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
        econ.landed == null ? "" : econ.landed.toFixed(2),
        econ.contribution == null ? "" : econ.contribution.toFixed(2),
        econ.contributionPct == null ? "" : econ.contributionPct.toFixed(2),
        econ.afterAds == null ? "" : econ.afterAds.toFixed(2),
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

    var calm = sampleCalmBin();
    var sample = scoreSummary(calm.criteria);
    check("sample num", sample.num === 185);
    check("sample den", sample.den === 43);
    check("sample hundredths", sample.hundredths === 430);
    check("sample band", sample.band && sample.band.id === "go");
    check("sample drags", sample.drags.map(function (d) { return d.id; }).join(",") === "reviews,competition,season,moat,margin,returns,channel");

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

    var econ = economics(calm);
    check("calm landed", Math.abs(econ.landed - 6.6004975) < 1e-6);
    check("calm contribution positive", econ.contribution > 8 && econ.contribution < 8.6);
    check("calm margin score 4", econ.marginScore === 4);
    check("calm breakeven", econ.breakevenUnits > 0 && econ.breakevenAfterAds > econ.breakevenUnits);
    check("calm annual", econ.annualAfterAds > 0);
    var moat = moatSummary(calm.moat);
    check("calm moat 3.75", moat.hundredths === 375 && moat.band.id === "conditional");
    check("calm moat suggest 4", suggestMoatRubricScore(moat) === 4);
    var comp = competitionInsight(calm.competitors);
    check("calm competition 3", comp && comp.score === 3 && comp.share > 0.4 && comp.share < 0.45);
    var brief = decisionBrief(calm);
    check("brief has GO", brief.indexOf("GO") >= 0);
    check("brief has barrier", brief.indexOf("3.75") >= 0);
    var summary = executiveSummary(calm);
    check("summary title", summary.indexOf("# Calm Bin") === 0);
    check("summary estimate", summary.indexOf("ESTIMATE") >= 0);
    check("summary fictional", summary.indexOf("FICTIONAL SAMPLE") >= 0);

    var bulk = sampleBulkRice();
    var bulkScore = scoreSummary(bulk.criteria);
    check("bulk pass", bulkScore.num === 110 && bulkScore.hundredths === 256 && bulkScore.band.id === "pass");
    var bulkComp = competitionInsight(bulk.competitors);
    check("bulk competition 2", bulkComp && bulkComp.score === 2);
    var bulkEcon = economics(bulk);
    check("bulk margin score 3", bulkEcon.marginScore === 3);
    var bulkMoat = moatSummary(bulk.moat);
    check("bulk moat pass", bulkMoat.band.id === "pass" && suggestMoatRubricScore(bulkMoat) === 2);

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
    check("legacy pebble replaced", legacy.migrated && legacy.dossiers.length === 2 && legacy.dossiers[0].id === "sample-calm-bin-kit");
    var legacyKept = storeFromStorage(null, JSON.stringify({ version: 1, evals: [{
      id: "real-1", productName: "My scoop", asinOrUrl: "B00REAL123", categoryNotes: "notes stay",
      date: "2026-09-01", sample: false, criteria: criteriaFromScores({ repeat: 4 }, {})
    }] }));
    check("legacy real kept", legacyKept.dossiers.length === 1 && legacyKept.dossiers[0].productName === "My scoop" && legacyKept.dossiers[0].overview.notes === "notes stay");
    check("fresh seeds", storeFromStorage(null, null).fresh && storeFromStorage(null, null).dossiers.length === 2);

    var blankEcon = economics(blankDossier());
    check("blank landed null", blankEcon.landed == null && blankEcon.contribution == null);
    var csvOut = dossiersToCsv([calm]);
    check("csv has product and competitor", csvOut.indexOf("product,") >= 0 && csvOut.indexOf("B0OATS0001") >= 0 && csvOut.indexOf("criterion,") >= 0);
    var imported = parseDossierImport(JSON.stringify(dossiersToJson([calm, bulk])));
    check("roundtrip import", imported.dossiers.length === 2 && imported.dossiers[0].productName.indexOf("Calm Bin") === 0);
    check("money", money(6997.2) === "$6,997.20" && money(null) === "—");
    check("listing href", listingHref("B0SOTDEMO1") === "https://www.amazon.com/dp/B0SOTDEMO1");
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
    sampleCalmBin: sampleCalmBin,
    sampleBulkRice: sampleBulkRice,
    sampleLibrary: sampleLibrary,
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
