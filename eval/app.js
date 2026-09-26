/* Sensationally OT product dossier UI. Talks only to localStorage. */
(function () {
  var L = window.DossierLogic;
  var app = document.getElementById("app");
  if (!L || !app) {
    if (app) app.textContent = "Dossier scripts failed to load.";
    return;
  }

  var storageBlocked = false;
  var store = { version: 1, dossiers: [] };
  var comparePick = [];
  var toastTimer = 0;
  var mathFails = [];
  var sectionObserver = null;

  function readStorage(key) {
    try { return localStorage.getItem(key); }
    catch (err) { storageBlocked = true; return null; }
  }

  function persist() {
    try {
      localStorage.setItem(L.STORAGE_KEY, JSON.stringify({ version: 1, baselinesSeeded: store.baselinesSeeded === true, dossiers: store.dossiers }));
      storageBlocked = false;
      return true;
    } catch (err) {
      storageBlocked = true;
      return false;
    }
  }

  function boot() {
    var rawV2 = readStorage(L.STORAGE_KEY);
    var rawV1 = readStorage(L.LEGACY_KEY);
    if (storageBlocked && rawV2 == null && rawV1 == null) {
      store = { version: 1, dossiers: L.sampleLibrary(), baselinesSeeded: true, fresh: true, blocked: true };
    } else {
      store = L.storeFromStorage(rawV2, rawV1);
      if ((store.fresh || store.migrated || store.upgraded) && !storageBlocked) persist();
    }
    try { mathFails = L.selfCheck(); }
    catch (err) { mathFails = [String(err && err.message ? err.message : err)]; }
    document.body.dataset.math = mathFails.length ? "fail" : "ok";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function route() {
    var q = new URLSearchParams(location.search);
    if (q.get("compare")) {
      return { name: "compare", ids: q.get("compare").split(",").filter(Boolean).slice(0, 3) };
    }
    if (q.get("id")) return { name: "product", id: q.get("id") };
    return { name: "library" };
  }

  function go(params) {
    var usp = new URLSearchParams();
    if (params && params.id) usp.set("id", params.id);
    if (params && params.compare) usp.set("compare", params.compare);
    var s = usp.toString();
    history.pushState({}, "", location.pathname + (s ? "?" + s : ""));
    render();
    window.scrollTo(0, 0);
  }

  function byId(id) {
    for (var i = 0; i < store.dossiers.length; i++) {
      if (store.dossiers[i].id === id) return store.dossiers[i];
    }
    return null;
  }

  function current() {
    var r = route();
    return r.name === "product" ? byId(r.id) : null;
  }

  function sorted() {
    return store.dossiers.slice().sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }

  function touch(d) { d.updatedAt = new Date().toISOString(); }

  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function formatWhen(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function numVal(v) { return v == null || v === "" ? "" : String(v); }

  function field(label, control, span) {
    return "<label class=\"field" + (span ? " " + span : "") + "\">" + label + control + "</label>";
  }

  function textInput(bind, value, opts) {
    opts = opts || {};
    var kind = opts.kind || "text";
    var type = opts.type || "text";
    return "<input data-bind=\"" + esc(bind) + "\" data-kind=\"" + kind + "\" type=\"" + type + "\" value=\"" + esc(numVal(value)) + "\"" +
      (opts.max ? " maxlength=\"" + opts.max + "\"" : "") +
      (opts.placeholder ? " placeholder=\"" + esc(opts.placeholder) + "\"" : "") +
      (opts.step ? " step=\"" + opts.step + "\"" : "") +
      (opts.min != null ? " min=\"" + opts.min + "\"" : "") +
      (opts.maxNum != null ? " max=\"" + opts.maxNum + "\"" : "") +
      (opts.autofocus ? " data-autofocus=\"1\"" : "") +
      " autocomplete=\"off\" />";
  }

  function area(bind, value, placeholder) {
    return "<textarea data-bind=\"" + esc(bind) + "\" data-kind=\"text\" maxlength=\"2000\" rows=\"3\" placeholder=\"" + esc(placeholder || "") + "\">" + esc(value || "") + "</textarea>";
  }

  function selectBox(bind, value, options) {
    var html = "<select data-bind=\"" + esc(bind) + "\" data-kind=\"select\">";
    for (var i = 0; i < options.length; i++) {
      html += "<option value=\"" + esc(options[i][0]) + "\"" + (options[i][0] === value ? " selected" : "") + ">" + esc(options[i][1]) + "</option>";
    }
    return html + "</select>";
  }

  function banners() {
    var html = "";
    if (mathFails.length) html += "<div class=\"banner error\">Scoring self-check failed: " + esc(mathFails.join("; ")) + "</div>";
    if (storageBlocked) html += "<div class=\"banner error\">This browser blocked local save. You can still edit, but a refresh will clear it.</div>";
    if (store.replacedFiction || store.replacedSample) {
      html += "<div class=\"banner\">Fictional samples were replaced with the 2026-09-26 Mermaid and Farm Sellerboard baselines. Competitor rows stay empty until you paste Helium 10.</div>";
    } else if (store.migrated) {
      html += "<div class=\"banner\">Saved scorecards are now dossiers. Competition, China cost, and moat notes start empty until you fill them. Rubric scores were kept.</div>";
    }
    return html;
  }

  function footer() {
    return "<footer>Sensationally OT sourcing desk · Saved in this browser under <code>" + esc(L.STORAGE_KEY) + "</code> · No Amazon or Helium 10 API · <a href=\"/\">Site home</a></footer>";
  }

  function libraryHtml() {
    var list = sorted();
    var cards = "";
    if (!list.length) {
      cards = "<p class=\"empty\">No products yet. Start a dossier, or restore the Sellerboard baselines.</p>";
    } else {
      cards = list.map(cardHtml).join("");
    }
    var anyBaseline = list.some(function (d) { return d.baseline; });
    var anySample = list.some(function (d) { return d.sample; });
    var sampleNote = "";
    if (anyBaseline) {
      sampleNote = "<div class=\"banner\"><strong>Mermaid is the healthy baseline.</strong> Sep 2026 MTD Sellerboard net about +$8.90 per unit (~22% of $39.95) on a $13.50 Products Cost. <strong>Farm is Conditional and underwater</strong> at current ads and fees: net about −$3.77, Products Cost $14.00, blended fees about $18. China versus freight is not split. Competitor tables are empty until you paste Helium 10. Repeat, gift, and OT-fit scores are product-type starters, not Sellerboard measures.</div>";
    }
    if (anySample) {
      sampleNote += "<div class=\"banner\"><strong>A dossier is still marked fictional.</strong> Those rows are not marketplace data.</div>";
    }
    return "<div class=\"wrap\"><main id=\"main\">" +
      "<header class=\"hero\"><div>" +
      "<p class=\"eyebrow\">Sensationally OT · sourcing desk</p>" +
      "<h1>Product dossiers</h1>" +
      "<p class=\"subtitle\">One page per product for an Amazon FBA decision: Sellerboard cost and net, a China build-up when you have the split, competitors you paste from Helium 10, and Shak’s rubric. Mermaid is the healthy baseline. Farm is underwater at current ads and fees.</p>" +
      "<div class=\"meta\"><span class=\"chip\">Manual + paste</span><span class=\"chip\">GO at 4.20</span><span class=\"chip\">Saved in this browser</span><a class=\"chip\" href=\"/\">Site home</a></div>" +
      "<div class=\"hero-actions\"><button type=\"button\" class=\"primary lg\" data-action=\"new\">New product</button>" +
      "<button type=\"button\" data-action=\"restore-samples\">Restore baselines</button>" +
      "<button type=\"button\" data-action=\"export-json\">Export JSON</button>" +
      "<button type=\"button\" data-action=\"export-csv\">Export CSV</button>" +
      "<button type=\"button\" data-action=\"import-json\">Import JSON</button>" +
      "<input id=\"import-file\" type=\"file\" accept=\"application/json,.json\" hidden /></div></div>" +
      "<aside class=\"side-card\"><h2>How a verdict gets earned</h2><ol>" +
      "<li><strong>Overview</strong> — the listing you opened</li>" +
      "<li><strong>Competition</strong> — Helium-style rows, typed or pasted</li>" +
      "<li><strong>China cost</strong> — Sellerboard Products Cost, or a China + freight build-up</li>" +
      "<li><strong>Maker</strong> — wedge, gift, realistic units</li>" +
      "<li><strong>Moat</strong> — barriers, then a barrier index</li>" +
      "<li><strong>Rubric</strong> — Shak’s weights. GO at 4.20, Conditional from 3.40, Pass below</li>" +
      "</ol><p class=\"fine\">N/A, Hide, and weight 0 stay out of the average. Core screen: repeat purchase inside about a year, giftability, not bulky, easy repack, custom enough that China cannot hand the same unit to everyone.</p></aside></header>" +
      banners() + sampleNote +
      "<div class=\"card-grid\">" + cards + "</div>" +
      "<div class=\"compare-bar\" id=\"compare-bar\" hidden><p id=\"compare-count\" class=\"fine\" style=\"margin:0\"></p><div class=\"row-actions\"><button type=\"button\" class=\"primary\" data-action=\"compare-go\">Compare</button><button type=\"button\" data-action=\"compare-clear\">Clear</button></div></div>" +
      footer() + "</main></div>";
  }

  function cardHtml(d) {
    var rubric = L.scoreSummary(d.criteria);
    var econ = L.economics(d);
    var moat = L.moatSummary(d.moat);
    var band = rubric.band ? rubric.band.id : "none";
    var bandLabel = rubric.band ? rubric.band.label : "Unscored";
    var avg = rubric.hundredths == null ? "—" : L.formatHundredths(rubric.hundredths);
    var netLine = econ.reportedNet != null
      ? "Net " + L.money(econ.reportedNet)
      : (econ.monthlyRevenuePlan == null ? "No unit plan yet" : L.money(econ.monthlyRevenuePlan) + " / mo plan");
    var costLine = econ.cogs == null ? "Cost —" : (econ.cogsSource === "sellerboard" ? "Products Cost " : "Landed ") + L.money(econ.cogs);
    var moatLine = moat.hundredths == null ? "Moat not scored" : "Moat " + L.formatHundredths(moat.hundredths) + " " + moat.band.label;
    var checked = comparePick.indexOf(d.id) >= 0 ? " checked" : "";
    var asin = (d.asinOrUrl || "").trim() || "No ASIN";
    var sku = (d.overview.sku || "").trim();
    var status = econ.commercial;
    return "<article class=\"product-card\"><div class=\"badges\">" +
      (status ? "<span class=\"band " + status.id + "\">" + esc(status.label) + "</span>" : "") +
      "<span class=\"band " + band + "\">Rubric " + esc(bandLabel) + " " + esc(avg) + "</span>" +
      (d.baseline ? "<span class=\"chip\">Sellerboard " + esc(L.BASELINES.asOf) + "</span>" : "") +
      (d.sample ? "<span class=\"chip\">Fictional sample</span>" : "") +
      "</div><h3><button type=\"button\" class=\"card-title\" data-action=\"open\" data-id=\"" + esc(d.id) + "\">" + esc(d.productName || "Untitled product") + "</button></h3>" +
      "<div class=\"facts\"><div>" + esc(asin) + (sku ? " · " + esc(sku) : "") + "</div><div>" + esc(netLine) + " · " + esc(costLine) + "</div><div>" + esc(moatLine) + "</div><div>Updated " + esc(formatWhen(d.updatedAt)) + "</div></div>" +
      "<div class=\"row-actions\"><button type=\"button\" class=\"primary\" data-action=\"open\" data-id=\"" + esc(d.id) + "\">Open</button>" +
      "<button type=\"button\" data-action=\"duplicate\" data-id=\"" + esc(d.id) + "\">Duplicate</button>" +
      "<button type=\"button\" class=\"danger\" data-action=\"delete\" data-id=\"" + esc(d.id) + "\">Delete</button></div>" +
      "<label class=\"check\"><input type=\"checkbox\" data-pick=\"" + esc(d.id) + "\"" + checked + " /> Compare</label></article>";
  }

  function productHtml(id) {
    var d = byId(id);
    if (!d) {
      return "<div class=\"wrap\"><main id=\"main\"><div class=\"panel\"><h1>Product not found</h1><p class=\"intro\">That dossier is not in this browser.</p><button type=\"button\" class=\"primary\" data-action=\"back\">Back to library</button></div>" + footer() + "</main></div>";
    }
    var autofocus = !d.productName && !d.sample && !d.baseline;
    return "<div class=\"wrap\"><a class=\"skip\" href=\"#overview\">Skip to dossier</a>" +
      "<div class=\"sticky-stack\"><div class=\"identity\">" +
      "<div class=\"identity-main\"><button type=\"button\" class=\"texty\" data-action=\"back\">← Library</button>" +
      textInput("productName", d.productName, { max: 140, placeholder: "Product name", autofocus: autofocus }).replace("input ", "input class=\"name-input\" ") +
      "<p class=\"fine\" style=\"margin:.2rem 0 0\"><span id=\"asin-slot\"></span> · <span id=\"sku-slot\"></span> · <span id=\"save-state\"></span></p></div>" +
      "<div class=\"identity-score\"><p class=\"avg\" id=\"verdict-avg\">—</p><p><span class=\"band none\" id=\"verdict-band\">Unscored</span></p><p class=\"fine\" id=\"verdict-formula\"></p></div>" +
      "<div class=\"identity-actions\"><button type=\"button\" class=\"primary\" data-action=\"copy\">Copy summary</button>" +
      "<button type=\"button\" data-action=\"export-json-one\">JSON</button>" +
      "<button type=\"button\" data-action=\"export-csv-one\">CSV</button>" +
      "<button type=\"button\" data-action=\"duplicate\" data-id=\"" + esc(d.id) + "\">Duplicate</button>" +
      "<button type=\"button\" class=\"danger\" data-action=\"delete\" data-id=\"" + esc(d.id) + "\">Delete</button></div></div>" +
      "<div class=\"meter\" aria-hidden=\"true\"><span id=\"meter-fill\"></span></div>" +
      "<nav class=\"section-nav\" aria-label=\"Dossier sections\">" +
      navBtn("overview", "Overview") + navBtn("competition", "Competition") + navBtn("china", "China cost") +
      navBtn("maker", "Maker") + navBtn("moat", "Moat") + navBtn("rubric", "Rubric") +
      "</nav></div><main id=\"main\">" + banners() +
      "<div class=\"banner\" id=\"sample-banner\"><strong>Fictional sample.</strong> ASINs, sales, reviews, and costs on this page were written for the demo. They are not a Helium 10 or Amazon pull. Replace them before you treat the file as a sourcing decision. <div><button type=\"button\" data-action=\"clear-sample\">This is a real product</button></div></div>" +
      "<div class=\"banner\" id=\"baseline-banner\"><strong>Sellerboard baseline, 2026-09-26.</strong> Products Cost is all-in. China EXW/FOB and freight are blank on purpose. Blended Amazon fees replace referral plus FBA fulfillment. The gap to reported net is not an ad cost. Competitor rows stay empty until you paste Helium 10. Repeat, gift, and OT-fit are starters, not measured scores.</div>" +
      "<section class=\"panel decision\" aria-label=\"Decision\"><p class=\"kicker\">Decision</p><p id=\"decision-text\"></p>" +
      "<div class=\"kpis\">" +
      kpi("kpi-cogs", "Products cost") + kpi("kpi-fees", "Amazon fees") + kpi("kpi-contrib", "Contribution") +
      kpi("kpi-net", "Sellerboard net") + kpi("kpi-gap", "Not broken out") + kpi("kpi-moat", "Moat index") +
      "</div><p class=\"fine\">Sellerboard net is the Sep 2026 MTD figure when that field is filled. Contribution is sell price minus Products Cost minus fees, before the unexplained gap.</p></section>" +
      overviewSection(d) + competitionSection(d) + chinaSection(d) + makerSection(d) + moatSection(d) + rubricSection(d) +
      "<details class=\"summary-box\"><summary>Executive summary preview</summary><pre class=\"summary\" id=\"summary-preview\"></pre></details>" +
      footer() + "</main></div>";
  }

  function navBtn(id, label) {
    return "<button type=\"button\" data-nav=\"" + id + "\"" + (id === "overview" ? " class=\"is-on\"" : "") + ">" + label + "</button>";
  }

  function kpi(id, label) {
    return "<div class=\"kpi\" id=\"" + id + "\"><span>" + label + "</span><strong>—</strong><em></em></div>";
  }

  function overviewSection(d) {
    var o = d.overview;
    return "<section class=\"panel\" id=\"overview\" data-section><p class=\"kicker\">A · Listing</p><h2>Overview</h2>" +
      "<p class=\"intro\">What you saw when you opened the listing. The ASIN link only opens Amazon in a new tab. This page does not read it.</p>" +
      "<div class=\"fields cols-3\">" +
      field("ASIN or listing URL", textInput("asinOrUrl", d.asinOrUrl, { max: 500, placeholder: "B0XXXXXXXX or https://www.amazon.com/dp/…" }), "span-2") +
      field("Date scored", textInput("date", d.date, { type: "date" })) +
      field("SKU", textInput("overview.sku", o.sku, { max: 80, placeholder: "Seller SKU" })) +
      field("Category", textInput("overview.category", o.category, { max: 200, placeholder: "Optional browse path" }), "span-2") +
      field("Sell price ($)", textInput("overview.price", o.price, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "39.95" })) +
      field("Compare-at / list ($)", textInput("overview.listPrice", o.listPrice, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Optional" })) +
      field("BSR", textInput("overview.bsr", o.bsr, { max: 80, placeholder: "Only if you looked it up" })) +
      field("Review count", textInput("overview.reviewCount", o.reviewCount, { type: "number", kind: "int", min: 0, step: "1" })) +
      field("Rating", textInput("overview.rating", o.rating, { type: "number", kind: "rating", min: 0, maxNum: 5, step: "0.1" })) +
      field("Notes", area("overview.notes", o.notes, "What this snapshot does and does not include"), "span-3") +
      "</div></section>";
  }

  function competitionSection(d) {
    return "<section class=\"panel\" id=\"competition\" data-section><p class=\"kicker\">B · Helium-style desk</p><h2>Competition</h2>" +
      "<p class=\"intro\">Leaders you would actually be next to. Type them, or paste a Helium 10 CSV, TSV, or JSON export. Recognized headers include ASIN, Title, Price, Monthly Sales, ASIN Sales, Monthly Revenue, Review Count, Rating, and BSR / Sales Rank. Nothing is uploaded.</p>" +
      "<div class=\"split\"><div><div id=\"comp-rows\">" + competitorRowsHtml(d) + "</div>" +
      "<div class=\"toolbar\"><button type=\"button\" class=\"primary\" data-action=\"add-comp\">Add competitor</button></div>" +
      "<details class=\"summary-box\"><summary>Paste Helium 10 CSV, TSV, or JSON</summary>" +
      "<p class=\"fine\">Export from Cerebro, Black Box, Xray, or a spreadsheet. Revenue is optional — if you leave it blank here, the chart uses price × monthly sales.</p>" +
      "<textarea id=\"h10-paste\" rows=\"6\" placeholder=\"ASIN&#9;Title&#9;Price&#9;Monthly Sales&#9;Monthly Revenue&#9;Review Count&#9;Rating&#9;BSR\"></textarea>" +
      "<div class=\"h10-actions\" style=\"margin-top:.6rem\"><button type=\"button\" class=\"primary\" data-action=\"import-h10\">Import rows</button></div>" +
      "<label class=\"check\" style=\"margin-top:.55rem\"><input id=\"h10-replace\" type=\"checkbox\" /> Replace current rows</label>" +
      "<p class=\"fine\" id=\"h10-msg\"></p></details></div>" +
      "<div><h3>Revenue share</h3><p class=\"fine\" id=\"comp-totals\"></p><div id=\"comp-chart\"></div><div class=\"insight\" id=\"comp-insight\"></div></div></div></section>";
  }

  function competitorRowsHtml(d) {
    if (!d.competitors.length) return "<p class=\"empty\" id=\"comp-empty\">No competitor rows. Paste a Helium 10 export or add listings you looked up. The Sellerboard baselines do not include competitor sales.</p>";
    return d.competitors.map(function (row, index) {
      return "<article class=\"comp-card\" data-row=\"" + esc(row.id) + "\"><div class=\"comp-top\"><strong>Competitor " + (index + 1) + "</strong>" +
        "<button type=\"button\" class=\"danger\" data-action=\"remove-comp\" data-comp-id=\"" + esc(row.id) + "\">Remove</button></div>" +
        "<div class=\"comp-fields\">" +
        compField(row, "ASIN", "asin", "text", row.asin, "B0…") +
        compField(row, "Title", "title", "text", row.title, "Listing title") +
        compField(row, "Price", "price", "money", row.price, "0.00") +
        compField(row, "Mo. sales", "monthlySales", "int", row.monthlySales, "est.") +
        compField(row, "Mo. revenue", "monthlyRevenue", "money", row.monthlyRevenue, "auto") +
        compField(row, "Reviews", "reviews", "int", row.reviews, "") +
        compField(row, "Rating", "rating", "rating", row.rating, "") +
        compField(row, "BSR", "bsr", "text", row.bsr, "") +
        "</div><p class=\"fine\" data-rev-for=\"" + esc(row.id) + "\"></p></article>";
    }).join("");
  }

  function compField(row, label, key, kind, value, placeholder) {
    var type = kind === "text" ? "text" : "number";
    var extra = "";
    if (kind === "money") extra = " min=\"0\" step=\"0.01\"";
    if (kind === "int") extra = " min=\"0\" step=\"1\"";
    if (kind === "rating") extra = " min=\"0\" max=\"5\" step=\"0.1\"";
    return "<label class=\"field\">" + label +
      "<input data-comp-id=\"" + esc(row.id) + "\" data-comp-field=\"" + key + "\" data-kind=\"" + (kind === "text" ? "text" : kind) + "\" type=\"" + type + "\" value=\"" + esc(numVal(value)) + "\" placeholder=\"" + esc(placeholder) + "\"" + extra + " autocomplete=\"off\" /></label>";
  }

  function chinaSection(d) {
    var c = d.china;
    var o = d.overview;
    return "<section class=\"panel\" id=\"china\" data-section><p class=\"kicker\">C · Landed cost</p><h2>China / landed cost <span class=\"stamp\">ESTIMATE</span></h2>" +
      "<p class=\"intro\">Planning calculator, not a freight quote. Sellerboard Products Cost overrides the build-up. Otherwise China EXW/FOB + freight + duty + AWD/storage (packaging and spoilage optional, blank as zero) can be compared with Mermaid $13.50 and Farm $14.00. Those two numbers are all-in Products Cost — this page does not split them. Blended Amazon fees, when filled, replace referral plus FBA fulfillment. Referral ~15% stays a planning rate. Ads / TACOS is optional and is not the unexplained gap.</p>" +
      "<div class=\"toolbar\"><button type=\"button\" data-action=\"preset-mermaid\">Use Mermaid Sellerboard costs</button><button type=\"button\" data-action=\"preset-farm\">Use Farm Sellerboard costs</button></div>" +
      "<p class=\"fine\">Presets fill Products Cost, blended fees, and reported net. They leave China EXW/FOB and freight alone. A blank sell price becomes $39.95. Farm also fills compare-at $49.95 when that field is blank.</p>" +
      "<div class=\"split\"><div class=\"fields cols-3\">" +
      field("Sellerboard Products Cost ($)", textInput("china.productsCost", c.productsCost, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "All-in override" }), "span-3") +
      field("China EXW/FOB ($)", textInput("china.unitCost", c.unitCost, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Manual, not split yet" })) +
      field("Cost basis", selectBox("china.costBasis", c.costBasis, [["EXW", "EXW"], ["FOB", "FOB"]])) +
      field("Freight / unit ($)", textInput("china.freightPerUnit", c.freightPerUnit, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Manual" })) +
      field("Duty %", textInput("china.dutyPct", c.dutyPct, { type: "number", kind: "percent", min: 0, maxNum: 100, step: "0.1", placeholder: "Blank = 0 in the build-up" })) +
      field("AWD/storage estimate ($)", textInput("china.amazonInbound", c.amazonInbound, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Manual" })) +
      field("Shipping mode", selectBox("china.shippingMode", c.shippingMode, [["sea", "Sea"], ["air", "Air"]])) +
      field("MOQ (units)", textInput("china.moq", c.moq, { type: "number", kind: "int", min: 0, step: "1" })) +
      field("Packaging ($)", textInput("china.packaging", c.packaging, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Optional" })) +
      field("Spoilage buffer %", textInput("china.spoilagePct", c.spoilagePct, { type: "number", kind: "percent", min: 0, maxNum: 100, step: "0.1", placeholder: "Optional" })) +
      field("Blended Amazon fees ($)", textInput("china.amazonFeesBlended", c.amazonFeesBlended, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Sep MTD, per unit" })) +
      field("FBA fulfillment ($)", textInput("overview.fbaFees", o.fbaFees, { type: "number", kind: "money", min: 0, step: "0.01", placeholder: "Used only without blended fees" })) +
      field("Referral %", textInput("china.referralPct", c.referralPct, { type: "number", kind: "percent", min: 0, maxNum: 100, step: "0.1", placeholder: "~15 planning rate" })) +
      field("Ads / TACOS % (optional)", textInput("china.tacosPct", c.tacosPct, { type: "number", kind: "percent", min: 0, maxNum: 100, step: "0.1", placeholder: "Not the Sellerboard gap" })) +
      field("Sellerboard net ($ / unit)", textInput("china.reportedNet", c.reportedNet, { type: "number", kind: "signed", step: "0.01", placeholder: "Sep MTD, can be negative" })) +
      field("Cost notes", area("china.notes", c.notes, "What Products Cost includes, and what is still unsplit"), "span-3") +
      "</div><div class=\"result-card\" id=\"econ-out\"></div></div></section>";
  }

  function makerSection(d) {
    var m = d.maker;
    return "<section class=\"panel\" id=\"maker\" data-section><p class=\"kicker\">D · Why we would make it</p><h2>Maker opportunity</h2>" +
      "<p class=\"intro\">The commercial wedge, not a second scorecard. Annual profit is margin × units × 12 from the China section. It is a planning figure.</p>" +
      "<div class=\"fields\">" +
      field("Why this product", area("maker.why", m.why, "The job the buyer is hiring it for")) +
      field("White space vs leaders", area("maker.whitespace", m.whitespace, "What the top listings are not")) +
      field("Kit / customization angle", area("maker.kitAngle", m.kitAngle, "Mold, print, formula, bundle")) +
      field("Gift + OT / sensory angle", area("maker.giftOtAngle", m.giftOtAngle, "Who buys it for someone else, and why it fits Sensationally OT")) +
      "</div><div class=\"fields cols-3\" style=\"margin-top:.7rem\">" +
      field("Price band low ($)", textInput("maker.priceBandLow", m.priceBandLow, { type: "number", kind: "money", min: 0, step: "0.01" })) +
      field("Price band high ($)", textInput("maker.priceBandHigh", m.priceBandHigh, { type: "number", kind: "money", min: 0, step: "0.01" })) +
      field("Expected monthly units", textInput("maker.monthlyUnits", m.monthlyUnits, { type: "number", kind: "int", min: 0, step: "1", placeholder: "Realistic share" })) +
      field("Share note", area("maker.shareNote", m.shareNote, "What slice of the tracked set this unit plan assumes"), "span-3") +
      "</div><div class=\"result-card\" id=\"maker-out\" style=\"margin-top:.8rem\"></div></section>";
  }

  function moatSection(d) {
    var blocks = L.MOAT_ITEMS.map(function (item) {
      var score = d.moat.scores[item.id];
      var note = d.moat.notes[item.id] || "";
      return "<article class=\"card\"><div class=\"card-top\"><div><h3>" + esc(item.name) + "</h3><p class=\"why\">" + esc(item.hint) + "</p></div></div>" +
        "<div class=\"card-body\"><div class=\"scores\" role=\"group\" aria-label=\"" + esc(item.name) + " score\">" + scoreBtns("data-moat", item.id, score) + "</div>" +
        "<label class=\"field\">Note<textarea data-bind=\"moat.notes." + item.id + "\" data-kind=\"text\" maxlength=\"400\" rows=\"2\">" + esc(note) + "</textarea></label></div></article>";
    }).join("");
    return "<section class=\"panel\" id=\"moat\" data-section><p class=\"kicker\">E · Barriers</p><h2>Moat and barriers</h2>" +
      "<p class=\"intro\">Score 1–5. Five is the favorable case: easier to defend, lighter capital, lower copy risk, less review catch-up. The index is an equal-weight average, rounded like the rubric. It suggests the China-exclusivity row; it does not overwrite it.</p>" +
      "<div class=\"result-card\" id=\"moat-out\"></div>" + blocks +
      "<div class=\"fields\" style=\"margin-top:.8rem\">" +
      field("Barriers for others", area("moat.barriersForOthers", d.moat.barriersForOthers, "What would stop the next seller")) +
      field("Our moat plan", area("moat.ourPlan", d.moat.ourPlan, "What we will actually lock: plate, art, refill, contract")) +
      "</div></section>";
  }

  function scoreBtns(attr, id, score) {
    var extra = attr ? " " + attr + "=\"" + esc(id) + "\"" : "";
    var html = "";
    for (var n = 1; n <= 5; n++) {
      html += "<button type=\"button\"" + extra + " data-score=\"" + n + "\" aria-pressed=\"" + (score === n ? "true" : "false") + "\">" + n + "</button>";
    }
    html += "<button type=\"button\"" + extra + " data-score=\"na\" aria-pressed=\"" + (score == null ? "true" : "false") + "\">N/A</button>";
    return html;
  }

  function rubricSection(d) {
    return "<section class=\"panel\" id=\"rubric\" data-section><p class=\"kicker\">F · Shak’s scorecard</p><h2>Rubric</h2>" +
      "<p class=\"intro\">Score 1–5. Five is always the favorable case, including inverse rows (size, returns, seasonality). Weight 0 or Hide drops the row. The verdict uses the weighted average, half-up to two decimals: <strong>GO 4.20+</strong>, <strong>Conditional 3.40–4.19</strong>, <strong>Pass below 3.40</strong>.</p>" +
      "<div id=\"rubric-insights\"></div><div id=\"criteria\">" + criteriaHtml(d) + "</div>" +
      "<form id=\"add-form\" class=\"add-form\"><h3>Add a custom criterion</h3><div class=\"fields cols-3\">" +
      "<label class=\"field span-2\">Name<input id=\"add-name\" type=\"text\" maxlength=\"80\" placeholder=\"e.g. Bundle attach rate\" /></label>" +
      "<label class=\"field\">Weight<input id=\"add-weight\" type=\"number\" min=\"0\" max=\"5\" step=\"1\" value=\"3\" /></label>" +
      "<label class=\"field span-3\">Why it matters<input id=\"add-why\" type=\"text\" maxlength=\"600\" placeholder=\"Score 5 means the favorable case.\" /></label></div>" +
      "<label class=\"check\" style=\"margin:.6rem 0\"><input id=\"add-inverse\" type=\"checkbox\" /> Inverse — a high score means the risk is low</label>" +
      "<button type=\"submit\" class=\"primary\">Add criterion</button></form>" +
      "<div class=\"toolbar\"><button type=\"button\" data-action=\"reset-weights\">Reset weights</button></div>" +
      "<h3 style=\"margin-top:1rem\">Breakdown</h3><p class=\"fine\" id=\"formula-line\"></p><div class=\"breakdown\" id=\"breakdown\"></div><div id=\"drags\"></div></section>";
  }

  function criteriaHtml(d) {
    return d.criteria.map(function (c) {
      var linked = c.id === "moat" || c.id === "competition" || c.id === "margin";
      var badges = [
        c.core ? "<span class=\"chip chip-core\">Core</span>" : "",
        !c.core && !c.custom ? "<span class=\"chip\">Starter</span>" : "",
        c.custom ? "<span class=\"chip\">Custom</span>" : "",
        c.inverse ? "<span class=\"chip chip-inv\">Inverse</span>" : "",
        linked ? "<span class=\"chip chip-link\">Linked</span>" : ""
      ].join("");
      var title = c.custom
        ? "<input data-crit=\"name\" type=\"text\" maxlength=\"80\" value=\"" + esc(c.name) + "\" aria-label=\"Custom criterion name\" />"
        : "<h3>" + esc(c.name) + "</h3>";
      var remove = c.custom ? "<button type=\"button\" data-action=\"remove-criterion\">Remove</button>" : "";
      var cls = "card" + (c.hidden ? " is-hidden" : "") + (linked ? " is-linked" : "");
      return "<article class=\"" + cls + "\" data-cid=\"" + esc(c.id) + "\"><div class=\"card-top\"><div>" + title +
        "<div class=\"badges\">" + badges + "</div></div><div class=\"card-actions\">" +
        "<button type=\"button\" data-action=\"why\" aria-expanded=\"false\">Why it matters</button>" +
        "<button type=\"button\" data-action=\"hide\" aria-pressed=\"" + (c.hidden ? "true" : "false") + "\">" + (c.hidden ? "Include" : "Hide") + "</button>" +
        remove + "</div></div><p class=\"why\" hidden>" + esc(c.why || "Score 5 as the strongest favorable case.") + "</p>" +
        "<div class=\"card-body\"><div class=\"weight-row\"><label>Weight <strong data-weight-label>" + c.weight + "</strong></label>" +
        "<input class=\"range\" data-role=\"weight-range\" data-crit=\"weight\" type=\"range\" min=\"0\" max=\"5\" step=\"1\" value=\"" + c.weight + "\" aria-label=\"Weight for " + esc(c.name) + "\" />" +
        "<input data-role=\"weight-num\" data-crit=\"weight\" type=\"number\" min=\"0\" max=\"5\" step=\"1\" value=\"" + c.weight + "\" aria-label=\"Weight number for " + esc(c.name) + "\" /></div>" +
        "<div><span class=\"fine\" style=\"margin:0 0 .35rem;display:block\">Score</span><div class=\"scores\" role=\"group\" aria-label=\"Score for " + esc(c.name) + "\">" +
        scoreBtns("", "", c.score) + "</div></div>" +
        "<label class=\"field\">Notes<textarea data-crit=\"notes\" maxlength=\"800\" rows=\"2\" placeholder=\"What you saw\">" + esc(c.notes) + "</textarea></label>" +
        "<p class=\"status\" data-status></p></div></article>";
    }).join("");
  }

  function compareHtml(ids) {
    var dossiers = [];
    for (var i = 0; i < ids.length; i++) {
      var d = byId(ids[i]);
      if (d) dossiers.push(d);
    }
    var body = dossiers.length < 2
      ? "<p class=\"empty\">Pick two or three products from the library. This compare link is missing a pair.</p>"
      : compareTable(dossiers);
    return "<div class=\"wrap\"><main id=\"main\"><div class=\"page-head\"><div><button type=\"button\" class=\"texty\" data-action=\"back\">← Library</button><h1>Compare</h1><p class=\"intro\">Side by side on the decision, not only the rubric. Each average still uses that product’s own weights.</p></div></div>" +
      banners() + "<section class=\"panel\">" + body + "</section>" + footer() + "</main></div>";
  }

  function compareTable(dossiers) {
    var summaries = dossiers.map(function (d) { return L.scoreSummary(d.criteria); });
    var best = -1;
    for (var i = 0; i < summaries.length; i++) {
      if (summaries[i].hundredths != null && summaries[i].hundredths > best) best = summaries[i].hundredths;
    }
    function bestClass(index, asNum) {
      var hit = summaries[index].hundredths != null && summaries[index].hundredths === best && best >= 0;
      if (!hit) return asNum ? " class=\"num\"" : "";
      return asNum ? " class=\"num best\"" : " class=\"best\"";
    }
    var head = "<th>Metric</th>";
    for (var h = 0; h < dossiers.length; h++) {
      head += "<th" + bestClass(h, false) + "><button type=\"button\" class=\"texty\" data-action=\"open\" data-id=\"" + esc(dossiers[h].id) + "\">" + esc(dossiers[h].productName || "Untitled") + "</button></th>";
    }
    function row(label, cells) {
      var html = "<tr><th>" + esc(label) + "</th>";
      for (var c = 0; c < cells.length; c++) html += cells[c];
      return html + "</tr>";
    }
    function cell(index, text) {
      return "<td" + bestClass(index, true) + ">" + esc(text) + "</td>";
    }
    var metrics = [
      ["Verdict", function (d, s) { return s.band ? s.band.label : "—"; }],
      ["Weighted average", function (d, s) { return s.hundredths == null ? "—" : L.formatHundredths(s.hundredths); }],
      ["Sell price", function (d) { return L.money(d.overview.price); }],
      ["Compare-at / list", function (d) { return L.money(d.overview.listPrice); }],
      ["Products cost / landed", function (d) { var e = L.economics(d); return e.cogs == null ? "—" : L.money(e.cogs); }],
      ["Amazon fees", function (d) { var e = L.economics(d); return e.feeStack == null ? "—" : L.money(e.feeStack); }],
      ["Contribution", function (d) { var e = L.economics(d); return e.contribution == null ? "—" : L.money(e.contribution) + " (" + L.pct(e.contributionPct) + ")"; }],
      ["Sellerboard net", function (d) { var e = L.economics(d); return e.reportedNet == null ? "—" : L.money(e.reportedNet) + (e.marginPctUsed == null ? "" : " (" + L.pct(e.marginPctUsed) + ")"); }],
      ["After TACOS", function (d) { var e = L.economics(d); return e.afterAds == null ? "—" : L.money(e.afterAds) + " (" + L.pct(e.afterAdsPct) + ")"; }],
      ["Monthly units", function (d) { return L.formatInt(d.maker.monthlyUnits); }],
      ["Plan revenue / mo", function (d) { return L.money(L.economics(d).monthlyRevenuePlan); }],
      ["Annual after fees", function (d) { return L.money(L.economics(d).annualAfterAds); }],
      ["Moat index", function (d) { var m = L.moatSummary(d.moat); return m.hundredths == null ? "—" : L.formatHundredths(m.hundredths) + " " + m.band.label; }],
      ["Leader revenue share", function (d) { var c = L.competitionInsight(d.competitors); return c ? Math.round(c.share * 100) + "%" : "—"; }]
    ];
    var body = metrics.map(function (metric) {
      return row(metric[0], dossiers.map(function (d, index) {
        return cell(index, metric[1](d, summaries[index]));
      }));
    }).join("");
    var order = [];
    var names = {};
    for (var di = 0; di < L.DEFAULTS.length; di++) {
      order.push(L.DEFAULTS[di].id);
      names[L.DEFAULTS[di].id] = L.DEFAULTS[di].name;
    }
    for (var p = 0; p < dossiers.length; p++) {
      for (var k = 0; k < dossiers[p].criteria.length; k++) {
        var crit = dossiers[p].criteria[k];
        if (!names[crit.id]) { order.push(crit.id); names[crit.id] = crit.name; }
      }
    }
    for (var r = 0; r < order.length; r++) {
      var id = order[r];
      body += row(names[id], dossiers.map(function (d, index) {
        var c = L.findCriterion(d, id);
        if (!c || c.hidden || L.clampWeight(c.weight) <= 0 || c.score == null) return cell(index, "—");
        return cell(index, String(c.score));
      }));
    }
    var note = best >= 0 ? " Highlighted column is the highest rubric average." : "";
    return "<p class=\"fine\">" + dossiers.length + " products." + note + " A dash is missing, N/A, hidden, or weight 0.</p>" +
      "<div class=\"table-scroll\"><table class=\"compare\"><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function readValue(el, kind) {
    var value = el.value;
    if (kind === "text" || kind === "select") return kind === "text" ? value : value;
    if (String(value).trim() === "") return null;
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (kind === "int") n = Math.round(n);
    if (kind === "percent" || kind === "rating") {
      var cap = kind === "rating" ? 5 : 100;
      n = Math.min(cap, Math.max(0, n));
    } else if (kind === "signed") {
      if (n < -100000) n = -100000;
    } else if (n < 0) n = 0;
    if (n > 1000000000) n = 1000000000;
    return n;
  }

  function setPath(obj, path, value) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") return;
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function compById(d, id) {
    for (var i = 0; i < d.competitors.length; i++) if (d.competitors[i].id === id) return d.competitors[i];
    return null;
  }

  function criterionFrom(el) {
    var card = el.closest("[data-cid]");
    var d = current();
    if (!card || !d) return null;
    return { card: card, c: L.findCriterion(d, card.dataset.cid), d: d };
  }

  function commitControl(t) {
    var d = current();
    if (!d || !t || !t.dataset) return false;
    if (t.dataset.bind) {
      var kind = t.dataset.kind || "text";
      var value = kind === "select" ? t.value : readValue(t, kind);
      if (t.dataset.bind === "productName") value = String(value || "").slice(0, 140);
      setPath(d, t.dataset.bind, value);
    } else if (t.dataset.compId && t.dataset.compField) {
      var row = compById(d, t.dataset.compId);
      if (!row) return false;
      var raw = readValue(t, t.dataset.kind || "text");
      if (t.dataset.compField === "asin" || t.dataset.compField === "title" || t.dataset.compField === "bsr") {
        row[t.dataset.compField] = String(raw || "").slice(0, t.dataset.compField === "title" ? 180 : 80);
      } else row[t.dataset.compField] = raw;
    } else if (t.dataset.crit) {
      var hit = criterionFrom(t);
      if (!hit || !hit.c) return false;
      if (t.dataset.crit === "notes") hit.c.notes = t.value.slice(0, 800);
      else if (t.dataset.crit === "name") {
        hit.c.name = t.value.slice(0, 80);
        if (t.value.trim()) hit.c.short = t.value.trim().slice(0, 12);
      } else if (t.dataset.crit === "weight") {
        if (t.value === "") return false;
        hit.c.weight = L.clampWeight(t.value);
        var label = hit.card.querySelector("[data-weight-label]");
        if (label) label.textContent = String(hit.c.weight);
        var range = hit.card.querySelector("[data-role=weight-range]");
        var num = hit.card.querySelector("[data-role=weight-num]");
        if (range && range !== t) range.value = String(hit.c.weight);
        if (num && num !== t) num.value = String(hit.c.weight);
      } else return false;
    } else return false;
    touch(d);
    persist();
    paint();
    return true;
  }

  function setKpi(id, value, note, klass) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("go", "conditional", "pass", "is-bad");
    if (klass) el.classList.add(klass);
    var strong = el.querySelector("strong");
    var em = el.querySelector("em");
    if (strong) strong.textContent = value;
    if (em) em.textContent = note || "";
  }

  function paint() {
    var bar = document.getElementById("compare-bar");
    if (bar) {
      var n = comparePick.length;
      bar.hidden = n === 0;
      var count = document.getElementById("compare-count");
      if (count) {
        count.textContent = n === 1 ? "Select one more to compare." : "Ready to compare " + n + ".";
      }
      var goBtn = bar.querySelector("[data-action=compare-go]");
      if (goBtn) goBtn.disabled = n < 2;
      var boxes = app.querySelectorAll("[data-pick]");
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].disabled = n >= 3 && !boxes[i].checked;
      }
    }
    if (document.getElementById("verdict-avg")) paintProduct();
  }

  function paintProduct() {
    var d = current();
    if (!d) return;
    var rubric = L.scoreSummary(d.criteria);
    var econ = L.economics(d);
    var comp = L.competitionInsight(d.competitors);
    var moat = L.moatSummary(d.moat);
    paintVerdict(rubric);
    var save = document.getElementById("save-state");
    if (save) save.textContent = storageBlocked ? "Not saved in this browser" : "Saved in this browser · " + formatWhen(d.updatedAt);
    var slot = document.getElementById("asin-slot");
    if (slot) {
      var href = L.listingHref(d.asinOrUrl);
      var label = (d.asinOrUrl || "").trim();
      slot.innerHTML = href
        ? "<a id=\"asin-link\" href=\"" + esc(href) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + esc(label || "Open listing") + "</a>"
        : "No ASIN link yet";
    }
    var sample = document.getElementById("sample-banner");
    if (sample) sample.hidden = !d.sample;
    var baseline = document.getElementById("baseline-banner");
    if (baseline) baseline.hidden = !d.baseline;
    var skuSlot = document.getElementById("sku-slot");
    if (skuSlot) skuSlot.textContent = (d.overview.sku || "").trim() ? "SKU " + d.overview.sku.trim() : "No SKU";
    var decision = document.getElementById("decision-text");
    if (decision) decision.textContent = L.decisionBrief(d);
    paintKpis(d, econ, moat);
    var econOut = document.getElementById("econ-out");
    if (econOut) econOut.innerHTML = econHtml(econ);
    paintCompetition(d, comp, econ);
    var maker = document.getElementById("maker-out");
    if (maker) maker.innerHTML = makerHtml(d, econ, comp);
    var moatOut = document.getElementById("moat-out");
    if (moatOut) moatOut.innerHTML = moatHtml(moat);
    var insights = document.getElementById("rubric-insights");
    if (insights) insights.innerHTML = insightsHtml(d, econ, comp, moat);
    paintBreakdown(d, rubric);
    paintCriterionStatus(d, rubric);
    var preview = document.getElementById("summary-preview");
    if (preview) preview.textContent = L.executiveSummary(d);
    var titleScore = rubric.hundredths == null ? "Unscored" : (rubric.band.label + " " + L.formatHundredths(rubric.hundredths));
    document.title = (d.productName || "Untitled") + " · " + titleScore + " · Product dossier";
  }

  function paintVerdict(summary) {
    var avgEl = document.getElementById("verdict-avg");
    var bandEl = document.getElementById("verdict-band");
    var formula = document.getElementById("verdict-formula");
    var meter = document.getElementById("meter-fill");
    if (!avgEl || !bandEl) return;
    avgEl.className = "avg";
    bandEl.className = "band";
    if (meter) { meter.className = ""; meter.style.width = "0%"; }
    if (summary.hundredths == null) {
      avgEl.textContent = "—";
      bandEl.textContent = "Unscored";
      bandEl.classList.add("none");
      if (formula) formula.textContent = "No counted scores";
      return;
    }
    avgEl.textContent = L.formatHundredths(summary.hundredths);
    avgEl.classList.add(summary.band.id);
    bandEl.textContent = summary.band.id === "go" ? "GO" : summary.band.label;
    bandEl.classList.add(summary.band.id);
    if (formula) formula.textContent = summary.num + " ÷ " + summary.den;
    if (meter) {
      meter.className = summary.band.id;
      meter.style.width = Math.max(0, Math.min(100, summary.hundredths / 5)) + "%";
    }
  }

  function paintKpis(d, econ, moat) {
    var costNote = econ.cogs == null ? "Need Products Cost or China + freight" : (econ.cogsSource === "sellerboard" ? "Sellerboard override" : "Build-up");
    setKpi("kpi-cogs", econ.cogs == null ? "—" : L.money(econ.cogs), costNote);
    var feeNote = econ.feeStack == null ? "Blended, or referral + FBA" : (econ.feeSource === "blended" ? "Blended, referral not added" : "Referral + FBA fulfillment");
    setKpi("kpi-fees", econ.feeStack == null ? "—" : L.money(econ.feeStack), feeNote);
    var contribNote = econ.contributionPct == null ? "Need price and cost" : L.pct(econ.contributionPct) + " before the gap";
    setKpi("kpi-contrib", econ.contribution == null ? "—" : L.money(econ.contribution), contribNote, econ.contribution != null && econ.contribution < 0 ? "is-bad" : "");
    var netKlass = econ.commercial ? econ.commercial.id : "";
    var netNote = econ.reportedNet == null ? "Optional Sep MTD net" : (econ.marginPctUsed == null ? "" : L.pct(econ.marginPctUsed) + " of price");
    setKpi("kpi-net", econ.reportedNet == null ? "—" : L.money(econ.reportedNet), netNote, netKlass);
    var gapNote = econ.unexplainedGap == null ? (econ.afterAds == null ? "Not an ad cost" : L.pct(econ.afterAdsPct) + " after TACOS") : "Do not assign to ads";
    var gapValue = econ.unexplainedGap != null ? L.money(econ.unexplainedGap) : (econ.afterAds == null ? "—" : L.money(econ.afterAds));
    setKpi("kpi-gap", gapValue, gapNote);
    setKpi("kpi-moat", moat.hundredths == null ? "—" : L.formatHundredths(moat.hundredths), moat.band ? moat.band.label : "Score the barriers", moat.band ? moat.band.id : "");
  }

  function line(label, value, total) {
    return "<li" + (total ? " class=\"total\"" : "") + "><span>" + esc(label) + "</span><span>" + esc(value) + "</span></li>";
  }

  function econHtml(econ) {
    if (econ.cogs == null && econ.buildUp == null && econ.reportedNet == null) {
      return "<h3>Cost stack</h3><p class=\"empty\">Enter China EXW/FOB or freight, or a Sellerboard Products Cost. Duty, AWD/storage, packaging, and spoilage stay zero until you fill them.</p>";
    }
    var html = "<h3>Cost stack <span class=\"stamp\">ESTIMATE</span></h3><ul class=\"lines\">";
    if (econ.productsCost != null) html += line("Sellerboard Products Cost", L.money(econ.productsCost), true);
    if (econ.buildUp != null) {
      html += line(econ.costBasis + (econ.unit == null ? " · blank as $0" : ""), L.money(econ.unit || 0));
      html += line("Freight / unit (" + econ.shippingMode + ")" + (econ.freight == null ? " · blank as $0" : ""), L.money(econ.freight || 0));
      html += line("Duty " + (econ.dutyPct == null ? "0%" : L.pct(econ.dutyPct)) + " of " + L.money(econ.customs), L.money(econ.duty));
      html += line("AWD/storage" + (econ.inbound == null ? " · blank as $0" : ""), L.money(econ.inbound || 0));
      html += line("Packaging" + (econ.packaging == null ? " · blank as $0" : ""), L.money(econ.packaging || 0));
      html += line("Build-up after " + (econ.spoilagePct == null ? "0%" : L.pct(econ.spoilagePct)) + " spoilage", L.money(econ.buildUp), econ.productsCost == null);
      html += line("Versus Mermaid Products Cost $13.50", L.money(econ.gapVsMermaidCost));
      html += line("Versus Farm Products Cost $14.00", L.money(econ.gapVsFarmCost));
    }
    if (econ.productsCost != null && econ.buildUp != null) {
      html += line("Cost used", "Products Cost overrides the build-up");
    }
    if (econ.contribution != null) {
      if (econ.feeSource === "blended") html += line("Blended Amazon fees", L.money(econ.feeStack));
      else {
        html += line("Referral " + (econ.referralPct == null ? "(blank, counted as 0%)" : L.pct(econ.referralPct)), L.money(econ.referral));
        html += line("FBA fulfillment", L.money(econ.fba));
      }
      html += line("Contribution at " + L.money(econ.price), L.money(econ.contribution) + " · " + L.pct(econ.contributionPct), true);
      if (econ.afterAds != null && econ.reportedNet == null) html += line("After " + L.pct(econ.tacosPct) + " TACOS", L.money(econ.afterAds) + " · " + L.pct(econ.afterAdsPct), true);
      if (econ.cashTied != null) html += line("Cash tied at MOQ", L.money(econ.cashTied));
      if (econ.breakevenUnits != null) html += line("Breakeven units at contribution", L.formatInt(econ.breakevenUnits));
      else if (econ.contribution <= 0) html += line("Breakeven units", "No — contribution is not positive");
      if (econ.breakevenAfterAds != null) html += line("Breakeven units, after TACOS", L.formatInt(econ.breakevenAfterAds));
    } else if (econ.cogs != null) {
      html += line("Contribution", "Add a sell price");
    }
    if (econ.reportedNet != null) {
      html += line("Sellerboard net", L.money(econ.reportedNet) + (econ.marginPctUsed == null ? "" : " · " + L.pct(econ.marginPctUsed)), true);
      if (econ.unexplainedGap != null) html += line("Gap vs contribution", L.money(econ.unexplainedGap) + " · not an ad cost");
    }
    html += "</ul>";
    if (econ.feeSource === "blended") html += "<p class=\"fine\">Referral " + (econ.referralPct == null ? "is blank" : L.pct(econ.referralPct) + " is a planning rate") + " and is not added on top of blended fees.</p>";
    if (econ.blanksAsZero) html += "<p class=\"fine\">Unfilled China, freight, duty, AWD/storage, packaging, or spoilage counted as zero in the build-up.</p>";
    html += "<p class=\"fine\">Not a live freight quote. $13.50 and $14.00 are Sellerboard all-in costs, not a China versus freight recipe.</p>";
    return html;
  }

  function paintCompetition(d, comp, econ) {
    var totals = document.getElementById("comp-totals");
    if (totals) {
      if (!comp) totals.textContent = "No revenue in the table yet.";
      else {
        var unitBit = comp.trackedUnits != null ? " · " + L.formatInt(comp.trackedUnits) + " tracked units / mo" : "";
        totals.textContent = L.money(comp.trackedRevenue) + " tracked revenue / mo across " + comp.n + " rows" + unitBit + ".";
      }
    }
    var chart = document.getElementById("comp-chart");
    if (chart) chart.innerHTML = chartHtml(d, econ);
    var hints = app.querySelectorAll("[data-rev-for]");
    for (var i = 0; i < hints.length; i++) {
      var row = compById(d, hints[i].dataset.revFor);
      if (!row) continue;
      var derived = row.price != null && row.monthlySales != null ? L.roundCents(row.price * row.monthlySales) : null;
      if (row.monthlyRevenue != null) hints[i].textContent = "Chart uses the typed revenue " + L.money(row.monthlyRevenue) + (derived != null ? " (price × sales would be " + L.money(derived) + ")." : ".");
      else if (derived != null) hints[i].textContent = "Revenue left blank — chart uses price × sales = " + L.money(derived) + ".";
      else hints[i].textContent = "Add price and monthly sales, or type revenue.";
    }
    var insight = document.getElementById("comp-insight");
    if (insight) {
      if (!comp) insight.innerHTML = "<h3>Competition score</h3><p class=\"empty\">Add rows with revenue before this can suggest a rubric score.</p>";
      else {
        var entered = enteredScore(d, "competition");
        var gap = entered != null && entered !== comp.score;
        insight.className = "insight" + (gap ? " is-gap" : entered != null ? " is-match" : "");
        insight.innerHTML = "<h3>Suggested competition score: " + comp.score + "</h3><p>" + esc(comp.reason) + " Leader: " + esc(comp.leaderTitle) + " at about " + Math.round(comp.share * 100) + "% of tracked revenue" + (comp.leaderReviews ? ", " + L.formatInt(comp.leaderReviews) + " reviews" : "") + ".</p>" +
          "<p class=\"fine\">Only the rows on this page count. 55%+ share and 5,000+ reviews → 1. 45%+ and 2,500+ reviews → 2. Active set → 3. Thin set → 4 or 5.</p>" +
          applyButton("competition", comp.score, entered);
      }
    }
  }

  function chartHtml(d, econ) {
    var rows = [];
    for (var i = 0; i < d.competitors.length; i++) {
      var rev = L.competitorRevenue(d.competitors[i]);
      if (rev != null) rows.push({ label: d.competitors[i].title || d.competitors[i].asin || "Competitor", revenue: rev, plan: false });
    }
    if (econ.monthlyRevenuePlan != null) {
      rows.push({ label: (d.productName || "Our plan") + " (plan)", revenue: econ.monthlyRevenuePlan, plan: true });
    }
    if (!rows.length) return "<p class=\"empty\">Revenue bars appear when a row has revenue, or price and monthly sales.</p>";
    var max = 0;
    for (var r = 0; r < rows.length; r++) if (rows[r].revenue > max) max = rows[r].revenue;
    return rows.map(function (row) {
      var width = max ? Math.max(2, row.revenue / max * 100) : 0;
      return "<div class=\"share-row" + (row.plan ? " is-plan" : "") + "\"><div class=\"share-top\"><span>" + esc(row.label) + "</span><span>" + esc(L.money(row.revenue)) + "</span></div><div class=\"share-track\"><span style=\"width:" + width.toFixed(1) + "%\"></span></div></div>";
    }).join("") + "<p class=\"fine\">Teal bar is our unit plan, not a measured rank.</p>";
  }

  function makerHtml(d, econ, comp) {
    var html = "<h3>Opportunity math</h3><ul class=\"lines\">";
    if (d.overview.price != null && (d.maker.priceBandLow != null || d.maker.priceBandHigh != null)) {
      var low = d.maker.priceBandLow;
      var high = d.maker.priceBandHigh;
      var outside = (low != null && d.overview.price < low) || (high != null && d.overview.price > high);
      html += line("Target vs band", L.money(d.overview.price) + (outside ? " is outside the band" : " sits in the band"));
    }
    if (comp && comp.trackedUnits && d.maker.monthlyUnits != null && comp.trackedUnits > 0) {
      html += line("Share of tracked units", L.pct(d.maker.monthlyUnits / comp.trackedUnits * 100));
    }
    html += line("Monthly revenue plan", econ.monthlyRevenuePlan == null ? "—" : L.money(econ.monthlyRevenuePlan));
    html += line("Annual contribution", econ.annualContribution == null ? "—" : L.money(econ.annualContribution));
    html += line(econ.tacosPct == null ? "Annual before ads (TACOS blank)" : "Annual after TACOS", econ.annualAfterAds == null ? "—" : L.money(econ.annualAfterAds), true);
    html += "</ul><p class=\"fine\">Annual = monthly units × 12 × profit per unit. Overhead, returns, and launch ads beyond the TACOS % are not in this number.</p>";
    return html;
  }

  function moatHtml(moat) {
    if (moat.hundredths == null) return "<h3>Barrier index</h3><p class=\"empty\">Score at least one barrier. N/A stays out of the index.</p>";
    var suggest = L.suggestMoatRubricScore(moat);
    return "<h3>Barrier index " + esc(L.formatHundredths(moat.hundredths)) + " · " + esc(moat.band.label) + "</h3>" +
      "<p>Equal weights, same half-up rounding as the rubric (" + moat.num + " ÷ " + moat.den + "). Suggested China-exclusivity score: <strong>" + suggest + "</strong>.</p>";
  }

  function enteredScore(d, id) {
    var c = L.findCriterion(d, id);
    if (!c || c.hidden || L.clampWeight(c.weight) <= 0 || c.score == null) return null;
    return c.score;
  }

  function applyButton(id, suggestion, entered) {
    if (suggestion == null) return "";
    var c = L.findCriterion(current(), id);
    var name = c ? c.short : id;
    if (entered === suggestion) return "<p class=\"fine\">Rubric " + esc(name) + " is already " + suggestion + ".</p>";
    var currentText = entered == null ? "not counted" : String(entered);
    return "<p class=\"fine\">Rubric " + esc(name) + " is " + currentText + ".</p><button type=\"button\" class=\"primary\" data-action=\"apply\" data-criterion=\"" + esc(id) + "\" data-apply-score=\"" + suggestion + "\">Apply " + suggestion + " to " + esc(name) + "</button>";
  }

  function insightsHtml(d, econ, comp, moat) {
    var marginSuggest = econ.marginScore;
    var moatSuggest = L.suggestMoatRubricScore(moat);
    var compEntered = enteredScore(d, "competition");
    var marginEntered = enteredScore(d, "margin");
    var moatEntered = enteredScore(d, "moat");
    var compCard = "<article class=\"insight" + gapClass(comp && comp.score, compEntered) + "\"><h3>Competition</h3>";
    if (!comp) compCard += "<p>No tracked revenue yet.</p>";
    else compCard += "<p>Tracked set suggests <strong>" + comp.score + "</strong>. " + esc(comp.reason) + "</p>" + applyButton("competition", comp.score, compEntered);
    compCard += "</article>";
    var marginCard = "<article class=\"insight" + gapClass(marginSuggest, marginEntered) + "\"><h3>Margin</h3>";
    if (marginSuggest == null) marginCard += "<p>Need a Sellerboard net and a sell price, or a cost stack with a sell price.</p>";
    else {
      marginCard += "<p>Calculator suggests <strong>" + marginSuggest + "</strong> from " + esc(L.pct(econ.marginPctUsed)) + " " + esc(econ.marginBasis) + " (" + esc(L.marginBandLabel(marginSuggest)) + ").</p>";
      marginCard += "<p class=\"fine\">Bands on that percent of price: 32%+ is 5, 20%+ is 4, 12%+ is 3, 6%+ is 2, under 6% is 1. Sellerboard net wins when it is filled. Otherwise TACOS is used when you enter it. The gap between contribution and Sellerboard net is not an ad cost.</p>";
      marginCard += applyButton("margin", marginSuggest, marginEntered);
    }
    marginCard += "</article>";
    var moatCard = "<article class=\"insight" + gapClass(moatSuggest, moatEntered) + "\"><h3>Moat</h3>";
    if (moatSuggest == null) moatCard += "<p>Score the barrier checklist to suggest the China-exclusivity row.</p>";
    else {
      moatCard += "<p>Barrier index " + esc(L.formatHundredths(moat.hundredths)) + " (" + esc(moat.band.label) + ") rounds to rubric score <strong>" + moatSuggest + "</strong>.</p>";
      moatCard += applyButton("moat", moatSuggest, moatEntered);
    }
    moatCard += "</article>";
    return compCard + marginCard + moatCard;
  }

  function gapClass(suggestion, entered) {
    if (suggestion == null || entered == null) return "";
    return suggestion === entered ? " is-match" : " is-gap";
  }

  function paintBreakdown(d, summary) {
    var formula = document.getElementById("formula-line");
    var root = document.getElementById("breakdown");
    var dragRoot = document.getElementById("drags");
    if (!root) return;
    if (formula) {
      formula.textContent = summary.hundredths == null
        ? "Score at least one criterion. N/A, Hide, and weight 0 stay out of both sums."
        : "Weighted average = " + summary.num + " ÷ " + summary.den + " = " + L.formatHundredths(summary.hundredths) + ". Counted " + summary.counted.length + " criteria.";
    }
    var scored = summary.counted;
    var radar = "";
    if (scored.length >= 3 && scored.length <= 14) radar = radarMarkup(scored);
    else if (scored.length > 14) radar = "<p class=\"fine\">Too many scored criteria for the radar. Use the bars.</p>";
    else radar = "<p class=\"fine\">Score at least 3 criteria to draw the radar.</p>";
    var rows = d.criteria.filter(function (c) { return !c.hidden; });
    var bars = rows.map(function (c) {
      var weight = L.clampWeight(c.weight);
      var score = L.clampScore(c.score);
      var counted = weight > 0 && score != null;
      var width = counted ? (score / 5) * 100 : 0;
      var mark = summary.hundredths == null ? "" : "<i class=\"avg-mark\" style=\"left:" + (summary.hundredths / 5) + "%\"></i>";
      var label = counted ? String(score) : (weight <= 0 ? "w0" : "N/A");
      var fillClass = !counted ? "" : score >= 4 ? "high" : score === 3 ? "mid" : "low";
      var fill = counted ? "<span class=\"bar-fill " + fillClass + "\" style=\"width:" + width + "%\"></span>" : "";
      return "<div class=\"bar-row\"><span class=\"bar-name\">" + esc(c.name) + "</span><span class=\"bar-score\">" + esc(label) + "</span><span class=\"bar-track\">" + fill + mark + "</span></div>";
    }).join("");
    var legend = summary.hundredths == null ? "" : "<p class=\"fine\">The white line on each bar is the weighted average.</p>";
    root.innerHTML = "<div class=\"radar-wrap\">" + radar + "</div><div>" + (bars || "<p class=\"empty\">All criteria are hidden.</p>") + legend + "</div>";
    if (!dragRoot) return;
    if (summary.hundredths == null || !summary.drags.length) {
      dragRoot.innerHTML = summary.hundredths == null ? "" : "<p class=\"fine\">Nothing is pulling this below the average.</p>";
      return;
    }
    dragRoot.innerHTML = "<h3>Pulling the score down</h3><ol class=\"drag-list\">" + summary.drags.map(function (drag) {
      return "<li><strong>" + esc(drag.name) + "</strong> scored " + drag.score + "/5 at weight " + drag.weight + " — about " + L.formatPull(drag.pull) + " points off the average.</li>";
    }).join("") + "</ol>";
  }

  function radarMarkup(items) {
    var n = items.length;
    var cx = 210;
    var cy = 210;
    var radius = 112;
    function xy(i, mag) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return [cx + Math.cos(a) * radius * mag, cy + Math.sin(a) * radius * mag];
    }
    var rings = "";
    for (var step = 1; step <= 5; step++) {
      var pts = [];
      for (var i = 0; i < n; i++) pts.push(xy(i, step / 5).map(function (v) { return v.toFixed(1); }).join(","));
      rings += "<polygon points=\"" + pts.join(" ") + "\" fill=\"none\" stroke=\"#2a3555\" stroke-width=\"1\"/>";
    }
    var spokes = "";
    for (var s = 0; s < n; s++) {
      var p = xy(s, 1);
      spokes += "<line x1=\"" + cx + "\" y1=\"" + cy + "\" x2=\"" + p[0].toFixed(1) + "\" y2=\"" + p[1].toFixed(1) + "\" stroke=\"#2a3555\"/>";
    }
    var poly = items.map(function (it, i) {
      return xy(i, it.score / 5).map(function (v) { return v.toFixed(1); }).join(",");
    }).join(" ");
    var labels = "";
    for (var k = 0; k < n; k++) {
      var lp = xy(k, 1.28);
      labels += "<text x=\"" + lp[0].toFixed(1) + "\" y=\"" + lp[1].toFixed(1) + "\" text-anchor=\"middle\" dominant-baseline=\"middle\" fill=\"#a9b6d3\" font-size=\"11\">" + esc(items[k].short || items[k].name) + "</text>";
    }
    return "<svg viewBox=\"0 0 420 420\" role=\"img\" aria-label=\"Radar of scored criteria\">" + rings + spokes +
      "<polygon points=\"" + poly + "\" fill=\"rgba(94,234,212,.28)\" stroke=\"#5eead4\" stroke-width=\"2\"/>" + labels + "</svg>";
  }

  function paintCriterionStatus(d, summary) {
    var dragIds = {};
    for (var i = 0; i < summary.drags.length; i++) dragIds[summary.drags[i].id] = true;
    for (var c = 0; c < d.criteria.length; c++) {
      var crit = d.criteria[c];
      var card = app.querySelector('[data-cid="' + crit.id + '"]');
      if (!card) continue;
      card.classList.toggle("is-drag", !!dragIds[crit.id]);
      card.classList.toggle("is-hidden", !!crit.hidden);
      var status = card.querySelector("[data-status]");
      if (!status) continue;
      if (crit.hidden) status.textContent = "Hidden — not counted.";
      else if (L.clampWeight(crit.weight) === 0) status.textContent = "Weight 0 — not counted.";
      else if (crit.score == null) status.textContent = "N/A — not counted.";
      else status.textContent = "Counts: " + crit.score + " × " + crit.weight + " = " + (crit.score * crit.weight) + (dragIds[crit.id] ? ". Below the average." : ".");
    }
  }

  function refreshComp(d) {
    var root = document.getElementById("comp-rows");
    if (root) root.innerHTML = competitorRowsHtml(d);
    paint();
  }

  function refreshCriteria(d) {
    var root = document.getElementById("criteria");
    if (root) root.innerHTML = criteriaHtml(d);
    paint();
  }

  function download(filename, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportList(list) {
    return list.map(function (d) { return L.normalizeDossier(d); }).filter(Boolean);
  }

  function exportJson(list) {
    if (!list.length) { toast("Nothing to export."); return; }
    download("sot-product-dossiers.json", "application/json", JSON.stringify(L.dossiersToJson(list), null, 2));
    toast("JSON downloaded");
  }

  function exportCsv(list) {
    if (!list.length) { toast("Nothing to export."); return; }
    download("sot-product-dossiers.csv", "text/csv", L.dossiersToCsv(list));
    toast("CSV downloaded");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Summary copied"); }, function () { fallbackCopy(text); });
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    ta.remove();
    var details = document.querySelector("details.summary-box");
    if (details) details.open = true;
    toast(ok ? "Summary copied" : "Clipboard blocked. The summary preview is open.");
  }

  function handleAction(el) {
    var action = el.dataset.action;
    var id = el.dataset.id;
    if (action === "back") { go({}); return; }
    if (action === "new") {
      var fresh = L.blankDossier();
      store.dossiers.unshift(fresh);
      persist();
      go({ id: fresh.id });
      return;
    }
    if (action === "open") { go({ id: id }); return; }
    if (action === "duplicate") {
      var source = byId(id) || current();
      if (!source) return;
      var copy = L.duplicateDossier(source);
      store.dossiers.unshift(copy);
      persist();
      toast("Duplicated");
      go({ id: copy.id });
      return;
    }
    if (action === "delete") {
      var target = byId(id) || current();
      if (!target) return;
      var label = target.productName || "Untitled";
      if (!confirm("Delete “" + label + "” from this browser?")) return;
      store.dossiers = store.dossiers.filter(function (d) { return d.id !== target.id; });
      comparePick = comparePick.filter(function (x) { return x !== target.id; });
      persist();
      toast("Deleted");
      if (route().name === "product" && route().id === target.id) go({});
      else render();
      return;
    }
    if (action === "compare-go") {
      if (comparePick.length < 2) { toast("Pick 2 or 3 products"); return; }
      go({ compare: comparePick.slice(0, 3).join(",") });
      return;
    }
    if (action === "compare-clear") {
      comparePick = [];
      render();
      return;
    }
    if (action === "restore-samples") {
      var samples = L.sampleLibrary();
      var added = 0;
      for (var i = 0; i < samples.length; i++) {
        if (!byId(samples[i].id)) { store.dossiers.push(samples[i]); added++; }
      }
      store.baselinesSeeded = true;
      if (!added) { toast("Baselines are already in the library"); return; }
      persist();
      toast("Baselines restored");
      render();
      return;
    }
    if (action === "preset-mermaid" || action === "preset-farm") {
      var hostPreset = current();
      if (!hostPreset) return;
      var presetKey = action === "preset-farm" ? "farm" : "mermaid";
      var spec = L.BASELINES[presetKey];
      var dirty = hostPreset.china.productsCost != null || hostPreset.china.amazonFeesBlended != null || hostPreset.china.reportedNet != null;
      var same = hostPreset.china.productsCost === spec.productsCost && hostPreset.china.amazonFeesBlended === spec.amazonFeesBlended && hostPreset.china.reportedNet === spec.reportedNet;
      if (dirty && !same && !confirm("Replace Products Cost, blended fees, and Sellerboard net with the " + spec.productName + " snapshot? China EXW/FOB and freight stay as they are.")) return;
      L.applySellerboardPreset(hostPreset, presetKey);
      touch(hostPreset);
      persist();
      render();
      toast(spec.productName + " costs applied");
      return;
    }
    if (action === "export-json") { exportJson(exportList(sorted())); return; }
    if (action === "export-csv") { exportCsv(exportList(sorted())); return; }
    if (action === "export-json-one") { var one = current(); if (one) exportJson(exportList([one])); return; }
    if (action === "export-csv-one") { var oneCsv = current(); if (oneCsv) exportCsv(exportList([oneCsv])); return; }
    if (action === "import-json") {
      var file = document.getElementById("import-file");
      if (file) file.click();
      return;
    }
    if (action === "copy") {
      var d = current();
      if (d) copyText(L.executiveSummary(d));
      return;
    }
    if (action === "clear-sample") {
      var real = current();
      if (!real) return;
      if (!confirm("Clear the fictional-sample label? The numbers stay until you replace them.")) return;
      real.sample = false;
      touch(real);
      persist();
      paint();
      toast("Sample label cleared");
      return;
    }
    if (action === "add-comp") {
      var dossier = current();
      if (!dossier) return;
      if (dossier.competitors.length >= 40) { toast("Limit is 40 competitors."); return; }
      dossier.competitors.push({ id: L.uid(), asin: "", title: "", price: null, monthlySales: null, monthlyRevenue: null, reviews: null, rating: null, bsr: "" });
      touch(dossier);
      persist();
      refreshComp(dossier);
      return;
    }
    if (action === "remove-comp") {
      var parent = current();
      if (!parent) return;
      parent.competitors = parent.competitors.filter(function (row) { return row.id !== el.dataset.compId; });
      touch(parent);
      persist();
      refreshComp(parent);
      return;
    }
    if (action === "import-h10") {
      var box = document.getElementById("h10-paste");
      var msg = document.getElementById("h10-msg");
      var parsed = L.parseHeliumPaste(box ? box.value : "");
      if (parsed.error) {
        if (msg) msg.textContent = parsed.error;
        toast(parsed.error);
        return;
      }
      var host = current();
      if (!host) return;
      var replace = document.getElementById("h10-replace") && document.getElementById("h10-replace").checked;
      host.competitors = (replace ? parsed.rows : host.competitors.concat(parsed.rows)).slice(0, 40);
      touch(host);
      persist();
      refreshComp(host);
      if (msg) msg.textContent = "Imported " + parsed.rows.length + " row" + (parsed.rows.length === 1 ? "" : "s") + ".";
      toast("Imported " + parsed.rows.length + " rows");
      return;
    }
    if (action === "apply") {
      var applyTo = current();
      if (!applyTo) return;
      var crit = L.findCriterion(applyTo, el.dataset.criterion);
      if (!crit) return;
      crit.score = L.clampScore(el.dataset.applyScore);
      touch(applyTo);
      persist();
      refreshCriteria(applyTo);
      toast("Set " + crit.short + " to " + crit.score);
      return;
    }
    if (action === "why") {
      var whyCard = el.closest("[data-cid]");
      if (!whyCard) return;
      var why = whyCard.querySelector(".why");
      if (!why) return;
      var open = why.hidden;
      why.hidden = !open;
      el.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (action === "hide") {
      var hideHit = criterionFrom(el);
      if (!hideHit || !hideHit.c) return;
      hideHit.c.hidden = !hideHit.c.hidden;
      el.textContent = hideHit.c.hidden ? "Include" : "Hide";
      el.setAttribute("aria-pressed", hideHit.c.hidden ? "true" : "false");
      touch(hideHit.d);
      persist();
      paint();
      return;
    }
    if (action === "remove-criterion") {
      var removeHit = criterionFrom(el);
      if (!removeHit || !removeHit.c || !removeHit.c.custom) return;
      removeHit.d.criteria = removeHit.d.criteria.filter(function (c) { return c.id !== removeHit.c.id; });
      touch(removeHit.d);
      persist();
      refreshCriteria(removeHit.d);
      return;
    }
    if (action === "reset-weights") {
      var resetD = current();
      if (!resetD) return;
      if (!confirm("Reset starter weights to the defaults? Scores and notes stay.")) return;
      var weights = {};
      for (var w = 0; w < L.DEFAULTS.length; w++) weights[L.DEFAULTS[w].id] = L.DEFAULTS[w].weight;
      for (var ci = 0; ci < resetD.criteria.length; ci++) {
        if (Object.prototype.hasOwnProperty.call(weights, resetD.criteria[ci].id)) resetD.criteria[ci].weight = weights[resetD.criteria[ci].id];
      }
      touch(resetD);
      persist();
      refreshCriteria(resetD);
      toast("Weights reset");
    }
  }

  function handleScore(btn) {
    var d = current();
    if (!d) return;
    var score = btn.dataset.score === "na" ? null : L.clampScore(btn.dataset.score);
    if (btn.hasAttribute("data-moat")) {
      var key = btn.dataset.moat;
      if (!Object.prototype.hasOwnProperty.call(d.moat.scores, key)) return;
      d.moat.scores[key] = score;
    } else {
      var hit = criterionFrom(btn);
      if (!hit || !hit.c) return;
      hit.c.score = score;
    }
    var group = btn.parentElement.querySelectorAll("[data-score]");
    for (var i = 0; i < group.length; i++) group[i].setAttribute("aria-pressed", group[i] === btn ? "true" : "false");
    touch(d);
    persist();
    paint();
  }

  function scrollToSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    var buttons = app.querySelectorAll("[data-nav]");
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle("is-on", buttons[i].dataset.nav === id);
  }

  function watchSections() {
    if (sectionObserver) sectionObserver.disconnect();
    if (!("IntersectionObserver" in window)) return;
    var sections = app.querySelectorAll("section[data-section]");
    if (!sections.length) return;
    sectionObserver = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; });
      if (!visible.length) return;
      visible.sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
      var id = visible[0].target.id;
      var buttons = app.querySelectorAll("[data-nav]");
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle("is-on", buttons[i].dataset.nav === id);
    }, { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] });
    for (var s = 0; s < sections.length; s++) sectionObserver.observe(sections[s]);
  }

  function render() {
    var r = route();
    if (r.name === "library") {
      document.title = "Product dossiers · Sensationally OT";
      app.innerHTML = libraryHtml();
    } else if (r.name === "compare") {
      document.title = "Compare · Product dossiers";
      app.innerHTML = compareHtml(r.ids);
    } else {
      app.innerHTML = productHtml(r.id);
    }
    paint();
    watchSections();
    var focus = app.querySelector("[data-autofocus]");
    if (focus) focus.focus();
  }

  function importFile(input) {
    var file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = L.parseDossierImport(String(reader.result || ""));
      if (parsed.error) { toast(parsed.error); return; }
      var n = 0;
      for (var i = 0; i < parsed.dossiers.length; i++) {
        var incoming = parsed.dossiers[i];
        var idx = -1;
        for (var j = 0; j < store.dossiers.length; j++) if (store.dossiers[j].id === incoming.id) idx = j;
        if (idx >= 0) store.dossiers[idx] = incoming;
        else store.dossiers.unshift(incoming);
        n++;
      }
      persist();
      toast("Imported " + n + " product" + (n === 1 ? "" : "s"));
      render();
    };
    reader.readAsText(file);
  }

  app.addEventListener("click", function (e) {
    var actionEl = e.target.closest("[data-action]");
    if (actionEl) { handleAction(actionEl); return; }
    var scoreEl = e.target.closest("[data-score]");
    if (scoreEl) { handleScore(scoreEl); return; }
    var nav = e.target.closest("[data-nav]");
    if (nav) scrollToSection(nav.dataset.nav);
  });

  app.addEventListener("input", function (e) {
    var t = e.target;
    if (!t || t.matches("select") || t.id === "h10-paste" || t.id === "add-name" || t.id === "add-why" || t.id === "add-weight") return;
    commitControl(t);
  });

  app.addEventListener("change", function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === "import-file") { importFile(t); return; }
    if (t.matches("[data-pick]")) {
      var id = t.dataset.pick;
      comparePick = comparePick.filter(function (x) { return x !== id; });
      if (t.checked) comparePick.push(id);
      if (comparePick.length > 3) {
        comparePick = comparePick.slice(0, 3);
        t.checked = false;
      }
      paint();
      return;
    }
    if (t.matches("select")) commitControl(t);
  });

  app.addEventListener("focusout", function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.crit === "weight") {
      var hit = criterionFrom(t);
      if (!hit || !hit.c) return;
      hit.c.weight = L.clampWeight(t.value === "" ? 0 : t.value);
      t.value = String(hit.c.weight);
      var label = hit.card.querySelector("[data-weight-label]");
      if (label) label.textContent = String(hit.c.weight);
      touch(hit.d);
      persist();
      paint();
    } else if (t.dataset.crit === "name") {
      var named = criterionFrom(t);
      if (!named || !named.c) return;
      if (!t.value.trim()) {
        t.value = named.c.name.trim() || "Custom criterion";
        named.c.name = t.value;
      }
    }
  });

  app.addEventListener("submit", function (e) {
    if (!e.target || e.target.id !== "add-form") return;
    e.preventDefault();
    var d = current();
    if (!d) return;
    if (d.criteria.length >= 40) { toast("Limit is 40 criteria."); return; }
    var name = document.getElementById("add-name").value.trim();
    if (!name) { toast("Name the criterion first."); document.getElementById("add-name").focus(); return; }
    d.criteria.push({
      id: "c-" + L.uid(),
      name: name.slice(0, 80),
      short: name.slice(0, 12),
      why: document.getElementById("add-why").value.trim().slice(0, 600) || "Custom criterion. Score 5 as the strongest favorable case.",
      weight: L.clampWeight(document.getElementById("add-weight").value),
      score: null,
      notes: "",
      inverse: document.getElementById("add-inverse").checked,
      core: false,
      custom: true,
      hidden: false
    });
    document.getElementById("add-name").value = "";
    document.getElementById("add-why").value = "";
    document.getElementById("add-inverse").checked = false;
    touch(d);
    persist();
    refreshCriteria(d);
    toast("Criterion added");
  });

  window.addEventListener("popstate", function () { render(); });

  boot();
  render();
})();
