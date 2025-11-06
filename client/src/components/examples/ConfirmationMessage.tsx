import ConfirmationMessage from '../ConfirmationMessage'

export default function ConfirmationMessageExample() {
  return (
    <ConfirmationMessage 
      message="User ID Created"
      onContinue={() => console.log('Continue clicked')}
    />
  )
}
