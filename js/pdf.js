import { formatDate } from './format.js';

const MARGIN = 15;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

function loadImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function grundText(m) {
  return m.grund === 'Sonstiges' && m.grundSonstiges ? `Sonstiges – ${m.grundSonstiges}` : m.grund || '';
}

export async function buildVerschrottungPdf(m) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Verschrottungsmeldung', MARGIN, y);
  y += 10;

  doc.setFontSize(10);
  function row(label, value) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(value || '–'), CONTENT_W - 45);
    doc.text(lines, MARGIN + 45, y);
    y += Math.max(6, lines.length * 5);
  }

  row('Datum', formatDate(m.createdAt));
  row('Artikelnummer', m.artikelnummer);
  row('Artikelbezeichnung', m.artikelbezeichnung);
  row('Menge', m.menge);
  row('Grund', grundText(m));
  row('Bemerkung', m.bemerkung);
  row('Gemeldet von', m.melder);

  if (m.foto) {
    const size = await loadImageSize(m.foto);
    if (size) {
      const maxW = CONTENT_W;
      const maxH = PAGE_H - MARGIN - y - 10;
      let w = maxW;
      let h = (size.h / size.w) * maxW;
      if (h > maxH) {
        h = maxH;
        w = (size.w / size.h) * maxH;
      }
      y += 5;
      try {
        doc.addImage(m.foto, 'JPEG', MARGIN, y, w, h, undefined, 'FAST');
        y += h + 5;
      } catch (e) {
        // ungültiges Bild ignorieren, Rest des Berichts bleibt gültig
      }
    }
  }

  const safeArtikel = (m.artikelnummer || 'artikel').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const filename = `Verschrottung_${safeArtikel}_${m.id}.pdf`;
  return { doc, filename };
}
