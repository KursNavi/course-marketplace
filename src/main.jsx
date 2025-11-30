import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'  // <--- This line was missing in your screenshot!
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)