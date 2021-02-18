import { simplifyObject } from '../../util/simplifyObject';
import { EventDispatcher, Event as DispatchEvent, Object3D } from 'three';
import { generateUUID } from '../../util/generateUUID';
import { isWebWorker } from '../../util/getEnv';

interface Message {
  messageType: MessageType | string;
  message: object;
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
  DOCUMENT_ELEMENT_ADD_EVENT,
  DOCUMENT_ELEMENT_REMOVE_EVENT,
  DOCUMENT_ELEMENT_EVENT,
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

  messagePort: any;
  queue: Message[];
  interval: NodeJS.Timeout;
  remoteDocumentObjects: Map<string, DOMProxy>;
  eventTarget: EventTarget;

  constructor(messagePort: any, eventTarget: EventTarget) {
    super(eventTarget, (args: any) => {
      this.queue.push({
        messageType: MessageType.EVENT,
        message: simplifyObject(args),
      } as Message);
    });
    this.messagePort = messagePort;
    this.eventTarget = eventTarget;
    this.queue = [];
    this.remoteDocumentObjects = new Map<string, DOMProxy>();

    this.messagePort.onmessage = (message: any) => {
      this.receiveQueue(message.data as object[]);
    };
    this.interval = setInterval(() => {
      this.sendQueue();
    }, 1000 / 60);
  }

  // push(
  //   type: MessageType | any,
  //   message: object,
  //   transferables?: Transferable[],
  // ) {
  //   this.queue.push({
  //     messageType: type,
  //     message,
  //     transferables,
  //   });
  // }

  sendQueue() {
    if (!this.queue?.length) return;
    const messages: object[] = [];
    this.queue.forEach((message: Message) => {
      messages.push({
        type: message.messageType,
        message: message.message,
      });
    });
    const transferables: Transferable[] = [];
    this.queue.forEach((message: Message) => {
      message.transferables && transferables.push(...message.transferables);
    });
    try {
      this.messagePort.postMessage(messages, transferables);
    } catch (e) {
      console.log(e);
    }
    this.queue = [];
  }

  receiveQueue(queue: object[]) {
    queue.forEach((element: object) => {
      /** @ts-ignore */
      const { type, message } = element;
      if (!message.proxyID || message.proxyID === '') {
        if (this.messageTypeFunctions.has(type)) {
          this.messageTypeFunctions.get(type)(message);
        }
      } else {
        if (this.remoteDocumentObjects.get(message.proxyID)) {
          this.remoteDocumentObjects
            .get(message.proxyID)
            ?.messageTypeFunctions.get(type)(message);
        }
      }
    });
    this.dispatchEvent(new CustomEvent('queue'));
  }

  addEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.queue.push({
      messageType: MessageType.ADD_EVENT,
      message: { type },
    } as Message);
    super.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.queue.push({
      messageType: MessageType.REMOVE_EVENT,
      message: { type },
    } as Message);
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
      this.messageQueue.queue.push({
        messageType: MessageType.EVENT,
        message: simplifyObject(args),
      } as Message);
    });
    this.type = type;
    this.messageQueue = messageQueue;
    this.eventTarget = eventTarget || messageQueue.eventTarget;
    this.uuid = generateUUID();
    this.messageQueue.remoteDocumentObjects.set(this.uuid, this);
    this.messageQueue.queue.push({
      messageType: MessageType.DOCUMENT_ELEMENT_CREATE,
      message: {
        type,
        uuid: this.uuid,
      },
    } as Message);
  }

  addEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.messageQueue.queue.push({
      messageType: MessageType.DOCUMENT_ELEMENT_ADD_EVENT,
      message: { type, uuid: this.uuid },
    } as Message);
    super.addEventListener(type, listener);
  }

  removeEventListener(
    type: string,
    listener: (event: DispatchEvent) => void,
  ): void {
    this.messageQueue.queue.push({
      messageType: MessageType.DOCUMENT_ELEMENT_REMOVE_EVENT,
      message: { type, uuid: this.uuid },
    } as Message);
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
  width: number;
  height: number;
  constructor(messageQueue: MessageQueue) {
    super(messageQueue, 'video');
    this.width = 0;
    this.height = 0;
  }
  play() {
    this.messageQueue.queue.push({
      messageType: MessageType.DOCUMENT_ELEMENT_FUNCTION_CALL,
      message: {
        call: 'play',
        uuid: this.uuid,
        args: [],
      },
    } as Message);
  }
  set src(src: string) {
    this.messageQueue.queue.push({
      messageType: MessageType.DOCUMENT_ELEMENT_PARAM_SET,
      message: {
        param: 'src',
        uuid: this.uuid,
        arg: src,
      },
    } as Message);
  }
}

class AudioObjectProxy extends Object3D {
  type: string = 'audioProxy';
  constructor() {
    super();
  }
}

class WorkerProxy extends MessageQueue {
  constructor(messagePort: any, eventTarget: EventTarget) {
    super(messagePort, eventTarget);
  }
}

class MainProxy extends MessageQueue {
  canvas: OffscreenCanvas | null;
  width: number;
  height: number;
  left: number;
  top: number;

  constructor(messagePort: any, eventTarget: EventTarget) {
    super(messagePort, eventTarget);

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
    ({ call, uuid, args }: { call: string; uuid: string; args: any[] }) => {
      documentElementMap.get(uuid)[call](...args);
    },
  );
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_PARAM_SET,
    ({ param, uuid, arg }: { param: string; uuid: string; arg: any }) => {
      documentElementMap.get(uuid)[param] = arg;
    },
  );
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_ADD_EVENT,
    ({ type, uuid }: { type: string; uuid: string }) => {
      if (documentElementMap.get(uuid)) {
        const listener = (...args: any) => {
          const event = simplifyObject(args) as any;
          event.type = type;
          event.proxyID = uuid;
          messageQueue.queue.push({
            messageType: MessageType.EVENT,
            message: event,
          } as Message);
        };
        documentElementMap.get(uuid).addEventListener(type, listener);
        documentElementMap.get(uuid).proxyListener = listener;
      }
    },
  );
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_REMOVE_EVENT,
    ({ type, uuid }: { type: string; uuid: string }) => {
      if (documentElementMap.get(uuid)) {
        documentElementMap
          .get(uuid)
          .removeEventListener(
            type,
            documentElementMap.get(uuid).proxyListener,
          );
        delete documentElementMap.get(uuid).proxyListener;
      }
    },
  );
  messageQueue.messageTypeFunctions.set(
    MessageType.DOCUMENT_ELEMENT_CREATE,
    ({ type, uuid }: { type: string; uuid: string }) => {
      switch (type) {
        case 'video':
          {
            const video = document.createElement('video');
            /** @ts-ignore */
            document.body.append(video);
            video.crossOrigin = 'anonymous';
            documentElementMap.set(uuid, video);
          }
          break;
        default:
          break;
      }
    },
  );
  messageQueue.queue.push({
    messageType: MessageType.OFFSCREEN_CANVAS,
    message: {
      width,
      height,
      top,
      left,
      canvas: offscreen,
      pixelRatio: window.devicePixelRatio,
    },
    transferables: [offscreen],
  } as Message);
  window.addEventListener('resize', () => {
    messageQueue.queue.push({
      messageType: MessageType.EVENT,
      message: {
        type: 'resize',
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      },
    } as Message);
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
