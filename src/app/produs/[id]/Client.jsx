'use client';
import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import './produs.css';

export default function ProdusManagement({ id }) {
    const router = useRouter();
    const [produs, setProdus] = useState(null);
    const [loading, setLoading] = useState(true);

    const [price, setPrice] = useState(0);
    const [stock, setStock] = useState(0);
    const [saving, setSaving] = useState(false);

    const [oferta, setOferta] = useState({
        activa: false,
        procent: '',
        dataStart: '',
        dataEnd: '',
    });
    useEffect(() => console.log(oferta), [oferta])


    useEffect(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();

        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;

        const formattedToday = yyyy + '-' + mm + '-' + dd;

        const fetchProodus = async () => {
            try {
                const snap = await getDoc(doc(db, 'releases', String(id)));
                if (!snap.exists()) {
                    setLoading(false);
                    return;
                }
                const data = { id: snap.id, ...snap.data() };
                setProdus(data);
                setPrice(data.price ?? 0);
                setStock(data.stock ?? 0);
                setOferta({
                    activa: data.oferta?.activa || false,
                    procent: data.oferta?.procent || '',
                    dataStart: data.oferta?.dataStart || formattedToday,
                    dataEnd: data.oferta?.dataEnd || formattedToday,
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProodus();
    }, [id]);

    const pretRedus = oferta.procent
        ? (price - (price * oferta.procent) / 100).toFixed(2)
        : null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'releases', String(id)), {
                price: Number(price),
                stock: Number(stock),
                oferta: {
                    activa: oferta.activa,
                    procent: Number(oferta.procent) || 0,
                    dataStart: oferta.dataStart || '',
                    dataEnd: oferta.dataEnd || '',
                }
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
                    <img
                        src={produs.cover_image || '/assets/image.png'}
                        alt={produs.title}
                        className="pm-cover"
                    />
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
                            {/* {produs.styles?.map(s => <span key={s} className="pm-tag pm-tag-style">{s}</span>)} */}
                        </div>
                        <div className="pm-genres">
                            {/* {produs.genres?.map(g => <span key={g} className="pm-tag">{g}</span>)} */}
                            {produs.styles?.map(s => <span key={s} className="pm-tag pm-tag-style">{s}</span>)}
                        </div>
                        <small className="pm-id">ID: {produs.id}</small>
                    </div>
                </div>

                <div className="pm-sections">
                    <section className="pm-section">
                        <h2>Stoc & Preț</h2>
                        <div className="pm-grid">
                            <div className="pm-field">
                                <label>Stoc</label>
                                <input type="number" value={stock} onChange={e => setStock(e.target.value)} />
                            </div>
                            <div className="pm-field">
                                <label>Preț (RON)</label>
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)} />
                            </div>
                        </div>
                    </section>

                    <section className="pm-section">
                        <div className="pm-section-header">
                            <h2>Ofertă</h2>
                            <label className="pm-toggle">
                                <input
                                    type="checkbox"
                                    checked={oferta.activa}
                                    onChange={e => setOferta(prev => ({ ...prev, activa: e.target.checked }))}
                                />
                                <span>{oferta.activa ? 'Activă' : 'Inactivă'}</span>
                            </label>
                        </div>

                        {oferta.activa && (
                            <div className="pm-grid">
                                <div className="pm-field">
                                    <label>Reducere (%)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={99}
                                        value={oferta.procent}
                                        onChange={e => setOferta(prev => ({ ...prev, procent: e.target.value }))}
                                        placeholder="ex: 25"
                                    />
                                </div>
                                <div className="pm-field">
                                    <label>Preț după reducere</label>
                                    <input
                                        type="text"
                                        value={pretRedus ? `${pretRedus} RON` : '—'}
                                        disabled
                                        className="pm-input-disabled"
                                    />
                                </div>
                                <div className="pm-field">
                                    <label>Data start</label>
                                    <input
                                        type="date"

                                        value={oferta.dataStart}
                                        onChange={e => setOferta(prev => ({ ...prev, dataStart: e.target.value }))}
                                    />
                                </div>
                                <div className="pm-field">
                                    <label>Data sfârșit</label>
                                    <input
                                        type="date"
                                        value={oferta.dataEnd}
                                        onChange={e => setOferta(prev => ({ ...prev, dataEnd: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {oferta.activa && oferta.procent && (
                            <div className="pm-oferta-preview">
                                <span className="pm-pret-vechi">{price} RON</span>
                                <span className="pm-pret-nou">{pretRedus} RON</span>
                                <span className="pm-badge-reducere">-{oferta.procent}%</span>
                                {oferta.dataStart && oferta.dataEnd && (
                                    <span className="pm-perioada">
                                        {oferta.dataStart} → {oferta.dataEnd}
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
                    {/* <button className="pm-delete" onClick={handleDelete}>
                        🗑 Șterge produsul
                    </button> */}
                </div>

            </div>
        </div>
    );
}