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
    st.plotly_chart(chart_layout(fig), use_container_width=True)

by_sector = view.groupby("sector", as_index=False)["paid_usd"].sum().sort_values("paid_usd", ascending=False)
with right:
    st.subheader("Paid by sector")
    fig = px.bar(by_sector, x="sector", y="paid_usd", color_discrete_sequence=[BLUE],
                 labels={"paid_usd": "USD paid", "sector": "Sector"})
    st.plotly_chart(chart_layout(fig), use_container_width=True)

left, right = st.columns(2)
by_status = view.groupby("status", as_index=False)["pledge_usd"].sum()
with left:
    st.subheader("Pledged by status")
    fig = px.pie(by_status, names="status", values="pledge_usd", hole=0.55,
                 color_discrete_sequence=[GREEN, BLUE, RED])
    st.plotly_chart(chart_layout(fig), use_container_width=True)

by_donor = view.groupby("donor", as_index=False)["paid_usd"].sum().sort_values("paid_usd", ascending=False)
with right:
    st.subheader("Paid by donor")
    fig = px.bar(by_donor, x="donor", y="paid_usd", color_discrete_sequence=[INK],
                 labels={"paid_usd": "USD paid", "donor": "Donor"})
    st.plotly_chart(chart_layout(fig), use_container_width=True)

st.markdown("---")
st.markdown(
    '<p style="color:#000000;font-size:0.85rem;">'
    "Public demo built with Streamlit and Plotly</p>",
    unsafe_allow_html=True,
)
