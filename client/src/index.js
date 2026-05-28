import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AdminPanel from './components/AdminPanel';

const path = window.location.pathname;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {path === '/admin' ? <AdminPanel /> : <App />}
  </React.StrictMode>
);
