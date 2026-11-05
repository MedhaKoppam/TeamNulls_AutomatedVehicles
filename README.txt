DVP country-map correction: original 1-5 survey scale

This bundle corrects the previous map update. It is based on the attached
l3pilot_clean_countries.json and aggregates countries using country_label,
not the old numeric country_code mapping.

WHAT CHANGES
- Replaces public/data/l3pilot_clean.json with the attached cleaned respondent data.
- Replaces public/data/country_metrics.json with 1-5 respondent-level country means.
- Sets the default map metric to Intention to use (the direct future-use item).
- Fixes the color domain to the full Likert scale: 1 = strongly disagree,
  3 = neutral, 5 = strongly agree. It does not auto-scale to the observed
  country minimum and maximum.
- Updates highest/lowest/global summary numbers, accessible labels, and
  country profile charts to report scores out of 5.
- Uses cleaned country labels to associate data with map geometry:
  UK -> United Kingdom and USA -> United States.
- Allows vertical scrolling when a country profile is open.
- Adds a small map instruction: Click a country on the map to explore its profile.

VERIFIED RESULT FROM THE ATTACHED DATA
- India has the highest mean direct intention-to-use score: 4.324 / 5
  (1,045 valid responses).
- The next highest are Turkey 4.252 / 5 and Indonesia 4.229 / 5.
- Global mean direct intention to use: 3.556 / 5 (18,452 valid responses).
- Finland is lowest: 2.690 / 5 (1,003 valid responses).

HOW TO APPLY
1. Extract this ZIP anywhere convenient, such as Downloads or Desktop.
2. Open Terminal in the root of your TeamNulls_AutomatedVehicles repository
   (the folder containing package.json and src/).
3. Run the updater using its path inside the extracted folder. For example:
      python3 ~/Downloads/DVP-country-map-fix/apply_1_to_5_fix.py
   Adjust the path if you extracted it somewhere else. Do not move the script
   or its public/ folder into the project first; it reads its bundled data
   relative to its own location and writes the files into the current project.
4. Run:
      npm run build
5. Review the changed files in GitHub Desktop, then commit and push to main.

The updater checks that the current source sections match before changing
source files. If it reports a mismatch, it stops before writing any project
files; do not force it. This bundle does not push to GitHub or deploy to Vercel.
