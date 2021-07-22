import './App.css';
import React, { useEffect, useState } from 'react'
import { Auth } from 'aws-amplify'
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react'
import './App.css'

type usuario = { 
  signInUserSession: 
  { 
    idToken: 
    { 
      payload:any 
    }
  } |null
} 

const estadoinicial:usuario={
  signInUserSession:null
}


function App() {
  const [user, updateUser] = useState(estadoinicial)
  
  //Recuperamos la configuración del usuario, y actualizamos el estado
  useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then(user => updateUser(user))
      .catch(err => console.log(err));
  }, [])
  
  let isAdmin = false

  //Si el estaod esta informado, comprobamos si el usuario pertenece al grupo Admin
  if (user.signInUserSession) {
    const { signInUserSession: { idToken: { payload } } }: usuario = user
    console.log('payload: ', payload)

    if (payload['cognito:groups'] &&payload['cognito:groups'].includes('Admin')) {
      isAdmin = true
    }
  }

  return (
    <div className="App">
      <header>
        <h1>Hello World</h1>
        {isAdmin && <p>Welcome, Admin</p>}
      </header>
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App)
