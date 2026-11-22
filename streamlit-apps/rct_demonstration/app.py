"""
Randomised trial — public Streamlit demo.

A synthetic two-arm randomised evaluation: baseline balance, endline means,
difference-in-differences with a confidence interval, and attrition. All
participants and outcomes are invented; no client or beneficiary data is used.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

st.set_page_config(
    page_title="RCT Demonstration ",
    page_icon="🧪",
    layout="wide",
    initial_sidebar_state="collapsed",
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
      [data-testid="stButton"] button, .stButton > button { border: 2px solid currentColor; border-radius: 0; }
      hr { border-color: currentColor; }
      /* No sidebar: all controls live in the top toolbar. */
      [data-testid="stSidebar"], [data-testid="stSidebarCollapsedControl"] { display: none !important; }
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
DISTRICTS = ["Gulu", "Kitgum", "Pader", "Amuru"]


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    rng = np.random.default_rng(20250614)
    n = 1800
    arm = rng.choice(["Treatment", "Control"], size=n, p=[0.5, 0.5])
    district = rng.choice(DISTRICTS, size=n)
    female = rng.choice(["Female", "Male"], size=n, p=[0.52, 0.48])
    age = np.round(rng.normal(31, 9, size=n), 0)
    baseline = np.clip(rng.normal(35, 9, size=n), 0, 100)
    effect = np.where(arm == "Treatment", 11.5, 0.0)
    d_effect = np.where(np.isin(district, ["Gulu", "Kitgum"]), 1.5, -0.5)
    endline = np.clip(baseline + effect + d_effect + rng.normal(0, 7, size=n), 0, 100)
    retained = rng.random(size=n) > np.where(arm == "Treatment", 0.07, 0.09)
    return pd.DataFrame({
        "id": [f"P-{i:05d}" for i in range(1, n + 1)],
        "arm": arm, "district": district, "sex": female, "age": age,
        "baseline": np.round(baseline, 1), "endline": np.round(endline, 1),
        "retained": retained,
    })


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

st.title("Randomised trial ")
st.write(
    "A public demonstration of a two-arm randomised evaluation: baseline balance, "
    "difference-in-differences, uncertainty and attrition. "
)

c1, c2 = st.columns([2, 2])
with c1:
    district = st.selectbox("District", ["All districts"] + DISTRICTS)
with c2:
    retained_only = st.checkbox("Analyse retained participants only", value=True)
st.markdown("---")

view = df if district == "All districts" else df[df["district"] == district]
if retained_only:
    view = view[view["retained"]]

if view.empty or view["arm"].nunique() < 2:
    st.warning("No comparison available for this selection.")
    st.stop()

analysis = view.copy()
analysis["change"] = analysis["endline"] - analysis["baseline"]
t = analysis[analysis["arm"] == "Treatment"]["change"]
c = analysis[analysis["arm"] == "Control"]["change"]
did = float(t.mean() - c.mean())
se = math.sqrt(t.var(ddof=1) / len(t) + c.var(ddof=1) / len(c))
lo, hi = did - 1.96 * se, did + 1.96 * se
pvalue = math.erfc(abs(did / se) / math.sqrt(2)) if se > 0 else 1.0
attrition = 100.0 * (1 - df["retained"].mean()) if district == "All districts" else 100.0 * (1 - df[df["district"] == district]["retained"].mean())

c1, c2, c3, c4 = st.columns(4)
c1.metric("Participants analysed", f"{len(view):,}")
c2.metric("Treatment effect (DiD)", f"{did:+.1f} pts")
c3.metric("p-value", f"{pvalue:.3f}")
c4.metric("Attrition", f"{attrition:.1f}%")

if pvalue < 0.05 and did > 0:
    st.success("Result: a statistically significant positive effect.")
elif pvalue < 0.05 and did < 0:
    st.error("Result: a statistically significant negative effect.")
else:
    st.info("Result: no statistically significant effect detected.")

st.markdown("---")
left, right = st.columns(2)

long = analysis.melt(id_vars="arm", value_vars=["baseline", "endline"], var_name="Phase", value_name="Outcome")
with left:
    st.subheader("Outcome by arm, baseline and endline")
    fig = px.bar(long, x="Phase", y="Outcome", color="arm", barmode="group",
                 color_discrete_sequence=[BLUE, GREEN],
                 labels={"Outcome": "Outcome score (0-100)", "Phase": "Round"})
    st.plotly_chart(chart_layout(fig), width="stretch")

with right:
    st.subheader("Difference-in-differences")
    fig = go.Figure(go.Bar(
        x=["Treatment minus control"], y=[did],
        error_y={"type": "data", "array": [1.96 * se], "visible": True},
        marker_color=GREEN if did > 0 else RED,
    ))
    fig.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                      font={"color": INK}, yaxis_title="Change in outcome (points)",
                      margin={"l": 10, "r": 10, "t": 10, "b": 10})
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    st.plotly_chart(fig, width="stretch")
    st.markdown(f'<p style="">95% confidence interval: {lo:+.1f} to {hi:+.1f} points.</p>', unsafe_allow_html=True)

left, right = st.columns(2)
with left:
    st.subheader("Outcome distribution by arm")
    fig = px.histogram(analysis, x="endline", color="arm", barmode="overlay", opacity=0.6,
                       color_discrete_sequence=[BLUE, GREEN],
                       labels={"endline": "Endline outcome"})
    st.plotly_chart(chart_layout(fig), width="stretch")

with right:
    st.subheader("Baseline balance")
    balance = analysis.groupby("arm", as_index=False).agg(
        Age=("age", "mean"), Female_pct=("sex", lambda s: 100 * (s == "Female").mean()),
        Baseline=("baseline", "mean")).round(1)
    st.dataframe(balance, hide_index=True, width="stretch")
    st.markdown('<p style="">Baseline characteristics should be close across arms in a well-randomised trial.</p>', unsafe_allow_html=True)

st.markdown("---")
st.markdown('<p style="font-size:0.85rem;">Public demo built with Streamlit and Plotly</p>', unsafe_allow_html=True)
