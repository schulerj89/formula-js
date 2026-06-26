import * as THREE from 'three';
import type { TrackDefinition } from '../types';

export class TrackPath {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;

  constructor(readonly track: TrackDefinition) {
    const points = track.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();
  }

  pointAt(progress: number): THREE.Vector3 {
    return this.curve.getPoint(normalizeProgress(progress));
  }

  tangentAt(progress: number): THREE.Vector3 {
    return this.curve.getTangent(normalizeProgress(progress)).normalize();
  }

  normalAt(progress: number): THREE.Vector3 {
    const tangent = this.tangentAt(progress);
    return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  }

  poseAt(progress: number, lateralOffset = 0): { position: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3; yaw: number } {
    const position = this.pointAt(progress);
    const tangent = this.tangentAt(progress);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    position.addScaledVector(normal, lateralOffset);
    return {
      position,
      tangent,
      normal,
      yaw: Math.atan2(tangent.x, tangent.z),
    };
  }
}

export const normalizeProgress = (progress: number): number => {
  const wrapped = progress % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
};

export const progressDelta = (from: number, to: number): number => {
  const a = normalizeProgress(from);
  const b = normalizeProgress(to);
  const delta = b - a;
  if (delta > 0.5) return delta - 1;
  if (delta < -0.5) return delta + 1;
  return delta;
};
