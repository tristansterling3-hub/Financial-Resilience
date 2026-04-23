let baseRows = [];
let geojson = null;
const CENSUS_API_KEY = "c3b895c40dc66379b8b94a7716a0832ebea452d7";
const GEOJSON_URL = "./data/North_Carolina_State_and_County_Boundary_Polygons.geojson";

const countySelect = document.getElementById("county-select");
const wIncome = document.getElementById("w-income");
const wUnemp = document.getElementById("w-unemp");
const wCost = document.getElementById("w-cost");

function parseFloatSafe(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizedWeights() {
  let income = parseFloatSafe(wIncome.value);
  let unemp = parseFloatSafe(wUnemp.value);
  let cost = parseFloatSafe(wCost.value);

  if (income + unemp + cost === 0) {
    income = 1;
  }
  const total = income + unemp + cost;

  return {
    income: income / total,
    unemp: unemp / total,
    cost: cost / total,
  };
}

function computeRows() {
  const w = normalizedWeights();
  const rows = baseRows.map((row) => {
    const unemploymentNorm = 0.5;
    const costNorm = 0.5;
    const resilienceScore =
      w.income * row.Income_Norm +
      w.unemp * (1 - unemploymentNorm) +
      w.cost * (1 - costNorm);

    return {
      ...row,
      Unemployment_Norm: unemploymentNorm,
      Cost_Norm: costNorm,
      Resilience_Score: Number(resilienceScore.toFixed(3)),
    };
  });

  return rows.sort((a, b) => b.Resilience_Score - a.Resilience_Score);
}

function updateWeightLabels() {
  const w = normalizedWeights();
  document.getElementById("income-weight-label").textContent = Number(wIncome.value).toFixed(2);
  document.getElementById("unemp-weight-label").textContent = Number(wUnemp.value).toFixed(2);
  document.getElementById("cost-weight-label").textContent = Number(wCost.value).toFixed(2);
  document.getElementById("norm-income").textContent = `Income: ${w.income.toFixed(2)}`;
  document.getElementById("norm-unemp").textContent = `Unemployment: ${w.unemp.toFixed(2)}`;
  document.getElementById("norm-cost").textContent = `Cost: ${w.cost.toFixed(2)}`;
}

function populateCountySelect(rows) {
  const names = [...new Set(rows.map((r) => r.County))].sort((a, b) => a.localeCompare(b));
  countySelect.innerHTML = "";
  for (const county of names) {
    const opt = document.createElement("option");
    opt.value = county;
    opt.textContent = county;
    countySelect.appendChild(opt);
  }
}

function renderSelected(rows) {
  const selectedCounty = countySelect.value || rows[0]?.County;
  const selected = rows.find((r) => r.County === selectedCounty) || rows[0];
  if (!selected) {
    return;
  }

  const rank = rows.findIndex((r) => r.County === selected.County) + 1;
  let insight = "Moderate income levels";
  if (selected.Income_Norm > 0.75) {
    insight = "High income levels";
  } else if (selected.Income_Norm < 0.4) {
    insight = "Low income levels";
  }

  document.getElementById("selected-score").textContent = `${selected.County}: ${selected.Resilience_Score}`;
  document.getElementById("selected-rank").textContent = `#${rank} of ${rows.length}`;
  document.getElementById("selected-insight").textContent = insight;
}

function renderBar(rows) {
  Plotly.newPlot(
    "bar-chart",
    [
      {
        type: "bar",
        x: rows.map((r) => r.County),
        y: rows.map((r) => r.Resilience_Score),
        marker: { color: "#247ba0" },
      },
    ],
    {
      title: "Financial Resilience by County",
      margin: { t: 45, l: 40, r: 10, b: 110 },
      xaxis: { tickangle: -60 },
      yaxis: { range: [0, 1] },
    },
    { responsive: true }
  );
}

function renderMap(rows) {
  Plotly.newPlot(
    "map-chart",
    [
      {
        type: "choropleth",
        geojson: geojson,
        locations: rows.map((r) => r.County),
        z: rows.map((r) => r.Resilience_Score),
        text: rows.map((r) => `${r.County}<br>Income: ${Number(r.Median_Income).toLocaleString()}`),
        featureidkey: "properties.County",
        colorscale: "YlGnBu",
        marker: { line: { color: "white", width: 1 } },
      },
    ],
    {
      geo: {
        fitbounds: "locations",
        visible: false,
        projection: { type: "mercator" },
      },
      margin: { t: 0, l: 0, r: 0, b: 0 },
    },
    { responsive: true }
  );
}

function renderTable(rows) {
  const tbody = document.querySelector("#data-table tbody");
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.County}</td>
      <td>${Number(row.Median_Income).toLocaleString()}</td>
      <td>${Number(row.Income_Norm).toFixed(3)}</td>
      <td>${Number(row.Resilience_Score).toFixed(3)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderRankings(rows) {
  const top5 = document.getElementById("top5");
  const bottom5 = document.getElementById("bottom5");
  top5.innerHTML = "";
  bottom5.innerHTML = "";

  rows.slice(0, 5).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = `${r.County} (${r.Resilience_Score})`;
    top5.appendChild(li);
  });

  rows
    .slice(-5)
    .reverse()
    .forEach((r) => {
      const li = document.createElement("li");
      li.textContent = `${r.County} (${r.Resilience_Score})`;
      bottom5.appendChild(li);
    });
}

