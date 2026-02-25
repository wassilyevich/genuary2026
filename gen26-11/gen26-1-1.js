const canvasSketch = require("canvas-sketch");

const settings = {
    dimensions: [1080, 1080],
    animate: true,
    context: "2d",
};

// Pak de URL van het script dat nu draait (meestal de bundle)
function getBundleURL() {
    const scripts = Array.from(document.scripts);
    // vaak is de laatste <script src="..."> de bundle
    for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].src;
        if (src) return src;
    }
    return null;
}

async function getSourceText() {
    const url = getBundleURL();
    if (!url) return "// could not find script url";
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    return txt;
}

// --- je sketch ---
const sketch = async () => {
    const source = await getSourceText();

    // maak hier je nodes/woorden/etc op basis van `source`
    // (voor nu: quick visual sanity check)
    return ({ context: ctx, width, height, time }) => {
        ctx.fillStyle = "#0b0d10";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
        ctx.textBaseline = "top";

        // toon gewoon een stuk tekst als test
        const slice = source.slice(0, 2000);
        const lines = slice.split("\n");

        let y = 24;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 24, y);
            y += 18;
            if (y > height - 24) break;
        }
    };
};

canvasSketch(sketch, settings);
