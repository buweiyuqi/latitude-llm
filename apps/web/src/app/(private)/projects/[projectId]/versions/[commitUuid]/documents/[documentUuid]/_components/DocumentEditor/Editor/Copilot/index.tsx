import { DocumentVersion } from '@latitude-data/core/browser'
import { ChatTextArea } from '@latitude-data/web-ui'

export function CopilotInput({
  documentVersion,
  suggestContent,
}: {
  documentVersion: DocumentVersion
  suggestContent: (prompt: string) => void
}) {
  return (
    <ChatTextArea
      placeholder='Write your prompt here...'
      onSubmit={suggestContent}
      clearChat={() => {}}
    />
  )
}
