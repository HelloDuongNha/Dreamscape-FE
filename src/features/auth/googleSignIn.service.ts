import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  setPersistence,
  signInWithRedirect,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth'
import { firebaseAuth } from '@/infrastructure/firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })
const REDIRECT_PENDING_KEY = 'ds_google_redirect_pending'

export async function beginGoogleSignIn(): Promise<string | null> {
  const auth = firebaseAuth()
  await setPersistence(auth, browserLocalPersistence)
  if (preferRedirect()) {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, '1')
    await signInWithRedirect(auth, provider)
    return null
  }
  return credentialToken(await signInWithPopup(auth, provider))
}

export async function consumeGoogleRedirect(): Promise<string | null> {
  if (sessionStorage.getItem(REDIRECT_PENDING_KEY) !== '1') return null
  const auth = firebaseAuth()
  await setPersistence(auth, browserLocalPersistence)
  try {
    const credential = await getRedirectResult(auth)
    sessionStorage.removeItem(REDIRECT_PENDING_KEY)
    if (!credential) return null
    return credentialToken(credential)
  } catch (error) {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY)
    throw error
  }
}

async function credentialToken(credential: UserCredential): Promise<string> {
  return credential.user.getIdToken(true)
}

function preferRedirect(): boolean {
  const iPadDesktopMode = /Macintosh/iu.test(navigator.userAgent) && navigator.maxTouchPoints > 1
  return iPadDesktopMode || /Android|iPad|iPhone|iPod/iu.test(navigator.userAgent)
}
