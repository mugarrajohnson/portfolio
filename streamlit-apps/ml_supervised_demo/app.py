"""
Supervised learning — public Streamlit demo.

Trains a linear regression on synthetic vanilla-farm data, shows the fitted model
and each feature's contribution, then lets a visitor change input values and watch
the prediction adjust. No client or farm data is used — every row is generated
in memory from a fixed seed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

st.set_page_config(
    page_title="Supervised Learning",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      .plotly { background: transparent !important; }
      .plotly .bg, .plotly .plotbg { fill: transparent !important; }
      .plotly text, .plotly .gtitle, .plotly .legend text,
      .plotly .xtick text, .plotly .ytick text, .plotly .hovertext text { fill: currentColor !important; }
      .plotly .gridlayer path, .plotly .xaxis path, .plotly .yaxis path,
      .plotly .zerolinelayer path { stroke: currentColor !important; opacity: 0.3 !important; }
      [data-testid="stMetric"] { border: 2px solid currentColor; border-radius: 0; padding: 10px 12px; }
      [data-testid="stMetricValue"] { font-size: 1.6rem !important; }
      [data-testid="stSidebar"], [data-testid="stSidebarCollapsedControl"] { display: none !important; }
      hr { border-color: currentColor; margin: 0.6rem 0 !important; }
      [data-testid="stMainBlockContainer"] { padding-top: 1rem !important; padding-bottom: 1.25rem !important; }
      h1 { font-size: 2rem !important; margin: 0 0 0.4rem 0 !important; }
      h2 { font-size: 1.45rem !important; margin: 0.6rem 0 0.35rem 0 !important; }
      h3 { font-size: 1.15rem !important; margin: 0.5rem 0 0.3rem 0 !important; }
      [data-testid="stMarkdownContainer"] p { margin: 0.35rem 0 !important; }
    </style>
    """,
    unsafe_allow_html=True,
)

BLUE = "#2E7DFF"
GREEN = "#008F3D"
RED = "#FF4D2E"
INK = "#000000"

FEATURES = {
    "Rainfall (mm/season)": ("rainfall", "mm", 300, 1600),
    "Temperature (°C)": ("temperature", "°C", 17, 31),
    "Flowers opened": ("flowers", "flowers", 1200, 8000),
    "Farm size (acres)": ("farm_size", "acres", 0.3, 8.0),
    "Fertilizer used": ("fertilizer", "0/1", 0, 1),
    "Experience (years)": ("experience", "years", 1, 30),
}
TARGET = "yield_kg"


@st.cache_data(show_spinner=False)
def build_data() -> pd.DataFrame:
    rng = np.random.default_rng(20261122)
    n = 1800
    rainfall = np.clip(rng.normal(900, 220, n), 300, 1600)
    temperature = np.clip(rng.normal(24, 2.5, n), 17, 31)
    flowers = np.clip(rng.normal(4200, 1100, n), 1200, 8000)
    farm_size = np.clip(rng.gamma(2.0, 1.2, n), 0.3, 8.0)
    fertilizer = rng.binomial(1, 0.45, n)
    experience = rng.integers(1, 30, n)
    noise = rng.normal(0, 55, n)
    y = (120 + 0.12 * rainfall - 9 * temperature + 0.16 * flowers
         + 55 * farm_size + 140 * fertilizer + 6 * experience + noise)
    return pd.DataFrame({
        "rainfall": rainfall.round(1), "temperature": temperature.round(1),
        "flowers": flowers.round(0), "farm_size": farm_size.round(2),
        "fertilizer": fertilizer, "experience": experience,
        TARGET: y.round(1),
    })


@st.cache_data(show_spinner=False)
def train(share: int):
    data = build_data()
    X = data[list(v[0] for v in FEATURES.values())]
    y = data[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(X, y, train_size=share / 100, random_state=42)
    model = LinearRegression().fit(X_train, y_train)
    pred = model.predict(X_test)
    return data, model, {
        "r2": r2_score(y_test, pred),
        "mae": mean_absolute_error(y_test, pred),
        "test": pd.DataFrame({"actual": y_test.to_numpy(), "predicted": pred}),
    }


def chart_layout(fig, height=340):
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        font={"color": INK, "family": "Arial, sans-serif", "size": 12},
        margin={"l": 10, "r": 10, "t": 10, "b": 10}, height=height,
        hoverlabel={"bgcolor": BLUE, "font": {"color": "#FFFFFF"}},
    )
    fig.update_xaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    fig.update_yaxes(gridcolor="#000000", zeroline=False, linecolor=INK)
    return fig


