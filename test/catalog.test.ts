import { test } from "node:test";
import assert from "node:assert/strict";
import { PartCatalog } from "../src/core/catalog.ts";

const catalog = PartCatalog.load();

test("different names for the same part resolve to one key", () => {
  for (const name of ["SG90", "sg90 servo", "9g micro servo", "Micro Servo", "servos"]) {
    assert.equal(catalog.resolve(name), "servo-sg90", name);
  }
});

test("model numbers beat generic words", () => {
  assert.equal(catalog.resolve("MG996R servo"), "servo-mg996r");
  assert.equal(catalog.resolve("DHT22 temperature humidity sensor"), "dht22");
  assert.equal(catalog.resolve("Raspberry Pi Pico"), "pi-pico");
  assert.equal(catalog.resolve("Raspberry Pi 4"), "raspberry-pi");
  assert.equal(catalog.resolve("18650 battery holder"), "battery-holder");
});

test("head noun decides between equally specific aliases", () => {
  assert.equal(catalog.resolve("DC motor driver"), "motor-driver");
  assert.equal(catalog.resolve("DC motor"), "dc-gear-motor");
  assert.equal(catalog.resolve("WS2812B LED strip"), "led-strip");
  assert.equal(catalog.resolve("RGB LED"), "rgb-led");
  assert.equal(catalog.resolve("5mm LEDs"), "led");
});

test("unknown parts fall back to normalized text and still match each other", () => {
  assert.equal(catalog.resolve("Popsicle sticks"), catalog.resolve("popsicle stick"));
  assert.equal(catalog.resolve("flower pot"), "flower pot");
});
