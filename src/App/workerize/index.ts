import Stats from 'stats.js';
import { createWorker } from './MessageQueue';

export default async (canvas: HTMLCanvasElement): Promise<void> => {
  // @ts-ignore
  if (canvas.transferControlToOffscreen) {
    (globalThis as any).canvasProxy = await renderOffscreenApp(canvas);
  } else {
    (globalThis as any).canvasProxy = await renderScene(canvas);
  }
};

const renderScene = async (canvas: HTMLCanvasElement) => {
  const { ThreeScene } = await import('../scene');
  const { width, height, top, left } = canvas.getBoundingClientRect();
  const app = new ThreeScene({
    width,
    height,
    canvas,
    pixelRatio: window.devicePixelRatio,
  });
  startAnmation(app.animate);
  return app;
};

const renderOffscreenApp = async (canvas: HTMLCanvasElement) => {
  const workerProxy = await createWorker(
    new URL('./app.worker.js', import.meta.url),
    canvas,
  );
  return workerProxy;
};

const startAnmation = (update: () => void) => {
  const stats = new Stats();
  document.body.appendChild(stats.dom);

  const animate = () => {
    if (self.requestAnimationFrame) {
      self.requestAnimationFrame(animate);
    } else {
      // Firefox
    }
    stats.begin();
    update();
    stats.end();
  };
  animate();
};
