const CONFIG = {
    triangleCount: 500,     
    
    baseColor: { r: 15, g: 25, b: 35 },    
    brightColor: { r: 35, g: 75, b: 110 }, 
    opacity: 1.0,

    // Listen to first 40 frequencies (Bass)
    FREQ_RANGE: 40,         
    FREQ_MULTI: 0.1,        
    SOUND_SENSITIVITY: 1.5, 
    // 1 Audio Hit = 2 Triangles
    SPLAT_TO_TRIANGLE: 2   
};


// Delaunay library
var Delaunay;
(function() {
    "use strict";
    var EPSILON = 1.0 / 1048576.0;
    function supertriangle(vertices) {
        var xmin = Number.POSITIVE_INFINITY, ymin = Number.POSITIVE_INFINITY,
            xmax = Number.NEGATIVE_INFINITY, ymax = Number.NEGATIVE_INFINITY,
            i, dx, dy, dmax, xmid, ymid;
        for(i = vertices.length; i--; ) {
            if(vertices[i][0] < xmin) xmin = vertices[i][0];
            if(vertices[i][0] > xmax) xmax = vertices[i][0];
            if(vertices[i][1] < ymin) ymin = vertices[i][1];
            if(vertices[i][1] > ymax) ymax = vertices[i][1];
        }
        dx = xmax - xmin; dy = ymax - ymin;
        dmax = Math.max(dx, dy);
        xmid = xmin + dx * 0.5; ymid = ymin + dy * 0.5;
        return [
            [xmid - 20 * dmax, ymid - dmax],
            [xmid, ymid + 20 * dmax],
            [xmid + 20 * dmax, ymid - dmax]
        ];
    }
    function circumcircle(vertices, i, j, k) {
        var x1 = vertices[i][0], y1 = vertices[i][1],
            x2 = vertices[j][0], y2 = vertices[j][1],
            x3 = vertices[k][0], y3 = vertices[k][1],
            fabsy1y2 = Math.abs(y1 - y2), fabsy2y3 = Math.abs(y2 - y3),
            xc, yc, m1, m2, mx1, mx2, my1, my2, dx, dy;
        if(fabsy1y2 < EPSILON && fabsy2y3 < EPSILON) throw new Error("Coincident points!");
        if(fabsy1y2 < EPSILON) {
            m2 = -((x3 - x2) / (y3 - y2)); mx2 = (x2 + x3) / 2.0; my2 = (y2 + y3) / 2.0;
            xc = (x2 + x1) / 2.0; yc = m2 * (xc - mx2) + my2;
        } else if(fabsy2y3 < EPSILON) {
            m1 = -((x2 - x1) / (y2 - y1)); mx1 = (x1 + x2) / 2.0; my1 = (y1 + y2) / 2.0;
            xc = (x3 + x2) / 2.0; yc = m1 * (xc - mx1) + my1;
        } else {
            m1 = -((x2 - x1) / (y2 - y1)); m2 = -((x3 - x2) / (y3 - y2));
            mx1 = (x1 + x2) / 2.0; mx2 = (x2 + x3) / 2.0; my1 = (y1 + y2) / 2.0; my2 = (y2 + y3) / 2.0;
            xc = (m1 * mx1 - m2 * mx2 + my2 - my1) / (m1 - m2);
            yc = (fabsy1y2 > fabsy2y3) ? m1 * (xc - mx1) + my1 : m2 * (xc - mx2) + my2;
        }
        dx = x2 - xc; dy = y2 - yc;
        return {i: i, j: j, k: k, x: xc, y: yc, r: dx * dx + dy * dy};
    }
    function dedup(edges) {
        var i, j, a, b, m, n;
        for(j = edges.length; j; ) {
            b = edges[--j]; a = edges[--j];
            for(i = j; i; ) {
                n = edges[--i]; m = edges[--i];
                if((a === m && b === n) || (a === n && b === m)) {
                    edges.splice(j, 2); edges.splice(i, 2); break;
                }
            }
        }
    }
    Delaunay = {
        triangulate: function(vertices, key) {
            var n = vertices.length, i, j, indices, st, open, closed, edges, dx, dy, a, b, c;
            if(n < 3) return [];
            vertices = vertices.slice(0);
            if(key) for(i = n; i--; ) vertices[i] = vertices[i][key];
            indices = new Array(n);
            for(i = n; i--; ) indices[i] = i;
            indices.sort(function(i, j) { return vertices[j][0] - vertices[i][0]; });
            st = supertriangle(vertices);
            vertices.push(st[0], st[1], st[2]);
            open = [circumcircle(vertices, n + 0, n + 1, n + 2)];
            closed = []; edges = [];
            for(i = indices.length; i--; edges.length = 0) {
                c = indices[i];
                for(j = open.length; j--; ) {
                    dx = vertices[c][0] - open[j].x;
                    if(dx > 0.0 && dx * dx > open[j].r) { closed.push(open[j]); open.splice(j, 1); continue; }
                    dy = vertices[c][1] - open[j].y;
                    if(dx * dx + dy * dy - open[j].r > EPSILON) continue;
                    edges.push(open[j].i, open[j].j, open[j].j, open[j].k, open[j].k, open[j].i);
                    open.splice(j, 1);
                }
                dedup(edges);
                for(j = edges.length; j; ) {
                    b = edges[--j]; a = edges[--j];
                    open.push(circumcircle(vertices, a, b, c));
                }
            }
            for(i = open.length; i--; ) closed.push(open[i]);
            open.length = 0;
            for(i = closed.length; i--; )
                if(closed[i].i < n && closed[i].j < n && closed[i].k < n)
                    open.push(closed[i].i, closed[i].j, closed[i].k);
            return open;
        }
    };
})();

