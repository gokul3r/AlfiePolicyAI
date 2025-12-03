def get_top_3_quotes(data):
    # Extract list of quotes
    quotes = data.get("quotes_with_insights", [])

    # Sort by alfie_touch_score (descending)
    quotes_sorted = sorted(
        quotes,
        key=lambda q: q.get("alfie_touch_score", 0),
        reverse=True
    )

    # Pick top 3
    top_3 = quotes_sorted[:3]

    # Build output structure
    output = {"top_3_quotes": []}

    for q in top_3:
        entry = {
            "insurer_name": q.get("insurer_name"),
            "alfie_touch_score": q.get("alfie_touch_score"),
            "trustpilot_rating": q.get("trust_pilot_context", {}).get("rating"),
            "alfie_message": q.get("alfie_message"),
            "features": {
                "features_matched": q.get("features_matching_requirements", {}).get("matched_required", []),
                "features_missing": q.get("features_matching_requirements", {}).get("missing_required", []),
                "available_features": q.get("available_features", [])
            }
        }
        output["top_3_quotes"].append(entry)

    return output
