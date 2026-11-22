# Public Streamlit dashboards

Eight dashboards that demonstrate the monitoring and evaluation work shown elsewhere
on the portfolio, built for a public audience.

**Every app uses synthetic data generated in memory. There is no database connection,
no file upload, and no client, farmer, donor or beneficiary information in any app.**

| Demo | Local command (`streamlit run …`) | Public URL |
| --- | --- | --- |
| Vanilla value chain | `streamlit-apps/agriculture_demo/app.py` | Live URL in `index.html` |
| Contributions analytics | `streamlit-apps/contributions_demo/app.py` | Live URL in `index.html` |
| Endline evaluation | `streamlit-apps/endline_evaluation/app.py` | `https://jm-endline-evaluation-demo.streamlit.app` (placeholder) |
| Traceability study | `streamlit-apps/traceability_study/app.py` | `https://jm-traceability-demo.streamlit.app` (placeholder) |
| Randomised trial | `streamlit-apps/rct_demonstration/app.py` | `https://jm-rct-demo.streamlit.app` (placeholder) |
| Cohort analysis | `streamlit-apps/cohort_analysis/app.py` | `https://jm-cohort-analysis-demo.streamlit.app` (placeholder) |
| Advanced analytics (period pills, deep links) | `streamlit-apps/advanced_dashboard_demo/app.py` | `https://jm-advanced-analytics-demo.streamlit.app` (placeholder) |
| Supervised learning (train + feature contributions) | `streamlit-apps/ml_supervised_demo/app.py` | `https://jm-supervised-learning-demo.streamlit.app` (placeholder) |

## Run locally

From the repository root:

```bash
pip install -r requirements.txt
streamlit run streamlit-apps/endline_evaluation/app.py
# or any of the other paths in the table above
```

## Deploy on Streamlit Cloud

1. Push this repository to GitHub (the apps are already in `portfolio/streamlit-apps/`).
2. Go to <https://share.streamlit.io> and sign in with GitHub.
3. **New app** → choose this repository, branch `main`.
4. Set **Main file path** to the path from the table above — one app per deployment.
5. Leave secrets and environment variables empty — no app needs them.
   Each app directory contains its own `requirements.txt` (the location Streamlit
   Cloud checks first), with a copy at the repository root as a fallback. Deploy.
6. Copy each live URL and replace the remaining placeholder URLs in `index.html`
   (search for `PLACEHOLDER` in the **Public dashboards** section), then update
   the table above.

The placeholder links in `index.html` are marked with an HTML comment so they are
easy to find before publishing. They are safe to leave until the apps are live;
they simply point at reserved-looking names rather than a deployed app.

### If deployment fails with `ModuleNotFoundError: plotly`

Streamlit Cloud has not installed the dependencies. It searches for a dependency
file in the **app's entrypoint directory first**, then the repository root — a
`requirements.txt` in an intermediate folder is ignored. Every app now has one in
its own directory and one at the root. After committing, use **Manage app →
Reboot** to rebuild the environment. If you move the files, set **Advanced
settings → Requirements file** to the correct path.

## Design notes

- Filters and controls sit in a horizontal toolbar at the top of every app; there
  is no sidebar or vertical divider.
- All apps use a compact dashboard layout: minimal padding around the top, bottom
  and sides, tight heading/metric spacing and full-width charts, so the visuals fill
  the viewport without crowding.
- All apps follow Streamlit's active light/dark theme: no hardcoded text colours,
  chart text and gridlines use `currentColor`, and verdicts use themed
  `st.success` / `st.error` / `st.info` messages. Nothing disappears when the
  browser switches to dark mode.
- Accents are sharp blue, green and red, plus a violet fourth series colour.
- Data is seeded, so the same figures appear on every visit — useful for a demo.
