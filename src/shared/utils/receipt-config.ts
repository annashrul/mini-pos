export interface ReceiptConfig {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  headerText: string;
  footerText: string;
  showLogo: boolean;
  paperWidth: number;
  showPointInfo: boolean;
  showCashierName: boolean;
  showDateTime: boolean;
  showPaymentMethod: boolean;
  thankYouMessage: string;
}

export const RECEIPT_DEFAULTS: ReceiptConfig = {
  storeName: "POS MINIMARKET",
  storeAddress: "",
  storePhone: "",
  headerText: "",
  footerText: "Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat dikembalikan\nkecuali ada kesepakatan.",
  showLogo: false,
  paperWidth: 80,
  showPointInfo: true,
  showCashierName: true,
  showDateTime: true,
  showPaymentMethod: true,
  thankYouMessage: "Terima kasih, selamat berbelanja kembali!",
};
