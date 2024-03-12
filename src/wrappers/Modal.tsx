import ReactDOM from 'react-dom'
import { MainWrapper } from './Main'
import Plugin from './Plugin'

type YodlSDKModalProps = {
  onClose: () => void
}

export const YodlSDKModal = ({ onClose }: YodlSDKModalProps) => {
  return ReactDOM.createPortal(
    <Plugin onClose={onClose}>
      <MainWrapper />
    </Plugin>,
    document.body,
  )
}
