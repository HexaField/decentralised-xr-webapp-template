export class PeerNode {
  constructor() {
    (globalThis as any).node = this;
  }

  async start() {
    console.log('server started')
  }
}