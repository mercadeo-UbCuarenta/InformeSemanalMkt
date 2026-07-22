(() => {
  const textDecoder = new TextDecoder("utf-8");
  const brandLabels = {
    levis:"Levi's Línea",
    "levis-outlet":"Levi's Outlet",
    desigual:"Desigual",
    wiseman:"Wiseman",
    digital:"Digital"
  };

  const normalize = value => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  const xml = source => new DOMParser().parseFromString(source, "application/xml");
  const elements = (node, localName) => Array.from(node.getElementsByTagName("*")).filter(item => item.localName === localName);
  const firstText = (node, localName) => elements(node, localName)[0]?.textContent ?? "";
  const setText = (selector, value) => {
    if (value === undefined || value === null || value === "") return;
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  };
  const number = value => {
    if (typeof value === "number") return value;
    const clean = String(value ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const displayNumber = value => typeof value === "number" ? value.toLocaleString("es-CO") : String(value ?? "-");
  const displayMoney = value => {
    if (typeof value !== "number") return String(value ?? "-");
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toLocaleString("es-CO", {maximumFractionDigits:1})}M`;
    return value.toLocaleString("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0});
  };
  const displayPercent = value => {
    if (typeof value !== "number") {
      const text = String(value ?? "-");
      return text.includes("%") ? text : text;
    }
    const percentage = Math.abs(value) <= 10 ? value * 100 : value;
    return `${percentage.toLocaleString("es-CO", {maximumFractionDigits:1})}%`;
  };
  const compliancePill = value => {
    const ratio = number(value);
    const met = ratio >= 1;
    return `<span class="compliance-pill ${met ? "met" : "missed"}"><i></i>${displayPercent(ratio)}</span>`;
  };
  const setCompliancePill = (selector, value) => {
    const target = document.querySelector(selector);
    if (!target) return;
    const ratio = number(value);
    const met = ratio >= 1;
    target.className = `compliance-pill ${met ? "met" : "missed"}`;
    target.innerHTML = `<i></i>${displayPercent(ratio)}`;
  };
  const setVariationPill = (selector, previous, current) => {
    const target = document.querySelector(selector);
    if (!target) return;
    const variation = number(previous) ? number(current) / number(previous) - 1 : 0;
    target.className = `compliance-pill ${variation >= 0 ? "met" : "missed"}`;
    target.innerHTML = `<i></i>${variation > 0 ? "+" : ""}${displayPercent(variation)}`;
  };
  const displayDate = value => {
    if (typeof value === "number" && value > 30000) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return date.toLocaleDateString("es-CO", {day:"2-digit", month:"short", year:"numeric", timeZone:"UTC"});
    }
    return String(value ?? "-");
  };
  const parseCurrency = value => {
    if (typeof value === "number") return value;
    const clean = String(value ?? "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const brandKey = value => {
    const key = normalize(value);
    if (key.includes("levi") && key.includes("outlet")) return "levis-outlet";
    if (key.includes("levi")) return "levis";
    if (key.includes("desigual")) return "desigual";
    if (key.includes("wiseman")) return "wiseman";
    if (key.includes("digital") || key.includes("ecommerce")) return "digital";
    return key.replace(/\s/g, "-");
  };
  const channelKey = value => {
    const key = normalize(value);
    if (key.includes("whatsapp")) return "whatsapp";
    if (key.includes("sms")) return "sms";
    if (key.includes("email") || key.includes("mail")) return "email";
    return key;
  };
  const rowObject = (headers, row) => Object.fromEntries(headers.map((header, index) => [normalize(header), row[index] ?? ""]));
  const pick = (row, ...names) => {
    for (const name of names) {
      const value = row[normalize(name)];
      if (value !== undefined && value !== "") return value;
    }
    return "";
  };

  async function inflateRaw(bytes) {
    if (!("DecompressionStream" in window)) throw new Error("El navegador no permite descomprimir archivos Office.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("El archivo Office no tiene una estructura válida.");
    const count = view.getUint16(eocd + 10, true);
    let cursor = view.getUint32(eocd + 16, true);
    const files = new Map();
    for (let index = 0; index < count; index++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) break;
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const name = textDecoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, "/");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`Compresión Office no compatible (${method}).`);
      files.set(name, data);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  function parseSharedStrings(files) {
    const data = files.get("xl/sharedStrings.xml");
    if (!data) return [];
    return elements(xml(textDecoder.decode(data)), "si").map(item =>
      elements(item, "t").map(text => text.textContent).join("")
    );
  }

  function parseWorksheet(data, sharedStrings) {
    const doc = xml(textDecoder.decode(data));
    const rows = [];
    for (const cell of elements(doc, "c")) {
      const reference = cell.getAttribute("r") || "";
      const letters = reference.match(/[A-Z]+/i)?.[0] || "A";
      let column = 0;
      for (const char of letters.toUpperCase()) column = column * 26 + char.charCodeAt(0) - 64;
      column -= 1;
      const rowIndex = Math.max(0, Number(reference.match(/\d+/)?.[0] || 1) - 1);
      rows[rowIndex] ||= [];
      const type = cell.getAttribute("t");
      let value = firstText(cell, "v");
      if (type === "s") value = sharedStrings[Number(value)] ?? "";
      else if (type === "inlineStr") value = elements(cell, "t").map(item => item.textContent).join("");
      else if (type === "b") value = value === "1";
      else if (value !== "" && Number.isFinite(Number(value))) value = Number(value);
      rows[rowIndex][column] = value;
    }
    return rows;
  }

  function parseWorkbook(files) {
    const workbook = xml(textDecoder.decode(files.get("xl/workbook.xml")));
    const rels = xml(textDecoder.decode(files.get("xl/_rels/workbook.xml.rels")));
    const targets = new Map(elements(rels, "Relationship").map(rel => [rel.getAttribute("Id"), rel.getAttribute("Target")]));
    const shared = parseSharedStrings(files);
    const result = {};
    for (const sheet of elements(workbook, "sheet")) {
      const name = sheet.getAttribute("name");
      const relationshipId = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      let target = targets.get(relationshipId) || "";
      target = target.replace(/^\/?xl\//, "").replace(/^\/?/, "");
      const path = `xl/${target}`.replace(/\/+/g, "/");
      const data = files.get(path);
      if (data) result[name] = parseWorksheet(data, shared);
    }
    return result;
  }

  function sheetByName(workbook, wanted) {
    const target = normalize(wanted);
    const name = Object.keys(workbook).find(item => normalize(item) === target || normalize(item).includes(target));
    return name ? workbook[name] : [];
  }

  function applySummary(rows) {
    const values = {};
    rows.slice(1).forEach(row => values[normalize(row[0])] = row[1]);
    const mappings = {
      "periodo":"periodo",
      "ventas semana":"ventas-semana",
      "variacion compania":"variacion-compania",
      "variacion semana":"variacion-semana",
      "meta semana":"meta-semana",
      "cumplimiento meta":"cumplimiento-meta",
      "trafico semana":"trafico-semana",
      "cumplimiento trafico":"cumplimiento-trafico",
      "cumplimiento mes":"cumplimiento-mes",
      "brecha meta":"brecha-meta"
    };
    for (const [source, field] of Object.entries(mappings)) {
      const raw = values[source];
      if (raw === undefined || raw === "") continue;
      const formatted = source.includes("ventas") || source.includes("meta") || source.includes("brecha")
        ? displayMoney(raw) : source.includes("cumplimiento") || source.includes("variacion") ? displayPercent(raw) : displayNumber(raw);
      setText(`[data-field="${field}"]`, formatted);
    }
    if (values["meta trafico"]) {
      const actual = displayNumber(values["trafico semana"]);
      setText('[data-field="trafico-meta"]', `${actual} / ${displayNumber(values["meta trafico"])}`);
    }
    if (values["resumen ejecutivo"]) setText("#resumen .section-intro", values["resumen ejecutivo"]);
    if (values["foco proxima semana"]) setText(".closing-note p", values["foco proxima semana"]);
    const progress = number(values["cumplimiento meta"]);
    if (progress) {
      const percentage = Math.abs(progress) <= 1 ? progress * 100 : progress;
      const radial = document.querySelector(".radial");
      if (radial) radial.style.setProperty("--progress", percentage);
      setText('[data-field="cumplimiento-radial"]', displayPercent(progress));
    }
    const trafficProgress = number(values["cumplimiento trafico"]);
    if (trafficProgress) {
      const percentage = Math.abs(trafficProgress) <= 1 ? trafficProgress * 100 : trafficProgress;
      const bar = document.querySelector(".traffic-bar .bar i");
      if (bar) bar.style.width = `${Math.min(100, percentage)}%`;
    }
  }

  function applyBrands(rows) {
    if (rows.length < 2) return 0;
    const headers = rows[0];
    let updated = 0;
    rows.slice(1).filter(row => row.some(value => value !== undefined && value !== "")).forEach(raw => {
      const row = rowObject(headers, raw);
      const key = brandKey(pick(row, "marca"));
      if (!key) return;
      const salesRow = document.querySelector(`.sales-panel tbody tr[data-brand="${key}"]`);
      if (salesRow) {
        const salesPrevious = number(pick(row, "ventas 2025", "ventas anterior"));
        const salesCurrent = number(pick(row, "ventas 2026", "ventas actual"));
        setText(`[data-brand="${key}"] [data-col="ventas-anterior"]`, displayMoney(salesPrevious));
        setText(`[data-brand="${key}"] [data-col="ventas-actual"]`, displayMoney(salesCurrent));
        setVariationPill(`.sales-panel tr[data-brand="${key}"] [data-col="variacion"]`, salesPrevious, salesCurrent);
      }
      const focus = document.querySelector(`.brand-focus [data-brand="${key}"]`);
      if (focus) {
        const ticket = pick(row, "ticket promedio", "ticket");
        const repurchase = pick(row, "tasa de recompra", "recompra");
        if (ticket !== "") focus.querySelector('[data-metric="ticket-promedio"]').textContent = displayMoney(ticket);
        if (repurchase !== "") focus.querySelector('[data-metric="tasa-recompra"]').textContent = displayPercent(repurchase);
      }
      const analysis = document.querySelector(`.brand-analysis [data-brand="${key}"]`);
      if (analysis) {
        const variation = pick(row, "variacion", "variación");
        if (variation !== "") analysis.querySelector('[data-metric="variacion"]').textContent = displayPercent(variation);
        const title = pick(row, "titular gerencial", "titular");
        const reading = pick(row, "lectura gerencial", "lectura");
        if (title) analysis.querySelector('[data-metric="titular"]').textContent = title;
        if (reading) analysis.querySelector('[data-metric="lectura"]').textContent = reading;
      }
      updated++;
    });
    return updated;
  }

  function weightedRate(rows, rateNames, weightNames) {
    let weighted = 0, weights = 0;
    rows.forEach(row => {
      const rate = number(pick(row, ...rateNames));
      const weight = number(pick(row, ...weightNames)) || 1;
      if (rate) { weighted += (Math.abs(rate) <= 1 ? rate : rate / 100) * weight; weights += weight; }
    });
    return weights ? weighted / weights : 0;
  }

  function renderCRMChannelCards(data) {
    ["email", "sms", "whatsapp"].forEach(channel => {
      const channelRows = data.filter(row => channelKey(pick(row, "canal")) === channel);
      const card = document.querySelector(`.crm-channel[data-channel="${channel}"]`);
      if (!card) return;
      card.classList.toggle("channel-empty", !channelRows.length);
      if (!channelRows.length) {
        card.querySelectorAll("[data-metric]").forEach(metric => metric.textContent = "-");
        return;
      }
      const hasMetrics = channelRows.some(row => ["enviados", "entregados", "apertura", "ctr", "leidos", "respuestas", "conversiones", "bajas"]
        .some(metric => pick(row, metric) !== ""));
      if (!hasMetrics) return;
      const sum = (...names) => channelRows.reduce((total, row) => total + number(pick(row, ...names)), 0);
      const sent = sum("enviados", "mensajes enviados");
      const delivered = sum("entregados");
      card.querySelector('[data-metric="enviados"]').textContent = displayNumber(sent);
      const deliveredTarget = card.querySelector('[data-metric="entregados"]');
      if (deliveredTarget) deliveredTarget.textContent = displayNumber(delivered);
      const rateDelivery = sent ? delivered / sent : weightedRate(channelRows, ["tasa entrega"], ["enviados"]);
      const deliveryTarget = card.querySelector('[data-metric="tasa-entrega"]');
      if (deliveryTarget) deliveryTarget.textContent = displayPercent(rateDelivery);
      const aperture = card.querySelector('[data-metric="apertura"]');
      if (aperture) aperture.textContent = displayPercent(weightedRate(channelRows, ["apertura", "tasa apertura"], ["entregados", "enviados"]));
      const ctr = card.querySelector('[data-metric="ctr"]');
      if (ctr) ctr.textContent = displayPercent(weightedRate(channelRows, ["ctr", "ctor", "tasa clics"], ["entregados", "enviados"]));
      const read = card.querySelector('[data-metric="leidos"]');
      if (read) read.textContent = displayPercent(weightedRate(channelRows, ["leidos", "tasa lectura"], ["entregados", "enviados"]));
      const responses = card.querySelector('[data-metric="respuestas"]');
      if (responses) responses.textContent = displayNumber(sum("respuestas", "clics respuesta", "clics"));
      const conversions = card.querySelector('[data-metric="conversiones"]');
      if (conversions) conversions.textContent = displayNumber(sum("conversiones"));
      const unsubscribes = card.querySelector('[data-metric="bajas"]');
      if (unsubscribes) unsubscribes.textContent = displayNumber(sum("bajas"));
      const conversionRate = card.querySelector('[data-metric="conversion-rate"]');
      if (conversionRate) conversionRate.textContent = displayPercent(weightedRate(channelRows, ["conversion", "conversión"], ["enviados"]));
      const bounce = card.querySelector('[data-metric="bounce"]');
      if (bounce) bounce.textContent = displayPercent(weightedRate(channelRows, ["tasa rebote", "rebote"], ["enviados"]));
      const transactions = card.querySelector('[data-metric="transactions"]');
      if (transactions) transactions.textContent = displayNumber(
        channelRows.reduce((total, row) => total + number(pick(row, "transacciones online")) + number(pick(row, "transacciones offline")), 0)
      );
      const revenue = card.querySelector('[data-metric="revenue"]');
      if (revenue) revenue.textContent = displayMoney(
        channelRows.reduce((total, row) => total + parseCurrency(pick(row, "ingresos online")) + parseCurrency(pick(row, "ingresos offline")), 0)
      );
    });
  }

  function renderCRMBrandInsights(data) {
    const container = document.querySelector("#crmBrandInsights");
    if (!container) return;
    const brands = ["levis", "levis-outlet", "desigual", "wiseman"].filter(brand =>
      data.some(row => brandKey(pick(row, "marca")) === brand)
    );
    container.innerHTML = brands.map(brand => {
      const rows = data.filter(row => brandKey(pick(row, "marca")) === brand);
      const sum = (...names) => rows.reduce((total, row) => total + number(pick(row, ...names)), 0);
      const sent = sum("enviados", "mensajes enviados");
      const transactions = rows.reduce((total, row) => total + number(pick(row, "transacciones online")) + number(pick(row, "transacciones offline")), 0);
      const revenue = rows.reduce((total, row) => total + parseCurrency(pick(row, "ingresos online")) + parseCurrency(pick(row, "ingresos offline")), 0);
      const conversion = weightedRate(rows, ["conversion", "conversión"], ["enviados"]);
      const top = rows.slice().sort((a, b) => {
        const result = row => parseCurrency(pick(row, "ingresos online")) + parseCurrency(pick(row, "ingresos offline")) || number(pick(row, "enviados"));
        return result(b) - result(a);
      })[0];
      return `<article class="crm-brand-insight" data-brand="${brand}">
        <div class="crm-brand-insight-head"><span>${escapeHtml(brandLabels[brand])}</span><b>${rows.length} ${rows.length === 1 ? "campaña" : "campañas"}</b></div>
        <div class="crm-brand-insight-main"><strong>${displayNumber(sent)}</strong><span>contactos impactados</span></div>
        <div class="crm-brand-insight-metrics">
          <div><span>Conversión</span><b>${displayPercent(conversion)}</b></div>
          <div><span>Ingresos</span><b>${displayMoney(revenue)}</b></div>
        </div>
        <p class="crm-brand-insight-foot">${displayNumber(transactions)} transacciones<strong>${escapeHtml(pick(top, "campana", "campaña") || "Sin campaña destacada")}</strong></p>
      </article>`;
    }).join("") || '<article class="crm-campaign-empty">Sin información CRM por marca.</article>';
    const count = document.querySelector("#crmBrandInsightCount");
    if (count) count.textContent = `${brands.length} ${brands.length === 1 ? "marca" : "marcas"}`;
  }

  function applyCRM(rows) {
    if (rows.length < 2) return 0;
    const headers = rows[0];
    const data = rows.slice(1).filter(row => row.some(value => value !== undefined && value !== "")).map(row => rowObject(headers, row));
    window.reportCRMData = data;
    renderCRMChannelCards(data);
    renderCRMBrandInsights(data);
    window.filterCRMByBrand = brand => {
      const filtered = brand === "all" ? data : data.filter(row => brandKey(pick(row, "marca")) === brand);
      renderCRMChannelCards(filtered);
    };

    const campaignBody = document.querySelector("#crmCampaignRows");
    if (campaignBody) {
      campaignBody.innerHTML = data.map(row => {
        const onlineTransactions = number(pick(row, "transacciones online"));
        const offlineTransactions = number(pick(row, "transacciones offline"));
        const onlineRevenue = parseCurrency(pick(row, "ingresos online"));
        const offlineRevenue = parseCurrency(pick(row, "ingresos offline"));
        const brand = brandKey(pick(row, "marca"));
        const channel = pick(row, "canal") || "CRM";
        const revenue = onlineRevenue + offlineRevenue;
        const transactions = onlineTransactions + offlineTransactions;
        return `<article class="crm-campaign-card" data-brand="${brand}">
          <div class="crm-campaign-top"><span>${escapeHtml(brandLabels[brand] || pick(row, "marca") || "Sin marca")}</span><b>${escapeHtml(channel)}</b></div>
          <h4>${escapeHtml(pick(row, "campana", "campaña") || "Campaña CRM")}</h4>
          <time>${escapeHtml(displayDate(pick(row, "fecha envio", "fecha envío")))}</time>
          <div class="crm-campaign-kpis">
            <div><span>Enviados</span><strong>${displayNumber(number(pick(row, "enviados")))}</strong></div>
            <div><span>Apertura</span><strong>${displayPercent(pick(row, "apertura"))}</strong></div>
            <div><span>CTOR</span><strong>${displayPercent(pick(row, "ctor", "ctr"))}</strong></div>
            <div><span>Conversión</span><strong>${displayPercent(pick(row, "conversion", "conversión"))}</strong></div>
          </div>
          <div class="crm-campaign-result"><span>${displayNumber(transactions)} transacciones</span><strong>${displayMoney(revenue)}</strong></div>
        </article>`;
      }).join("") || '<article class="crm-campaign-empty">Sin campañas CRM.</article>';
      const count = document.querySelector("#crmCampaignCount");
      if (count) count.textContent = `${data.length} ${data.length === 1 ? "campaña" : "campañas"}`;
    }
    return data.length;
  }

  function restoreCRMData(data) {
    if (!Array.isArray(data) || !data.length) return;
    const headers = Array.from(new Set(data.flatMap(row => Object.keys(row))));
    applyCRM([headers, ...data.map(row => headers.map(header => row[header] ?? ""))]);
  }

  const inferBrand = value => brandKey(value);
  const normalizeStore = value => normalize(value)
    .replace(/\bcc\b/g, "").replace(/\bparque\b/g, "").replace(/\bbogota\b/g, "")
    .replace(/\bcanal\b/g, "").replace(/\s+/g, " ").trim();

  function applySalesTrafficFormat(salesRows, trafficRows) {
    if (salesRows.length < 6 || trafficRows.length < 6) return {brands:0, stores:0};
    const salesDetailHeader = salesRows.findIndex(row => normalize(row[0]) === "marca" && normalize(row[1]) === "ventas");
    const trafficDetailHeader = trafficRows.findIndex(row => normalize(row[0]) === "trafico" && number(row[1]) === 2025);
    const salesSummaryEnd = salesRows.slice(1).findIndex(row => !row[1]);
    const trafficSummaryEnd = trafficRows.slice(1).findIndex(row => !row[0]);
    const salesSummary = salesRows.slice(1, salesSummaryEnd < 0 ? 6 : salesSummaryEnd + 1);
    const trafficSummary = trafficRows.slice(1, trafficSummaryEnd < 0 ? 6 : trafficSummaryEnd + 1);
    const salesSummaryMap = new Map(salesSummary.map(row => {
      const label = normalize(row[1]);
      return [label === "levis" ? "levis-combined" : brandKey(row[1]), row];
    }));
    const trafficSummaryMap = new Map(trafficSummary.map(row => {
      const label = normalize(row[0]);
      return [label === "levis" ? "levis-combined" : brandKey(row[0]), row];
    }));
    const totalSales = salesSummaryMap.get("total");
    const totalTraffic = trafficSummaryMap.get("total");
    if (totalSales) {
      setText('[data-field="ventas-semana"]', displayMoney(number(totalSales[3])));
      setText('[data-field="variacion-compania"]', displayPercent(totalSales[4]));
      setText('[data-field="variacion-semana"]', displayPercent(totalSales[4]));
      setText('[data-field="meta-semana"]', displayMoney(number(totalSales[6])));
      setText('[data-field="cumplimiento-meta"]', displayPercent(totalSales[7]));
      setText('[data-field="cumplimiento-radial"]', displayPercent(totalSales[7]));
      setText('[data-field="ticket-compania"]', displayMoney(number(totalSales[5])));
      setText('[data-field="brecha-meta"]', displayMoney(Math.max(0, number(totalSales[6]) - number(totalSales[3]))));
      setText('.sales-panel tfoot [data-col="ventas-anterior"]', displayMoney(number(totalSales[2])));
      setText('.sales-panel tfoot [data-col="ventas-actual"]', displayMoney(number(totalSales[3])));
      setVariationPill('.sales-panel tfoot [data-col="variacion"]', totalSales[2], totalSales[3]);
      const radial = document.querySelector(".radial");
      if (radial) radial.style.setProperty("--progress", Math.min(100, number(totalSales[7]) * 100));
    }
    if (totalTraffic) {
      setText('[data-field="trafico-semana"]', displayNumber(number(totalTraffic[2])));
      setText('[data-field="cumplimiento-trafico"]', displayPercent(totalTraffic[5]));
      setText('[data-field="trafico-meta"]', `${displayNumber(number(totalTraffic[2]))} / ${displayNumber(number(totalTraffic[4]))}`);
      const bar = document.querySelector(".traffic-bar .bar i");
      if (bar) bar.style.width = `${Math.min(100, number(totalTraffic[5]) * 100)}%`;
    }

    ["desigual", "wiseman", "digital"].forEach(key => {
      const sales = salesSummaryMap.get(key);
      const traffic = trafficSummaryMap.get(key);
      if (sales) {
        setText(`.sales-panel tr[data-brand="${key}"] [data-col="ventas-anterior"]`, displayMoney(number(sales[2])));
        setText(`.sales-panel tr[data-brand="${key}"] [data-col="ventas-actual"]`, displayMoney(number(sales[3])));
        setVariationPill(`.sales-panel tr[data-brand="${key}"] [data-col="variacion"]`, sales[2], sales[3]);
        const focus = document.querySelector(`.brand-focus [data-brand="${key}"]`);
        if (focus) focus.querySelector('[data-metric="ticket-promedio"]').textContent = displayMoney(number(sales[5]));
        const analysisVariation = document.querySelector(`.brand-analysis [data-brand="${key}"] [data-metric="variacion"]`);
        if (analysisVariation) analysisVariation.textContent = displayPercent(sales[4]);
      }
      if (traffic) {
        const focus = document.querySelector(`.brand-focus [data-brand="${key}"]`);
        if (focus && traffic[6] !== "" && traffic[6] !== undefined) {
          focus.querySelector('[data-metric="tasa-recompra"]').textContent = displayPercent(traffic[6]);
        }
      }
    });

    const salesDetails = salesRows.slice(salesDetailHeader >= 0 ? salesDetailHeader + 1 : 9).filter(row => row[1] && normalize(row[1]) !== "total compania")
      .map(row => ({
        brand: inferBrand(row[0] || row[1]), store:row[1], salesPrev:row[2], salesNow:row[3],
        salesVar:row[4], ticket:row[5], salesGoal:row[6], salesCompliance:row[7], conversion:row[8]
      }));
    const trafficDetails = trafficRows.slice(trafficDetailHeader >= 0 ? trafficDetailHeader + 1 : 9).filter(row => row[0] && normalize(row[0]) !== "total general")
      .map(row => ({
        store:row[0], trafficPrev:row[1], trafficNow:row[2], trafficVar:row[3],
        trafficGoal:row[4], trafficCompliance:row[5]
      }));
    const trafficMap = new Map(trafficDetails.map(item => [normalizeStore(item.store), item]));
    const combined = salesDetails.map(sales => {
      const exact = trafficMap.get(normalizeStore(sales.store));
      if (exact) return {...sales, ...exact, store:sales.store};
      const search = Array.from(trafficMap.entries()).find(([key]) =>
        key.includes(normalizeStore(sales.store)) || normalizeStore(sales.store).includes(key)
      );
      return {...sales, ...(search?.[1] || {})};
    });

    const updateSplitLevis = key => {
      const rows = combined.filter(item => item.brand === key);
      const salesSummaryRow = salesSummaryMap.get(key);
      const trafficSummaryRow = trafficSummaryMap.get(key);
      if (!rows.length && !salesSummaryRow) return;
      const sum = field => rows.reduce((total, item) => total + number(item[field]), 0);
      const salesPrev = salesSummaryRow ? number(salesSummaryRow[2]) : sum("salesPrev");
      const salesNow = salesSummaryRow ? number(salesSummaryRow[3]) : sum("salesNow");
      const salesGoal = salesSummaryRow ? number(salesSummaryRow[6]) : sum("salesGoal");
      const trafficPrev = trafficSummaryRow ? number(trafficSummaryRow[1]) : sum("trafficPrev");
      const trafficNow = trafficSummaryRow ? number(trafficSummaryRow[2]) : sum("trafficNow");
      const trafficGoal = trafficSummaryRow ? number(trafficSummaryRow[4]) : sum("trafficGoal");
      const ticketWeight = rows.reduce((total, item) => total + Math.max(number(item.salesNow), 0), 0);
      const calculatedTicket = ticketWeight
        ? rows.reduce((total, item) => total + number(item.ticket) * Math.max(number(item.salesNow), 0), 0) / ticketWeight
        : rows.length ? rows.reduce((total, item) => total + number(item.ticket), 0) / rows.length : 0;
      const ticket = salesSummaryRow ? number(salesSummaryRow[5]) : calculatedTicket;
      const variation = salesSummaryRow && salesSummaryRow[4] !== ""
        ? number(salesSummaryRow[4])
        : salesPrev ? salesNow / salesPrev - 1 : 0;

      setText(`.sales-panel tr[data-brand="${key}"] [data-col="ventas-anterior"]`, displayMoney(salesPrev));
      setText(`.sales-panel tr[data-brand="${key}"] [data-col="ventas-actual"]`, displayMoney(salesNow));
      setVariationPill(`.sales-panel tr[data-brand="${key}"] [data-col="variacion"]`, salesPrev, salesNow);

      const focus = document.querySelector(`.brand-focus [data-brand="${key}"]`);
      if (focus) {
        focus.querySelector('[data-metric="ticket-promedio"]').textContent = displayMoney(ticket);
        const repurchase = trafficSummaryRow?.[6];
        focus.querySelector('[data-metric="tasa-recompra"]').textContent =
          repurchase !== "" && repurchase !== undefined ? displayPercent(repurchase) : "No disponible";
      }
      const analysisVariation = document.querySelector(`.brand-analysis [data-brand="${key}"] [data-metric="variacion"]`);
      if (analysisVariation) analysisVariation.textContent = displayPercent(variation);

      rows.forEach(item => {
        item.salesGroupGoal = salesGoal;
        item.trafficGroupPrev = trafficPrev;
        item.trafficGroupNow = trafficNow;
        item.trafficGroupGoal = trafficGoal;
      });
    };
    updateSplitLevis("levis");
    updateSplitLevis("levis-outlet");

    window.reportStoreData = combined;
    renderStorePerformance();
    return {brands:new Set(combined.map(item => item.brand)).size, stores:combined.length};
  }

  function renderStorePerformance() {
    const container = document.querySelector("#storePerformanceRows");
    if (!container) return;
    const source = window.reportStoreData || [];
    if (!source.length) {
      const count = document.querySelector("#storeDetailCount");
      if (count) count.textContent = "Sin información";
      return;
    }
    const dailyStores = window.reportTrafficStores || [];
    const exteriorByBrand = dailyStores.reduce((map, item) => {
      const brand = item.brand || "otros";
      if (!map.has(brand)) map.set(brand, {exterior:0, individual:0});
      const current = map.get(brand);
      current.exterior += number(item.exterior);
      current.individual += number(item.individual);
      return map;
    }, new Map());
    const groups = Array.from(source.reduce((map, item) => {
      if (!map.has(item.brand)) map.set(item.brand, []);
      map.get(item.brand).push(item);
      return map;
    }, new Map()));
    container.innerHTML = groups.map(([brand, stores]) => {
      const totalSales = stores.reduce((sum, item) => sum + number(item.salesNow), 0);
      const previousSales = stores.reduce((sum, item) => sum + number(item.salesPrev), 0);
      const totalTraffic = stores.reduce((sum, item) => sum + number(item.trafficNow), 0);
      const previousTraffic = stores.reduce((sum, item) => sum + number(item.trafficPrev), 0);
      const exterior = exteriorByBrand.get(brand)?.exterior || 0;
      const individual = exteriorByBrand.get(brand)?.individual || totalTraffic;
      const capture = exterior ? individual / exterior : 0;
      const best = stores.slice().sort((a, b) => number(b.salesVar) - number(a.salesVar))[0];
      const validCompliance = stores.filter(item => item.salesCompliance !== "" && item.salesCompliance !== undefined && number(item.salesCompliance) > 0);
      const opportunity = validCompliance.sort((a, b) => number(a.salesCompliance) - number(b.salesCompliance))[0];
      const salesVariation = previousSales ? totalSales / previousSales - 1 : 0;
      const trafficVariation = previousTraffic ? totalTraffic / previousTraffic - 1 : 0;
      return `<article class="store-insight-card commercial-brand-card" data-brand="${brand}">
        <div class="store-insight-head"><span>${escapeHtml(brandLabels[brand] || brand)}</span><b>${stores.length} ${stores.length === 1 ? "tienda" : "tiendas"}</b></div>
        <div class="commercial-brand-main"><strong>${displayMoney(totalSales)}</strong><span>Venta 2026</span></div>
        <div class="commercial-brand-metrics">
          <div><span>Venta PY</span><b>${displayMoney(previousSales)}</b></div>
          <div><span>Variación</span><b class="${salesVariation >= 0 ? "positive" : "negative"}">${displayPercent(salesVariation)}</b></div>
          <div><span>Tráfico 2026</span><b>${displayNumber(totalTraffic)}</b></div>
          <div><span>Tráfico PY</span><b>${displayNumber(previousTraffic)}</b><small>${displayPercent(trafficVariation)} vs. PY</small></div>
          <div><span>Tráfico exterior 2026</span><b>${exterior ? displayNumber(exterior) : "Sin dato"}</b></div>
          <div><span>Tráfico interior</span><b>${displayNumber(individual)}</b></div>
          <div><span>Tasa de captura</span><b>${exterior ? displayPercent(capture) : "Sin dato"}</b></div>
          <div><span>Lectura tienda</span><b>${escapeHtml(best?.store || "Sin dato")}</b><small>Mejor tienda</small></div>
        </div>
        <div class="store-insight-notes"><p><span>Tienda con oportunidad</span><strong>${escapeHtml(opportunity?.store || "Sin dato")}</strong></p></div>
      </article>`;
    }).join("");
    const count = document.querySelector("#storeDetailCount");
    if (count) count.textContent = `${source.length} tiendas · ${groups.length} marcas`;
  }
  function applyBrandSummaryFilter(brand = "all") {
    const source = window.reportStoreData || [];
    if (!source.length) return;
    const rows = brand === "all" ? source : source.filter(item => item.brand === brand);
    if (!rows.length) {
      ["ventas-semana", "variacion-semana", "cumplimiento-meta", "meta-semana", "trafico-semana", "cumplimiento-trafico", "ticket-compania"]
        .forEach(field => setText(`[data-field="${field}"]`, "-"));
      return;
    }
    const sum = field => rows.reduce((total, item) => total + number(item[field]), 0);
    const salesNow = sum("salesNow");
    const salesPrev = sum("salesPrev");
    const salesGoal = sum("salesGoal");
    const trafficNow = sum("trafficNow");
    const trafficGoal = sum("trafficGoal");
    const salesWeight = rows.reduce((total, item) => total + Math.max(number(item.salesNow), 0), 0);
    const ticket = salesWeight
      ? rows.reduce((total, item) => total + number(item.ticket) * Math.max(number(item.salesNow), 0), 0) / salesWeight
      : 0;
    const variation = salesPrev ? salesNow / salesPrev - 1 : 0;
    setText('[data-field="ventas-semana"]', displayMoney(salesNow));
    setText('[data-field="variacion-semana"]', `${variation > 0 ? "+" : ""}${displayPercent(variation)}`);
    setText('[data-field="variacion-compania"]', `${variation > 0 ? "+" : ""}${displayPercent(variation)}`);
    setText('[data-field="meta-semana"]', displayMoney(salesGoal));
    setText('[data-field="cumplimiento-meta"]', salesGoal ? displayPercent(salesNow / salesGoal) : "-");
    setText('[data-field="trafico-semana"]', displayNumber(trafficNow));
    setText('[data-field="cumplimiento-trafico"]', trafficGoal ? displayPercent(trafficNow / trafficGoal) : "-");
    setText('[data-field="ticket-compania"]', displayMoney(ticket));
  }

  function applyDailyTraffic(rows) {
    if (rows.length < 2) return 0;
    const commercialStores = window.reportStoreData || [];
    const storeBrand = store => {
      const normalized = normalizeStore(store);
      const match = commercialStores.find(item => {
        const candidate = normalizeStore(item.store);
        return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
      });
      return match?.brand || "";
    };
    window.reportDailyTraffic = rows.slice(1).filter(row => row[1]).map(row => ({
      rawDate:row[0], date:displayDate(row[0]), store:row[1], brand:storeBrand(row[1]),
      exterior:row[2], individual:row[3], conversion:row[4]
    }));
    const groups = new Map();
    window.reportDailyTraffic.forEach(item => {
      const key = normalize(item.store);
      if (!groups.has(key)) groups.set(key, {key, store:item.store, brand:item.brand, days:[]});
      groups.get(key).days.push(item);
    });
    window.reportTrafficStores = Array.from(groups.values()).map(group => {
      const validConversions = group.days.map(day => number(day.conversion)).filter(value => Number.isFinite(value) && value >= 0 && value <= 2);
      const best = group.days.reduce((winner, day) => number(day.exterior) > number(winner?.exterior) ? day : winner, null);
      return {
        ...group,
        exterior:group.days.reduce((sum, day) => sum + number(day.exterior), 0),
        individual:group.days.reduce((sum, day) => sum + number(day.individual), 0),
        conversion:validConversions.length ? validConversions.reduce((sum, value) => sum + value, 0) / validConversions.length : 0,
        best
      };
    }).sort((a, b) => b.exterior - a.exterior);
    const select = document.querySelector("#dailyTrafficStore");
    if (select) {
      select.innerHTML = window.reportTrafficStores.map(item =>
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.brand ? `${brandLabels[item.brand] || item.brand} · ${item.store}` : item.store)}</option>`
      ).join("");
      window.selectedTrafficStore = window.reportTrafficStores[0]?.key || "";
      select.value = window.selectedTrafficStore;
    }
    renderDailyTraffic();
    renderStorePerformance();
    return window.reportDailyTraffic.length;
  }

  function renderDailyTraffic() {
    const tbody = document.querySelector("#dailyTrafficRows");
    if (!tbody) return;
    const allStores = window.reportTrafficStores || [];
    const brand = window.reportBrandFilter || "all";
    const stores = brand === "all" ? allStores : allStores.filter(item => item.brand === brand);
    const select = document.querySelector("#dailyTrafficStore");
    if (select) {
      select.innerHTML = stores.map(item =>
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.brand ? `${brandLabels[item.brand] || item.brand} · ${item.store}` : item.store)}</option>`
      ).join("") || '<option value="">Sin tiendas para esta marca</option>';
    }
    if (!stores.some(item => item.key === window.selectedTrafficStore)) {
      window.selectedTrafficStore = stores[0]?.key || "";
    }
    if (select) select.value = window.selectedTrafficStore;
    tbody.innerHTML = stores.map(item => `<tr class="traffic-rank-row${item.key === window.selectedTrafficStore ? " selected" : ""}" data-traffic-store="${escapeHtml(item.key)}" data-brand="${escapeHtml(item.brand)}">
      <td class="store-cell"><strong>${escapeHtml(item.store)}</strong><small>${escapeHtml(brandLabels[item.brand] || item.brand || "Sin clasificar")}</small></td>
      <td>${item.days.length}</td><td>${displayNumber(item.exterior)}</td><td>${displayNumber(item.individual)}</td>
      <td>${displayPercent(item.conversion)}</td><td>${escapeHtml(item.best?.date || "-")}</td>
    </tr>`).join("") || '<tr><td colspan="6" class="empty-table">Sin datos de tráfico.</td></tr>';
    const count = document.querySelector("#dailyTrafficCount");
    if (count) count.textContent = `${stores.length} puntos de venta`;
    const selected = stores.find(item => item.key === window.selectedTrafficStore) || stores[0];
    if (!selected) {
      setText("#trafficExteriorTotal", "-");
      setText("#trafficIndividualTotal", "-");
      setText("#trafficConversionAvg", "-");
      setText("#trafficBestDay", "-");
      const chart = document.querySelector("#trafficDailyChart");
      if (chart) chart.innerHTML = '<p class="empty-table">No hay tiendas para esta marca.</p>';
      return;
    }
    window.selectedTrafficStore = selected.key;
    setText("#trafficExteriorTotal", displayNumber(selected.exterior));
    setText("#trafficIndividualTotal", displayNumber(selected.individual));
    setText("#trafficConversionAvg", displayPercent(selected.conversion));
    setText("#trafficBestDay", selected.best?.date || "-");
    const maxExterior = Math.max(...selected.days.map(day => number(day.exterior)), 1);
    const chart = document.querySelector("#trafficDailyChart");
    if (chart) {
      chart.innerHTML = selected.days.slice().sort((a, b) => number(a.rawDate) - number(b.rawDate)).map(day => {
        const height = Math.max(4, number(day.exterior) / maxExterior * 100);
        const conversion = typeof day.conversion === "string" && !number(day.conversion) ? "Sin dato" : displayPercent(day.conversion);
        return `<div class="traffic-day">
          <div class="traffic-day-tooltip"><b>${escapeHtml(day.date)}</b><span>Exterior: ${displayNumber(number(day.exterior))}</span><span>Individual: ${displayNumber(number(day.individual))}</span><span>Conversión: ${conversion}</span></div>
          <div class="traffic-bar-column"><i style="height:${height}%"></i></div>
          <small>${escapeHtml(day.date.split(" ")[0])}</small>
        </div>`;
      }).join("");
    }
  }

  function restoreRuntimeData(runtime = {}) {
    window.reportStoreData = Array.isArray(runtime.storeData) ? runtime.storeData : [];
    window.reportDailyTraffic = Array.isArray(runtime.dailyTraffic) ? runtime.dailyTraffic : [];
    window.reportTrafficStores = Array.isArray(runtime.trafficStores) ? runtime.trafficStores : [];
    window.selectedTrafficStore = runtime.selectedTrafficStore || window.reportTrafficStores[0]?.key || "";
    window.reportBrandFilter = runtime.globalBrand || "all";
    restoreCRMData(runtime.crmData);
    if (window.reportStoreData.length) renderStorePerformance();
    if (window.reportTrafficStores.length) renderDailyTraffic();
  }

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const defaultImage = brand => brand === "desigual" ? "assets/ventas-privadas.png" : brand === "wiseman" ? "assets/wiseman-papa.png" : "assets/papa-con-estilo.png";
  const driveImageId = value => String(value ?? "").match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || String(value ?? "").match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    || String(value ?? "").match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || "";
  const driveImageUrl = value => {
    const url = String(value ?? "").trim();
    if (!url || normalize(url).includes("pegar enlace publico")) return "";
    const id = driveImageId(url);
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
    return /^https?:\/\//i.test(url) ? url : "";
  };
  const actionKey = (brand, campaign) => `${brandKey(brand)}|${normalize(campaign)}`;

  const campaignTokens = value => new Set(normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 2 && !["levis", "desigual", "wiseman", "outlets", "hasta", "todo", "off", "2026", "del", "los", "las", "para"].includes(token)));

  function evidenceForAction(map, brand, campaign) {
    const exact = map.get(actionKey(brand, campaign));
    if (exact?.length) return exact;
    const targetBrand = brandKey(brand);
    const targetTokens = campaignTokens(campaign);
    let best = {score:0, items:[]};
    for (const [key, items] of map) {
      const separator = key.indexOf("|");
      if (key.slice(0, separator) !== targetBrand) continue;
      const candidateTokens = campaignTokens(key.slice(separator + 1));
      const shared = [...targetTokens].filter(token => candidateTokens.has(token)).length;
      const score = shared / Math.max(1, Math.min(targetTokens.size, candidateTokens.size));
      if (shared >= 2 && score > best.score) best = {score, items};
    }
    return best.score >= .5 ? best.items : [];
  }

  function evidenceMap(rows) {
    if (rows.length < 2) return new Map();
    const headers = rows[0];
    const map = new Map();
    rows.slice(1).filter(row => row.some(value => value !== undefined && value !== "")).forEach(raw => {
      const row = rowObject(headers, raw);
      const brand = pick(row, "marca");
      const campaign = pick(row, "campana", "campaña");
      const source = driveImageUrl(pick(row, "enlace de drive", "enlace drive", "url", "enlace"));
      if (!brand || !campaign || !source) return;
      const key = actionKey(brand, campaign);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        source,
        order:number(pick(row, "orden")) || 999,
        principal:normalize(pick(row, "principal")) === "si",
        description:pick(row, "descripcion", "descripción"),
        type:pick(row, "tipo de accion", "tipo de acción", "tipo")
      });
    });
    map.forEach(items => items.sort((a, b) => Number(b.principal) - Number(a.principal) || a.order - b.order));
    return map;
  }
  const actionCategory = value => {
    const key = normalize(value);
    if (key.includes("email") || key.includes("sms") || key.includes("whatsapp") || key.includes("crm") || key.includes("mail")) return "crm";
    if (key.includes("fichero") || key.includes("google") || key.includes("seo") || key.includes("perfil de negocio")) return "ficheros-google";
    if (key.includes("redes") || key.includes("social") || key.includes("instagram") || key.includes("facebook") || key.includes("tiktok")) return "redes-sociales";
    if (key.includes("btl") || key.includes("activacion") || key.includes("punto de venta")) return "btl";
    if (key.includes("atl") || key.includes("radio") || key.includes("television") || key.includes("prensa") || key.includes("valla")) return "atl";
    if (key.includes("vitrina") || key.includes("visual")) return "vitrinas";
    if (key.includes("evento") || key.includes("lanzamiento") || key.includes("reapertura")) return "eventos";
    return "otros";
  };
  const categoryLabels = {
    "crm":"CRM", "btl":"BTL", "redes-sociales":"Redes sociales",
    "ficheros-google":"Ficheros de Google", "atl":"ATL",
    "vitrinas":"Vitrinas", "eventos":"Eventos", "otros":"Otros"
  };


  function executionGroup(row) {
    const text = [pick(row, "tipo", "canal"), pick(row, "canales", "canal"), pick(row, "titulo", "título", "campana", "campaña"), pick(row, "descripcion", "descripción")].join(" ");
    const key = normalize(text);
    if (key.includes("email") || key.includes("sms") || key.includes("whatsapp") || key.includes("crm") || key.includes("mail")) return "CRM";
    if (key.includes("pauta") || key.includes("meta") || key.includes("paid") || key.includes("ads") || key.includes("instagram") || key.includes("facebook") || key.includes("tiktok") || key.includes("redes") || key.includes("social")) return "Marketing Digital";
    if (key.includes("btl") || key.includes("punto de venta") || key.includes("pop") || key.includes("cenefa") || key.includes("vitrina")) return "BTL";
    if (key.includes("atl") || key.includes("valla") || key.includes("radio") || key.includes("prensa") || key.includes("television") || key.includes("televisión")) return "ATL";
    if (key.includes("activacion") || key.includes("activación") || key.includes("evento") || key.includes("lanzamiento") || key.includes("experiencia")) return "Activaciones de Marca";
    return "Otros";
  }

  function renderExecutionSummary(data) {
    const container = document.querySelector("#executionSummaryRows");
    if (!container) return;
    const brands = ["levis", "levis-outlet", "desigual", "wiseman", "digital"].filter(brand =>
      data.some(row => brandKey(pick(row, "marca")) === brand)
    );
    container.innerHTML = brands.map(brand => {
      const rows = data.filter(row => brandKey(pick(row, "marca")) === brand);
      const groups = Array.from(rows.reduce((map, row) => {
        const group = executionGroup(row);
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(row);
        return map;
      }, new Map())).sort((a, b) => b[1].length - a[1].length);
      const campaigns = rows.map(row => pick(row, "titulo", "título", "campana", "campaña")).filter(Boolean);
      return `<article class="execution-summary-card" data-brand="${brand}">
        <div class="execution-summary-head"><span>${escapeHtml(brandLabels[brand] || brand)}</span><b>${rows.length} ${rows.length === 1 ? "acción" : "acciones"}</b></div>
        <div class="execution-category-list">${groups.map(([name, items]) => `<span>${escapeHtml(name)} <b>${items.length}</b></span>`).join("")}</div>
        <p>${escapeHtml(campaigns.slice(0, 2).join(" · ") || "Sin campañas destacadas")}</p>
      </article>`;
    }).join("") || '<article class="crm-campaign-empty">Sin acciones por marca.</article>';
    const count = document.querySelector("#executionSummaryCount");
    if (count) count.textContent = `${data.length} ${data.length === 1 ? "acción" : "acciones"}`;
  }

  function renderDigitalPauta(data) {
    const container = document.querySelector("#digitalPautaRows");
    if (!container) return;
    const digitalRows = data.filter(row => {
      const text = [pick(row, "tipo", "canal"), pick(row, "canales", "canal"), pick(row, "titulo", "título", "campana", "campaña"), pick(row, "descripcion", "descripción")].join(" ");
      const key = normalize(text);
      return key.includes("pauta") || key.includes("digital") || key.includes("ads") || key.includes("meta") || key.includes("redes") || key.includes("instagram") || key.includes("facebook") || key.includes("tiktok") || key.includes("social");
    });
    container.innerHTML = digitalRows.map(row => {
      const brand = brandKey(pick(row, "marca"));
      const channels = String(pick(row, "canales", "canal") || "").split(/[,;+]/).map(item => item.trim()).filter(Boolean);
      return `<article class="digital-pauta-card" data-brand="${brand}">
        <div class="crm-campaign-top"><span>${escapeHtml(brandLabels[brand] || pick(row, "marca") || "Sin marca")}</span><b>${escapeHtml(pick(row, "tipo", "canal") || "Digital")}</b></div>
        <h4>${escapeHtml(pick(row, "titulo", "título", "campana", "campaña") || "Acción digital")}</h4>
        <p>${escapeHtml(pick(row, "descripcion", "descripción") || "Acción importada desde el Excel semanal.")}</p>
        <div class="channel-list">${channels.map(channel => `<span>${escapeHtml(channel)}</span>`).join("")}</div>
      </article>`;
    }).join("") || '<article class="crm-campaign-empty">Sin pauta digital reportada para la semana.</article>';
    const count = document.querySelector("#digitalPautaCount");
    if (count) count.textContent = `${digitalRows.length} ${digitalRows.length === 1 ? "acción" : "acciones"}`;
  }
  function actionCard(row, linkedEvidence = []) {
    const brand = brandKey(pick(row, "marca")) || "levis";
    const title = pick(row, "titulo", "título", "campana", "campaña") || "Acción de marketing";
    const type = pick(row, "tipo", "canal") || "Marketing";
    const date = pick(row, "fecha", "fecha envio", "fecha envío") || "Semana actual";
    const description = pick(row, "descripcion", "descripción", "segmento") || "Acción importada desde el archivo semanal.";
    const channels = String(pick(row, "canales", "canal") || "").split(/[,;+]/).map(item => item.trim()).filter(Boolean);
    const categories = Array.from(new Set([type, ...channels].map(actionCategory)));
    if (categories.length > 1) {
      const withoutOther = categories.filter(category => category !== "otros");
      if (withoutOther.length) categories.splice(0, categories.length, ...withoutOther);
    }
    const categoryText = categories.map(category => categoryLabels[category]).join(" · ");
    const linkedImages = linkedEvidence.map(item => item.source);
    const images = linkedImages.length ? linkedImages : row.__images?.length ? row.__images : [row.__image || defaultImage(brand)];
    const image = images[0];
    const imageTag = (source, alt, className = "") => {
      const id = driveImageId(source);
      return `<img${className ? ` class="${className}"` : ""} src="${escapeHtml(source)}" alt="${escapeHtml(alt)}"${id ? ` data-drive-id="${id}" data-drive-attempt="0"` : ""} loading="lazy" decoding="async">`;
    };
    const results = ["resultado 1", "resultado 2", "resultado 3"].map(name => pick(row, name)).filter(Boolean);
    return `<article class="evidence-card" data-brand="${brand}" data-type="${categories.join(" ")}">
      <div class="evidence-image">
        ${imageTag(image, title, "replaceable-image")}
        <span class="image-edit-hint">Cambiar imagen</span>
        <div class="card-brand editable" contenteditable="false">${brandLabels[brand] || escapeHtml(pick(row, "marca"))}</div>
        <div class="card-action-type editable" contenteditable="false">${escapeHtml(categoryText)}</div>
      </div>
      <div class="evidence-gallery">
        ${images.map((source, index) => `<button class="gallery-thumb${index === 0 ? " active" : ""}" type="button">${imageTag(source, `${title} ${index + 1}`)}<span class="remove-gallery-image" aria-label="Eliminar foto">×</span></button>`).join("")}
        <button class="add-gallery-images" type="button">+ Fotos</button>
      </div>
      <div class="evidence-body">
        <div class="evidence-meta"><span>${escapeHtml(type)}</span><time class="editable" contenteditable="false">${escapeHtml(date)}</time></div>
        <h3 class="editable" contenteditable="false">${escapeHtml(title)}</h3>
        <p class="editable" contenteditable="false">${escapeHtml(description)}</p>
        ${results.length ? `<div class="imported-results">${results.map(result => `<span class="editable" contenteditable="false">${escapeHtml(result)}</span>`).join("")}</div>` : ""}
        <div class="channel-list">${channels.map(channel => `<span class="editable" contenteditable="false">${escapeHtml(channel)}</span>`).join("")}</div>
      </div>
      <button class="delete-card" type="button" aria-label="Eliminar evidencia">×</button>
    </article>`;
  }

  function applyActions(rows, evidenceRows = []) {
    if (rows.length < 2) return 0;
    const headers = rows[0];
    const data = rows.slice(1).filter(row => row.some(value => value !== undefined && value !== "")).map(row => rowObject(headers, row));
    if (!data.length) return 0;
    const links = evidenceMap(evidenceRows);
    renderExecutionSummary(data);
    renderDigitalPauta(data);
    const grid = document.querySelector("#evidenceGrid");
    grid.innerHTML = data.map(row => actionCard(row, evidenceForAction(links, pick(row, "marca"), pick(row, "titulo", "título", "campana", "campaña")))).join("");
    window.hydrateGalleryControls?.(grid);
    window.resetActionFilters?.();
    window.refreshEditingState?.();
    return data.length;
  }

  async function importExcel(file) {
    status(`Leyendo ${file.name}...`);
    const files = await unzip(await file.arrayBuffer());
    const workbook = parseWorkbook(files);
    const salesSheet = sheetByName(workbook, "Ventas");
    const trafficSheet = sheetByName(workbook, "Trafico");
    let brands = 0;
    let stores = 0;
    if (salesSheet.length && trafficSheet.length) {
      const commercial = applySalesTrafficFormat(salesSheet, trafficSheet);
      brands = commercial.brands;
      stores = commercial.stores;
    } else {
      applySummary(sheetByName(workbook, "Resumen"));
      brands = applyBrands(sheetByName(workbook, "Marcas"));
    }
    const dailyTraffic = applyDailyTraffic(sheetByName(workbook, "Trafico Detallado"));
    const crm = applyCRM(sheetByName(workbook, "CRM"));
    const actions = applyActions(sheetByName(workbook, "Acciones"), sheetByName(workbook, "Evidencias"));
    const budgetSheet = sheetByName(workbook, "Ejecucion Ppto").length
      ? sheetByName(workbook, "Ejecucion Ppto")
      : sheetByName(workbook, "Presupuesto");
    const budget = budgetSheet.length ? window.BudgetModule?.applySheet?.(budgetSheet) || 0 : 0;
    window.applyActionFilters?.();
    window.saveReport?.(false);
    status(`Excel aplicado: ${brands} marcas${stores ? `, ${stores} tiendas` : ""}, ${dailyTraffic} registros de tráfico, ${crm} campañas CRM${actions ? `, ${actions} acciones` : ""}${budget ? ` y ${budget} movimientos de presupuesto` : ""}.`);
    window.showToast?.("Datos del Excel actualizados");
  }

  const bytesToDataUrl = (bytes, mime) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(new Blob([bytes], {type:mime}));
  });

  function pptBrand(text, current) {
    const key = normalize(text);
    if (key.includes("desigual") || key.includes("ventas privadas")) return "desigual";
    if (key.includes("wiseman") || key.includes("papa titular")) return "wiseman";
    if (key.includes("levi") && key.includes("outlet")) return "levis-outlet";
    if (key.includes("levi") || key.includes("papa con estilo") || key.includes("colina")) return "levis";
    return current;
  }

  function pptActionType(text) {
    const key = normalize(text);
    if (key.includes("campana email")) return "Email";
    if (key.includes("campana sms")) return "SMS";
    if (key.includes("campana whatsapp")) return "WhatsApp";
    if (key.includes("evento") || key.includes("lanzamiento") || key.includes("reapertura")) return "Evento";
    if (key.includes("vitrina")) return "Vitrinas";
    if (key.includes("post redes")) return "Redes sociales";
    if (key.includes("ficheros de google")) return "Google / tiendas";
    if (key.includes("pauta btl")) return "Pauta BTL";
    if (key.includes("pauta atl") || key.includes("radio") || key.includes("television") || key.includes("prensa") || key.includes("valla")) return "ATL";
    return "";
  }

  function pptTitle(items, text, type) {
    const known = [
      /PAP[ÁA] CON ESTILO/i, /LANZAMIENTO LEVI['']?S COLINA/i,
      /REBAJAS\s*[---]\s*VENTAS PRIVADAS/i, /VENTAS PRIVADAS/i,
      /EL PAP[ÁA] TITULAR(?:\s*[---]?\s*40%\s*OFF)?/i,
      /TODO\s+50%,?\s*40%\s*Y\s*30%/i, /TODA LA TIENDA\s*30%\s*OFF/i
    ];
    for (const pattern of known) {
      const match = text.match(pattern);
      if (match) return match[0].replace(/\s+/g, " ").trim();
    }
    const excluded = ["campaña", "enviado", "segmento", "tiendas", "fecha", "centro comercial", "pauta", "duración", "del "];
    return items.map(item => item.trim()).filter(item => item.length > 5 && item.length < 100)
      .find(item => !excluded.some(word => normalize(item).startsWith(normalize(word))) && normalize(item) !== normalize(type))
      || `${type} semanal`;
  }

  function resolvePath(base, target) {
    if (target.startsWith("/")) return target.slice(1);
    const parts = base.split("/"); parts.pop();
    target.split("/").forEach(part => part === ".." ? parts.pop() : part !== "." && parts.push(part));
    return parts.join("/");
  }

  async function importPowerPoint(file) {
    status(`Leyendo ${file.name} y extrayendo evidencias...`);
    const files = await unzip(await file.arrayBuffer());
    const slidePaths = Array.from(files.keys()).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => number(a.match(/\d+/)?.[0]) - number(b.match(/\d+/)?.[0]));
    const actions = [];
    const crmRows = [];
    let currentBrand = "levis";
    for (const slidePath of slidePaths) {
      const doc = xml(textDecoder.decode(files.get(slidePath)));
      const items = elements(doc, "t").map(item => item.textContent).filter(Boolean);
      const fullText = items.join(" | ");
      currentBrand = pptBrand(fullText, currentBrand);
      const type = pptActionType(fullText);
      if (!type) continue;
      const row = {
        marca: currentBrand,
        titulo: pptTitle(items, fullText, type),
        tipo: type,
        fecha: fullText.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)?.[0] || fullText.match(/(?:del\s+)?\d{1,2}\s+de\s+\w+(?:\s+de\s+\d{4})?/i)?.[0] || "Semana importada",
        descripcion: items.find(item => item.length > 120) || items.find(item => normalize(item).startsWith("segmento")) || `Evidencia importada desde la presentación: ${type}.`,
        canales: type
      };
      if (["Email", "SMS", "WhatsApp"].includes(type)) {
        crmRows.push({
          marca: currentBrand,
          canal: type,
          campana: row.titulo,
          "fecha envio": row.fecha,
          segmento: items.find(item => normalize(item).startsWith("segmento"))?.replace(/^segmento\s*:?\s*/i, "") || "",
          "resultado destacado": row.titulo
        });
      }
      const relPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
      const relData = files.get(relPath);
      if (relData) {
        const relDoc = xml(textDecoder.decode(relData));
        const imageTargets = elements(relDoc, "Relationship")
          .filter(rel => String(rel.getAttribute("Type")).includes("/image"))
          .map(rel => resolvePath(slidePath, rel.getAttribute("Target")))
          .filter(path => files.has(path))
          .sort((a, b) => files.get(b).length - files.get(a).length);
        row.__images = [];
        for (const imageTarget of imageTargets.slice(0, 12)) {
          const extension = imageTarget.split(".").pop().toLowerCase();
          const mime = extension === "png" ? "image/png" : extension === "gif" ? "image/gif" : "image/jpeg";
          row.__images.push(await bytesToDataUrl(files.get(imageTarget), mime));
        }
      }
      actions.push(row);
    }
    const actionMap = new Map();
    actions.forEach(action => {
      const key = `${action.marca}|${normalize(action.titulo)}|${normalize(action.tipo)}`;
      if (!actionMap.has(key)) {
        actionMap.set(key, action);
      } else {
        const existing = actionMap.get(key);
        existing.__images = Array.from(new Set([...(existing.__images || []), ...(action.__images || [])]));
        if (existing.descripcion.startsWith("Evidencia importada") && !action.descripcion.startsWith("Evidencia importada")) {
          existing.descripcion = action.descripcion;
        }
      }
    });
    const unique = Array.from(actionMap.values());
    if (!unique.length) throw new Error("No se encontraron diapositivas reconocibles como acciones de marketing.");
    const grid = document.querySelector("#evidenceGrid");
    grid.innerHTML = unique.map(actionCard).join("");
    window.hydrateGalleryControls?.(grid);
    window.resetActionFilters?.();
    window.refreshEditingState?.();
    if (crmRows.length) {
      const headers = ["Marca", "Canal", "Campaña", "Fecha envío", "Segmento", "Enviados", "Entregados", "Tasa entrega", "Apertura", "CTR", "Leídos", "Respuestas", "Conversiones", "Bajas", "Base impactada", "Resultado destacado"];
      const crmSheet = [headers, ...crmRows.map(row => headers.map(header => row[normalize(header)] ?? ""))];
      applyCRM(crmSheet);
    }
    window.saveReport?.(false);
    status(`PowerPoint aplicado: ${unique.length} acciones y evidencias visuales.`);
    window.showToast?.("Acciones del PowerPoint importadas");
  }

  function status(message) {
    const target = document.querySelector("#importStatus");
    if (target) target.textContent = message;
  }

  function handle(input, importer) {
    input?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await importer(file);
      } catch (error) {
        console.error(error);
        status(`No se pudo importar: ${error.message}`);
        window.showToast?.("No fue posible importar el archivo");
      } finally {
        event.target.value = "";
      }
    });
  }

  handle(document.querySelector("#importExcel"), importExcel);
  handle(document.querySelector("#importPowerPoint"), importPowerPoint);
  document.addEventListener("click", event => {
    const trafficRow = event.target.closest(".traffic-rank-row");
    if (trafficRow) {
      window.selectedTrafficStore = trafficRow.dataset.trafficStore;
      const select = document.querySelector("#dailyTrafficStore");
      if (select) select.value = window.selectedTrafficStore;
      renderDailyTraffic();
    }
  });
  document.addEventListener("change", event => {
    if (!event.target.matches("#dailyTrafficStore")) return;
    window.selectedTrafficStore = event.target.value;
    renderDailyTraffic();
  });
  window.ReportImporter = {
    importExcel, importPowerPoint, unzip, parseWorkbook, applySalesTrafficFormat,
    applyDailyTraffic, renderStorePerformance, renderDailyTraffic, restoreRuntimeData
  };
  window.applyBrandSummaryFilter = applyBrandSummaryFilter;
})();





