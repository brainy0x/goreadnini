import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)

import { db } from './lib/firebaseConfig'
import { collection, addDoc } from 'firebase/firestore'

// Simple test function
async function testFirebase() {
  try {
    const docRef = await addDoc(collection(db, "test_connection"), {
      status: "It works!",
      time: new Date()
    });
    console.log("Document written with ID: ", docRef.id);
    alert("Firebase is working! Check your Firestore dashboard.");
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

// Run it
if (db) {
  testFirebase();
}
