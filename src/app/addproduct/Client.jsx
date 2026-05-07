'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
    collection,
    addDoc,
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { LucideBarcode, LucidePlus, LucideImage, LucideSave, LucideArrowLeft, LucideGlobe, LucideFingerprint } from 'lucide-react';
import './addprocuct.css'
import BarcodeScanner from '@/components/BarcodeScanner';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { db } from '@/lib/firebase';

const maxDots = 5;



export default function Client() {
    const [formData, setFormData] = useState({
        id: 'xxxxxxx',
        scannedId: '',
        title: '',
        artist: '',
        year: '',
        country: '',
        format: '',
        price: '',
        stock: '',
        imageUrl: []
    });
    const [hasOverflow, setHasOverflow] = useState(false);
    const scrollRef = useRef(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isScanning, setIsScanning] = useState(false);
    const [countries, setCountries] = useState([]);

    const barcodeBuffer = useRef('');
    const barcodeTimeout = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                const code = barcodeBuffer.current.trim();
                barcodeBuffer.current = '';
                if (code.length > 3) {
                    handleScanner(code);
                }
                return;
            }

            barcodeBuffer.current += e.key;
            clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = setTimeout(() => {
                barcodeBuffer.current = '';
            }, 100);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleScanToggle = () => {
        setIsScanning(!isScanning);
        if (!isScanning) {
            setMessage({ type: 'info', text: 'Accesare cameră pentru scanare...' });
            //   setTimeout(() => {
            //     const mockBarcode = "ABC-" + Math.floor(Math.random() * 1000000);
            //     setFormData(prev => ({ ...prev, id: mockBarcode }));
            //     setIsScanning(false);
            //     setMessage({ type: 'success', text: 'Cod scanat cu succes!' });
            //   }, 2000);
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const checkOverflow = () => {
            setHasOverflow(el.scrollWidth > el.clientWidth);
        };

        const timer = setTimeout(checkOverflow, 0);

        window.addEventListener('resize', checkOverflow);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkOverflow);
        };
    }, [formData]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.id || formData.id === 'xxxxxxx') {
            setMessage({ type: 'error', text: 'Scanează un produs înainte de salvare!' });
            return;
        }
        if (!formData.title) {
            setMessage({ type: 'error', text: 'Titlul este obligatoriu!' });
            return;
        }
        if (!formData.price || !formData.stock) {
            setMessage({ type: 'error', text: 'Prețul și stocul sunt obligatorii!' });
            return;
        }

        setLoading(true);
        setMessage({ type: 'info', text: 'Se salvează produsul...' });

        try {
            const productRef = doc(db, 'releases', String(formData.id));

            const checkDoc = await getDoc(productRef);
            if (checkDoc.exists()) {
                setMessage({ type: 'error', text: 'Acest produs există deja în inventar!' });
                setLoading(false);
                return;
            }

            // Găsește țara selectată din lista de countries
            const selectedCountry = countries.find(c => String(c.id) === String(formData.country));

            const productData = {
                id: formData.id,
                title: formData.title,
                title_lowercase: formData.title.toLowerCase(),
                artist: formData.artist,
                artist_lowercase: formData.artist.toLowerCase(),
                year: Number(formData.year) || 0,
                country: selectedCountry?.country || "",
                format: formData.format,
                format_desc: formData.format,
                price: Number(formData.price),
                stock: Number(formData.stock),
                cover_image: formData.imageUrl[0]?.replace(`/api/image-proxy?url=`, '')
                    ? decodeURIComponent(formData.imageUrl[0].replace('/api/image-proxy?url=', ''))
                    : "",
                thumb: formData.imageUrl[0] || "",
                label: "",
                genres: [],
                styles: [],
                date_added: new Date().toISOString(),
            };

            await setDoc(productRef, productData);

            setMessage({ type: 'success', text: 'Produs adăugat cu succes!' });
            setFormData({
                id: 'xxxxxxx',
                scannedId: '',
                title: '',
                artist: '',
                year: '',
                country: '',
                format: '',
                price: '',
                stock: '',
                imageUrl: []
            });
            setCountries([]);
            setSelectedImage(0);

        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Eroare la salvare: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const total = formData.imageUrl.length;

    let start = 0;



    if (total > maxDots) {
        if (selectedImage <= 2) {
            start = 0;
        } else if (selectedImage >= total - 3) {
            start = total - maxDots;
        } else {
            start = selectedImage - 2;
        }
    }

    const visibleDots = formData.imageUrl.slice(start, start + maxDots);

    const handleScanner = async (scannedId) => {
        console.log("HANDLE CALLED:", scannedId);

        try {
            const res = await fetch(
                `https://api.discogs.com/database/search?barcode=${scannedId}`,
                {
                    headers: {
                        Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
                        "User-Agent": "MyApp/1.0",
                    }
                }
            );
            const data = await res.json();
            const results = data.results;

            if (!results?.length) {
                setMessage({ type: 'error', text: 'Produsul nu a fost găsit pe Discogs!' });
                setIsScanning(false);
                return;
            }
            const res2 = await fetch(
                `https://api.discogs.com/releases/${results[0].id}`,
                {
                    headers: {
                        Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
                        "User-Agent": "MyApp/1.0",
                    }
                }
            );
            const data2 = await res2.json();
            console.log(results, data2)
            setFormData((prev) => ({
                ...prev,
                scannedId,
                format: results[0].formats[0].name,
                title: results[0].title,
                imageUrl: data2.images.map((v) => `/api/image-proxy?url=${encodeURIComponent(v.uri)}`),
                artist: data2.artists.map((v) => v.name).join(", "),
                year: results[0].year,
                id: data2.id,
                country: results[0].id
            }))
            setCountries(results.map((v) => ({ id: v.id, country: v.country })));
            // console.log(countries)

        } catch (err) {
            console.error(err);
        }

        setIsScanning(false);
    };

    const handleCountryChange = async (id) => {
        console.log(id)
        const res = await fetch(
            `https://api.discogs.com/releases/${id}`,
            {
                headers: {
                    Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
                    "User-Agent": "MyApp/1.0",
                }
            }
        );
        const data = await res.json();
        console.log(data)
        setSelectedImage(0);
        setFormData((prev) => ({
            ...prev,
            title: data.title || "",
            imageUrl: data.images.map((v) => `/api/image-proxy?url=${encodeURIComponent(v.uri)}`) || "",
            artist: data.artists.map((v) => v.name).join(", ") || "",
            year: data.year || "",
            id: data.id,
            // country: data.id
        }))
    }

    const scrollLeft = () => {
        scrollRef.current?.scrollBy({
            left: -100,
            behavior: "smooth"
        });
    };

    const scrollRight = () => {
        scrollRef.current?.scrollBy({
            left: 100,
            behavior: "smooth"
        });
    };

    const handleTouchStart = (e) => {
        setTouchEnd(null); // reset
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;

        const minSwipeDistance = 50;

        if (distance > minSwipeDistance) { //in stanga
            setSelectedImage((prev) =>
                prev < formData.imageUrl.length - 1 ? prev + 1 : prev
            );
        } else if (distance < -minSwipeDistance) { //in dreapta
            setSelectedImage((prev) =>
                prev > 0 ? prev - 1 : prev
            );
        }
    };




    return (
        <div className="container">
            <div className="form-wrapper">
                <header className="header">
                    <div className="header-left">
                        <a className="back-btn" href='/'>
                            <LucideArrowLeft size={24} color='#000' />
                        </a>
                        <h1>Produs Nou</h1>
                    </div>
                </header>
                <div className="unique-id-badge">
                    <div className="badge-content">
                        <LucideFingerprint size={16} className="badge-icon" />
                        <span className="badge-label">COD UNIC IDENTIFICARE:</span>
                        <span className="badge-value">{formData.id}</span>
                    </div>
                </div>
                {message.text && (
                    <div className={`alert alert-${message.type}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="product-form">
                    <section className="form-section">
                        <h2 className="section-title">Identificare</h2>
                        <div className="input-group">
                            <label>Cod de bare</label>
                            <div className="input-with-button">
                                <input
                                    name="scannedId"
                                    value={formData.scannedId}
                                    onChange={handleChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (formData.scannedId.trim().length > 3) {
                                                handleScanner(formData.scannedId.trim());
                                            }
                                        }
                                    }}
                                    placeholder="Scanează sau introdu manual..."
                                    autoFocus
                                />
                                {/* <button
                                    type="button"
                                    onClick={handleScanToggle}
                                    className={`btn-icon ${isScanning ? 'btn-scanning' : 'btn-black'}`}
                                >
                                    <LucideBarcode size={24} />
                                </button> */}
                            </div>
                        </div>
                    </section>

                    <section className="form-section">
                        <h2 className="section-title">Detalii Produs</h2>
                        <div className="grid-2-cols">
                            <div className="input-group col-span-2">
                                <label>Titlu</label>
                                <input
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="Ex: Dark Side of the Moon"
                                />
                            </div>

                            <div className="input-group">
                                <label>Artist</label>
                                <input
                                    name="artist"
                                    value={formData.artist}
                                    onChange={handleChange}
                                    placeholder="Ex: Pink Floyd"
                                />
                            </div>

                            <div className="input-group">
                                <label>An Lansare</label>
                                <input
                                    name="year"
                                    type="number"
                                    value={formData.year}
                                    onChange={handleChange}
                                    placeholder="Ex: 1973"
                                />
                            </div>

                            <div className="input-group">
                                <label>Țara</label>
                                <select name="country" value={formData.country} onChange={(e) => { handleChange(e); handleCountryChange(e.target.value) }}>
                                    <option value="">Selectează țara</option>
                                    {
                                        countries.length > 0 ? countries.map((v, i) => <option key={i} value={v.id}>{v.country}</option>)
                                            :
                                            <option disabled>Scanează un produs</option>
                                    }
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Format</label>
                                <select name="format" value={formData.format} onChange={handleChange}>
                                    <option value="">Selectează format</option>
                                    <option value="Vinyl">Vinil</option>
                                    <option value="CD">CD</option>
                                    <option value="Cassette">Casetă</option>
                                    <option value="DVD">DVD</option>
                                    <option value="Blu-ray">Blu-ray</option>
                                </select>
                            </div>

                            {/* <div className="input-group col-span-2">
                                <label>URL Imagine</label>
                                <div className="input-with-icon">
                                    <LucideImage className="icon" size={18} />
                                    <input
                                        name="imageUrl"
                                        value={formData.imageUrl}
                                        onChange={handleChange}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div> */}
                            <section className='imgSection'>
                                <div style={{ position: 'relative' }}>
                                    <img className='mainImage' src={formData.imageUrl[selectedImage] || "/assets/image.png"}
                                        onTouchStart={handleTouchStart}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                    />
                                    <div className="mobileMoreImagesIndicator">
                                        <div className="dotsContainer">
                                            {visibleDots.map((_, i) => {
                                                const realIndex = start + i;

                                                return (
                                                    <div
                                                        key={realIndex}
                                                        className={`
                    dot
                    ${selectedImage === realIndex ? "selected" : ""}
                    ${i === 0 || i === maxDots - 1 ? "edge" : ""}
                `}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className='moreImagesContainer'>
                                    {
                                        hasOverflow && (
                                            <button onClick={scrollLeft} className="moreImagesBtn">
                                                <FaChevronLeft />
                                            </button>
                                        )
                                    }

                                    <div className={`moreImages ${hasOverflow ? "" : "nu"}`} ref={scrollRef} style={{ width: !hasOverflow ? "100%" : '90%' }}>
                                        {
                                            formData.imageUrl.map((v, i) => (
                                                <img
                                                    key={i}
                                                    src={v || "/assets/image.png"}
                                                    onClick={() => setSelectedImage(i)}
                                                    className={selectedImage === i ? "selected" : ""}
                                                />
                                            ))
                                        }
                                    </div>


                                    {
                                        hasOverflow && (
                                            <button onClick={scrollRight} className="moreImagesBtn">
                                                <FaChevronRight />
                                            </button>
                                        )
                                    }
                                </div>
                            </section>
                        </div>
                    </section>

                    <section className="form-section">
                        <h2 className="section-title">Stoc & Preț</h2>
                        <div className="grid-2-cols">
                            <div className="input-group">
                                <label>Preț (RON)</label>
                                <input
                                    name="price"
                                    type="number"
                                    value={formData.price}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="input-group">
                                <label>Stoc inițial</label>
                                <input
                                    name="stock"
                                    type="number"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </section>

                    <button type="submit" disabled={loading} className="btn-submit">
                        {loading ? <div className="spinner" /> : (
                            <>
                                <LucideSave size={20} />
                                SALVEAZĂ PRODUSUL
                            </>
                        )}
                    </button>
                </form>

                {isScanning && (
                    <div className="scanner-overlay" onClick={() => setIsScanning(false)}>
                        <div className="scanner-view" onClick={(e) => e.stopPropagation()}>
                            <BarcodeScanner onScan={(e) => handleScanner(e)} />
                            <div className="scan-line" />
                            <p>Aliniați codul de bare în careu</p>
                        </div>
                        <button onClick={() => setIsScanning(false)} className="cancel-scan">
                            Anulează Scanarea
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}