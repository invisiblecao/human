// import Human from '../dist/human.esm.js'; // equivalent of @vladmandic/human
import Human from '../src/human';
import Menu from './menu.js';
import GLBench from './gl-bench.js';

const userConfig = { backend: 'webgl' }; // add any user configuration overrides

/*
const userConfig = {
  backend: 'wasm',
  async: false,
  warmup: 'full',
  videoOptimized: true,
  filter: { enabled: true },
  face: { enabled: true, mesh: { enabled: true }, iris: { enabled: false }, age: { enabled: false }, gender: { enabled: false }, emotion: { enabled: false }, embedding: { enabled: false } },
  hand: { enabled: false },
  gesture: { enabled: false },
  body: { enabled: false, modelPath: '../models/blazepose.json' },
  object: { enabled: false },
};
*/

const human = new Human(userConfig);

// ui options
const ui = {
  baseBackground: 'rgba(50, 50, 50, 1)', // 'grey'
  crop: true, // video mode crop to size or leave full frame
  columns: 2, // when processing sample images create this many columns
  facing: true, // camera facing front or back
  useWorker: false, // use web workers for processing
  worker: 'worker.js',
  samples: ['../assets/sample6.jpg', '../assets/sample1.jpg', '../assets/sample4.jpg', '../assets/sample5.jpg', '../assets/sample3.jpg', '../assets/sample2.jpg'],
  compare: '../assets/sample-me.jpg',
  console: true, // log messages to browser console
  maxFPSframes: 10, // keep fps history for how many frames
  modelsPreload: true, // preload human models on startup
  busy: false, // internal camera busy flag
  menuWidth: 0, // internal
  menuHeight: 0, // internal
  camera: {}, // internal, holds details of webcam details
  detectFPS: [], // internal, holds fps values for detection performance
  drawFPS: [], // internal, holds fps values for draw performance
  buffered: false, // experimental, should output be buffered between frames
  drawWarmup: false, // debug only, should warmup image processing be displayed on startup
  drawThread: null, // internl, perform draw operations in a separate thread
  detectThread: null, // internl, perform detect operations in a separate thread
  framesDraw: 0, // internal, statistics on frames drawn
  framesDetect: 0, // internal, statistics on frames detected
  bench: true, // show gl fps benchmark window
  lastFrame: 0, // time of last frame processing
};

// global variables
const menu = {};
let worker;
let bench;
let lastDetectedResult = {};

// helper function: translates json to human readable string
function str(...msg) {
  if (!Array.isArray(msg)) return msg;
  let line = '';
  for (const entry of msg) {
    if (typeof entry === 'object') line += JSON.stringify(entry).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ');
    else line += entry;
  }
  return line;
}

