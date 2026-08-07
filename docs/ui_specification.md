# UI Specification — Multi-Agent Financial Statement Analysis System
## Dashboard Reference Analysis & Component Specification

> Created: 2026-07-18 | Phase 2 Pre-Implementation Document  
> Reference: Apollo Hospitals Enterprise Limited Dashboard Screenshot

---

## 1. Overall Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (200px fixed)  │          MAIN CONTENT (flex: 1)           │
│                         │  ┌─────────────────────────────────────┐  │
│  Logo                   │  │ HEADER (company info + actions)     │  │
│  Navigation             │  ├─────────────────────────────────────┤  │
│  Analysis Confidence    │  │ ROW 1: Decision │ 6 KPI Cards       │  │
│  Footer                 │  ├─────────────────────────────────────┤  │
│                         │  │ ROW 2: Trend │ Radar │ Risk         │  │
│                         │  ├─────────────────────────────────────┤  │
│                         │  │ ROW 3: Competitor │ SWOT │ News     │  │
│                         │  ├─────────────────────────────────────┤  │
│                         │  │ ROW 4: Invest │ Summary │ AI Chat   │  │
│                         │  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens

### Color Palette
| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#0b1120` | Page background |
| `--bg-sidebar` | `#0f1729` | Sidebar background |
| `--bg-card` | `#141e30` | Card background |
| `--bg-card-alt` | `#111827` | Alternate card / table rows |
| `--bg-hover` | `#1a2844` | Hover state |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Card borders |
| `--border-active` | `rgba(59,130,246,0.3)` | Active / focused borders |
| `--text-primary` | `#f1f5f9` | Main text |
| `--text-secondary` | `#94a3b8` | Secondary / label text |
| `--text-muted` | `#64748b` | Muted / caption text |
| `--accent-blue` | `#3b82f6` | Primary accent, active nav |
| `--accent-green` | `#10b981` | Positive values, BUY |
| `--accent-red` | `#ef4444` | Negative values, SELL |
| `--accent-yellow` | `#f59e0b` | Warning, HOLD badge |
| `--accent-purple` | `#8b5cf6` | AI button, special |
| `--accent-cyan` | `#06b6d4` | Charts, sparklines |
| `--accent-orange` | `#f97316` | Threats, high risk |

### Typography
| Token | Value |
|---|---|
| `--font-family` | `'Inter', -apple-system, sans-serif` |
| `--font-size-xs` | `10px` |
| `--font-size-sm` | `11px` |
| `--font-size-base` | `13px` |
| `--font-size-md` | `14px` |
| `--font-size-lg` | `16px` |
| `--font-size-xl` | `20px` |
| `--font-size-2xl` | `24px` |
| `--font-size-3xl` | `32px` |

### Spacing & Layout
| Token | Value |
|---|---|
| `--sidebar-width` | `200px` |
| `--header-height` | `auto` |
| `--card-radius` | `10px` |
| `--card-padding` | `16px` |
| `--gap-sm` | `8px` |
| `--gap-md` | `12px` |
| `--gap-lg` | `16px` |
| `--card-shadow` | `0 4px 24px rgba(0,0,0,0.3)` |

---

## 3. Component Specifications

### 3.1 Sidebar
**Width**: 200px fixed, full viewport height, sticky  
**Background**: `--bg-sidebar`  
**Border-right**: 1px solid `--border-subtle`

**Sections** (top to bottom):
1. **Logo** — Icon (chart-bar lucide) + text "Multi-Agent / Financial Statement / Analysis System" (3 lines, small text)
2. **NAVIGATION** label (10px uppercase muted) → Dashboard (active, blue pill highlight), Upload Report
3. **ANALYSIS** label → Financial Metrics, Financial Ratios, Financial Health, Risk Analysis, Competitor Analysis, Market News, SWOT Analysis
4. **INVESTMENT DECISION** label → Investment Recommendation, Executive Summary
5. **AI TOOLS** label → Ask AI (Chat) with "New" badge (blue pill)
6. **EXPORT** label → Export Report
7. **Analysis Confidence** section (near bottom):
   - Financial Metrics: 98% (green bar)
   - Risk Analysis: 94% (green bar)
   - Competitor Analysis: 91% (green-yellow bar)
   - Market News: 88% (yellow bar)
   - Recommendation: 93% (green bar)
