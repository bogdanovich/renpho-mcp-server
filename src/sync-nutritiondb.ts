#!/usr/bin/env node
import "dotenv/config";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "./config.js";
import { RenphoApiService } from "./services/renpho-api.js";
import { RenphoMeasurement } from "./types/renpho.js";

export function toNutritionMeasurement(measurement: RenphoMeasurement) {
  return {
    source_system: "renpho",
    source_measurement_id: measurement.id,
    source_type: "renpho_sync",
    measured_at: new Date(measurement.time_stamp * 1000).toISOString(),
    weight_kg: measurement.weight,
    bmi: measurement.bmi,
    body_fat_pct: measurement.bodyfat,
    water_pct: measurement.water,
    muscle_mass_kg: measurement.muscle,
    bone_mass_kg: measurement.bone,
    bmr_kcal: measurement.bmr,
    visceral_fat_level: measurement.visceral_fat,
    protein_pct: measurement.protein,
    metabolic_age_years: measurement.metabolic_age ?? measurement.body_age,
    subcutaneous_fat_pct: measurement.subcutaneous_fat,
    skeletal_muscle_pct: measurement.skeletal_muscle,
    heart_rate_bpm: measurement.heart_rate,
    cardiac_index: measurement.cardiac_index,
    resistance_ohm: measurement.resistance,
    fat_free_mass_kg: measurement.fat_free_weight,
    source_device_mac: measurement.mac,
    source_device_model: measurement.internal_model,
    source_device_name: measurement.scale_name,
    source_method: measurement.method,
    source_schema_version: 1,
    source_payload_json: JSON.stringify(measurement),
  };
}

async function main() {
  const config = loadConfig();
  const dbPath = process.env.NUTRITION_DB_PATH;
  if (!dbPath) {
    throw new Error("NUTRITION_DB_PATH is required");
  }
  const command = process.env.NUTRITIONDB_MCP_COMMAND ?? "nutritiondb-mcp";
  const days = Number(process.env.RENPHO_SYNC_DAYS ?? "30");
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error("RENPHO_SYNC_DAYS must be an integer from 1 to 3650");
  }

  const api = new RenphoApiService(config.email, config.password);
  const lastAt = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  const measurements = await api.getMeasurements(undefined, lastAt, 500);
  if (measurements.length === 0) {
    console.log(JSON.stringify({ ok: true, processed: 0, inserted: 0 }));
    return;
  }

  const transport = new StdioClientTransport({
    command,
    args: ["--db-path", dbPath],
    stderr: "inherit",
  });
  const client = new Client({
    name: "renpho-nutrition-sync",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "upsert_body_measurements",
      arguments: {
        measurements: measurements.map(toNutritionMeasurement),
      },
    });
    if (result.isError) {
      throw new Error(
        `nutritiondb import failed: ${JSON.stringify(result.content)}`,
      );
    }
    console.log(JSON.stringify(result.structuredContent ?? result.content));
  } finally {
    await client.close();
  }
}

const invokedDirectly = process.argv[1]?.endsWith("sync-nutritiondb.js");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
