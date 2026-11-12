# AI Usage Log

Every use of an AI assistant during this exercise, in chronological order.
See [ground_rules.md](ground_rules.md#using-ai-assistants).

| Time  | Purpose | Kept |
|-------|---------|------|
| 17:54 | Creating this AI log and defining how it is filled | Used as suggested |
| 10:44 | Task 1 – implementing the preprocessing pipeline drawn in `part_1/data/designs/EDA.jpg` (sklearn, missing values to "Unknown", unified DataFrame, tests) | Used as suggested; ran the script and the 14 tests myself to verify the output |
| 11:43 | Task 1 – building the four seaborn figures drawn in `part_1/data/designs/Charts.jpg` (distribution, target vs numeric, target vs categorical, scatter matrix) | Used as suggested; checked every rendered PNG and the printed numbers before keeping them |
| 11:49 | Task 1 – moving the figure output from `reports/figures` to `part_1/data/processed/figures` | Used as suggested; re-ran the script and the tests |
| 12:06 | Task 1 – drafting `reports/task1.md` from `templates/task_report.md` using the measured results | Draft kept for review; must be re-read and rephrased in my own words before tagging |
| 12:24 | Ignoring all dataset files in `.gitignore` and removing them from the git index | Used as suggested; confirmed with `git check-ignore` and that the files are still on disk |
| 12:44 | Fixing the blocked push: removing the Git LFS filters from `.gitattributes` and the LFS pointer from the local history | Used as suggested; rewrote only the unpushed commits, kept a local backup branch, no push performed |
| 14:09 | Task 2 - API layer: FastAPI endpoints and pandas aggregates reproducing the four Task 1 figures, with shared filter parameters | Draft kept; 22 pytest tests pin every number to the Task 1 report |
| 14:37 | Task 2 - React and ECharts front end: five views, typed fetch client, filters kept in the URL | Draft kept; ran the build, the 13 Vitest tests and reviewed every screenshot |
| 15:02 | Task 2 - deployment: Dockerfile and compose structure, nginx single-origin proxy, explaining the named-volume PermissionError | Explanation used; rebuilt the stack and checked health, ports and image sizes myself |
| 15:09 | Task 2 - splitting test and chart dependencies into a dev group to shrink the API image | Used as suggested; rebuilt and compared image size and package count |
| 15:16 | Task 2 - drafting part_2/README.md and part_2/reports/task2.md from the measured results | Draft kept for review; must be re-read and rephrased in my own words before tagging |
| 15:35 | Task 2 - moving the report to reports/task2.md and repointing its image links | Used as suggested; checked every heading against the template and that all links resolve on disk |
