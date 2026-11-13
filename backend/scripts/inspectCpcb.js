
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

async function main() {
  const url = new URL(
    `https://api.data.gov.in/resource/${process.env.CPCB_AQI_RESOURCE_ID}`
  );

  url.searchParams.set("api-key", process.env.CPCB_API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("filters[city]", "Kolkata");
  url.searchParams.set("limit", "1000");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CPCB HTTP ${response.status}`);
  }

  const data = await response.json();
  const records = data.records || [];

  console.log("Total Kolkata records:", data.total);
  console.log("Records received:", records.length);

  console.table(
    records.map((r) => ({
      station: r.station,
      latitude: r.latitude,
      longitude: r.longitude,
      pollutant: r.pollutant_id,
      average: r.avg_value,
      lastUpdate: r.last_update,
    }))
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});