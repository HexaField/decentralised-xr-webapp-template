import { simplifyObject } from '../../util/simplifyObject';
import { EventDispatcher, Event as DispatchEvent, Object3D } from 'three';
import { generateUUID } from '../../util/generateUUID';

interface Message {
  type: MessageType | string;
  message: object;
  uuid?: string;
  transferables?: Transferable[];
}

enum MessageType {
  OFFSCREEN_CANVAS,
  ANIMATE,
  ADD_EVENT,
  REMOVE_EVENT,
  EVENT,
  DOCUMENT_ELEMENT_CREATE,
  DOCUMENT_ELEMENT_FUNCTION_CALL,
  DOCUMENT_ELEMENT_PARAM_SET,
}

class EventDispatcherProxy extends EventDispatcher {
  eventTarget: EventTarget;
  messageTypeFunctions: Map<MessageType, any>;

  constructor(eventTarget: EventTarget, eventListener: any) {
    super();
    this.eventTarget = eventTarget;
    this.messageTypeFunctions = new Map<MessageType, any>();

    this.messageTypeFunctions.set(MessageType.EVENT, (event: any) => {
      event.preventDefault = () => {};
      event.stopPropagation = () => {};
      this.dispatchEvent(event as any);
    });
    this.messageTypeFunctions.set(
      MessageType.ADD_EVENT,
      ({ type }: { type: string }) => {
        this.eventTarget.addEventListener(type, eventListener);
      },
    );
    this.messageTypeFunctions.set(
      MessageType.REMOVE_EVENT,
      ({ type }: { type: string }) => {
        this.eventTarget.removeEventListener(type, eventListener);
      },
    );
  }
}

class MessageQueue extends EventDispatcherProxy {
  [x: string]: any; // this is like sex and magic had sex

  worker: Worker;
  messageQueue: Message[];
  interval: NodeJS.Timeout;
  remoteDocumentObjects: Map<string, DOMProxy>;
  eventTarget: EventTarget;

  constructor(worker: Worker, eventTarget: EventTarget) {
    super(eventTarget, (args: any) => {
      this.push(MessageType.EVENT, simplifyObject(args));
    });
    this.worker = worker;
    this.eventTarget = eventTarget;
    this.messageQueue = [];
    this.remoteDocumentObjects = new Map<string, DOMProxy>();

    this.worker.onmessage = (message: any) => {
      this.receiveQueue(message.data as object[]);
    };
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
      const { type, message, id } = element;
      if (!id || id === '') {
        if (this.messageTypeFunctions.has(type)) {
          this.messageTypeFunctions.get(type)(message);
        }
      } else {
        this.remoteDocumentObjects.get(id)?.messageTypeFunctions.get(type)(
          message,
        );
      }
    });
    this.dispatchEvent(new CustomEvent('queue'));
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

class DOMProxy extends EventDispatcherProxy {
  messageQueue: MessageQueue;
  uuid: string;
  type: string;
  eventTarget: EventTarget;

  constructor(
    messageQueue: MessageQueue,
    type: string,
    eventTarget?: EventTarget,
  ) {
    super(eventTarget || messageQueue.eventTarget, (args: any) => {
      this.messageQueue.push(MessageType.EVENT, simplifyObject(args));
    });
    this.type = type;
    this.messageQueue = messageQueue;
    this.eventTarget = eventTarget || messageQueue.eventTarget;
    this.uuid = generateUUID();
    this.messageQueue.remoteDocumentObjects.set(this.uuid, this);
    this.messageQueue.push(MessageType.DOCUMENT_ELEMENT_CREATE, {
      type,
      id: this.uuid,
    });
  }

  addEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.messageQueue.push(MessageType.ADD_EVENT, { type, id: this.uuid });
    super.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.messageQueue.push(MessageType.REMOVE_EVENT, { type, id: this.uuid });
    super.removeEventListener(type, listener);
  }
}

class CanvasProxy extends DOMProxy {
  constructor(messageQueue: MessageQueue) {
    super(messageQueue, 'canvas');
  }
}

class AudioProxy extends DOMProxy {
  constructor(messageQueue: MessageQueue, type: string = 'audio') {
    super(messageQueue, type);
  }
}

class VideoProxy extends AudioProxy {
  constructor(messageQueue: MessageQueue) {
    super(messageQueue, 'video');
  }
  play() {
    this.messageQueue.push(MessageType.DOCUMENT_ELEMENT_FUNCTION_CALL, {
      call: 'play',
      id: this.uuid,
      args: [],
    });
  }
  set src(src: string) {
    this.messageQueue.push(MessageType.DOCUMENT_ELEMENT_PARAM_SET, {
      param: 'src',
      id: this.uuid,
      arg: src,
    });
  }
}

class AudioObjectProxy extends Object3D {
  type: string = 'audioProxy';
  constructor() {
    super();
  }
}

class WorkerProxy extends MessageQueue {
  constructor(worker: Worker, eventTarget: EventTarget) {
    super(worker, eventTarget);
  }
}

class MainProxy extends MessageQueue {
  canvas: OffscreenCanvas | null;
  width: number;
  height: number;
  left: number;
  top: number;

  constructor(worker: Worker, eventTarget: EventTarget) {
    super(worker, eventTarget);

    this.canvas = null;
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
  const documentElementMap = new Map<string, any>();
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_FUNCTION_CALL,
    ({ call, id, args }: { call: string; id: string; args: any[] }) => {
      console.log(call, id, args, documentElementMap.get(id));
      documentElementMap.get(id)[call](...args);
    },
  );
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_PARAM_SET,
    ({ param, id, arg }: { param: string; id: string; arg: any }) => {
      console.log(param, id, arg, documentElementMap.get(id));
      documentElementMap.get(id)[param] = arg;
    },
  );
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_CREATE,
    ({ type, id }: { type: string; id: string }) => {
      switch (type) {
        case 'video':
          {
            const video = document.createElement('video');
            document.body.append(video);
            video.crossOrigin = 'anonymous';
            documentElementMap.set(id, video);
          }
          break;
        default:
          break;
      }
    },
  );
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
  window.addEventListener('resize', () => {
    messageQueue.push(MessageType.EVENT, {
      type: 'resize',
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });
  });

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
        canvas: OffscreenCanvas;
        width: number;
        height: number;
      } = args;
      messageQueue.canvas = canvas;
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
        createElement(type: string): DOMProxy | null {
          switch (type) {
            // case 'canvas':
            //   return new CanvasProxy(messageQueue);
            // case 'audio':
            //   return new AudioProxy(messageQueue);
            case 'video':
              return new VideoProxy(messageQueue);
            default:
              return null;
          }
        },
      };

      onCanvas(args);
    },
  );
  messageQueue.addEventListener('resize', ({ width, height }: any) => {
    messageQueue.width = width;
    messageQueue.height = height;
  });
  return messageQueue;
}
