import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@xyflow/react/dist/base.css';
import '@encastra/ui/tokens.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('The application shell is missing its root element.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
