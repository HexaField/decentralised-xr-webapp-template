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
  IcosahedronBufferGeometry
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import ProxyElement from '../worker/proxyElement'
import { easyOrigin } from './origin'

export class ThreeScene {
  /**
   * Render config
   */
  private camera: PerspectiveCamera
  private scene: Scene
  private renderer: WebGLRenderer
  private mouse = new Vector2()
  private raycaster = new Raycaster()
  /**
   * OrbitControls
   */
  private controls: OrbitControls
  private listenerElement: HTMLElement
  private isOffscreenCanvas: boolean = false
  /**
   * main page context
   * */
  private width: number
  private height: number
  private left: number
  private top: number
  private pixelRatio: number
  private canvas: HTMLCanvasElement

  /**
   * three object
   */
  // private example: Example
  constructor({
    canvas,
    width,
    height,
    left,
    top,
    pixelRatio
  }: {
    canvas: HTMLCanvasElement
    width: number
    height: number
    left: number
    top: number
    pixelRatio: number
  }) {
    /**
     * set three.js config
     */
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
    this.scene = new Scene()
    this.renderer = new WebGLRenderer({ antialias: true, canvas: canvas })
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)

    /**
     * set context
     */
    this.width = width
    this.height = height
    this.left = left
    this.top = top
    this.pixelRatio = pixelRatio
    this.canvas = canvas
    /**
     * SET OrbitConrols
     * TODO: Fix Event handler.
     */
    // For offscrenn canvas. Escape document is not defined.
    // refference: https://threejsfundamentals.org/threejs/lessons/threejs-offscreencanvas.html
    if (!(self as any).document) {
      this.isOffscreenCanvas = true
      this.listenerElement = new ProxyElement({
        width,
        height,
        left,
        top
      }) as any
      ;(self as any).window = this.listenerElement
      ;(self as any).document = {
        addEventListener: this.listenerElement.addEventListener.bind(
          this.listenerElement
        ),
        removeEventListener: this.listenerElement.removeEventListener.bind(
          this.listenerElement
        )
      }
    } else {
      this.listenerElement = this.canvas
    }
    this.controls = new OrbitControls(this.camera, this.listenerElement)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    /**
     * bind methods
     */
    this.init = this.init.bind(this)
    this.animate = this.animate.bind(this)
    this.handleClick = this.handleClick.bind(this)
    this.handleResize = this.handleResize.bind(this)
    this.handleEventWorker = this.handleEventWorker.bind(this)
    /**
     * Init
     */
    this.init()
  }

  /**
   * init
   */
  public init() {
    /**
     * Three config
     */
    this.camera.position.set(4, 1, 20)
    this.camera.lookAt(0, 0, 0)
    this.scene.fog = new Fog(0x444466, 100, 400)
    this.scene.background = new Color(0x444466)
    const light = new DirectionalLight(0xffffff, 1)
    light.position.set(5, 1, 1).normalize()
    this.scene.add(easyOrigin({ distance: 100 }))
    /**
     * Example Application
     */
    // this.example.position.x = 0
    // this.example.position.y = 0
    this.scene.add(new Mesh(new IcosahedronBufferGeometry(1, 8), new MeshNormalMaterial({ flatShading: true})))
    this.scene.add(light)
    // genParticle(this.scene, 1000)

    /**
     * EventHandler
     */
    this.listenerElement.addEventListener('click', this.handleClick)
    this.listenerElement.addEventListener('resize', this.handleResize)
    // this.controls.addEventListener('change', e => console.log(e)) // orbitControls debug
    /**
     * start animation loop
     */
    this.animate()
  }

  public handleResize(e: Event) {
    console.log(e)
    e.preventDefault()

  }

  /**
   * ClickEventHandler
   */
  public handleClick(e: MouseEvent) {
    e.preventDefault()
  }

  /**
   * handleEvent
   * use for worker.
   */
  public handleEventWorker(e: any) {
    if (!this.isOffscreenCanvas) {
      console.error('not offscreenCanvas')
      return
    }
    function noop() {}
    e.preventDefault = noop
    e.stopPropagation = noop

    this.listenerElement.dispatchEvent(e)
  }
  /**
   * update mouse
   */
  public handleMouseMove(e: MouseEvent) {
    e.preventDefault()
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  }
  /**
   * animation behavior
   */
  public animate() {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    // intersect
    const intersects = this.raycaster.intersectObjects(this.scene.children)
    if (intersects.length > 0) {
      // console.log(intersects)
    }
    this.renderer.render(this.scene, this.camera)
  }
}