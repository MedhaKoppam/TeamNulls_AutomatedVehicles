import * as d3 from 'd3';

const LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const COLORS = ['#9d5662', '#e66767', '#c9c8c2', '#3d8de7', '#32ad9b'];

export function renderWillingnessCars(container, stats) {
  const values = stats.distribution.map((item, index) => ({
    ...item,
    index,
    label: LABELS[index],
    color: COLORS[index],
  }));

  // Largest-remainder rounding creates precisely 100 illustrative seats.
  // The legend preserves the actual survey percentages and respondent counts.
  const seatsByCategory = values.map((item) => Math.floor(item.share));
  const remainderOrder = values
    .map((item, index) => ({ index, remainder: item.share - seatsByCategory[index] }))
    .sort((a, b) => d3.descending(a.remainder, b.remainder) || d3.ascending(a.index, b.index));
  for (let i = 0; i < 100 - d3.sum(seatsByCategory); i += 1) {
    seatsByCategory[remainderOrder[i].index] += 1;
  }

  const seats = values.flatMap((item) => Array.from({ length: seatsByCategory[item.index] }, () => item));
  if (seats.length !== 100) throw new Error('Willingness car visual must contain exactly 100 seats.');
  const cars = d3.range(25).map((index) => seats.slice(index * 4, index * 4 + 4));

  container.innerHTML = `
    <div class="car-legend" role="group" aria-label="Five response categories">
      ${values.map((item) => `<button type="button" class="car-legend-button car-mark" data-category="${item.index}">
        <span class="car-legend-swatch" style="--seat-color:${item.color}" aria-hidden="true"></span>
        <span>${item.label}</span><strong>${item.share.toFixed(1)}%</strong>
      </button>`).join('')}
    </div>
    <div class="car-grid" role="group" aria-label="Twenty-five cars, each with four seats, representing 100 respondents">
      ${cars.map((car, carIndex) => `<div class="car-unit" role="group" aria-label="Car ${carIndex + 1}, four illustrative seats">
        <span class="car-wheel car-wheel-top-left" aria-hidden="true"></span><span class="car-wheel car-wheel-top-right" aria-hidden="true"></span>
        <span class="car-wheel car-wheel-bottom-left" aria-hidden="true"></span><span class="car-wheel car-wheel-bottom-right" aria-hidden="true"></span>
        <span class="car-rail car-rail-left" aria-hidden="true"></span>
        <div class="car-seats">${car.map((item) => `<span class="car-seat car-mark" data-category="${item.index}" title="${item.label}" aria-hidden="true"></span>`).join('')}</div>
        <span class="car-rail car-rail-right" aria-hidden="true"></span>
      </div>`).join('')}
    </div>
    <p class="car-caption">Each seat represents about one respondent out of 100. Seat counts are rounded; exact survey shares appear above.</p>`;

  const tooltip = d3.select(container).selectAll('.car-tooltip').data([null]).join('div')
    .attr('class', 'tooltip car-tooltip').style('opacity', 0);

  function highlight(category) {
    container.querySelectorAll('.car-mark').forEach((mark) => {
      const active = category !== null && Number(mark.dataset.category) === category;
      mark.classList.toggle('is-highlighted', active);
      mark.classList.toggle('is-dimmed', category !== null && !active);
    });
  }

  function showTooltip(mark, event) {
    const item = values[Number(mark.dataset.category)];
    if (!item) return;
    const bounds = container.getBoundingClientRect();
    const markBounds = mark.getBoundingClientRect();
    const pointerX = event?.clientX || markBounds.left + markBounds.width / 2;
    const pointerY = event?.clientY || markBounds.top + markBounds.height / 2;
    const left = Math.max(8, Math.min(bounds.width - 250, pointerX - bounds.left + 12));
    const top = Math.max(8, pointerY - bounds.top + 12);
    tooltip.html(`<strong>${item.label}</strong><br>${item.share.toFixed(1)}% · ${item.n.toLocaleString()} of ${stats.n.toLocaleString()} valid responses<br>${seatsByCategory[item.index]} of the 100 illustrative seats`)
      .style('left', `${left}px`).style('top', `${top}px`).style('opacity', 1);
  }

  container.onpointerover = (event) => {
    const mark = event.target.closest('.car-mark[data-category]');
    if (!mark || !container.contains(mark)) return;
    highlight(Number(mark.dataset.category));
    showTooltip(mark, event);
  };
  container.onpointerleave = () => { highlight(null); tooltip.style('opacity', 0); };
  container.onfocusin = (event) => {
    const mark = event.target.closest('.car-mark[data-category]');
    if (!mark || !container.contains(mark)) return;
    highlight(Number(mark.dataset.category));
    showTooltip(mark, event);
  };
  container.onfocusout = (event) => {
    if (event.relatedTarget?.closest?.('.car-mark[data-category]')) return;
    highlight(null);
    tooltip.style('opacity', 0);
  };
}
