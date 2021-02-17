import Stats from 'stats.js'
import { createWorker } from './MessageQueue'

export default (canvas: HTMLCanvasElement): void => {
  // @ts-ignore
  if (canvas.transferControlToOffscreen) {
    (globalThis as any).canvasProxy = renderOffscreenApp(canvas)
  } else {
    (globalThis as any).canvasProxy = renderScene(canvas)
  }
}

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
  const workerProxy = await createWorker(new URL('./app.worker.js', import.meta.url))
  workerProxy.sendCanvas(htmlCanvas)
  console.log('initialised')

  startAnmation(() => {
    workerProxy.push('ANIMATE', {}) // instead have an 'onQueue' or something
    workerProxy.sendQueue();
  })
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