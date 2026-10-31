'use client';
import { useState, useRef } from "react";
import { LucidePackage, LucideSave, LucideTrash2, LucideBarcode, LucidePlus } from "lucide-react";
import { supabase } from "@/lib/supabase"; // Updated import
import "./createMisteryBox.css"

const INITIAL_FORM = {
    title: "",
    price: "",
    description: "",
    quantity: 1,
};

export default function CreateMisteryBox() {
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [scannedProducts, setScannedProducts] = useState([]);
    const [scanInput, setScanInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const scanInputRef = useRef(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleScan = async (barcode) => {
        if (!barcode.trim() || barcode.trim().length < 3) return;

        const existing = scannedProducts.find(p => p.scannedId === barcode.trim());
        if (existing) {
            setScannedProducts(prev =>
                prev.map(p => p.scannedId === barcode.trim()
                    ? { ...p, qty: p.stock !== null ? Math.min(p.qty + 1, p.stock) : p.qty + 1 }
                    : p
                )
            );
            setScanInput("");
            scanInputRef.current?.focus();
            return;
        }

        try {
            // Discogs lookup
            const res = await fetch(
                `https://api.discogs.com/database/search?barcode=${barcode.trim()}`,
                {
                    headers: {
                        Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
                        "User-Agent": "MyApp/1.0",
                    }
                }
            );
            const data = await res.json();
            const result = data.results?.[0];
            const discogsId = result?.id ?? null;

            let stock = null;
            let dbId = null;

            if (discogsId) {
                // Supabase SELECT query
                const { data: snap, error } = await supabase
                    .from("releases")
                    .select("id, stock")
                    .eq("discogsId", discogsId)
                    .limit(1);

                if (error) {
                    console.error("Supabase fetch error:", error);
                } else if (snap && snap.length > 0) {
                    dbId = snap[0].id;
                    stock = snap[0].stock ?? null;
                }
            }

            setScannedProducts(prev => [...prev, {
                scannedId: barcode.trim(),
                discogsId,
                dbId,
                stock,
                title: result?.title ?? "Produs necunoscut",
                imageUrl: result?.cover_image ?? null,
                qty: 1,
            }]);

        } catch (err) {
            console.error("Error:", err);
            setScannedProducts(prev => [...prev, {
                scannedId: barcode.trim(),
                discogsId: null,
                dbId: null,
                stock: null,
                title: "Produs necunoscut",
                imageUrl: null,
                qty: 1,
            }]);
        }

        setScanInput("");
        scanInputRef.current?.focus();
    };

    const removeProduct = (scannedId) => {
        setScannedProducts(prev => prev.filter(p => p.scannedId !== scannedId));
    };

    const updateQty = (scannedId, delta) => {
        setScannedProducts(prev =>
            prev.map(p => {
                if (p.scannedId !== scannedId) return p;
                const newQty = p.qty + delta;
                if (newQty < 1) return p;
                if (p.stock !== null && newQty > p.stock) return p;
                return { ...p, qty: newQty };
            })
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            setMessage({ text: "Titlul este obligatoriu.", type: "error" });
            return;
        }
        if (scannedProducts.length === 0) {
            setMessage({ text: "Adaugă cel puțin un produs în box.", type: "error" });
            return;
        }

        setLoading(true);
        try {
            // Supabase INSERT query
            const { error } = await supabase
                .from("mistery_boxes")
                .insert([{
                    title: formData.title.trim(),
                    price: parseFloat(formData.price) || 0,
                    description: formData.description.trim(),
                    quantity: parseInt(formData.quantity) || 1,
                    products: scannedProducts,
                    // If your Supabase table has a default `now()` for `createdAt`, you don't need to pass it.
                    // Otherwise, you can use: createdAt: new Date().toISOString()
                }]);

            if (error) throw error;

            setMessage({ text: "Mistery Box salvat cu succes!", type: "success" });
            setFormData(INITIAL_FORM);
            setScannedProducts([]);
        } catch (err) {
            console.error(err);
            setMessage({ text: "Eroare la salvare.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="product-form">
            {/* IDENTIFICARE BOX */}
            <section className="form-section">
                <h2 className="section-title">Detalii Mistery Box</h2>
                <div className="grid-2-cols">
                    <div className="input-group col-span-2">
                        <label>Titlu box</label>
                        <input
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Ex: Vinyl Surprise Pack"
                            autoFocus
                        />
                    </div>

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
                        <label>Număr boxuri în stoc</label>
                        <input
                            name="quantity"
                            type="number"
                            value={formData.quantity}
                            onChange={handleChange}
                            placeholder="1"
                            min="1"
                        />
                    </div>

                    <div className="input-group col-span-2">
                        <label>Descriere</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Ce conține acest box? Ex: 3 vinyluri rock din anii '70-'80..."
                            style={{ height: "8rem" }}
                        />
                    </div>
                </div>
            </section>

            {/* SCANNER PRODUSE */}
            <section className="form-section">
                <h2 className="section-title">Produse în box</h2>

                <div className="input-group">
                    <label>Scanează cod de bare</label>
                    <div className="input-with-button">
                        <input
                            ref={scanInputRef}
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleScan(scanInput);
                                }
                            }}
                            placeholder="Scanează sau introdu manual..."
                        />
                        <button
                            type="button"
                            className="btn-icon btn-black"
                            onClick={() => handleScan(scanInput)}
                        >
                            <LucidePlus size={20} />
                        </button>
                    </div>
                </div>

                {/* LISTA PRODUSE SCANATE */}
                {scannedProducts.map((p) => (
                    <div key={p.scannedId} className="mb-scanned-item">
                        <div className="mb-scanned-info">
                            <LucideBarcode size={16} className="mb-barcode-icon" />
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <span className="mb-product-title">{p.title}</span>
                                </div>
                                <span className="mb-product-sub">
                                    {p.scannedId}
                                    {p.stock !== null && (
                                        <> · stoc: <strong>{p.stock}</strong></>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="mb-scanned-controls">
                            <button
                                type="button"
                                className="mb-qty-btn"
                                onClick={() => updateQty(p.scannedId, -1)}
                            >−</button>
                            <span className="mb-qty-value">{p.qty}</span>
                            <button
                                type="button"
                                className="mb-qty-btn"
                                onClick={() => updateQty(p.scannedId, +1)}
                                disabled={p.stock !== null && p.qty >= Number(p.stock)}
                                style={{ opacity: p.stock !== null && p.qty >= Number(p.stock) ? 0.35 : 1, cursor: p.stock !== null && p.qty >= Number(p.stock) ? "not-allowed" : "pointer" }}
                            >+</button>
                            <button
                                type="button"
                                className="mb-remove-btn"
                                onClick={() => removeProduct(p.scannedId)}
                            >
                                <LucideTrash2 size={15} />
                            </button>
                        </div>
                    </div>
                ))}
            </section>

            <button type="submit" disabled={loading} className="btn-submit">
                {loading ? <div className="spinner" /> : (
                    <>
                        <LucideSave size={20} />
                        SALVEAZĂ MISTERY BOX
                    </>
                )}
            </button>
        </form>
    );
}