import { geoNaturalEarth1, geoPath } from 'd3';
import { feature } from 'topojson-client';
import { COUNTRY_MAP } from '../data/countryMap.js';

const surveyedIds = new Set(Object.values(COUNTRY_MAP).map((country) => country.isoNumeric));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const createCanvas = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export function mountDotMap(hero) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-dot-map';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);
  const context = canvas.getContext('2d');
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim();
  const muted = styles.getPropertyValue('--text-secondary').trim();
  let dots = [], width = 0, height = 0, active = !document.hidden, visible = true, raf = 0, last = 0, frameAverage = 0;
  let landMask, surveyedMask, shapes, resizeTimer;

  const draw = (time = 0) => {
    const started = performance.now();
    context.clearRect(0, 0, width, height);
    const offset = reducedMotion() ? 0 : Math.floor((time / 78000 * width) % width);
    dots.forEach((dot) => {
      const sampleX = (Math.floor(dot.x) + offset) % width;
      const sampleIndex = (Math.floor(dot.y) * width + sampleX) * 4 + 3;
      const land = (landMask?.[sampleIndex] || 0) / 255;
      const surveyed = (surveyedMask?.[sampleIndex] || 0) / 255;
      const edgeFade = Math.min(1, dot.y / 72, (height - dot.y) / 92);
      const wave = reducedMotion() ? 1 : .9 + .1 * Math.sin(time / 7000 + dot.phase);
      const intensity = surveyed || land;
      const radius = .65 + intensity * .8 + (wave - .9) * .5;
      context.fillStyle = surveyed ? accent : muted;
      context.globalAlpha = (surveyed ? .45 : land ? .27 : .05) * (intensity || 1) * edgeFade * wave;
      // Dot coordinates stay fixed. Only the mask sampled under each LED advances.
      context.fillRect(dot.x - radius, dot.y - radius, radius * 2, radius * 2);
    });
    context.globalAlpha = 1;
    frameAverage = frameAverage ? frameAverage * .9 + (performance.now() - started) * .1 : performance.now() - started;
    window.__heroDotMapFrameMs = frameAverage;
  };
  const loop = (time) => {
    if (!active || !visible) { raf = 0; return; }
    if (!last || time - last >= 33) { draw(time); last = time; }
    raf = requestAnimationFrame(loop);
  };
  const resize = () => {
    const rect = hero.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(window.innerWidth)); height = Math.max(1, Math.floor(rect.height));
    canvas.width = width * ratio; canvas.height = height * ratio; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildDots(); buildMasks(); draw(performance.now());
  };
  const buildDots = () => {
    const spacing = 11;
    dots = [];
    for (let y = spacing / 2; y < height; y += spacing) for (let x = spacing / 2; x < width; x += spacing) {
      dots.push({ x, y, phase: (x * .037 + y * .061) % (Math.PI * 2) });
    }
  };
  const buildMasks = () => {
    if (!shapes) return;
    const landCanvas = createCanvas(width, height);
    const surveyedCanvas = createCanvas(width, height);
    const landContext = landCanvas.getContext('2d', { willReadFrequently: true });
    const surveyedContext = surveyedCanvas.getContext('2d', { willReadFrequently: true });
    const projection = geoNaturalEarth1().fitSize([width, height], { type: 'FeatureCollection', features: shapes.land });
    const path = geoPath(projection);
    const paint = (target, features) => {
      target.clearRect(0, 0, width, height);
      target.save(); target.filter = 'blur(2px)'; target.fillStyle = '#ffffff'; target.beginPath();
      features.forEach((shape) => path.context(target)(shape));
      target.fill(); target.restore();
    };
    paint(landContext, shapes.land);
    paint(surveyedContext, shapes.surveyed);
    landMask = landContext.getImageData(0, 0, width, height).data;
    surveyedMask = surveyedContext.getImageData(0, 0, width, height).data;
  };
  fetch('/data/countries-110m.json').then((response) => response.ok ? response.json() : Promise.reject(new Error('World geometry unavailable'))).then((topology) => {
    const features = feature(topology, topology.objects.countries).features;
    shapes = { land: features, surveyed: features.filter((shape) => surveyedIds.has(String(shape.id).padStart(3, '0'))) };
    resize();
    if (!reducedMotion()) raf = requestAnimationFrame(loop);
  }).catch(() => {});
  const scheduleResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); };
  new ResizeObserver(scheduleResize).observe(hero);
  window.addEventListener('resize', scheduleResize);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !reducedMotion() && !raf) raf = requestAnimationFrame(loop); }, { threshold: .05 }).observe(hero);
  const onVisibilityChange = () => { active = !document.hidden; if (active && visible && !reducedMotion() && !raf) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (reducedMotion()) canvas.dataset.reducedMotion = 'true';
  return () => { clearTimeout(resizeTimer); cancelAnimationFrame(raf); window.removeEventListener('resize', scheduleResize); document.removeEventListener('visibilitychange', onVisibilityChange); };
}
