import React, { useEffect } from 'react';
import './index.css';
import workerize from './workerize/';

function App() {
  useEffect(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    (globalThis as any).canvas = canvas;
    workerize(canvas);
  });

  return (
    <div className="App">
      <canvas id="canvas" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export default App;
