import pandas as pd
import numpy as np
from itertools import combinations
from scipy.stats import chi2_contingency

def compute_bias_metrics(df: pd.DataFrame, outcome_col: str, sensitive_cols: list) -> dict:
    results = {}
    
    for attr in sensitive_cols:
        if attr not in df.columns:
            continue
            
        attr_results = {
            "demographic_parity": {}, # Selection rate per group
            "equal_opportunity": {}, # Not fully implemented without ground truth, we'll proxy it if there's a label else we skip
            "disparate_impact": {}, # Ratio of selection rates
            "groups": [],
            "group_sizes": {},
            "chi_squared": {"chi2": None, "p_value": None, "significant": None}
        }
        
        # Get unique groups (handle missing values)
        df_clean = df.dropna(subset=[attr, outcome_col])
        groups = df_clean[attr].unique()
        attr_results["groups"] = [str(g) for g in groups]
        
        # Calculate selection rates (positive outcome = 1 or True or 'yes' or highest frequent class if binary)
        # We will assume outcome_col is numeric/binary or cleanly categorical.
        # Let's try to infer if positive class.
        val_counts = df_clean[outcome_col].value_counts()
        
        # Simplistic assumption: '1', 'True', 'yes', 'approved', 'hired' is positive
        pos_classes = [1, True, 'yes', 'approved', 'hired', 'Y']
        
        pos_val = val_counts.index[0] # Default to most frequent
        for val in val_counts.index:
            if str(val).lower() in [str(pc).lower() for pc in pos_classes]:
                pos_val = val
                break
                
        # Calculate demographic parity (Selection rate)
        selection_rates = {}
        for g in groups:
            group_df = df_clean[df_clean[attr] == g]
            if len(group_df) == 0:
                selection_rates[str(g)] = 0
            else:
                rate = len(group_df[group_df[outcome_col] == pos_val]) / len(group_df)
                selection_rates[str(g)] = rate
        attr_results["group_sizes"] = {str(g): len(df_clean[df_clean[attr] == g]) for g in groups}
                
        attr_results["demographic_parity"] = selection_rates
        
        # Calculate Disparate Impact (min rate / max rate) as a basic metric
        rates = list(selection_rates.values())
        max_rate = max(rates) if rates else 1
        if max_rate > 0:
            di_ratios = {k: v/max_rate for k, v in selection_rates.items()}
        else:
            di_ratios = {k: 0 for k, v in selection_rates.items()}
        
        attr_results["disparate_impact"] = di_ratios

        try:
            contingency_rows = []
            for g in groups:
                group_df = df_clean[df_clean[attr] == g]
                pos_count = len(group_df[group_df[outcome_col] == pos_val])
                neg_count = len(group_df) - pos_count
                contingency_rows.append([pos_count, neg_count])
            chi2, p_value, dof, expected = chi2_contingency(contingency_rows)
            attr_results["chi_squared"] = {
                "chi2": round(float(chi2), 4),
                "p_value": round(float(p_value), 4),
                "significant": bool(p_value < 0.05)
            }
        except Exception:
            attr_results["chi_squared"] = {"chi2": None, "p_value": None, "significant": None}
        
        results[attr] = attr_results
        
    return results


def check_compliance(metrics: dict) -> dict:
    """
    Maps disparate impact ratios to real legal standards.
    Returns compliance results per attribute per standard.
    """
    standards = {
        "EEOC 80% Rule": {
            "threshold": 0.8,
            "description": "US Equal Employment Opportunity Commission — DI ratio below 0.8 indicates adverse impact"
        },
        "EU AI Act": {
            "threshold": 0.85,
            "description": "EU AI Act high-risk system fairness guideline"
        },
        "NYC Local Law 144": {
            "threshold": 0.8,
            "description": "NYC automated employment decision tool law"
        }
    }
    compliance_results = {}
    for attr, data in metrics.items():
        compliance_results[attr] = {}
        min_di = float(min(data["disparate_impact"].values())) if data["disparate_impact"] else 1.0
        for standard_name, standard in standards.items():
            passes = bool(min_di >= standard["threshold"])
            compliance_results[attr][standard_name] = {
                "passes": passes,
                "min_di_ratio": round(min_di, 3),
                "threshold": standard["threshold"],
                "description": standard["description"],
                "status": "PASS" if passes else "FAIL"
            }
    return compliance_results


def compute_intersectional_bias(df: pd.DataFrame, outcome_col: str, sensitive_cols: list) -> dict:
    """
    Computes bias for combinations of 2 sensitive attributes.
    E.g., gender × race to detect compound discrimination.
    """
    if len(sensitive_cols) < 2:
        return {}

    results = {}
    for col_a, col_b in combinations(sensitive_cols, 2):
        if col_a not in df.columns or col_b not in df.columns:
            continue

        df_clean = df.dropna(subset=[col_a, col_b, outcome_col]).copy()
        if df_clean.empty:
            continue
        df_clean["_intersect"] = df_clean[col_a].astype(str) + " × " + df_clean[col_b].astype(str)

        val_counts = df_clean[outcome_col].value_counts()
        if val_counts.empty:
            continue
        pos_classes = [1, True, 'yes', 'approved', 'hired', 'Y']
        pos_val = val_counts.index[0]
        for val in val_counts.index:
            if str(val).lower() in [str(pc).lower() for pc in pos_classes]:
                pos_val = val
                break

        groups = df_clean["_intersect"].unique()
        rates = {}
        sizes = {}
        for g in groups:
            gdf = df_clean[df_clean["_intersect"] == g]
            if len(gdf) < 5:  # skip tiny groups
                continue
            rates[g] = round(len(gdf[gdf[outcome_col] == pos_val]) / len(gdf), 4)
            sizes[g] = len(gdf)

        if not rates:
            continue

        max_rate = max(rates.values()) if rates else 1
        di = {k: round(v / max_rate, 4) for k, v in rates.items()} if max_rate > 0 else {}

        key = f"{col_a} × {col_b}"
        results[key] = {
            "groups": list(rates.keys()),
            "demographic_parity": rates,
            "disparate_impact": di,
            "group_sizes": sizes
        }
    return results
