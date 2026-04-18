import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
if key:
    genai.configure(api_key=key)

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
        print("Gemini API Error (detect):", e)
        potential_sensitive = ["gender", "race", "age", "ethnicity", "sex"]
        return [col for col in columns if col.lower() in potential_sensitive]

def generate_bias_report(metrics_data: dict) -> str:
    """Uses Gemini to generate a plain-English bias fairness report based on metrics."""
    if not key:
        return "Internal Error: Gemini API Key missing or not configured. Cannot generate AI Report."
    
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
        print("Gemini API Error (report):", e)
        return f"Error generating report: {str(e)}"
