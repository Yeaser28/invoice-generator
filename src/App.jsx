import { useEffect, useMemo, useRef, useState } from "react";

// QR codes are generated fully in the browser (nothing is ever sent to a
// server). No `npm install` needed: the tiny QR library is fetched from a
// CDN at runtime, once, and cached on `window`. If it fails to load (e.g.
// offline), the payment method still shows as text — it just skips the QR.
let qrLibPromise = null;
const loadQrLib = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.QRCode) return Promise.resolve(window.QRCode);
  if (!qrLibPromise) {
    qrLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
      script.async = true;
      script.onload = () => resolve(window.QRCode);
      script.onerror = () => reject(new Error("QR library failed to load"));
      document.head.appendChild(script);
    });
  }
  return qrLibPromise;
};

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "BDT", "INR", "AED"];

// Common payment methods worldwide — one click fills the label, works for any country
const PAYMENT_PRESETS = ["Bank transfer", "PayPal", "Wise", "bKash", "Nagad", "UPI", "Payoneer"];

// Invoice preview language — universal, not tied to any one country. Only the
// fixed labels are translated; names, addresses, items and notes stay exactly
// as the freelancer typed them, since those are the client's own words.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
];

const TRANSLATIONS = {
  en: { invoice: "Invoice", from: "From", billTo: "Bill to", issued: "Issued", due: "Due", description: "Description", qty: "Qty", rate: "Rate", amount: "Amount", subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total due", payVia: "Pay via", notes: "Notes", signature: "Authorized signature" },
  bn: { invoice: "ইনভয়েস", from: "প্রেরক", billTo: "গ্রাহক", issued: "ইস্যু তারিখ", due: "পরিশোধের তারিখ", description: "বিবরণ", qty: "পরিমাণ", rate: "দর", amount: "মূল্য", subtotal: "উপমোট", discount: "ছাড়", tax: "কর", total: "মোট পাওনা", payVia: "পেমেন্ট মাধ্যম", notes: "নোট", signature: "স্বাক্ষর" },
  es: { invoice: "Factura", from: "De", billTo: "Para", issued: "Emitida", due: "Vencimiento", description: "Descripción", qty: "Cant.", rate: "Precio", amount: "Importe", subtotal: "Subtotal", discount: "Descuento", tax: "Impuesto", total: "Total a pagar", payVia: "Formas de pago", notes: "Notas", signature: "Firma autorizada" },
  fr: { invoice: "Facture", from: "De", billTo: "Facturé à", issued: "Émise", due: "Échéance", description: "Description", qty: "Qté", rate: "Prix", amount: "Montant", subtotal: "Sous-total", discount: "Remise", tax: "Taxe", total: "Total dû", payVia: "Modes de paiement", notes: "Remarques", signature: "Signature autorisée" },
  hi: { invoice: "इनवॉइस", from: "प्रेषक", billTo: "ग्राहक", issued: "जारी तिथि", due: "देय तिथि", description: "विवरण", qty: "मात्रा", rate: "दर", amount: "राशि", subtotal: "उप-योग", discount: "छूट", tax: "कर", total: "कुल देय", payVia: "भुगतान का तरीका", notes: "टिप्पणियाँ", signature: "अधिकृत हस्ताक्षर" },
  ar: { invoice: "فاتورة", from: "من", billTo: "إلى", issued: "تاريخ الإصدار", due: "تاريخ الاستحقاق", description: "الوصف", qty: "الكمية", rate: "السعر", amount: "المبلغ", subtotal: "المجموع الفرعي", discount: "الخصم", tax: "الضريبة", total: "الإجمالي المستحق", payVia: "طرق الدفع", notes: "ملاحظات", signature: "التوقيع المعتمد" },
  pt: { invoice: "Fatura", from: "De", billTo: "Para", issued: "Emitida", due: "Vencimento", description: "Descrição", qty: "Qtd", rate: "Preço", amount: "Valor", subtotal: "Subtotal", discount: "Desconto", tax: "Imposto", total: "Total devido", payVia: "Formas de pagamento", notes: "Notas", signature: "Assinatura autorizada" },
  zh: { invoice: "发票", from: "寄件人", billTo: "客户", issued: "开票日期", due: "到期日", description: "说明", qty: "数量", rate: "单价", amount: "金额", subtotal: "小计", discount: "折扣", tax: "税", total: "应付总额", payVia: "付款方式", notes: "备注", signature: "授权签名" },
  de: { invoice: "Rechnung", from: "Von", billTo: "An", issued: "Ausgestellt", due: "Fällig", description: "Beschreibung", qty: "Menge", rate: "Preis", amount: "Betrag", subtotal: "Zwischensumme", discount: "Rabatt", tax: "Steuer", total: "Gesamtbetrag", payVia: "Zahlungsmethoden", notes: "Notizen", signature: "Autorisierte Unterschrift" },
  ru: { invoice: "Счёт", from: "От", billTo: "Клиенту", issued: "Выставлен", due: "Срок оплаты", description: "Описание", qty: "Кол-во", rate: "Цена", amount: "Сумма", subtotal: "Промежуточный итог", discount: "Скидка", tax: "Налог", total: "Итого к оплате", payVia: "Способы оплаты", notes: "Примечания", signature: "Уполномоченная подпись" },
};

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const currencyFmt = (currency) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency });
  } catch {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 });
  }
};

const STORAGE_KEY = "bangla-tools:invoices";
const CLIENTS_KEY = "bangla-tools:clients";

const loadList = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const saveList = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage unavailable (e.g. private browsing) — fail silently
  }
};

// Status of a saved invoice: paid / partially paid / overdue / due soon / upcoming
const dueStatus = (r) => {
  if (r.paid) return "paid";
  const received = r.received || 0;
  if (received > 0 && received < r.total) return "partial";
  const diff = (new Date(r.due) - new Date(today())) / 86400000;
  if (diff < 0) return "overdue";
  if (diff <= 3) return "soon";
  return "upcoming";
};

