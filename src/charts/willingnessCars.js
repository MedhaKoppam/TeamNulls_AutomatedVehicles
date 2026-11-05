const LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const COLORS = ['#9d5662', '#e66767', '#c9c8c2', '#3d8de7', '#32ad9b'];

function allocateSeats(distribution) {
  // Use respondent counts as the source of truth. This avoids relying on
  // rounded/floating-point percentages when assigning the 100 illustrated seats.
  const counts = distribution.map((item) => {
    const count = Number(item.n);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  });
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) throw new Error('No valid willingness responses are available for the car illustration.');

  const exactSeats = counts.map((count) => (count / total) * 100);
  const seatsByCategory = exactSeats.map(Math.floor);
  const remainderOrder = exactSeats
    .map((quota, index) => ({ index, remainder: quota - seatsByCategory[index] }))
    .sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index));

  let remaining = 100 - seatsByCategory.reduce((sum, count) => sum + count, 0);
  // Cycle defensively in case floating-point edge cases leave more than five seats.
  for (let i = 0; i < remaining; i += 1) {
    seatsByCategory[remainderOrder[i % remainderOrder.length].index] += 1;
  }

  // Correct any unexpected rounding drift while preserving non-negative counts.
  let allocated = seatsByCategory.reduce((sum, count) => sum + count, 0);
  if (allocated < 100) {
    const largest = counts.indexOf(Math.max(...counts));
    seatsByCategory[largest] += 100 - allocated;
  } else if (allocated > 100) {
    let excess = allocated - 100;
    const removalOrder = [...seatsByCategory.keys()].sort((a, b) => seatsByCategory[b] - seatsByCategory[a]);
    for (const index of removalOrder) {
      const removed = Math.min(excess, seatsByCategory[index]);
      seatsByCategory[index] -= removed;
      excess -= removed;
      if (excess === 0) break;
    }
  }

  return { counts, total, seatsByCategory };
}

export function renderWillingnessCars(container, stats) {
  const { counts, total, seatsByCategory } = allocateSeats(stats.distribution);
  const values = stats.distribution.map((item, index) => ({
    index,
    n: counts[index],
    share: (counts[index] / total) * 100,
    label: LABELS[index],
    color: COLORS[index],
  }));

  const seats = values.flatMap((item, index) =>
    Array.from({ length: seatsByCategory[index] }, () => item)
  );
  // Keep the display resilient: the allocator guarantees exactly 100 seats.
  const cars = Array.from({ length: 25 }, (_, index) => seats.slice(index * 4, index * 4 + 4));

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

  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip car-tooltip';
  tooltip.style.opacity = '0';
  container.append(tooltip);

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
    const left = Math.max(8, Math.min(Math.max(8, bounds.width - 250), pointerX - bounds.left + 12));
    const top = Math.max(8, pointerY - bounds.top + 12);
    tooltip.innerHTML = `<strong>${item.label}</strong><br>${item.share.toFixed(1)}% · ${item.n.toLocaleString()} of ${total.toLocaleString()} valid responses<br>${seatsByCategory[item.index]} of the 100 illustrative seats`;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.opacity = '1';
  }

  container.onpointerover = (event) => {
    const mark = event.target.closest('.car-mark[data-category]');
    if (!mark || !container.contains(mark)) return;
    highlight(Number(mark.dataset.category));
    showTooltip(mark, event);
  };
  container.onpointerleave = () => {
    highlight(null);
    tooltip.style.opacity = '0';
  };
  container.onfocusin = (event) => {
    const mark = event.target.closest('.car-mark[data-category]');
    if (!mark || !container.contains(mark)) return;
    highlight(Number(mark.dataset.category));
    showTooltip(mark, event);
  };
  container.onfocusout = (event) => {
    if (event.relatedTarget?.closest?.('.car-mark[data-category]')) return;
    highlight(null);
    tooltip.style.opacity = '0';
  };
}
