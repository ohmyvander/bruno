import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './pages/index';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { injectDiff2HtmlAssets } from './startupAssets';
import DndTargetErrorGuard from 'components/DndTargetErrorGuard';

const rootElement = document.getElementById('root');

const Main = () => {
  useEffect(() => {
    return injectDiff2HtmlAssets();
  }, []);

  return (
    <React.StrictMode>
      <DndProvider backend={HTML5Backend}>
        <DndTargetErrorGuard />
        <App />
      </DndProvider>
    </React.StrictMode>
  );
};

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<Main />);
}
