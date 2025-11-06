import { useState } from 'react'
import NewUserDialog from '../NewUserDialog'

export default function NewUserDialogExample() {
  const [open, setOpen] = useState(true)
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <NewUserDialog 
        open={open}
        onOpenChange={setOpen}
        onSubmit={(userName, email) => console.log('User created:', { userName, email })}
      />
    </div>
  )
}
