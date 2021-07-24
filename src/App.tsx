import './App.css';
import React, { useEffect, useState, ChangeEvent } from 'react'
import { Auth } from 'aws-amplify'
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react'
import './App.css'
import { Storage } from 'aws-amplify'
import { v4 as uuid } from 'uuid'

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

    if (payload['cognito:groups'] && payload['cognito:groups'].includes('Admin')) {
      isAdmin = true
    }
  }

  //Cada imagen se guarda como una base64
  const [images, setImages] = useState([] as string[])

  async function fetchImages() {
    //Recupera todas las imagenes del bucket
    const files:{key:string}[] = await Storage.list('')
    //Para cada imagen del bucket... 
    const signedFiles:string[] = await Promise.all(files.map(async file => {
      //...recuperamos el contenido de la imagen
      const signedFile = await Storage.get(file.key)
      return signedFile as string
    }))
    //Guardamos el contenido de todas las imagenes en el estado
    setImages(signedFiles)
  }

  //Cuando se selecciona un nuevo archivo con una imagen
  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    //Obtiene el nombre del archivo
    const file = e.target.files?e.target.files[0]:null;
    if(file){
      //Nos quedamos con el nomreb del fichero
      const filetype = file.name.split('.')[file.name.split.length - 1]
      
      await Storage.put(`${uuid()}.${filetype}`, file)
      /* Once the file is uploaded, fetch the list of images */
      fetchImages()
    }
  }

  useEffect(() => {
    fetchImages()
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>Hello World</h1>
        {isAdmin && <p>Welcome, Admin</p>}
  
        <input
          type="file"
          onChange={onChange}
        />
        {
          images.map(image => (
            <img
              src={image}
              key={image}
              style={{ width: 500 }}
            />
          ))
        }
      </header>
      <AmplifySignOut />
    </div>
    );
}


export default withAuthenticator(App)
