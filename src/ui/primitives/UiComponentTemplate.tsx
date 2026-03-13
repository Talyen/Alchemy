import type { ReactNode } from 'react'
import { Stack, Panel, Row, Button } from '@/ui/primitives'

interface UiComponentTemplateProps {
  title: string
  children: ReactNode
  onPrimaryAction?: () => void
}

// Template for new UI screens/components:
// - compose from primitives first
// - keep layout container-based
// - avoid absolute/fixed primary layout
export function UiComponentTemplate({ title, children, onPrimaryAction }: UiComponentTemplateProps) {
  return (
    <Panel className="w-full max-w-5xl">
      <Stack gap="md">
        <Row justify="between" align="center" wrap>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">{title}</h2>
          {onPrimaryAction ? <Button onClick={onPrimaryAction}>Primary Action</Button> : null}
        </Row>
        <div data-ui-container className="w-full min-w-0 whitespace-normal break-words">
          {children}
        </div>
      </Stack>
    </Panel>
  )
}
