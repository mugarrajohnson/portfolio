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

DISTRICTS = ["Gulu", "Kitgum", "Pader", "Amuru", "Nwoya"]
GROUPS = ["All", "Female", "Male", "Youth (15-35)", "Adult (36+)", "Persons with disabilities"]
INDICATORS = {
    "Income adequacy (% of living income)": (34, 60),
    "Food security score (0-100)": (38, 65),
    "School attendance (%)": (61, 85),
    "Access to clean water (%)": (45, 80),
    "Savings group participation (%)": (22, 55),
    "Livelihood diversity index (0-100)": (30, 58),
}
GROUP_SHIFT = {
    "All": (0, 0),
    "Female": (-4, 3),
    "Male": (3, -1),
    "Youth (15-35)": (2, 5),
    "Adult (36+)": (-1, 0),
    "Persons with disabilities": (-7, -2),
}
PHASES = ["Baseline", "Midline", "Endline"]

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
        for indicator, (base, target) in INDICATORS.items():
            for group in GROUPS:
                gb, ge = GROUP_SHIFT[group]
                b = np.clip(base + gb + d_shift + rng.normal(0, 1.5), 0, 100)
                e = np.clip(base + gb + ge + d_shift + rng.normal(0, 1.5), 0, 100)
                m = b + (e - b) * rng.uniform(0.42, 0.58)
                for phase, value in zip(PHASES, [b, m, e]):
                    rows.append({
                        "district": district,
                        "group": group,
                        "indicator": indicator,
                        "phase": phase,
                        "value": round(float(value), 1),
                        "target": target,
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

st.title("Endline evaluation ")
st.write(
    "A public demonstration of baseline, midline and endline reporting against the "
    "**six OECD-DAC criteria**, with sex, age and disability disaggregations. "
)

with st.sidebar:
    st.header("Filters")
    district = st.selectbox("District", ["All districts"] + DISTRICTS)
    group = st.selectbox("Disaggregation", GROUPS)

view = df if district == "All districts" else df[df["district"] == district]
view = view[view["group"] == group]

line = view.groupby(["indicator", "phase"], as_index=False)["value"].mean()
pivot = line.pivot(index="indicator", columns="phase", values="value").reset_index()
targets = view.groupby("indicator", as_index=False)["target"].first()
summary = pivot.merge(targets, on="indicator")
summary["change"] = summary["Endline"] - summary["Baseline"]

overall = summary.copy()
overall["met"] = overall["Endline"] >= overall["target"]
met = int(overall["met"].sum())
total = len(overall)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Beneficiaries (synthetic)", "2,400")
c2.metric("Indicators tracked", str(total))
c3.metric("Targets met", f"{met} of {total}")
c4.metric("Average change", f"+{summary['change'].mean():.1f} pts")

if met == total:
    st.markdown('<p style="color:#008F3D;font-weight:700;">Verdict: targets met across all indicators.</p>', unsafe_allow_html=True)
elif met == 0:
    st.markdown('<p style="color:#D11A00;font-weight:700;">Verdict: no targets met.</p>', unsafe_allow_html=True)
else:
    st.markdown('<p style="color:#0057D9;font-weight:700;">Verdict: partial success — some targets met.</p>', unsafe_allow_html=True)

st.markdown("---")
long = line.melt(id_vars="indicator", var_name="Phase", value_name="Score")
with st.container():
    st.subheader("Baseline, midline and endline by indicator")
    fig = px.bar(long, x="indicator", y="Score", color="Phase", barmode="group",
                 color_discrete_sequence=[INK, BLUE, GREEN],
                 labels={"indicator": "Indicator", "Score": "Score (0-100)"})
    st.plotly_chart(chart_layout(fig), width="stretch")

left, right = st.columns(2)
with left:
    st.subheader("Endline against target")
    prog = summary.melt(id_vars="indicator", value_vars=["Endline", "target"],
                        var_name="Series", value_name="Score")
    fig = px.bar(prog, x="indicator", y="Score", color="Series", barmode="group",
                 color_discrete_sequence=[GREEN, INK],
                 labels={"indicator": "Indicator", "Score": "Score (0-100)"})
    st.plotly_chart(chart_layout(fig), width="stretch")

with right:
    st.subheader("Endline by disaggregation")
    by_group = (
        view[view["phase"] == "Endline"]
        .groupby(["indicator", "group"], as_index=False)["value"].mean()
    )
    selected = st.selectbox("Indicator", list(INDICATORS), key="group_indicator")
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
    colour = GREEN if score >= 4 else RED
    st.markdown(f'<p style="color:{colour};"><strong>{criterion} — {score:.1f}/5.</strong> {note}</p>', unsafe_allow_html=True)

st.markdown("---")
st.markdown('<p style="color:#000000;font-size:0.85rem;">Public demo built with Streamlit and Plotly</p>', unsafe_allow_html=True)
