import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Fog,
  Color,
  DirectionalLight,
  Vector2,
  Raycaster,
  Mesh,
  MeshNormalMaterial,
  IcosahedronBufferGeometry,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { easyOrigin } from './origin';

export class ThreeScene {
  private camera: PerspectiveCamera;
  private scene: Scene;
  private renderer: WebGLRenderer;
  private mouse = new Vector2();
  private raycaster = new Raycaster();
  private controls: OrbitControls;
  constructor({
    canvas,
    width,
    height,
    pixelRatio,
  }: {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    width: number;
    height: number;
    pixelRatio: number;
  }) {
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    this.scene = new Scene();
    this.renderer = new WebGLRenderer({ antialias: true, canvas: canvas });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    this.controls = new OrbitControls(this.camera, window as any);
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.init = this.init.bind(this);
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.init();
  }

  public init() {
    this.camera.position.set(4, 1, 20);
    this.camera.lookAt(0, 0, 0);
    this.scene.fog = new Fog(0x444466, 100, 400);
    this.scene.background = new Color(0x444466);
    const light = new DirectionalLight(0xffffff, 1);
    light.position.set(5, 1, 1).normalize();
    this.scene.add(easyOrigin({ distance: 100 }));

    this.scene.add(
      new Mesh(
        new IcosahedronBufferGeometry(1, 8),
        new MeshNormalMaterial({ flatShading: true }),
      ),
    );
    this.scene.add(light);

    this.animate();
  }

  public handleResize(e: Event) {
    console.log('resize', e);
  }

  public animate() {
    if ((globalThis as any).requestAnimationFrame) {
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObjects(this.scene.children);
      if (intersects.length > 0) {
        // console.log(intersects)
      }
      this.renderer.render(this.scene, this.camera);
    }
    (globalThis as any).requestAnimationFrame(this.animate);
  }
}
