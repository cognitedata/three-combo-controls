import * as THREE from 'three';
import ComboControls from '../';

const width = window.innerWidth;
const height = window.innerHeight;
const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);
camera.position.set(0, 0, 5);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  stencil: false,
});
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

const cameraControls = new ComboControls(camera, renderer.domElement);

const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }),
);
scene.add(mesh);

const targetMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.05),
  new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false }),
);
scene.add(targetMesh);

cameraControls.addEventListener('cameraChange', (event) => {
  const { position, target } = event.camera;
  targetMesh.position.copy(target);
});

const gridHelper = new THREE.GridHelper(50, 50);
gridHelper.position.y = -1;
scene.add(gridHelper);

renderer.render(scene, camera);

(function anim() {
  const delta = clock.getDelta();
  cameraControls.update();
  requestAnimationFrame(anim);
  renderer.render(scene, camera);
})();
