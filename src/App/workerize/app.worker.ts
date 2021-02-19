import { receiveWorker } from './MessageQueue';
import { ThreeScene } from '../scene';

let scene: any;
receiveWorker((args: any) => {
  scene = new ThreeScene(args);
}).then((proxy) => {
  proxy.addEventListener('animate', () => {
    console.log(scene);
    if (scene) scene.animate();
  });
});
