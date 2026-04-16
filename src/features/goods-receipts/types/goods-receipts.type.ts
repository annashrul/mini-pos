export type GoodsReceiptListItem = {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrder: {
    orderNumber: string;
    supplier: { name: string };
    totalAmount: number;
    status: string;
  };
  branch: { name: string } | null;
  receivedByName: string | null;
  notes: string | null;
  receivedAt: Date | string;
  _count: { items: number };
};

export type GoodsReceiptDetail = {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrder: {
    orderNumber: string;
    orderDate: Date | string;
    status: string;
    totalAmount: number;
    supplier: { name: string; contact: string | null; address: string | null };
  };
  branch: { name: string } | null;
  receivedBy: string | null;
  receivedByName: string | null;
  notes: string | null;
  receivedAt: Date | string;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantityOrdered: number;
    quantityReceived: number;
    notes: string | null;
  }[];
};
