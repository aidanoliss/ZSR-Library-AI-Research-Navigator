import test from "node:test";
import assert from "node:assert/strict";
import { allowStorageRetry, readStoredJSON, readStoredText, removeStoredValue, writeStoredText } from "../src/browserStorage.js";

test("unreadable stored research is not overwritten by an empty initial state", () => {
  const records = new Map([["sessions", "{damaged"]]);
  const storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value) };
  assert.deepEqual(readStoredJSON("sessions", [], storage), []);
  assert.equal(writeStoredText("sessions", "[]", storage), false);
  assert.equal(records.get("sessions"), "{damaged");
  allowStorageRetry();
  assert.equal(writeStoredText("sessions", '[{"id":"recovered"}]', storage), true);
});

test("blocked or full browser storage returns a recoverable failure", () => {
  const storage = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
  assert.equal(readStoredText("draft", "", storage), "");
  assert.equal(writeStoredText("full", "work", storage), false);
  assert.equal(removeStoredValue("draft", storage), false);
  allowStorageRetry();
});

test("valid JSON with a damaged session shape is also protected from overwrite", () => {
  const records = new Map([["shape", '{"unexpected":true}']]);
  const storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value) };
  assert.deepEqual(readStoredJSON("shape", [], storage, Array.isArray), []);
  assert.equal(writeStoredText("shape", "[]", storage), false);
  assert.equal(records.get("shape"), '{"unexpected":true}');
  allowStorageRetry();
});
