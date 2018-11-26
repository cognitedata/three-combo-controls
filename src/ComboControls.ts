// Copyright 2018 Cognite AS

import {
  EventDispatcher,
  Math as ThreeMath,
  MOUSE,
  PerspectiveCamera,
  Spherical,
  Vector2,
  Vector3,
} from 'three';
import Keyboard from './Keyboard';

function getHTMLOffset(
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
) {
  return new Vector2(
    clientX - domElement.offsetLeft,
    clientY - domElement.offsetTop,
  );
}

function getPinchInfo(domElement: HTMLElement, touches: TouchList) {
  if (touches.length !== 2) {
    throw new Error('getPinchInfo only works if touches.length === 2');
  }
  const touchList = [
    touches[0],
    touches[1],
  ];
  const offsets = touchList.map(({ clientX, clientY }) => getHTMLOffset(domElement, clientX, clientY));
  const center = offsets[0].clone().add(offsets[1]).multiplyScalar(0.5);
  const distance = offsets[0].distanceTo(offsets[1]);
  return {
    center,
    distance,
    offsets,
  };
}

const defaultPointerRotationSpeed = Math.PI / 360; // half degree per pixel
const defaultKeyboardRotationSpeed = defaultPointerRotationSpeed * 5;
const defaultSpeedFactor = 3;

export default class ComboControls extends EventDispatcher {
  public enabled: boolean = true;
  public enableDamping: boolean = true;
  public dampingFactor: number = 0.1;
  public dynamicTarget: boolean = true;
  public minDistance: number = 1;
  public maxDistance: number = Infinity;
  public dollyFactor: number = 0.98;
  public keyboardPanSpeed: number = 10;
  public minPolarAngle: number = 0; // radians
  public maxPolarAngle: number = Math.PI; // radians
  public minAzimuthAngle: number = -Infinity; // radians
  public maxAzimuthAngle: number = Infinity; // radians
  public pointerRotationSpeedAzimuth: number = defaultPointerRotationSpeed; // radians per pixel
  public pointerRotationSpeedPolar: number = defaultPointerRotationSpeed; // radians per pixel
  public keyboardRotationSpeedAzimuth: number = defaultKeyboardRotationSpeed;
  public keyboardRotationSpeedPolar: number = defaultKeyboardRotationSpeed;
  public pinchEpsilon: number = 2;
  public pinchPanSpeed: number = 1;
  public EPSILON: number = 0.001;
  public dispose: () => void;

  private temporarilyDisableDamping: Boolean = false;
  private camera: PerspectiveCamera;
  private firstPersonMode: Boolean = false;
  private reusableCamera: PerspectiveCamera = new PerspectiveCamera();
  private reusableVector3: Vector3 = new Vector3();
  private domElement: HTMLElement;
  private target: Vector3 = new Vector3();
  private targetEnd: Vector3 = new Vector3();
  private spherical: Spherical = new Spherical();
  private sphericalEnd: Spherical = new Spherical();
  private deltaTarget: Vector3 = new Vector3();
  private keyboard: Keyboard = new Keyboard();

  private offsetVector: Vector3 = new Vector3();
  private panVector: Vector3 = new Vector3();
  private newCameraPosition: Vector3 = new Vector3();
  constructor(camera: PerspectiveCamera, domElement: HTMLElement) {
    super();
    this.camera = camera;
    this.domElement = domElement;

    // rotation
    this.spherical.setFromVector3(camera.position);
    this.sphericalEnd.copy(this.spherical);

    domElement.addEventListener('mousedown', this.onMouseDown);
    domElement.addEventListener('touchstart', this.onTouchStart);
    domElement.addEventListener('wheel', this.onMouseWheel);
    domElement.addEventListener('contextmenu', this.onContextMenu);

    this.dispose = () => {
      domElement.removeEventListener('mousedown', this.onMouseDown);
      domElement.removeEventListener('wheel', this.onMouseWheel);
      domElement.removeEventListener('touchstart', this.onTouchStart);
      domElement.removeEventListener('contextmenu', this.onContextMenu);
    };
  }

