'use client';
import { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import './produs.css';
import { COUNTRIES_LIST, formats, GENRES_LIST, STYLES_LIST } from '@/components/vars';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import CreatableSelect from 'react-select/creatable';

const maxDots = 5;

const genreOptions = GENRES_LIST.map(g => ({ value: g, label: g }));
const styleOptions = STYLES_LIST.map(s => ({ value: s, label: s }));
const countriesOptions = COUNTRIES_LIST.map(c => ({ value: c, label: c }));
const formatOptions = formats.map(f => ({ value: f, label: f }));

const optiuni_stareCoperta = {
    "cd": { label: "Stare carcasă", stare: ["Stare buna", "Stare foarte buna"] },
    "vinyl": { label: "Stare copertă", stare: ["G", "VG", "VG+", "EX", "NM"] },
    "default": { label: "Stare carcasă", stare: ["Stare buna", "Stare foarte buna"] },
};

const optiuni_stareDisc = {
    "cd": { label: "Stare disc", stare: ["Stare buna", "Stare foarte buna"] },
    "vinyl": { label: "Stare vinil", stare: ["VG", "VG+", "EX", "NM"] },
    "default": { label: "Stare disc", stare: ["Stare buna", "Stare foarte buna"] },
};

export default function ProdusManagement({ id }) {
    const router = useRouter();
    const [produs, setProdus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Image system state
    const [otherDatas, setOtherDatas] = useState([]);
    const [selectedImage, setSelectedImage] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [hasOverflow, setHasOverflow] = useState(false);
    const scrollRef = useRef(null);
    const discogsInputRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '',
        artist: '',
        year: '',
        country: '',
        format: '',
        descriere: '',
        price: 0,
        stock: 0,
        label: '',
        stare: { coperta: '', disc: '' },
        oferta: { activa: false, procent: '', dataStart: '', dataEnd: '' },
        genres: [],
        styles: [],
        images: [],
        barcode: '',
        discogsId: '',
        visible: true
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: val } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };

    useEffect(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const formattedToday = `${yyyy}-${mm}-${dd}`;

        const fetchProdus = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error || !data) { setLoading(false); return; }

                setProdus(data);
                setFormData({
                    title: data.title ?? '',
                    artist: data.artist ?? '',
                    year: data.year ?? '',
                    country: data.country ?? '',
                    format: data.format ?? '',
                    descriere: data.description ?? '',
                    price: data.price ?? 0,
                    stock: data.stock ?? 0,
                    label: data.label ?? '',
                    stare: { coperta: data.stare_coperta ?? '', disc: data.stare_disc ?? '' },
                    oferta: {
                        activa: data.oferta_activa || false,
                        procent: data.oferta_procent || '',
                        dataStart: data.oferta_data_start || formattedToday,
                        dataEnd: data.oferta_data_end || formattedToday,
                    },
                    genres: data.genres ?? [],
                    styles: data.styles ?? [],
                    images: data.images ?? (data.cover_image ? [data.cover_image] : []),
                    barcode: data.barcode ?? "",
                    discogsId: data.discogsId ?? '',
                    visible: data.visible
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProdus();
    }, [id]);

    // Overflow check for thumbnail strip
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const checkOverflow = () => setHasOverflow(el.scrollWidth > el.clientWidth);
        const timer = setTimeout(checkOverflow, 0);
        window.addEventListener('resize', checkOverflow);
        return () => { clearTimeout(timer); window.removeEventListener('resize', checkOverflow); };
    }, [formData.images]);

    const pretRedus = formData.oferta.procent
        ? (formData.price - (formData.price * formData.oferta.procent) / 100).toFixed(2)
        : null;

    // Discogs image fetch — same logic as add page
    // Discogs image fetch — cu validare de erori
    const handleFetchVariants = async (query) => {
        if (!query) return;
        try {
            // Try barcode first, fall back to title search
            const isBarcode = /^\d+$/.test(query);
            const searchUrl = isBarcode
                ? `https://api.discogs.com/database/search?barcode=${query}`
                : `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release`;

            const res = await fetch(searchUrl, {
                headers: {
                    Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
                    "User-Agent": "Vinil1Admin/1.0",
                }
            });
            
            // 1. Prevenim crash-ul dacă căutarea Discogs dă eroare (ex: 429 Rate Limit)
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Eroare Discogs (${res.status}): ${errText || 'Răspuns gol'}`);
            }

            const data = await res.json();
            const results = data.results?.filter((a) => a.country === formData.country && a.format[0] === formData.format) || [];
            
            if (!results.length) { 
                alert('Nu s-au găsit rezultate pe Discogs! Verifică țara setată sau încearcă alt termen.'); 
                return; 
            }

            // 2. Securizăm fetch-ul către ruta locală de API
            const allReleasesRaw = await Promise.all(
                results.slice(0, 20).map(async (v) => {
                    try {
                        const r = await fetch(`/api/release/${v.id}`);
                        if (!r.ok) return null; // Ignorăm release-urile care dau eroare
                        
                        const textBody = await r.text();
                        if (!textBody) return null; // Previne "Unexpected end of JSON input"
                        
                        return JSON.parse(textBody);
                    } catch (e) {
                        return null;
                    }
                })
            );

            // Filtrăm posibilele erori (null) apărute mai sus
            const allReleases = allReleasesRaw.filter(Boolean);

            if (!allReleases.length) {
                alert('Nu s-au putut extrage detaliile release-urilor. Verifică log-urile din server.');
                return;
            }

            const temp_imgs = allReleases.map((d) => ({
                images: d.images?.map((img) => `/api/image-proxy?url=${encodeURIComponent(img.uri)}`) || [],
                id: d.id,
                country: d.country
            }));

            setOtherDatas(temp_imgs);
            setFormData(prev => ({
                ...prev,
                images: temp_imgs[0]?.images || [],
                discogsId: temp_imgs[0]?.id || prev.discogsId
            }));
            setSelectedImage(0);
        } catch (err) {
            console.error(err);
            alert('Eroare la preluarea datelor: ' + err.message);
        }
    };

    // Touch swipe handlers
    const handleTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
    const handleTouchMove = (e) => { setTouchEnd(e.targetTouches[0].clientX); };
    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50) setSelectedImage(prev => prev < formData.images.length - 1 ? prev + 1 : prev);
        else if (distance < -50) setSelectedImage(prev => prev > 0 ? prev - 1 : prev);
    };

    // Dots pagination
    const total = formData.images?.length || 0;
    let start = 0;
    if (total > maxDots) {
        if (selectedImage <= 2) start = 0;
        else if (selectedImage >= total - 3) start = total - maxDots;
        else start = selectedImage - 2;
    }
    const visibleDots = formData.images?.slice(start, start + maxDots) || [];

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({
                    title: formData.title,
                    title_lowercase: formData.title.toLowerCase(),
                    artist: formData.artist,
                    artist_lowercase: formData.artist.toLowerCase(),
                    year: Number(formData.year),
                    country: formData.country,
                    format: formData.format,
                    price: Number(formData.price),
                    stock: Number(formData.stock),
                    description: formData.descriere,
                    stare_coperta: formData.stare.coperta,
                    stare_disc: formData.stare.disc,
                    oferta_activa: formData.oferta.activa,
                    oferta_procent: Number(formData.oferta.procent) || 0,
                    oferta_data_start: formData.oferta.dataStart || '',
                    oferta_data_end: formData.oferta.dataEnd || '',
                    label: formData.label,
                    genres: formData.genres,
                    styles: formData.styles,
                    images: formData.images,
                    cover_image: formData.images[0]
                        ? decodeURIComponent(formData.images[0].replace('/api/image-proxy?url=', ''))
                        : produs?.cover_image || '',
                    thumb: formData.images[0] || produs?.thumb || '',
                    barcode: formData.barcode || '',
                    date_modified: new Date().toISOString(),
                    visible: formData.visible
                })
                .eq('id', id);

            if (error) throw error;
            alert('Salvat cu succes!');
        } catch (err) {
            alert('Eroare: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const confirmed = window.confirm(
            `Ești sigur că vrei să ștergi complet "${produs.title}" de ${produs.artist}?\n\nAceastă acțiune este ireversibilă!`
        );
        if (!confirmed) return;
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            router.push('/');
        } catch (err) {
            alert('Eroare la ștergere: ' + err.message);
        }
    };

    if (loading) return <div className="pm-page"><div className="pm-inner">Se încarcă...</div></div>;
    if (!produs) return <div className="pm-page"><div className="pm-inner"><h1>Produs negăsit</h1></div></div>;

    const formatKey = formData.format?.toLowerCase() || 'default';

    return (
        <div className="pm-page">
            <div className="pm-inner">

                <button className="pm-back" onClick={() => router.back()}>← Înapoi</button>

                <div className="pm-header">
                    <img src={formData.images?.[0] || produs.cover_image || '/assets/image.png'} alt={produs.title} className="pm-cover" />
                    <div className="pm-header-info">
                        <span className="pm-format">{produs.format === "Vinyl" ? "Vinil" : produs.format}</span>
                        <h1>{produs.title}</h1>
                        <p className="pm-artist">{produs.artist}</p>
                        <div className="pm-meta">
                            {produs.year && <span>{produs.year}</span>}
                            {produs.country && <span>· {produs.country}</span>}
                            {produs.label && <span>· {produs.label}</span>}
                        </div>
                        <div className="pm-genres">
                            {produs.genres?.map(g => <span key={g} className="pm-tag">{g}</span>)}
                        </div>
                        <div className="pm-genres">
                            {produs.styles?.map(s => <span key={s} className="pm-tag pm-tag-style">{s}</span>)}
                        </div>
                        <small className="pm-id">ID: {produs.id}</small>
                        <small className="pm-id">Data adaugarii: {new Date(produs.date_added).toLocaleDateString('ro-RO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</small>
                        {produs.date_modified && (<small className="pm-id">Data modificării: {new Date(produs.date_modified).toLocaleDateString('ro-RO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</small>)}
                    </div>
                </div>



                <div className="pm-sections">
                    <section className="pm-section">
                        <div className="p-input-group checkbox-group">
                            <label>Vizibil pe site</label>
                            <div className='switch_container'>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        name='visible'
                                        checked={!!formData.visible}
                                        onChange={handleChange}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>
                    </section>
                    <section className="pm-section">
                        <h2 className="section-title">Detalii Produs</h2>

                        <div className="p-input-group col-span-2">
                            <label>Titlu</label>
                            <input name="title" value={formData.title} onChange={handleChange} placeholder="Ex: Dark Side of the Moon" />
                        </div>

                        <div className="grid-2-cols">
                            <div className="p-input-group">
                                <label>Artist</label>
                                <input name="artist" value={formData.artist} onChange={handleChange} placeholder="Ex: Pink Floyd" />
                            </div>
                            <div className="p-input-group">
                                <label>An Lansare</label>
                                <input name="year" type="number" value={formData.year} onChange={handleChange} placeholder="Ex: 1973" />
                            </div>
                            <div className="p-input-group">
                                <label>Țara</label>
                                <Select
                                    options={countriesOptions}
                                    placeholder="Selectează țara..."
                                    value={formData.country ? { value: formData.country, label: formData.country } : null}
                                    onChange={(selected) => setFormData(prev => ({ ...prev, country: selected?.value || '' }))}
                                    classNamePrefix="music-select"
                                />
                            </div>
                            <div className="p-input-group">
                                <label>Format</label>
                                <Select
                                    options={formatOptions}
                                    placeholder="Selectează format..."
                                    value={formData.format ? { value: formData.format, label: formData.format } : null}
                                    onChange={(selected) => setFormData(prev => ({ ...prev, format: selected?.value || '' }))}
                                    classNamePrefix="music-select"
                                />
                            </div>
                        </div>

                        <div className="p-input-group">
                            <label>Casa de discuri</label>
                            <input name="label" value={formData.label} onChange={handleChange} placeholder="Ex: Harvest" />
                        </div>

                        <div className="p-input-group">
                            <label>Genuri muzicale</label>
                            <Select
                                isMulti
                                options={genreOptions}
                                placeholder="Selectează genuri..."
                                value={formData.genres.map(g => ({ value: g, label: g }))}
                                onChange={(selected) => setFormData(prev => ({ ...prev, genres: selected ? selected.map(s => s.value) : [] }))}
                                classNamePrefix="music-select"
                            />
                        </div>

                        <div className="p-input-group">
                            <label>Stiluri</label>
                            <CreatableSelect
                                instanceId="styles-select"
                                inputId="styles-select"
                                isMulti
                                options={styleOptions}
                                placeholder="Selectează stiluri..."
                                value={styleOptions
                                    .filter(option => formData.styles.includes(option.value))
                                    .concat(
                                        formData.styles
                                            .filter(v => !styleOptions.some(o => o.value === v))
                                            .map(v => ({ value: v, label: v }))
                                    )
                                }
                                onChange={(selected) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        styles: selected.map(v => v.value)
                                    }));
                                }}
                                classNamePrefix="music-select"
                                formatCreateLabel={(inputValue) => `Adaugă "${inputValue}"`}
                            />
                        </div>

                        <div className="p-input-group col-span-2">
                            <label>Descriere</label>
                            <textarea name="descriere" value={formData.descriere} onChange={handleChange} placeholder="Descriere..." style={{ height: "10rem" }} />
                        </div>

                        <div className="grid-2-cols">
                            <div className="p-input-group">
                                <label>{optiuni_stareCoperta[formatKey]?.label ?? optiuni_stareCoperta["default"].label}</label>
                                <select name="stare.coperta" value={formData.stare.coperta} onChange={handleChange}>
                                    <option value="">Selectează gradația</option>
                                    {(optiuni_stareCoperta[formatKey] ?? optiuni_stareCoperta["default"]).stare.map((v, i) => (
                                        <option key={i} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="p-input-group">
                                <label>{optiuni_stareDisc[formatKey]?.label ?? optiuni_stareDisc["default"].label}</label>
                                <select name="stare.disc" value={formData.stare.disc} onChange={handleChange}>
                                    <option value="">Selectează gradația</option>
                                    {(optiuni_stareDisc[formatKey] ?? optiuni_stareDisc["default"]).stare.map((v, i) => (
                                        <option key={i} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* ── IMAGE SECTION ── same structure as add page ── */}
                        <div className="p-input-group col-span-2">
                            <label>Imagini</label>
                            <div className="input-with-button">
                                <input
                                    ref={discogsInputRef}
                                    placeholder="Barcode, release ID sau nume artist/album..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleFetchVariants(discogsInputRef.current?.value?.trim());
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleFetchVariants(discogsInputRef.current?.value?.trim())}
                                    className="btn-icon btn-black"
                                >
                                    Caută
                                </button>
                            </div>
                        </div>
                        <section className='imgSection col-span-2'>
                            <div style={{ position: 'relative' }}>
                                <img
                                    className='mainImage'
                                    src={formData.images?.[selectedImage] || "/noimg.png"}
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
                                                    className={`dot ${selectedImage === realIndex ? "selected" : ""} ${i === 0 || i === maxDots - 1 ? "edge" : ""}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className='moreImagesContainer'>
                                {hasOverflow && (
                                    <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -100, behavior: "smooth" })} className="moreImagesBtn">
                                        <FaChevronLeft />
                                    </button>
                                )}
                                <div
                                    className={`moreImages ${hasOverflow ? "" : "nu"}`}
                                    ref={scrollRef}
                                    style={{ width: !hasOverflow ? "100%" : '90%' }}
                                >
                                    {formData.images?.map((v, i) => (
                                        <img
                                            key={i}
                                            src={v || "/assets/image.png"}
                                            onClick={() => setSelectedImage(i)}
                                            className={selectedImage === i ? "selected" : ""}
                                        />
                                    ))}
                                </div>
                                {hasOverflow && (
                                    <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 100, behavior: "smooth" })} className="moreImagesBtn">
                                        <FaChevronRight />
                                    </button>
                                )}
                            </div>
                        </section>
                        <div className='buttonsForVariante col-span-2'>
                            {otherDatas.map((v, i) => (
                                <button
                                    type="button"
                                    key={i}
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            images: otherDatas[i].images,
                                            discogsId: otherDatas[i].id
                                        }));
                                        setSelectedImage(0);
                                    }}
                                    style={String(formData.id) === String(otherDatas[i].id) ? { backgroundColor: 'green', color: 'white' } : {}}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>

                    </section>

                    <section className="pm-section">
                        <h2>Stoc & Preț</h2>
                        <div className="pm-grid">
                            <div className="pm-field">
                                <label>Stoc</label>
                                <input type="number" name="stock" value={formData.stock} onChange={handleChange} />
                            </div>
                            <div className="pm-field">
                                <label>Preț (RON)</label>
                                <input type="number" name="price" value={formData.price} onChange={handleChange} />
                            </div>
                        </div>
                    </section>

                    <section className="pm-section">
                        <div className="pm-section-header">
                            <h2>Ofertă</h2>
                            <label className="pm-toggle">
                                <input
                                    type="checkbox"
                                    name="oferta.activa"
                                    checked={formData.oferta.activa}
                                    onChange={handleChange}
                                />
                                <span>{formData.oferta.activa ? 'Activă' : 'Inactivă'}</span>
                            </label>
                        </div>

                        {formData.oferta.activa && (
                            <div className="pm-grid">
                                <div className="pm-field">
                                    <label>Reducere (%)</label>
                                    <input type="number" name="oferta.procent" min={1} max={99} value={formData.oferta.procent} onChange={handleChange} placeholder="ex: 25" />
                                </div>
                                <div className="pm-field">
                                    <label>Preț după reducere</label>
                                    <input type="text" value={pretRedus ? `${pretRedus} RON` : '—'} disabled className="pm-input-disabled" />
                                </div>
                                <div className="pm-field">
                                    <label>Data start</label>
                                    <input type="date" name="oferta.dataStart" value={formData.oferta.dataStart} onChange={handleChange} />
                                </div>
                                <div className="pm-field">
                                    <label>Data sfârșit</label>
                                    <input type="date" name="oferta.dataEnd" value={formData.oferta.dataEnd} onChange={handleChange} />
                                </div>
                            </div>
                        )}

                        {formData.oferta.activa && formData.oferta.procent && (
                            <div className="pm-oferta-preview">
                                <span className="pm-pret-vechi">{formData.price} RON</span>
                                <span className="pm-pret-nou">{pretRedus} RON</span>
                                <span className="pm-badge-reducere">-{formData.oferta.procent}%</span>
                                {formData.oferta.dataStart && formData.oferta.dataEnd && (
                                    <span className="pm-perioada">{formData.oferta.dataStart} → {formData.oferta.dataEnd}</span>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                <div className="pm-actions">
                    <button className="pm-save" onClick={handleSave} disabled={saving}>
                        {saving ? 'Se salvează...' : 'Salvează modificările'}
                    </button>
                    <button className="pm-delete" onClick={handleDelete}>
                        🗑 Șterge produsul
                    </button>
                </div>

            </div>
        </div>
    );
}