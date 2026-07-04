# June 29 ZSR Research Navigator Follow-Up

## Draft Email

Subject: ZSR Research Navigator prototype - live demo link and review checklist

Hi Amanda, Thomas, and Kyle,

Thank you again for taking time to review the ZSR Research Navigator prototype. I tightened the demo deployment path and privacy defaults after our conversation so the shared version is clearly framed as a prototype and keeps student research-query logging off by default.

Live demo link: [add Render URL]

Before you open it, the main caveats are:

- This is not an official ZSR service unless ZSR/WFU reviews and approves it.
- Gemini calls run through the server; the API key is not exposed in the browser.
- Query logging is off for the shared demo, and handoff contact details are not retained.
- Catalog examples are best-effort public Primo metadata and should be treated as leads, not verified access or full-text availability.
- The app links students to ZSR resources; it does not authenticate into licensed databases or bypass paywalls.

Suggested live-demo checklist:

- Confirm the app loads at the Render URL and the prototype framing is visible.
- Try: "The impact of social media on adolescent mental health."
- Try: "I searched Primo and got nothing for Rolex watches."
- Try: "I need statistics on college student mental health."
- Try: "I need a citation for a website in APA."
- Try: "I need full text for this DOI 10.1001/jama.2004.1635."
- Open the pilot-status dashboard with `/?admin=1` and confirm query logging shows as off.
- Use the handoff icon once and confirm the email draft is useful without retaining contact details.
- Note any ZSR resource names, links, citation pages, or librarian-routing language that should be corrected before broader sharing.

The feedback I am most interested in is what official ZSR metadata, Primo/LibGuides/LibKey access, privacy language, and hosting/security model would be needed if this moved beyond a prototype.

Best,
Aidan

## Repo Handoff Notes

- Canonical deploy path: repository root.
- Render service type: Web Service.
- Build command: `npm ci && npm run build`.
- Start command: `npm start`.
- Required secret: `GEMINI_API_KEY`, set only in Render or local `.env`.
- Demo privacy defaults: `LOG_QUERIES=off`, `HANDOFF_STORE_CONTACT=off`.
- Render binding: `HOST=0.0.0.0`, `PORT=10000`.
