// CSV-based demo seed for Time Capsule.
// Run with: mongosh /scripts/import_datasets.js

const fs = require("fs");

const SEED_PATH = process.env.SEED_DATA_PATH || "/seed-data";
const dbName = "time-capsule";
const db = db.getSiblingDB(dbName);

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

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
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
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function resetCollections() {
  COLLECTION_ORDER.forEach((name) => db.getCollection(name).deleteMany({}));
}

function importCollection(name) {
  const path = `${SEED_PATH}/${name}.csv`;
  const rows = readCsv(path);

  if (!rows.length) {
    print(`⚠️ ${name}: no rows in ${path}`);
    return;
  }

  const docs = rows
    .filter((r) => r.doc && r.doc.trim().length > 0)
    .map((r) => EJSON.parse(r.doc));

  if (!docs.length) {
    print(`⚠️ ${name}: no valid doc payloads in ${path}`);
    return;
  }

  db.getCollection(name).insertMany(docs, {
    ordered: true,
    bypassDocumentValidation: true
  });

  print(`✅ ${name}: ${docs.length} docs imported`);
}

function printSummary() {
  print("\n=== Demo dataset seeded from CSV ===");
  COLLECTION_ORDER.forEach((c) => print(`${c}: ${db.getCollection(c).countDocuments()}`));
  print("\nAdmin login (dev bootstrap): admin@timecapsule.local / DemoPass123!");
}

print("🚀 Importing realistic demo dataset from /data/*.csv ...");
resetCollections();
COLLECTION_ORDER.forEach(importCollection);
printSummary();
