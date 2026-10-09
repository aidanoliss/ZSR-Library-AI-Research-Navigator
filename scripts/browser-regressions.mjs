/** Run with the documented Codex browser Tab API, or a compatible Playwright page.
 * Only UI interactions and read-only DOM checks; never modifies browser storage directly.
 * Start scripts/browser-fixture-server.mjs on a fresh local origin first.
 */
import assert from "node:assert/strict";

export const TOPIC = "Find 3 peer-reviewed articles published since 2022 about urban tree canopy and summer temperatures.";

export async function runCoreBrowserRegressions(tab) {
  const ui = tab.playwright;
  const results = [];
  async function passed(name, check) { await check(); results.push({ name, status: "passed" }); }
  await ui.getByRole("button", { name: "New topic", exact: true }).click();
  await passed("Topic entry and collapsed preferences", async () => {
    assert.equal(await ui.getByRole("button", { name: "Send topic", exact: true }).isEnabled(), false);
    assert.equal(await ui.locator(".search-options").getAttribute("open"), null);
    await ui.getByRole("textbox", { name: "Research topic", exact: true }).fill(TOPIC);
    await ui.getByRole("button", { name: "Send topic", exact: true }).click();
    await ui.getByText("Your search brief", { exact: true }).waitFor({ state: "visible" });
    assert.match(await ui.domSnapshot(), /tree canopy/);
  });
  await passed("Concepts and publication requirements stay separate", async () => {
    const brief = await ui.getByRole("region", { name: "Your search brief", exact: true }).innerText();
    assert.match(brief, /urban \+ tree canopy \+ summer temperatures/);
    assert.match(brief, /Published from 2022/);
    assert.match(brief, /Target: 3 sources/);
    const query = await ui.locator(".agent-card-summary code").first().innerText();
    assert.match(query, /tree canopy/);
    assert.doesNotMatch(query, /2022|peer.reviewed/);
  });
  await passed("Save three records with provenance", async () => {
    await ui.getByText("Show 1 more library leads", { exact: true }).click();
    const saves = await ui.getByRole("button", { name: /^Save \[SYNTHETIC TEST FIXTURE\].*to research trail$/ }).all();
    assert.equal(saves.length, 3);
    for (let index = 0; index < saves.length; index += 1) await ui.getByRole("button", { name: /^Save \[SYNTHETIC TEST FIXTURE\].*to research trail$/ }).first().click();
    await ui.getByRole("button", { name: "My sources 3", exact: true }).click();
    const snapshot = await ui.domSnapshot();
    assert.match(snapshot, /SYNTHETIC library fixture/);
    assert.match(snapshot, /My sources and saved searches/);
  });
  await passed("Requirement progress separates supported, unknown, and mismatched sources", async () => {
    const statuses = await ui.getByRole("combobox", { name: "Status", exact: true }).all();
    assert.equal(statuses.length, 3);
    for (const status of statuses) await status.selectOption("use");
    const progress = await ui.getByRole("region", { name: "Requirements progress", exact: true }).innerText();
    assert.match(progress, /3 of 3/);
    assert.match(progress, /1\s+supported by metadata/);
    assert.match(progress, /1\s+need verification/);
    assert.match(progress, /1\s+do not meet checks/);
  });
  await passed("Compare two sources using real table controls", async () => {
    const choices = await ui.getByRole("checkbox", { name: /^Compare / }).all();
    await choices[0].check(); await choices[1].check();
    await ui.getByRole("heading", { name: "Compare 2 saved sources", exact: true }).waitFor({ state: "visible" });
    const table = await ui.getByRole("table").innerText();
    assert.match(table, /Metadata provider/); assert.match(table, /Peer review/); assert.match(table, /Requirements/);
  });
  await passed("Arrow, Home, and End activate and focus workspace tabs", async () => {
    await ui.getByRole("tab", { name: "My sources", exact: true }).press("ArrowRight");
    assert.equal(await ui.getByRole("tab", { name: "Searches", exact: true }).getAttribute("aria-selected"), "true");
    await ui.getByRole("tab", { name: "Searches", exact: true }).press("End");
    assert.equal(await ui.getByRole("tab", { name: "Review", exact: true }).getAttribute("aria-selected"), "true");
    await ui.getByRole("tab", { name: "Review", exact: true }).press("Home");
    assert.equal(await ui.getByRole("tab", { name: "Requirements", exact: true }).getAttribute("aria-selected"), "true");
    assert.equal(await ui.evaluate(() => document.activeElement?.textContent?.trim()), "Requirements");
  });
  await passed("Partial assignment edits retain the request's other requirements", async () => {
    await ui.getByRole("textbox", { name: "Source target", exact: true }).fill("4");
    const progress = await ui.getByRole("region", { name: "Requirements progress", exact: true }).innerText();
    assert.match(progress, /3 of 4/); assert.match(progress, /Publication date/); assert.match(progress, /Peer review/);
  });
  await passed("Escape closes the workspace and restores focus", async () => {
    await ui.getByRole("tab", { name: "Requirements", exact: true }).press("Escape");
    assert.equal(await ui.getByRole("dialog", { name: "Research workspace", exact: true }).count(), 0);
    assert.match(await ui.evaluate(() => document.activeElement?.textContent?.trim()), /My sources/);
  });
  await passed("Saved source notes, assignment, and unsent draft survive reload", async () => {
    await ui.getByRole("button", { name: "My sources 3", exact: true }).click();
    await ui.getByRole("textbox", { name: "Notes", exact: true }).first().fill("Browser regression note: verify this source.");
    await ui.getByRole("button", { name: "Close research workspace", exact: true }).click();
    await ui.getByRole("textbox", { name: "Ask a follow-up or refine your topic", exact: true }).fill("Unsent browser regression draft");
    await tab.reload();
    await ui.domSnapshot();
    await ui.getByRole("button", { name: "My sources 3", exact: true }).waitFor({ state: "visible" });
    assert.equal(await ui.evaluate(() => document.querySelector("#followup-input")?.value), "Unsent browser regression draft");
    await ui.getByRole("button", { name: "My sources 3", exact: true }).click();
    assert.equal(await ui.evaluate(() => document.querySelector(".workspace-trail-list textarea")?.value), "Browser regression note: verify this source.");
    assert.match(await ui.getByRole("region", { name: "Requirements progress", exact: true }).innerText(), /3 of 4/);
  });
  return results;
}

