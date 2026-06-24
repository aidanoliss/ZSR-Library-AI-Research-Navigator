"""Market context helpers for Venture Radar domain analysis."""


def summarize_market_context(domain_name, companies):
    if any(token in domain_name.lower() for token in ["healthcare", "legal", "fintech", "defense", "govtech"]):
        return "Trust, compliance, procurement, and verified workflow evidence are central to this domain."
    if any(token in domain_name.lower() for token in ["infrastructure", "developer", "cybersecurity"]):
        return "Technical proof, deployment evidence, and buyer urgency are central to this domain."
    if "consumer" in domain_name.lower():
        return "Retention, privacy, and distribution evidence are central to this domain."
    return "Workflow frequency, buyer clarity, and willingness to pay are central to this domain."