8. **Footer**: "© 2025 Multi-Agent AI System" (centered, muted, 10px)

**Nav Item Style**:
- Inactive: Icon (16px) + label (13px), `--text-secondary`, padding 8px 12px, border-radius 6px
- Active: Blue left border (3px), blue gradient bg (`rgba(59,130,246,0.15)`), `--accent-blue` text
- Hover: `--bg-hover`

### 3.2 Header
**Background**: `--bg-card` with bottom border  
**Layout**: Two rows

**Row 1 (Company Identity):**
- Left: Company name (20px, bold, white) + "HOLD" pill badge (yellow bg, 11px, font-semibold)
- Below name: NSE:APOLLOHOSP | Sector: Healthcare | Industry: Hospitals & Healthcare Services (12px, muted)
- Right: "Download Report" button (outline), "Export ▼" button (outline), "Ask AI" button (purple filled)

**Row 2 (Meta):**
- Left: (empty or continuation)
- Right: "Report Year: FY 2024-25" with calendar icon | "Uploaded on: May 24, 2025"

**Button Styles**:
- Download: border 1px `--border-active`, text white, icon left, 32px height
- Export: same + dropdown arrow
- Ask AI: bg `--accent-purple`, text white, sparkle icon, 32px height

### 3.3 Overall Decision Card
**Grid position**: Row 1, first column (wider, ~220px)  
**Background**: `--bg-card`  
**Content** (top to bottom):
- Label: "Overall Decision" (11px, muted, uppercase)
- Recommendation: "HOLD" (32px, bold, `--accent-yellow`)
- Gauge chart: ECharts gauge, 120px height, shows 72/100
  - Color zones: 0-35 green, 35-65 yellow, 65-100 red
  - Pointer at 72
  - Center text: "72" (20px bold)
- Label below gauge: "Financial Health Score" (11px, muted)

**Gauge color**: The gauge dial goes through green → yellow → orange/red.
The current value (72) lands in the yellow-orange zone.

### 3.4 KPI Metric Cards (×6)
**Layout**: 6 cards in a row (equal width)  
**Background**: `--bg-card`, radius 10px, padding 16px

Each card contains:
1. Label (11px, muted, uppercase) e.g. "Revenue (FY 24-25)"
2. Value (20px, bold, white) e.g. "₹ 16,050 Cr"
3. Change badge (12px): "+14.23% vs FY 23-24" (green if positive, red if negative)
4. Sparkline (ECharts, 80×30px, positioned bottom-right of card)
   - Green sparkline for positive trends
   - Red sparkline for negative trends

**Cards**:
- Revenue: ₹16,050 Cr, +14.23%, green sparkline
- Net Profit: ₹1,614 Cr, +8.45%, green sparkline
- EBITDA Margin: 17.42%, +1.32 pp, blue sparkline
- ROE: 13.78%, +1.85 pp, cyan sparkline
- Debt to Equity: 0.42, -0.05, green sparkline (lower = better)
- Free Cash Flow: ₹2,351 Cr, +22.18%, green sparkline

### 3.5 Financial Performance Trend Chart
**Size**: ~40% of Row 2 width, height ~280px  
**Type**: ECharts combination (Bar + Line)  
**Title**: "Financial Performance Trend" + "(₹ in Crores)" subtitle  
**Legend**: Revenue (bar, blue), Net Profit (bar, teal), Operating Cash Flow (line, yellow)

**Data** (years 2020–2025):
| Year | Revenue | Net Profit | OCF |
|---|---|---|---|
| 2020 | 9,074 | 1,050 | ~1,200 |
| 2021 | 10,195 | 1,225 | ~1,380 |
| 2022 | 11,896 | 1,401 | ~1,520 |
| 2023 | 14,035 | 1,490 | ~1,890 |
| 2024 | 16,050 | 1,614 | ~2,351 |

