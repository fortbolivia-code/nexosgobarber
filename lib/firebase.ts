import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB5YyF1KG9UUTiEiELVWufoSsGiMRA-Ih4",
  authDomain: "nexos-go-barber.firebaseapp.com",
  projectId: "nexos-go-barber",
  storageBucket: "nexos-go-barber.firebasestorage.app",
  messagingSenderId: "166694912182",
  appId: "1:166694912182:web:399e41a3070970bddda617",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);