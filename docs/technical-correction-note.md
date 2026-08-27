# Technical Correction Note for Hannah

Suggested email:

**Subject:** Technical clarification on the research navigator prototype

Hi Hannah,

I want to correct and clarify a technical detail from our call before the prototype is circulated further.

The current prototype does not require a Wake Forest login, and it has no Duke login or institutional authentication. Gemini does not visit library URLs, search Primo, search subscription databases, retrieve licensed full text, or verify access. It receives the conversation and compact metadata for locally routed resources, then generates a short research orientation.

Resource selection and database-specific searches are constructed by deterministic server-side rules and checked against an allowlisted configuration. Separately, the server may request public bibliographic metadata from Wake Forest’s Primo discovery surface. For compatible article searches, it may use provider-labelled Crossref metadata when Primo returns too few records. An Open Library image request may occur for an ISBN cover. None of those metadata paths is a Gemini search, and none confirms holdings or full-text access.

The application is still an independent prototype. A Duke version would require Duke-approved resources, discovery parameters, privacy and security review, accessibility review, hosting, branding, and support ownership. I have kept the Duke integration template blank so I do not imply any of those approvals.

I also want to preserve the URL you have. I will make changes only through the existing service’s release path after staging checks, rather than creating a replacement hostname.

Thank you again for taking the time to look at it and share it with your team. I wanted the technical description to be exact before a deeper review.

Warmly,

Aidan
