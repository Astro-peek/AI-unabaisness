import pandas as pd
import numpy as np

def compute_bias_metrics(df: pd.DataFrame, outcome_col: str, sensitive_cols: list) -> dict:
    results = {}
    
    for attr in sensitive_cols:
        if attr not in df.columns:
            continue
            
        attr_results = {
            "demographic_parity": {}, # Selection rate per group
            "equal_opportunity": {}, # Not fully implemented without ground truth, we'll proxy it if there's a label else we skip
            "disparate_impact": {}, # Ratio of selection rates
            "groups": []
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
                
        attr_results["demographic_parity"] = selection_rates
        
        # Calculate Disparate Impact (min rate / max rate) as a basic metric
        rates = list(selection_rates.values())
        max_rate = max(rates) if rates else 1
        if max_rate > 0:
            di_ratios = {k: v/max_rate for k, v in selection_rates.items()}
        else:
            di_ratios = {k: 0 for k, v in selection_rates.items()}
        
        attr_results["disparate_impact"] = di_ratios
        
        results[attr] = attr_results
        
    return results
