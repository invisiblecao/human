/* eslint-disable indent */
/* eslint-disable no-multi-spaces */

/**
 * Configuration interface definition for **Human** library
 *
 * Contains all configurable parameters
 */
export interface Config {
  backend: string,
  wasmPath: string,
  debug: boolean,
  async: boolean,
  profile: boolean,
  deallocate: boolean,
  scoped: boolean,
  videoOptimized: boolean,
  warmup: string,
  filter: {
    enabled: boolean,
    width: number,
    height: number,
    return: boolean,
    brightness: number,
    contrast: number,
    sharpness: number,
    blur: number
    saturation: number,
    hue: number,
    negative: boolean,
    sepia: boolean,
    vintage: boolean,
    kodachrome: boolean,
    technicolor: boolean,
    polaroid: boolean,
    pixelate: number,
  },
  gesture: {
    enabled: boolean,
  },
  face: {
    enabled: boolean,
    detector: {
      modelPath: string,
      rotation: boolean,
      maxFaces: number,
      skipFrames: number,
      skipInitial: boolean,
      minConfidence: number,
      iouThreshold: number,
      scoreThreshold: number,
      return: boolean,
    },
    mesh: {
      enabled: boolean,
      modelPath: string,
    },
    iris: {
      enabled: boolean,
      modelPath: string,
    },
    age: {
      enabled: boolean,
      modelPath: string,
      skipFrames: number,
    },
    gender: {
      enabled: boolean,
      minConfidence: number,
      modelPath: string,
      skipFrames: number,
    },
    emotion: {
      enabled: boolean,
      minConfidence: number,
      skipFrames: number,
      modelPath: string,
    },
    embedding: {
      enabled: boolean,
      modelPath: string,
    },
  },
  body: {
    enabled: boolean,
    modelPath: string,
    maxDetections: number,
    scoreThreshold: number,
    nmsRadius: number,
  },
  hand: {
    enabled: boolean,
    rotation: boolean,
    skipFrames: number,
    skipInitial: boolean,
    minConfidence: number,
    iouThreshold: number,
    scoreThreshold: number,
    maxHands: number,
    landmarks: boolean,
    detector: {
      modelPath: string,
    },
    skeleton: {
      modelPath: string,
    },
  },
  object: {
    enabled: boolean,
    modelPath: string,
    minConfidence: number,
    iouThreshold: number,
    maxResults: number,
    skipFrames: number,
  },
}

