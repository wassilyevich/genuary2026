// penplot-utils.js
// Utilities for grouped SVG export + "raw SVG snippet" placement for penplot workflows.
//
// Design goals (per your request):
// - Everything lives in `units` (mm/cm/in/whatever you set in canvas-sketch settings).
// - The SVG viewBox is in the same `units` (NO dpi/px conversions here).
// - placeRaw() can either:
//    - passthrough raw SVG (<g transform="...">...</g>) for export layering
//    - OR return pure path-data strings (["M...L...", ...]) with ALL transforms baked in
//      (root transforms + per-path transforms + your placement transform).
// - Optional cleaning for polylines and for the resulting path-data.

'use strict';

// -------------------------
// Formatting & escaping
// -------------------------

function fmt(n, digits = 5) {
  const s = Number(n).toFixed(digits);
  return s.replace(/\.?0+$/, '');
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function stripOuterSVG(svg) {
  const s = String(svg).trim();
  if (!/^<svg[\s>]/i.test(s)) return s;
  return s
    .replace(/^<svg[\s\S]*?>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
}

// -------------------------
// Polyline -> path d
// -------------------------

function polylineToPathD(polyline, precision = 5) {
  if (!polyline || polyline.length < 2) return '';
  const [x0, y0] = polyline[0];
  let d = `M${fmt(x0, precision)} ${fmt(y0, precision)}`;
  for (let i = 1; i < polyline.length; i++) {
    const [x, y] = polyline[i];
    d += ` L${fmt(x, precision)} ${fmt(y, precision)}`;
  }
  return d;
}

// -------------------------
// Polyline cleaning
// -------------------------

function dist2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function removeDuplicatePoints(line, eps = 1e-9) {
  if (!line || line.length < 2) return line || [];
  const out = [line[0]];
  const eps2 = eps * eps;
  for (let i = 1; i < line.length; i++) {
    if (dist2(line[i], out[out.length - 1]) > eps2) out.push(line[i]);
  }
  return out;
}

function openIfClosed(line, eps = 1e-9) {
  if (!line || line.length < 3) return line || [];
  const eps2 = eps * eps;
  const a = line[0];
  const b = line[line.length - 1];
  if (dist2(a, b) <= eps2) return line.slice(0, -1);
  return line;
}

// Optional: remove collinear points (useful to reduce output)
function removeCollinearPoints(line, eps = 1e-9) {
  if (!line || line.length < 3) return line || [];
  const out = [line[0]];
  const eps2 = eps * eps;

  function collinear(p0, p1, p2) {
    const x1 = p1[0] - p0[0];
    const y1 = p1[1] - p0[1];
    const x2 = p2[0] - p1[0];
    const y2 = p2[1] - p1[1];
    const cross = x1 * y2 - y1 * x2;
    return cross * cross <= eps2;
  }

  for (let i = 1; i < line.length - 1; i++) {
    const p0 = out[out.length - 1];
    const p1 = line[i];
    const p2 = line[i + 1];
    if (!collinear(p0, p1, p2)) out.push(p1);
  }
  out.push(line[line.length - 1]);
  return out;
}

function cleanPolylines(lines, opt = {}) {
  const {
    removeDuplicates = true,
    removeCollinear = false,
    openClosed = true,
    eps = 1e-6,
    dropShort = true
  } = opt;

  const cleaned = (lines || []).map((ln) => {
    let line = Array.isArray(ln) ? ln : [];
    if (removeDuplicates) line = removeDuplicatePoints(line, eps);
    if (openClosed) line = openIfClosed(line, eps);
    if (removeCollinear) line = removeCollinearPoints(line, eps);
    return line;
  });

  if (!dropShort) return cleaned;
  return cleaned.filter((ln) => ln && ln.length >= 2);
}

// -------------------------
// Transform parsing & composition (2D affine)
// -------------------------

// 2D affine matrix: [a, b, c, d, e, f] meaning:
// x' = a*x + c*y + e
// y' = b*x + d*y + f
function matIdentity() {
  return [1, 0, 0, 1, 0, 0];
}

function matMul(m1, m2) {
  // m = m1 * m2  (apply m2 first, then m1)
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

function matTranslate(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}

function matScale(sx, sy) {
  return [sx, 0, 0, sy, 0, 0];
}

function matRotate(deg) {
  const rad = (deg || 0) * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, 0, 0];
}

// Parse a transform attribute into an affine matrix.
// Supports: matrix(a b c d e f), translate, scale, rotate.
// Order matters and we respect SVG order: transform="A B C" means apply A then B then C.
// In matrix terms: M = I; for each op in order: M = M * OpMatrix
function parseTransformToMatrix(transformStr) {
  const t = String(transformStr || '').trim();
  if (!t) return matIdentity();

  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi;
  let m;
  let M = matIdentity();

  while ((m = re.exec(t)) !== null) {
    const type = m[1].toLowerCase();
    const args = m[2]
      .replace(/,/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));

    let Op = matIdentity();

    if (type === 'matrix' && args.length >= 6) {
      Op = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (type === 'translate') {
      const tx = args[0] ?? 0;
      const ty = args[1] ?? 0;
      Op = matTranslate(tx, ty);
    } else if (type === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args.length > 1 ? args[1] : sx;
      Op = matScale(sx, sy);
    } else if (type === 'rotate') {
      // rotate(a) or rotate(a cx cy)
      const a = args[0] ?? 0;
      if (args.length >= 3) {
        const cx = args[1];
        const cy = args[2];
        // T(cx,cy) * R(a) * T(-cx,-cy)
        Op = matMul(matTranslate(cx, cy), matMul(matRotate(a), matTranslate(-cx, -cy)));
      } else {
        Op = matRotate(a);
      }
    }

    M = matMul(M, Op);
  }

  return M;
}

function applyMatrixToPoint(M, x, y) {
  const [a, b, c, d, e, f] = M;
  return [a * x + c * y + e, b * x + d * y + f];
}

// -------------------------
// SVG snippet extraction (paths + per-path transforms)
// -------------------------

function getRootTransformMatrix(svg) {
  // We treat the first <g ... transform="..."> as root transform for the snippet.
  const s = String(svg);
  const m = /<g\b[^>]*\btransform=(['"])(.*?)\1/i.exec(s);
  if (!m) return matIdentity();
  return parseTransformToMatrix(m[2]);
}

function extractPathElements(svg) {
  // Extract <path ...> elements and their d + transform attr.
  const s = String(svg);
  const out = [];
  const re = /<path\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const attrs = m[1] || '';
    const dm = /\bd=(['"])(.*?)\1/i.exec(attrs);
    if (!dm) continue;
    const tm = /\btransform=(['"])(.*?)\1/i.exec(attrs);
    out.push({
      d: dm[2],
      transform: tm ? tm[2] : ''
    });
  }
  return out;
}

function extractPolylineElementsAsPath(svg) {
  // Extract <polyline points="..."> and optional transform.
  const s = String(svg);
  const out = [];
  const re = /<polyline\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const attrs = m[1] || '';
    const pm = /\bpoints=(['"])(.*?)\1/i.exec(attrs);
    if (!pm) continue;
    const tm = /\btransform=(['"])(.*?)\1/i.exec(attrs);

    const pts = (pm[2] || '').trim();
    const nums = pts
      .replace(/,/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    if (nums.length < 4) continue;

    let d = `M${nums[0]} ${nums[1]}`;
    for (let i = 2; i < nums.length; i += 2) {
      d += ` L${nums[i]} ${nums[i + 1]}`;
    }

    out.push({
      d,
      transform: tm ? tm[2] : ''
    });
  }
  return out;
}

// -------------------------
// Minimal path parsing/serialization (enough for Hershey-ish output)
// Supports: M/L/C/Q/Z and lowercase relatives.
// -------------------------

function parsePathD(d) {
  const tokens = String(d)
    .replace(/,/g, ' ')
    .match(/[a-zA-Z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!tokens) return [];

  let i = 0;
  let cmd = null;
  let cx = 0, cy = 0;
  let sx = 0, sy = 0;
  const out = [];

  const isCmd = (t) => /^[a-zA-Z]$/.test(t);
  const nextNum = () => {
    const t = tokens[i++];
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (isCmd(t)) {
      cmd = t;
      i++;
    }
    if (!cmd) break;

    const lower = cmd.toLowerCase();
    const isRel = cmd === lower;

    if (lower === 'm') {
      const x = nextNum(); const y = nextNum();
      if (x == null || y == null) break;
      const nx = isRel ? cx + x : x;
      const ny = isRel ? cy + y : y;
      out.push(['M', nx, ny]);
      cx = nx; cy = ny;
      sx = nx; sy = ny;

      // implicit lineto
      while (i < tokens.length && !isCmd(tokens[i])) {
        const lx = nextNum(); const ly = nextNum();
        if (lx == null || ly == null) break;
        const ax = isRel ? cx + lx : lx;
        const ay = isRel ? cy + ly : ly;
        out.push(['L', ax, ay]);
        cx = ax; cy = ay;
      }
    } else if (lower === 'l') {
      while (i < tokens.length && !isCmd(tokens[i])) {
        const x = nextNum(); const y = nextNum();
        if (x == null || y == null) break;
        const nx = isRel ? cx + x : x;
        const ny = isRel ? cy + y : y;
        out.push(['L', nx, ny]);
        cx = nx; cy = ny;
      }
    } else if (lower === 'c') {
      while (i < tokens.length && !isCmd(tokens[i])) {
        const x1 = nextNum(), y1 = nextNum();
        const x2 = nextNum(), y2 = nextNum();
        const x = nextNum(), y = nextNum();
        if ([x1,y1,x2,y2,x,y].some(v => v == null)) break;

        const ax1 = isRel ? cx + x1 : x1;
        const ay1 = isRel ? cy + y1 : y1;
        const ax2 = isRel ? cx + x2 : x2;
        const ay2 = isRel ? cy + y2 : y2;
        const ax = isRel ? cx + x : x;
        const ay = isRel ? cy + y : y;

        out.push(['C', ax1, ay1, ax2, ay2, ax, ay]);
        cx = ax; cy = ay;
      }
    } else if (lower === 'q') {
      while (i < tokens.length && !isCmd(tokens[i])) {
        const x1 = nextNum(), y1 = nextNum();
        const x = nextNum(), y = nextNum();
        if ([x1,y1,x,y].some(v => v == null)) break;

        const ax1 = isRel ? cx + x1 : x1;
        const ay1 = isRel ? cy + y1 : y1;
        const ax = isRel ? cx + x : x;
        const ay = isRel ? cy + y : y;

        out.push(['Q', ax1, ay1, ax, ay]);
        cx = ax; cy = ay;
      }
    } else if (lower === 'z') {
      out.push(['Z']);
      cx = sx; cy = sy;
    } else {
      // unsupported -> stop predictably
      break;
    }
  }

  return out;
}

function serializePath(commands, digits = 5, { dropZ = false } = {}) {
  const f = (n) => fmt(n, digits);
  return commands.map(c => {
    const t = c[0];
    if (t === 'Z') return dropZ ? '' : 'Z';
    if (t === 'M' || t === 'L') return `${t}${f(c[1])} ${f(c[2])}`;
    if (t === 'C') return `${t}${f(c[1])} ${f(c[2])} ${f(c[3])} ${f(c[4])} ${f(c[5])} ${f(c[6])}`;
    if (t === 'Q') return `${t}${f(c[1])} ${f(c[2])} ${f(c[3])} ${f(c[4])}`;
    return '';
  }).filter(Boolean).join(' ');
}

function applyMatrixToCommands(commands, M) {
  return commands.map((c) => {
    const t = c[0];
    if (t === 'Z') return ['Z'];
    const out = [t];
    for (let i = 1; i < c.length; i += 2) {
      const [nx, ny] = applyMatrixToPoint(M, c[i], c[i + 1]);
      out.push(nx, ny);
    }
    return out;
  });
}

// -------------------------
// placeRaw
// -------------------------

/**
 * placeRaw(svgSnippet, placement, options?)
 *
 * placement is in *units*:
 *   { x, y, scale, rotate }
 *
 * options:
 *  - mode: 'raw' | 'paths'   (default 'raw')
 *  - includePolylines: boolean (default true)
 *  - precision: number (default 5)
 *  - dropZ: boolean (default true for text strokes)
 *
 * Returns:
 *  - mode 'raw'  : string "<g transform=...>...</g>"
 *  - mode 'paths': array of path-data strings with ALL transforms baked into coordinates
 */
function placeRaw(
  svgSnippet,
  { x = 0, y = 0, scale = 1, rotate = 0 } = {},
  opt = {}
) {
  const {
    mode = 'raw',
    includePolylines = true,
    precision = 5,
    dropZ = true
  } = opt;

  if (mode === 'raw') {
    // NOTE: since everything is already in units, we keep the transform in units too.
    const tf = rotate
      ? `translate(${fmt(x, precision)} ${fmt(y, precision)}) rotate(${fmt(rotate, precision)}) scale(${fmt(scale, precision)})`
      : `translate(${fmt(x, precision)} ${fmt(y, precision)}) scale(${fmt(scale, precision)})`;
    return `<g transform="${tf}">\n${svgSnippet}\n</g>`;
  }

  // mode === 'paths':
  // Compose a full matrix:
  // Final = UserPlacement * RootSnippetTransform * PerPathTransform * Geometry
  //
  // - RootSnippetTransform comes from the first <g transform="..."> in the snippet (common in hershey output)
  // - PerPathTransform comes from each <path transform="...">
  //
  const M_user = matMul(
    matTranslate(x, y),
    matMul(matRotate(rotate), matScale(scale, scale))
  );

  const M_root = getRootTransformMatrix(svgSnippet);

  let elems = extractPathElements(svgSnippet);
  if (includePolylines) elems = elems.concat(extractPolylineElementsAsPath(svgSnippet));

  const out = elems.map(({ d, transform }) => {
    const M_path = transform ? parseTransformToMatrix(transform) : matIdentity();

    // SVG order: geometry -> path -> root -> user
    // In matrix composition: M_total = M_user * M_root * M_path
    const M_total = matMul(M_user, matMul(M_root, M_path));

    const cmds = parsePathD(d);
    const tcmds = applyMatrixToCommands(cmds, M_total);
    return serializePath(tcmds, precision, { dropZ });
  }).filter(Boolean);

  return out;
}

// -------------------------
// Grouped SVG output
// -------------------------

/**
 * renderGroupedSVG(groups, options)
 *
 * groups: array of:
 *   { id, lines?, raw?, paths? }
 *
 * - lines: array of polylines (already in units)
 * - raw  : svg snippet string (injected as-is; outer <svg> stripped if present)
 * - paths: array of pure path-data strings (already in units)
 *
 * options.cleanLines: if true, cleans polylines before output
 */
function renderGroupedSVG(groups, options = {}) {
  const {
    width,
    height,
    units = 'mm',

    // top-level styling
    stroke = 'black',
    fill = 'none',
    strokeWidth = 0.2, // in `units`
    lineJoin = 'round',
    lineCap = 'round',

    // numeric formatting
    precision = 5,

    // optional: add inkscape layer metadata
    inkscapeLayers = false,

    // optional: clean polyline geometry before writing
    cleanLines = false,
    cleanOptions = {
      removeDuplicates: true,
      removeCollinear: false,
      openClosed: true,
      eps: 1e-6,
      dropShort: true
    }
  } = options;

  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('renderGroupedSVG: options.width and options.height are required numbers.');
  }
  if (!Array.isArray(groups)) {
    throw new Error('renderGroupedSVG: groups must be an array like [{ id, lines }].');
  }

  // ViewBox in units (no conversion)
  const viewW = width;
  const viewH = height;

  const xmlHeader =
    `<?xml version="1.0" standalone="no"?>\n` +
    `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n` +
    `  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`;

  const inkscapeNS = inkscapeLayers
    ? ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'
    : '';

  let out = '';
  out += xmlHeader + '\n';
  out += `<svg width="${fmt(width, precision)}${escapeAttr(units)}" height="${fmt(height, precision)}${escapeAttr(units)}"\n`;
  out += `  xmlns="http://www.w3.org/2000/svg"${inkscapeNS} version="1.1" viewBox="0 0 ${fmt(viewW, precision)} ${fmt(viewH, precision)}">\n`;

  // Outer style group
  out += `  <g fill="${escapeAttr(fill)}" stroke="${escapeAttr(stroke)}" stroke-width="${fmt(strokeWidth, precision)}${escapeAttr(units)}" stroke-linejoin="${escapeAttr(lineJoin)}" stroke-linecap="${escapeAttr(lineCap)}">\n`;

  for (const g of groups) {
    const id = g && g.id ? String(g.id) : '';
    let lines = g && Array.isArray(g.lines) ? g.lines : [];
    const raw = g && typeof g.raw === 'string' ? g.raw : null;
    const paths = g && Array.isArray(g.paths) ? g.paths : null;

    if (cleanLines) lines = cleanPolylines(lines, cleanOptions);

    const layerAttrs = inkscapeLayers
      ? ` inkscape:groupmode="layer" inkscape:label="${escapeAttr(id || 'layer')}"`
      : '';

    out += `    <g${id ? ` id="${escapeAttr(id)}"` : ''}${layerAttrs}>\n`;

    // Raw svg snippet passthrough
    if (raw && raw.trim()) {
      out += `      ${stripOuterSVG(raw)}\n`;
    }

    // Array of path-data strings
    if (paths && paths.length) {
      for (const d of paths) {
        if (!d) continue;
        out += `      <path d="${escapeAttr(d)}" />\n`;
      }
    }

    // Polylines
    for (const polyline of lines) {
      const d = polylineToPathD(polyline, precision);
      if (d) out += `      <path d="${escapeAttr(d)}" />\n`;
    }

    out += `    </g>\n`;
  }

  out += `  </g>\n`;
  out += `</svg>\n`;
  return out;
}

// -------------------------
// Convenience
// -------------------------

function bundleRawGroups(groupId, snippets) {
  const inner = (snippets || [])
    .filter(Boolean)
    .map((s) => String(s).trim())
    .join('\n');

  return `<g id="${escapeAttr(groupId)}">\n${inner}\n</g>`;
}

module.exports = {
  renderGroupedSVG,
  bundleRawGroups,
  placeRaw,

  // optional exports (handy for debugging)
  cleanPolylines,
  polylineToPathD,
  stripOuterSVG
};
