interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  subtotal: number;
  unitName?: string | undefined;
  conversionQty?: number | undefined;
}

interface ReceiptData {
  invoiceNumber: string;
  date: string;
  cashier: string;
  customer?: string | undefined;
  memberLevel?: string | undefined;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  paymentAmount: number;
  change: number;
  payments?: { method: string; amount: number }[] | undefined;
  promos?: string[] | undefined;
  storeName?: string | undefined;
  storeAddress?: string | undefined;
  storePhone?: string | undefined;
  headerText?: string | undefined;
  footerText?: string | undefined;
  thankYouMessage?: string | undefined;
  showPointInfo?: boolean | undefined;
  showCashierName?: boolean | undefined;
  showDateTime?: boolean | undefined;
  showPaymentMethod?: boolean | undefined;
  paperWidth?: number | undefined;
}

export function printThermalReceipt(data: ReceiptData) {
  const storeName = data.storeName || "POS MINIMARKET";
  const storeAddress = data.storeAddress || "";
  const storePhone = data.storePhone || "";
  const headerText = data.headerText || "";
  const footerText = data.footerText || "Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat dikembalikan\nkecuali ada kesepakatan.";
  const thankYouMessage = data.thankYouMessage || "";
  const showPointInfo = data.showPointInfo !== false;
  const showCashierName = data.showCashierName !== false;
  const showDateTime = data.showDateTime !== false;
  const showPaymentMethod = data.showPaymentMethod !== false;
  const paperWidth = data.paperWidth === 58 ? 58 : 80;

  const paymentLabels: Record<string, string> = {
    CASH: "Tunai", TRANSFER: "Transfer", QRIS: "QRIS",
    EWALLET: "E-Wallet", DEBIT: "Debit", CREDIT_CARD: "Kartu Kredit",
    TERMIN: "Termin",
  };

  const line = "=".repeat(40);
  const dash = "-".repeat(40);

  let receipt = `
<div style="font-family: 'Courier New', monospace; width: ${paperWidth === 58 ? "220px" : "280px"}; font-size: 11px; line-height: 1.4; padding: 8px;">
  <div style="text-align: center; font-weight: bold; font-size: 14px;">${storeName}</div>
  ${storeAddress ? `<div style="text-align: center; font-size: 10px;">${storeAddress}</div>` : ""}
  ${storePhone ? `<div style="text-align: center; font-size: 10px;">${storePhone}</div>` : ""}
  ${headerText ? `<div style="text-align: center; font-size: 10px; margin-top: 3px; white-space: pre-line;">${headerText}</div>` : ""}
  <div style="text-align: center; font-size: 10px; margin-top: 4px;">${line}</div>

  <div style="display: flex; justify-content: space-between;">
    <span>No: ${data.invoiceNumber}</span>
  </div>
  ${showDateTime || showCashierName ? `
  <div style="display: flex; justify-content: space-between;">
    <span>${showDateTime ? data.date : ""}</span>
    <span>${showCashierName ? data.cashier : ""}</span>
  </div>` : ""}
  ${data.customer ? `<div>Member: ${data.customer} (${data.memberLevel || ""})</div>` : ""}
  <div style="text-align: center;">${dash}</div>
`;

  for (const item of data.items) {
    const unitLabel = item.unitName && item.unitName.toUpperCase() !== "PCS" ? ` ${item.unitName}` : "";
    receipt += `
  <div>${item.name}${unitLabel ? ` (${item.unitName})` : ""}</div>
  <div style="display: flex; justify-content: space-between; padding-left: 12px;">
    <span>${item.qty}${unitLabel} x ${formatNum(item.price)}</span>
    <span>${formatNum(item.subtotal)}</span>
  </div>`;
  }

  receipt += `
  <div style="text-align: center;">${dash}</div>
  <div style="display: flex; justify-content: space-between;">
    <span>Subtotal</span><span>${formatNum(data.subtotal)}</span>
  </div>`;

  if (data.discount > 0) {
    receipt += `
  <div style="display: flex; justify-content: space-between;">
    <span>Diskon</span><span>-${formatNum(data.discount)}</span>
  </div>`;
  }

  if (data.tax > 0) {
    receipt += `
  <div style="display: flex; justify-content: space-between;">
    <span>Pajak</span><span>${formatNum(data.tax)}</span>
  </div>`;
  }

  receipt += `
  <div style="text-align: center;">${line}</div>
  <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
    <span>TOTAL</span><span>Rp ${formatNum(data.grandTotal)}</span>
  </div>
  <div style="text-align: center;">${line}</div>`;

  if (showPaymentMethod) {
    const paymentsList = data.payments && data.payments.length > 0
      ? data.payments
      : [{ method: data.paymentMethod, amount: data.paymentAmount }];
    const isSplit = paymentsList.length > 1;

    if (isSplit) {
      receipt += `
  <div style="font-weight: bold; margin-top: 2px;">Pembayaran:</div>`;
    }

    for (const p of paymentsList) {
      receipt += `
  <div style="display: flex; justify-content: space-between;${isSplit ? " padding-left: 8px;" : ""}">
    <span>${paymentLabels[p.method] || p.method}</span><span>Rp ${formatNum(p.amount)}</span>
  </div>`;
    }

    if (isSplit) {
      const totalPaid = paymentsList.reduce((sum, p) => sum + p.amount, 0);
      receipt += `
  <div style="display: flex; justify-content: space-between; padding-left: 8px; font-weight: bold;">
    <span>Total Bayar</span><span>Rp ${formatNum(totalPaid)}</span>
  </div>`;
    }
  }

  receipt += `
  <div style="display: flex; justify-content: space-between;">
    <span>Kembali</span><span>Rp ${formatNum(data.change)}</span>
  </div>`;

  if (showPointInfo && data.promos && data.promos.length > 0) {
    receipt += `
  <div style="text-align: center; margin-top: 4px;">${dash}</div>
  <div style="text-align: center; font-size: 10px; font-style: italic;">
    Promo: ${data.promos.join(", ")}
  </div>`;
  }

  receipt += `
  <div style="text-align: center; margin-top: 8px; font-size: 10px;">${dash}</div>
  <div style="text-align: center; font-size: 10px; white-space: pre-line;">${footerText}</div>
  ${thankYouMessage ? `<div style="text-align: center; font-size: 10px; margin-top: 4px; font-weight: 600;">${thankYouMessage}</div>` : ""}
</div>`;

  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Receipt ${data.invoiceNumber}</title>
    <style>
      @media print { body { margin: 0; } @page { margin: 0; size: ${paperWidth}mm auto; } }
      body { margin: 0; padding: 0; }
    </style>
    </head>
    <body>${receipt}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}
