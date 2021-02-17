interface Message {
  type: MessageType | string;
  message: object;
  transferables?: Transferable[]
}

enum MessageType {
  OFFSCREEN_CANVAS,
  ANIMATE
} 

class MessageQueue {

  worker: Worker;
  messageQueue: Message[];
  messageTypeFunctions: Map<MessageType | string, any>;

  constructor(worker: Worker) {
    this.worker = worker;
    this.messageQueue = [];
    this.messageTypeFunctions = new Map<MessageType | string, any>()
    this.worker.onmessage = (message: any) => {
      this.receiveQueue(message.data as object[])
    }
  }

  push(type: MessageType | string, message: object, transferables?: Transferable[]) {
    this.messageQueue.push({
      type,
      message, 
      transferables
    })
  }

  sendQueue() {
    const messages: object[] = [];
    this.messageQueue.forEach((message: Message) => {
      messages.push({ 
        type: message.type,
        message: message.message
       })
    })
    const transferables: Transferable[] = [];
    this.messageQueue.forEach((message: Message) => {
      message.transferables && transferables.push(...message.transferables)
    })
    try {
      this.worker.postMessage(messages, transferables);
    } catch (e) {
      console.log(e)
    }
    this.messageQueue = [];
  }

  receiveQueue(queue: object[]) {
    queue.forEach((element: object) => {
      /** @ts-ignore */
      const { type, message } = element
      if(this.messageTypeFunctions.has(type)) {
        this.messageTypeFunctions.get(type)(message)
      }
    })
  }
}

class WorkerProxy extends MessageQueue {
  constructor(worker: Worker) {
    super(worker)
  }

  sendCanvas(canvas: HTMLCanvasElement) {
    const { width, height, top, left } = canvas.getBoundingClientRect()
    const offscreen = canvas.transferControlToOffscreen()
    this.push(MessageType.OFFSCREEN_CANVAS, {
      width,
      height,
      top,
      left,
      canvas: offscreen,
      pixelRatio: window.devicePixelRatio
    }, [offscreen])
  }
}

class MainProxy extends MessageQueue {
  constructor(worker: Worker) {
    super(worker)
  }
}

export async function createWorker(workerURL: string | URL) {
  const worker = new Worker(workerURL, { type: 'module' })
  const proxy = new WorkerProxy(worker);
  return proxy;
}

export async function receiveWorker(onCanvas: any) {
  const proxy = new MainProxy((globalThis as any));
  proxy.messageTypeFunctions.set(MessageType.OFFSCREEN_CANVAS, onCanvas);
  return proxy;
}