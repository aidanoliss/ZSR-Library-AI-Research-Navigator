import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildFixturePayload } from "./browser-fixture-server.mjs";
import { addResearchItem, createResearchWorkspace, workspaceToJson } from "../src/researchWorkspace.js";

const directory = resolve(process.argv[2] || "/tmp/zsr-browser-import-fixtures");
await mkdir(directory, { recursive: true });
const payload = buildFixturePayload({ mode: "scholarly", messages: [{ role: "user", content: "Find 3 peer-reviewed articles published since 2022 about urban tree canopy and summer temperatures." }] });
let workspace = createResearchWorkspace();
workspace.assignment = { ...workspace.assignment, sourceCount: "3", dateRange: "Since 2022", sourceTypes: "Peer-reviewed articles", enabled: true };
for (const source of payload.liveResults) workspace = addResearchItem(workspace, { kind: "catalog", title: source.title, url: source.url, sourceRecord: source, notes: "Synthetic imported note", status: "use" });
await writeFile(resolve(directory, "workspace.json"), workspaceToJson(workspace, "Synthetic browser import fixture"));
await writeFile(resolve(directory, "invalid.json"), "{broken JSON");
console.log(`Synthetic import files written to ${directory}`);
