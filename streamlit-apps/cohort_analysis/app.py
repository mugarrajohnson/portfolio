"""
Cohort analysis — public Streamlit demo.

Synthetic programme cohorts followed for twelve months: retention curves,
a cohort-by-month heatmap, completion rates and outcomes. All members and
figures are invented; no client or participant information is used.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(
    page_title="Cohort Analysis ",
    page_icon="📊",
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
PROGRAMS = ["Livelihoods", "Skills"]
COHORTS = [f"{y} Q{q}" for y in (2024, 2025) for q in (1, 2, 3, 4)]
MONTHS = list(range(0, 13))


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    rng = np.random.default_rng(20251203)
    rows = []
    for i, cohort in enumerate(COHORTS):
        program = PROGRAMS[i % len(PROGRAMS)]
        enrolled = int(rng.integers(140, 300))
        decay = rng.uniform(0.018, 0.038)
        outcome0 = rng.uniform(28, 38)
        growth = rng.uniform(2.0, 3.4) + (0.5 if program == "Skills" else 0)
        for month in MONTHS:
            retained = int(round(enrolled * np.exp(-decay * month)))
            outcome = min(100, outcome0 + growth * month + rng.normal(0, 0.8))
            rows.append({
                "cohort": cohort, "program": program, "month": month,
                "enrolled": enrolled, "retained": retained,
                "retention_pct": round(100 * retained / enrolled, 1),
                "outcome": round(float(outcome), 1),
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

st.title("Cohort analysis ")
st.write(
    "A public demonstration of cohort tracking: retention over twelve months"
)

with st.sidebar:
    st.header("Filters")
    program = st.selectbox("Programme", ["All"] + PROGRAMS)
    cohorts = st.multiselect("Cohorts", COHORTS, default=COHORTS)

view = df[df["cohort"].isin(cohorts)]
if program != "All":
    view = view[view["program"] == program]

if view.empty:
    st.warning("No cohorts match these filters.")
    st.stop()

final = view[view["month"] == 12]
enrolled = final["enrolled"].sum()
retained = final["retained"].sum()
completion = 100 * retained / enrolled if enrolled else 0.0
outcome = final["outcome"].mean()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Cohorts", str(final["cohort"].nunique()))
c2.metric("Members enrolled", f"{enrolled:,}")
c3.metric("12-month retention", f"{completion:.1f}%")
c4.metric("Mean outcome at month 12", f"{outcome:.1f}")

if completion >= 70:
    st.success(f"Completion: {completion:.1f}% of enrolled members were still active at month 12.")
else:
    st.error(f"Completion: {completion:.1f}% of enrolled members were still active at month 12.")

st.markdown("---")
st.subheader("Retention by cohort and month")
matrix = view.pivot(index="cohort", columns="month", values="retention_pct")
fig = px.imshow(matrix, aspect="auto", labels={"x": "Month", "y": "Cohort", "color": "Retained %"},
                color_continuous_scale=[[0, RED], [0.5, BLUE], [1, GREEN]], origin="lower")
st.plotly_chart(chart_layout(fig), width="stretch")

left, right = st.columns(2)
with left:
    st.subheader("Retention curves")
    fig = px.line(view, x="month", y="retention_pct", color="cohort",
                  color_discrete_sequence=[BLUE, GREEN, RED, VIOLET, BLUE, GREEN, RED, VIOLET],
                  labels={"retention_pct": "Retained %", "month": "Month"})
    st.plotly_chart(chart_layout(fig), width="stretch")

with right:
    st.subheader("Completion by cohort")
    fig = px.bar(final.sort_values("cohort"), x="cohort", y="retention_pct",
                 color_discrete_sequence=[GREEN],
                 labels={"retention_pct": "Retained at month 12 (%)", "cohort": "Cohort"})
    st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.subheader("Outcome by cohort over time")
fig = px.line(view, x="month", y="outcome", color="cohort",
              color_discrete_sequence=[BLUE, GREEN, RED, VIOLET, BLUE, GREEN, RED, VIOLET],
              labels={"outcome": "Outcome score", "month": "Month"})
st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.markdown('<p style="font-size:0.85rem;">Public demo built with Streamlit and Plotly</p>', unsafe_allow_html=True)
