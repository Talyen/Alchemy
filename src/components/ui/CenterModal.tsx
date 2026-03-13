import type { ReactNode } from 'react'
import { Modal } from '@/ui/primitives'

type CenterModalProps = {
  open: boolean
  onClose: () => void
  widthClassName?: string
  children: ReactNode
}

export function CenterModal({ open, onClose, widthClassName, children }: CenterModalProps) {
  return (
    <Modal open={open} onClose={onClose} className={widthClassName ?? 'max-w-[min(94vw,1220px)]'}>
      {children}
    </Modal>
  )
}
