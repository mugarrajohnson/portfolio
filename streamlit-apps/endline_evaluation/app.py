"""
Endline evaluation — public Streamlit demo.

Baseline / midline / endline results for a synthetic livelihood project in
Northern Uganda, reported against the six OECD-DAC evaluation criteria and
the disaggregations donors expect (sex, age, disability). All figures are
invented; no client or beneficiary information is used.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(
    page_title="Endline Evaluation ",
    page_icon="📈",
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
    </style>
    """,
    unsafe_allow_html=True,
)

BLUE = "#2E7DFF"
GREEN = "#00B050"
RED = "#FF4D2E"
INK = "#000000"
VIOLET = "#9B30FF"  # sharp fourth series colour, visible on light and dark

DISTRICTS = ["Gulu", "Kitgum", "Pader", "Amuru", "Nwoya"]
GROUPS = ["All", "Female", "Male", "Youth (15-35)", "Adult (36+)", "Persons with disabilities"]
# (baseline, target, direction). Direction "decrease" means lower is better.
INDICATORS = {
    "Income adequacy (% of living income)": (34, 60, "increase"),
    "Food security score (0-100)": (38, 65, "increase"),
    "School attendance (%)": (61, 85, "increase"),
    "Savings group participation (%)": (22, 55, "increase"),
    "Food insecurity score (0-100, lower is better)": (64, 35, "decrease"),
    "Debt distress (% of households, lower is better)": (49, 24, "decrease"),
}
# One line per indicator: four sharp colours, dashed where lower is better.
LINE_STYLE = {
    "Income adequacy (% of living income)": (BLUE, "solid"),
    "Food security score (0-100)": (GREEN, "solid"),
    "School attendance (%)": (RED, "solid"),
    "Savings group participation (%)": (VIOLET, "solid"),
    "Food insecurity score (0-100, lower is better)": (BLUE, "dash"),
    "Debt distress (% of households, lower is better)": (RED, "dash"),
}
# How much of the gap to target each indicator closes: above 1 = target met.
ATTAINMENT = {
    "Income adequacy (% of living income)": 1.06,
    "Food security score (0-100)": 0.92,
    "School attendance (%)": 1.02,
    "Savings group participation (%)": 0.88,
    "Food insecurity score (0-100, lower is better)": 1.05,
    "Debt distress (% of households, lower is better)": 0.94,
}
# (baseline disadvantage, extra endline gain) — positive values always help the group.
GROUP_SHIFT = {
    "All": (0, 0),
    "Female": (4, 3),
    "Male": (-3, -1),
    "Youth (15-35)": (-2, 5),
    "Adult (36+)": (1, 0),
    "Persons with disabilities": (7, -2),
}
PHASES = ["Baseline", "Midline", "Endline"]
ROUND_DATES = {
    "Baseline": "2024-03-01",
    "Midline": "2025-03-01",
    "Endline": "2026-03-01",
}
UNITS = {
    "Income adequacy (% of living income)": "%",
    "Food security score (0-100)": " pts",
    "School attendance (%)": "%",
    "Savings group participation (%)": "%",
    "Food insecurity score (0-100, lower is better)": " pts",
    "Debt distress (% of households, lower is better)": "%",
}

DAC = [
    ("Relevance", 4.6, "Objectives still match the priorities of the people supported."),
    ("Coherence", 4.2, "Activities fit with neighbouring programmes and district plans."),
    ("Effectiveness", 4.4, "Most indicators reached or approached their targets."),
    ("Efficiency", 3.8, "Outputs were delivered, but some costs rose in the final year."),
    ("Impact", 4.1, "Measured gains exceed what a comparison group achieved."),
    ("Sustainability", 3.9, "Results are likely to persist; follow-up financing is still needed."),
]


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    rng = np.random.default_rng(20260411)
    rows = []
    for district in DISTRICTS:
        d_shift = rng.integers(-3, 4)
        for indicator, (base, target, direction) in INDICATORS.items():
            sign = 1 if direction == "increase" else -1
            for group in GROUPS:
                disadvantage, extra_gain = GROUP_SHIFT[group]
                # A disadvantage always starts the group further from the target:
                # lower for "higher is better" indicators, higher for the reverse.
                b = np.clip(base - sign * disadvantage - sign * d_shift + rng.normal(0, 1.5), 0, 100)
                e = np.clip(b + sign * (ATTAINMENT[indicator] * abs(target - b) + extra_gain) + rng.normal(0, 1.5), 0, 100)
                m = b + (e - b) * rng.uniform(0.42, 0.58)
                for phase, value in zip(PHASES, [b, m, e]):
                    rows.append({
                        "district": district,
                        "group": group,
                        "indicator": indicator,
                        "phase": phase,
                        "value": round(float(value), 1),
                        "target": target,
                        "direction": direction,
                    })
    return pd.DataFrame(rows)


def chart_layout(fig):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font={"color": INK, "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        hoverlabel={"bgcolor": BLUE, "font": {"color": "#FFFFFF"}},
    )
    fig.update_xaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    return fig


df = build_data()

