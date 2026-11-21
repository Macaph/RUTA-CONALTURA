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
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-analytics.js";

// Datos del proyecto (copiados de la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyD7FFMeGbgvzcDbk-FF_vxOELEgpdamDZU",
  authDomain: "sgimi-conaltura.firebaseapp.com",
  projectId: "sgimi-conaltura",
  storageBucket: "sgimi-conaltura.firebasestorage.app",
  messagingSenderId: "472753144199",
  appId: "1:472753144199:web:937316d2f40e87c44c1322",
  measurementId: "G-GSPB9V13YW"
};

// Arrancamos Firebase
const app = initializeApp(firebaseConfig);

// auth = inicio de sesión · db = base de datos (Firestore)
// "export" permite que otros archivos los usen con "import"
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics (cuenta las visitas). Si el navegador no lo soporta, no pasa nada.
isSupported().then(function (soportado) {
  if (soportado) getAnalytics(app);
});
