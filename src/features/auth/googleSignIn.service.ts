import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth'
import { firebaseAuth } from '@/infrastructure/firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export async function beginGoogleSignIn(): Promise<string | null> {
  const auth = firebaseAuth()
  if (preferRedirect()) {
    await signInWithRedirect(auth, provider)
    return null
  }
  return credentialToken(await signInWithPopup(auth, provider))
}

export async function consumeGoogleRedirect(): Promise<string | null> {
  const result = await getRedirectResult(firebaseAuth())
  return result ? credentialToken(result) : null
}

async function credentialToken(credential: UserCredential): Promise<string> {
  return credential.user.getIdToken(true)
}

function preferRedirect(): boolean {
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}
