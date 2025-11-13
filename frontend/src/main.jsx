import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import { initConsoleFilter } from './utils/consoleFilter';
import { Toaster } from 'react-hot-toast';

// Initialize console filter to suppress browser extension warnings
initConsoleFilter();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
  <App />
  <Toaster position="top-right"/>
    </>
  </StrictMode>,
)
