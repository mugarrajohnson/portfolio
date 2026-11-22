"""Ask AI for the public Streamlit demos.

Optional: set OPENAI_API_KEY in Streamlit Cloud secrets (or the local environment).
Without a key the widget still renders, explains how to enable it, and the rest of
the app works exactly as before. All prompts are grounded in the facts below —
the apps contain synthetic data only, so nothing sensitive can be asked about.
"""
from __future__ import annotations

import os
from pathlib import Path

import streamlit as st

PORTFOLIO_FACTS = """
Johnson Mugarra is a data scientist and ML engineer based in Kampala, Uganda, with
6+ years across East Africa and the Horn of Africa. Work: impact evaluation,
monitoring and evaluation, machine learning, NLP, computer vision, Bayesian
inference, and the data systems behind vanilla and coffee value chains.
Background: Bronkar Uganda (consulting and impact evaluations), USAID SITES
(qualitative health-systems field research in Eastern and Northern Uganda),
MAAIF and Makerere (vanilla maturity and harvest timing with field and climate
data), Center for Research and Communication (proposal and evaluation support).
He maintains farmer data systems, ETL pipelines and dashboards. Methods include
forecasting, evaluation design, sampling, survey tools and analysis; evaluation
cycles cut from six weeks to ten days. Co-author on two peer-reviewed papers
(Agronomy; Advances in Agriculture). Certified in Power BI, SAS, Tableau and
Google project management. Contact: johnsonmugarra@yahoo.com.
"""

DASHBOARD_FACTS = {
    "agriculture_demo": """
    Vanilla value chain demo: synthetic purchase receipts across 2023-2025. Shows
    filtered records by year, region and grade; KPIs for records, farmers, tonnes
    and UGX value; monthly volume by grade, value by season, deliveries by district
    and a grade-mix donut. All figures are invented for demonstration.
    """,
    "contributions_demo": """
    Contributions analytics demo: synthetic pledge and payment records for 2023-2025.
    Filters by year, sector and status. KPIs for contributions, pledged USD, paid USD
    and payment rate; charts for pledged vs paid by month, paid by sector, pledged by
    status and paid by donor. Donors and amounts are invented.
    """,
    "endline_evaluation": """
    Endline evaluation demo: synthetic livelihood project in Northern Uganda.
    Baseline, midline and endline values for income adequacy, food security, school
    attendance, savings participation, food insecurity and debt distress. Some
    indicators rise (higher is better, solid lines) and some fall (lower is better,
    dashed lines). Reports targets met, OECD-DAC criteria (relevance, coherence,
    effectiveness, efficiency, impact, sustainability) and disaggregation by sex,
    age and disability. All figures are invented.
    """,
    "traceability_study": """
    Traceability study demo: synthetic coffee and vanilla lots across seven districts.
    Shows the share fully traceable from farm to exporter, where records break down,
    reasons for gaps, district and quarterly trends, and average time to trace.
    All lots and figures are invented.
    """,
    "rct_demonstration": """
    Randomised trial demo: synthetic two-arm trial on baseline balance, difference-
    in-differences with a 95% confidence interval, p-value and attrition. Shows
    outcome by arm, outcome distribution and a baseline balance table. All
    participants and results are invented.
    """,
    "cohort_analysis": """
    Cohort analysis demo: synthetic programme cohorts followed for twelve months.
    Shows retention curves, a cohort-by-month heatmap, completion at month 12 and
    outcome trends by cohort. All members and figures are invented.
    """,
    "ml_supervised_demo": """
    Supervised learning demo: a linear regression trained on 1,800 synthetic vanilla
    farms to predict yield in kg from rainfall, temperature, flowers opened, farm
    size, fertilizer use and experience. Shows the fitted equation, coefficients,
    test R-squared and MAE, a contribution waterfall for user-chosen inputs and a
    predicted-vs-actual chart. All rows are invented.
    """,
    "advanced_dashboard_demo": """
    Advanced analytics demo: a URL-driven dashboard with period pills (1M to All),
    region and segment filters, price-scenario slider, KPI deltas against the
    previous period, four tabs (Overview, Segments, Trends, Data & method), dual-axis
    revenue/volume chart, channel donut, region bars, stacked segment cut,
    satisfaction box plot, region-by-month heatmap, trend with moving average and
    CSV export. Deep links use query parameters such as ?period=12M&region=West.
    All figures are invented.
    """,
}

SYSTEM = """You are a concise, factual assistant embedded in a public portfolio demo app.
Answer the user's question using ONLY the context below. If the answer is not in
the context, say you do not have that information and point them to the Contact
section of the portfolio. Never invent figures, credentials or client details.
Be brief — at most three short paragraphs. The data shown in these apps is
synthetic and must never be described as real client or beneficiary data.

CONTEXT:
{context}
"""


def _api_key() -> str | None:
    try:
        key = st.secrets.get("OPENAI_API_KEY")
    except Exception:
        key = None
    return key or os.getenv("OPENAI_API_KEY")


def _model() -> str:
    try:
        return st.secrets.get("OPENAI_MODEL", "gpt-4o-mini")
    except Exception:
        return "gpt-4o-mini"


def _answer(context: str, question: str, key: str) -> str:
    try:
        from openai import OpenAI
    except ImportError:
        return "The OpenAI package is not installed in this deployment. Add `openai` to requirements.txt."
    try:
        client = OpenAI(api_key=key)
        response = client.chat.completions.create(
            model=_model(),
            messages=[
                {"role": "system", "content": SYSTEM.format(context=context)},
                {"role": "user", "content": question},
            ],
            max_tokens=400,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        return f"Ask AI could not complete that request ({type(exc).__name__}). Please try again."


def ask_ai() -> None:
    """Render the Ask AI panel. Safe to call in every app; no key = graceful fallback."""
    app = Path(__file__).resolve().parent.parent.name
    context = DASHBOARD_FACTS.get(app, "") + "\n" + PORTFOLIO_FACTS

    with st.expander("Ask AI — about this dashboard and the portfolio", expanded=False):
        key = _api_key()
        if not key:
            st.info(
                "Ask AI is not configured here. Add `OPENAI_API_KEY` to the app's "
                "Streamlit Cloud secrets (and optionally `OPENAI_MODEL`), then reboot "
                "the app. The dashboard itself works without it."
            )
            st.text_input("Your question", placeholder="Set the secret to enable Ask AI", disabled=True)
            return

        state_key = f"ask_ai_messages_{app}"
        history = st.session_state.setdefault(state_key, [])
        for role, text in history:
            with st.chat_message(role):
                st.write(text)

        with st.form("ask_ai_form", clear_on_submit=True):
            question = st.text_input("Your question", placeholder="e.g. What does this dashboard measure?")
            sent = st.form_submit_button("Ask")

        if sent and question.strip():
            question = question.strip()
            st.session_state[state_key].append(("user", question))
            with st.chat_message("assistant"):
                with st.spinner("Thinking…"):
                    answer = _answer(context, question, key)
                st.write(answer)
            st.session_state[state_key].append(("assistant", answer))
