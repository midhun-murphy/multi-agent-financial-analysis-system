from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class MetricValue(BaseModel):
    """Canonical model for a single financial metric."""
    raw_value: Optional[float] = None
    currency_symbol: str = "$"
    unit_label: str = "Millions"
    unit_suffix: str = "M"
    formatted: str = "Not Available"
    formatted_short: str = "Not Available"

class CanonicalFinancialModel(BaseModel):
    """
    Single Source of Truth (SSOT) financial data model.
    All agents read from this model and all UI components consume from this model.
    Prevents unit mismatch and inconsistent numbers across widgets.
    """
    company_name: str = "Unknown Company"
    ticker: str = "TICKER"
    currency: str = "USD"
    currency_symbol: str = "$"
    unit_label: str = "Millions"
    unit_suffix: str = "M"
    
    revenue: MetricValue = Field(default_factory=MetricValue)
    net_profit: MetricValue = Field(default_factory=MetricValue)
    operating_cash_flow: MetricValue = Field(default_factory=MetricValue)
    free_cash_flow: MetricValue = Field(default_factory=MetricValue)
    ebitda: MetricValue = Field(default_factory=MetricValue)
    
    ebitda_margin_pct: Optional[float] = None
    roe_pct: Optional[float] = None
    debt_to_equity: Optional[float] = None
    
    historical_years: List[str] = Field(default_factory=list)
    historical_revenue: List[float] = Field(default_factory=list)
    historical_net_profit: List[float] = Field(default_factory=list)
    historical_operating_cash_flow: List[float] = Field(default_factory=list)
    historical_free_cash_flow: List[float] = Field(default_factory=list)

    @classmethod
    def create_normalized(cls, company_name: str, ticker: str, raw_metrics: Dict[str, Any], hist_trend: Dict[str, Any]) -> "CanonicalFinancialModel":
        """Factory method to construct normalized single source of truth dataset."""
        currency_sym = "₹" if (company_name.lower().find("apollo") != -1 or ticker.endswith(".NS") or ticker.endswith(".BO")) else "$"
        unit_lbl = "Crores" if currency_sym == "₹" else "Millions"
        unit_suf = "Cr" if currency_sym == "₹" else "M"

        def coerce_float(val: Any) -> Optional[float]:
            if val in [None, "Not Available", "N/A", "", "NaN", "nan"]:
                return None
            try:
                cleaned = str(val).replace(",", "").replace("%", "").replace("$", "").replace("₹", "").strip()
                if cleaned.lower() in ["not available", "n/a", "", "none"]:
                    return None
                return float(cleaned)
            except Exception:
                return None

        def build_metric(val) -> MetricValue:
            if val in [None, "Not Available"]:
                return MetricValue(raw_value=None, currency_symbol=currency_sym, unit_label=unit_lbl, unit_suffix=unit_suf, formatted="Not Available", formatted_short="Not Available")
            try:
                num = float(str(val).replace(",", "").replace("%", "").replace("$", "").replace("₹", "").strip())
                fmt = f"{currency_sym} {num:,.0f} {unit_suf}" if num > 1000 else f"{currency_sym} {num:,.2f} {unit_suf}"
                fmt_short = f"{currency_sym} {(num/1000):,.2f} B" if (num >= 1000 and unit_suf == "M") else fmt
                return MetricValue(raw_value=num, currency_symbol=currency_sym, unit_label=unit_lbl, unit_suffix=unit_suf, formatted=fmt, formatted_short=fmt_short)
            except Exception:
                return MetricValue(raw_value=None, currency_symbol=currency_sym, unit_label=unit_lbl, unit_suffix=unit_suf, formatted=str(val), formatted_short=str(val))

        rev_metric = build_metric(raw_metrics.get("revenue"))
        profit_metric = build_metric(raw_metrics.get("net_profit"))
        ocf_metric = build_metric(raw_metrics.get("operating_cash_flow"))
        fcf_metric = build_metric(raw_metrics.get("free_cash_flow"))
        ebitda_metric = build_metric(raw_metrics.get("ebitda"))

        hist_years = hist_trend.get("years", ["2022", "2023", "2024"])

        def coerce_list(lst: List[Any], default_val: float = 0.0) -> List[float]:
            result = []
            for item in lst:
                v = coerce_float(item)
                result.append(v if v is not None else default_val)
            return result

        hist_rev = coerce_list(hist_trend.get("revenue", [rev_metric.raw_value or 0.0]))
        hist_prof = coerce_list(hist_trend.get("net_profit", [profit_metric.raw_value or 0.0]))
        hist_ocf = coerce_list(hist_trend.get("operating_cash_flow", [ocf_metric.raw_value or 0.0]))
        hist_fcf = coerce_list(hist_trend.get("free_cash_flow", [fcf_metric.raw_value or 0.0]))

        return cls(
            company_name=company_name,
            ticker=ticker,
            currency="INR" if currency_sym == "₹" else "USD",
            currency_symbol=currency_sym,
            unit_label=unit_lbl,
            unit_suffix=unit_suf,
            revenue=rev_metric,
            net_profit=profit_metric,
            operating_cash_flow=ocf_metric,
            free_cash_flow=fcf_metric,
            ebitda=ebitda_metric,
            ebitda_margin_pct=coerce_float(raw_metrics.get("ebitda_margin_pct")),
            roe_pct=coerce_float(raw_metrics.get("roe_pct")),
            debt_to_equity=coerce_float(raw_metrics.get("debt_to_equity")),
            historical_years=hist_years,
            historical_revenue=hist_rev,
            historical_net_profit=hist_prof,
            historical_operating_cash_flow=hist_ocf,
            historical_free_cash_flow=hist_fcf
        )