export async function runCorrectionBrowserRegressions(tab) {
  const ui = tab.playwright;
  await ui.getByRole("button", { name: "Close research workspace", exact: true }).click();
  await ui.getByText("Edit or refine this search", { exact: true }).last().click();
  await ui.getByRole("spinbutton", { name: "Published from", exact: true }).last().fill("2024");
  await ui.getByRole("button", { name: "Rerun with corrections", exact: true }).last().click();
  await ui.getByText("Updated search result", { exact: true }).waitFor({ state: "visible" });
  await ui.getByRole("region", { name: "Your search brief", exact: true }).last().waitFor({ state: "visible" });
  assert.match(await ui.domSnapshot(), /Library lookup: 3 leads returned/);
  assert.equal(await ui.locator(".previous-search-result").first().getAttribute("open"), null);
  assert.equal(await ui.evaluate(() => {
    const sections = Array.from(document.querySelectorAll(".updated-search-result .bubble.assistant > *")).map((element) => element.className);
    return sections.indexOf("search-query-card") >= 0 && sections.indexOf("search-query-card") < sections.indexOf("research-agent");
  }), true);
  const latest = await ui.getByRole("region", { name: "Your search brief", exact: true }).last().innerText();
  assert.match(latest, /Published from 2024/); assert.match(latest, /tree canopy/);
  const query = await ui.locator(".agent-card-summary code").filter({ visible: true }).last().innerText();
  assert.match(query, /tree canopy/); assert.doesNotMatch(query, /student.corrected|rebuild|2024/);
  await ui.getByText("Edit or refine this search", { exact: true }).last().click();
  await ui.getByRole("button", { name: "Too broad", exact: true }).click();
  assert.equal(await ui.evaluate(() => document.activeElement?.getAttribute("placeholder")), "Add a concept");
  await ui.getByRole("textbox", { name: "Add a required concept", exact: true }).last().fill("rural neighborhoods");
  await ui.getByRole("button", { name: "Rerun with corrections", exact: true }).last().click();
  await ui.getByRole("region", { name: "Your search brief", exact: true }).last().waitFor({ state: "visible" });
  const revisedBrief = await ui.getByRole("region", { name: "Your search brief", exact: true }).last().innerText();
  const revisedQuery = await ui.locator(".updated-search-result .search-query-card code").filter({ visible: true }).last().innerText();
  assert.match(revisedBrief, /rural neighborhoods/);
  assert.match(revisedQuery, /rural neighborhoods/);
  return [
    { name: "Explicit date correction preserves topic in returned searches", status: "passed" },
    { name: "Refinement guides a concrete edit without claiming an unchanged rerun", status: "passed" },
    { name: "A typed concept is applied by rerun without a separate Add click", status: "passed" },
  ];
}