  public update = (): boolean => {
    const {
      camera,
      target,
      targetEnd,
      spherical,
      sphericalEnd,
      deltaTarget,
      handleKeyboard,
      enableDamping,
      dampingFactor,
      EPSILON,
    } = this;

    handleKeyboard();

    const deltaTheta = sphericalEnd.theta - spherical.theta;
    const deltaPhi = sphericalEnd.phi - spherical.phi;
    const deltaRadius = sphericalEnd.radius - spherical.radius;
    deltaTarget.subVectors(targetEnd, target);

    let changed = false;

    const deltaFactor = (enableDamping && !this.temporarilyDisableDamping) ? dampingFactor : 1;
    this.temporarilyDisableDamping = false;

    if (
      Math.abs(deltaTheta) > EPSILON ||
      Math.abs(deltaPhi) > EPSILON ||
      Math.abs(deltaRadius) > EPSILON ||
      Math.abs(deltaTarget.x) > EPSILON ||
      Math.abs(deltaTarget.y) > EPSILON ||
      Math.abs(deltaTarget.z) > EPSILON
    ) {
      spherical.set(
        spherical.radius + deltaRadius * deltaFactor,
        spherical.phi + deltaPhi * deltaFactor,
        spherical.theta + deltaTheta * deltaFactor,
      );
      target.add(deltaTarget.multiplyScalar(deltaFactor));
      changed = true;
    } else {
      spherical.copy(sphericalEnd);
      target.copy(targetEnd);
    }

    spherical.makeSafe();
    camera.position.setFromSpherical(spherical).add(target);
    camera.lookAt(target);

    if (changed) {
      this.triggerCameraChangeEvent();
    }

    // Tell caller if camera has changed
    return changed;
  }

  public getState = () => {
    const { target, camera } = this;
    return {
      target: target.clone(),
      position: camera.position.clone(),
    };
  }

  public setState = (position: Vector3, target: Vector3) => {
    const offset = position.clone().sub(target);
    this.targetEnd.copy(target);
    this.sphericalEnd.setFromVector3(offset);
    this.target.copy(this.targetEnd);
    this.spherical.copy(this.sphericalEnd);
    this.update();
    this.triggerCameraChangeEvent();
  }

  public triggerCameraChangeEvent = () => {
    const { camera, target } = this;
    this.dispatchEvent({
      type: 'cameraChange',
      camera: {
        position: camera.position,
        target,
      },
    });
  }

  private onMouseDown = (event: MouseEvent) => {
    if (!this.enabled) { return; }
    event.preventDefault();

    switch (event.button) {
      case MOUSE.LEFT: {
        this.startMouseRotation(event);
        break;
      }

      case MOUSE.RIGHT: {
        this.startMousePan(event);
        break;
      }

      default:
        break;
    }
  }

  private onMouseWheel = (event: WheelEvent) => {
    if (!this.enabled) { return; }
    event.preventDefault();

    const { domElement } = this;
    const { x, y } = getHTMLOffset(
      domElement,
      event.clientX,
      event.clientY,
    );

    const dollyIn = event.deltaY < 0;
    this.dolly(x, y, this.getDollyDeltaDistance(dollyIn));
  }

  private onTouchStart = (event: TouchEvent) => {
    if (!this.enabled) { return; }
    event.preventDefault();

    switch (event.touches.length) {
      case 1: {
        this.startTouchRotation(event);
        break;
      }
      case 2: {
        this.startTouchPinch(event);
        break;
      }

      default:
        break;
    }
  }

  private onContextMenu = (event: MouseEvent) => {
    if (!this.enabled) { return; }
    event.preventDefault();
  }

