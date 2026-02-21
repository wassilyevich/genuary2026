const canvasSketch = require("canvas-sketch");
const {
    renderPaths,
    createPath,
    pathsToPolylines,
} = require("canvas-sketch-util/penplot");
const { clipPolylinesToBox } = require("canvas-sketch-util/geometry");
const Random = require("canvas-sketch-util/random");
const math = require("canvas-sketch-util/math");
const {
    bundleRawGroups,
    placeRaw,
    makeUnitConverters,
    renderGroupedSVG,
} = require("./penplot-utils");
// You can force a specific seed by replacing this with a string value
const defaultSeed = "";

// Set a random seed so we can reproduce this print later
Random.setSeed(defaultSeed || Random.getRandomSeed());

// Print to console so we can see which seed is being used and copy it if desired
console.log("Random Seed:", Random.getSeed());

const settings = {
    suffix: Random.getSeed(),
    dimensions: "A3",
    orientation: "portrait",
    pixelsPerInch: 300,
    scaleToView: true,
    units: "mm",
};

const params = {
    margin: 15,
    penWidth: 0.4,
    vertices: 4000,
    iters: 25,
    initWidth: 0.5,
    dtheta: 100,
    freq: 0.05,
};

function ufunc1(
    c,
    center = { x: 0, y: 0 },
    origin,
    maxWidth,
    maxHeight,
    initWidth,
) {
    let { x, y } = pol2cart(c.r, c.theta, center);
    x = math.mapRange(x, origin.x, origin.x + maxWidth, 0, Math.PI * 2, true);
    y = math.mapRange(y, origin.y, origin.y + maxHeight, 0, Math.PI * 2, true);

    return {
        r: math.mapRange(
            sin(x) + 0.5 * sin(3 * x),
            -1,
            1,
            c.r * 0.99,
            c.r * 1.01,
        ),
        theta: c.theta * 0.99,
    };
}

function ufunc2(
    c,
    center = { x: 0, y: 0 },
    origin,
    maxWidth,
    maxHeight,
    initWidth,
) {
    let { x, y } = pol2cart(c.r, c.theta, center);
    x = math.mapRange(x, origin.x, origin.x + maxWidth, 0, Math.PI * 2, true);
    y = math.mapRange(y, origin.y, origin.y + maxHeight, 0, Math.PI * 2, true);

    return {
        r: math.mapRange(
            sin(x) + 0.5 * sin(3 * x),
            -1,
            1,
            c.r * 0.98,
            c.r * 1.02,
        ),
        theta: c.theta,
    };
}