export async function runFailureBrowserRegressions(tab) {
  const ui = tab.playwright;
  const results = [];
  for (const [tag, message] of [["rate-limit", /temporarily limiting requests/], ["timeout", /took too long to respond/], ["empty", /No matching sources yet/]]) {
    await ui.getByRole("button", { name: "New topic", exact: true }).click();
    await ui.getByRole("textbox", { name: "Research topic", exact: true }).fill(`urban tree canopy [fixture:${tag}]`);
    await ui.getByRole("button", { name: "Send topic", exact: true }).click();
    await ui.getByText("Your search brief", { exact: true }).waitFor({ state: "visible" });
    assert.match(await ui.domSnapshot(), message);
    results.push({ name: `Provider ${tag} has a distinct visible outcome`, status: "passed" });
  }
  await ui.getByRole("button", { name: "New topic", exact: true }).click();
  await ui.getByRole("textbox", { name: "Research topic", exact: true }).fill("medieval trade networks [fixture:delay]");
  await ui.getByRole("button", { name: "Send topic", exact: true }).click();
  assert.equal(await ui.getByRole("region", { name: "Research conversation", exact: true }).getAttribute("aria-busy"), "true");
  await ui.getByRole("button", { name: "New topic", exact: true }).click();
  await ui.getByRole("textbox", { name: "Research topic", exact: true }).fill("protein folding");
  await ui.getByRole("button", { name: "Send topic", exact: true }).click();
  await ui.getByText("Your search brief", { exact: true }).waitFor({ state: "visible" });
  assert.match(await ui.getByRole("region", { name: "Your search brief", exact: true }).innerText(), /protein/);
  assert.doesNotMatch(await ui.getByRole("region", { name: "Research conversation", exact: true }).innerText(), /medieval/);
  results.push({ name: "Starting a new topic cancels the pending request and keeps the new response", status: "passed" });
  return results;
}

export async function runPortableBrowserRegressions(tab, { validFile, invalidFile, exportAlreadyVerified = false }) {
  const ui = tab.playwright;
  const results = [];
  await ui.getByRole("tab", { name: "Review", exact: true }).click();
  if (!exportAlreadyVerified) {
    await ui.getByRole("button", { name: "Export workspace JSON", exact: true }).click();
    assert.match(await ui.domSnapshot(), /Workspace JSON download started/);
    results.push({ name: "Workspace export reports the browser download started (verify the downloaded file separately)", status: "passed" });
  }
  await ui.getByRole("button", { name: "Close research workspace", exact: true }).click();
  await ui.getByRole("button", { name: "New topic", exact: true }).click();
  await ui.getByRole("button", { name: "My sources 0", exact: true }).click();
  await ui.getByRole("tab", { name: "Review", exact: true }).click();
  async function importFile(file) {
    const pending = ui.waitForEvent("filechooser", { timeoutMs: 10000 });
    await ui.getByRole("button", { name: "Import workspace JSON", exact: true }).click();
    const chooser = await pending;
    await chooser.setFiles([file]);
  }
  await importFile(validFile);
  await ui.getByText(/Imported 3 saved items and 0 searches/).waitFor({ state: "visible" });
  await ui.getByRole("tab", { name: "Requirements", exact: true }).click();
  assert.equal(await ui.evaluate(() => document.querySelector(".workspace-toggle input")?.checked), false);
  await ui.getByRole("tab", { name: "My sources", exact: true }).click();
  assert.match(await ui.getByRole("region", { name: "Requirements progress", exact: true }).innerText(), /0\s+supported by metadata/);
  assert.match(await ui.domSnapshot(), /Imported record/);
  results.push({ name: "Import restores records while leaving metadata unverified and AI sharing off", status: "passed" });
  await ui.getByRole("tab", { name: "Review", exact: true }).click();
  await importFile(validFile);
  await ui.getByText(/Imported 0 saved items and 0 searches. 3 duplicates skipped/).waitFor({ state: "visible" });
  results.push({ name: "Import merges without duplicating or overwriting saved work", status: "passed" });
  await importFile(invalidFile);
  await ui.getByText(/This file is not valid JSON/).waitFor({ state: "visible" });
  assert.equal(await ui.getByRole("button", { name: "My sources 3", exact: true }).isVisible(), true);
  results.push({ name: "Invalid import displays an error and retains existing sources", status: "passed" });
  await ui.getByRole("button", { name: "Close research workspace", exact: true }).click();
  return results;
}