st.title("Endline evaluation ")
st.write(
    "A public demonstration of baseline, midline and endline reporting against the "
    "**six OECD-DAC criteria**, with sex, age and disability disaggregations. "
)

with st.sidebar:
    st.header("Filters")
    district = st.selectbox("District", ["All districts"] + DISTRICTS)
    group = st.selectbox("Disaggregation", GROUPS)
    selected_indicators = st.multiselect("Indicators", list(INDICATORS), default=list(INDICATORS))

view = df if district == "All districts" else df[df["district"] == district]
view = view[view["group"] == group]
view = view[view["indicator"].isin(selected_indicators)]

if view.empty:
    st.warning("No indicators selected.")
    st.stop()

line = view.groupby(["indicator", "phase"], as_index=False)["value"].mean()
pivot = line.pivot(index="indicator", columns="phase", values="value").reset_index()
meta = view.groupby("indicator", as_index=False)[["target", "direction"]].first()
summary = pivot.merge(meta, on="indicator")
# Improvement is always the move toward the target, whatever the direction.
summary["change"] = np.where(
    summary["direction"] == "increase",
    summary["Endline"] - summary["Baseline"],
    summary["Baseline"] - summary["Endline"],
)

overall = summary.copy()
overall["met"] = np.where(
    overall["direction"] == "increase",
    overall["Endline"] >= overall["target"],
    overall["Endline"] <= overall["target"],
)
met = int(overall["met"].sum())
total = len(overall)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Beneficiaries (synthetic)", "2,400")
c2.metric("Indicators tracked", str(total))
c3.metric("Targets met", f"{met} of {total}")
c4.metric("Average change", f"+{summary['change'].mean():.1f} pts")

if met == total:
    st.success("Verdict: targets met across all indicators.")
elif met == 0:
    st.error("Verdict: no targets met.")
else:
    st.info("Verdict: partial success — some targets met.")

st.markdown("---")
long = summary.melt(id_vars="indicator", value_vars=PHASES, var_name="Phase", value_name="Score")
long["direction"] = long["indicator"].map(lambda i: INDICATORS[i][2])
long["round_date"] = pd.to_datetime(long["Phase"].map(ROUND_DATES))
long["Label"] = [
    f"{score:.1f}{UNITS[indicator]}"
    for score, indicator in zip(long["Score"], long["indicator"])
]
with st.container():
    st.subheader("Indicator trajectories by survey date")
    fig = px.line(
        long,
        x="round_date",
        y="Score",
        color="indicator",
        line_dash="direction",
        markers=True,
        text="Label",
        color_discrete_map={i: LINE_STYLE[i][0] for i in INDICATORS},
        line_dash_map={"increase": "solid", "decrease": "dash"},
        labels={"Score": "Indicator value (0-100)", "round_date": "Survey date", "indicator": "Indicator"},
    )
    fig.update_traces(textposition="top center", textfont_size=9)
    fig = chart_layout(fig)
    fig.update_xaxes(tickformat="%d %b %Y")
    st.plotly_chart(fig, width="stretch")
    st.markdown(
        '<p style="">'
        "Solid lines: higher is better. Dashed lines: lower is better. "
        "Each line follows one indicator across the three survey dates; the label on every point is its value."
        "</p>",
        unsafe_allow_html=True,
    )

left, right = st.columns(2)
with left:
    st.subheader("Endline against target")
    prog = summary.melt(id_vars="indicator", value_vars=["Endline", "target"],
                        var_name="Series", value_name="Score")
    fig = px.bar(prog, x="indicator", y="Score", color="Series", barmode="group",
                 color_discrete_sequence=[GREEN, VIOLET],
                 labels={"indicator": "Indicator", "Score": "Score (0-100)"})
    st.plotly_chart(chart_layout(fig), width="stretch")

with right:
    st.subheader("Endline by disaggregation")
    by_group = (
        view[view["phase"] == "Endline"]
        .groupby(["indicator", "group"], as_index=False)["value"].mean()
    )
    selected = st.selectbox("Indicator", [i for i in INDICATORS if i in selected_indicators], key="group_indicator")
    fig = px.bar(by_group[by_group["indicator"] == selected], x="group", y="value",
                 color_discrete_sequence=[BLUE],
                 labels={"value": "Endline score", "group": "Group"})
    st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.subheader("OECD-DAC criteria")
dac_df = pd.DataFrame(DAC, columns=["Criterion", "Score", "Finding"])
fig = px.bar(dac_df, x="Criterion", y="Score", range_y=[0, 5],
             color=dac_df["Score"].apply(lambda s: GREEN if s >= 4 else RED),
             color_discrete_map={GREEN: GREEN, RED: RED},
             labels={"Score": "Score (1-5)"})
st.plotly_chart(chart_layout(fig), width="stretch")
for criterion, score, note in DAC:
    st.markdown(f"**{criterion} — {score:.1f}/5.** {note}")

st.markdown("---")
st.markdown('<p style="font-size:0.85rem;">Public demo built with Streamlit and Plotly</p>', unsafe_allow_html=True)
