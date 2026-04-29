"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function BarcodeScanner({ onScan }) {
    const videoRef = useRef(null);
    const codeReader = useRef(null);
    const scannedRef = useRef(false);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan; // Actualizează la fiecare render, fără useEffect

    useEffect(() => {
        const reader = new BrowserMultiFormatReader();
        console.log("reader methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(reader)));
        codeReader.current = reader;

        const startScanner = async () => {
            try {
                await reader.decodeFromConstraints(
                    { video: { facingMode: "environment" } },
                    videoRef.current,
                    (result, err) => {
                        if (result && !scannedRef.current) {
                            scannedRef.current = true;
                            const text = result.getText();
                            onScanRef.current(text);
                            reader.reset();
                        }
                    }
                );
            } catch (err) {
                console.error("Camera error:", err);
            }
        };

        startScanner();

        return () => {
            try {
                if (reader && typeof reader.reset === 'function') {
                    reader.reset();
                }
            } catch (e) {
                // ignore
            }
        };
    }, []); // fără deps

    return <video ref={videoRef} style={{ width: "100%" }} />;
}