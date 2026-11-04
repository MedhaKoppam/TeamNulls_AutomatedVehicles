const threshold = 6;
const number = (value) => Number(value).toFixed(1);

export function generateInsights(countryKey, data) {
  const country = data.countries[countryKey];
  if (!country) return [];
  const caveat = country.lowSample ? ` (interpret cautiously: low sample, n=${country.n})` : '';
  const metrics = data.metrics.map((metric) => ({ metric, value: country.metrics[metric.key], global: data.global[metric.key] }))
    .filter(({ value, global }) => Number.isFinite(value) && Number.isFinite(global))
    .map((item) => ({ ...item, gap: item.value - item.global }));
  const insights = [];
  const positive = [...metrics].sort((a, b) => b.gap - a.gap)[0];
  const negative = [...metrics].sort((a, b) => a.gap - b.gap)[0];
  if (positive?.gap >= threshold) insights.push({ type: 'positive', strength: Math.abs(positive.gap), text: `${country.name} is ${number(positive.gap)} points above the global average for ${positive.metric.label} (${number(positive.value)} vs ${number(positive.global)}).${caveat}` });
  if (negative?.gap <= -threshold && negative.metric.key !== positive?.metric.key) insights.push({ type: 'negative', strength: Math.abs(negative.gap), text: `${country.name} is ${number(Math.abs(negative.gap))} points below the global average for ${negative.metric.label} (${number(negative.value)} vs ${number(negative.global)}).${caveat}` });
  const adoption = country.metrics.adoption, awareness = country.metrics.awareness, trust = country.metrics.trust, safety = country.metrics.safetyConfidence;
  if (Number.isFinite(adoption) && Number.isFinite(awareness) && adoption >= 65 && awareness <= 70) insights.push({ type: 'paradox', strength: Math.min(adoption - 65, 70 - awareness) + threshold, text: `Readiness paradox: adoption intention is ${number(adoption)}, while prior awareness is only ${number(awareness)}.${caveat}` });
  else if (Number.isFinite(trust) && Number.isFinite(safety) && trust >= 65 && safety <= 35) insights.push({ type: 'paradox', strength: Math.min(trust - 65, 35 - safety) + threshold, text: `Trust–safety tension: trust is ${number(trust)}, but safety confidence is only ${number(safety)}.${caveat}` });
  const comparisons = [
    ...Object.entries(country.behaviors).map(([key, value]) => ({ group: 'activity', key, value, global: data.globalDetails.behaviors[key] })),
    ...Object.entries(country.misconceptions).map(([key, value]) => ({ group: 'misconception', key, value, global: data.globalDetails.misconceptions[key] })),
  ].filter(({ value, global }) => Number.isFinite(value) && Number.isFinite(global)).map((item) => ({ ...item, gap: item.value - item.global }));
  const largest = comparisons.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
  if (largest && Math.abs(largest.gap) >= threshold) {
    const label = largest.key.replace(/([A-Z])/g, ' $1').toLowerCase();
    insights.push({ type: largest.group, strength: Math.abs(largest.gap), text: `${largest.group === 'activity' ? 'Secondary activity' : 'Misconception'} difference: ${label} is ${number(Math.abs(largest.gap))} points ${largest.gap > 0 ? 'above' : 'below'} the global share (${number(largest.value)}% vs ${number(largest.global)}%).${caveat}` });
  }
  return insights.sort((a, b) => b.strength - a.strength).slice(0, 3);
}