// Cached Background
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Static canvas to store background to avoid redrawing each triangles every frame
const bgCanvas = document.createElement('canvas');
const bgCtx = bgCanvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

let geometry = {
    vertices: [],
    triangles: [],      
    staticColors: [],   
    totalTriangles: 0
};

function generateMesh() {
    width = window.innerWidth;
    height = window.innerHeight;
    
    // Resize both canvases
    canvas.width = width;
    canvas.height = height;
    bgCanvas.width = width;
    bgCanvas.height = height;

    let vertices = [];
    const bleed = 150; 
    
    // Corners & Edges
    vertices.push([-bleed, -bleed]);
    vertices.push([width + bleed, -bleed]);
    vertices.push([-bleed, height + bleed]);
    vertices.push([width + bleed, height + bleed]);
    vertices.push([width/2, -bleed]);
    vertices.push([width/2, height + bleed]);
    
    // Random Points
    const count = CONFIG.triangleCount / 2; 
    for (let i = 0; i < count; i++) {
        vertices.push([
            Math.random() * (width + bleed * 2) - bleed,
            Math.random() * (height + bleed * 2) - bleed
        ]);
    }

    geometry.vertices = vertices;
    geometry.triangles = Delaunay.triangulate(vertices);
    geometry.totalTriangles = Math.floor(geometry.triangles.length / 3);
    
    // Generate Static Colors
    geometry.staticColors = [];
    for(let i = 0; i < geometry.totalTriangles; i++) {
        const variance = Math.floor((Math.random() * 20) - 10);
        const r = Math.max(0, Math.min(255, CONFIG.baseColor.r + variance));
        const g = Math.max(0, Math.min(255, CONFIG.baseColor.g + variance));
        const b = Math.max(0, Math.min(255, CONFIG.baseColor.b + variance));
        geometry.staticColors.push(`rgba(${r}, ${g}, ${b}, ${CONFIG.opacity})`);
    }

    // Draw static bg in memory
    drawStaticBackgroundToCache();
    
    ctx.drawImage(bgCanvas, 0, 0);
}

function drawStaticBackgroundToCache() {
    bgCtx.clearRect(0, 0, width, height);
    for(let i = 0; i < geometry.totalTriangles; i++) {
        drawTriangle(bgCtx, i, geometry.staticColors[i]);
    }
}

function drawTriangle(context, index, colorStr) {
    const vIndex = index * 3;
    if(vIndex + 2 >= geometry.triangles.length) return; 

    const p0 = geometry.vertices[geometry.triangles[vIndex]];
    const p1 = geometry.vertices[geometry.triangles[vIndex+1]];
    const p2 = geometry.vertices[geometry.triangles[vIndex+2]];

    context.beginPath();
    context.moveTo(p0[0], p0[1]);
    context.lineTo(p1[0], p1[1]);
    context.lineTo(p2[0], p2[1]);
    context.closePath();

    context.fillStyle = colorStr;
    context.strokeStyle = colorStr;
    context.lineWidth = 1; 
    context.lineJoin = 'round';
    context.stroke();
    context.fill();
}

// Draws the constant background first, then adds flashes on top.
function renderFrame(flashCount) {

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bgCanvas, 0, 0);

    if (flashCount > 0) {
        if(flashCount > geometry.totalTriangles) flashCount = geometry.totalTriangles;

        const bright = `rgba(${CONFIG.brightColor.r}, ${CONFIG.brightColor.g}, ${CONFIG.brightColor.b}, ${CONFIG.opacity})`;

        for(let i = 0; i < flashCount; i++) {
            const rndIndex = Math.floor(Math.random() * geometry.totalTriangles);
            drawTriangle(ctx, rndIndex, bright);
        }
    }
}

let lastBass = 0;

// Listener to audio events
function livelyAudioListener(audioArray) {
    
    if(!audioArray) return;

    // Silence case
    if (audioArray[0] === 0) {

        if (lastBass !== 0) {
            renderFrame(0);
            lastBass = 0;
        }
        return;
    }

    // 2. Calculate Bass
    let bass = 0.0;
    for (let i = 0; i <= CONFIG.FREQ_RANGE; i++) {
        bass += audioArray[i] * 2;
    }
    bass /= CONFIG.FREQ_RANGE * 2 * CONFIG.FREQ_MULTI;

    let targetSplats = Math.floor(bass * CONFIG.SOUND_SENSITIVITY * 10);

    let diff = targetSplats - lastBass;
    lastBass = targetSplats;
    
    if (diff > 0) {
        renderFrame(diff * CONFIG.SPLAT_TO_TRIANGLE);
    } else {
        renderFrame(0);
    }
}

// Events
window.addEventListener('resize', generateMesh);

// Init
generateMesh();