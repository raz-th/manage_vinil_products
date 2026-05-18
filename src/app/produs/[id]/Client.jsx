'use client';
import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import './produs.css';

// const optiuni_stareCoperta = [
//     "VG",
//     "VG+",
//     "NM"
// ]

// const optiuni_stareDisc = [
//     "Stare buna",
//     "Stare foarte buna",
// ]

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
            "VG",
            "VG+",
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

    const [formData, setFormData] = useState({
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
                const snap = await getDoc(doc(db, 'releases', String(id)));
                if (!snap.exists()) { setLoading(false); return; }
                const data = { id: snap.id, ...snap.data() };
                setProdus(data);
                setFormData({
                    descriere: data.description ?? '',
                    price: data.price ?? 0,
                    stock: data.stock ?? 0,
                    stare: {
                        coperta: data.stare?.coperta ?? '',
                        disc: data.stare?.disc ?? '',
                    },
                    oferta: {
                        activa: data.oferta?.activa || false,
                        procent: data.oferta?.procent || '',
                        dataStart: data.oferta?.dataStart || formattedToday,
                        dataEnd: data.oferta?.dataEnd || formattedToday,
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
            await updateDoc(doc(db, 'releases', String(id)), {
                price: Number(formData.price),
                stock: Number(formData.stock),
                description: formData.descriere,
                stare: {
                    coperta: formData.stare.coperta,
                    disc: formData.stare.disc,
                },
                oferta: {
                    activa: formData.oferta.activa,
                    procent: Number(formData.oferta.procent) || 0,
                    dataStart: formData.oferta.dataStart || '',
                    dataEnd: formData.oferta.dataEnd || '',
                },
            });
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
            await deleteDoc(doc(db, 'releases', String(id)));
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
                </div>

            </div>
        </div>
    );
}




{/* <button className="pm-delete" onClick={handleDelete}>
                        🗑 Șterge produsul
                    </button> */}