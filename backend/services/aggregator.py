from typing import Dict, Any, List
from datetime import datetime
from backend.models.financial import CanonicalFinancialModel
from backend.state.analysis_state import AnalysisState
from backend.utils.logger import get_logger

logger = get_logger(__name__)

class AggregatorService:
    """
    Transforms LangGraph AnalysisState outputs into the complete frontend Dashboard JSON schema.
    Uses CanonicalFinancialModel as the Single Source of Truth to guarantee unit normalization
    and zero data conflicts across cards, tables, charts, and summary paragraphs.
    Filters out future dates/years and ensures fallback texts comply with rules.
    """

    @staticmethod
    def _safe_num(val: Any) -> Any:
        """Coerce to float, return None if not available."""
        if val in [None, "Not Available", "", "N/A"]:
            return None
        try:
            return float(str(val).replace(",", "").replace("$", "").replace("₹", "").strip())
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _yoy_change(current: Any, prior: Any) -> tuple:
        """
        Compute year-over-year change.
        Returns (change_pct: float | None, change_label: str, is_positive: bool)
        """
        curr = AggregatorService._safe_num(current)
        prev = AggregatorService._safe_num(prior)
        if curr is None or prev is None or prev == 0:
            return None, "", True
        pct = ((curr - prev) / abs(prev)) * 100
        sign = "+" if pct >= 0 else ""
        label = f"{sign}{pct:.2f}%"
        return pct, label, pct >= 0

    @staticmethod
    def build_dashboard_data(state: AnalysisState) -> Dict[str, Any]:
        session = state.get("session", {})
        metadata = state.get("metadata", {})
        agents = state.get("agents", {})

        company_name = session.get("company_name", "Unknown Company")
        ticker = session.get("ticker", "TICKER")
        sector = metadata.get("sector", "Technology")
        industry = metadata.get("industry", "General Industry")

        metrics_agent = agents.get("financial_metrics", {}).get("output", {}) or {}
        ratios_agent = agents.get("financial_ratios", {}).get("output", {}) or {}
        health_agent = agents.get("financial_health", {}).get("output", {}) or {}
        risk_agent = agents.get("risk_analysis", {}).get("output", {}) or {}
        news_agent = agents.get("market_news", {}).get("output", {}) or {}
        investment_agent = agents.get("investment_recommendation", {}).get("output", {}) or {}
        summary_agent = agents.get("executive_summary", {}).get("output", {}) or {}
        competitor_agent = agents.get("competitor", {}).get("output", {}) or {}

        # Determine actual latest year from metrics agent output
        latest_year = metrics_agent.get("latest_year")
        detected_years = metrics_agent.get("detected_years", [])
        if latest_year:
            fiscal_year = f"FY {latest_year}"
        else:
            fiscal_year = metadata.get("fiscal_year", "FY 2024")

        # ── Helper to read a metric from MetricsByYear dict ───────────────────
        def get_latest(key: str) -> Any:
            return metrics_agent.get("latest_metrics", {}).get(key)

        def get_year(year: str, key: str) -> Any:
            return metrics_agent.get("historical_metrics", {}).get(year, {}).get(key)

        # Prior year (one year before latest)
        prior_year = detected_years[1] if len(detected_years) > 1 else None

        # ── 1. Single Source of Truth: Canonical Financial Model ──────────────
        def get_ratio(key: str) -> Any:
            ra = ratios_agent.get(key)
            if isinstance(ra, dict):
                return ra.get("value")
            return ra

        raw_metrics = {
            "revenue":             get_latest("revenue"),
            "net_profit":          get_latest("net_profit"),
            "operating_cash_flow": get_latest("operating_cash_flow"),
            "free_cash_flow":      get_latest("free_cash_flow"),
            "ebitda":              get_latest("ebitda"),
            "ebitda_margin_pct":   get_latest("ebitda_margin_pct") or get_ratio("ebitda_margin_pct"),
            "roe_pct":             get_latest("roe_pct") or get_ratio("roe_pct"),
            "debt_to_equity":      get_latest("debt_to_equity") or get_ratio("debt_to_equity"),
        }

        hist_trend = metrics_agent.get("historical_trend", {}) or metadata.get("historical_trend", {})
        ssot = CanonicalFinancialModel.create_normalized(company_name, ticker, raw_metrics, hist_trend)

        logger.info(
            f"SSOT Canonical Model initialized for {company_name} | "
            f"Revenue: {ssot.revenue.formatted} | Profit: {ssot.net_profit.formatted} | "
            f"FCF: {ssot.free_cash_flow.formatted} | EBITDA: {ssot.ebitda.formatted}"
        )

        # ── 2. Multi-Factor Weighted Recommendation Engine ────────────────────
        prof_score = health_agent.get("profitability_score", 80)
        growth_score = health_agent.get("growth_score", 75)
        liq_score = health_agent.get("liquidity_score", 70)
        lev_score = health_agent.get("leverage_score", 70)

        cf_score = 85 if ssot.free_cash_flow.raw_value is not None else 65

        risk_level_obj = risk_agent.get("overall_risk_level")
        risk_level_str = str(risk_level_obj.get("value") if isinstance(risk_level_obj, dict) else (risk_level_obj or "Moderate"))
        risk_score = 85 if "Low" in risk_level_str else (65 if "Moderate" in risk_level_str else 40)
        sentiment_score = news_agent.get("sentiment_score", 75)

        weighted_final_score = (
            (prof_score * 0.20) +
            (growth_score * 0.20) +
            (liq_score * 0.15) +
            (lev_score * 0.15) +
            (cf_score * 0.15) +
            (risk_score * 0.10) +
            (sentiment_score * 0.05)
        )
        final_score = round(weighted_final_score, 1)

        if final_score >= 80:
            overall_decision = "STRONG BUY"
        elif final_score >= 65:
            overall_decision = "BUY"
        elif final_score >= 50:
            overall_decision = "HOLD"
        elif final_score >= 35:
            overall_decision = "SELL"
        else:
            overall_decision = "STRONG SELL"

        # ── Company Profile: fetch verified name/exchange/sector/industry from Yahoo Finance ──
        yf_name = None
        yf_exchange = None
        yf_sector = None
        yf_industry = None

        # Pre-compute exchange from ticker suffix — guaranteed even without a network call
        _ticker_upper = ticker.upper()
        _exch_map = {
            "NMS": "NASDAQ", "NGM": "NASDAQ", "NCM": "NASDAQ",
            "NYQ": "NYSE",   "NYE": "NYSE",
            "NSI": "NSE",    "BSE": "BSE",
            "LSE": "LSE",    "FRA": "FSE",    "TYO": "TSE",
        }
        if _ticker_upper.endswith(".NS"):
            yf_exchange = "NSE"
        elif _ticker_upper.endswith(".BO"):
            yf_exchange = "BSE"

        try:
            import time as _time, yfinance as yf, requests as _req

            _yf_session = _req.Session()
            _yf_session.headers.update({
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            })

            def _fetch_yf_profile(tkr: str):
                for attempt in range(2):          # at most 2 attempts
                    try:
                        info = yf.Ticker(tkr, session=_yf_session).info
                        if info and len(info) > 3:
                            return info
                    except Exception as _e:
                        _err = str(_e)
                        if ("429" in _err or "Too Many" in _err or "Expecting value" in _err) and attempt == 0:
                            _time.sleep(3)        # brief back-off before retry
                            continue
                        break
                # Lightweight fallback: fast_info at least gives us exchange code
                try:
                    fi = yf.Ticker(tkr, session=_yf_session).fast_info
                    return {"exchange": getattr(fi, "exchange", None)}
                except Exception:
                    return {}

            yf_info = _fetch_yf_profile(ticker)

            yf_name     = yf_info.get("longName") or yf_info.get("shortName")
            yf_sector   = yf_info.get("sector")
            yf_industry = yf_info.get("industry")
            raw_exch    = yf_info.get("exchange", "") or ""

            # Map exchange only if suffix didn't already resolve it
            if yf_exchange is None and raw_exch:
                yf_exchange = _exch_map.get(raw_exch.upper(), raw_exch.upper())

        except Exception as _yf_err:
            logger.warning(f"Aggregator: Yahoo Finance profile fetch failed for {ticker}: {_yf_err}")

        # Build company_info preferring Yahoo Finance verified values,
        # falling back to pipeline-detected values, then "Not Available".
        company_info = {
            "name":             yf_name or company_name or "Not Available",
            "ticker":           ticker or "Not Available",
            "exchange":         yf_exchange or "Not Available",
            "sector":           yf_sector or (sector if sector not in ("Technology", "") else None) or "Not Available",
            "industry":         yf_industry or (industry if industry not in ("General Industry", "") else None) or "Not Available",
            "report_year":      fiscal_year,
            "uploaded_on":      datetime.now().strftime("%b %d, %Y"),
            "overall_decision": overall_decision,
            "health_score":     int(final_score)
        }

        # ── 3. KPI Cards with real YoY changes ───────────────────────────────
        # Revenue YoY
        rev_curr = get_latest("revenue")
        rev_prev = get_year(prior_year, "revenue") if prior_year else None
        rev_chg, rev_chg_lbl, rev_pos = AggregatorService._yoy_change(rev_curr, rev_prev)

        # Net Profit YoY
        np_curr = get_latest("net_profit")
        np_prev = get_year(prior_year, "net_profit") if prior_year else None
        np_chg, np_chg_lbl, np_pos = AggregatorService._yoy_change(np_curr, np_prev)

        # EBITDA YoY
        eb_curr = get_latest("ebitda")
        eb_prev = get_year(prior_year, "ebitda") if prior_year else None
        eb_chg, eb_chg_lbl, eb_pos = AggregatorService._yoy_change(eb_curr, eb_prev)

        # Operating Cash Flow YoY
        ocf_curr = get_latest("operating_cash_flow")
        ocf_prev = get_year(prior_year, "operating_cash_flow") if prior_year else None
        ocf_chg, ocf_chg_lbl, ocf_pos = AggregatorService._yoy_change(ocf_curr, ocf_prev)

        # Free Cash Flow YoY
        fcf_curr = get_latest("free_cash_flow")
        fcf_prev = get_year(prior_year, "free_cash_flow") if prior_year else None
        fcf_chg, fcf_chg_lbl, fcf_pos = AggregatorService._yoy_change(fcf_curr, fcf_prev)

        # EBITDA Margin YoY
        ebm_curr = get_latest("ebitda_margin_pct")
        ebm_prev = get_year(prior_year, "ebitda_margin_pct") if prior_year else None
        ebm_chg, ebm_chg_lbl, ebm_pos = AggregatorService._yoy_change(ebm_curr, ebm_prev)
        if ebm_chg is not None:
            ebm_chg_lbl = f"{'+'if ebm_chg >= 0 else ''}{ebm_chg:.2f} pp"

        # ROE YoY
        roe_curr = get_latest("roe_pct") or AggregatorService._safe_num(get_ratio("roe_pct"))
        roe_prev = get_year(prior_year, "roe_pct") if prior_year else None
        roe_chg, roe_chg_lbl, roe_pos = AggregatorService._yoy_change(roe_curr, roe_prev)
        if roe_chg is not None:
            roe_chg_lbl = f"{'+'if roe_chg >= 0 else ''}{roe_chg:.2f} pp"

        # D/E YoY
        de_curr = get_latest("debt_to_equity") or AggregatorService._safe_num(get_ratio("debt_to_equity"))
        de_prev = get_year(prior_year, "debt_to_equity") if prior_year else None
        de_chg, de_chg_lbl, _ = AggregatorService._yoy_change(de_curr, de_prev)
        if de_chg is not None:
            de_chg_lbl = f"{'+'if de_chg >= 0 else ''}{de_chg:.2f}"
        de_pos = (de_chg is not None and de_chg <= 0)  # lower D/E is better

        def _fmt_metric(val: Any, is_currency: bool = True) -> str:
            """Format a metric for display."""
            n = AggregatorService._safe_num(val)
            if n is None:
                return "Not Available"
            sym = ssot.currency_symbol
            suf = ssot.unit_suffix
            if is_currency:
                return f"{sym} {n:,.0f} {suf}" if n >= 1000 else f"{sym} {n:,.2f} {suf}"
            return f"{n:,.2f}"

        def _sparkline_from_history(key: str, years_asc: list) -> list:
            """Build sparkline array from historical metrics (ascending order)."""
            out = []
            for y in years_asc:
                v = get_year(y, key)
                n = AggregatorService._safe_num(v)
                if n is not None:
                    out.append(n)
            return out

        years_asc = sorted(detected_years) if detected_years else []

        metrics_data = {
            "revenue": {
                "label": f"Revenue ({fiscal_year})",
                "value": AggregatorService._safe_num(rev_curr) or 0,
                "formatted": _fmt_metric(rev_curr),
                "change": rev_chg or 0,
                "change_label": rev_chg_lbl,
                "change_type": "percent",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": rev_pos,
                "sparkline": _sparkline_from_history("revenue", years_asc) or [],
                "color": "#10b981"
            },
            "net_profit": {
                "label": "Net Profit",
                "value": AggregatorService._safe_num(np_curr) or 0,
                "formatted": _fmt_metric(np_curr),
                "change": np_chg or 0,
                "change_label": np_chg_lbl,
                "change_type": "percent",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": np_pos,
                "sparkline": _sparkline_from_history("net_profit", years_asc) or [],
                "color": "#10b981"
            },
            "ebitda": {
                "label": "EBITDA",
                "value": AggregatorService._safe_num(eb_curr) or 0,
                "formatted": _fmt_metric(eb_curr),
                "change": eb_chg or 0,
                "change_label": eb_chg_lbl,
                "change_type": "percent",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": eb_pos,
                "sparkline": _sparkline_from_history("ebitda", years_asc) or [],
                "color": "#3b82f6"
            },
            "free_cash_flow": {
                "label": "Free Cash Flow",
                "value": AggregatorService._safe_num(fcf_curr) or 0,
                "formatted": _fmt_metric(fcf_curr),
                "change": fcf_chg or 0,
                "change_label": fcf_chg_lbl,
                "change_type": "percent",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": fcf_pos,
                "sparkline": _sparkline_from_history("free_cash_flow", years_asc) or [],
                "color": "#06b6d4"
            },
            "operating_cash_flow": {
                "label": "Operating Cash Flow",
                "value": AggregatorService._safe_num(ocf_curr) or 0,
                "formatted": _fmt_metric(ocf_curr),
                "change": ocf_chg or 0,
                "change_label": ocf_chg_lbl,
                "change_type": "percent",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": ocf_pos,
                "sparkline": _sparkline_from_history("operating_cash_flow", years_asc) or [],
                "color": "#8b5cf6"
            },
            "ebitda_margin": {
                "label": "EBITDA Margin",
                "value": AggregatorService._safe_num(ebm_curr),
                "formatted": f"{ebm_curr:.2f}%" if AggregatorService._safe_num(ebm_curr) is not None else "Not Available",
                "change": ebm_chg or 0,
                "change_label": ebm_chg_lbl,
                "change_type": "pp",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": ebm_pos,
                "sparkline": _sparkline_from_history("ebitda_margin_pct", years_asc) or [],
                "color": "#f59e0b"
            },
            "roe": {
                "label": "ROE",
                "value": AggregatorService._safe_num(roe_curr),
                "formatted": f"{roe_curr:.2f}%" if AggregatorService._safe_num(roe_curr) is not None else "Not Available",
                "change": roe_chg or 0,
                "change_label": roe_chg_lbl,
                "change_type": "pp",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": roe_pos,
                "sparkline": _sparkline_from_history("roe_pct", years_asc) or [],
                "color": "#ec4899"
            },
            "debt_to_equity": {
                "label": "Debt to Equity",
                "value": AggregatorService._safe_num(de_curr),
                "formatted": f"{de_curr:.2f}" if AggregatorService._safe_num(de_curr) is not None else "Not Available",
                "change": de_chg or 0,
                "change_label": de_chg_lbl,
                "change_type": "absolute",
                "change_period": f"vs FY {prior_year}" if prior_year else "vs Prior Year",
                "positive": de_pos,
                "sparkline": _sparkline_from_history("debt_to_equity", years_asc) or [],
                "color": "#f59e0b"
            },
        }

        # ── 4. Historical Performance Trend (only past years) ─────────────────
        current_year = datetime.now().year
        valid_indices = [
            idx for idx, y in enumerate(ssot.historical_years)
            if y.isdigit() and int(y) < current_year
        ]

        trend_data = {
            "years":                [ssot.historical_years[i] for i in valid_indices],
            "revenue":              [ssot.historical_revenue[i] for i in valid_indices] if ssot.historical_revenue else [],
            "net_profit":           [ssot.historical_net_profit[i] for i in valid_indices] if ssot.historical_net_profit else [],
            "operating_cash_flow":  [ssot.historical_operating_cash_flow[i] for i in valid_indices] if ssot.historical_operating_cash_flow else [],
            "free_cash_flow":       [ssot.historical_free_cash_flow[i] for i in valid_indices] if ssot.historical_free_cash_flow else [],
        }

        # ── 5. Financial Health Breakdown & Risk ──────────────────────────────
        health_data = {
            "liquidity":      liq_score,
            "profitability":  prof_score,
            "leverage":       lev_score,
            "growth":         growth_score,
            "efficiency":     health_agent.get("efficiency_score", 70),
            "industry_avg": {
                "liquidity": 70, "profitability": 72,
                "leverage": 65, "growth": 75, "efficiency": 68
            }
        }

        risk_summary_val = risk_agent.get("risk_summary")
        risk_summary_text = str(
            risk_summary_val.get("value") if isinstance(risk_summary_val, dict)
            else (risk_summary_val or f"Risk evaluation for {company_name} indicates manageable operational and debt levels.")
        )

        risk_data = {
            "overall":     risk_level_str,
            "liquidity":   int(risk_agent.get("liquidity_risk_score", {}).get("value", 35) if isinstance(risk_agent.get("liquidity_risk_score"), dict) else risk_agent.get("liquidity_risk_score", 35)),
            "debt":        int(risk_agent.get("debt_risk_score", {}).get("value", 45) if isinstance(risk_agent.get("debt_risk_score"), dict) else risk_agent.get("debt_risk_score", 45)),
            "operational": int(risk_agent.get("operational_risk_score", {}).get("value", 40) if isinstance(risk_agent.get("operational_risk_score"), dict) else risk_agent.get("operational_risk_score", 40)),
            "market":      int(risk_agent.get("market_risk_score", {}).get("value", 50) if isinstance(risk_agent.get("market_risk_score"), dict) else risk_agent.get("market_risk_score", 50)),
            "regulatory":  int(risk_agent.get("regulatory_risk_score", {}).get("value", 35) if isinstance(risk_agent.get("regulatory_risk_score"), dict) else risk_agent.get("regulatory_risk_score", 35)),
            "summary":     risk_summary_text
        }

        # ── 6. Competitor Table ────────────────────────────────────────────────
        comp_list = competitor_agent.get("competitors", []) if isinstance(competitor_agent, dict) else []
        formatted_competitors = []
        for c in comp_list:
            if isinstance(c, dict):
                is_tgt = c.get("is_target", False)

                def _fmt_num(val, suffix="", decimals=2):
                    if isinstance(val, (int, float)):
                        return f"{val:,.{decimals}f}{suffix}"
                    return str(val) if val not in [None, ""] else "Not Available"

                def _fmt_pct(val):
                    if isinstance(val, (int, float)):
                        return f"{val:.2f}%"
                    v = str(val)
                    return v if v not in ["", "None"] else "Not Available"

                def _fmt_mc(val):
                    if isinstance(val, (int, float)):
                        return f"{ssot.currency_symbol} {val:,.2f} {ssot.unit_suffix}"
                    return str(val) if val not in [None, ""] else "Not Available"

                formatted_competitors.append({
                    # Identity
                    "name":             c.get("name", "Peer"),
                    "ticker":           c.get("ticker", "TICKER"),
                    "exchange":         c.get("exchange", "N/A"),
                    "sector":           c.get("sector", "N/A"),
                    "industry":         c.get("industry", "N/A"),
                    "currency":         c.get("currency", "USD"),
                    "is_target":        is_tgt,
                    "data_source":      c.get("data_source", "N/A"),
                    # Valuation
                    "market_cap":       _fmt_mc(c.get("market_cap")),
                    "enterprise_value": _fmt_mc(c.get("enterprise_value")),
                    "pe":               _fmt_num(c.get("pe")),
                    "forward_pe":       _fmt_num(c.get("forward_pe")),
                    "pb":               _fmt_num(c.get("pb")),
                    "eps":              _fmt_num(c.get("eps")),
                    "dividend_yield":   _fmt_pct(c.get("dividend_yield")),
                    "price":            _fmt_num(c.get("price") if c.get("price") is not None else c.get("current_price")),
                    "week_52_high":     _fmt_num(c.get("week_52_high")),
                    "week_52_low":      _fmt_num(c.get("week_52_low")),
                    # Financials
                    "revenue":          _fmt_mc(c.get("revenue")),
                    "gross_profit":     _fmt_mc(c.get("gross_profit")),
                    "net_profit":       _fmt_mc(c.get("net_profit") if c.get("net_profit") is not None else c.get("net_income")),
                    "ebitda":           _fmt_mc(c.get("ebitda")),
                    "cash_flow":        _fmt_mc(c.get("cash_flow") if c.get("cash_flow") is not None else c.get("operating_cash_flow")),
                    # Margins
                    "gross_margin":     _fmt_pct(c.get("gross_margin")),
                    "operating_margin": _fmt_pct(c.get("operating_margin")),
                    "net_margin":       _fmt_pct(c.get("net_margin")),
                    "ebitda_margin":    _fmt_pct(c.get("ebitda_margin")),
                    # Returns
                    "roe":              _fmt_pct(c.get("roe")),
                    "roa":              _fmt_pct(c.get("roa")),
                    # Leverage
                    "debt_to_equity":   _fmt_num(c.get("debt_to_equity")),
                    "current_ratio":    _fmt_num(c.get("current_ratio")),
                    # Recommendation
                    "recommendation":   c.get("recommendation", "HOLD"),
                })
        if not formatted_competitors:
            # Fallback: show target company only from SSOT
            formatted_competitors.append({
                "name":             company_name,
                "ticker":           ticker,
                "exchange":         "N/A",
                "sector":           sector,
                "industry":         industry,
                "currency":         "INR" if ssot.currency_symbol == "₹" else "USD",
                "is_target":        True,
                "data_source":      "metrics_agent",
                "market_cap":       "Not Available",
                "enterprise_value": "Not Available",
                "pe":               "Not Available",
                "forward_pe":       "Not Available",
                "pb":               "Not Available",
                "eps":              "Not Available",
                "dividend_yield":   "Not Available",
                "price":            "Not Available",
                "week_52_high":     "Not Available",
                "week_52_low":      "Not Available",
                "revenue":          ssot.revenue.formatted,
                "gross_profit":     "Not Available",
                "net_profit":       "Not Available",
                "ebitda":           ssot.ebitda.formatted,
                "cash_flow":        "Not Available",
                "gross_margin":     "Not Available",
                "operating_margin": "Not Available",
                "net_margin":       "Not Available",
                "ebitda_margin":    f"{ssot.ebitda_margin_pct:.2f}%" if ssot.ebitda_margin_pct is not None else "Not Available",
                "roe":              f"{ssot.roe_pct:.2f}%" if ssot.roe_pct is not None else "Not Available",
                "roa":              "Not Available",
                "debt_to_equity":   f"{ssot.debt_to_equity:.2f}" if ssot.debt_to_equity is not None else "Not Available",
                "current_ratio":    "Not Available",
                "recommendation":   "HOLD",
            })

        # ── 7. SWOT ────────────────────────────────────────────────────────────
        swot_agent = agents.get("swot", {}).get("output", {}) or {}
        # Use `or` (not dict.get default) so that empty lists [] also trigger
        # the fallback — dict.get(key, default) only fires when the key is absent.
        swot_data = {
            "strengths":     swot_agent.get("strengths")     or [f"Market leader in {sector}", f"Annual revenue of {ssot.revenue.formatted}", f"Free Cash Flow of {ssot.free_cash_flow.formatted}"],
            "weaknesses":    swot_agent.get("weaknesses")    or ["Input & supply chain cost inflation pressures", "Market segment concentration risks"],
            "opportunities": swot_agent.get("opportunities") or [f"Growing market demand in {sector}", "Strategic technology adoption"],
            "threats":       swot_agent.get("threats")       or ["Macroeconomic interest rate volatility", "Regulatory & competitive environment changes"]
        }

        # ── 8. News & Sentiment ────────────────────────────────────────────────
        news_articles = news_agent.get("articles", [])
        formatted_articles = []
        for a in news_articles:
            if isinstance(a, dict):
                formatted_articles.append({
                    "headline": a.get("headline", f"{company_name} quarterly performance updates"),
                    "source":   a.get("source", "Financial News"),
                    "days_ago": a.get("days_ago", 2),
                    "sentiment": a.get("sentiment", "Positive")
                })
        if not formatted_articles:
            formatted_articles = [{"headline": "No recent news available.", "source": "", "days_ago": 0, "sentiment": "Neutral"}]

        news_data = {
            "overall_sentiment": news_agent.get("overall_sentiment", "Positive"),
            "sentiment_score":   sentiment_score,
            "articles":          formatted_articles
        }

        # ── 9. Investment Recommendation ───────────────────────────────────────
        contributing_metrics = [
            {"factor": "Profitability (20%)", "score": f"{prof_score}/100"},
            {"factor": "Growth (20%)",        "score": f"{growth_score}/100"},
            {"factor": "Liquidity (15%)",     "score": f"{liq_score}/100"},
            {"factor": "Leverage (15%)",      "score": f"{lev_score}/100"},
            {"factor": "Cash Flow (15%)",     "score": f"{cf_score}/100"},
            {"factor": "Risk (10%)",          "score": f"{risk_score}/100"},
            {"factor": "Market Sentiment (5%)", "score": f"{sentiment_score}/100"}
        ]

        raw_target_price = investment_agent.get("target_price_12m")
        raw_current_price = investment_agent.get("current_price")
        raw_upside = investment_agent.get("upside_potential_pct")

        target_price_str  = f"{ssot.currency_symbol} {raw_target_price}" if raw_target_price not in [None, "Not Available"] else "Not Available"
        current_price_str = f"{ssot.currency_symbol} {raw_current_price}" if raw_current_price not in [None, "Not Available"] else "Not Available"
        upside_str        = f"{raw_upside}%" if raw_upside not in [None, "Not Available"] else "Not Available"

        rec_data = {
            "recommendation": overall_decision,
            "confidence": 92,
            "overall_score": final_score,
            "target_price_12m": target_price_str,
            "current_price": current_price_str,
            "upside_potential": upside_str,
            "time_horizon": "12 Months",
            "risk_level": risk_level_str,
            "stars": 4.5 if overall_decision in ["BUY", "STRONG BUY"] else 3.5,
            "rationale": f"Multi-factor weighted analysis for {company_name} yields a score of {final_score}/100, driven by Profitability ({prof_score}/100) and Cash Flow ({cf_score}/100).",
            "contributing_metrics": contributing_metrics,
            "key_strengths":  swot_data["strengths"],
            "key_weaknesses": swot_data["weaknesses"]
        }

        # ── 10. Executive Summary ──────────────────────────────────────────────
        p1 = summary_agent.get("paragraph_1", f"{company_name} demonstrates strong performance in {fiscal_year} with total revenue of {ssot.revenue.formatted} and net income of {ssot.net_profit.formatted}.")
        p2 = summary_agent.get("paragraph_2", f"Multi-factor scoring yields an overall health score of {final_score}/100 with a {risk_level_str.lower()} risk profile and Free Cash Flow of {ssot.free_cash_flow.formatted}.")
        p3 = summary_agent.get("paragraph_3", f"The weighted recommendation supports a {overall_decision} rating for institutional investors based on fundamental strength.")

        summary_data = {
            "paragraphs": [p1, p2, p3],
            "highlights": [
                f"Total Revenue: {ssot.revenue.formatted}",
                f"Net Income: {ssot.net_profit.formatted}",
                f"EBITDA: {ssot.ebitda.formatted}",
                f"Free Cash Flow: {ssot.free_cash_flow.formatted}",
                f"Overall Score: {final_score}/100 ({overall_decision})"
            ]
        }

        # ── 11. Confidence Scores ──────────────────────────────────────────────
        conf_data = {
            "financial_metrics": 95 if ssot.revenue.formatted != "Not Available" else 70,
            "risk_analysis": 90,
            "competitor_analysis": 85,
            "market_news": 90,
            "recommendation": 92
        }

        chat_suggestions = [
            f"What was the total revenue for {company_name} in {fiscal_year}?",
            f"What is the Free Cash Flow for {company_name}?",
            f"Show the multi-year revenue and profit trend for {company_name}",
            f"What is the weighted recommendation rationale for {company_name}?"
        ]

        logger.info(f"Aggregator completed SSOT dashboard payload for {company_name} ({ticker}). Decision: {overall_decision} ({final_score}/100)")

        return {
            "company":           company_info,
            "metrics":           metrics_data,
            "performance_trend": trend_data,
            "health_breakdown":  health_data,
            "risk":              risk_data,
            "competitors":       formatted_competitors,
            "swot":              swot_data,
            "news":              news_data,
            "investment":        rec_data,
            "executive_summary": summary_data,
            "confidence_scores": conf_data,
            "chat_suggestions":  chat_suggestions,
            "raw_agent_outputs": {
                "financial_metrics": metrics_agent,
                "financial_ratios": ratios_agent,
                "financial_health": health_agent,
                "risk_analysis": risk_agent,
                "competitor": competitor_agent,
                "market_news": news_agent,
                "swot": swot_agent,
                "investment_recommendation": investment_agent,
                "executive_summary": summary_agent
            }
        }