  private startMouseRotation = (initialEvent: MouseEvent) => {
    const { domElement } = this;
    let previousOffset = getHTMLOffset(
      domElement,
      initialEvent.clientX,
      initialEvent.clientY,
    );

    const onMouseMove = (event: MouseEvent) => {
      const newOffset = getHTMLOffset(
        domElement,
        event.clientX,
        event.clientY,
      );
      const azimuthAngle =
        (previousOffset.x - newOffset.x) * this.pointerRotationSpeedAzimuth;
      const polarAngle =
        (previousOffset.y - newOffset.y) * this.pointerRotationSpeedPolar;
      previousOffset = newOffset;
      if (this.firstPersonMode) {
        this.rotateFirstPersonMode(azimuthAngle, polarAngle);
      } else {
        this.rotate(azimuthAngle, polarAngle);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove, { passive: false });
    document.addEventListener('mouseup', onMouseUp, { passive: false });
  }

  private startMousePan = (initialEvent: MouseEvent) => {
    const { domElement } = this;
    let previousOffset = getHTMLOffset(
      domElement,
      initialEvent.clientX,
      initialEvent.clientY,
    );

    const onMouseMove = (event: MouseEvent) => {
      const newOffset = getHTMLOffset(
        domElement,
        event.clientX,
        event.clientY,
      );
      const xDifference = newOffset.x - previousOffset.x;
      const yDifference = newOffset.y - previousOffset.y;
      previousOffset = newOffset;
      this.pan(xDifference, yDifference);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove, { passive: false });
    document.addEventListener('mouseup', onMouseUp, { passive: false });
  }

  private startTouchRotation = (initialEvent: TouchEvent) => {
    const { domElement } = this;

    let previousOffset = getHTMLOffset(
      domElement,
      initialEvent.touches[0].clientX,
      initialEvent.touches[0].clientY,
    );

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { return; }
      const newOffset = getHTMLOffset(
        domElement,
        event.touches[0].clientX,
        event.touches[0].clientY,
      );
      const azimuthAngle =
        (previousOffset.x - newOffset.x) * this.pointerRotationSpeedAzimuth;
      const polarAngle =
        (previousOffset.y - newOffset.y) * this.pointerRotationSpeedPolar;
      previousOffset = newOffset;
      if (this.firstPersonMode) {
        this.rotateFirstPersonMode(azimuthAngle, polarAngle);
      } else {
        this.rotate(azimuthAngle, polarAngle);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      // if num fingers used don't equal 1 then we stop touch rotation
      if (event.touches.length !== 1) {
        dispose();
      }
    };

    const onTouchEnd = () => {
      dispose();
    };

    const dispose = () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
  }

  private startTouchPinch = (initialEvent: TouchEvent) => {
    const { domElement } = this;

    let previousPinchInfo = getPinchInfo(domElement, initialEvent.touches);

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) { return; }
      const pinchInfo = getPinchInfo(domElement, event.touches);

      // doly
      const distanceDelta = pinchInfo.distance - previousPinchInfo.distance;
      if (Math.abs(distanceDelta) > this.pinchEpsilon) {
        const dollyDistance = this.getDollyDeltaDistance(distanceDelta > 0);
        this.dolly(0, 0, dollyDistance);
      }

      // pan
      const deltaCenter = pinchInfo.center.clone().sub(previousPinchInfo.center);
      if (deltaCenter.length() > this.pinchEpsilon) {
        deltaCenter.multiplyScalar(this.pinchPanSpeed);
        this.pan(deltaCenter.x, deltaCenter.y);
      }
      previousPinchInfo = pinchInfo;
    };

    const onTouchStart = (event: TouchEvent) => {
      // if num fingers used don't equal 2 then we stop touch pinch
      if (event.touches.length !== 2) {
        dispose();
      }
    };

    const onTouchEnd = () => {
      dispose();
    };