**Style**: Dark grid lines, no border box, axis labels in muted color

### 3.6 Financial Health Breakdown (Radar Chart)
**Size**: ~30% of Row 2 width, height ~280px  
**Type**: ECharts radar  
**Title**: "Financial Health Breakdown"  
**Center score**: "72" with "/100" shown inside the radar

**Dimensions** (5 axes):
- Liquidity: 85/100
- Profitability: 80/100
- Leverage: 55/100
- Growth: 88/100
- Efficiency: 78/100

**Legend**: Two lines — Apollo Hospitals (solid blue), Industry Avg. (dashed gray)  
**Radar shape**: Polygon  
**Fill**: Blue with 20% opacity

### 3.7 Risk Analysis Panel
**Size**: ~30% of Row 2 width, height ~280px  
**Title**: "Risk Analysis" + "(Overall: Moderate)" subtitle  
**Background**: `--bg-card`

**Content**:
5 risk dimensions as labeled progress bars:
| Dimension | Score | Color |
|---|---|---|
| Liquidity Risk | 45/100 | Green |
| Debt Risk | 55/100 | Yellow-Green |
| Operational Risk | 50/100 | Yellow |
| Market Risk | 60/100 | Yellow-Orange |
| Regulatory Risk | 40/100 | Green |

**Progress Bar Style**: 
- Track: `rgba(255,255,255,0.08)`, height 6px, radius 3px
- Fill: gradient based on score (green < 45, yellow 45-65, orange > 65)
- Score shown right-aligned: "45/100"

**Summary text** at bottom: "⚠ Moderate risk level. Company has manageable debt and stable operations."

### 3.8 Competitor Comparison Table
**Size**: ~35% of Row 3 width  
**Title**: "Competitor Comparison"  
**Type**: HTML table with custom styling

**Columns**: Company | Revenue (₹ Cr) | ROE (%) | EBITDA Margin (%) | P/E (x)

**Data**:
| Company | Revenue | ROE | EBITDA Margin | P/E |
|---|---|---|---|---|
| Apollo Hospitals* | 16,050 | 13.78 | 17.42 | 42.5 |
| Fortis Healthcare | 5,728 | 9.21 | 14.18 | 48.3 |
| Max Healthcare | 8,774 | 15.63 | 19.85 | 38.7 |
| Narayana Health | 4,765 | 12.11 | 15.27 | 33.9 |

*Apollo row highlighted blue (target company)

**Footer**: "View detailed competitor analysis →" link

### 3.9 SWOT Analysis
**Size**: ~35% of Row 3 width  
**Title**: "SWOT Analysis"  
**Layout**: 2×2 grid

