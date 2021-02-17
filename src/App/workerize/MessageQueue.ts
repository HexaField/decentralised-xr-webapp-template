import { simplifyObject } from '../../util/simplifyObject';
import { EventDispatcher, Event as DispatchEvent } from 'three';

interface Message {
  type: MessageType | string;
  message: object;
  transferables?: Transferable[];
}

enum MessageType {
  OFFSCREEN_CANVAS,
  ANIMATE,
  ADD_EVENT,
  REMOVE_EVENT,
  EVENT,
}

class MessageQueue extends EventDispatcher {
  [x: string]: any; // this is like sex and magic had sex

  worker: Worker;
  messageQueue: Message[];
  messageTypeFunctions: Map<MessageType | any, any>;
  interval: NodeJS.Timeout;

  constructor(worker: Worker, eventTarget: EventTarget) {
    super();
    this.worker = worker;
    this.messageQueue = [];
    this.messageTypeFunctions = new Map<MessageType | any, any>();
    this.worker.onmessage = (message: any) => {
      this.receiveQueue(message.data as object[]);
    };
    const eventListener = (args: Event) => {
      this.push(MessageType.EVENT, simplifyObject(args));
    };
    this.messageTypeFunctions.set(MessageType.EVENT, (event: any) => {
      event.preventDefault = () => {};
      event.stopPropagation = () => {};
      this.dispatchEvent(event as Event);
    });
    this.messageTypeFunctions.set(
      MessageType.ADD_EVENT,
      ({ type }: { type: string }) => {
        eventTarget.addEventListener(type, eventListener);
      },
    );
    this.messageTypeFunctions.set(
      MessageType.REMOVE_EVENT,
      ({ type }: { type: string }) => {
        eventTarget.removeEventListener(type, eventListener);
      },
    );
    this.interval = setInterval(() => {
      this.sendQueue();
    }, 1000 / 60);
  }

  push(
    type: MessageType | any,
    message: object,
    transferables?: Transferable[],
  ) {
    this.messageQueue.push({
      type,
      message,
      transferables,
    });
  }

  sendQueue() {
    if (!this.messageQueue?.length) return;
    const messages: object[] = [];
    this.messageQueue.forEach((message: Message) => {
      messages.push({
        type: message.type,
        message: message.message,
      });
    });
    const transferables: Transferable[] = [];
    this.messageQueue.forEach((message: Message) => {
      message.transferables && transferables.push(...message.transferables);
    });
    try {
      this.worker.postMessage(messages, transferables);
    } catch (e) {
      console.log(e);
    }
    this.messageQueue = [];
  }

  receiveQueue(queue: object[]) {
    queue.forEach((element: object) => {
      /** @ts-ignore */
      const { type, message } = element;
      if (this.messageTypeFunctions.has(type)) {
        this.messageTypeFunctions.get(type)(message);
      }
    });
  }

  addEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.push(MessageType.ADD_EVENT, { type });
    super.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.push(MessageType.REMOVE_EVENT, { type });
    super.removeEventListener(type, listener);
  }
}

class WorkerProxy extends MessageQueue {
  constructor(worker: Worker, eventTarget: EventTarget) {
    super(worker, eventTarget);
  }
}

class MainProxy extends MessageQueue {
  width: number;
  height: number;
  left: number;
  top: number;

  constructor(worker: Worker, eventTarget: EventTarget) {
    super(worker, eventTarget);

    this.width = 0;
    this.height = 0;
    this.left = 0;
    this.top = 0;

    this.focus = this.focus.bind(this);
    this.getBoundingClientRect = this.getBoundingClientRect.bind(this);
  }

  focus() {}
  get ownerDocument() {
    return this;
  }
  get clientWidth() {
    return this.width;
  }
  get clientHeight() {
    return this.height;
  }
  get innerWidth() {
    return this.width;
  }
  get innerHeight() {
    return this.height;
  }
  getBoundingClientRect() {
    return {
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      right: this.left + this.width,
      bottom: this.top + this.height,
    };
  }
}

export async function createWorker(
  workerURL: string | URL,
  canvas: HTMLCanvasElement,
) {
  const worker = new Worker(workerURL, { type: 'module' });
  const messageQueue = new WorkerProxy(worker, canvas);
  const { width, height, top, left } = canvas.getBoundingClientRect();
  const offscreen = canvas.transferControlToOffscreen();
  messageQueue.push(
    MessageType.OFFSCREEN_CANVAS,
    {
      width,
      height,
      top,
      left,
      canvas: offscreen,
      pixelRatio: window.devicePixelRatio,
    },
    [offscreen],
  );

  return messageQueue;
}

export async function receiveWorker(onCanvas: any) {
  const messageQueue = new MainProxy(globalThis as any, new EventTarget());
  messageQueue.messageTypeFunctions.set(
    MessageType.OFFSCREEN_CANVAS,
    (args: any) => {
      const {
        canvas,
        height,
        width,
      }: {
        canvas: HTMLCanvasElement | OffscreenCanvas;
        width: number;
        height: number;
      } = args;
      messageQueue.width = width;
      messageQueue.height = height;
      canvas.addEventListener = (
        type: string,
        listener: (event: DispatchEvent) => void,
      ) => {
        messageQueue.addEventListener(type, listener);
      };
      canvas.removeEventListener = (
        type: string,
        listener: (event: DispatchEvent) => void,
      ) => {
        messageQueue.removeEventListener(type, listener);
      };
      /** @ts-ignore */
      canvas.ownerDocument = messageQueue;
      (globalThis as any).window = messageQueue;
      (globalThis as any).document = {
        addEventListener: (
          type: string,
          listener: (event: DispatchEvent) => void,
        ) => {
          messageQueue.addEventListener(type, listener);
        },
        removeEventListener: (
          type: string,
          listener: (event: DispatchEvent) => void,
        ) => {
          messageQueue.removeEventListener(type, listener);
        },
        ownerDocument: messageQueue,
      };
      onCanvas(args);
    },
  );
  return messageQueue;
}
