import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
if key:
    genai.configure(api_key=key)

def _sanitize_provider_error(err: Exception) -> str:
    """
    Avoid leaking provider internals (keys, project IDs, container metadata)
    into logs/UI while still giving a useful status message.
    """
    raw = str(err).lower()
    if "consumer_suspended" in raw or "has been suspended" in raw:
        return "Gemini API access is currently suspended for this key/project."
    if "permission denied" in raw or "403" in raw:
        return "Gemini API permission denied. Verify key restrictions and project access."
    if "api key" in raw or "invalid" in raw or "unauth" in raw:
        return "Gemini API authentication failed. Check GEMINI_API_KEY."
    if "quota" in raw or "rate" in raw:
        return "Gemini API quota/rate limit reached. Please retry shortly."
    return "Gemini service is temporarily unavailable."

def get_ai_service_status() -> dict:
    """
    Returns a safe status object for frontend health checks.
    """
    if not key:
        return {
            "status": "degraded",
            "provider": "gemini-1.5-flash",
            "reason": "GEMINI_API_KEY is not configured."
        }
    try:
        # Lightweight probe without sending user data.
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content("Reply with OK")
        text = (response.text or "").strip().lower()
        ok = "ok" in text or len(text) > 0
        return {
            "status": "ok" if ok else "degraded",
            "provider": "gemini-1.5-flash",
            "reason": "" if ok else "Gemini probe returned no content."
        }
    except Exception as e:
        return {
            "status": "degraded",
            "provider": "gemini-1.5-flash",
            "reason": _sanitize_provider_error(e)
        }

def detect_sensitive_attributes(columns: list, sample_data: list) -> list:
    """Uses Gemini to figure out which columns might be sensitive (race, gender, age, etc)."""
    if not key:
        # Fallback to simple matching if key is missing
        potential_sensitive = ["gender", "race", "age", "ethnicity", "sex"]
        return [col for col in columns if col.lower() in potential_sensitive]
    
    prompt = f"""
    You are an AI tasked with analyzing metadata structure.
    Given this list of columns from a CSV: {columns}
    And a sample row of data: {sample_data}
    
    Identify ANY columns that represent protected or 'sensitive' demographic attributes.
    This includes elements like gender, race, ethnicity, age, marital status, religion, disability, etc.
    
    Return ONLY a valid JSON array of strings containing the exact column names. Do not include markdown formatting or backticks.
    Example: ["gender", "race"]
    """
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(text)
        return parsed if isinstance(parsed, list) else []
    except Exception as e:
        print("Gemini API Error (detect):", _sanitize_provider_error(e))
        potential_sensitive = ["gender", "race", "age", "ethnicity", "sex"]
        return [col for col in columns if col.lower() in potential_sensitive]

def generate_bias_report(metrics_data: dict) -> str:
    """Uses Gemini to generate a plain-English bias fairness report based on metrics."""
    def _fallback_report(metrics: dict, reason: str = "") -> str:
        attributes = list(metrics.keys())
        lines = [
            "# Bias Report (Local Fallback)",
            "",
            "## Executive Summary",
            "Gemini AI report generation is currently unavailable, so this report was generated locally from computed fairness metrics.",
            "",
            "## Detected Biases",
        ]
        if not attributes:
            lines.extend([
                "- No sensitive attributes were available for analysis.",
                "",
                "## Actionable Recommendations",
                "- Verify outcome and sensitive columns and rerun the audit."
            ])
            return "\n".join(lines)

        flagged = 0
        for attr, payload in metrics.items():
            di = payload.get("disparate_impact", {})
            if not di:
                lines.append(f"- **{attr}**: No disparate impact data available.")
                continue
            min_group = min(di, key=di.get)
            min_ratio = float(di[min_group])
            if min_ratio < 0.6:
                severity = "Critical"
            elif min_ratio < 0.8:
                severity = "High"
            elif min_ratio < 0.9:
                severity = "Medium"
            else:
                severity = "Low"
            if min_ratio < 0.8:
                flagged += 1
            lines.append(
                f"- **{attr}**: {severity} concern. Lowest DI ratio is **{min_ratio:.3f}** for group **{min_group}**."
            )

        lines.extend([
            "",
            "## Affected Groups Explanation",
            "Groups with lower disparate impact ratios receive positive outcomes at lower rates compared with the best-performing reference group.",
            "",
            "## Actionable Recommendations",
            "- Review training data balance and representation for under-selected groups.",
            "- Add fairness constraints or post-processing threshold calibration.",
            "- Monitor fairness metrics across releases and set alert thresholds (e.g., DI < 0.8).",
            f"- Prioritize remediation for **{flagged}** attribute(s) currently below the 0.8 benchmark.",
        ])

        if reason:
            lines.extend(["", f"_AI service note: {reason}_"])
        return "\n".join(lines)

    if not key:
        return _fallback_report(metrics_data, "Gemini API key missing or not configured.")
    
    prompt = f"""
    You are an AI Bias Auditing Expert.
    I have run fairness metrics on a dataset. Here is the JSON output of the disparate impact and demographic parity ratios:
    {json.dumps(metrics_data, indent=2)}
    
    Write a clear, plain-English "Bias Report" addressed to a business stakeholder or HR manager.
    
    Ensure the report includes:
    1. Executive Summary
    2. Detected Biases (highlighting severity: Low/Medium/High/Critical). A Disparate Impact Ratio < 0.8 is generally considered High bias.
    3. Affected Groups Explanation
    4. Actionable Recommendations for Fixing these biases (e.g., Reweighting, Resampling, Threshold calibration)
    
    Format the response nicely in standard Markdown. Be professional, objective, and constructive.
    """
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        safe_reason = _sanitize_provider_error(e)
        print("Gemini API Error (report):", safe_reason)
        return _fallback_report(metrics_data, safe_reason)