| Quadrant | Color | Icon |
|---|---|---|
| Strengths | Green (#059669 bg with opacity) | S (green circle) |
| Weaknesses | Red/Amber (#b45309 bg with opacity) | W (amber circle) |
| Opportunities | Blue (#1d4ed8 bg with opacity) | O (blue circle) |
| Threats | Orange/Red (#c2410c bg with opacity) | T (red circle) |

Each quadrant has a title label and bullet list of 3 items.

**Footer**: "View full SWOT analysis →" link

### 3.10 Market News & Sentiment Panel
**Size**: ~30% of Row 3 width  
**Title**: "Market News & Sentiment"  
**Top row**: Overall Sentiment: "Positive" pill | Sentiment Score: 78/100

**News items** (3):
Each news item:
- Headline (13px, white, bold)
- Source + "X days ago" (11px, muted)
- Sentiment badge (Positive/Neutral/Negative pill)

**Sentiment colors**: Positive = green, Neutral = yellow/gray, Negative = red

**Footer**: "View full news →" link

### 3.11 Investment Recommendation Card
**Size**: ~30% of Row 4 width  
**Title**: "Investment Recommendation"

**Content** (top to bottom):
- Large recommendation: "HOLD" (28px, bold, yellow)
- Star rating: 3.5 stars (yellow filled/half/empty)
- Confidence bar: "Confidence: 93%"
- Rationale paragraph (small text)
- 4 metric pills in 2×2 grid:
  - Target Price (12M): ₹865
  - Current Price: ₹760
  - Upside Potential: 13.82%
  - Time Horizon: 12 Months
  - Risk Level: Moderate (orange)
- "View detailed recommendation →" link

### 3.12 Executive Summary Card
**Size**: ~40% of Row 4 width  
**Title**: "Executive Summary"

**Content**:
- 2 paragraphs of narrative text (13px, line-height 1.6)
- "View full executive summary →" link at bottom

### 3.13 Ask AI Panel
**Size**: ~30% of Row 4 width  
**Title**: "Ask AI about this report"

**Content**:
- 4 suggested question pills (clicking populates the input):
  - "What are the biggest risks?"
  - "Compare with Fortis Healthcare"
  - "Show revenue trend for last 5 years"
  - "What is the target price and upside?"
- Input field: "Ask a question..." placeholder + send button (blue circle, arrow icon)

---

## 4. Grid Layout Specifications

### Row 1 (Metrics Row)
```css
grid-template-columns: 220px repeat(6, 1fr);
gap: 12px;
```

### Row 2 (Charts Row)
```css
grid-template-columns: 2fr 1.5fr 1.5fr;
gap: 12px;
```

### Row 3 (Analysis Row)
```css
grid-template-columns: 1fr 1fr 1fr;
gap: 12px;
```

### Row 4 (Bottom Row)
```css
grid-template-columns: 1fr 1.3fr 1fr;
gap: 12px;
```

---

## 5. Animation Specifications

| Animation | Trigger | Effect |
|---|---|---|
| Card enter | Page load | Fade in + translateY(10px→0), staggered 50ms |
| Card hover | Mouse enter | `transform: translateY(-2px)`, shadow intensify |
| Progress bars | Page load | Width animates from 0 to target (0.8s ease) |
| Gauge | Chart init | Needle sweeps from 0 to 72 (1.5s) |
| Nav item | Mouse enter | Background fade in |
| Sparkline | Page load | Line draws from left to right |

---

## 6. Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| ≤1366px | KPI cards shrink padding, font-size -1px |
| ≤1280px | Row 3 becomes 2 columns, SWOT moves below |
| ≤1024px | Sidebar collapses to 52px icon-only |
| ≤768px | Single column layout, sidebar becomes drawer |

---

## 7. ECharts Configuration Notes

### Gauge (Health Score)
- `type: 'gauge'`
- `min: 0, max: 100`
- `startAngle: 225, endAngle: -45` (270° sweep)
- Color zones: `[[0.35, '#10b981'], [0.65, '#f59e0b'], [1, '#ef4444']]`
- Pointer: thin, rounded
- Detail: shows "72" in center

### Radar (Health Breakdown)
- `indicator`: Liquidity(100), Profitability(100), Leverage(100), Growth(100), Efficiency(100)
- `shape: 'polygon'`
- Two series: Apollo Hospitals + Industry Avg (dashed)

### Bar+Line Combo (Trend)
- X-axis: years 2020–2025
- Bar series: Revenue (blue #3b82f6), Net Profit (teal #14b8a6)
- Line series: Operating Cash Flow (yellow #f59e0b), smooth: true

### Sparklines
- `type: 'line'`, smooth: true
- No axes, no grid, no tooltip
- `symbolSize: 0` (no dots)
- Area fill: gradient from color to transparent

---

## 8. File Structure

```
frontend/
├── index.html
├── data/
│   └── dashboard.json
├── css/
│   ├── variables.css
│   ├── main.css
│   ├── sidebar.css
│   ├── header.css
│   ├── cards.css
│   ├── charts.css
│   ├── table.css
│   ├── animations.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── data_loader.js
│   └── components/
│       ├── sidebar.js
│       ├── header.js
│       ├── metric_card.js
│       ├── gauge.js
│       ├── trend_chart.js
│       ├── radar_chart.js
│       ├── risk_panel.js
│       ├── competitor_table.js
│       ├── swot.js
│       ├── recommendation.js
│       ├── summary.js
│       └── chat_panel.js
└── assets/
    └── logo.svg
```
