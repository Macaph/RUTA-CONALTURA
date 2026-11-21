/*
  CONEXIÓN CON FIREBASE
  Este archivo "enchufa" la página a nuestro proyecto en Firebase.

  ¿Es peligroso que estos datos estén aquí a la vista?
  No. Firebase está hecho para que esta configuración vaya en la página.
  Lo que protege la información son las REGLAS DE SEGURIDAD
  (archivo firestore.rules), que se revisan en los servidores de Google.
*/

// Traemos las piezas de Firebase que usamos (directamente desde internet)
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

// Datos del proyecto (copiados de la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyCnBEbfqcJMqPDnVo9NlIUyGvo4vHThi2M",
  authDomain: "ruta-conaltura.firebaseapp.com",
  projectId: "ruta-conaltura",
  storageBucket: "ruta-conaltura.firebasestorage.app",
  messagingSenderId: "176758700932",
  appId: "1:176758700932:web:47898905555dda3b2b3bd1"
};

// Arrancamos Firebase
const app = initializeApp(firebaseConfig);

// auth = inicio de sesión · db = base de datos (Firestore)
// "export" permite que otros archivos los usen con "import"
export const auth = getAuth(app);
export const db = getFirestore(app);
