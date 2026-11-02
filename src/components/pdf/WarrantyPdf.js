import { jsPDF } from 'jspdf';
import { drawShopHeader, pdfAmount, pdfDate } from './InvoicePdf';

/**
 * Génère et télécharge un certificat de garantie.
 * - type 'sale'   : garantie d'un téléphone vendu (IMEI)
 * - type 'repair' : garantie d'une réparation SAV
 */
export function generateWarrantyPdf({
  type = 'sale',
  reference,
  date,
  customerName,
  customerPhone,
  deviceName,
  imei,
  description,
  amount,
  months = type === 'repair' ? 3 : 6,
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const startDate = date ? new Date(date) : new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  let y = drawShopHeader(doc, 'CERTIFICAT DE GARANTIE', `Réf. ${reference}`);

  // Bloc récapitulatif
  const lines = [
    ['Client', customerName || 'Client de passage'],
    ['Téléphone', customerPhone || '-'],
    ['Appareil', deviceName || '-'],
    ['IMEI / N° de série', imei || '-'],
  ];
  if (description) lines.push([type === 'repair' ? 'Intervention' : 'Description', description]);
  if (amount !== undefined && amount !== null) lines.push([type === 'repair' ? 'Montant réparation' : "Prix d'achat", pdfAmount(amount)]);
  lines.push([type === 'repair' ? 'Date de réparation' : "Date d'achat", pdfDate(startDate)]);
  lines.push(['Durée de garantie', `${months} mois`]);
  lines.push(["Valable jusqu'au", pdfDate(endDate)]);

  doc.setDrawColor(229, 231, 235);
  doc.setFontSize(10);
  lines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, 14, y);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(String(value), pageWidth - 84);
    doc.text(wrapped, 70, y);
    y += 6 * wrapped.length + 2;
    doc.line(14, y - 4, pageWidth - 14, y - 4);
  });

  // Conditions
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Conditions de garantie', 14, y);
  y += 7;

  const conditions = type === 'repair'
    ? [
        "La garantie couvre uniquement l'intervention et les pièces remplacées mentionnées ci-dessus.",
        "Elle ne s'applique pas en cas de chute, d'oxydation, de casse ou d'intervention d'un tiers.",
        "L'appareil doit être présenté avec ce certificat pour toute prise en charge.",
      ]
    : [
        "La garantie couvre les défauts de fabrication constatés dans le cadre d'une utilisation normale.",
        "Sont exclus : la casse, l'oxydation, les chocs, l'écran fissuré et toute intervention d'un tiers.",
        "Le numéro IMEI de l'appareil doit correspondre à celui indiqué sur ce certificat.",
        'La facture et ce certificat doivent être présentés pour toute prise en charge.',
      ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  conditions.forEach((condition) => {
    const wrapped = doc.splitTextToSize(`- ${condition}`, pageWidth - 28);
    doc.text(wrapped, 14, y);
    y += 5 * wrapped.length + 1;
  });

  // Signatures
  y += 14;
  doc.setFontSize(10);
  doc.text('Cachet et signature du vendeur', 14, y);
  doc.text('Signature du client', pageWidth - 14, y, { align: 'right' });

  doc.save(`garantie-${reference}.pdf`);
}
