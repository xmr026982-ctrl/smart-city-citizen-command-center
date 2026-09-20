import BG from '../assets/videos/BG.mp4'
import './videocomponents.css'
export default function VideoComponents({ className = '' }) {
  return (
    <video
      className={`home-video ${className}`.trim()}
      src={BG}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    />

  )
}
