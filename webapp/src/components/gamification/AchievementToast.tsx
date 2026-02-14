/* AchievementToast — Slides in from top with mini confetti */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  title: string
  description: string
  icon: string
  visible: boolean
  onDismiss: () => void
}

export default function AchievementToast({ title, description, icon, visible, onDismiss }: Props) {
  const [show, setShow] = useState(visible)

  useEffect(() => {
    setShow(visible)
    if (visible) {
      const timer = setTimeout(() => {
        setShow(false)
        onDismiss()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [visible, onDismiss])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 left-4 right-4 z-[100] mx-auto max-w-sm"
        >
          <div className="sm-glass rounded-2xl p-4 flex items-center gap-3 shadow-lg border border-sm-accent/20">
            <span className="text-3xl">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-sm-accent font-semibold uppercase tracking-wider">
                Yutuq!
              </p>
              <p className="text-sm font-bold mt-0.5">{title}</p>
              <p className="text-xs text-sm-muted mt-0.5">{description}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
