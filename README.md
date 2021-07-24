# Amplify Summary

- API Gateway + Lambda. 
    - __Lambda__: _amplify add function_
        We have to choose the runtime - nodeJS, .Net Core, Go, Java, Python.
        For nodeJS, we have to choose the template - CRUD with DynamoDB, Lambda Trigger, Express + API Gateway.
    - __API Gateway__: _amplify add api_
        We have to choose if it is going to be a REST or a GraphQL api. If we choose REST we are using the API Gateway
        For a REST api, choose the path, link it to a lambda within the project, or create a new lambda.
    - We can test the api using _amplify console api_

- AWS AppSync (GraphQL). _amplify add api_

    - We have to choose if it is going to be a REST or a GraphQL api. In this scenario we need to select GraphQL. 

    - For a GraphQL api, we have to choose the authentication mode - API Key, Cognito User Pool, IAM, Open ID Connect. We have to select the _model_, _query_, _mutation_ and _subscription_. AWS Amplify introduces a set of anotations that have the effect to autogenerate the _model_, _query_, _mutation_ and _subscription_ (@model, @connection, @auth, and others).

    - The `@model` directive we used in this schema will transform the base Note type into an expanded AWS AppSync GraphQL API complete with:

        - 1. Additional schema definitions for queries and mutations (Create, Read, Update, Delete, and List operations)
        - 2. Additional schema definitions for GraphQL subscriptions
        - 3. __DynamoDB database__
        - 4. Resolver code for all GraphQL operations mapped to DynamoDB database

- AWS Congnito. _amplify add auth_

    - We have two main pieces: 
        - User pools. Provide a user directory, with groups, users, and operations (singin, singup, change password, etc.)
        - Identity pools. Allow to access other AWS services
    - We can check the auth using _amplify console auth_

- Amplify Event Hub. Amplify has a __local eventing system__ called Hub. Amplify uses Hub for different categories to communicate with one another when specific events occur, such as authentication events like a user sign-in or notification of a file download. Notice that this is __local__, it does run withing the client. We can subscribe to events - add a listener - such as signout.

- Event Sources for a Lambda function
    - API Gateway
    - S3
    - Cognito

# Instalar

```ps
npx create-react-app lambda-trigger-example --template typescript

npm install aws-amplify @aws-amplify/ui-react uuid

amplify init
```

En _index.tsx_ habilitamos _amplify_:

```js
import Amplify from 'aws-amplify'
import config from './aws-exports'
Amplify.configure(config)
```

# Trigger de Cognito

Instalamos el backend de autenticación:

```ps
amplify add auth
```

Indicamos que queremos autenticarnos usando el username, y que precisamos que el email sea parte del urn del usuario. Si elegimos la opción _Add User to Group_, lo que sucederá es que se crea una Lambda que susbscribe al evento de _Cognito_. Se crea el archivo _add-to-group.js_:

Accedemos a las propiedades del evento para decidir que hacer. Aquí por ejemplo comprobamos si el email es uno de estos, _'egsmartin@hotmail.com', 'egsmartin@gmail.com'_, y en caso de serlo ponemos la marca _isAdmin = true_. Notese que hemos configurado que se incluya el email en el urn:

```js
exports.handler = async (event, context, callback) => {
  const cognitoProvider = new aws.CognitoIdentityServiceProvider({
    apiVersion: '2016-04-18'
  });

  let isAdmin = false
  const adminEmails = ['egsmartin@hotmail.com', 'egsmartin@gmail.com']

  // If the user is one of the admins, set the isAdmin variable to true
  if (adminEmails.indexOf(event.request.userAttributes.email) !== -1) {
    isAdmin = true
  }
```

Creamos el grupo sino existiera:

```js
  const groupParams = {
    UserPoolId: event.userPoolId,
  }
  const userParams = {
    UserPoolId: event.userPoolId,
    Username: event.userName,
  }

  if (isAdmin) {
    groupParams.GroupName = 'Admin',
      userParams.GroupName = 'Admin'

    // First check to see if the group exists, and if not create the group
    try {
      await cognitoProvider.getGroup(groupParams).promise();
    } catch (e) {
      await cognitoProvider.createGroup(groupParams).promise();
    }
```

