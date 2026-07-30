import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth'
import { firebaseAuth } from '@/infrastructure/firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })
let persistenceReady: Promise<void> | null = null

export function prepareGoogleSignIn(): Promise<void> {
  if (!persistenceReady) {
    persistenceReady = setPersistence(firebaseAuth(), browserLocalPersistence)
  }
  return persistenceReady
}

export async function beginGoogleSignIn(): Promise<string | null> {
  // Persistence is prepared when the component mounts. Keep the popup call as
  // the first interaction here so Safari retains the user's click gesture.
  return credentialToken(await signInWithPopup(firebaseAuth(), provider))
}

async function credentialToken(credential: UserCredential): Promise<string> {
  return credential.user.getIdToken(true)
}
