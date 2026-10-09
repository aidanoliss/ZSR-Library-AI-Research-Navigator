import { test } from "node:test";
import assert from "node:assert/strict";
import { loggingStatus } from "../server/log.js";

test("query logging is opt-in by default", () => {
  const status = loggingStatus();
  assert.equal(status.queryLoggingEnabled, false);
  assert.equal(status.queryLoggingDefault, "off");
});

import { mkdtemp, stat, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPilotStorage } from "../server/pilotStorage.js";
const exec = promisify(execFile);

test("configured pilot storage probes permissions without claiming verified durability", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zsr-pilot-"));
  try {
    const storage = createPilotStorage({ directory });
    const status = await storage.probe();
    assert.equal(status.writable, true);
    assert.equal(status.durability, "external_mount_verification_required");
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.throws(() => createPilotStorage({ directory: "relative" }), /absolute/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("pilot logging uses configured directory, private permissions and minimal events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zsr-pilot-"));
  try {
    await exec(process.execPath, ["--input-type=module", "-e", `
      const {logQuery, logFeedback, logHandoff} = await import('./server/log.js');
      await logQuery({topic:'private student query', matchedIds:['resource-1']});
      await logFeedback({rating:'up', topic:'private student query', note:'private note'});
      await logHandoff({topic:'private student query', contact:'private@example.edu', liveResults:[{title:'Private research title'}]});
    `], { env: { ...process.env, NODE_ENV: "test", PILOT_DATA_DIR: directory, LOG_QUERIES: "on", LOG_QUERY_TEXT: "off", LOG_FEEDBACK: "on", FEEDBACK_STORE_TEXT: "off", FEEDBACK_STORE_TOPIC: "off", LOG_HANDOFFS: "on", HANDOFF_STORE_DETAIL: "off" } });
    for (const file of ["queries.jsonl", "feedback.jsonl", "handoffs.jsonl"]) {
      const raw = await readFile(join(directory, file), "utf8");
      assert.equal(/private/i.test(raw), false);
      assert.equal((await stat(join(directory, file))).mode & 0o777, 0o600);
    }
    // A second process sees persisted records from the first one.
    const { stdout } = await exec(process.execPath, ["--input-type=module", "-e", `const {readFeedback} = await import('./server/log.js'); console.log((await readFeedback()).length);`], { env: { ...process.env, NODE_ENV: "test", PILOT_DATA_DIR: directory } });
    assert.equal(stdout.trim(), "1");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("storage failure is visible in probe and read failures are not empty successful logs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zsr-pilot-"));
  try {
    const file = join(directory, "not-a-directory");
    await writeFile(file, "fixture");
    const status = await createPilotStorage({ directory: file }).probe();
    assert.equal(status.writable, false);
    assert.ok(status.lastErrorCode);
    const { stdout } = await exec(process.execPath, ["--input-type=module", "-e", `
      const {readFeedback, loggingStatus} = await import('./server/log.js');
      try { await readFeedback(); process.exitCode = 2; }
      catch { console.log(loggingStatus().storage.writable); }
    `], { env: { ...process.env, NODE_ENV: "test", PILOT_DATA_DIR: file } });
    assert.equal(stdout.trim(), "false");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("retention removes expired and corrupt records without retaining private text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zsr-pilot-"));
  try {
    await writeFile(join(directory, "feedback.jsonl"), `${JSON.stringify({ ts: "2000-01-01", note: "expired sensitive text" })}\nnot-json\n${JSON.stringify({ ts: new Date().toISOString(), rating: "up" })}\n`);
    await exec(process.execPath, ["--input-type=module", "-e", `const {logFeedback} = await import('./server/log.js'); await logFeedback({rating:'down'});`], { env: { ...process.env, NODE_ENV: "test", PILOT_DATA_DIR: directory, LOG_FEEDBACK: "on" } });
    const records = (await readFile(join(directory, "feedback.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(records.length, 2);
    assert.equal(records.some((record) => record.note), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
