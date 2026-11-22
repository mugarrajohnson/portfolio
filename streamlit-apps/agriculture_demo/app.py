"""
Vanilla Value Chain — public Streamlit demo.

All rows are generated in memory from a fixed seed. There is no database,
no upload, and no client, farmer or beneficiary information in this app.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st
st.set_page_config(
    page_title="Vanilla Value Chain",
    page_icon="🌱",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Black text, black rules, sharp accents. No grey copy anywhere.
st.markdown(
    """
    <style>
      .stApp { background: #FFFFFF; color: #000000; }
      h1, h2, h3, h4, p, li, label, span, div { color: #000000; }
      [data-testid="stSidebar"] { background: #FFFFFF; border-right: 2px solid #000000; }
      [data-testid="stMetric"] { border: 2px solid #000000; border-radius: 0; padding: 14px; }
      [data-testid="stMetricLabel"], [data-testid="stMetricValue"] { color: #000000; }
      hr { border-color: #000000; }
      .stButton > button { border: 2px solid #000000; color: #000000; background: #FFFFFF; border-radius: 0; }
    </style>
    """,
    unsafe_allow_html=True,
)

BLUE = "#0057D9"
GREEN = "#008F3D"
RED = "#D11A00"
INK = "#000000"
PALETTE = [BLUE, GREEN, RED, INK]

MONTHS = pd.date_range("2023-01-01", "2025-12-31", freq="D")
REGIONS = {
    "West": ["Masindi", "Kikuube", "Hoima", "Kibaale"],
    "Central": ["Kayunga", "Luuka", "Iganga", "Buyende"],
    "East": ["Mbale", "Sironko", "Kapchorwa", "Bududa"],
}
GRADES = ["Long", "Short", "Split"]


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    """Synthetic purchase receipts. Seeded so every visitor sees the same data."""
    rng = np.random.default_rng(20240517)
    n = 6000
    dates = rng.choice(MONTHS, size=n)
    region = rng.choice(list(REGIONS), size=n, p=[0.55, 0.30, 0.15])
    district = [rng.choice(REGIONS[r]) for r in region]
    grade = rng.choice(GRADES, size=n, p=[0.45, 0.40, 0.15])
    kg = np.round(rng.gamma(shape=2.2, scale=95, size=n), 1)
    price = np.where(grade == "Long", 7200, np.where(grade == "Short", 6100, 5400))
    ugx = np.round(kg * price * rng.uniform(0.85, 1.15, size=n), 0)
    season = np.where((pd.to_datetime(dates).month.isin([6, 7])), "Jun/Jul", "Dec/Jan")
    return pd.DataFrame(
        {
            "date": dates,
            "year": pd.to_datetime(dates).year,
            "month": pd.to_datetime(dates).to_period("M").astype(str),
            "region": region,
            "district": district,
            "grade": grade,
            "kg": kg,
            "ugx": ugx,
            "farmer_id": [f"F-{i:05d}" for i in range(1, n + 1)],
            "season": season,
        }
    )


def chart_layout(fig):
    fig.update_layout(
        paper_bgcolor="#FFFFFF",
        plot_bgcolor="#FFFFFF",
        font={"color": INK, "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        hoverlabel={"bgcolor": INK, "font": {"color": "#FFFFFF"}},
    )
    fig.update_xaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    return fig


df = build_data()

st.title("Vanilla value chain")
st.write(
    "A public demonstration of the kind of dashboard built for agricultural data. "
)

with st.sidebar:
    st.header("Filters")
    years = st.multiselect("Year", sorted(df["year"].unique()), default=sorted(df["year"].unique()))
    regions = st.multiselect("Region", sorted(df["region"].unique()), default=sorted(df["region"].unique()))
    grades = st.multiselect("Grade", GRADES, default=GRADES)

view = df[df["year"].isin(years) & df["region"].isin(regions) & df["grade"].isin(grades)]

if view.empty:
    st.warning("No records match these filters. Widen the selection in the sidebar.")
    st.stop()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Records", f"{len(view):,}")
c2.metric("Farmers", f"{view['farmer_id'].nunique():,}")
c3.metric("Vanilla", f"{view['kg'].sum() / 1000:,.1f} t")
c4.metric("Value", f"UGX {view['ugx'].sum() / 1e9:,.2f}B")

st.markdown("---")
left, right = st.columns(2)

monthly = view.groupby(["month", "grade"], as_index=False)["kg"].sum()
with left:
    st.subheader("Volume delivered by month and grade")
    fig = px.bar(monthly, x="month", y="kg", color="grade", barmode="stack",
                 color_discrete_sequence=PALETTE, labels={"kg": "kg delivered", "month": "Month"})
    st.plotly_chart(chart_layout(fig), width="stretch")

season = view.groupby("season", as_index=False)["ugx"].sum()
with right:
    st.subheader("Purchase value by season")
    fig = px.bar(season, x="season", y="ugx", color_discrete_sequence=[BLUE],
                 labels={"ugx": "UGX", "season": "Season"})
    st.plotly_chart(chart_layout(fig), width="stretch")

left, right = st.columns(2)
districts = view.groupby("district", as_index=False)["kg"].sum().sort_values("kg", ascending=False)
with left:
    st.subheader("Deliveries by district")
    fig = px.bar(districts, x="kg", y="district", orientation="h", color_discrete_sequence=[GREEN],
                 labels={"kg": "kg delivered", "district": "District"})
    st.plotly_chart(chart_layout(fig), width="stretch")

grade_mix = view.groupby("grade", as_index=False)["kg"].sum()
with right:
    st.subheader("Grade mix")
    fig = px.pie(grade_mix, names="grade", values="kg", hole=0.55,
                 color_discrete_sequence=PALETTE)
    st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.markdown(
    '<p style="color:#000000;font-size:0.85rem;">'
    "Public demo built with Streamlit and Plotly</p>",
    unsafe_allow_html=True,
)
