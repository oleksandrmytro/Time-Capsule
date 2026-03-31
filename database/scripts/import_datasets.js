// CSV-based dataset seed for Time Capsule.
// Run with: mongosh /scripts/import_datasets.js

const fs = require("fs");

const SEED_PATH = process.env.SEED_DATA_PATH || "/seed-data";
const dbName = "time-capsule";
const mongoDb = db.getSiblingDB(dbName);

const COLLECTION_ORDER = [
  "tags",
  "users",
  "pending_users",
  "capsules",
  "shares",
  "follows",
  "comments",
  "reactions",
  "chat_messages",
  "notifications",
  "reminders",
  "geomarkers",
  "feed_events"
];

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : "";

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        cur += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw || !raw.trim()) return [];

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function resetCollections() {
  COLLECTION_ORDER.forEach((name) => mongoDb.getCollection(name).deleteMany({}));
}

function importCollection(name) {
  const path = `${SEED_PATH}/${name}.csv`;
  const rows = readCsv(path);

  if (!rows.length) {
    print(`[skip] ${name}: no rows in ${path}`);
    return;
  }

  const docs = rows
    .filter((row) => row.doc && row.doc.trim().length > 0)
    .map((row) => EJSON.parse(row.doc));

  if (!docs.length) {
    print(`[skip] ${name}: no valid doc payloads in ${path}`);
    return;
  }

  mongoDb.getCollection(name).insertMany(docs, {
    ordered: true,
    bypassDocumentValidation: true
  });

  print(`[ok] ${name}: ${docs.length} docs imported`);
}

function printSummary() {
  print("\n=== Dataset seeded from CSV ===");
  COLLECTION_ORDER.forEach((name) => print(`${name}: ${mongoDb.getCollection(name).countDocuments()}`));
  print("\nAdmin login: control.center@timecapsule.app / ControlRoom2026!");
}

print("[seed] Importing dataset from /seed-data/*.csv ...");
resetCollections();
COLLECTION_ORDER.forEach(importCollection);
printSummary();
