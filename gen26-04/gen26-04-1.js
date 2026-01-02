const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random')
const math = require('canvas-sketch-util/math')
const { renderPaths, createPath, pathsToPolylines } = require('canvas-sketch-util/penplot');
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const sanzo = require('sanzo-color');
const { bundleRawGroups, placeRaw, makeUnitConverters, renderGroupedSVG } = require('./penplot-utils');
const hershey = require('hersheytext');



// You can force a specific seed by replacing this with a string value
const defaultSeed = '';
// Set a random seed so we can reproduce this print later
random.setSeed(defaultSeed || random.getRandomSeed());

// Print to console so we can see which seed is being used and copy it if desired
console.log('Random Seed:', random.getSeed());

const settings = {
  suffix: random.getSeed(),
  dimensions: 'A4',
  units: 'mm',  // Set units to millimeters
  orientation: 'portrait',
  pixelsPerInch: 300,
  scaleToView: true,
};






const sketch = ({ context, width, height, units, exporting }) => {
  // Holds all our 'path' objects
  const paths = [];
  

  // EXPORT + RENDERING
  return ({ context, width, height, units, exporting }) => {



    // Convert the paths into polylines and clip to bounds
    let lines = pathsToPolylines(paths, { units: settings.units });

    // Clip to bounds, using a margin in working units
    const box = [margin, margin, width - margin, height - margin];
    lines = clipPolylinesToBox(lines, box);

    const groups = [
      { id: 'lines', lines: lines },

    ];


    if (context && exporting) {
      const svg = renderGroupedSVG(groups, {
        width,
        height,
        units: settings.units,
        strokeWidth: 0.2,
        lineJoin: 'round',
        lineCap: 'round',
        inkscapeLayers: false // optioneel: dan worden het echte layers in inkscape
      });
      return { name: 'grouped-', suffix: `S-${Date.now()}`, data: svg, extension: '.svg' };
    }


    // PNG preview: render alles plat (zoals altijd)
    if (!exporting) {
      return renderPaths([...lines], {
        context,
        width,
        height,
        units: settings.units,
        lineJoin: 'round',
        lineCap: 'round',
        lineWidth: 0.2,
        optimize: false
      });
    }
  };
};



// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%CLASSES AND FUNCTIONS
canvasSketch(sketch, settings);



class Grid{
  constructor(rows, cols, cellWidth, cellHeight, origin){
    this.rows = rows;
    this.cols = cols;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.origin = origin;
  }
}