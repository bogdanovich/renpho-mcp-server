import assert from "node:assert/strict";
import test from "node:test";
import { toNutritionMeasurement } from "../src/sync-nutritiondb.js";

test("maps a Renpho measurement to the idempotent nutrition schema", () => {
  const mapped = toNutritionMeasurement({
    id: "renpho-42",
    time_stamp: 1788652740,
    weight: 67.1,
    bmi: 20.7,
    bodyfat: 18.7,
    muscle: 45.9,
    skeletal_muscle: 50.9,
    mac: "AA:BB",
  });

  assert.equal(mapped.source_system, "renpho");
  assert.equal(mapped.source_measurement_id, "renpho-42");
  assert.equal(mapped.weight_kg, 67.1);
  assert.equal(mapped.body_fat_pct, 18.7);
  assert.equal(mapped.muscle_mass_kg, 45.9);
  assert.equal(mapped.skeletal_muscle_pct, 50.9);
  assert.equal(mapped.source_device_mac, "AA:BB");
  assert.equal(mapped.source_schema_version, 1);
  assert.match(mapped.measured_at, /^2026-/);
  assert.equal(JSON.parse(mapped.source_payload_json).id, "renpho-42");
});