const STATUS_LABEL = {
  paid: "Paid",
  partial: "Partially paid",
  overdue: "Overdue",
  soon: "Due soon",
  upcoming: "Upcoming",
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// ---------- Shareable link (no server — the invoice is packed into the URL) ----------
// The whole invoice, minus logo/signature images (to keep the link short),
// is JSON-encoded straight into the URL's hash fragment. Nothing is ever
// uploaded anywhere: whoever opens the link decodes it locally in their own
// browser, same as the rest of this tool.
const encodeShare = (data) => encodeURIComponent(JSON.stringify(data));
const decodeShare = (hash) => {
  if (!hash || !hash.startsWith("#share=")) return null;
  try {
    return JSON.parse(decodeURIComponent(hash.slice(7)));
  } catch {
    return null;
  }
};

// ---------- Reminder helpers (email + WhatsApp, works for any country) ----------

const reminderMessage = (record) => {
  const balance = Math.max(record.total - (record.received || 0), 0);
  const amount = currencyFmt(record.currency).format(balance);
  const who = record.clientName && record.clientName !== "Untitled client" ? record.clientName : "there";
  const from = record.snapshot?.from?.name;
  const signature = from ? `\n\n— ${from}` : "";
  return `Hi ${who}, just a friendly reminder that invoice ${record.number} (${amount} due) was due on ${record.due}. Let me know if you have any questions.${signature}`;
};

// mailto: works everywhere, no assumptions about the client's country
const emailReminderLink = (record) => {
  const email = record.snapshot?.to?.email?.trim();
  if (!email) return null;
  const subject = encodeURIComponent(`Reminder: Invoice ${record.number}`);
  const body = encodeURIComponent(reminderMessage(record));
  return `mailto:${email}?subject=${subject}&body=${body}`;
};

// wa.me needs digits only; the client's own phone must include their country
// code (e.g. +1, +44, +880, +91...), so this makes no assumption about locale
const whatsappReminderLink = (record) => {
  const phone = record.snapshot?.to?.phone?.trim();
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  const text = encodeURIComponent(reminderMessage(record));
  return `https://wa.me/${digits}?text=${text}`;
};

const FAQ = [
  {
    q: "How do I download the invoice as a PDF?",
    a: "Click Download PDF. In the window that opens, choose “Save as PDF” as the destination, then save. It works in Chrome, Edge, Firefox and Safari.",
  },
  {
    q: "Do I need to sign up?",
    a: "No. Everything runs in your browser. Your invoice details are not sent to any server.",
  },
  {
    q: "What should a freelance invoice include?",
    a: "Your name and contact details, the client's details, a unique invoice number, the issue and due dates, a clear list of work with quantities and rates, any tax, the total, and how to pay you.",
  },
  {
    q: "How is the total calculated?",
    a: "Subtotal is the sum of quantity × rate for each line. The discount is subtracted, tax is added on the discounted amount, and the result is the total due.",
  },
  {
    q: "How do I send a payment reminder?",
    a: "Add the client's email and/or phone number (with their country code, e.g. +1, +44, +880) when creating the invoice, then save it. In My Invoices, click Email or WhatsApp next to that invoice — it opens a ready-to-send message. Nothing is sent automatically.",
  },
  {
    q: "Can I reuse a client's details next time?",
    a: "Yes. Saving an invoice also adds that client to your saved clients. Next time, use \"Fill from saved client\" to fill in their name, email, phone and address instantly.",
  },
  {
    q: "How does the payment QR code work?",
    a: "Add any payment method you accept — a bKash or Nagad number, a PayPal.me link, a bank account or IBAN, Wise, UPI, anything — and a QR code is generated for it automatically, right in your browser. Your client can scan it on their phone instead of retyping the details. It appears on the invoice preview and the downloaded PDF.",
  },
  {
    q: "What if a client only pays part of the invoice?",
    a: "Enter the amount received in My Invoices and the remaining balance updates automatically; the invoice is marked \"Partially paid\" until the full amount comes in.",
  },
  {
    q: "Can I send the invoice in my client's language?",
    a: "Yes. Use the language switcher above the invoice preview to change it — English, বাংলা, Español, Français, हिन्दी, العربية, Português, 中文, Deutsch or Русский. Only the invoice's fixed labels change; the names, addresses, items and notes you typed stay exactly as you wrote them. Each saved invoice remembers its own language.",
  },
  {
    q: "Can I add a signature to the invoice?",
    a: "Yes. Upload a signature or stamp image in the \"From (you)\" section and it appears above your name at the bottom of the invoice, giving it a more official, signed look.",
  },
  {
    q: "Can I send a link instead of a PDF?",
    a: "Yes. Click \"Copy shareable link\" above the preview — it copies a link with your invoice packed into it. Opening the link shows a clean, read-only copy the client can view or download as a PDF; nothing is uploaded to any server. To keep the link short, your logo and signature images aren't included in it — those still appear in the downloaded PDF.",
  },
];

function InvoiceEditor() {
  const nextId = useRef(2);
  const paymentId = useRef(1);
  const [from, setFrom] = useState({ name: "", email: "", address: "" });
  const [to, setTo] = useState({ name: "", email: "", phone: "", address: "" });
  const [number, setNumber] = useState("INV-001");
  const [date, setDate] = useState(today());
  const [due, setDue] = useState(plusDays(14));
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState([
    { id: 1, desc: "Website development", qty: "1", rate: "500" },
  ]);
  const [taxRate, setTaxRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("Thank you for your business!");
  const [logo, setLogo] = useState(null); // data URL
  const [signature, setSignature] = useState(null); // data URL — optional signature/stamp image
  const [docLang, setDocLang] = useState("en"); // invoice preview language — universal, any country's client
  const [paymentMethods, setPaymentMethods] = useState([]); // [{id, label, value}]
  const [qrCodes, setQrCodes] = useState({}); // id -> data URL, generated client-side

  const [savedInvoices, setSavedInvoices] = useState(() => loadList(STORAGE_KEY));
  const [savedClients, setSavedClients] = useState(() => loadList(CLIENTS_KEY));
  const [editingId, setEditingId] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("bangla-tools:theme") || "light";
    } catch {
      return "light";
    }
  });

  // Tell the browser this page manages its own light/dark look. Without this,
  // Chrome/Android's automatic dark mode force-inverts pages that don't
  // declare a color-scheme, which is what was making the title (and other
  // elements) render incorrectly regardless of our own theme toggle below.
  useEffect(() => {
    try {
      localStorage.setItem("bangla-tools:theme", theme);
    } catch {
      // storage unavailable — theme just won't persist across reloads
    }
    document.documentElement.style.colorScheme = theme;
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "color-scheme";
      document.head.appendChild(meta);
    }
    meta.content = theme === "dark" ? "dark light" : "light dark";
  }, [theme]);

  const sortedInvoices = useMemo(
    () => [...savedInvoices].sort((a, b) => (a.due < b.due ? -1 : 1)),
    [savedInvoices]
  );

  const sortedClients = useMemo(
    () => [...savedClients].sort((a, b) => a.name.localeCompare(b.name)),
    [savedClients]
  );

  const fmt = useMemo(() => currencyFmt(currency), [currency]);
  const t = TRANSLATIONS[docLang] || TRANSLATIONS.en;

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + num(i.qty) * num(i.rate), 0);
    const disc = Math.min(num(discount), subtotal);
    const taxable = subtotal - disc;
    const tax = (taxable * num(taxRate)) / 100;
    return { subtotal, disc, tax, total: taxable + tax };
  }, [items, taxRate, discount]);

  const updateItem = (id, key, value) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, [key]: value } : i)));
  const addItem = () =>
    setItems((list) => [...list, { id: nextId.current++, desc: "", qty: "1", rate: "0" }]);
  const removeItem = (id) =>
    setItems((list) => (list.length > 1 ? list.filter((i) => i.id !== id) : list));

  const addPaymentMethod = (presetLabel = "") =>
    setPaymentMethods((list) => [...list, { id: `pm${paymentId.current++}`, label: presetLabel, value: "" }]);
  const updatePaymentMethod = (id, key, value) =>
    setPaymentMethods((list) => list.map((m) => (m.id === id ? { ...m, [key]: value } : m)));
  const removePaymentMethod = (id) =>
    setPaymentMethods((list) => list.filter((m) => m.id !== id));

  // Generate every payment QR code locally in the browser — nothing is ever
  // uploaded anywhere, so it works the same for a bKash number, a PayPal.me
  // link, an IBAN, a UPI ID, or any other payment method, from any country.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = paymentMethods.filter((m) => m.value.trim());
      if (!active.length) {
        setQrCodes({});
        return;
      }
      let QRCode;
      try {
        QRCode = await loadQrLib();
      } catch {
        return; // offline / blocked CDN — payment cards still show as text, just no QR
      }
      if (!QRCode || cancelled) return;
      const next = {};
      for (const m of active) {
        try {
          next[m.id] = await QRCode.toDataURL(m.value.trim(), {
            width: 168,
            margin: 1,
            color: { dark: "#0d4d41", light: "#ffffff" },
          });
        } catch {
          // value too long / unsupported characters for a QR code — skip it
        }
      }
      if (!cancelled) setQrCodes(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentMethods]);

  // Browser uses document.title as the default PDF file name
  const downloadPdf = () => {
    const prev = document.title;
    document.title = `Invoice-${number || "draft"}`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const copyShareLink = async () => {
    const { logo: _logo, signature: _signature, ...shareable } = snapshot();
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#share=${encodeShare(shareable)}`;
    try {
      await navigator.clipboard.writeText(url);
      setSavedMsg("Shareable link copied! (Logo/signature aren't included, to keep the link short.)");
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const field = (obj, setObj, key) => ({
    value: obj[key],
    onChange: (e) => setObj({ ...obj, [key]: e.target.value }),
  });

  const onLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setSavedMsg("Logo too large — please use an image under 1.5MB.");
      return;
    }
    try {
      setLogo(await fileToDataUrl(file));
    } catch {
      setSavedMsg("Couldn't read that image — try a different file.");
    }
  };

  const onSignatureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800_000) {
      setSavedMsg("Signature image too large — please use an image under 800KB.");
      return;
    }
    try {
      setSignature(await fileToDataUrl(file));
    } catch {
      setSavedMsg("Couldn't read that image — try a different file.");
    }
  };

  const fillFromClient = (id) => {
    const c = savedClients.find((c) => c.id === id);
    if (!c) return;
    setTo({ name: c.name || "", email: c.email || "", phone: c.phone || "", address: c.address || "" });
  };

  const upsertClient = (contact) => {
    const name = contact.name?.trim();
    if (!name) return;
    const id = name.toLowerCase();
    setSavedClients((list) => {
      const others = list.filter((c) => c.id !== id);
      return [...others, { id, name, email: contact.email || "", phone: contact.phone || "", address: contact.address || "" }];
    });
  };

  const deleteClient = (id) =>
    setSavedClients((list) => list.filter((c) => c.id !== id));

  // Bundles the whole form into one record so "Load" can restore it exactly
  const snapshot = () => ({
    from, to, number, date, due, currency, items, taxRate, discount, notes, logo, signature, docLang, paymentMethods,
  });

  const restoreSnapshot = (s) => {
    setFrom({ name: "", email: "", address: "", ...s.from });
    setTo({ name: "", email: "", phone: "", address: "", ...s.to });
    setNumber(s.number); setDate(s.date);
    setDue(s.due); setCurrency(s.currency); setItems(s.items);
    setTaxRate(s.taxRate); setDiscount(s.discount); setNotes(s.notes);
    setLogo(s.logo || null);
    setSignature(s.signature || null);
    setDocLang(s.docLang || "en");
    setPaymentMethods(s.paymentMethods || []);
  };

  const saveInvoice = () => {
    const prev = editingId ? savedInvoices.find((r) => r.id === editingId) : null;
    const received = prev ? prev.received ?? (prev.paid ? prev.total : 0) : 0;
    const record = {
      id: editingId || `${Date.now()}`,
      clientName: to.name || "Untitled client",
      number, due, currency,
      total: totals.total,
      received,
      paid: prev ? prev.paid ?? false : false,
      paidDate: prev?.paidDate ?? null,
      snapshot: snapshot(),
    };
    setSavedInvoices((list) => {
      const withoutThis = list.filter((r) => r.id !== record.id);
      return [...withoutThis, record];
    });
    upsertClient(to);
    setEditingId(record.id);
    setSavedMsg(`Saved "${record.number}" to My Invoices.`);
  };

  const loadInvoice = (id) => {
    const record = savedInvoices.find((r) => r.id === id);
    if (!record) return;
    restoreSnapshot(record.snapshot);
    setEditingId(id);
    setSavedMsg(`Loaded "${record.number}" for editing.`);
  };

  // Full toggle: marks the invoice fully paid/unpaid and keeps "received" in sync
  const togglePaid = (id) =>
    setSavedInvoices((list) =>
      list.map((r) =>
        r.id === id
          ? r.paid
            ? { ...r, paid: false, received: 0, paidDate: null }
            : { ...r, paid: true, received: r.total, paidDate: today() }
          : r
      )
    );

  // Partial payments: typing an amount keeps "paid" derived and consistent.
  // paidDate records when money last came in, so the monthly summary can
  // tell "received this month" apart from older payments.
  const setReceived = (id, amount) =>
    setSavedInvoices((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const received = Math.max(0, amount);
        const gotMore = received > (r.received || 0);
        return {
          ...r,
          received,
          paid: r.total > 0 && received >= r.total,
          paidDate: received === 0 ? null : gotMore ? today() : r.paidDate,
        };
      })
    );

  const deleteInvoice = (id) => {
    setSavedInvoices((list) => list.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const duplicateInvoice = (id) => {
    const record = savedInvoices.find((r) => r.id === id);
    if (!record) return;
    const copy = {
      ...record,
      id: `${Date.now()}`,
      number: `${record.number}-copy`,
      due: plusDays(14),
      paid: false,
      received: 0,
      snapshot: { ...record.snapshot, number: `${record.number}-copy`, due: plusDays(14), date: today() },
    };
    setSavedInvoices((list) => [...list, copy]);
    setSavedMsg(`Duplicated as "${copy.number}".`);
  };

  const startNew = () => {
    setEditingId(null);
    setSavedMsg("");
  };

  const exportInvoices = () => {
    const payload = { invoices: savedInvoices, clients: savedClients };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importInvoices = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept both the old plain-array backups and the newer {invoices, clients} shape
      const incomingInvoices = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.invoices)
        ? parsed.invoices
        : null;
      const incomingClients = Array.isArray(parsed?.clients) ? parsed.clients : [];
      if (!incomingInvoices) throw new Error("not a valid backup");

      setSavedInvoices((list) => {
        const byId = new Map(list.map((r) => [r.id, r]));
        incomingInvoices.forEach((r) => {
          if (r && r.id && r.snapshot) byId.set(r.id, r);
        });
        return [...byId.values()];
      });
      if (incomingClients.length) {
        setSavedClients((list) => {
          const byId = new Map(list.map((c) => [c.id, c]));
          incomingClients.forEach((c) => {
            if (c && c.id && c.name) byId.set(c.id, c);
          });
          return [...byId.values()];
        });
      }
      setSavedMsg(
        `Imported ${incomingInvoices.length} invoice(s)${incomingClients.length ? ` and ${incomingClients.length} client(s)` : ""}.`
      );
    } catch {
      setSavedMsg("That file doesn't look like a valid invoices backup.");
    }
  };

  const overdueCount = useMemo(
    () => savedInvoices.filter((r) => dueStatus(r) === "overdue").length,
    [savedInvoices]
  );

  // Monthly summary — grouped by currency, since a freelancer may bill in more than one
  const summary = useMemo(() => {
    const add = (map, currency, amount) => {
      if (!amount) return;
      map[currency] = (map[currency] || 0) + amount;
    };
    const thisMonth = today().slice(0, 7);
    const received = {};
    const outstanding = {};
    const overdue = {};
    for (const r of savedInvoices) {
      const balance = Math.max(r.total - (r.received || 0), 0);
      if (r.paidDate && r.paidDate.slice(0, 7) === thisMonth) {
        add(received, r.currency, r.received || 0);
      }
      if (balance > 0) {
        add(outstanding, r.currency, balance);
        if (dueStatus(r) === "overdue") add(overdue, r.currency, balance);
      }
    }
    return { received, outstanding, overdue };
  }, [savedInvoices]);

  // Renders a currency->amount map as "$500 + ৳2,000", or "—" if empty
  const fmtSum = (map) => {
    const entries = Object.entries(map);
    if (entries.length === 0) return "—";
    return entries.map(([cur, amt]) => currencyFmt(cur).format(amt)).join("  +  ");
  };

  // Persist to localStorage whenever the saved lists change
  useEffect(() => saveList(STORAGE_KEY, savedInvoices), [savedInvoices]);
  useEffect(() => saveList(CLIENTS_KEY, savedClients), [savedClients]);

  const activePaymentMethods = paymentMethods.filter((m) => m.value.trim());

  return (
    <>
      <style>{css}</style>
      <div className={`inv${theme === "dark" ? " theme-dark" : ""}`}>
        <header className="inv-top no-print">
          <div className="inv-top-row">
            <div>
              <span className="eyebrow">Free · Private · No signup</span>
              <h1>Free Invoice Generator for Freelancers</h1>
              <p>
                Fill in the details, check the preview, then download a clean PDF.
                No signup, no watermark, works in any currency, any payment method,
                and any client's language.
              </p>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
              aria-label="Toggle light or dark app theme"
            >
              {theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
            </button>
          </div>
        </header>

        {overdueCount > 0 && (
          <div className="overdue-banner no-print">
            {overdueCount} invoice{overdueCount > 1 ? "s" : ""} overdue — scroll down to My Invoices to send a reminder.
          </div>
        )}

        <div className="inv-grid">
          {/* ---------- Form ---------- */}
          <form className="inv-form no-print" onSubmit={(e) => e.preventDefault()}>
            <fieldset>
              <legend>From (you)</legend>
              <input placeholder="Your name or business" {...field(from, setFrom, "name")} />
              <input placeholder="Email" {...field(from, setFrom, "email")} />
              <textarea rows={2} placeholder="Address" {...field(from, setFrom, "address")} />
              <label className="logo-field">
                Logo (optional)
                <div className="logo-row">
                  <input type="file" accept="image/*" onChange={onLogoChange} />
                  {logo && (
                    <button type="button" className="ghost" onClick={() => setLogo(null)}>
                      Remove
                    </button>
                  )}
                </div>
              </label>
              <label className="logo-field">
                Signature or stamp (optional)
                <div className="logo-row">
                  <input type="file" accept="image/*" onChange={onSignatureChange} />
                  {signature && (
                    <button type="button" className="ghost" onClick={() => setSignature(null)}>
                      Remove
                    </button>
                  )}
                </div>
                <p className="hint">Appears above your name at the bottom of the invoice.</p>
              </label>
            </fieldset>

            <fieldset>
              <legend>Bill to (client)</legend>
              {sortedClients.length > 0 && (
                <label className="client-picker">
                  Fill from saved client
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) fillFromClient(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>
                      Choose a client…
                    </option>
                    {sortedClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <input placeholder="Client name or company" {...field(to, setTo, "name")} />
              <input placeholder="Client email" {...field(to, setTo, "email")} />
              <input placeholder="Client phone, with country code (e.g. +1 555 123 4567)" {...field(to, setTo, "phone")} />
              <textarea rows={2} placeholder="Client address" {...field(to, setTo, "address")} />
            </fieldset>

            <fieldset>
              <legend>Invoice details</legend>
              <div className="row">
                <label>
                  Invoice no.
                  <input value={number} onChange={(e) => setNumber(e.target.value)} />
                </label>
                <label>
                  Currency
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Issue date
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label>
                  Due date
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Items</legend>
              {items.map((i) => (
                <div className="item" key={i.id}>
                  <input
                    className="desc"
                    placeholder="Description"
                    value={i.desc}
                    onChange={(e) => updateItem(i.id, "desc", e.target.value)}
                  />
                  <input
                    inputMode="decimal"
                    aria-label="Quantity"
                    placeholder="Qty"
                    value={i.qty}
                    onChange={(e) => updateItem(i.id, "qty", e.target.value)}
                  />
                  <input
                    inputMode="decimal"
                    aria-label="Rate"
                    placeholder="Rate"
                    value={i.rate}
                    onChange={(e) => updateItem(i.id, "rate", e.target.value)}
                  />
                  <button
                    type="button"
                    className="ghost"
                    aria-label="Remove item"
                    onClick={() => removeItem(i.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="ghost add" onClick={addItem}>
                + Add item
              </button>
              <div className="row">
                <label>
                  Discount ({currency})
                  <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </label>
                <label>
                  Tax (%)
                  <input inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>How you get paid (optional)</legend>
              {paymentMethods.length === 0 && (
                <div className="pay-presets">
                  {PAYMENT_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p}
                      className="preset-chip"
                      onClick={() => addPaymentMethod(p)}
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              )}
              {paymentMethods.map((m) => (
                <div className="pay-row" key={m.id}>
                  <input
                    placeholder="Method: bKash, Nagad, PayPal, Bank, Wise, UPI…"
                    value={m.label}
                    onChange={(e) => updatePaymentMethod(m.id, "label", e.target.value)}
                  />
                  <input
                    placeholder="Number, link or account details"
                    value={m.value}
                    onChange={(e) => updatePaymentMethod(m.id, "value", e.target.value)}
                  />
                  <button
                    type="button"
                    className="ghost"
                    aria-label="Remove payment method"
                    onClick={() => removePaymentMethod(m.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="ghost add" onClick={addPaymentMethod}>
                + Add payment method
              </button>
              <p className="hint">
                Each one gets its own scannable QR code on the invoice — a bKash/Nagad
                number, a PayPal.me link, an IBAN, a UPI ID, anything works.
              </p>
            </fieldset>

            <fieldset>
              <legend>Notes</legend>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </fieldset>

            <div className="actions">
              <button type="button" className="ghost" onClick={saveInvoice}>
                {editingId ? "Update saved invoice" : "Save invoice"}
              </button>
              {editingId && (
                <button type="button" className="ghost" onClick={startNew}>
                  + New invoice
                </button>
              )}
            </div>
            {savedMsg && <p className="saved-msg">{savedMsg}</p>}
            <button type="button" className="primary" onClick={downloadPdf}>
              Download PDF
            </button>
          </form>

          {/* ---------- Preview (this is what gets printed) ---------- */}
          <div>
            <div className="paper-toolbar no-print">
              <button type="button" className="ghost share-btn" onClick={copyShareLink}>
                🔗 Copy shareable link
              </button>
              <label className="lang-switch">
                <span>Invoice language</span>
                <select value={docLang} onChange={(e) => setDocLang(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>
            </div>
          <section className="paper" aria-label="Invoice preview">
            <div className="p-head">
              <div>
                {logo && <img className="p-logo" src={logo} alt="Business logo" />}
                <h2>{t.invoice}</h2>
                <p className="p-no">{number}</p>
              </div>
              <div className="p-dates">
                <div><span>{t.issued}</span> {date}</div>
                <div><span>{t.due}</span> {due}</div>
              </div>
            </div>

            <div className="p-parties">
              <div>
                <h3>{t.from}</h3>
                <p className="strong">{from.name || "Your name"}</p>
                <p>{from.email}</p>
                <p className="pre">{from.address}</p>
              </div>
              <div>
                <h3>{t.billTo}</h3>
                <p className="strong">{to.name || "Client name"}</p>
                <p>{to.email}</p>
                <p className="pre">{to.address}</p>
              </div>
            </div>

            <table className="p-table">
              <thead>
                <tr>
                  <th>{t.description}</th>
                  <th className="r">{t.qty}</th>
                  <th className="r">{t.rate}</th>
                  <th className="r">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.desc || "—"}</td>
                    <td className="r">{num(i.qty)}</td>
                    <td className="r">{fmt.format(num(i.rate))}</td>
                    <td className="r">{fmt.format(num(i.qty) * num(i.rate))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-totals">
              <div><span>{t.subtotal}</span><span>{fmt.format(totals.subtotal)}</span></div>
              {totals.disc > 0 && (
                <div><span>{t.discount}</span><span>-{fmt.format(totals.disc)}</span></div>
              )}
              {num(taxRate) > 0 && (
                <div><span>{t.tax} ({num(taxRate)}%)</span><span>{fmt.format(totals.tax)}</span></div>
              )}
              <div className="grand"><span>{t.total}</span><span>{fmt.format(totals.total)}</span></div>
            </div>

            {activePaymentMethods.length > 0 && (
              <div className="p-pay">
                <h3>{t.payVia}</h3>
                <div className="pay-grid">
                  {activePaymentMethods.map((m) => (
                    <div className="pay-card" key={m.id}>
                      {qrCodes[m.id] && (
                        <img className="pay-qr" src={qrCodes[m.id]} alt={`QR code to pay via ${m.label || "this method"}`} />
                      )}
                      <div>
                        <p className="strong">{m.label || "Payment"}</p>
                        <p className="pay-detail">{m.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notes && (
              <div className="p-notes">
                <h3>{t.notes}</h3>
                <p className="pre">{notes}</p>
              </div>
            )}

            <div className="p-signature">
              <div className="sig-line">
                {signature ? (
                  <img className="sig-img" src={signature} alt="Signature" />
                ) : (
                  <div className="sig-blank" />
                )}
              </div>
              <p className="sig-name">{from.name || "Authorized signatory"}</p>
              <p className="sig-label">{t.signature}</p>
            </div>
          </section>
          </div>
        </div>

        <section className="inv-tracker no-print">
          <div className="tracker-head">
            <h2>My Invoices ({sortedInvoices.length})</h2>
            <div className="tracker-backup">
              <button type="button" className="ghost" onClick={exportInvoices} disabled={sortedInvoices.length === 0}>
                Export backup
              </button>
              <label className="ghost import-label">
                Import backup
                <input type="file" accept="application/json" onChange={importInvoices} />
              </label>
            </div>
          </div>
          {sortedInvoices.length > 0 && (
            <div className="summary-grid">
              <div className="summary-card is-good">
                <span className="summary-label">Received this month</span>
                <span className="summary-value">{fmtSum(summary.received)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Outstanding</span>
                <span className="summary-value">{fmtSum(summary.outstanding)}</span>
              </div>
              <div className="summary-card is-bad">
                <span className="summary-label">Overdue</span>
                <span className="summary-value">{fmtSum(summary.overdue)}</span>
              </div>
            </div>
          )}
          {sortedInvoices.length === 0 ? (
            <p className="tracker-note">
              No saved invoices yet. Click "Save invoice" on the left to add one here.
            </p>
          ) : (
            <>
              <div className="tracker-list">
                {sortedInvoices.map((r) => {
                  const status = dueStatus(r);
                  const rfmt = currencyFmt(r.currency);
                  const emailLink = emailReminderLink(r);
                  const waLink = whatsappReminderLink(r);
                  const balance = Math.max(r.total - (r.received || 0), 0);
                  return (
                    <div className={`tracker-row status-${status}`} key={r.id}>
                      <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
                      <span className="t-number">{r.number}</span>
                      <span className="t-client">{r.clientName}</span>
                      <span className="t-due">Due {r.due}</span>
                      <span className="t-total">{rfmt.format(r.total)}</span>
                      <span className="t-progress">
                        <label className="visually-hidden" htmlFor={`received-${r.id}`}>
                          Amount received for invoice {r.number}
                        </label>
                        <input
                          id={`received-${r.id}`}
                          type="number"
                          inputMode="decimal"
                          className="t-received-input"
                          min="0"
                          step="0.01"
                          value={r.received ?? 0}
                          title="Amount received so far"
                          onChange={(e) => setReceived(r.id, num(e.target.value))}
                        />
                        <span className="t-balance-text">{rfmt.format(balance)} due</span>
                      </span>
                      <span className="t-actions">
                        {!r.paid && (
                          <a
                            className={`ghost remind-email${emailLink ? "" : " is-disabled"}`}
                            href={emailLink || undefined}
                            aria-disabled={!emailLink}
                            title={emailLink ? "Open a pre-filled email reminder" : "Add a client email to enable"}
                            onClick={(e) => { if (!emailLink) e.preventDefault(); }}
                          >
                            Email
                          </a>
                        )}
                        {!r.paid && (
                          <a
                            className={`ghost remind-whatsapp${waLink ? "" : " is-disabled"}`}
                            href={waLink || undefined}
                            target={waLink ? "_blank" : undefined}
                            rel={waLink ? "noreferrer" : undefined}
                            aria-disabled={!waLink}
                            title={waLink ? "Open a pre-filled WhatsApp reminder" : "Add a client phone (with country code) to enable"}
                            onClick={(e) => { if (!waLink) e.preventDefault(); }}
                          >
                            WhatsApp
                          </a>
                        )}
                        <button type="button" className="ghost" onClick={() => loadInvoice(r.id)}>
                          Edit
                        </button>
                        <button type="button" className="ghost" onClick={() => duplicateInvoice(r.id)}>
                          Duplicate
                        </button>
                        <button type="button" className="ghost" onClick={() => togglePaid(r.id)}>
                          {r.paid ? "Mark unpaid" : "Mark paid"}
                        </button>
                        <button type="button" className="ghost" onClick={() => deleteInvoice(r.id)}>
                          Delete
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="tracker-note">
                Saved in this browser only — nothing is sent to a server. Export
                a backup before clearing your browser data.
              </p>
            </>
          )}
        </section>

        {sortedClients.length > 0 && (
          <section className="inv-clients no-print">
            <h2>Saved clients ({sortedClients.length})</h2>
            <div className="clients-list">
              {sortedClients.map((c) => (
                <div className="client-row" key={c.id}>
                  <span className="c-name">{c.name}</span>
                  <span className="c-contact">{[c.email, c.phone].filter(Boolean).join(" · ") || "No contact saved"}</span>
                  <button type="button" className="ghost" onClick={() => deleteClient(c.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="tracker-note">
              Added automatically whenever you save an invoice for a client.
            </p>
          </section>
        )}

        <section className="inv-info no-print">
          <h2>How to write a freelance invoice</h2>
          <p>
            A good invoice makes it easy for a client to approve and pay. Give it
            a unique number, list each piece of work on its own line, state the
            due date clearly, and say how you want to be paid. Sending it the day
            the work is delivered gets you paid faster.
          </p>
          <h2>Questions</h2>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>
      </div>
    </>
  );
}

/* ---------- Styles (scoped under .inv so they don't clash with other tools) ---------- */

const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600;700&display=swap');

.inv {
  --ink: #16201d;
  --muted: #66756f;
  --line: #dfe3de;
  --paper: #f6f5f1;
  --surface: #ffffff;
  --accent: #146c5c;
  --accent-ink: #0d4d41;
  --accent-tint: #e6f0ec;
  --wa: #1e8a5f;
  --danger: #b3261e;
  --danger-tint: #fbe4e2;
  --warn: #8a6100;
  --warn-tint: #fbf0cf;
  --success: #1a7f43;
  --success-tint: #e2f3e8;
  --partial: #6a4fc4;
  --partial-tint: #ece7fb;
  color-scheme: light;
  background: var(--paper);
  color: var(--ink);
  min-height: 100vh;
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.55;
  padding: 32px 16px 72px;
  transition: background-color .15s ease, color .15s ease;
}

/* Dark theme — only the app chrome changes. The invoice preview itself
   (.paper, below) always resets to a plain white "paper" look, since that's
   what gets printed/PDF'd and sent to a client. */
.inv.theme-dark {
  --ink: #e7ece9;
  --muted: #97a49d;
  --line: #2b3630;
  --paper: #10151b;
  --surface: #1a222a;
  --accent: #3ec6a6;
  --accent-ink: #7fe6cb;
  --accent-tint: #1c2f2a;
  --wa: #3ec6a6;
  --danger: #ff9a90;
  --danger-tint: #3a201d;
  --warn: #ffd479;
  --warn-tint: #3a2f14;
  --success: #7fe0a0;
  --success-tint: #1c3324;
  --partial: #c3b3ff;
  --partial-tint: #2a2440;
  color-scheme: dark;
}
.inv * { box-sizing: border-box; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

.inv-top { max-width: 1120px; margin: 0 auto 22px; }
.inv-top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.theme-toggle {
  font: inherit; font-size: .82rem; font-weight: 600; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink);
  border-radius: 999px; padding: 8px 16px; box-shadow: 0 1px 2px rgba(20, 30, 26, .04);
  transition: border-color .15s ease;
}
.theme-toggle:hover { border-color: var(--accent); }
.inv-top .eyebrow {
  display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 700;
  letter-spacing: .05em; text-transform: uppercase; color: var(--accent-ink);
  background: var(--accent-tint); padding: 5px 12px; border-radius: 999px; margin-bottom: 12px;
}
.inv-top h1 {
  font-family: "Fraunces", ui-serif, Georgia, serif;
  font-weight: 600;
  font-size: clamp(1.6rem, 4vw, 2.15rem);
  margin: 0 0 6px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--accent-ink);
}
.inv-top p { margin: 0; color: var(--muted); max-width: 52ch; }

.overdue-banner {
  max-width: 1120px; margin: 0 auto 16px;
  background: var(--danger-tint); color: var(--danger);
  border: 1px solid #f3c2be; border-radius: 10px;
  padding: 10px 14px; font-size: .9rem; font-weight: 600;
}

.inv-grid {
  max-width: 1120px; margin: 0 auto; display: grid; gap: 22px;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr); align-items: start;
}
@media (max-width: 860px) { .inv-grid { grid-template-columns: 1fr; } }

.inv-form {
  background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  padding: 20px; box-shadow: 0 1px 2px rgba(20, 30, 26, .04);
}
.inv-form fieldset { border: 0; padding: 0; margin: 0 0 20px; display: grid; gap: 9px; }
.inv-form fieldset:last-of-type { margin-bottom: 0; }
.inv-form legend { font-weight: 600; padding: 0; margin-bottom: 4px; font-size: .95rem; }
.inv-form label { display: grid; gap: 4px; font-size: .84rem; color: var(--muted); }
.inv-form input, .inv-form select, .inv-form textarea {
  width: 100%; font: inherit; font-size: .95rem; color: var(--ink); background: var(--surface);
  border: 1px solid var(--line); border-radius: 9px; padding: 9px 11px;
  transition: border-color .15s ease;
}
.inv-form input:hover, .inv-form select:hover, .inv-form textarea:hover { border-color: #c3cac4; }
.inv-form textarea { resize: vertical; }
.inv-form input:focus-visible, .inv-form select:focus-visible, .inv-form textarea:focus-visible,
.inv button:focus-visible, .inv a:focus-visible, .inv summary:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent);
}
.hint { margin: 2px 0 0; font-size: .78rem; color: var(--muted); }
.client-picker { background: var(--accent-tint); border-radius: 9px; padding: 8px 10px; }
.client-picker select { border-color: #bfd9d1; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.item { display: grid; grid-template-columns: 1fr 64px 84px 34px; gap: 6px; }
.item .desc { grid-column: 1; }
@media (max-width: 480px) { .item { grid-template-columns: 1fr 56px 72px 32px; } }
.pay-row { display: grid; grid-template-columns: 1fr 1.4fr 34px; gap: 6px; }
@media (max-width: 480px) { .pay-row { grid-template-columns: 1fr; } }

.inv button, .inv a.ghost { font: inherit; cursor: pointer; border-radius: 9px; text-decoration: none; }
.inv .primary {
  width: 100%; padding: 12px; font-weight: 600; border: 0; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-ink));
  transition: filter .15s ease, transform .1s ease;
}
.inv .primary:hover { filter: brightness(1.06); }
.inv .primary:active { transform: translateY(1px); }
.inv .ghost {
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink);
  padding: 7px 10px; font-size: .88rem; font-weight: 500; transition: border-color .15s ease, color .15s ease;
}
.inv .ghost:hover { border-color: #b7bfb9; }
.inv .add { justify-self: start; }
.logo-field { margin-top: 2px; }
.logo-row { display: flex; align-items: center; gap: 8px; }
.logo-row input[type="file"] { border: 1px dashed var(--line); padding: 6px; font-size: .8rem; border-radius: 9px; }
.actions { display: flex; gap: 8px; margin-bottom: 8px; }
.actions .ghost { flex: 1; padding: 10px; font-weight: 600; }
.saved-msg { margin: 0 0 10px; font-size: .85rem; color: var(--accent-ink); }
.p-logo { display: block; max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 10px; }

.inv-tracker, .inv-clients {
  max-width: 1120px; margin: 26px auto 0; background: var(--surface);
  border: 1px solid var(--line); border-radius: 14px; padding: 20px;
  box-shadow: 0 1px 2px rgba(20, 30, 26, .04);
}
.inv-tracker h2, .inv-clients h2 { font-size: 1.05rem; margin: 0 0 12px; font-weight: 600; }
.tracker-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-wrap: wrap; margin-bottom: 12px;
}
.tracker-head h2 { margin: 0; }

.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
@media (max-width: 640px) { .summary-grid { grid-template-columns: 1fr; } }
.summary-card { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
.summary-label { font-size: .78rem; color: var(--muted); font-weight: 500; }
.summary-value { font-size: 1.3rem; font-weight: 700; color: var(--ink); font-family: "Fraunces", ui-serif, Georgia, serif; }
.summary-card.is-good { background: var(--success-tint); }
.summary-card.is-good .summary-value { color: var(--success); }
.summary-card.is-bad { background: var(--danger-tint); }
.summary-card.is-bad .summary-value { color: var(--danger); }

.pay-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 2px; }
.preset-chip { font: inherit; font-size: .82rem; padding: 6px 12px; border-radius: 999px;
  border: 1px dashed var(--line); background: var(--accent-tint); color: var(--accent-ink);
  cursor: pointer; font-weight: 500; }
.preset-chip:hover { border-color: var(--accent); }
.tracker-backup { display: flex; gap: 8px; }
.tracker-backup .ghost { font-size: .82rem; padding: 6px 10px; }
.import-label { position: relative; display: inline-flex; align-items: center; cursor: pointer; overflow: hidden; }
.import-label input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }

.tracker-list { display: grid; gap: 8px; }
.tracker-row {
  display: grid; grid-template-columns: 92px 90px 1fr auto auto auto auto; align-items: center;
  gap: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 11px; font-size: .88rem;
}
@media (max-width: 900px) { .tracker-row { grid-template-columns: 1fr 1fr; grid-auto-rows: auto; } }

.badge { font-size: .72rem; font-weight: 600; padding: 3px 9px; border-radius: 999px; text-align: center; white-space: nowrap; }
.badge-overdue { background: var(--danger-tint); color: var(--danger); }
.badge-soon { background: var(--warn-tint); color: var(--warn); }
.badge-upcoming { background: var(--accent-tint); color: var(--accent-ink); }
.badge-paid { background: var(--success-tint); color: var(--success); }
.badge-partial { background: var(--partial-tint); color: var(--partial); }
.t-number { font-weight: 600; }
.t-client { color: var(--muted); }
.t-due { color: var(--muted); }
.t-total { font-weight: 600; text-align: right; }
.t-progress { display: flex; align-items: center; gap: 6px; font-size: .78rem; color: var(--muted); }
.t-received-input { width: 68px; padding: 4px 6px; font-size: .8rem; border: 1px solid var(--line); border-radius: 7px; }
.t-balance-text { white-space: nowrap; }
.t-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-self: end; justify-content: flex-end; }
.t-actions .ghost, .t-actions a { padding: 5px 9px; font-size: .78rem; }
.remind-email { border-color: #bfd9d1; color: var(--accent-ink); }
.remind-whatsapp { border-color: #bfe0cd; color: var(--wa); }
.remind-email.is-disabled, .remind-whatsapp.is-disabled { opacity: .45; cursor: not-allowed; }
.tracker-note { margin: 12px 0 0; font-size: .78rem; color: var(--muted); }

.clients-list { display: grid; gap: 6px; }
.client-row {
  display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 10px;
  padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; font-size: .88rem;
}
@media (max-width: 560px) { .client-row { grid-template-columns: 1fr; } }
.c-name { font-weight: 600; }
.c-contact { color: var(--muted); font-size: .84rem; }

.paper {
  /* Fixed light "paper" look, independent of the app's dark theme above —
     locally reset every variable the invoice content uses, so it always
     renders (and prints) like a normal white invoice. */
  --ink: #16201d;
  --muted: #66756f;
  --line: #dfe3de;
  --paper: #f6f5f1;
  --surface: #ffffff;
  --accent: #146c5c;
  --accent-ink: #0d4d41;
  --accent-tint: #e6f0ec;
  color-scheme: light;
  background: var(--surface); color: #171f1c; border: 1px solid var(--line);
  border-top: 4px solid var(--accent); border-radius: 4px 4px 14px 14px;
  padding: 38px; min-height: 560px; box-shadow: 0 2px 10px rgba(20, 30, 26, .07);
}
@media (max-width: 480px) { .paper { padding: 22px; } }
.p-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
.p-head h2 {
  margin: 0; font-family: "Fraunces", ui-serif, Georgia, serif; font-weight: 600;
  font-size: 2rem; letter-spacing: -0.01em; color: var(--accent-ink);
}
.p-no { margin: 2px 0 0; color: var(--muted); }
.p-dates { text-align: right; font-size: .92rem; }
.p-dates span { color: var(--muted); margin-right: 6px; }
.p-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 26px; }
.paper h3 { margin: 0 0 4px; font-size: .78rem; color: var(--muted); font-weight: 600; }
.paper p { margin: 0; font-size: .92rem; }
.paper .strong { font-weight: 600; }
.pre { white-space: pre-line; }
.p-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.p-table th { text-align: left; padding: 9px 6px; border-bottom: 2px solid var(--ink); font-weight: 600; }
.p-table td { padding: 9px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.p-table .r { text-align: right; white-space: nowrap; }
.p-totals { margin: 16px 0 0 auto; width: min(100%, 280px); font-size: .95rem; }
.p-totals div { display: flex; justify-content: space-between; padding: 4px 6px; }
.p-totals .grand {
  margin-top: 8px; border-top: 2px solid var(--accent); color: var(--accent-ink);
  font-weight: 700; font-size: 1.12rem; padding-top: 10px;
}
.p-pay { margin-top: 26px; }
.pay-grid { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
.pay-card {
  display: flex; align-items: center; gap: 10px; border: 1px solid var(--line);
  border-radius: 11px; padding: 10px 12px; background: var(--paper); max-width: 260px;
}
.pay-qr { width: 60px; height: 60px; border-radius: 6px; background: #fff; flex-shrink: 0; }
.pay-detail { color: var(--muted); font-size: .84rem; word-break: break-all; }
.p-notes { margin-top: 30px; }

.paper-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.share-btn {
  border: 1px solid var(--line); background: var(--surface); color: var(--accent-ink);
  border-radius: 999px; padding: 7px 14px; font-size: .82rem; font-weight: 600;
  box-shadow: 0 1px 2px rgba(20, 30, 26, .04);
}
.share-btn:hover { border-color: var(--accent); }
.share-footer { max-width: 640px; margin: 14px auto 0; text-align: center; font-size: .8rem; color: var(--muted); }
.lang-switch {
  display: inline-flex; align-items: center; gap: 8px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 999px; padding: 6px 6px 6px 14px;
  font-size: .8rem; color: var(--muted); box-shadow: 0 1px 2px rgba(20, 30, 26, .04);
}
.lang-switch select {
  border: 0; background: var(--accent-tint); color: var(--accent-ink); font-weight: 600;
  border-radius: 999px; padding: 5px 12px; font: inherit; font-size: .82rem; cursor: pointer;
}

.p-signature { margin-top: 34px; display: inline-block; min-width: 220px; }
.sig-line { border-bottom: 1.5px solid var(--ink); min-height: 44px; display: flex; align-items: flex-end; }
.sig-img { max-height: 42px; max-width: 200px; object-fit: contain; }
.sig-blank { width: 100%; }
.sig-name { margin: 6px 0 0; font-weight: 600; font-size: .9rem; }
.sig-label { margin: 1px 0 0; font-size: .74rem; color: var(--muted); }

.inv-info { max-width: 720px; margin: 42px auto 0; }
.inv-info h2 { font-family: "Fraunces", ui-serif, Georgia, serif; font-weight: 600; font-size: 1.25rem; margin: 28px 0 8px; }
.inv-info details { border-bottom: 1px solid var(--line); padding: 11px 0; }
.inv-info summary { cursor: pointer; font-weight: 500; }
.inv-info details p { margin: 8px 0 0; color: var(--muted); }

@media print {
  @page { margin: 12mm; }
  body { background: #fff !important; }
  .no-print { display: none !important; }
  .inv { background: #fff; padding: 0; min-height: 0; }
  .inv-grid { display: block; max-width: none; }
  .paper { border: 0; box-shadow: none; padding: 0; min-height: 0; }
}
`;

// ---------- Read-only view rendered when a #share=... link is opened ----------
function SharedInvoiceView({ data, onBack }) {
  const { from = {}, to = {}, number, date, due, currency, items = [], taxRate, discount, notes, paymentMethods = [] } = data;
  const t = TRANSLATIONS[data.docLang] || TRANSLATIONS.en;
  const fmt = useMemo(() => currencyFmt(currency), [currency]);
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + num(i.qty) * num(i.rate), 0);
    const disc = Math.min(num(discount), subtotal);
    const taxable = subtotal - disc;
    const tax = (taxable * num(taxRate)) / 100;
    return { subtotal, disc, tax, total: taxable + tax };
  }, [items, taxRate, discount]);
  const activePaymentMethods = paymentMethods.filter((m) => m.value?.trim());
  const [qrCodes, setQrCodes] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activePaymentMethods.length) return;
      let QRCode;
      try {
        QRCode = await loadQrLib();
      } catch {
        return;
      }
      if (!QRCode || cancelled) return;
      const next = {};
      for (const m of activePaymentMethods) {
        try {
          next[m.id] = await QRCode.toDataURL(m.value.trim(), { width: 168, margin: 1, color: { dark: "#0d4d41", light: "#ffffff" } });
        } catch {}
      }
      if (!cancelled) setQrCodes(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(paymentMethods)]);

  const downloadPdf = () => {
    const prev = document.title;
    document.title = `Invoice-${number || "shared"}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  return (
    <>
      <style>{css}</style>
      <div className="inv">
        <div className="inv-grid" style={{ gridTemplateColumns: "1fr", maxWidth: 720 }}>
          <div>
            <div className="paper-toolbar no-print">
              <button type="button" className="ghost share-btn" onClick={onBack}>
                ← Create your own invoice
              </button>
              <button type="button" className="primary" onClick={downloadPdf}>
                Download PDF
              </button>
            </div>
            <section className="paper" aria-label="Shared invoice">
              <div className="p-head">
                <div>
                  <h2>{t.invoice}</h2>
                  <p className="p-no">{number}</p>
                </div>
                <div className="p-dates">
                  <div><span>{t.issued}</span> {date}</div>
                  <div><span>{t.due}</span> {due}</div>
                </div>
              </div>

              <div className="p-parties">
                <div>
                  <h3>{t.from}</h3>
                  <p className="strong">{from.name || "Your name"}</p>
                  <p>{from.email}</p>
                  <p className="pre">{from.address}</p>
                </div>
                <div>
                  <h3>{t.billTo}</h3>
                  <p className="strong">{to.name || "Client name"}</p>
                  <p>{to.email}</p>
                  <p className="pre">{to.address}</p>
                </div>
              </div>

              <table className="p-table">
                <thead>
                  <tr>
                    <th>{t.description}</th>
                    <th className="r">{t.qty}</th>
                    <th className="r">{t.rate}</th>
                    <th className="r">{t.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.desc || "—"}</td>
                      <td className="r">{num(i.qty)}</td>
                      <td className="r">{fmt.format(num(i.rate))}</td>
                      <td className="r">{fmt.format(num(i.qty) * num(i.rate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-totals">
                <div><span>{t.subtotal}</span><span>{fmt.format(totals.subtotal)}</span></div>
                {totals.disc > 0 && (
                  <div><span>{t.discount}</span><span>-{fmt.format(totals.disc)}</span></div>
                )}
                {num(taxRate) > 0 && (
                  <div><span>{t.tax} ({num(taxRate)}%)</span><span>{fmt.format(totals.tax)}</span></div>
                )}
                <div className="grand"><span>{t.total}</span><span>{fmt.format(totals.total)}</span></div>
              </div>

              {activePaymentMethods.length > 0 && (
                <div className="p-pay">
                  <h3>{t.payVia}</h3>
                  <div className="pay-grid">
                    {activePaymentMethods.map((m) => (
                      <div className="pay-card" key={m.id}>
                        {qrCodes[m.id] && (
                          <img className="pay-qr" src={qrCodes[m.id]} alt={`QR code to pay via ${m.label || "this method"}`} />
                        )}
                        <div>
                          <p className="strong">{m.label || "Payment"}</p>
                          <p className="pay-detail">{m.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notes && (
                <div className="p-notes">
                  <h3>{t.notes}</h3>
                  <p className="pre">{notes}</p>
                </div>
              )}
            </section>
            <p className="share-footer no-print">
              This is a read-only shared invoice — nothing here was uploaded to a server, it's decoded straight from the link.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- Entry point: shows the shared invoice if the link has one, else the editor ----------
export default function InvoiceGenerator() {
  const [shared, setShared] = useState(() =>
    typeof window !== "undefined" ? decodeShare(window.location.hash) : null
  );
  useEffect(() => {
    const onHashChange = () => setShared(decodeShare(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (shared) {
    return <SharedInvoiceView data={shared} onBack={() => { window.location.hash = ""; }} />;
  }
  return <InvoiceEditor />;
}
