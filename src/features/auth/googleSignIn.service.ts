import {
  GoogleAuthProvider,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth'
import { firebaseAuth } from '@/infrastructure/firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export async function beginGoogleSignIn(): Promise<string> {
  return credentialToken(await signInWithPopup(firebaseAuth(), provider))
}

async function credentialToken(credential: UserCredential): Promise<string> {
  return credential.user.getIdToken(true)
}
