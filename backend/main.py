from fastapi import FastAPI, UploadFile, File, Body
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder

from bias_engine import compute_bias_metrics, check_compliance, compute_intersectional_bias
from gemini_service import detect_sensitive_attributes, generate_bias_report, get_ai_service_status

app = FastAPI(title="FairLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to FairLens API"}

@app.get("/ai-health")
def ai_health():
    return get_ai_service_status()

@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        return {"error": "Only CSV files are supported"}
    
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        return {"error": f"Failed to parse CSV: {str(e)}"}
    
    # Analyze columns
    columns = list(df.columns)
    
    sample_row = df.head(1).to_dict(orient="records")[0] if not df.empty else {}
    try:
        detected_sensitive = detect_sensitive_attributes(columns, sample_row)
    except Exception:
        potential_sensitive = ["gender", "race", "age", "ethnicity", "sex"]
        detected_sensitive = [col for col in columns if col.lower() in potential_sensitive]
    
    potential_outcomes = ["hired", "approved", "diagnosis", "outcome", "status"]
    detected_outcome = next((col for col in columns if col.lower() in potential_outcomes), columns[-1])

    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": columns,
        "preview": df.head(5).to_dict(orient='records'),
        "detected_attributes": detected_sensitive,
        "suggested_outcome": detected_outcome
    }

@app.post("/analyze")
async def analyze_dataset(file: UploadFile = File(...), outcome_col: str = None, sensitive_cols: str = None):
    # 'sensitive_cols' is a comma-separated list of columns.
    if not file.filename.endswith('.csv'):
        return {"error": "Only CSV files are supported"}
    if not outcome_col or not sensitive_cols:
         return {"error": "Missing outcome or sensitive columns"}

    content = await file.read()
    df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    
    sensitive_list = [c.strip() for c in sensitive_cols.split(',')]
    
    results = compute_bias_metrics(df, outcome_col, sensitive_list)
    compliance_results = check_compliance(results)
    intersectional_results = compute_intersectional_bias(df, outcome_col, sensitive_list)
    
    return jsonable_encoder({"metrics": results, "compliance": compliance_results, "intersectional": intersectional_results})


@app.post("/report")
async def generate_report(metrics_data: dict = Body(...)):
    report = generate_bias_report(metrics_data)
    return {"report": report}


@app.post("/counterfactual")
async def counterfactual_analysis(file: UploadFile = File(...), outcome_col: str = None, sensitive_cols: str = None):
    if not file.filename.endswith('.csv'):
        return {"error": "Only CSV files are supported"}
    if not outcome_col or not sensitive_cols:
        return {"error": "Missing outcome or sensitive columns"}

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        return {"error": f"Failed to parse CSV: {str(e)}"}

    sensitive_list = [c.strip() for c in sensitive_cols.split(',') if c.strip()]
    missing_cols = [c for c in sensitive_list + [outcome_col] if c not in df.columns]
    if missing_cols:
        return {"error": f"Columns not found: {', '.join(missing_cols)}"}

    df_model = df.dropna().copy()
    if df_model.empty or len(df_model) < 3:
        return {"error": "Not enough clean rows to run counterfactual analysis"}

    X_raw = df_model.drop(columns=[outcome_col]).copy()
    y_raw = df_model[outcome_col].copy()

    feature_encoders = {}
    for col in X_raw.columns:
        encoder = LabelEncoder()
        X_raw[col] = encoder.fit_transform(X_raw[col].astype(str))
        feature_encoders[col] = encoder

    target_encoder = LabelEncoder()
    y_encoded = target_encoder.fit_transform(y_raw.astype(str))
    if len(target_encoder.classes_) < 2:
        return {"error": "Outcome column must contain at least two classes"}

    model = LogisticRegression(max_iter=1000)
    model.fit(X_raw, y_encoded)

    counterfactuals = []
    sampled = df_model.head(5)
    positive_class = target_encoder.classes_[1] if len(target_encoder.classes_) > 1 else target_encoder.classes_[0]

    for row_index, row in sampled.iterrows():
        for attr in sensitive_list:
            if attr not in X_raw.columns:
                continue

            unique_vals = list(df_model[attr].dropna().astype(str).unique())
            if len(unique_vals) < 2:
                continue

            original_value = str(row[attr])
            if original_value not in unique_vals:
                continue
            original_position = unique_vals.index(original_value)
            flipped_value = unique_vals[(original_position + 1) % len(unique_vals)]

            original_features = row.drop(labels=[outcome_col]).copy()
            original_encoded = {
                col: int(feature_encoders[col].transform([str(original_features[col])])[0]) for col in X_raw.columns
            }
            original_pred_encoded = int(model.predict(pd.DataFrame([original_encoded]))[0])
            original_prediction = str(target_encoder.inverse_transform([original_pred_encoded])[0])

            flipped_features = original_features.copy()
            flipped_features[attr] = flipped_value
            flipped_encoded = {
                col: int(feature_encoders[col].transform([str(flipped_features[col])])[0]) for col in X_raw.columns
            }
            new_pred_encoded = int(model.predict(pd.DataFrame([flipped_encoded]))[0])
            new_prediction = str(target_encoder.inverse_transform([new_pred_encoded])[0])

            counterfactuals.append({
                "row_index": int(row_index),
                "attribute": attr,
                "original_value": original_value,
                "flipped_value": flipped_value,
                "original_prediction": original_prediction,
                "new_prediction": new_prediction,
                "decision_changed": original_prediction != new_prediction,
                "positive_class": str(positive_class)
            })

    return {"counterfactuals": counterfactuals}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