st.title("Supervised learning")

st.write(
    "A synthetic regression problem: train a model on vanilla-farm data, read the "
    "fitted equation, inspect what each feature contributes, then adjust the input features to see how the prediction changes."
)

share = st.slider("Training share (%)", 50, 90, 80, 5)
data, model, metrics = train(share)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Records", f"{len(data):,}")
c2.metric("Training share", f"{share}%")
c3.metric("Test R²", f"{metrics['r2']:.3f}")
c4.metric("Test MAE", f"{metrics['mae']:.1f} kg")

st.markdown("---")
st.subheader("The fitted model")
cols = [v[0] for v in FEATURES.values()]
equation = " + ".join(f"({coef:+.2f} × {name})" for name, coef in zip(cols, model.coef_))
st.markdown(f"**Predicted yield = {model.intercept_:+.1f} {equation}**")
st.markdown("Coefficients are in kg of yield per unit of that feature, holding the others fixed.")

coef_df = pd.DataFrame({
    "Feature": list(FEATURES.keys()),
    "Effect per unit (kg)": model.coef_,
}).sort_values("Effect per unit (kg)")
left, right = st.columns([3, 2])
with left:
    fig = px.bar(coef_df, x="Effect per unit (kg)", y="Feature", orientation="h",
                 color=coef_df["Effect per unit (kg)"].apply(lambda v: GREEN if v >= 0 else RED),
                 color_discrete_map={GREEN: GREEN, RED: RED},
                 labels={"Effect per unit (kg)": "kg per unit"})
    st.plotly_chart(chart_layout(fig), width="stretch")
with right:
    st.dataframe(coef_df.round(2), hide_index=True, width="stretch")
    st.markdown("Green raises the prediction; red lowers it.")

st.markdown("---")
st.subheader("Try your own inputs")
controls = st.columns(3)
values = {}
for i, (label, (col, unit, lo, hi)) in enumerate(FEATURES.items()):
    with controls[i % 3]:
        default = float(round(data[col].median(), 2))
        if col == "fertilizer":
            values[col] = st.selectbox(f"{label} (0 = no, 1 = yes)", [0, 1], index=int(default))
        elif col == "farm_size":
            values[col] = st.slider(label, float(lo), float(hi), default, 0.1)
        else:
            values[col] = st.slider(label, float(lo), float(hi), default, 1.0)

x = np.array([[values[c] for c in cols]])
prediction = float(model.predict(x)[0])
baseline = float(model.predict(np.array([[data[c].median() for c in cols]]))[0])
delta = prediction - baseline

m1, m2 = st.columns([2, 3])
with m1:
    st.metric("Predicted yield", f"{prediction:,.0f} kg", f"{delta:+,.0f} kg vs typical farm")
with m2:
    st.markdown(f"A typical farm in the synthetic data is predicted at **{baseline:,.0f} kg**. "
                "Change any control above to see the effect below.")

contributions = [float(c * values[col]) for col, c in zip(cols, model.coef_)]
fig = go.Figure(go.Waterfall(
    orientation="v",
    measure=["absolute"] + ["relative"] * len(cols) + ["total"],
    x=["Intercept"] + list(FEATURES.keys()) + ["Predicted yield"],
    y=[float(model.intercept_)] + contributions + [prediction],
    text=[f"{v:+,.0f} kg" for v in contributions],
    textposition="outside",
    connector={"line": {"color": INK}},
    increasing={"marker": {"color": GREEN}},
    decreasing={"marker": {"color": RED}},
    totals={"marker": {"color": BLUE}},
))
st.plotly_chart(chart_layout(fig, 400), width="stretch")

st.markdown("---")
st.subheader("How well the model predicts unseen farms")
fig = px.scatter(metrics["test"], x="actual", y="predicted", color_discrete_sequence=[BLUE],
                 labels={"actual": "Actual yield (kg)", "predicted": "Predicted yield (kg)"})
st.plotly_chart(chart_layout(fig, 380), width="stretch")
st.markdown("Points close to the line of equality mean the model generalises well to farms it never trained on.")
