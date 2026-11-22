"""
Traceability study — public Streamlit demo.

Synthetic supply-chain traceability findings: how completely lots can be
traced from farm to exporter, where records break down, and how quickly a
query can be resolved. No client, farmer or supplier information is used.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(
    page_title="Traceability Study ",
    page_icon="🔎",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
      /* Charts inherit Streamlit's active theme (light or dark). */
      .plotly { background: transparent !important; }
      .plotly .bg, .plotly .plotbg { fill: transparent !important; }
      .plotly text, .plotly .gtitle, .plotly .legend text,
      .plotly .xtick text, .plotly .ytick text, .plotly .hovertext text {
        fill: currentColor !important;
      }
      .plotly .gridlayer path, .plotly .xaxis path, .plotly .yaxis path,
      .plotly .zerolinelayer path {
        stroke: currentColor !important;
        opacity: 0.3 !important;
      }
      /* Structural rules follow the theme instead of forcing black. */
      [data-testid="stMetric"] { border: 2px solid currentColor; border-radius: 0; padding: 14px; }
      [data-testid="stSidebar"] { border-right: 2px solid currentColor; }
      [data-testid="stButton"] button, .stButton > button { border: 2px solid currentColor; border-radius: 0; }
      hr { border-color: currentColor; }
      /* Compact dashboard density: minimal surrounding whitespace. */
      [data-testid="stMainBlockContainer"] { padding-top: 1rem !important; padding-bottom: 1.25rem !important; }
      [data-testid="stSidebarContent"] { padding-top: 0.75rem !important; }
      [data-testid="stSidebar"] [data-testid="stVerticalBlock"] { gap: 0.4rem !important; }
      [data-testid="stHeader"] { background: transparent !important; }
      h1 { font-size: 2rem !important; margin: 0 0 0.4rem 0 !important; }
      h2 { font-size: 1.45rem !important; margin: 0.6rem 0 0.35rem 0 !important; }
      h3 { font-size: 1.15rem !important; margin: 0.5rem 0 0.3rem 0 !important; }
      [data-testid="stMarkdownContainer"] p { margin: 0.35rem 0 !important; }
      hr { margin: 0.6rem 0 !important; }
      [data-testid="stMetric"] { padding: 10px 12px !important; }
      [data-testid="stMetricValue"] { font-size: 1.6rem !important; }
      .stTabs [data-baseweb="tab-list"] { gap: 2px; padding: 0; }
      .stTabs [data-baseweb="tab"] { padding: 6px 10px; }
      .stPlotlyChart { margin-top: 0.2rem; margin-bottom: 0.2rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

BLUE = "#2E7DFF"
GREEN = "#00B050"
RED = "#FF4D2E"
INK = "#000000"
VIOLET = "#9B30FF"  # sharp fourth series colour, visible on light and dark
STAGES = ["Farm", "Aggregator", "Processor", "Exporter"]
DISTRICTS = ["Gulu", "Kitgum", "Pader", "Amuru", "Nwoya", "Kayunga", "Masindi"]
REASONS = ["Missing farm GPS", "Missing receipt", "Unrecorded transfer", "Mixed lots", "Expired certificate"]


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    rng = np.random.default_rng(20250721)
    n = 2400
    dates = rng.choice(pd.date_range("2023-01-01", "2025-12-31", freq="D"), size=n)
    commodity = rng.choice(["Coffee", "Vanilla"], size=n, p=[0.6, 0.4])
    district = rng.choice(DISTRICTS, size=n)

    rows = []
    for i in range(n):
        stage_ok = {}
        for stage in STAGES:
            p = {"Farm": 0.86, "Aggregator": 0.91, "Processor": 0.95, "Exporter": 0.97}[stage]
            if commodity[i] == "Vanilla":
                p -= 0.04
            stage_ok[stage] = bool(rng.random() < p)
        complete = all(stage_ok.values())
        broken = [s for s, ok in stage_ok.items() if not ok]
        reason = rng.choice(REASONS) if broken else "None"
        rows.append({
            "lot": f"LOT-{i:05d}",
            "date": dates[i],
            "quarter": str(pd.Timestamp(dates[i]).to_period("Q")),
            "year": pd.Timestamp(dates[i]).year,
            "commodity": commodity[i],
            "district": district[i],
            "complete": complete,
            "broken_at": broken[0] if broken else "None",
            "reason": reason,
            "records_complete": sum(stage_ok.values()),
            "days_to_trace": int(max(1, rng.gamma(2.0, 1.6) + (0 if complete else 4.5))),
        })
    return pd.DataFrame(rows)


def chart_layout(fig):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font={"color": INK, "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        height=340,
        hoverlabel={"bgcolor": BLUE, "font": {"color": "#FFFFFF"}},
    )
    fig.update_xaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    return fig


df = build_data()

st.title("Traceability study ")
st.write(
    "A public demonstration of supply-chain traceability findings — where records "
    "break down, and how quickly a lot can be traced end to end. "
)

with st.sidebar:
    st.header("Filters")
    commodity = st.selectbox("Commodity", ["All"] + sorted(df["commodity"].unique()))
    district = st.selectbox("District", ["All districts"] + DISTRICTS)
    years = st.multiselect("Year", sorted(df["year"].unique()), default=sorted(df["year"].unique()))

view = df[(df["year"].isin(years))]
if commodity != "All":
    view = view[view["commodity"] == commodity]
if district != "All districts":
    view = view[view["district"] == district]

if view.empty:
    st.warning("No lots match these filters.")
    st.stop()

rate = 100.0 * view["complete"].mean()
rec_rate = 100.0 * view["records_complete"].sum() / (len(view) * len(STAGES))
days = view["days_to_trace"].mean()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Lots reviewed", f"{len(view):,}")
c2.metric("Fully traceable", f"{rate:.1f}%")
c3.metric("Records complete", f"{rec_rate:.1f}%")
c4.metric("Average time to trace", f"{days:.1f} days")

if rate >= 80:
    st.success(f"Finding: {rate:.1f}% of lots could be traced through every stage.")
else:
    st.error(f"Finding: {rate:.1f}% of lots could be traced through every stage.")

st.markdown("---")
left, right = st.columns(2)

stage_rows = []
for stage in STAGES:
    s = view[view["broken_at"] == stage]
    stage_rows.append({"Stage": stage, "Lots with a gap": len(s)})
stage_df = pd.DataFrame(stage_rows)
with left:
    st.subheader("Where records break down")
    fig = px.bar(stage_df, x="Stage", y="Lots with a gap", color_discrete_sequence=[RED],
                 labels={"Lots with a gap": "Lots"})
    st.plotly_chart(chart_layout(fig), width="stretch")

reason_df = view[view["reason"] != "None"].groupby("reason", as_index=False).size().sort_values("size", ascending=False)
with right:
    st.subheader("Reasons for a gap")
    fig = px.bar(reason_df, x="size", y="reason", orientation="h", color_discrete_sequence=[BLUE],
                 labels={"size": "Lots", "reason": "Reason"})
    st.plotly_chart(chart_layout(fig), width="stretch")

left, right = st.columns(2)
by_district = view.groupby("district", as_index=False)["complete"].mean().sort_values("complete", ascending=False)
by_district["Traceable %"] = (by_district["complete"] * 100).round(1)
with left:
    st.subheader("Traceability by district")
    fig = px.bar(by_district, x="district", y="Traceable %", color_discrete_sequence=[GREEN],
                 labels={"district": "District"})
    st.plotly_chart(chart_layout(fig), width="stretch")

trend = view.groupby("quarter", as_index=False)["complete"].mean().sort_values("quarter")
trend["Traceable %"] = (trend["complete"] * 100).round(1)
with right:
    st.subheader("Traceability over time")
    fig = px.line(trend, x="quarter", y="Traceable %", color_discrete_sequence=[BLUE],
                  labels={"quarter": "Quarter"})
    st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.subheader("Findings")
top_reason = reason_df.iloc[0]["reason"] if len(reason_df) else "none"
worst = by_district.iloc[-1]["district"]
for text in [
    f"The most common gap is {top_reason}.",
    f"{worst} has the lowest share of fully traceable lots in this selection.",
    "Lots with a missing record take substantially longer to resolve than complete lots.",
]:
    st.markdown(f'<p style="">• {text}</p>', unsafe_allow_html=True)

st.markdown("---")
st.markdown('<p style="font-size:0.85rem;">Public demo built with Streamlit and Plotly</p>', unsafe_allow_html=True)
