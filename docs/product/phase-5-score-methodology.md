# Phase 5 Score Methodology

Scoring version `phase-5-v1` is deterministic and persisted with every category score. Scores
start at 100 and subtract one penalty per observed finding: informational 0, low 2, medium 6,
high 14, and critical 28. Scores are clamped to the inclusive range 0–100.

SEO includes SEO and content findings. Accessibility and performance include their matching
categories. Best practices includes technical, broken-link, structured-data, mobile, and security
findings. Overall applies the same formula to every finding. The report displays each category's
finding count and penalty explanation so a score is never a decorative or invented metric.

Comparison runs only against the previous audit linked to the same website. It compares stable
finding fingerprints and the same scoring version; the first audit explicitly has no predecessor.
