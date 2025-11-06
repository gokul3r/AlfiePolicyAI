import { useState } from 'react'
import ExistingUserDialog from '../ExistingUserDialog'

export default function ExistingUserDialogExample() {
  const [open, setOpen] = useState(true)
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <ExistingUserDialog 
        open={open}
        onOpenChange={setOpen}
        onSubmit={(email) => console.log('Login attempted:', email)}
      />
    </div>
  )
}