const config: Config = {
  backend: 'webgl',          // select tfjs backend to use
                             // can be 'webgl', 'wasm', 'cpu', or 'humangl' which is a custom version of webgl
                             // leave as empty string to continue using default backend
                             // when backend is set outside of Human library
  wasmPath: '../assets/',    // path for wasm binaries
                             // only used for backend: wasm
  debug: true,               // print additional status messages to console
  async: true,               // execute enabled models in parallel
                             // this disables per-model performance data but
                             // slightly increases performance
                             // cannot be used if profiling is enabled
  profile: false,            // enable tfjs profiling
                             // this has significant performance impact
                             // only enable for debugging purposes
                             // currently only implemented for age,gender,emotion models
  deallocate: false,         // aggresively deallocate gpu memory after each usage
                             // only valid for webgl backend and only during first call
                             // cannot be changed unless library is reloaded
                             // this has significant performance impact
                             // only enable on low-memory devices
  scoped: false,             // enable scoped runs
                             // some models *may* have memory leaks,
                             // this wrapps everything in a local scope at a cost of performance
                             // typically not needed
  videoOptimized: true,      // perform additional optimizations when input is video,
                             // must be disabled for images
                             // basically this skips object box boundary detection for every n frames
                             // while maintaining in-box detection since objects cannot move that fast
  warmup: 'face',            // what to use for human.warmup(), can be 'none', 'face', 'full'
                             // warmup pre-initializes all models for faster inference but can take
                             // significant time on startup
  filter: {
    enabled: true,           // enable image pre-processing filters
    width: 0,                // resize input width
    height: 0,               // resize input height
                             // if both width and height are set to 0, there is no resizing
                             // if just one is set, second one is scaled automatically
                             // if both are set, values are used as-is
    return: true,            // return processed canvas imagedata in result
    brightness: 0,           // range: -1 (darken) to 1 (lighten)
    contrast: 0,             // range: -1 (reduce contrast) to 1 (increase contrast)
    sharpness: 0,            // range: 0 (no sharpening) to 1 (maximum sharpening)
    blur: 0,                 // range: 0 (no blur) to N (blur radius in pixels)
    saturation: 0,           // range: -1 (reduce saturation) to 1 (increase saturation)
    hue: 0,                  // range: 0 (no change) to 360 (hue rotation in degrees)
    negative: false,         // image negative
    sepia: false,            // image sepia colors
    vintage: false,          // image vintage colors
    kodachrome: false,       // image kodachrome colors
    technicolor: false,      // image technicolor colors
    polaroid: false,         // image polaroid camera effect
    pixelate: 0,             // range: 0 (no pixelate) to N (number of pixels to pixelate)
  },

  gesture: {
    enabled: true,           // enable simple gesture recognition
  },

  face: {
    enabled: true,           // controls if specified modul is enabled
                             // face.enabled is required for all face models:
                             // detector, mesh, iris, age, gender, emotion
                             // (note: module is not loaded until it is required)
    detector: {
      modelPath: '../models/blazeface-back.json',
      rotation: false,       // use best-guess rotated face image or just box with rotation as-is
                             // false means higher performance, but incorrect mesh mapping if face angle is above 20 degrees
                             // this parameter is not valid in nodejs
      maxFaces: 10,          // maximum number of faces detected in the input
                             // should be set to the minimum number for performance
      skipFrames: 21,        // how many frames to go without re-running the face bounding box detector
                             // only used for video inputs
                             // e.g., if model is running st 25 FPS, we can re-use existing bounding
                             // box for updated face analysis as the head probably hasn't moved much
                             // in short time (10 * 1/25 = 0.25 sec)
      skipInitial: false,    // if previous detection resulted in no faces detected,
                             // should skipFrames be reset immediately
      minConfidence: 0.2,    // threshold for discarding a prediction
      iouThreshold: 0.1,     // threshold for deciding whether boxes overlap too much in
                             // non-maximum suppression (0.1 means drop if overlap 10%)
      scoreThreshold: 0.2,   // threshold for deciding when to remove boxes based on score
                             // in non-maximum suppression,
                             // this is applied on detection objects only and before minConfidence
      return: false,         // return extracted face as tensor
    },

    mesh: {
      enabled: true,
      modelPath: '../models/facemesh.json',
    },

    iris: {
      enabled: true,
      modelPath: '../models/iris.json',
    },

    age: {
      enabled: true,
      modelPath: '../models/age.json',
      skipFrames: 31,        // how many frames to go without re-running the detector
                             // only used for video inputs
    },

    gender: {
      enabled: true,
      minConfidence: 0.1,    // threshold for discarding a prediction
      modelPath: '../models/gender.json',
      skipFrames: 32,        // how many frames to go without re-running the detector
                             // only used for video inputs
    },

    emotion: {
      enabled: true,
      minConfidence: 0.1,    // threshold for discarding a prediction
      skipFrames: 33,        // how many frames to go without re-running the detector
      modelPath: '../models/emotion.json',
    },

    embedding: {
      enabled: false,        // to improve accuracy of face embedding extraction it is
                             // highly recommended to enable detector.rotation and mesh.enabled
      modelPath: '../models/mobileface.json',
    },
  },

  body: {
    enabled: true,
    modelPath: '../models/posenet.json', // can be 'posenet' or 'blazepose'
    maxDetections: 10,       // maximum number of people detected in the input
                             // should be set to the minimum number for performance
                             // only valid for posenet as blazepose only detects single pose
    scoreThreshold: 0.3,     // threshold for deciding when to remove boxes based on score
                             // in non-maximum suppression
                             // only valid for posenet as blazepose only detects single pose
    nmsRadius: 20,           // radius for deciding points are too close in non-maximum suppression
                             // only valid for posenet as blazepose only detects single pose
  },

  hand: {
    enabled: true,
    rotation: false,         // use best-guess rotated hand image or just box with rotation as-is
                             // false means higher performance, but incorrect finger mapping if hand is inverted
    skipFrames: 12,          // how many frames to go without re-running the hand bounding box detector
                             // only used for video inputs
                             // e.g., if model is running st 25 FPS, we can re-use existing bounding
                             // box for updated hand skeleton analysis as the hand probably
                             // hasn't moved much in short time (10 * 1/25 = 0.25 sec)
    skipInitial: false,      // if previous detection resulted in no faces detected,
                             // should skipFrames be reset immediately
    minConfidence: 0.1,      // threshold for discarding a prediction
    iouThreshold: 0.1,       // threshold for deciding whether boxes overlap too much
                             // in non-maximum suppression
    scoreThreshold: 0.5,     // threshold for deciding when to remove boxes based on
                             // score in non-maximum suppression
    maxHands: 1,             // maximum number of hands detected in the input
                             // should be set to the minimum number for performance
    landmarks: true,         // detect hand landmarks or just hand boundary box
    detector: {
      modelPath: '../models/handdetect.json',
    },
    skeleton: {
      modelPath: '../models/handskeleton.json',
    },
  },

  object: {
    enabled: false,
    modelPath: '../models/nanodet.json',
    minConfidence: 0.15,     // threshold for discarding a prediction
    iouThreshold: 0.25,      // threshold for deciding whether boxes overlap too much
                             // in non-maximum suppression
    maxResults: 10,          // maximum number of objects detected in the input
    skipFrames: 13,          // how many frames to go without re-running the detector
  },
};
export { config as defaults };
