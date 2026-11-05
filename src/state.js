const listeners = new Set();
let state = { filters: { country: null, ageGroup: null, trustLevel: null }, selectedMetric: 'trust', selectedCountry: null, hoveredCountry: null };
export const getState = () => state;
export function setFilter(name, value) { state = { ...state, filters: { ...state.filters, [name]: value } }; listeners.forEach((listener) => listener(state)); }
function setMapState(values) {
  if (Object.entries(values).every(([key, value]) => state[key] === value)) return;
  state = { ...state, ...values }; listeners.forEach((listener) => listener(state));
}
export const setSelectedMetric = (selectedMetric) => setMapState({ selectedMetric });
export const setSelectedCountry = (selectedCountry) => setMapState({ selectedCountry });
export const setHoveredCountry = (hoveredCountry) => setMapState({ hoveredCountry });
export function resetFilters() { state = { filters: { country: null, ageGroup: null, trustLevel: null }, selectedMetric: state.selectedMetric, selectedCountry: null, hoveredCountry: null }; listeners.forEach((listener) => listener(state)); }
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
