import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, isTransient, withRetry } from "../src/core/retry.ts";

const noSleep = async () => {};

test("retries transient errors and then succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new HttpError(503, "overloaded");
      return "ok";
    },
    { retries: 3, sleep: noSleep },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("does not retry permanent errors", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new HttpError(401, "bad key"); }, { retries: 3, sleep: noSleep }),
    /bad key/,
  );
  assert.equal(calls, 1);
});

test("gives up after the retry budget", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new HttpError(429, "rate limited"); }, { retries: 2, sleep: noSleep }),
    /rate limited/,
  );
  assert.equal(calls, 3);
});

test("exponential backoff with jitter, honouring Retry-After", async () => {
  const delays: number[] = [];
  let calls = 0;
  await withRetry(
    async () => {
      calls++;
      if (calls === 1) throw new HttpError(500, "x");
      if (calls === 2) throw new HttpError(500, "x");
      if (calls === 3) throw new HttpError(429, "x", 5);
      return 1;
    },
    { retries: 3, baseDelayMs: 100, sleep: async (ms) => { delays.push(ms); }, random: () => 1 },
  );
  assert.deepEqual(delays, [100, 200, 5000]);
});

test("classifies network failures and timeouts as transient", () => {
  assert.equal(isTransient(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } })), true);
  assert.equal(isTransient(Object.assign(new Error("timed out"), { name: "TimeoutError" })), true);
  assert.equal(isTransient(new HttpError(400, "bad request")), false);
  assert.equal(isTransient(new Error("something else")), false);
});
