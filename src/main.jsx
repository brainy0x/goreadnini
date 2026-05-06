import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)


import { db } from './lib/firebaseConfig'
import { collection, addDoc } from 'firebase/firestore'

async function runFirebaseTest() {
  console.log("Testing Firebase connection...");
  try {
    const docRef = await addDoc(collection(db, "test_collection"), {
      message: "Hello from goreadnini!",
      timestamp: new Date(),
      status: "Success"
    });
    console.log("✅ Success! Document written with ID:", docRef.id);
    alert("Firebase is working! ID: " + docRef.id);
  } catch (error) {
    console.error("❌ Firebase Error:", error.message);
    alert("Firebase failed: " + error.message);
  }
}

// Run the test
runFirebaseTest();
