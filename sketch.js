// ---------- params you can tweak ----------
const STEP = 5;             // sampling step for statue (bigger = fewer points, faster)
const RELIEF = 50;          // small base z-relief from brightness
const SPIKE_MAX = 90;      // max spike length outward
const BEAT_FREQ = 1.6;      // pulse speed
const ROT_SPEED = 0.0025;   // slow global spin
const STATUE_SCALE = 2.0;   // pixel->world scale for statue sampling
const BRIGHTEN = 1;      // 1.0 = unchanged voxel brightness
// -----------------------------------------

let archImg, statueImg, backStoryG;
let t = 0, ang = 0;
let seeds = [];
let pulseLP = 0;        // low-pass filtered pulse



function preload() {
  // make sure these filenames exist in your project folder:
  archImg   = loadImage('arch.png');           // the niche/arch PNG
  statueImg = loadImage('statuefigure.png');   // cut-out statue PNG
}

function setup() {
  createCanvas(900, 900, WEBGL);
  pixelDensity(1);

  // keep statue manageable for sampling
  statueImg.resize(280, 0);

  // per-sample seeds (stable choice of who spikes each beat)
  for (let y = 0; y < statueImg.height; y += STEP) {
    for (let x = 0; x < statueImg.width; x += STEP) {
      seeds.push(noise(x * 0.05, y * 0.05));
    }
  }
// rebuild backStoryG in setup()
backStoryG = createGraphics(1200, 900);  // wider so letters have room
backStoryG.pixelDensity(1);
backStoryG.clear();
backStoryG.noStroke();
backStoryG.textAlign(CENTER, CENTER);

const lines = [
  "MEDIA OFFLINE — please reconnect your myth.",
  "FICHEIRO EM FALTA — tente outra versão de mim.",
  "MÍDIA OFFLINE — história em reconexão.",
  "MEDIOS SIN CONEXIÓN — vuelva a intentarlo con ternura.",
  "MÉDIA HORS LIGNE — réimporter votre regard.",
  "DATEI FEHLT — vielleicht nunca existiu.",
  "ARCHIVO FALTANTE — ¿quién agregó esta etiqueta?",
  "ASSET NOT FOUND — using placeholder self.",
  "LINK BROKEN — narrative relinking…",
  "PLACEHOLDER ACTIVE — authenticity loading."
];

// fewer, bigger lines with jitter so it stays organic
for (let y = 80; y < backStoryG.height; y += 90) {
  for (let x = 120; x < backStoryG.width; x += 220) {
    const s   = random(lines);
    const big = random() < 0.16;
    backStoryG.fill(255, big ? 95 : 50);
    backStoryG.textSize(big ? 34 : 26);
    backStoryG.text(s, x + random(-14,14), y + random(-12,12));
  }
}

// watermark
backStoryG.push();
backStoryG.translate(backStoryG.width/2, backStoryG.height/2);
backStoryG.rotate(-0.25);
backStoryG.textSize(110);
backStoryG.fill(255, 24);
backStoryG.text("MEDIA OFFLINE (ME)", 0, 0);
backStoryG.pop();


// faint checker (controlled glitch)
backStoryG.fill(255, 12);
for (let yy = 0; yy < backStoryG.height; yy += 36) {
  for (let xx = 0; xx < backStoryG.width; xx += 36) {
    if (((xx + yy) / 36) % 2 === 0) backStoryG.rect(xx, yy, 36, 36);
    
    
  }
}


  noStroke();
}

