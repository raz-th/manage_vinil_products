// app/page.js
import { Suspense } from 'react';
import ClientPage from './ClientPage';

export default function Page() {
    return (
        <Suspense fallback={null}>
            <ClientPage />
        </Suspense>
    );
}