// helper function: wrapper around console output
function log(...msg) {
  const dt = new Date();
  const ts = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}.${dt.getMilliseconds().toString().padStart(3, '0')}`;
  // eslint-disable-next-line no-console
  if (ui.console) console.log(ts, ...msg);
}

function status(msg) {
  // eslint-disable-next-line no-console
  const div = document.getElementById('status');
  if (div) div.innerText = msg;
}

let original;
async function calcSimmilariry(result) {
  document.getElementById('compare-container').style.display = human.config.face.embedding.enabled ? 'block' : 'none';
  if (!human.config.face.embedding.enabled) return;
  if (!(result?.face?.length > 0) || (result?.face[0]?.embedding?.length >= 64)) return;
  if (!original) {
    original = result;
    if (result.face[0].tensor) {
      const enhanced = human.enhance(result.face[0]);
      if (enhanced) {
        const c = document.getElementById('orig');
        const squeeze = enhanced.squeeze();
        human.tf.browser.toPixels(squeeze, c);
        enhanced.dispose();
        squeeze.dispose();
      }
    } else {
      document.getElementById('compare-canvas').getContext('2d').drawImage(original.canvas, 0, 0, 200, 200);
    }
  }
  const simmilarity = human.simmilarity(original?.face[0]?.embedding, result?.face[0]?.embedding);
  document.getElementById('simmilarity').innerText = `simmilarity: ${Math.trunc(1000 * simmilarity) / 10}%`;
}

// draws processed results and starts processing of a next frame
let lastDraw = performance.now();
async function drawResults(input) {
  const result = lastDetectedResult;
  const canvas = document.getElementById('canvas');

  // update draw fps data
  ui.drawFPS.push(1000 / (performance.now() - lastDraw));
  if (ui.drawFPS.length > ui.maxFPSframes) ui.drawFPS.shift();
  lastDraw = performance.now();

  // draw fps chart
  await menu.process.updateChart('FPS', ui.detectFPS);

  // get updated canvas
  if (ui.buffered || !result.canvas) {
    const image = await human.image(input);
    result.canvas = image.canvas;
    human.tf.dispose(image.tensor);
  }

  // draw image from video
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = ui.baseBackground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (result.canvas) {
    if (result.canvas.width !== canvas.width) canvas.width = result.canvas.width;
    if (result.canvas.height !== canvas.height) canvas.height = result.canvas.height;
    ctx.drawImage(result.canvas, 0, 0, result.canvas.width, result.canvas.height, 0, 0, result.canvas.width, result.canvas.height);
  } else {
    ctx.drawImage(input, 0, 0, input.width, input.height, 0, 0, canvas.width, canvas.height);
  }

  // draw all results
  human.draw.face(canvas, result.face);
  human.draw.body(canvas, result.body);
  human.draw.hand(canvas, result.hand);
  human.draw.object(canvas, result.object);
  human.draw.gesture(canvas, result.gesture);
  await calcSimmilariry(result);

  // update log
  const engine = human.tf.engine();
  const gpu = engine.backendInstance ? `gpu: ${(engine.backendInstance.numBytesInGPU ? engine.backendInstance.numBytesInGPU : 0).toLocaleString()} bytes` : '';
  const memory = `system: ${engine.state.numBytes.toLocaleString()} bytes ${gpu} | tensors: ${engine.state.numTensors.toLocaleString()}`;
  const processing = result.canvas ? `processing: ${result.canvas.width} x ${result.canvas.height}` : '';
  const avgDetect = Math.trunc(10 * ui.detectFPS.reduce((a, b) => a + b, 0) / ui.detectFPS.length) / 10;
  const avgDraw = Math.trunc(10 * ui.drawFPS.reduce((a, b) => a + b, 0) / ui.drawFPS.length) / 10;
  const warning = (ui.detectFPS.length > 5) && (avgDetect < 5) ? '<font color="lightcoral">warning: your performance is low: try switching to higher performance backend, lowering resolution or disabling some models</font>' : '';
  document.getElementById('log').innerHTML = `
    video: ${ui.camera.name} | facing: ${ui.camera.facing} | screen: ${window.innerWidth} x ${window.innerHeight} camera: ${ui.camera.width} x ${ui.camera.height} ${processing}<br>
    backend: ${human.tf.getBackend()} | ${memory}<br>
    performance: ${str(result.performance)}ms FPS process:${avgDetect} refresh:${avgDraw}<br>
    ${warning}<br>
  `;

  ui.framesDraw++;
  ui.lastFrame = performance.now();
  // if buffered, immediate loop but limit frame rate although it's going to run slower as JS is singlethreaded
  if (ui.buffered) {
    ui.drawThread = requestAnimationFrame(() => drawResults(input, canvas));
  } else if (!ui.buffered && ui.drawThread) {
    log('stopping buffered refresh');
    cancelAnimationFrame(ui.drawThread);
    ui.drawThread = null;
  }
}

// setup webcam
async function setupCamera() {
  if (ui.busy) return null;
  ui.busy = true;
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const output = document.getElementById('log');
  const live = video.srcObject ? ((video.srcObject.getVideoTracks()[0].readyState === 'live') && (video.readyState > 2) && (!video.paused)) : false;
  let msg = '';
  status('setting up camera');
  // setup webcam. note that navigator.mediaDevices requires that page is accessed via https
  if (!navigator.mediaDevices) {
    msg = 'camera access not supported';
    output.innerText += `\n${msg}`;
    log(msg);
    status(msg);
    ui.busy = false;
    return msg;
  }
  let stream;
  const constraints = {
    audio: false,
    video: { facingMode: ui.facing ? 'user' : 'environment', resizeMode: ui.crop ? 'crop-and-scale' : 'none' },
  };
  if (window.innerWidth > window.innerHeight) constraints.video.width = { ideal: window.innerWidth };
  else constraints.video.height = { ideal: (window.innerHeight - document.getElementById('menubar').offsetHeight) };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === 'PermissionDeniedError' || err.name === 'NotAllowedError') msg = 'camera permission denied';
    else if (err.name === 'SourceUnavailableError') msg = 'camera not available';
    else msg = `camera error: ${err.message || err}`;
    output.innerText += `\n${msg}`;
    status(msg);
    log('camera error:', err);
    ui.busy = false;
    return msg;
  }
  if (stream) video.srcObject = stream;
  else {
    ui.busy = false;
    return 'camera stream empty';
  }
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  // log('camera constraints:', constraints, 'window:', { width: window.innerWidth, height: window.innerHeight }, 'settings:', settings, 'track:', track);
  ui.camera = { name: track.label?.toLowerCase(), width: settings.width, height: settings.height, facing: settings.facingMode === 'user' ? 'front' : 'back' };
  return new Promise((resolve) => {
    video.onloadeddata = async () => {
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      canvas.width = video.width;
      canvas.height = video.height;
      canvas.style.width = canvas.width > canvas.height ? '100vw' : '';
      canvas.style.height = canvas.width > canvas.height ? '' : '100vh';
      ui.menuWidth.input.setAttribute('value', video.width);
      ui.menuHeight.input.setAttribute('value', video.height);
      // silly font resizing for paint-on-canvas since viewport can be zoomed
      if (live) video.play();
      // eslint-disable-next-line no-use-before-define
      if (live && !ui.detectThread) runHumanDetect(video, canvas);
      ui.busy = false;
      // do once more because onresize events can be delayed or skipped
      // if (video.width > window.innerWidth) await setupCamera();
      status('');
      resolve();
    };
  });
}

function initPerfMonitor() {
  if (!bench) {
    const gl = null;
    // cosnt gl = human.tf.engine().backend.gpgpu.gl;
    // if (!gl) log('bench cannot get tensorflow webgl context');
    bench = new GLBench(gl, {
      trackGPU: false, // this is really slow
      chartHz: 20,
      chartLen: 20,
    });
    bench.begin();
  }
}

// wrapper for worker.postmessage that creates worker if one does not exist
function webWorker(input, image, canvas, timestamp) {
  if (!worker) {
    // create new webworker and add event handler only once
    log('creating worker thread');
    worker = new Worker(ui.worker, { type: 'module' });
    // after receiving message from webworker, parse&draw results and send new frame for processing
    worker.addEventListener('message', (msg) => {
      if (msg.data.result.performance && msg.data.result.performance.total) ui.detectFPS.push(1000 / msg.data.result.performance.total);
      if (ui.detectFPS.length > ui.maxFPSframes) ui.detectFPS.shift();
      if (ui.bench) {
        if (!bench) initPerfMonitor();
        bench.nextFrame(timestamp);
      }
      if (document.getElementById('gl-bench')) document.getElementById('gl-bench').style.display = ui.bench ? 'block' : 'none';
      lastDetectedResult = msg.data.result;
      ui.framesDetect++;
      if (!ui.drawThread) drawResults(input);
      // eslint-disable-next-line no-use-before-define
      ui.detectThread = requestAnimationFrame((now) => runHumanDetect(input, canvas, now));
    });
  }
  // pass image data as arraybuffer to worker by reference to avoid copy
  worker.postMessage({ image: image.data.buffer, width: canvas.width, height: canvas.height, userConfig }, [image.data.buffer]);
}

// main processing function when input is webcam, can use direct invocation or web worker
function runHumanDetect(input, canvas, timestamp) {
  // if live video
  const live = input.srcObject && (input.srcObject.getVideoTracks()[0].readyState === 'live') && (input.readyState > 2) && (!input.paused);
  if (!live && input.srcObject) {
    // stop ui refresh
    if (ui.drawThread) cancelAnimationFrame(ui.drawThread);
    if (ui.detectThread) cancelAnimationFrame(ui.detectThread);
    ui.drawThread = null;
    ui.detectThread = null;
    // if we want to continue and camera not ready, retry in 0.5sec, else just give up
    if (input.paused) log('camera paused');
    else if ((input.srcObject.getVideoTracks()[0].readyState === 'live') && (input.readyState <= 2)) setTimeout(() => runHumanDetect(input, canvas), 500);
    else log(`camera not ready: track state: ${input.srcObject?.getVideoTracks()[0].readyState} stream state: ${input.readyState}`);
    clearTimeout(ui.drawThread);
    ui.drawThread = null;
    log('frame statistics: process:', ui.framesDetect, 'refresh:', ui.framesDraw);
    log('memory', human.tf.engine().memory());
    return;
  }
  status('');
  if (ui.useWorker) {
    // get image data from video as we cannot send html objects to webworker
    const offscreen = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(canvas.width, canvas.height) : document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(input, 0, 0, input.width, input.height, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // perform detection in worker
    webWorker(input, data, canvas, userConfig, timestamp);
  } else {
    human.detect(input, userConfig).then((result) => {
      if (result.performance && result.performance.total) ui.detectFPS.push(1000 / result.performance.total);
      if (ui.detectFPS.length > ui.maxFPSframes) ui.detectFPS.shift();
      if (ui.bench) {
        if (!bench) initPerfMonitor();
        bench.nextFrame(timestamp);
      }
      if (document.getElementById('gl-bench')) document.getElementById('gl-bench').style.display = ui.bench ? 'block' : 'none';
      if (result.error) {
        log(result.error);
        document.getElementById('log').innerText += `\nHuman error: ${result.error}`;
      } else {
        lastDetectedResult = result;
        if (!ui.drawThread) drawResults(input);
        ui.framesDetect++;
        ui.detectThread = requestAnimationFrame((now) => runHumanDetect(input, canvas, now));
      }
    });
  }
}

// main processing function when input is image, can use direct invocation or web worker
async function processImage(input) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = async () => {
      log('Processing image:', encodeURI(image.src));
      const canvas = document.getElementById('canvas');
      image.width = image.naturalWidth;
      image.height = image.naturalHeight;
      canvas.width = human.config.filter.width && human.config.filter.width > 0 ? human.config.filter.width : image.naturalWidth;
      canvas.height = human.config.filter.height && human.config.filter.height > 0 ? human.config.filter.height : image.naturalHeight;
      const result = await human.detect(image, userConfig);
      lastDetectedResult = result;
      await drawResults(image);
      const thumb = document.createElement('canvas');
      thumb.className = 'thumbnail';
      thumb.width = window.innerWidth / (ui.columns + 0.1);
      thumb.height = thumb.width * canvas.height / canvas.width;
      if (result.face && result.face.length > 0) {
        thumb.title = result.face.map((a, i) => `#${i} face: ${Math.trunc(100 * a.faceConfidence)}% box: ${Math.trunc(100 * a.boxConfidence)}% age: ${Math.trunc(a.age)} gender: ${Math.trunc(100 * a.genderConfidence)}% ${a.gender}`).join(' | ');
      } else {
        thumb.title = 'no face detected';
      }
      const ctx = thumb.getContext('2d');
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, thumb.width, thumb.height);
      document.getElementById('samples-container').appendChild(thumb);
      image.src = '';
      resolve(true);
    };
    image.src = input;
  });
}

