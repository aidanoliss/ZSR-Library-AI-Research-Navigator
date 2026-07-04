import { test } from "node:test";
import assert from "node:assert/strict";
import { loggingStatus } from "../server/log.js";

test("query logging is opt-in by default", () => {
  const status = loggingStatus();
  assert.equal(status.queryLoggingEnabled, false);
  assert.equal(status.queryLoggingDefault, "off");
});