function csvFromRows(rows) {
  const headers = ["County", "Median_Income", "Income_Norm", "Resilience_Score"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.County, r.Median_Income, r.Income_Norm, r.Resilience_Score].join(","));
  }
  return lines.join("\n");
}

function wireAssistant() {
  const askBtn = document.getElementById("ask-btn");
  const question = document.getElementById("question");
  const response = document.getElementById("ai-response");

  askBtn.addEventListener("click", () => {
    const q = (question.value || "").toLowerCase();
    if (!q.trim()) {
      response.textContent = "";
      return;
    }
    if (q.includes("flood")) {
      response.textContent = "Counties in eastern NC such as Craven and Pamlico face flood risks.";
    } else if (q.includes("hurricane")) {
      response.textContent = "Hurricane recovery resources should prioritize Robeson and Columbus.";
    } else if (q.includes("income")) {
      response.textContent = "Low-income counties may need long-term aid programs.";
    } else if (q.includes("help")) {
      response.textContent = "Use resilience scores to distribute resources efficiently.";
    } else {
      response.textContent = "Try asking about floods, hurricanes, or income issues.";
    }
  });
}

function renderAll() {
  updateWeightLabels();
  const rows = computeRows();
  renderSelected(rows);
  renderBar(rows);
  renderMap(rows);
  renderTable(rows);
  renderRankings(rows);

  document.getElementById("download-btn").onclick = () => {
    const csv = csvFromRows(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nc_resilience_scores.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}

async function init() {
  const censusUrl =
    "https://api.census.gov/data/2022/acs/acs5?" +
    `get=NAME,B19013_001E&for=county:*&in=state:37&key=${CENSUS_API_KEY}`;

  const [censusResp, geoResp] = await Promise.all([fetch(censusUrl), fetch(GEOJSON_URL)]);
  if (!censusResp.ok) {
    throw new Error(`Census API request failed (${censusResp.status})`);
  }
  if (!geoResp.ok) {
    throw new Error(`GeoJSON request failed (${geoResp.status})`);
  }

  const censusData = await censusResp.json();
  geojson = await geoResp.json();

  const rawRows = censusData.slice(1).map((row) => ({
    NAME: row[0],
    Median_Income: Number(row[1]),
  }));

  const incomes = rawRows.map((r) => r.Median_Income).filter((n) => Number.isFinite(n));
  const minIncome = Math.min(...incomes);
  const maxIncome = Math.max(...incomes);
  const range = maxIncome - minIncome || 1;

  baseRows = rawRows.map((r) => ({
    County: r.NAME.replace(" County, North Carolina", ""),
    Median_Income: r.Median_Income,
    Income_Norm: (r.Median_Income - minIncome) / range,
  }));

  populateCountySelect(baseRows);
  wireAssistant();

  [wIncome, wUnemp, wCost, countySelect].forEach((el) => {
    el.addEventListener("input", renderAll);
    el.addEventListener("change", renderAll);
  });

  renderAll();
}

init().catch((err) => {
  const root = document.querySelector(".content");
  root.innerHTML = `<h1>EquiScope</h1><p>Failed to load data: ${err.message}</p>`;
});
