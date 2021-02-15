import * as Comlink from 'comlink'
import { ThreeScene } from '../scene'
import './eventTransferHandler'
console.log('Starting worker...')
Comlink.expose(ThreeScene)