// just initialize everything and call main function
async function detectVideo() {
  document.getElementById('samples-container').style.display = 'none';
  document.getElementById('canvas').style.display = 'block';
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  if ((video.srcObject !== null) && !video.paused) {
    document.getElementById('play').style.display = 'block';
    document.getElementById('btnStart').className = 'button button-start';
    document.getElementById('btnStart').innerHTML = 'start<br>video';
    status('paused');
    video.pause();
  } else {
    const cameraError = await setupCamera();
    if (!cameraError) {
      document.getElementById('play').style.display = 'none';
      for (const m of Object.values(menu)) m.hide();
      status('');
      document.getElementById('btnStart').className = 'button button-stop';
      document.getElementById('btnStart').innerHTML = 'pause<br>video';
      await video.play();
      if (!ui.detectThread) runHumanDetect(video, canvas);
    } else {
      status(cameraError);
    }
  }
}

// just initialize everything and call main function
async function detectSampleImages() {
  userConfig.videoOptimized = false; // force disable video optimizations
  document.getElementById('play').style.display = 'none';
  document.getElementById('canvas').style.display = 'none';
  document.getElementById('samples-container').style.display = 'block';
  log('Running detection of sample images');
  status('processing images');
  document.getElementById('samples-container').innerHTML = '';
  for (const m of Object.values(menu)) m.hide();
  for (const image of ui.samples) await processImage(image);
  status('');
}

