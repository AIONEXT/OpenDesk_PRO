import { useState, useEffect, useRef, useCallback } from 'react'

export type PomodoroMode = 'sprint' | 'focus' | 'short' | 'deep'

export function formatPomodoroTimer(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function usePomodoroTimer(onCompleteToast?: (msg: string) => void) {
  const [pomoMode, setPomoMode] = useState<PomodoroMode>('focus')
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState(25 * 60)
  const [pomoRunning, setPomoRunning] = useState(false)
  const [pomoSessionsCompleted, setPomoSessionsCompleted] = useState(0)
  const pomoSecondsLeftRef = useRef(pomoSecondsLeft)

  useEffect(() => {
    pomoSecondsLeftRef.current = pomoSecondsLeft
  }, [pomoSecondsLeft])

  useEffect(() => {
    if (!pomoRunning) return
    const timer = setInterval(() => {
      setPomoSecondsLeft((prev) => {
        if (prev <= 1) {
          setPomoRunning(false)
          if (pomoMode !== 'short') {
            setPomoSessionsCompleted((c) => c + 1)
          }
          onCompleteToast?.(
            pomoMode !== 'short'
              ? '🎉 Focus session complete! Take a 5m break.'
              : '⏰ Break complete! Ready to focus.'
          )
          return pomoMode !== 'short' ? 5 * 60 : 25 * 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [pomoRunning, pomoMode, onCompleteToast])

  const formatTimer = useCallback((sec: number) => formatPomodoroTimer(sec), [])

  return {
    pomoMode,
    setPomoMode,
    pomoSecondsLeft,
    setPomoSecondsLeft,
    pomoRunning,
    setPomoRunning,
    pomoSessionsCompleted,
    setPomoSessionsCompleted,
    pomoSecondsLeftRef,
    formatTimer,
  }
}
