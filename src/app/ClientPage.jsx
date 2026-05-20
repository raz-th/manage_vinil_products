'use client'
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import "./page.css"
import { auth, db } from '@/lib/firebase';
import { CiBarcode } from 'react-icons/ci';
import { IoAddCircleOutline } from 'react-icons/io5';
import { MdDelete } from 'react-icons/md';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { GrStatusGoodSmall } from 'react-icons/gr';
import { FaSearch } from 'react-icons/fa';
import { Pagination } from '@/components/Pagination';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 20;


const filterValues = [
    'all',
    'CD', 'Vinyl',
    'Minidisc',
    'Box Set', 'Cassette',
    'DVD', 'Blu-ray',
    'SACD', "Mistery box"
]

const ClientPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isEnd, setIsEnd] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [overAllInfo, setOverAllInfo] = useState({ total: 0, cd: 0, vinyl: 0 });
    const [scanMode, setScanMode] = useState("search"); // "search" | "sale"
    const [saleResults, setSaleResults] = useState([]);
    const [saleQuantity, setSaleQuantity] = useState(1);
    const [saleProduct, setSaleProduct] = useState(null);
    const [scanStatus, setScanStatus] = useState(null);
    const router = useRouter();
    const [signedIn, setSignedIn] = useState(false);
    const [formatFilter, setFormatFilter] = useState("all");
    const barcodeBuffer = useRef('');
    const barcodeTimeout = useRef(null);

    const [scrollY, setScrollY] = useState(0);

    const [searchRestored, setSearchRestored] = useState(false);

    const PAGE_SIZE_DISPLAY = 20;
    const [currentPage, setCurrentPage] = useState(1);

    const searchParams = useSearchParams();
    const pathname = usePathname();



    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => { console.log(overAllInfo) }, [overAllInfo])




    const CACHE_KEY = 'inventar_cache';

    const saveCache = (products, lastVisibleId, isEnd, total, cd, vinyl) => {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            products,
            lastVisibleId: lastVisibleId || null,
            isEnd,
            total,
            cd,
            vinyl
        }));
    };



    useEffect(() => {
        let isMounted = true;

        const checkUser = async (session) => {
            if (!session?.user) {
                if (isMounted) router.push('/login');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            if (!isMounted) return;

            if (error || !profile || !profile.is_admin) {
                await supabase.auth.signOut();
                router.push('/login');
                return;
            }

            setSignedIn(true);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (isMounted) checkUser(session);
            }
        );

        supabase.auth.getSession().then(({ data: { session } }) => {
            checkUser(session);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [router]);

    useEffect(() => {
        const handleKeyPress = (e) => {

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



    const isInitialized = useRef(false);

    useEffect(() => {
        const page = Number(searchParams.get('page')) || 1;
        const search = searchParams.get('search') || "";
        const format = searchParams.get('format') || "all";

        // Sincronizează state-urile cu URL-ul
        setSearchTerm(search);
        setFormatFilter(format);
        setCurrentPage(page);

        fetchProducts(page, search, format).then(() => {
            const savedScroll = Number(sessionStorage.getItem('inventar_scroll')) || 0;
            setTimeout(() => {
                window.scrollTo({ top: savedScroll, behavior: 'instant' });
                sessionStorage.removeItem('inventar_scroll');
            }, 100);
        });

    }, [searchParams]);

    const updateURL = (search, format, page) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (format && format !== 'all') params.set('format', format);
        if (page && page > 1) params.set('page', String(page));

        const newUrl = `${pathname}?${params.toString()}`;
        const currentUrl = window.location.pathname + window.location.search;

        if (newUrl === currentUrl) return;

        router.replace(newUrl, { scroll: false });
    };




    const fetchProducts = async (
        page = 1,
        search = "",
        format = "all"
    ) => {
        setLoading(true);

        try {
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            // QUERY PRODUSE AFISATE
            let query = supabase
                .from('products')
                .select('*')
                .order('artist_lowercase', { ascending: true });

            // SEARCH
            if (search.length >= 2) {

                const term = search.toLowerCase();

                const isNumeric = !isNaN(search);

                if (isNumeric) {

                    query = query.or(
                        `artist_lowercase.ilike.%${term}%,title_lowercase.ilike.%${term}%,id.eq.${search}`
                    );

                } else {

                    query = query.or(
                        `artist_lowercase.ilike.%${term}%,title_lowercase.ilike.%${term}%`
                    );

                }
            }

            // FILTER
            if (format !== 'all') {
                query = query.eq('format', format);
            }

            // PAGINATION
            query = query.range(from, to);

            const { data, error } = await query;

            if (error) throw error;

            // TOTAL TOATE PRODUSELE
            const { count: totalCount } = await supabase
                .from('products')
                .select('*', {
                    count: 'exact',
                    head: true
                });

            // TOTAL CD
            const { count: cdCount } = await supabase
                .from('products')
                .select('*', {
                    count: 'exact',
                    head: true
                })
                .eq('format', 'CD');

            // TOTAL VINYL
            const { count: vinylCount } = await supabase
                .from('products')
                .select('*', {
                    count: 'exact',
                    head: true
                })
                .eq('format', 'Vinyl');

            const mappedProducts = (data || []).map((p) => ({
                ...p,
                inInventar: true
            }));

            setProducts(mappedProducts);

            setOverAllInfo({
                total: totalCount || 0,
                cd: cdCount || 0,
                vinyl: vinylCount || 0
            });

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };



    const handleFilterChange = (format) => {
        const params = new URLSearchParams(searchParams.toString());
        if (format && format !== 'all') {
            params.set('format', format);
        } else {
            params.delete('format');
        }
        params.delete('page');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleUpdatePrice = async (id, newPrice, newStock, e) => {
        e.stopPropagation();
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    price: Number(newPrice),
                    stock: Number(newStock)
                })
                .eq('id', id);

            if (error) throw error;

            setProducts(prev => {
                const updated = prev.map(p =>
                    String(p.id) === String(id)
                        ? { ...p, price: Number(newPrice), stock: Number(newStock) }
                        : p
                );
                saveCache(updated, null, isEnd, overAllInfo.total, overAllInfo.cd, overAllInfo.vinyl);
                return updated;
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
                    const { data: dbProduct } = await supabase
                        .from('products')
                        .select('stock, price')
                        .eq('id', item.id)
                        .single();

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
                            format: item.formats?.[0]?.name || "",
                            artist: detail.artists?.[0]?.name || "Necunoscut",
                            country: detail.country || "Necunoscută",
                            cover_image: detail.images?.[0]?.uri || null,
                            year: detail.year,
                            inInventar: !!dbProduct,
                            stock: dbProduct?.stock ?? 0,
                            price: dbProduct?.price ?? 0,
                        };
                    } catch (err) {
                        return { ...item, inInventar: !!dbProduct };
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

    const handleDeleteProduct = async (id, e) => {
        e.stopPropagation();
        const product = products.find(p => String(p.id) === String(id));
        const confirmed = window.confirm(
            `Ești sigur că vrei să ștergi "${product?.title}" de ${product?.artist}?\n\nAceastă acțiune este ireversibilă!`
        );
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setProducts(prev => {
                const updated = prev.filter(p => String(p.id) !== String(id));
                const newTotal = overAllInfo.total - 1;
                setOverAllInfo(prev => ({ ...prev, total: newTotal }));
                saveCache(updated, null, isEnd, newTotal, overAllInfo.cd, overAllInfo.vinyl);
                return updated;
            });
        } catch (err) {
            alert("Eroare la ștergere: " + err.message);
        }
    };

    const handleAddToInventory = async (p, price, stock, e) => {
        e.stopPropagation();
        try {
            const { data: existing } = await supabase
                .from('products')
                .select('id')
                .eq('id', p.id)
                .single();

            if (existing) {
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
                stare_coperta: "",
                stare_disc: "",
                oferta_activa: false,
                oferta_procent: "",
                oferta_data_start: new Date().toISOString().split('T')[0],
                oferta_data_end: new Date().toISOString().split('T')[0],
            };

            const { error } = await supabase
                .from('products')
                .insert(newProduct);

            if (error) throw error;

            setProducts(prev => {
                const updated = prev.map(prod =>
                    prod.id === p.id ? { ...prod, ...newProduct, inInventar: true } : prod
                );
                const newTotal = overAllInfo.total + 1;
                setOverAllInfo(prev => ({ ...prev, total: newTotal }));
                saveCache(updated, null, isEnd, newTotal, overAllInfo.cd, overAllInfo.vinyl);
                return updated;
            });
            alert("Produs adăugat în inventar!");
        } catch (error) {
            alert("Eroare la adăugare: " + error.message);
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
                    const { data: dbProduct } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', item.id)
                        .single();

                    return {
                        id: item.id,
                        title: item.title,
                        country: item.country || "Necunoscută",
                        year: item.year,
                        format: item.formats?.[0]?.name || "",
                        cover_image: item.cover_image || null,
                        inInventar: !!dbProduct,
                        ...(dbProduct || {})
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

            // UPDATE SUPABASE
            const { error } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', saleProduct.id);

            if (error) throw error;

            // actualizare produse locale
            setProducts(prev => {
                const updated = prev.map(p =>
                    String(p.id) === String(saleProduct.id)
                        ? { ...p, stock: newStock }
                        : p
                );

                // update cache
                saveCache(
                    updated,
                    null,
                    isEnd,
                    overAllInfo.total,
                    overAllInfo.cd,
                    overAllInfo.vinyl
                );

                return updated;
            });

            // actualizare produs modal
            setSaleProduct(null);

            alert(`Vânzare înregistrată! Stoc rămas: ${newStock}`);

        } catch (err) {
            alert("Eroare: " + err.message);
        }
    };


    const handleProductClick = (id) => {
        sessionStorage.setItem('inventar_scroll', window.scrollY);
        router.push(`/produs/${id}`);
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
                    <GrStatusGoodSmall color='red' /> Mod vânzare activ — scanează produsul pentru a înregistra o vânzare
                </div>
            )}
            {scanMode === 'search' && (
                <div className="mode-indicator" style={{ background: '#e8f5e9', color: '#2e7d32', borderColor: '#c8e6c9' }}>
                    <GrStatusGoodSmall color='green' /> Mod căutare activ — scanează produsul pentru a-l găsi în inventar
                </div>
            )}

            <div className="head">
                <div>
                    <p>TOTAL PRODUSE</p>
                    <h1>{overAllInfo.total}</h1>
                </div>
                <div>
                    <p>CD-uri</p>
                    <h1>{overAllInfo.cd}</h1>
                </div>
                <div>
                    <p>VINILURI</p>
                    <h1>{overAllInfo.vinyl}</h1>
                </div>
            </div>

            <div className="search-wrapper">
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <h3>Listă inventar</h3>
                    <div className="format-filters">
                        {
                            filterValues.map((v, i) => (<button
                                className={`filter-btn ${formatFilter === v ? 'active' : ''}`}
                                onClick={() => handleFilterChange(v)}
                                key={i}
                            >
                                {v === 'all' ? 'Toate' : v}
                            </button>))
                        }
                    </div>
                </div>
                <div style={{
                    display: scrollY > 350 ? 'flex' : 'none',
                    flexDirection: 'column',
                    gap: '2rem',
                    position: 'fixed',
                    justifyContent: 'space-between',
                    top: 0,
                    backgroundColor: '#f8fafc',
                    left: 0,
                    right: 0,
                    padding: '1rem',
                    borderBottom: '#fff 1px solid'
                }} className='scrollInv'>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h1>Gestionare inventar</h1>
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
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                            <h3>Listă inventar</h3>
                            <div className="format-filters">
                                {
                                    filterValues.map((v, i) => (<button
                                        className={`filter-btn ${formatFilter === v ? 'active' : ''}`}
                                        onClick={() => handleFilterChange(v)}
                                        key={i}
                                    >
                                        {v === 'all' ? 'Toate' : v}
                                    </button>))
                                }
                            </div>
                        </div>
                        <div className='searchUsege'>
                            <input
                                type="text"
                                placeholder="Caută produs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                            {/* <button type='submit' onClick={() => handleSearch()}><FaSearch /></button> */}
                        </div>
                    </div>

                </div>

                <div className='searchUsege'>
                    <input
                        type="text"
                        placeholder="Caută produs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {/* <button type='submit' onClick={() => handleSearch()}><FaSearch /></button> */}
                </div>
            </div>

            <div className="products-list">
                {products.map((p) => (
                    <div
                        key={p.id}
                        className={`product-card ${!p.inInventar ? 'not-in-inventory' : ''}`}
                        onClick={() => handleProductClick(p.id)}
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
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(overAllInfo.total / PAGE_SIZE)}
                onPageChange={(page) => {
                    const params = new URLSearchParams(searchParams.toString());
                    if (page > 1) {
                        params.set('page', String(page));
                    } else {
                        params.delete('page');
                    }
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            />

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