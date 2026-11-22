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
      .stApp { background: #FFFFFF; color: #000000; }
      h1, h2, h3, h4, p, li, label, span, div { color: #000000; }
      [data-testid="stSidebar"] { background: #FFFFFF; border-right: 2px solid #000000; }
      [data-testid="stMetric"] { border: 2px solid #000000; border-radius: 0; padding: 14px; }
      [data-testid="stMetricLabel"], [data-testid="stMetricValue"] { color: #000000; }
      hr { border-color: #000000; }
    </style>
    """,
    unsafe_allow_html=True,
)

BLUE = "#0057D9"
GREEN = "#008F3D"
RED = "#D11A00"
INK = "#000000"
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
        paper_bgcolor="#FFFFFF", plot_bgcolor="#FFFFFF",
        font={"color": INK, "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        hoverlabel={"bgcolor": INK, "font": {"color": "#FFFFFF"}},
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
colour = GREEN if completion >= 70 else RED

c1, c2, c3, c4 = st.columns(4)
c1.metric("Cohorts", str(final["cohort"].nunique()))
c2.metric("Members enrolled", f"{enrolled:,}")
c3.metric("12-month retention", f"{completion:.1f}%")
c4.metric("Mean outcome at month 12", f"{outcome:.1f}")

st.markdown(f'<p style="color:{colour};font-weight:700;">Completion: {completion:.1f}% of enrolled members were still active at month 12.</p>', unsafe_allow_html=True)

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
                  color_discrete_sequence=[BLUE, GREEN, RED, INK, BLUE, GREEN, RED, INK],
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
              color_discrete_sequence=[BLUE, GREEN, RED, INK, BLUE, GREEN, RED, INK],
              labels={"outcome": "Outcome score", "month": "Month"})
st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.markdown('<p style="color:#000000;font-size:0.85rem;">Public demo built with Streamlit and Plotly</p>', unsafe_allow_html=True)
