import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  rootElement = document.createElement('div')
  rootElement.id = 'root'
  document.body.appendChild(rootElement)
}

 createRoot(rootElement, <App />)
