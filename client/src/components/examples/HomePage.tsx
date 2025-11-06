import HomePage from '../HomePage'

export default function HomePageExample() {
  return (
    <HomePage 
      onNewUser={() => console.log('New User clicked')}
      onExistingUser={() => console.log('Existing User clicked')}
    />
  )
}
