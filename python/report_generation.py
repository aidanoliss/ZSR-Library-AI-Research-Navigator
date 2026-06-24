"""Markdown report helpers for future Python-based scheduled jobs."""


def render_top_companies(scored_companies, limit=10):
    lines = []
    for index, item in enumerate(scored_companies[:limit], start=1):
        lines.append(
            f"{index}. {item['company_name']} ({item['domain']}) - {item['overall_score']}/100"
        )
    return "\n".join(lines)