    const dispose = () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  }

  private handleKeyboard = () => {
    if (!this.enabled) { return; }

    const { keyboard, keyboardPanSpeed } = this;

    this.firstPersonMode = false;

    const speedFactor = keyboard.isPressed('shift') ? defaultSpeedFactor : 1;
    const forwardMovement = keyboard.isPressed('w') ? true : keyboard.isPressed('s') ? false : undefined;
    if (forwardMovement !== undefined) {
      this.dolly(0, 0, speedFactor * this.getDollyDeltaDistance(forwardMovement));
      this.firstPersonMode = true;
    }

    // pan horizontally
    const horizontalMovement = Number(keyboard.isPressed('a')) - Number(keyboard.isPressed('d'));
    const verticalMovement = Number(keyboard.isPressed('e')) - Number(keyboard.isPressed('q'));
    if (horizontalMovement !== 0 || verticalMovement !== 0) {
      this.pan(
        speedFactor * keyboardPanSpeed * horizontalMovement,
        speedFactor * keyboardPanSpeed * verticalMovement,
      );
      this.firstPersonMode = true;
    }

    // rotate
    const azimuthAngle =
      this.keyboardRotationSpeedAzimuth *
      (Number(keyboard.isPressed('left')) - Number(keyboard.isPressed('right')));
    let polarAngle =
      this.keyboardRotationSpeedPolar *
      (Number(keyboard.isPressed('up')) - Number(keyboard.isPressed('down')));
    if (azimuthAngle !== 0 || polarAngle !== 0) {
      this.temporarilyDisableDamping = true;
      const { sphericalEnd } = this;
      const oldPhi = sphericalEnd.phi;
      sphericalEnd.phi += polarAngle;
      sphericalEnd.makeSafe();
      polarAngle = sphericalEnd.phi - oldPhi;
      sphericalEnd.phi = oldPhi;
      this.rotateFirstPersonMode(azimuthAngle, polarAngle);
    }
  }

  private rotate = (azimuthAngle: number, polarAngle: number) => {
    const { sphericalEnd } = this;
    const theta = ThreeMath.clamp(
      sphericalEnd.theta + azimuthAngle,
      this.minAzimuthAngle,
      this.maxAzimuthAngle,
    );
    const phi = ThreeMath.clamp(
      sphericalEnd.phi + polarAngle,
      this.minPolarAngle,
      this.maxPolarAngle,
    );
    sphericalEnd.theta = theta;
    sphericalEnd.phi = phi;
    sphericalEnd.makeSafe();
  }

  private rotateFirstPersonMode = (azimuthAngle: number, polarAngle: number) => {
    const { camera, reusableCamera, reusableVector3, sphericalEnd, targetEnd } = this;
    reusableCamera.copy(camera);
    reusableCamera.position.copy(camera.position);
    reusableCamera.lookAt(targetEnd);

    reusableCamera.rotateX(polarAngle);
    reusableCamera.rotateY(azimuthAngle);

    const distToTarget = targetEnd.distanceTo(camera.position);
    reusableCamera.getWorldDirection(reusableVector3);
    targetEnd.addVectors(camera.position, reusableVector3.multiplyScalar(distToTarget));
    sphericalEnd.setFromVector3(reusableVector3.subVectors(reusableCamera.position, targetEnd));
  }

  private pan = (deltaX: number, deltaY: number) => {
    const { domElement, camera, offsetVector, target } = this;

    offsetVector.copy(camera.position).sub(target);
    let targetDistance = offsetVector.length();

    // half of the fov is center to top of screen
    targetDistance *= Math.tan(((camera.fov / 2) * Math.PI) / 180);

    // we actually don't use screenWidth, since perspective camera is fixed to screen height
    this.panLeft((2 * deltaX * targetDistance) / domElement.clientHeight);
    this.panUp((2 * deltaY * targetDistance) / domElement.clientHeight);
  }

  private dolly = (x: number, y: number, deltaDistance: number) => {
    const { dynamicTarget, minDistance, maxDistance, sphericalEnd, targetEnd, offsetVector, newCameraPosition } = this;
    const newRadius = sphericalEnd.radius + deltaDistance;
    if (!dynamicTarget || newRadius >= minDistance) {
      sphericalEnd.radius = ThreeMath.clamp(newRadius, minDistance, maxDistance);
      return;
    }
    // at this point: dynamic target is enabled and newRadius < this.minDistance

    sphericalEnd.radius = newRadius;
    newCameraPosition.setFromSpherical(sphericalEnd).add(targetEnd);
    offsetVector.subVectors(targetEnd, newCameraPosition).normalize().multiplyScalar(minDistance);
    targetEnd.addVectors(newCameraPosition, offsetVector);
    sphericalEnd.radius = minDistance;
  }

  private getDollyDeltaDistance = (dollyIn: boolean) => {
    const { sphericalEnd, dollyFactor } = this;
    const factor = dollyIn ? dollyFactor : (1 / dollyFactor);
    return sphericalEnd.radius * (factor - 1);
  }

  private panLeft = (distance: number) => {
    const { camera, targetEnd, panVector } = this;
    panVector.setFromMatrixColumn(camera.matrix, 0); // get X column of objectMatrix
    panVector.multiplyScalar(-distance);
    targetEnd.add(panVector);
  }

  private panUp = (distance: number) => {
    const { camera, targetEnd, panVector } = this;
    panVector.setFromMatrixColumn(camera.matrix, 1); // get X column of objectMatrix
    panVector.multiplyScalar(distance);
    targetEnd.add(panVector);
  }
}
