# AI Academy Final Exercise — Student Guide, Part 1: Data analysis and deployment

Nov 2, 2026 · @Matteo Bonas

## How the exercise works

The exercise is divided in 2 parts. This guide covers **Part 1**: analyse your dataset, then deploy an app on it. You will keep the same dataset, repository and environment across both parts, so reuse and adapt your code instead of starting over.

**Nothing is graded**. You finish with a *level profile*: for each skill area you are rated Emerging, Proficient, Advanced or "not yet shown". The goal of the hands-on is to help you identify the areas in which you need to strenghten your proficiency.

| Task | What you deliver | Timebox |
| --- | --- | --- |
| Task 1: Exploratory data analysis | Analysis code, figures, short report | 2:30–3:00 h |
| Task 2: App deployment | Containerised app with interactive data exploration, short report | 2:00–2:30 h |

Every task ends with a short Markdown report written in your own words, using the templates in the starter repository. The exercise closes with your presentation at the end of Part 2 so build Part 1 so you can show it, explain your choices and change it live then. Feel free to use notebooks, notes, [ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) and [charts](https://mermaid.ai/live) to help you plan and to document changes.

## Part 1 tasks

A task counts as completed when its **minimum objectives** are met tough feel fre to add and your objectives (but do not forget to document them!). Unfinished work is normal: stop and tag when the timebox ends.

**Task 1: Exploratory data analysis.** Load your dataset, run a statistical analysis, find and fix data issues, and present your findings.

- Data loading: reproducible code that fetches or reads the raw files.
- Statistical analysis: distributions, correlations, target behaviour, anomalies.
- Data wrangling: missing values, outliers, types, encodings, leakage risks; say what you fixed and why.
- Visualisation and presentation: labelled charts that each back a clear claim.

**Task 2: App deployment.** Turn your analysis into an app that runs in containers.

- Build an app for interactive exploration of your data (framework of your choice).
- Containerise it with your own Dockerfile and deploy it with Docker Compose or Kubernetes manifests on minikube.

**Minimum objectives:** a comprehensive statistical analysis; data issues identified and remediated where possible; critical reasoning about the dataset; findings presented clearly; an application designed, built and deployed.

**Advanced objectives:** interactive visualisations that convey the most important findings; the app designed and deployed as microservices.

### What reviewers look at

| Task | Skill areas on your profile |
| --- | --- |
| Task 1 | Data quality handling, insights backed by charts, visualisation, reproducibility (runs from a fresh clone) |
| Task 2 | Deployment works end to end, image quality (slim, pinned, non-root), configuration (env vars, secrets handling), trade-off reasoning, documentation |
