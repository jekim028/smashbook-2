import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../constants/Firebase';

async function createUserDocuments() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No user is currently signed in');
      return;
    }

    // Check if user document already exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // Create user document
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: user.displayName || '',
        createdAt: new Date()
      });
      console.log('User document created successfully');
    } else {
      console.log('User document already exists');
    }
  } catch (error) {
    console.error('Error creating user document:', error);
  }
}

// Run the function
createUserDocuments(); 