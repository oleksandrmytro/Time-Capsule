import { useEffect, useRef } from 'react'
import { mountSpaceScene } from '@/lib/space-scene'
import { cn } from '@/lib/utils'

type SpaceBackgroundFrameProps = {
  className?: string
  restoreSnapshot?: boolean
  startSettled?: boolean
}

export function SpaceBackgroundFrame({
  className,
  restoreSnapshot = false,
  startSettled = false,
}: SpaceBackgroundFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dispose = mountSpaceScene(canvas, { restoreSnapshot, startSettled })
    return () => {
      dispose()
    }
  }, [restoreSnapshot, startSettled])

  return (
    <canvas
      ref={canvasRef}
      className={cn('space-landing-frame block h-full w-full', className)}
    />
  )
}
