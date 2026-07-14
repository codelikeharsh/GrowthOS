# Phase 5 Deterministic Rule Catalogue

Rules are deterministic, fingerprinted by rule and affected URL, and report only evidence derived
from the bounded secure crawl. Recommendations are templates, not AI-generated text.

| Category        | Current rule families                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEO/content     | Title and meta-description presence/length/duplicates, canonical presence/cross-host target, H1 presence/count/duplicate marker, thin and duplicate visible content, robots noindex/conflicts, Open Graph and Twitter basics |
| Links           | Unsupported/malformed links, bounded HTTP(S) internal/external status checks, redirects, excessive internal-link count, empty anchor evidence                                                                                |
| Accessibility   | `lang`, viewport, image alt, form labels, button names, headings, duplicate IDs, main landmark, iframe title                                                                                                                 |
| Performance     | HTML bytes, bounded response time, resource-reference count, response compression, image dimensions                                                                                                                          |
| Structured data | JSON-LD parse failures, missing/invalid context or type, unsupported shapes; scripts are never executed                                                                                                                      |
| Mobile          | Viewport and conservative fixed-width hints; no static check is represented as a browser measurement                                                                                                                         |
| Security        | CSP, HSTS on HTTPS, nosniff, frame/referrer protection, mixed-content references, unsafe target-blank links, insecure form actions                                                                                           |

This catalogue is intentionally conservative. It is not a full crawler, WCAG certification,
penetration test, Lighthouse run, or rich-result eligibility test. Advanced browser-only analysis
(including full hreflang reciprocity and resource transfer measurement) needs separately collected
evidence and is not inferred. The optional performance-provider boundary persists labelled compact
measurements only when a future reviewed provider is configured; it is disabled by default.
