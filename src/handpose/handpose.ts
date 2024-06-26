// https://storage.googleapis.com/tfjs-models/demos/handpose/index.html

import { log } from '../log';
import * as tf from '../../dist/tfjs.esm.js';
import * as handdetector from './handdetector';
import * as handpipeline from './handpipeline';
import * as anchors from './anchors';

const MESH_ANNOTATIONS = {
  thumb: [1, 2, 3, 4],
  indexFinger: [5, 6, 7, 8],
  middleFinger: [9, 10, 11, 12],
  ringFinger: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
  palmBase: [0],
};

export class HandPose {
  handPipeline: any;

  constructor(handPipeline) {
    this.handPipeline = handPipeline;
  }

  static getAnnotations() {
    return MESH_ANNOTATIONS;
  }

  async estimateHands(input, config) {
    const predictions = await this.handPipeline.estimateHands(input, config);
    if (!predictions) return [];
    const hands: Array<{ confidence: number, box: any, boxRaw: any, landmarks: any, annotations: any }> = [];
    for (const prediction of predictions) {
      const annotations = {};
      if (prediction.landmarks) {
        for (const key of Object.keys(MESH_ANNOTATIONS)) {
          annotations[key] = MESH_ANNOTATIONS[key].map((index) => prediction.landmarks[index]);
        }
      }
      const box = prediction.box ? [
        Math.max(0, prediction.box.topLeft[0]),
        Math.max(0, prediction.box.topLeft[1]),
        Math.min(input.shape[2], prediction.box.bottomRight[0]) - Math.max(0, prediction.box.topLeft[0]),
        Math.min(input.shape[1], prediction.box.bottomRight[1]) - Math.max(0, prediction.box.topLeft[1]),
      ] : [];
      const boxRaw = [
        (prediction.box.topLeft[0]) / input.shape[2],
        (prediction.box.topLeft[1]) / input.shape[1],
        (prediction.box.bottomRight[0] - prediction.box.topLeft[0]) / input.shape[2],
        (prediction.box.bottomRight[1] - prediction.box.topLeft[1]) / input.shape[1],
      ];
      hands.push({ confidence: prediction.confidence, box, boxRaw, landmarks: prediction.landmarks, annotations });
    }
    return hands;
  }
}

export async function load(config) {
  const [handDetectorModel, handPoseModel] = await Promise.all([
    config.hand.enabled ? tf.loadGraphModel(config.hand.detector.modelPath, { fromTFHub: config.hand.detector.modelPath.includes('tfhub.dev') }) : null,
    config.hand.landmarks ? tf.loadGraphModel(config.hand.skeleton.modelPath, { fromTFHub: config.hand.skeleton.modelPath.includes('tfhub.dev') }) : null,
  ]);
  const handDetector = new handdetector.HandDetector(handDetectorModel, handDetectorModel?.inputs[0].shape[2], anchors.anchors);
  const handPipeline = new handpipeline.HandPipeline(handDetector, handPoseModel, handPoseModel?.inputs[0].shape[2]);
  const handPose = new HandPose(handPipeline);
  if (config.hand.enabled && config.debug) log(`load model: ${config.hand.detector.modelPath.match(/\/(.*)\./)[1]}`);
  if (config.hand.landmarks && config.debug) log(`load model: ${config.hand.skeleton.modelPath.match(/\/(.*)\./)[1]}`);
  return handPose;
}