function draw() {
  background(8);
  orbitControl();

  // lights
ambientLight(140);                                
directionalLight(255, 255, 255, -0.4, -0.8, -1);
pointLight(255, 255, 255, -120, -180, 260);       

  // gentle float + slow turn
  const yFloat = sin(t * 0.6) * 10;
  translate(0, yFloat, 0);
  rotateY(ang);
  ang += ROT_SPEED;
  t += 0.02;

  // common statue dims
  const cols = statueImg.width;
  const rows = statueImg.height;
  const halfCols = cols / 2;
  const halfRows = rows / 2;

  // -------- ARCH: swings like a pendulum and has a back face --------
  push();
  const archAspect = archImg.width / archImg.height;
  const archHeight = rows * STATUE_SCALE * 1.10;     // proportional to statue
  const archWidth  = archHeight * archAspect;

  const ARCH_SWING = 0.6;        // radians (~34° each side)
  const ARCH_SPEED = 0.25;  // was 0.4

  const archAngle  = sin(t * ARCH_SPEED) * ARCH_SWING;

  translate(0, 0, -60);          // behind statue
  rotateY(archAngle);
  
  

  // front face arch
  push();
  tint(255);
  texture(archImg);
  plane(archWidth, archHeight);
  pop();

  // back face (others' story)
// --- Curved multilingual band (subtle, close, behind) ---
const SEG    = .8;                         // fewer, wider segments (less squish)
const radius = archWidth * .1;           // smaller radius = closer to the niche
const bandH  = archHeight * .5;
const segW   = (TWO_PI * radius) / SEG;
const arc    = 0.12;                       // gentler arc than before

// optional: small horizontal nudge if needed (pixels in world units)
const TEXT_X_OFFSET = -20;   // try -20 .. +20 to center

push();
  translate(TEXT_X_OFFSET, 0, 0); // <-- centering nudge for the whole band
for (let i = 0; i < SEG; i++) {
  const a = map(i + 0.5, 0, SEG, -arc, arc);
  push();
   //rotateY(PI);                     
  translate(0, 0, -(radius));          // less negative = closer to arch
  scale(-1, 1);
  blendMode(SCREEN);                        // keeps it airy
  tint(255, 180, 180, 140);
  texture(backStoryG);
  plane(segW * 0.90, bandH);               // a bit narrower to avoid overlap
  blendMode(BLEND);
  pop();
}
pop();




  
// soft feather around edges (no stroke -> no slash)
push();
noStroke();
fill(0, 70);
plane(archWidth * 1.02, archHeight * 1.02);
pop();

  pop();
  // ------------------------------------------------------------------

  // -------- STATUE: intact plane + edge-aware voxel spikes ----------
  push();
  statueImg.loadPixels();

  // center the statue block
  translate(-halfCols * STATUE_SCALE, -halfRows * STATUE_SCALE, 0);

  // intact statue plane behind the voxels
push();
translate(halfCols * STATUE_SCALE, halfRows * STATUE_SCALE, -2);
tint(255, 40);   
texture(statueImg);
plane(cols * STATUE_SCALE, rows * STATUE_SCALE);

// subtle additive lift for readability (very low)
blendMode(ADD);
tint(255, 50);                   // small boost
plane(cols * STATUE_SCALE, rows * STATUE_SCALE);
blendMode(BLEND);
pop();


const beat   = (sin(t * (BEAT_FREQ * 0.5)) * 0.5 + 0.5);
pulseLP = lerp(pulseLP, pow(beat, 3.0), 0.035);

const pulse = pulseLP;



  let k = 0; // seed index

  for (let y = 0; y < rows; y += STEP) {
    for (let x = 0; x < cols; x += STEP) {

      const idx = 4 * (x + y * cols);
      const r = statueImg.pixels[idx + 0];
      const g = statueImg.pixels[idx + 1];
      const b = statueImg.pixels[idx + 2];
      const a = statueImg.pixels[idx + 3];
      if (a < 30) { k++; continue; }  // skip transparent

      // brightness + small base relief
      const br = (r + g + b) / 3;
      // raise base relief slightly
const z0 = map(br, 0, 255, -RELIEF * 1.25, RELIEF * 1.25);




      // center of this STEP cell (align with plane)
      const px = (x + STEP * 0.5) * STATUE_SCALE;
      const py = (y + STEP * 0.5) * STATUE_SCALE;

      // outward direction (radial) with forward (+Z) bias
      const cx = ((x + STEP * 0.5) - halfCols) / halfCols;
      const cy = ((y + STEP * 0.5) - halfRows) / halfRows;
      const forwardBias = 1.15;
      const len = max(1e-6, Math.hypot(cx, cy));
      const dx = (len === 0 ? 0 : cx / len);
      const dy = (len === 0 ? 0 : cy / len);
      const dz = forwardBias;

      // who participates this breath?
      const chooser = seeds[k++];
const brightDampen = map(br, 180, 255, 0.35, 1.0, true); // bright -> less
const takePart = chooser < (0.18 + 0.55 * pulse) * brightDampen;

      // --- local contrast (edge detection lite)
      const sx = min(cols - 1, x + STEP);
      const sy = min(rows - 1, y + STEP);
      const nx = 4 * (sx + y * cols);
      const ny = 4 * (x + sy * cols);
      const brX = (statueImg.pixels[nx] + statueImg.pixels[nx+1] + statueImg.pixels[nx+2]) / 3;
      const brY = (statueImg.pixels[ny] + statueImg.pixels[ny+1] + statueImg.pixels[ny+2]) / 3;
      let edge = (abs(br - brX) + abs(br - brY)) * 0.5;
      edge = constrain(edge / 128.0, 0, 1);  // ~0..1

      // spike length: darker + edge regions reach farther
      let spikeLen = takePart
  ? pulse * (0.5 + 0.9 * edge) * map(255 - br, 0, 255, SPIKE_MAX * 0.2, SPIKE_MAX)
  : 0;
      spikeLen *= (0.6 + 0.8 * edge);

      // tiny shimmer
    const jitter = (random() - 0.5) * 0.25;  // was 0.35


// tone with gentle gamma so midtones show, not pure white
const tone = constrain(pow(br / 255, 0.95) * 255, 24, 190);
ambientMaterial(tone);
specularMaterial(180);  // softer
shininess(6);


const boxSize = 1.5 + edge * 1.6;

      push();
      
      translate(
        px + dx * spikeLen + jitter,
        py + dy * spikeLen + jitter,
        z0 + dz * spikeLen
      );
      box(boxSize, boxSize, boxSize);
      pop();
    }
  }

  pop();
  // ------------------------------------------------------------------
}