function ufunc3(
    c,
    center = { x: 0, y: 0 },
    origin,
    maxWidth,
    maxHeight,
    initWidth,
) {
    let { x, y } = pol2cart(c.r, c.theta, center);
    x = math.mapRange(x, origin.x, origin.x + maxWidth, 0, Math.PI * 2, true);
    y = math.mapRange(y, origin.y, origin.y + maxHeight, 0, Math.PI * 2, true);

    return {
        r: math.mapRange(
            cos(x) + 0.5 * sin(6 * x),
            -1,
            1,
            c.r * 0.97,
            c.r * 1.03,
        ),
        theta: c.theta,
    };
}
const sketch = (props) => {
    const { width, height, units } = props;

    // PREP
    const margin = params.margin;
    const drawWidth = width - 2 * margin;
    const drawHeight = height - 2 * margin;
    const origin = { x: margin, y: margin };
    const paths1 = [];
    const paths2 = [];
    const paths3 = [];
    // SHAPE1
    const shape1 = new Shape(
        params.vertices,
        origin,
        drawWidth,
        drawHeight,
        params.initWidth,
    );

    for (let i = 0; i < params.iters; i++) {
        shape1.drawCart(paths1);
        shape1.updatePol(ufunc1);
    }

    // SHAPE2
    const shape2 = new Shape(
        params.vertices,
        origin,
        drawWidth,
        drawHeight,
        params.initWidth / 1.8,
    );

    for (let i = 0; i < params.iters; i++) {
        if (i != 0) {
            shape2.drawCart(paths2);
        }
        shape2.updatePol(ufunc2);
    }

    // SHAPE2
    const shape3 = new Shape(
        1000,
        origin,
        drawWidth,
        drawHeight,
        params.initWidth / 4.1,
    );

    for (let i = 0; i < params.iters; i++) {
        if (i != 0) {
            shape3.drawCart(paths3);
        }
        shape3.updatePol(ufunc3);
    }
    // ACTUAL RENDERING/OUTPUTTING
    return ({ context, width, height, units, exporting }) => {
        let lines1 = pathsToPolylines(paths1, { units });
        let lines2 = pathsToPolylines(paths2, { units });
        let lines3 = pathsToPolylines(paths3, { units });

        const groups = [
            { id: "lines1", lines: lines1 },
            { id: "lines2", lines: lines2 },
            { id: "lines3", lines: lines3 },
        ];
        if (context && exporting) {
            const svg = renderGroupedSVG(groups, {
                width,
                height,
                units: settings.units,
                strokeWidth: params.penWidth,
                lineJoin: "round",
                lineCap: "round",
                inkscapeLayers: false,
            });
            return {
                name: "grouped-",
                suffix: `S-${Date.now()}`,
                data: svg,
                extension: ".svg",
            };
        }

        // PNG preview: render alles plat (zoals altijd)
        if (!exporting) {
            return renderPaths([...lines1, ...lines2, ...lines3], {
                context,
                width,
                height,
                units: settings.units,
                lineJoin: "round",
                lineCap: "round",
                lineWidth: params.penWidth,
                optimize: false,
            });
        }
    };
};

canvasSketch(sketch, settings);

// CLASSES

class Shape {
    constructor(nv, origin, drawWidth, drawHeight, initWidth) {
        this.nv = nv;
        this.origin = origin;
        this.drawWidth = drawWidth;
        this.drawHeight = drawHeight;
        this.initWidth = initWidth;
        this.verts = [];
        this.init();
    }
    init() {
        for (let i = 0; i < this.nv; i++) {
            let theta = ((2 * Math.PI) / this.nv) * i;
            let r = this.drawWidth * this.initWidth;
            this.verts.push(
                pol2cart(r, theta, {
                    x: this.origin.x + this.drawWidth / 2,
                    y: this.origin.y + this.drawHeight / 2,
                }),
            );
        }
    }

    drawCart(paths) {
        const p = createPath();
        p.moveTo(this.verts[0].x, this.verts[0].y);
        for (let i = 1; i < this.nv; i++) {
            p.lineTo(this.verts[i].x, this.verts[i].y);
        }
        p.closePath();
        paths.push(p);
    }

    updatePol(ufunc) {
        const center = {
            x: this.origin.x + this.drawWidth / 2,
            y: this.origin.y + this.drawHeight / 2,
        };

        this.verts = this.verts.map((v) => {
            const vertPol = cart2pol(v.x, v.y, center);
            const uvertPol = ufunc(
                vertPol,
                center,
                this.origin,
                this.drawWidth,
                this.drawHeight,
                this.initWidth,
            );
            return pol2cart(uvertPol.r, uvertPol.theta, center);
        });
    }
}
// FUNCTIONS
function pol2cart(r, theta, xyorigin = { x: 0, y: 0 }) {
    return {
        x: r * Math.cos(theta) + xyorigin.x,
        y: r * Math.sin(theta) + xyorigin.y,
    };
}

function cart2pol(x, y, o = { x: 0, y: 0 }) {
    const dx = x - o.x;
    const dy = y - o.y;
    const theta = Math.atan2(dy, dx);
    const r = Math.hypot(dx, dy);
    return { r, theta };
}

function sin(x) {
    return Math.sin(x);
}

function cos(x) {
    return Math.cos(x);
}