function setupMenu() {
  let x = [];
  if (window.innerWidth > 800) {
    // initial position of menu items, later it's calculated based on mouse coordinates
    x = [`${document.getElementById('btnDisplay').offsetLeft - 50}px`, `${document.getElementById('btnImage').offsetLeft - 50}px`, `${document.getElementById('btnProcess').offsetLeft - 50}px`, `${document.getElementById('btnModel').offsetLeft - 50}px`];
  } else {
    // absolute minimum spacing for menus
    x = ['0rem', '11rem', '21.1rem', '33rem'];
  }

  menu.display = new Menu(document.body, '', { top: `${document.getElementById('menubar').offsetHeight}px`, left: x[0] });
  menu.display.addBool('perf monitor', ui, 'bench', (val) => ui.bench = val);
  menu.display.addBool('buffered output', ui, 'buffered', (val) => ui.buffered = val);
  menu.display.addBool('crop & scale', ui, 'crop', (val) => {
    ui.crop = val;
    setupCamera();
  });
  menu.display.addBool('camera facing', ui, 'facing', (val) => {
    ui.facing = val;
    setupCamera();
  });
  menu.display.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.display.addBool('use 3D depth', human.draw.drawOptions, 'useDepth');
  menu.display.addBool('draw with curves', human.draw.drawOptions, 'useCurves');
  menu.display.addBool('print labels', human.draw.drawOptions, 'drawLabels');
  menu.display.addBool('draw points', human.draw.drawOptions, 'drawPoints');
  menu.display.addBool('draw boxes', human.draw.drawOptions, 'drawBoxes');
  menu.display.addBool('draw polygons', human.draw.drawOptions, 'drawPolygons');
  menu.display.addBool('fill polygons', human.draw.drawOptions, 'fillPolygons');

  menu.image = new Menu(document.body, '', { top: `${document.getElementById('menubar').offsetHeight}px`, left: x[1] });
  menu.image.addBool('enabled', human.config.filter, 'enabled', (val) => human.config.filter.enabled = val);
  ui.menuWidth = menu.image.addRange('image width', human.config.filter, 'width', 0, 3840, 10, (val) => human.config.filter.width = parseInt(val));
  ui.menuHeight = menu.image.addRange('image height', human.config.filter, 'height', 0, 2160, 10, (val) => human.config.filter.height = parseInt(val));
  menu.image.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.image.addRange('brightness', human.config.filter, 'brightness', -1.0, 1.0, 0.05, (val) => human.config.filter.brightness = parseFloat(val));
  menu.image.addRange('contrast', human.config.filter, 'contrast', -1.0, 1.0, 0.05, (val) => human.config.filter.contrast = parseFloat(val));
  menu.image.addRange('sharpness', human.config.filter, 'sharpness', 0, 1.0, 0.05, (val) => human.config.filter.sharpness = parseFloat(val));
  menu.image.addRange('blur', human.config.filter, 'blur', 0, 20, 1, (val) => human.config.filter.blur = parseInt(val));
  menu.image.addRange('saturation', human.config.filter, 'saturation', -1.0, 1.0, 0.05, (val) => human.config.filter.saturation = parseFloat(val));
  menu.image.addRange('hue', human.config.filter, 'hue', 0, 360, 5, (val) => human.config.filter.hue = parseInt(val));
  menu.image.addRange('pixelate', human.config.filter, 'pixelate', 0, 32, 1, (val) => human.config.filter.pixelate = parseInt(val));
  menu.image.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.image.addBool('negative', human.config.filter, 'negative', (val) => human.config.filter.negative = val);
  menu.image.addBool('sepia', human.config.filter, 'sepia', (val) => human.config.filter.sepia = val);
  menu.image.addBool('vintage', human.config.filter, 'vintage', (val) => human.config.filter.vintage = val);
  menu.image.addBool('kodachrome', human.config.filter, 'kodachrome', (val) => human.config.filter.kodachrome = val);
  menu.image.addBool('technicolor', human.config.filter, 'technicolor', (val) => human.config.filter.technicolor = val);
  menu.image.addBool('polaroid', human.config.filter, 'polaroid', (val) => human.config.filter.polaroid = val);

  menu.process = new Menu(document.body, '', { top: `${document.getElementById('menubar').offsetHeight}px`, left: x[2] });
  menu.process.addList('backend', ['cpu', 'webgl', 'wasm', 'humangl'], human.config.backend, (val) => human.config.backend = val);
  menu.process.addBool('async operations', human.config, 'async', (val) => human.config.async = val);
  // menu.process.addBool('enable profiler', human.config, 'profile', (val) => human.config.profile = val);
  // menu.process.addBool('memory shield', human.config, 'deallocate', (val) => human.config.deallocate = val);
  menu.process.addBool('use web worker', ui, 'useWorker');
  menu.process.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.process.addLabel('model parameters');
  menu.process.addRange('max objects', human.config.face.detector, 'maxFaces', 1, 50, 1, (val) => {
    human.config.face.detector.maxFaces = parseInt(val);
    human.config.body.maxDetections = parseInt(val);
    human.config.hand.maxHands = parseInt(val);
  });
  menu.process.addRange('skip frames', human.config.face.detector, 'skipFrames', 0, 50, 1, (val) => {
    human.config.face.detector.skipFrames = parseInt(val);
    human.config.face.emotion.skipFrames = parseInt(val);
    human.config.face.age.skipFrames = parseInt(val);
    human.config.hand.skipFrames = parseInt(val);
  });
  menu.process.addRange('min confidence', human.config.face.detector, 'minConfidence', 0.0, 1.0, 0.05, (val) => {
    human.config.face.detector.minConfidence = parseFloat(val);
    human.config.face.gender.minConfidence = parseFloat(val);
    human.config.face.emotion.minConfidence = parseFloat(val);
    human.config.hand.minConfidence = parseFloat(val);
  });
  menu.process.addRange('score threshold', human.config.face.detector, 'scoreThreshold', 0.1, 1.0, 0.05, (val) => {
    human.config.face.detector.scoreThreshold = parseFloat(val);
    human.config.hand.scoreThreshold = parseFloat(val);
    human.config.body.scoreThreshold = parseFloat(val);
  });
  menu.process.addRange('overlap', human.config.face.detector, 'iouThreshold', 0.1, 1.0, 0.05, (val) => {
    human.config.face.detector.iouThreshold = parseFloat(val);
    human.config.hand.iouThreshold = parseFloat(val);
  });
  menu.process.addBool('detection rotation', human.config.face.detector, 'rotation', (val) => {
    human.config.face.detector.rotation = val;
    human.config.hand.rotation = val;
  });
  menu.process.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.process.addButton('process sample images', 'process images', () => detectSampleImages());
  menu.process.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.process.addChart('FPS', 'FPS');

  menu.models = new Menu(document.body, '', { top: `${document.getElementById('menubar').offsetHeight}px`, left: x[3] });
  menu.models.addBool('face detect', human.config.face, 'enabled', (val) => human.config.face.enabled = val);
  menu.models.addBool('face mesh', human.config.face.mesh, 'enabled', (val) => human.config.face.mesh.enabled = val);
  menu.models.addBool('face iris', human.config.face.iris, 'enabled', (val) => human.config.face.iris.enabled = val);
  menu.models.addBool('face age', human.config.face.age, 'enabled', (val) => human.config.face.age.enabled = val);
  menu.models.addBool('face gender', human.config.face.gender, 'enabled', (val) => human.config.face.gender.enabled = val);
  menu.models.addBool('face emotion', human.config.face.emotion, 'enabled', (val) => human.config.face.emotion.enabled = val);
  menu.models.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.models.addBool('body pose', human.config.body, 'enabled', (val) => human.config.body.enabled = val);
  menu.models.addBool('hand pose', human.config.hand, 'enabled', (val) => human.config.hand.enabled = val);
  menu.models.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.models.addBool('gestures', human.config.gesture, 'enabled', (val) => human.config.gesture.enabled = val);
  menu.models.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.models.addBool('object detection', human.config.object, 'enabled', (val) => human.config.object.enabled = val);
  menu.models.addHTML('<hr style="border-style: inset; border-color: dimgray">');
  menu.models.addBool('face compare', human.config.face.embedding, 'enabled', (val) => {
    human.config.face.embedding.enabled = val;
    original = null;
  });

  document.getElementById('btnDisplay').addEventListener('click', (evt) => menu.display.toggle(evt));
  document.getElementById('btnImage').addEventListener('click', (evt) => menu.image.toggle(evt));
  document.getElementById('btnProcess').addEventListener('click', (evt) => menu.process.toggle(evt));
  document.getElementById('btnModel').addEventListener('click', (evt) => menu.models.toggle(evt));
  document.getElementById('btnStart').addEventListener('click', () => detectVideo());
  document.getElementById('play').addEventListener('click', () => detectVideo());
}

async function drawWarmup(res) {
  const canvas = document.getElementById('canvas');
  canvas.width = res.canvas.width;
  canvas.height = res.canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(res.canvas, 0, 0, res.canvas.width, res.canvas.height, 0, 0, canvas.width, canvas.height);
  await human.draw.all(canvas, res);
}

async function main() {
  log('Demo starting ...');
  setupMenu();
  document.getElementById('log').innerText = `Human: version ${human.version}`;
  if (ui.modelsPreload && !ui.useWorker) {
    status('loading');
    await human.load(userConfig); // this is not required, just pre-loads all models
    const loaded = Object.keys(human.models).filter((a) => human.models[a]);
    log('Demo loaded models:', loaded);
  }
  if (!ui.useWorker) {
    status('initializing');
    const res = await human.warmup(userConfig); // this is not required, just pre-warms all models for faster initial inference
    if (res && res.canvas && ui.drawWarmup) await drawWarmup(res);
  }
  status('human: ready');
  document.getElementById('loader').style.display = 'none';
  document.getElementById('play').style.display = 'block';
  log('Demo ready...');
}

window.onload = main;
window.onresize = setupCamera;
