import { useMemo, useRef, useState } from "react";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "BDT", "INR", "AED"];

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
];

export default function InvoiceGenerator() {
  const nextId = useRef(2);
  const [from, setFrom] = useState({ name: "", email: "", address: "" });
  const [to, setTo] = useState({ name: "", email: "", address: "" });
  const [number, setNumber] = useState("INV-001");
  const [date, setDate] = useState(today());
  const [due, setDue] = useState(plusDays(14));
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState([
    { id: 1, desc: "Website development", qty: "1", rate: "500" },
  ]);
  const [taxRate, setTaxRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("Payment via bank transfer or PayPal within 14 days. Thank you!");

  const fmt = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency });
    } catch {
      return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 });
    }
  }, [currency]);

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

  const field = (obj, setObj, key) => ({
    value: obj[key],
    onChange: (e) => setObj({ ...obj, [key]: e.target.value }),
  });

  return (
    <>
      <style>{css}</style>
      <div className="inv">
        <header className="inv-top no-print">
          <h1>Free Invoice Generator for Freelancers</h1>
          <p>
            Fill in the details, check the preview, then download a clean PDF.
            No signup, no watermark.
          </p>
        </header>

        <div className="inv-grid">
          {/* ---------- Form ---------- */}
          <form className="inv-form no-print" onSubmit={(e) => e.preventDefault()}>
            <fieldset>
              <legend>From (you)</legend>
              <input placeholder="Your name or business" {...field(from, setFrom, "name")} />
              <input placeholder="Email" {...field(from, setFrom, "email")} />
              <textarea rows={2} placeholder="Address" {...field(from, setFrom, "address")} />
            </fieldset>

            <fieldset>
              <legend>Bill to (client)</legend>
              <input placeholder="Client name or company" {...field(to, setTo, "name")} />
              <input placeholder="Client email" {...field(to, setTo, "email")} />
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
              <legend>Notes / payment details</legend>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </fieldset>

            <button type="button" className="primary" onClick={downloadPdf}>
              Download PDF
            </button>
          </form>

          {/* ---------- Preview (this is what gets printed) ---------- */}
          <section className="paper" aria-label="Invoice preview">
            <div className="p-head">
              <div>
                <h2>INVOICE</h2>
                <p className="p-no">{number}</p>
              </div>
              <div className="p-dates">
                <div><span>Issued</span> {date}</div>
                <div><span>Due</span> {due}</div>
              </div>
            </div>

            <div className="p-parties">
              <div>
                <h3>From</h3>
                <p className="strong">{from.name || "Your name"}</p>
                <p>{from.email}</p>
                <p className="pre">{from.address}</p>
              </div>
              <div>
                <h3>Bill to</h3>
                <p className="strong">{to.name || "Client name"}</p>
                <p>{to.email}</p>
                <p className="pre">{to.address}</p>
              </div>
            </div>

            <table className="p-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="r">Qty</th>
                  <th className="r">Rate</th>
                  <th className="r">Amount</th>
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
              <div><span>Subtotal</span><span>{fmt.format(totals.subtotal)}</span></div>
              {totals.disc > 0 && (
                <div><span>Discount</span><span>-{fmt.format(totals.disc)}</span></div>
              )}
              {num(taxRate) > 0 && (
                <div><span>Tax ({num(taxRate)}%)</span><span>{fmt.format(totals.tax)}</span></div>
              )}
              <div className="grand"><span>Total due</span><span>{fmt.format(totals.total)}</span></div>
            </div>

            {notes && (
              <div className="p-notes">
                <h3>Notes</h3>
                <p className="pre">{notes}</p>
              </div>
            )}
          </section>
        </div>

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
.inv { --ink:#1b2430; --muted:#5d6b7a; --line:#d5dbe3; --accent:#1f4fd8; --bg:#f3f5f8;
  color-scheme: light; background: var(--bg); color: var(--ink); min-height: 100vh;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.55;
  padding: 28px 16px 64px; }
.inv * { box-sizing: border-box; }
.inv-top { max-width: 1100px; margin: 0 auto 20px; }
.inv-top h1 { font-size: clamp(1.5rem, 4vw, 2rem); margin: 0 0 6px; line-height: 1.25; }
.inv-top p { margin: 0; color: var(--muted); }

.inv-grid { max-width: 1100px; margin: 0 auto; display: grid; gap: 20px;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr); align-items: start; }
@media (max-width: 860px) { .inv-grid { grid-template-columns: 1fr; } }

.inv-form { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
.inv-form fieldset { border: 0; padding: 0; margin: 0 0 16px; display: grid; gap: 8px; }
.inv-form legend { font-weight: 700; padding: 0; margin-bottom: 6px; }
.inv-form label { display: grid; gap: 4px; font-size: .85rem; color: var(--muted); }
.inv-form input, .inv-form select, .inv-form textarea {
  width: 100%; font: inherit; font-size: .95rem; color: var(--ink); background: #fff;
  border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; }
.inv-form textarea { resize: vertical; }
.inv-form input:focus-visible, .inv-form select:focus-visible, .inv-form textarea:focus-visible,
.inv button:focus-visible, .inv summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.item { display: grid; grid-template-columns: 1fr 64px 84px 34px; gap: 6px; }
.item .desc { grid-column: 1; }
@media (max-width: 480px) { .item { grid-template-columns: 1fr 56px 72px 32px; } }
.inv button { font: inherit; cursor: pointer; border-radius: 6px; }
.inv .primary { width: 100%; padding: 12px; font-weight: 700; border: 0; background: var(--accent); color: #fff; }
.inv .ghost { border: 1px solid var(--line); background: #fff; color: var(--ink); padding: 6px 8px; }
.inv .add { justify-self: start; }

.paper { background: #fff; color: #111; border: 1px solid var(--line); border-radius: 4px;
  padding: 36px; min-height: 560px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
@media (max-width: 480px) { .paper { padding: 20px; } }
.p-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 26px; }
.p-head h2 { margin: 0; font-size: 1.9rem; letter-spacing: .04em; color: var(--accent); }
.p-no { margin: 2px 0 0; color: var(--muted); }
.p-dates { text-align: right; font-size: .92rem; }
.p-dates span { color: var(--muted); margin-right: 6px; }
.p-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 26px; }
.paper h3 { margin: 0 0 4px; font-size: .8rem; color: var(--muted); font-weight: 600; }
.paper p { margin: 0; font-size: .92rem; }
.paper .strong { font-weight: 700; }
.pre { white-space: pre-line; }
.p-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.p-table th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #111; font-weight: 700; }
.p-table td { padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.p-table .r { text-align: right; white-space: nowrap; }
.p-totals { margin: 16px 0 0 auto; width: min(100%, 280px); font-size: .95rem; }
.p-totals div { display: flex; justify-content: space-between; padding: 4px 6px; }
.p-totals .grand { margin-top: 6px; border-top: 2px solid #111; font-weight: 700; font-size: 1.1rem; padding-top: 8px; }
.p-notes { margin-top: 28px; }

.inv-info { max-width: 720px; margin: 40px auto 0; }
.inv-info h2 { font-size: 1.2rem; margin: 26px 0 8px; }
.inv-info details { border-bottom: 1px solid var(--line); padding: 10px 0; }
.inv-info summary { cursor: pointer; font-weight: 600; }
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
