import * as THREE from 'three';
import ComboControls from '../';

const width = window.innerWidth;
const height = window.innerHeight;
const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);
const camera = new THREE.OrthographicCamera(-width / height, width / height, 1 , -1, -1000, 1000);
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
  const { target } = event.camera;
  targetMesh.position.copy(target);
});

const gridHelper = new THREE.GridHelper(50, 50);
gridHelper.position.y = -1;
scene.add(gridHelper);

renderer.render(scene, camera);

const clock = new THREE.Clock();
(function anim() {
  cameraControls.update(clock.getDelta());
  requestAnimationFrame(anim);
  renderer.render(scene, camera);
})();
