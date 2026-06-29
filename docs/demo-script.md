# Demo Script

## Setup before the meeting

- Open the live URL if deployed.
- Keep local backup running at `http://localhost:3002`.
- Keep a short screen recording or screenshots available in case Wi-Fi, Render, or Gemini is slow.
- Confirm the demo disclaimer is visible or ready to state aloud.

## Opening disclaimer

"This is a student-built prototype, not an official ZSR service. It uses Gemini through a server-side API, local ZSR-style resource configuration, public link-outs, and best-effort catalog examples. It does not authenticate into ZSR databases or confirm full-text access."

## Demo flow

### 1. Standard scholarly topic

Prompt:

`The impact of social media on adolescent mental health`

Point out:

- The tool treats this as a library research workflow, not just chatbot text.
- It suggests discipline-appropriate databases such as PsycINFO, Communication & Mass Media Complete, PubMed/MEDLINE, and SocINDEX.
- It generates search terms and search strings.
- It links outward to ZSR/Scholar paths rather than pretending to download paywalled material.

### 2. Bad Primo search recovery

Prompt:

`I searched Primo and got nothing for Rolex watches`

Point out:

- The system detects that a brand-only query may be the wrong level of specificity.
- It broadens to luxury goods, consumer behavior, retail, brand positioning, and market research.
- It recommends business/market resources rather than forcing a scholarly article path.

### 3. Data/statistics prompt

Prompt:

`I need statistics on college student mental health`

Point out:

- The system changes from article-only thinking to data/statistics routes.
- It suggests dataset/statistics-oriented paths and reminds students to evaluate methodology.

### 4. Citation help

Prompt:

`I need a citation for a website in APA`

Point out:

- The system does not show a full source plan when the need is citation help.
- It links to known ZSR citation guidance and marks style-specific URLs as pending librarian review when not confirmed.

### 5. Full-text workflow

Prompt:

`I need full text for this DOI 10.1001/jama.2004.1635`

Point out:

- The system detects DOI/PMID-style input.
- It explains LibKey Nomad and Wake Forest selection.
- It does not claim to verify access without a real LibKey/Third Iron integration.

## Close

"The value I am testing is the workflow layer: interpreting the student's research need, recovering from weak searches, and routing to better ZSR paths. I would like feedback on what official metadata or APIs would be needed for this to become more accurate and maintainable."
