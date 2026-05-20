'use client';
import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import './produs.css';
import { COUNTRIES_LIST } from '@/components/vars';

const formats = [
    'CD', 'Vinyl',
    'Minidisc',
    'Box Set', 'Cassette',
    'DVD', 'Blu-ray',
    'SACD'
]

const optiuni_stareCoperta = {
    "cd": {
        label: "Stare carcasă",
        stare: [
            "Stare buna",
            "Stare foarte buna",
        ]
    },
    "vinyl": {
        label: "Stare copertă",
        stare: [
            "G",
            "VG",
            "VG+",
            "EX",
            "NM"
        ]
    },
    "default": {
        label: "Stare carcasă",
        stare: [
            "Stare buna",
            "Stare foarte buna",
        ]
    },
}

const optiuni_stareDisc = {
    "cd": {
        label: "Stare disc",
        stare: [
            "Stare buna",
            "Stare foarte buna",
        ]
    },
    "vinyl": {
        label: "Stare vinil",
        stare: [
            "VG",
            "VG+",
            "EX",
            "NM"
        ]
    },
    "default": {
        label: "Stare disc",
        stare: [
            "Stare buna",
            "Stare foarte buna",
        ]
    },
}

export default function ProdusManagement({ id }) {
    const router = useRouter();
    const [produs, setProdus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [countries, setCountries] = useState([]);

    const [formData, setFormData] = useState({
        title: '',
        artist: '',
        year: '',
        country: '',
        format: '',
        descriere: '',
        price: 0,
        stock: 0,
        stare: {
            coperta: '',
            disc: '',
        },
        oferta: {
            activa: false,
            procent: '',
            dataStart: '',
            dataEnd: '',
        },
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: { ...prev[parent], [child]: val }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };

    useEffect(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = String(today.getMonth() + 1).padStart(2, '0');
        let dd = String(today.getDate()).padStart(2, '0');
        const formattedToday = `${yyyy}-${mm}-${dd}`;

        const fetchProdus = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error || !data) {
                    setLoading(false);
                    return;
                }

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
                    stare: {
                        coperta: data.stare_coperta ?? '',
                        disc: data.stare_disc ?? '',
                    },
                    oferta: {
                        activa: data.oferta_activa || false,
                        procent: data.oferta_procent || '',
                        dataStart: data.oferta_data_start || formattedToday,
                        dataEnd: data.oferta_data_end || formattedToday,
                    },
                });

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProdus();
    }, [id]);

    const pretRedus = formData.oferta.procent
        ? (formData.price - (formData.price * formData.oferta.procent) / 100).toFixed(2)
        : null;

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

            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;

            router.push('/');

        } catch (err) {
            alert('Eroare la ștergere: ' + err.message);
        }
    };

    if (loading) return <div className="pm-page"><div className="pm-inner">Se încarcă...</div></div>;
    if (!produs) return <div className="pm-page"><div className="pm-inner"><h1>Produs negăsit</h1></div></div>;

    return (
        <div className="pm-page">
            <div className="pm-inner">

                <button className="pm-back" onClick={() => router.back()}>← Înapoi</button>

                <div className="pm-header">
                    <img src={produs.cover_image || '/assets/image.png'} alt={produs.title} className="pm-cover" />
                    <div className="pm-header-info">
                        <span className="pm-format">{produs.format} · {produs.format_desc}</span>
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
                    </div>
                </div>

                <div className="pm-sections">
                    <section className="pm-section">
                        <h2 className="section-title">Detalii Produs</h2>
                        <div className="input-group col-span-2">
                            <label>Titlu</label>
                            <input
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Ex: Dark Side of the Moon"
                            />
                        </div>
                        <div className="grid-2-cols">
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

                                <input
                                    type="text"
                                    name="country"
                                    list="countries-list"
                                    placeholder="Selectează sau scrie țara"
                                    value={formData.country}
                                    onChange={(e) => {
                                        handleChange(e);
                   
                                    }}
                                />

                                <datalist id="countries-list">
                                    {COUNTRIES_LIST.map((v, i) => (
                                        <option
                                            key={i}
                                            value={v}
                                        />
                                    ))}
                                </datalist>
                            </div>

                            <div className="input-group">
                                <label>Format</label>
                                <select name="format" value={formData.format} onChange={handleChange}>
                                    <option value="">Selectează format</option>
                                    {
                                        formats.map((v, i) => (<option key={i} value={v}>{v}</option>))
                                    }
                                </select>
                            </div>
                        </div>
                        <div className="input-group col-span-2">
                            <label>Descriere</label>
                            <textarea
                                name="descriere"
                                value={formData.descriere}
                                onChange={handleChange}
                                placeholder="Descriere..."
                                style={{ height: "10rem" }}
                            />
                        </div>
                        <div className='grid-2-cols'>
                            <div className="input-group ">
                                <label>{optiuni_stareCoperta[produs.format.toLowerCase()]?.label ?? optiuni_stareCoperta["default"].label}</label>
                                <select name="stare.coperta" value={formData.stare.coperta} onChange={handleChange}>
                                    <option value="">Selectează gradația</option>
                                    {(optiuni_stareCoperta[produs.format.toLowerCase()] ?? optiuni_stareCoperta["default"]).stare.map((v, i) => <option key={i} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>{optiuni_stareDisc[produs.format.toLowerCase()]?.label ?? optiuni_stareDisc["default"].label}</label>
                                <select name="stare.disc" value={formData.stare.disc} onChange={handleChange}>
                                    <option value="">Selectează gradația</option>
                                    {(optiuni_stareDisc[produs.format.toLowerCase()] ?? optiuni_stareDisc["default"]).stare.map((v, i) => <option key={i} value={v}>{v}</option>)}
                                </select>
                            </div>
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
                                    <input
                                        type="number"
                                        name="oferta.procent"
                                        min={1} max={99}
                                        value={formData.oferta.procent}
                                        onChange={handleChange}
                                        placeholder="ex: 25"
                                    />
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
                                    <span className="pm-perioada">
                                        {formData.oferta.dataStart} → {formData.oferta.dataEnd}
                                    </span>
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




