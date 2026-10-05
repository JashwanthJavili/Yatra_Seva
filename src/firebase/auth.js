/**
 * Firebase Authentication instance
 *
 * Import `auth` from this module wherever you need Firebase Auth.
 * Never import getAuth() directly from firebase/auth in UI components.
 */

import { getAuth } from 'firebase/auth';
import app from './config';

const auth = getAuth(app);

export default auth;