y añadimos el usuario al grupo:

```js
    // If the user is an administrator, place them in the Admin group
    try {
      await cognitoProvider.adminAddUserToGroup(userParams).promise();
      callback(null, event);
    } catch (e) {
      callback(e);
    }
  }
  else {
    // If the user is in neither group, proceed with no action
    callback(null, event)
  }
}
```

Configuramos nuestra App para que tenga acceso a la api de _auth_:

```js
export default withAuthenticator(App)
```

Recuperamos información del usuario:

```js
useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then(user => updateUser(user))
      .catch(err => console.log(err));
  }, [])
```

Comprobamos en el payload a que grupos pertenece el usuario, especificamente si pertence al grupo _Admin_:

```js
  //Si el estaod esta informado, comprobamos si el usuario pertenece al grupo Admin
  if (user.signInUserSession) {
    const { signInUserSession: { idToken: { payload } } }: usuario = user
    console.log('payload: ', payload)

    if (payload['cognito:groups'] &&payload['cognito:groups'].includes('Admin')) {
      isAdmin = true
    }
  }
```

# Trigger de S3

Creamos el servicio de S3:

```ps
amplify add storage
```

Elegimos la opción de _Content_ para crear el servicio de almacenamiento con S3 - la otra alternativa habría sido NoSQL, para DynamoDB. Además de pedirnos cual es el nombre del bucket, tendremos que especificar:
- Si admitimos usuarios autenticados, o autenticados y guests
- Que operaciones pueden hacer usuarios autenticados y guests
- Si crear una lambda asociada al bucket

## Lambda

Usaremos las siguientes librerías:
- sharp. Para manejar imagenes
- aws-sdk. La API de AWS

```js
// Import the sharp library
const sharp = require('sharp')
const aws = require('aws-sdk')
const s3 = new aws.S3()
```

La lambda tiene la firma habitual:

```js
exports.handler = async function (event, context) { //eslint-disable-line
  console.log('Received S3 event:', JSON.stringify(event, null, 2));
```

Podemos acceder al evento. Por ejemplo, si se trata de un borrado de un objeto - imagen -, no hacemos nada
```js
  // If the event type is delete, return from the function
  if (event.Records[0].eventName === 'ObjectRemoved:Delete') return
```

Accedemos al bucket y la key:

```js
  // Next, we get the bucket name and the key from the event.
  const BUCKET = event.Records[0].s3.bucket.name
  const KEY = event.Records[0].s3.object.key
```

Usamos la API de AWS para acceder al bucket, y procesar el objeto como una imagen:

```js
  try {
    // Fetch the image data from S3
    let image = await s3.getObject({ Bucket: BUCKET, Key: KEY }).promise()
    image = await sharp(image.Body)
```

En nuestro caso nos interesa actualizar la imagen si el tamaño es mayor a 1000:

```js
    // Get the metadata from the image, including the width and the height
    const metadata = await image.metadata()
    if (metadata.width > 1000) {
```

Lo que haremos entonces es dimensionar la imagen:

```js
      // If the width is greater than 1000, the image is resized
      const resizedImage = await image.resize({ width: 1000 }).toBuffer()
```

y actualizar el bucket con la imagen manipulada:

```js
      await s3.putObject({
        Bucket: BUCKET,
        Body: resizedImage,
        Key: KEY
      }).promise()
     
      return
    } 
    else {
      return
    }
  }
  catch (err) {
    context.fail(`Error getting files: ${err}`);
  }
};
```

## Librerias

Nuestro lambda utiliza un par de librerías. Tendremos que actualizar el _package.json_, pero el _package.json_ de la función. En nuestro caso lo podemos encontrar en `\AWS_amplify_Lambda\amplify\backend\function\S3Trigger470f6a59\src\`. Añadimos la dependencia, y un script para que _Cloudformation_ instale la dependencia cuando se cree la lambda:

```json
  "scripts": {
    "install": "npm install --arch=x64 --platform=linux --target=10.15.0 sharp"
  },
  "dependencies": {
    "sharp": "^0.23.2"
  }
```

