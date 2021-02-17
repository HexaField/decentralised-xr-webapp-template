import React from 'react';
import ReactDOM from 'react-dom';
import App from './App/index';
import './index.css';
import { startNode } from './node/index';
import type { PeerNode } from './node/PeerNode';

const node: PeerNode = startNode();
node.start();

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root'),
);

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://snowpack.dev/concepts/hot-module-replacement
if (import.meta.hot) {
  import.meta.hot.accept();
}
