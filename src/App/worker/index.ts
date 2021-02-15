import * as Comlink from 'comlink'
import './eventTransferHandler'
import Stats from 'stats.js'

export const createWorker = (canvas: HTMLCanvasElement): void => {
  // @ts-ignore
  if(canvas.transferControlToOffscreen) {
    (globalThis as any).canvasProxy = renderOffscreenApp(canvas)
  } else {
    (globalThis as any).canvasProxy = renderScene(canvas)
  }
}
/**
 * Fall back if offscreen canvas not supported
 * @param htmlCanvas 
 */
const renderScene = async (htmlCanvas: HTMLCanvasElement) => {
  const { ThreeScene } = await import('../scene')
  const { width, height, top, left } = htmlCanvas.getBoundingClientRect()
  const app = new ThreeScene({
    width,
    height,
    top,
    left,
    canvas: htmlCanvas,
    pixelRatio: window.devicePixelRatio
  })
  startAnmation(app.animate)
  return app;
}

const renderOffscreenApp = async (htmlCanvas: HTMLCanvasElement) => {
  const { width, height, top, left } = htmlCanvas.getBoundingClientRect()
  // @ts-ignore
  const offscreen = htmlCanvas.transferControlToOffscreen()
  // @ts-ignore
  const OffscreenApp = Comlink.wrap(new Worker(new URL('./app.worker.js', import.meta.url), { type: 'module'}))
  // @ts-ignore
  const app = await new OffscreenApp(
    Comlink.transfer(
      {
        width,
        height,
        top,
        left,
        canvas: offscreen,
        pixelRatio: window.devicePixelRatio
      },
      // @ts-ignore
      [offscreen]
    )
  )
  startAnmation(app.animate)

  /**
   * worker eventListener
   */
  const eventType: Array<keyof GlobalEventHandlersEventMap> = [
    'click',
    'contextmenu',
    'mousedown',
    'mousemove',
    'mouseup',
    'pointerdown',
    'pointerup',
    'pointermove',
    'touchstart',
    'touchmove',
    'touchend',
    'wheel',
    'keydown'
  ]
  eventType.map((type: keyof GlobalEventHandlersEventMap, index: number) => {
    htmlCanvas.addEventListener(type, app.handleEventWorker.bind(app))
  })
  return app;
}

const startAnmation = (update: () => void) => {
  const stats = new Stats()
  document.body.appendChild(stats.dom)

  const animate = () => {
    if (self.requestAnimationFrame) {
      self.requestAnimationFrame(animate)
    } else {
      // Firefox
    }
    stats.begin()
    update()
    stats.end()
  }
  animate()
}