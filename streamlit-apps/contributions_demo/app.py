"""
Contributions Analytics — public Streamlit demo.

All rows are generated in memory from a fixed seed. There is no database,
no upload, and no donor, client or beneficiary information in this app.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(
    page_title="Contributions Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Black text, black rules, sharp accents. No grey copy anywhere.
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
PALETTE = [BLUE, GREEN, RED, VIOLET]

SECTORS = ["Health", "Education", "WASH", "Nutrition", "Protection"]
DONORS = [f"Donor {c}" for c in "ABCDEF"]
STATUSES = ["Paid", "Partial", "Pending"]
DATES = pd.date_range("2023-01-01", "2025-12-31", freq="D")


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    """Synthetic contributions. Seeded so every visitor sees the same data."""
    rng = np.random.default_rng(20231109)
    n = 4200
    dates = rng.choice(DATES, size=n)
    sectors = rng.choice(SECTORS, size=n, p=[0.30, 0.25, 0.20, 0.15, 0.10])
    donors = rng.choice(DONORS, size=n)
    status = rng.choice(STATUSES, size=n, p=[0.66, 0.19, 0.15])
    pledge = np.round(rng.lognormal(mean=8.2, sigma=1.1, size=n), 0)
    paid_ratio = np.where(status == "Paid", rng.uniform(0.97, 1.0, size=n),
                          np.where(status == "Partial", rng.uniform(0.25, 0.75, size=n),
                                   rng.uniform(0.0, 0.05, size=n)))
    paid = np.round(pledge * paid_ratio, 0)
    return pd.DataFrame(
        {
            "date": dates,
            "year": pd.to_datetime(dates).year,
            "month": pd.to_datetime(dates).to_period("M").astype(str),
            "sector": sectors,
            "donor": donors,
            "status": status,
            "pledge_usd": pledge,
            "paid_usd": paid,
        }
    )


def chart_layout(fig):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"color": INK, "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        height=340,
        hoverlabel={"bgcolor": BLUE, "font": {"color": "#FFFFFF"}},
    )
    fig.update_xaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    return fig


df = build_data()

st.title("Contributions analytics")
st.write(
    "A public demonstration of financial monitoring and reporting. "
)

with st.sidebar:
    st.header("Filters")
    years = st.multiselect("Year", sorted(df["year"].unique()), default=sorted(df["year"].unique()))
    sectors = st.multiselect("Sector", SECTORS, default=SECTORS)
    statuses = st.multiselect("Status", STATUSES, default=STATUSES)

view = df[df["year"].isin(years) & df["sector"].isin(sectors) & df["status"].isin(statuses)]

if view.empty:
    st.warning("No records match these filters. Widen the selection in the sidebar.")
    st.stop()

pledged = view["pledge_usd"].sum()
paid = view["paid_usd"].sum()
rate = (paid / pledged * 100) if pledged else 0.0

c1, c2, c3, c4 = st.columns(4)
c1.metric("Contributions", f"{len(view):,}")
c2.metric("Pledged", f"USD {pledged / 1e6:,.2f}M")
c3.metric("Paid", f"USD {paid / 1e6:,.2f}M")
c4.metric("Payment rate", f"{rate:,.1f}%")

st.markdown("---")
left, right = st.columns(2)

monthly = view.groupby("month", as_index=False)[["pledge_usd", "paid_usd"]].sum()
monthly = monthly.melt(id_vars="month", var_name="Series", value_name="USD")
with left:
    st.subheader("Pledged versus paid, by month")
    fig = px.line(monthly, x="month", y="USD", color="Series",
                  color_discrete_sequence=[BLUE, GREEN], labels={"month": "Month"})
    st.plotly_chart(chart_layout(fig), width="stretch")

by_sector = view.groupby("sector", as_index=False)["paid_usd"].sum().sort_values("paid_usd", ascending=False)
with right:
    st.subheader("Paid by sector")
    fig = px.bar(by_sector, x="sector", y="paid_usd", color_discrete_sequence=[BLUE],
                 labels={"paid_usd": "USD paid", "sector": "Sector"})
    st.plotly_chart(chart_layout(fig), width="stretch")

left, right = st.columns(2)
by_status = view.groupby("status", as_index=False)["pledge_usd"].sum()
with left:
    st.subheader("Pledged by status")
    fig = px.pie(by_status, names="status", values="pledge_usd", hole=0.55,
                 color_discrete_sequence=[GREEN, BLUE, RED])
    st.plotly_chart(chart_layout(fig), width="stretch")

by_donor = view.groupby("donor", as_index=False)["paid_usd"].sum().sort_values("paid_usd", ascending=False)
with right:
    st.subheader("Paid by donor")
    fig = px.bar(by_donor, x="donor", y="paid_usd", color_discrete_sequence=[VIOLET],
                 labels={"paid_usd": "USD paid", "donor": "Donor"})
    st.plotly_chart(chart_layout(fig), width="stretch")

st.markdown("---")
st.markdown(
    '<p style="font-size:0.85rem;">'
    "Public demo built with Streamlit and Plotly</p>",
    unsafe_allow_html=True,
)
