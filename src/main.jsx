import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

// 禁用浏览器自动滚动恢复，由应用自己控制滚动位置
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
