// penplot-groups.js
// Tiny utilities to generate grouped SVG output from penplot polylines.
// Input is expected to be polylines as returned by canvas-sketch-util/penplot pathsToPolylines().

const DEFAULT_DPI = 90;

// --- unit conversion (matches typical canvas-sketch SVG viewBox behavior) ---
function unitToInch(units, dpi = DEFAULT_DPI) {
  switch (units) {
    case 'in': return 1;
    case 'ft': return 12;
    case 'yd': return 36;
    case 'mm': return 1 / 25.4;
    case 'cm': return 1 / 2.54;
    case 'm': return 39.37007874015748;
    case 'pt': return 1 / 72;
    case 'pc': return 1 / 6;
    case 'px': return 1 / dpi; // 1 px at dpi
    default:
      // If unknown, assume px-ish.
      return 1 / dpi;
  }
}

function makeUnitConverters({ units = 'px', dpi = DEFAULT_DPI } = {}) {
  const u2in = unitToInch(units, dpi);
  const toPx = (v) => v * dpi * u2in;
  return { toPx };
}

// --- formatting helpers ---
function fmt(n, digits = 5) {
  // stable, compact, inkscape-friendly
  const s = Number(n).toFixed(digits);
  return s.replace(/\.?0+$/, '');
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// --- geometry to path ---
function polylineToPathD(polyline, toPxFn) {
  if (!polyline || polyline.length < 2) return '';
  const [x0, y0] = polyline[0];
  let d = `M${fmt(toPxFn(x0))} ${fmt(toPxFn(y0))}`;
  for (let i = 1; i < polyline.length; i++) {
    const [x, y] = polyline[i];
    d += ` L${fmt(toPxFn(x))} ${fmt(toPxFn(y))}`;
  }
  return d;
}

// --- main: grouped SVG from penplot polylines ---
function renderGroupedSVG(groups, options = {}) {
  const {
    width,
    height,
    units = 'mm',
    dpi = DEFAULT_DPI,

    // top-level styling
    stroke = 'black',
    fill = 'none',
    strokeWidth = 0.2, // in `units`
    lineJoin = 'round',
    lineCap = 'round',

    // numeric formatting
    precision = 5,

    // optional: add inkscape layer metadata
    // if true, groups will be marked as inkscape layers (useful!)
    inkscapeLayers = false
  } = options;

  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('renderGroupedSVG: options.width and options.height are required numbers.');
  }
  if (!Array.isArray(groups)) {
    throw new Error('renderGroupedSVG: groups must be an array like [{ id, lines }].');
  }

  const { toPx } = makeUnitConverters({ units, dpi });
  const viewW = toPx(width);
  const viewH = toPx(height);

  const xmlHeader =
    `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`;

  // optional inkscape namespaces (only if we use layer attrs)
  const inkscapeNS = inkscapeLayers
    ? ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'
    : '';

  let out = '';
  out += xmlHeader + '\n';
  out += `<svg width="${fmt(width, precision)}${escapeAttr(units)}" height="${fmt(height, precision)}${escapeAttr(units)}"\n`;
  out += `  xmlns="http://www.w3.org/2000/svg"${inkscapeNS} version="1.1" viewBox="0 0 ${fmt(viewW, precision)} ${fmt(viewH, precision)}">\n`;

  // One outer group with style (like Matt's penplot output)
  out += `  <g fill="${escapeAttr(fill)}" stroke="${escapeAttr(stroke)}" stroke-width="${fmt(strokeWidth, precision)}${escapeAttr(units)}" stroke-linejoin="${escapeAttr(lineJoin)}" stroke-linecap="${escapeAttr(lineCap)}">\n`;

  for (const g of groups) {
    const id = g && g.id ? String(g.id) : '';
    const lines = (g && Array.isArray(g.lines)) ? g.lines : [];
    const raw = (g && g.raw != null) ? String(g.raw) : null;

    // Inkscape layer mode (optional)
    const layerAttrs = inkscapeLayers
      ? ` inkscape:groupmode="layer" inkscape:label="${escapeAttr(id || 'layer')}"`
      : '';

    out += `    <g${id ? ` id="${escapeAttr(id)}"` : ''}${layerAttrs}>\n`;

    // NEW: raw svg snippet passthrough
    if (raw) {
      out += `      ${stripOuterSVG(raw)}\n`;
    }

    for (const polyline of lines) {
      const d = polylineToPathD(polyline, toPx);
      if (d) out += `      <path d="${d}" />\n`;
    }

    out += `    </g>\n`;
  }

  out += `  </g>\n`;
  out += `</svg>\n`;

  return out;
}

function stripOuterSVG(svg) {
  const s = String(svg).trim();
  if (!/^<svg[\s>]/i.test(s)) return s; // already a snippet (<g>...</g> etc)

  // remove outer <svg ...> and </svg>
  return s
    .replace(/^<svg[\s\S]*?>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
}

function bundleRawGroups(groupId, snippets) {
  const inner = snippets
    .filter(Boolean)
    .map(s => String(s).trim())
    .join('\n');

  return `<g id="${groupId}">\n${inner}\n</g>`;
}

function placeRaw(svgSnippet, { x, y, scale = 1, rotate = 0 } = {}, toPx) {
  const tx = toPx(x || 0);
  const ty = toPx(y || 0);

  // rotate around the translated origin (optional)
  const tf = rotate
    ? `translate(${tx} ${ty}) rotate(${rotate}) scale(${scale})`
    : `translate(${tx} ${ty}) scale(${scale})`;

  return `<g transform="${tf}">\n${svgSnippet}\n</g>`;
}




module.exports = {
  renderGroupedSVG,
  makeUnitConverters,
  bundleRawGroups,
  placeRaw
};
