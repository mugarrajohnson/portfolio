"""
Advanced analytics demo — public Streamlit app.

A richer, URL-driven dashboard: period presets (?period=3M), segment and region
filters carried in the query string, KPI deltas against the previous period,
interactive charts, a what-if scenario slider and CSV export. Every figure is
synthetic; no client or beneficiary information is used.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

st.set_page_config(
    page_title="Advanced Analytics — Public Demo",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
      /* Charts follow Streamlit's active light/dark theme. */
      .plotly { background: transparent !important; }
      .plotly .bg, .plotly .plotbg { fill: transparent !important; }
      .plotly text, .plotly .gtitle, .plotly .legend text,
      .plotly .xtick text, .plotly .ytick text, .plotly .hovertext text { fill: currentColor !important; }
      .plotly .gridlayer path, .plotly .xaxis path, .plotly .yaxis path,
      .plotly .zerolinelayer path { stroke: currentColor !important; opacity: 0.3 !important; }
      [data-testid="stMetric"] { border: 2px solid currentColor; border-radius: 0; padding: 14px; }
      [data-testid="stSidebar"] { border-right: 2px solid currentColor; }
      .stButton > button { border: 2px solid currentColor; border-radius: 0; }
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
VIOLET = "#9B30FF"
SERIES = [BLUE, GREEN, RED, VIOLET]

PERIODS = {"1M": 1, "3M": 3, "6M": 6, "12M": 12, "All": 120}
REGIONS = ["West", "Central", "East", "Northern"]
SEGMENTS = ["Smallholder", "Cooperative", "Aggregator", "Institution"]
CHANNELS = ["Direct", "Partner", "Digital"]
PRODUCTS = ["Coffee", "Vanilla"]


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    rng = np.random.default_rng(20260919)
    dates = pd.date_range("2023-01-01", "2025-12-31", freq="D")
    n = 5200
    d = rng.choice(dates, size=n)
    region = rng.choice(REGIONS, size=n, p=[0.36, 0.28, 0.22, 0.14])
    segment = rng.choice(SEGMENTS, size=n, p=[0.44, 0.27, 0.19, 0.10])
    channel = rng.choice(CHANNELS, size=n, p=[0.5, 0.3, 0.2])
    product = rng.choice(PRODUCTS, size=n, p=[0.62, 0.38])
    base = np.where(product == "Coffee", 820, 1450)
    volume = np.round(rng.gamma(2.1, base / 2.1, size=n), 1)
    unit_price = np.where(product == "Coffee", 7200, 6100)
    revenue = volume * unit_price * rng.uniform(0.88, 1.12, size=n)
    cost = revenue * rng.uniform(0.62, 0.86, size=n)
    people = rng.integers(1, 6, size=n)
    satisfaction = np.clip(rng.normal(3.9, 0.55, size=n), 1, 5)
    return pd.DataFrame({
        "date": d,
        "month": pd.to_datetime(d).to_period("M").astype(str),
        "year": pd.to_datetime(d).year,
        "region": region,
        "segment": segment,
        "channel": channel,
        "product": product,
        "volume": volume,
        "revenue": revenue,
        "cost": cost,
        "people": people,
        "satisfaction": np.round(satisfaction, 2),
    })


def sync_param(key: str, value) -> None:
    if st.query_params.get(key) != str(value):
        st.query_params[key] = str(value)


def chart_layout(fig, height=380):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font={"color": "#000000", "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        height=height,
        hoverlabel={"bgcolor": BLUE, "font": {"color": "#FFFFFF"}},
    )
    fig.update_xaxes(gridcolor="#000000", zeroline=False, linecolor="#000000")
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor="#000000")
    return fig


df = build_data()

st.title("Advanced analytics — public demo")
st.write(
    "A URL-driven dashboard: change the filters and share the link. "
    "Every figure is **synthetic** — no client or data subject information is used."
)

with st.sidebar:
    st.header("View controls")
    period = st.selectbox("Period", list(PERIODS), index=list(PERIODS).index(st.query_params.get("period", "3M")) if st.query_params.get("period", "3M") in PERIODS else 1)
    region = st.selectbox("Region", ["All"] + REGIONS, index=(["All"] + REGIONS).index(st.query_params.get("region", "All")) if st.query_params.get("region", "All") in ["All"] + REGIONS else 0)
    segment = st.selectbox("Segment", ["All"] + SEGMENTS, index=(["All"] + SEGMENTS).index(st.query_params.get("segment", "All")) if st.query_params.get("segment", "All") in ["All"] + SEGMENTS else 0)
    st.markdown("---")
    scenario = st.slider("What-if price change (%)", -20, 30, 0, 5)
    st.markdown("Applies to the projection on the Trends tab only.")

sync_param("period", period)
sync_param("region", region)
sync_param("segment", segment)

last = df["date"].max()
months = PERIODS[period]
start = last - pd.DateOffset(months=months) if months < 120 else df["date"].min()
view = df[df["date"] >= start]
if region != "All":
    view = view[view["region"] == region]
if segment != "All":
    view = view[view["segment"] == segment]

prev_start = start - (last - start)
previous = df[(df["date"] >= prev_start) & (df["date"] < start)]
if region != "All":
    previous = previous[previous["region"] == region]
if segment != "All":
    previous = previous[previous["segment"] == segment]

if view.empty:
    st.warning("No records match these filters.")
    st.stop()


def delta(current, prior, fmt="int"):
    if not prior or prior == 0:
        return None
    pct = 100 * (current - prior) / prior
    return f"{pct:+.1f}% vs previous period"


rev, prev_rev = view["revenue"].sum(), previous["revenue"].sum()
vol, prev_vol = view["volume"].sum(), previous["volume"].sum()
people, prev_people = view["people"].sum(), previous["people"].sum()
sat, prev_sat = view["satisfaction"].mean(), previous["satisfaction"].mean() if len(previous) else 0

k1, k2, k3, k4 = st.columns(4)
k1.metric("Revenue", f"UGX {rev / 1e9:,.2f}B", delta(rev, prev_rev))
k2.metric("Volume", f"{vol / 1000:,.1f} t", delta(vol, prev_vol))
k3.metric("People reached", f"{people:,}", delta(people, prev_people))
k4.metric("Satisfaction", f"{sat:.2f} / 5", delta(sat, prev_sat))

st.markdown(f'<p style="font-size:0.85rem;">Showing {len(view):,} records from {start:%d %b %Y} to {last:%d %b %Y}. '
            f'Deep link: <code>?period={period}&amp;region={region}&amp;segment={segment}</code></p>', unsafe_allow_html=True)

tabs = st.tabs(["Overview", "Segments", "Trends", "Data & method"])

with tabs[0]:
    monthly = view.groupby("month", as_index=False).agg(revenue=("revenue", "sum"), volume=("volume", "sum"))
    left, right = st.columns([3, 2])
    with left:
        st.subheader("Revenue and volume over time")
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=monthly["month"], y=monthly["revenue"] / 1e6,
                                 mode="lines+markers", name="Revenue (UGX M)", line={"color": BLUE}))
        fig.add_trace(go.Bar(x=monthly["month"], y=monthly["volume"] / 1000,
                             name="Volume (t)", marker_color=VIOLET, yaxis="y2", opacity=0.55))
        fig.update_layout(yaxis2={"overlaying": "y", "side": "right", "showgrid": False},
                          legend={"orientation": "h"})
        st.plotly_chart(chart_layout(fig, 430), width="stretch")
    with right:
        st.subheader("Channel mix")
        mix = view.groupby("channel", as_index=False)["revenue"].sum()
        fig = px.pie(mix, names="channel", values="revenue", hole=0.55, color_discrete_sequence=SERIES)
        st.plotly_chart(chart_layout(fig, 430), width="stretch")

    st.subheader("Region performance")
    by_region = view.groupby("region", as_index=False).agg(revenue=("revenue", "sum"), people=("people", "sum"))
    fig = px.bar(by_region, x="region", y="revenue", color="region", color_discrete_sequence=SERIES,
                 labels={"revenue": "Revenue (UGX)"})
    st.plotly_chart(chart_layout(fig, 330), width="stretch")

with tabs[1]:
    st.subheader("Segment and product cut")
    seg = view.groupby(["segment", "product"], as_index=False)["revenue"].sum()
    left, right = st.columns(2)
    with left:
        fig = px.bar(seg, x="segment", y="revenue", color="product", barmode="stack",
                     color_discrete_sequence=[BLUE, GREEN], labels={"revenue": "Revenue (UGX)"})
        st.plotly_chart(chart_layout(fig), width="stretch")
    with right:
        fig = px.box(view, x="segment", y="satisfaction", color="segment",
                     color_discrete_sequence=SERIES, labels={"satisfaction": "Satisfaction (1-5)"})
        st.plotly_chart(chart_layout(fig), width="stretch")

    st.subheader("Region × month revenue")
    heat = view.groupby(["region", "month"], as_index=False)["revenue"].sum()
    fig = px.density_heatmap(heat, x="month", y="region", z="revenue", color_continuous_scale=[[0, RED], [1, BLUE]])
    st.plotly_chart(chart_layout(fig, 400), width="stretch")

with tabs[2]:
    st.subheader("Trend and scenario")
    trend = view.groupby("month", as_index=False)["revenue"].sum().sort_values("month")
    trend["ma3"] = trend["revenue"].rolling(3, min_periods=1).mean()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=trend["month"], y=trend["revenue"] / 1e6, name="Monthly", line={"color": BLUE}))
    fig.add_trace(go.Scatter(x=trend["month"], y=trend["ma3"] / 1e6, name="3-month average", line={"color": GREEN, "dash": "dash"}))
    st.plotly_chart(chart_layout(fig, 380), width="stretch")

    projected = trend["ma3"].iloc[-1] * (1 + scenario / 100)
    st.markdown(f"**Scenario at {scenario:+d}% price change:** next month ≈ UGX {projected / 1e6:,.1f}M")
    st.progress(min(1.0, max(0.0, (scenario + 20) / 50)))

with tabs[3]:
    st.subheader("Filtered records")
    st.dataframe(view[["date", "region", "segment", "channel", "product", "volume", "revenue"]].head(300),
                 hide_index=True, width="stretch")
    st.download_button("Download filtered CSV", data=view.to_csv(index=False).encode("utf-8"),
                       file_name="advanced_demo_filtered.csv", mime="text/csv")
    st.markdown("**Method.** All rows are generated in memory from a fixed seed. "
                "There is no database, upload or client data. Revenue and volume are synthetic.")

st.markdown("---")
st.markdown("Public demo · synthetic data only · built with Streamlit and Plotly")
