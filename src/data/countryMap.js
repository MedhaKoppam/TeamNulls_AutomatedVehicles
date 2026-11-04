// Single source of truth for the workbook's unlabeled country codes. Kept in
// browser-safe code so respondent-level views and build scripts use identical labels.
export const COUNTRY_MAP = {
  1: { name: 'Brazil', iso3: 'BRA', isoNumeric: '076', region: 'South America' },
  2: { name: 'China', iso3: 'CHN', isoNumeric: '156', region: 'Asia' },
  3: { name: 'Finland', iso3: 'FIN', isoNumeric: '246', region: 'Europe' },
  4: { name: 'France', iso3: 'FRA', isoNumeric: '250', region: 'Europe' },
  5: { name: 'Germany', iso3: 'DEU', isoNumeric: '276', region: 'Europe' },
  6: { name: 'Hungary', iso3: 'HUN', isoNumeric: '348', region: 'Europe' },
  7: { name: 'India', iso3: 'IND', isoNumeric: '356', region: 'Asia' },
  8: { name: 'Indonesia', iso3: 'IDN', isoNumeric: '360', region: 'Asia' },
  9: { name: 'Italy', iso3: 'ITA', isoNumeric: '380', region: 'Europe' },
  10: { name: 'Japan', iso3: 'JPN', isoNumeric: '392', region: 'Asia' },
  11: { name: 'Russia', iso3: 'RUS', isoNumeric: '643', region: 'Europe' },
  12: { name: 'South Africa', iso3: 'ZAF', isoNumeric: '710', region: 'Africa' },
  13: { name: 'Spain', iso3: 'ESP', isoNumeric: '724', region: 'Europe' },
  14: { name: 'Sweden', iso3: 'SWE', isoNumeric: '752', region: 'Europe' },
  15: { name: 'Turkey', iso3: 'TUR', isoNumeric: '792', region: 'Asia' },
  16: { name: 'United Kingdom', iso3: 'GBR', isoNumeric: '826', region: 'Europe' },
  17: { name: 'United States', iso3: 'USA', isoNumeric: '840', region: 'North America' },
};
