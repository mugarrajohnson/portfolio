# Public Streamlit dashboards

Two small dashboards that demonstrate the same monitoring and analytics work shown
elsewhere on the portfolio, built for a public audience.

**Both apps use synthetic data generated in memory. There is no database connection,
no file upload, and no client, farmer, donor or beneficiary information in either app.**

| Demo | Local command | Public URL (placeholder) |
| --- | --- | --- |
| Vanilla value chain | `streamlit run agriculture_demo/app.py` | `https://jm-agriculture-demo.streamlit.app` |
| Contributions analytics | `streamlit run contributions_demo/app.py` | `https://jm-contributions-demo.streamlit.app` |

## Run locally

From the repository root:

```bash
pip install -r requirements.txt
cd streamlit-apps/agriculture_demo && streamlit run app.py
cd ../contributions_demo && streamlit run app.py
```

## Deploy on Streamlit Cloud

1. Push this repository to GitHub (the apps are already in `portfolio/streamlit-apps/`).
2. Go to <https://share.streamlit.io> and sign in with GitHub.
3. **New app** → choose this repository, branch `main`.
4. Set **Main file path** to `streamlit-apps/agriculture_demo/app.py` for the first app,
   and `streamlit-apps/contributions_demo/app.py` for the second.
5. Leave secrets and environment variables empty — neither app needs them.
   Each app directory contains its own `requirements.txt` (the location Streamlit
   Cloud checks first), with a copy at the repository root as a fallback. Deploy.
6. Copy each live URL and replace the two placeholder URLs in `index.html`
   (search for `PLACEHOLDER` in the **Public dashboards** section), then update
   the table above.

The placeholder links in `index.html` are marked with an HTML comment so they are
easy to find before publishing. They are safe to leave until the apps are live;
they simply point at reserved-looking names rather than a deployed app.

### If deployment fails with `ModuleNotFoundError: plotly`

Streamlit Cloud has not installed the dependencies. It searches for a dependency
file in the **app's entrypoint directory first**, then the repository root — a
`requirements.txt` in an intermediate folder is ignored. Both apps now have one in
their own directory and one at the root. After committing, use **Manage app →
Reboot** to rebuild the environment. If you move the files, set **Advanced
settings → Requirements file** to the correct path.

## Design notes

- Text is black `#000000`; accents are blue `#0057D9`, green `#008F3D` and red
  `#D11A00`. No muted or grey copy.
- Data is seeded, so the same figures appear on every visit — useful for a demo.
