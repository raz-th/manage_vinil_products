'use client';

import { useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onIdTokenChanged } from 'firebase/auth';

export default function AuthProvider({ children }) {

    useEffect(() => {

        const unsubscribe = onIdTokenChanged(auth, async (user) => {

            // logout
            if (!user) {

                document.cookie =
                    'firebaseToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

                return;
            }

            // token refresh automat
            const token = await user.getIdToken(true);

            document.cookie = `
                firebaseToken=${token};
                path=/;
                max-age=604800;
                SameSite=Strict
            `;
        });

        return () => unsubscribe();

    }, []);

    return children;
}