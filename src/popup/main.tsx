import React from 'react';
import ReactDOM from 'react-dom/client';
import { Popup } from './Popup';
import '../styles/globals.css';
import './popup.css';
import { applyTheme, loadTheme } from '../shared/theme';

// Apply saved theme
applyTheme(loadTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
