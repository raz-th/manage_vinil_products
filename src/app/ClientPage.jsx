'use client'
import React, { useEffect, useState, useRef } from 'react';
import {
    collection, query, orderBy, limit, getDocs,
    startAfter, updateDoc, doc, where, getDoc,
    getCountFromServer, setDoc, deleteDoc
} from 'firebase/firestore';

import "./page.css"
import { db } from '@/lib/firebase';
import { CiBarcode } from 'react-icons/ci';
import { IoAddCircleOutline } from 'react-icons/io5';
import { MdDelete } from 'react-icons/md';
import { useRouter } from 'next/navigation';

const PAGE_SIZE = 20;

const ClientPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastVisible, setLastVisible] = useState(null);
    const [isEnd, setIsEnd] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [overAllInfo, setOverAllInfo] = useState({ total: 0 });
    const [scanMode, setScanMode] = useState("search"); // "search" | "sale"
    const [saleResults, setSaleResults] = useState([]);
    const [saleQuantity, setSaleQuantity] = useState(1);
    const [saleProduct, setSaleProduct] = useState(null);
    const [scanStatus, setScanStatus] = useState(null); // messaj status scanner
    const router = useRouter();

    // ── Scanner fizic USB (global keypress buffer) ──
    const barcodeBuffer = useRef('');
    const barcodeTimeout = useRef(null);

    useEffect(() => {
        const handleKeyPress = (e) => {
            // Ignoră dacă e focusat pe un input
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                const code = barcodeBuffer.current.trim();
                barcodeBuffer.current = '';
                if (code.length > 3) {
                    if (scanMode === 'sale') {
                        handleSaleScanner(code);
                    } else {
                        handleScanner(code);
                    }
                }
                return;
            }

            barcodeBuffer.current += e.key;
            clearTimeout(barcodeTimeout.current);
            barcodeTimeout.current = setTimeout(() => {
                barcodeBuffer.current = '';
            }, 100);
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [scanMode]);

    useEffect(() => {
        fetchProducts(true);
    }, []);

    const fetchProducts = async (isInitial = false, search = "") => {
        if (loading) return;
        setLoading(true);

        try {
            const productsRef = collection(db, "releases");
            const countSnapshot = await getCountFromServer(productsRef);
            setOverAllInfo(prev => ({ ...prev, total: countSnapshot.data().count }));

            let newData = [];
            let lastDoc = null;

            if (search) {
                const docRef = doc(db, "releases", search);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    newData = [{ id: docSnap.id, ...docSnap.data(), inInventar: true }];
                    setIsEnd(true);
                } else {
                    const q = query(
                        productsRef,
                        orderBy("artist_lowercase"),
                        where("artist_lowercase", ">=", search.toLowerCase()),
                        where("artist_lowercase", "<=", search.toLowerCase() + "\uf8ff"),
                        limit(PAGE_SIZE)
                    );
                    const documentSnapshots = await getDocs(q);
                    newData = documentSnapshots.docs.map(d => ({ id: d.id, ...d.data(), inInventar: true }));
                    lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
                    setIsEnd(documentSnapshots.docs.length < PAGE_SIZE);
                }
            } else {
                const q = isInitial
                    ? query(productsRef, orderBy("artist_lowercase"), limit(PAGE_SIZE))
                    : query(productsRef, orderBy("artist_lowercase"), startAfter(lastVisible), limit(PAGE_SIZE));

                const documentSnapshots = await getDocs(q);
                newData = documentSnapshots.docs.map(d => ({ id: d.id, ...d.data(), inInventar: true }));
                lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
                setIsEnd(documentSnapshots.docs.length < PAGE_SIZE);
            }

            setProducts(prev => (isInitial || search) ? newData : [...prev, ...newData]);
            setLastVisible(lastDoc);
        } catch (error) {
            console.error("Eroare Firebase:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length >= 2 || value.length === 0) {
            fetchProducts(true, value);
        }
    };

    const handleUpdatePrice = async (id, newPrice, newStock, e) => {
        e.stopPropagation();
        try {
            await updateDoc(doc(db, "releases", String(id)), {
                price: Number(newPrice),
                stock: Number(newStock)
            });
            alert("Actualizat!");
        } catch (error) {
            alert("Eroare: " + error.message);
        }
    };

    const handleScanner = async (scannedId) => {
        setScanStatus('Se caută...');
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

            const detailedResults = await Promise.all(
                data.results.map(async (item) => {
                    const fDoc = await getDoc(doc(db, "releases", String(item.id)));
                    try {
                        const detailRes = await fetch(
                            `https://api.discogs.com/releases/${item.id}`,
                            {
                                headers: {
                                    Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
                                    "User-Agent": "MyApp/1.0",
                                }
                            }
                        );
                        const detail = await detailRes.json();
                        return {
                            id: item.id,
                            title: detail.title,
                            format: item.formats[0].name,
                            artist: detail.artists?.[0]?.name || "Necunoscut",
                            country: detail.country || "Necunoscută",
                            cover_image: detail.images?.[0]?.uri || null,
                            year: detail.year,
                            inInventar: fDoc.exists(),
                            stock: fDoc.exists() ? (fDoc.data().stock ?? 0) : 0,
                            price: fDoc.exists() ? (fDoc.data().price ?? 0) : 0,
                        };
                    } catch (err) {
                        return item;
                    }
                })
            );

            setProducts(detailedResults);
            setScanStatus(`${detailedResults.length} rezultate găsite`);
            setTimeout(() => setScanStatus(null), 3000);
        } catch (err) {
            setScanStatus('Eroare la scanare');
            setTimeout(() => setScanStatus(null), 3000);
        }
    };

    const handleAddToInventory = async (p, price, stock, e) => {
        e.stopPropagation();
        try {
            const productRef = doc(db, "releases", String(p.id));
            const existing = await getDoc(productRef);
            if (existing.exists()) {
                alert("Produsul există deja în inventar!");
                return;
            }

            const newProduct = {
                id: p.id,
                title: p.title || "",
                title_lowercase: (p.title || "").toLowerCase(),
                artist: p.artist || "Artist necunoscut",
                artist_lowercase: (p.artist || "").toLowerCase(),
                format: p.format || "",
                format_desc: p.format_desc || p.format || "",
                year: p.year || 0,
                country: p.country || "",
                cover_image: p.cover_image || "",
                thumb: p.thumb || "",
                label: p.label || "",
                genres: p.genres || [],
                styles: p.styles || [],
                price: Number(price) || 0,
                stock: Number(stock) || 1,
                date_added: new Date().toISOString(),
            };

            await setDoc(productRef, newProduct);
            setProducts(prev => prev.map(prod =>
                prod.id === p.id ? { ...prod, ...newProduct, inInventar: true } : prod
            ));
            setOverAllInfo(prev => ({ ...prev, total: prev.total + 1 }));
            alert("Produs adăugat în inventar!");
        } catch (error) {
            alert("Eroare la adăugare: " + error.message);
        }
    };

    const handleDeleteProduct = async (id, e) => {
        e.stopPropagation();
        const product = products.find(p => String(p.id) === String(id));
        const confirmed = window.confirm(
            `Ești sigur că vrei să ștergi "${product?.title}" de ${product?.artist}?\n\nAceastă acțiune este ireversibilă!`
        );
        if (!confirmed) return;

        try {
            await deleteDoc(doc(db, "releases", String(id)));
            setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
            setOverAllInfo(prev => ({ ...prev, total: prev.total - 1 }));
        } catch (err) {
            alert("Eroare la ștergere: " + err.message);
        }
    };

    const handleSaleScanner = async (scannedId) => {
        setScanStatus('Se caută pentru vânzare...');
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

            if (!data.results?.length) {
                setScanStatus('Produs negăsit');
                setTimeout(() => setScanStatus(null), 3000);
                return;
            }

            const resultsWithStatus = await Promise.all(
                data.results.map(async (item) => {
                    const snap = await getDoc(doc(db, "releases", String(item.id)));
                    return {
                        id: item.id,
                        title: item.title,
                        country: item.country || "Necunoscută",
                        year: item.year,
                        format: item.formats?.[0]?.name || "",
                        cover_image: item.cover_image || null,
                        inInventar: snap.exists(),
                        ...(snap.exists() ? snap.data() : {})
                    };
                })
            );

            const inInventar = resultsWithStatus.filter(r => r.inInventar);
            if (inInventar.length === 1) {
                setSaleProduct(inInventar[0]);
                setSaleQuantity(1);
            } else {
                setSaleResults(resultsWithStatus);
            }
            setScanStatus(null);
        } catch (err) {
            setScanStatus('Eroare la scanare');
            setTimeout(() => setScanStatus(null), 3000);
        }
    };

    const handleConfirmSale = async () => {
        if (saleQuantity > saleProduct.stock) {
            alert(`Stoc insuficient! Disponibil: ${saleProduct.stock}`);
            return;
        }

        try {
            const newStock = saleProduct.stock - saleQuantity;
            await updateDoc(doc(db, "releases", String(saleProduct.id)), { stock: newStock });
            setProducts(prev => prev.map(p =>
                String(p.id) === String(saleProduct.id) ? { ...p, stock: newStock } : p
            ));
            setSaleProduct(null);
            alert(`Vânzare înregistrată! Stoc rămas: ${newStock}`);
        } catch (err) {
            alert("Eroare: " + err.message);
        }
    };

    return (
        <div className='mainPage'>

        
            {scanStatus && (
                <div className="scan-status">
                    {/* <CiBarcode size={20} /> */}
                    <span>{scanStatus}</span>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ marginBottom: '2rem' }}>Gestionare inventar</h1>
                <div className='topBtns'>
                    <a className="scan-btn-solid" href='/addproduct'>
                        <IoAddCircleOutline size={25} />
                        <span>Adaugă produse</span>
                    </a>
                    <button
                        className={`scan-btn-solid ${scanMode === 'sale' ? 'active-mode' : ''}`}
                        style={{ backgroundColor: scanMode === 'sale' ? "#8b0000" : "#333" }}
                        onClick={() => setScanMode(prev => prev === 'sale' ? 'search' : 'sale')}
                    >
                        <CiBarcode size={25} />
                        <span>{scanMode === 'sale' ? '● Mod Vânzare' : 'Vânzare'}</span>
                    </button>
                </div>
            </div>

            {/* indicator mod activ */}
            {scanMode === 'sale' && (
                <div className="mode-indicator">
                    🔴 Mod vânzare activ — scanează produsul pentru a înregistra o vânzare
                </div>
            )}
            {scanMode === 'search' && (
                <div className="mode-indicator" style={{ background: '#e8f5e9', color: '#2e7d32', borderColor: '#c8e6c9' }}>
                    🟢 Mod căutare activ — scanează produsul pentru a-l găsi în inventar
                </div>
            )}

            <div className="head">
                <div>
                    <p>TOTAL PRODUSE</p>
                    <h1>{overAllInfo.total}</h1>
                </div>
            </div>

            <div className="search-wrapper">
                <h3>Listă inventar</h3>
                <div className='searchUsege'>
                    <input
                        type="text"
                        placeholder="Caută produs..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="products-list">
                {products.map((p) => (
                    <div
                        key={p.id}
                        className={`product-card ${!p.inInventar ? 'not-in-inventory' : ''}`}
                        onClick={() => router.push(`/produs/${p.id}`)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="product-main-content">
                            <div className="product-image">
                                {p.cover_image
                                    ? <img src={p.cover_image} alt={p.title} />
                                    : <div className="image-placeholder">No Image</div>
                                }
                            </div>
                            <div className="product-info">
                                <div className="product-title-row">
                                    <strong>{p.title}</strong>
                                    {p.inInventar
                                        ? p.stock > 0
                                            ? <span className="badge in-stock">✓ În inventar</span>
                                            : <span className="badge not-in-stock">✗ Stoc epuizat</span>
                                        : <span className="badge not-in-stock">✗ Lipsă din inventar</span>
                                    }
                                </div>
                                <span className="product-artist">{p.artist || "Artist necunoscut"}</span>
                                <div className="product-meta">
                                    <span>{p.format}</span>
                                    {p.year > 0 && <><span className="separator">•</span><span>{p.year}</span></>}
                                    {p.country && <><span className="separator">•</span><span>{p.country}</span></>}
                                </div>
                                <small>ID: {p.id}</small>
                            </div>
                        </div>

                        {p.inInventar ? (
                            <div className="product-controls" onClick={e => e.stopPropagation()}>
                                <div className="input-group">
                                    <label>Stoc</label>
                                    <input type="number" defaultValue={String(p.stock ?? 0)} id={`stock-${p.id}`} />
                                </div>
                                <div className="input-group">
                                    <label>Preț (RON)</label>
                                    <input type="number" defaultValue={String(p.price ?? 0)} id={`price-${p.id}`} />
                                </div>
                                <button className="save-btn" onClick={(e) => {
                                    const val = document.getElementById(`price-${p.id}`).value;
                                    const val_st = document.getElementById(`stock-${p.id}`).value;
                                    handleUpdatePrice(p.id, val, val_st, e);
                                }}>
                                    SALVEAZĂ
                                </button>
                                <button className="delete-btn" onClick={(e) => handleDeleteProduct(p.id, e)}>
                                    <MdDelete />
                                </button>
                            </div>
                        ) : (
                            <div className="product-controls" onClick={e => e.stopPropagation()}>
                                <div className="input-group">
                                    <label>Stoc</label>
                                    <input type="number" defaultValue="0" id={`stock-${p.id}`} />
                                </div>
                                <div className="input-group">
                                    <label>Preț (RON)</label>
                                    <input type="number" defaultValue="0" id={`price-${p.id}`} />
                                </div>
                                <button className="add-btn" onClick={(e) => {
                                    const price = document.getElementById(`price-${p.id}`).value;
                                    const stock = document.getElementById(`stock-${p.id}`).value;
                                    handleAddToInventory(p, price, stock, e);
                                }}>
                                    + Adaugă în inventar
                                </button>
                                {/* <button className="delete-btn" onClick={(e) => handleDeleteProduct(p.id, e)}>
                                    <MdDelete />
                                </button> */}
                            </div>
                        )}
                    </div>
                ))}

                {!isEnd && (
                    <button className="load-more-btn" onClick={() => fetchProducts(false, searchTerm)}>
                        {loading ? 'Se încarcă...' : 'Încarcă mai multe'}
                    </button>
                )}
            </div>

            {/* MODAL SELECTIE */}
            {saleResults.length > 0 && (
                <div className="scanbarcodecontainer" onClick={() => setSaleResults([])}>
                    <div className="sale-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ margin: 0 }}>Selectează varianta corectă</h3>
                        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                            {saleResults.filter(r => r.inInventar).length} din {saleResults.length} variante în inventar
                        </p>
                        <div className="sale-results-list">
                            {saleResults.map((r) => (
                                <div
                                    key={r.id}
                                    className={`sale-result-item ${r.inInventar ? 'in-db' : 'not-in-db'}`}
                                    onClick={() => {
                                        if (!r.inInventar) return;
                                        setSaleResults([]);
                                        setSaleProduct(r);
                                        setSaleQuantity(1);
                                    }}
                                >
                                    <img src={r.cover_image || "/assets/image.png"} alt={r.title} />
                                    <div className="sale-result-info">
                                        <strong>{r.title}</strong>
                                        <span>{r.format} • {r.year} • {r.country}</span>
                                        <small>ID: {r.id}</small>
                                    </div>
                                    <div className="sale-result-badge">
                                        {r.inInventar
                                            ? <span className="badge in-stock">✓ În inventar</span>
                                            : <span className="badge not-in-stock">✗ Lipsă</span>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="cancel-sale-btn" onClick={() => setSaleResults([])}>Anulează</button>
                    </div>
                </div>
            )}

            {/* MODAL VANZARE */}
            {saleProduct && (
                <div className="scanbarcodecontainer" onClick={() => setSaleProduct(null)}>
                    <div className="sale-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="sale-modal-product">
                            {saleProduct.cover_image && (
                                <img src={saleProduct.cover_image} alt={saleProduct.title} />
                            )}
                            <div>
                                <strong>{saleProduct.title}</strong>
                                <span>{saleProduct.artist}</span>
                                <span>Stoc disponibil: <b>{saleProduct.stock}</b></span>
                                <span>Preț: <b>{saleProduct.price} RON</b></span>
                            </div>
                        </div>
                        <div className="sale-modal-quantity">
                            <label>Cantitate vândută</label>
                            <div className="quantity-controls">
                                <button onClick={() => setSaleQuantity(prev => Math.max(1, prev - 1))}>−</button>
                                <input
                                    type="number"
                                    value={saleQuantity}
                                    min={1}
                                    max={saleProduct.stock}
                                    onChange={(e) => setSaleQuantity(Number(e.target.value))}
                                />
                                <button onClick={() => setSaleQuantity(prev => Math.min(saleProduct.stock, prev + 1))}>+</button>
                            </div>
                            <span className="sale-total">Total: <b>{(saleProduct.price * saleQuantity).toFixed(2)} RON</b></span>
                        </div>
                        <div className="sale-modal-actions">
                            <button className="cancel-sale-btn" onClick={() => setSaleProduct(null)}>Anulează</button>
                            <button className="confirm-sale-btn" onClick={handleConfirmSale}>✓ Confirmă vânzarea</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClientPage;