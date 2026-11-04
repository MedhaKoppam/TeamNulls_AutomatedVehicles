const CLEAN_DATA_URL = '/data/l3pilot_clean.json';
const MAP_METRICS_URL = '/data/country_metrics.json';
const MAP_GEOMETRY_URL = '/data/countries-110m.json';
const RESPONDENTS_URL = '/data/respondents.json';

export async function loadData() {
  const response = await fetch(CLEAN_DATA_URL);
  if (!response.ok) throw new Error(`Could not load cleaned data (${response.status}).`);
  return response.json();
}

export async function loadMapData() {
  const [metrics, geometry] = await Promise.all([fetch(MAP_METRICS_URL), fetch(MAP_GEOMETRY_URL)]);
  if (!metrics.ok || !geometry.ok) throw new Error('Unable to load map data. Run npm run data first.');
  return { metrics: await metrics.json(), geometry: await geometry.json() };
}

export async function loadRespondents() {
  const response = await fetch(RESPONDENTS_URL);
  if (!response.ok) throw new Error(`Could not load respondent data (${response.status}). Run npm run data first.`);
  return response.json();
}
