from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import json

from bias_engine import compute_bias_metrics

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
    
    # Simulated Attribute Detection (to be replaced with actual Gemini API call)
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
    
    return {"metrics": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
