import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LidarReplay } from './LidarReplay'
import './style.css'
const showLidarReplay = new URLSearchParams(location.search).get('lab') === 'lidar'
createRoot(document.getElementById('root')!).render(showLidarReplay ? <LidarReplay /> : <App />)
