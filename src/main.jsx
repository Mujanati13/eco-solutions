import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './i18n/config.js'
import './index.css'

// Import Ant Design locale files
import enUS from 'antd/locale/en_US'
import frFR from 'antd/locale/fr_FR'
import arEG from 'antd/locale/ar_EG'

const getAntdLocale = () => {
  const lang = localStorage.getItem('i18nextLng') || 'en'
  switch (lang) {
    case 'ar':
      return arEG
    case 'fr':
      return frFR
    default:
      return enUS
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={getAntdLocale()} direction={localStorage.getItem('i18nextLng') === 'ar' ? 'rtl' : 'ltr'}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
