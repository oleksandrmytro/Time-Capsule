import { Timer } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useEffect, useRef } from "react"

interface FooterProps {
  onHome?: () => void
  isLanding?: boolean
  onHeightChange?: (height: number) => void
}

export function Footer({ onHome, isLanding = false, onHeightChange }: FooterProps) {
  const navigate = useNavigate()
  const footerRef = useRef<HTMLElement | null>(null)
  const useDarkStyle = isLanding
  const footerClass = useDarkStyle
    ? "border-t border-cyan-200/12 bg-[#1a3f73]/82 px-4 py-2.5 backdrop-blur-xl lg:px-8"
    : "border-t border-cyan-200/12 bg-[#1a3f73]/78 px-4 py-2.5 backdrop-blur-xl lg:px-8"
  const logoIconClass = "flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[linear-gradient(135deg,rgba(124,92,255,0.5),rgba(94,230,255,0.35))]"
  const logoTextClass = "font-serif text-lg font-bold text-slate-100"
  const captionClass = "text-xs text-slate-300 sm:text-sm"

  const handleHome = () => {
    if (onHome) onHome()
    navigate('/')
  }

  useEffect(() => {
    if (!onHeightChange) return
    const node = footerRef.current
    if (!node) return

    const notify = () => onHeightChange(Math.ceil(node.getBoundingClientRect().height))
    notify()

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => notify())
      observer.observe(node)
      return () => {
        observer.disconnect()
        onHeightChange(0)
      }
    }

    const handleResize = () => notify()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      onHeightChange(0)
    }
  }, [onHeightChange])

  return (
    <footer ref={footerRef} className={footerClass}>
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <button onClick={handleHome} className="flex items-center gap-2 bg-transparent border-none p-0 shadow-none hover:opacity-80">
          <div className={logoIconClass}>
            <Timer className="h-4 w-4 text-slate-50" />
          </div>
          <span className={logoTextClass}>TimeCapsule</span>
        </button>
        <p className={captionClass}>Built for memories that matter.</p>
      </div>
    </footer>
  )
}
