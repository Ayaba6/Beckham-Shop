import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatPaymentMethod } from '../../utils/formatters';

export const SHOP_NAME = 'ShopManager';
export const SHOP_SUBTITLE = 'Téléphones, Accessoires & Réparations';

/**
 * Les polices standard de jsPDF ne gèrent pas les espaces insécables
 * produites par Intl.NumberFormat (fr-FR) : on les remplace par des espaces simples.
 */
export function pdfAmount(amount) {
  return formatCurrency(amount).replace(/\s/g, ' ');
}

export function pdfDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('fr-FR');
}

/**
 * En-tête commun aux documents PDF de la boutique. Retourne la position Y sous l'en-tête.
 */
export function drawShopHeader(doc, title, reference) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(SHOP_NAME, 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(SHOP_SUBTITLE, 14, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth - 14, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(reference, pageWidth - 14, 20, { align: 'right' });

  doc.setTextColor(17, 24, 39);
  return 40;
}


/**
 * Génère et télécharge la facture d'une vente.
 * `sale` : ligne de la table sales, enrichie de `customers` et de `sale_items`
 * (chaque item avec `products` et éventuellement `product_imeis`).
 */
export function generateInvoicePdf(sale) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const reference = `N° ${sale.id.slice(0, 8).toUpperCase()}`;

  let y = drawShopHeader(doc, 'FACTURE', reference);

  // Bloc infos vente / client
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturé à :', 14, y);
  doc.text('Détails :', pageWidth / 2 + 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.customers?.full_name || 'Client de passage', 14, y + 6);
  if (sale.customers?.phone) doc.text(`Tél : ${sale.customers.phone}`, 14, y + 12);
  doc.text(`Date : ${pdfDate(sale.created_at)}`, pageWidth / 2 + 10, y + 6);
  doc.text(`Paiement : ${formatPaymentMethod(sale.payment_method)}`, pageWidth / 2 + 10, y + 12);
  y += 22;

  // Lignes de la facture
  const rows = (sale.sale_items || []).map((item) => {
    const name = [item.products?.name || 'Article', item.products?.brand ? `(${item.products.brand})` : '']
      .filter(Boolean)
      .join(' ');
    const imei = item.product_imeis?.imei_number;
    return [
      imei ? `${name}\nIMEI : ${imei}` : name,
      String(item.quantity),
      pdfAmount(item.unit_price),
      pdfAmount(item.subtotal ?? item.unit_price * item.quantity),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', 'Prix unitaire', 'Sous-total']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9 },
    columnStyles: {
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 38 },
    },
  });

  // Totaux
  y = doc.lastAutoTable.finalY + 10;
  const discount = Number(sale.discount_amount) || 0;
  const labelX = pageWidth - 70;
  const valueX = pageWidth - 14;

  doc.setFontSize(10);
  if (discount > 0) {
    doc.text('Sous-total :', labelX, y);
    doc.text(pdfAmount(Number(sale.total_amount) + discount), valueX, y, { align: 'right' });
    y += 6;
    doc.text('Réduction :', labelX, y);
    doc.text(`-${pdfAmount(discount)}`, valueX, y, { align: 'right' });
    y += 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total payé :', labelX, y + 2);
  doc.text(pdfAmount(sale.total_amount), valueX, y + 2, { align: 'right' });

  // Pied de page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.text('Merci pour votre achat ! Conservez cette facture, elle vous sera demandée pour toute garantie.', pageWidth / 2, pageHeight - 12, { align: 'center' });

  doc.save(`facture-${sale.id.slice(0, 8)}.pdf`);
}
