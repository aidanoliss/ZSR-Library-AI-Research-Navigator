"""Simple domain clustering utilities for future source ingestion."""

DOMAIN_KEYWORDS = {
    "AI infrastructure": ["gpu", "inference", "model", "mlops", "compute"],
    "AI agents and workflow automation": ["agent", "workflow", "automation", "approval"],
    "Healthcare operations": ["claim", "payer", "clinic", "patient", "healthcare"],
    "Legal technology": ["contract", "clause", "legal", "attorney"],
    "Climate and energy": ["grid", "energy", "climate", "interconnection"],
    "Robotics": ["robot", "warehouse", "autonomous", "hardware"],
    "Developer tools": ["developer", "cli", "test", "repository", "ci"],
    "Cybersecurity": ["security", "prompt injection", "siem", "policy"],
}


def infer_domain(text):
    haystack = (text or "").lower()
    scores = {
        domain: sum(1 for keyword in keywords if keyword in haystack)
        for domain, keywords in DOMAIN_KEYWORDS.items()
    }
    best_domain, best_score = max(scores.items(), key=lambda item: item[1])
    return best_domain if best_score > 0 else "Unknown"
