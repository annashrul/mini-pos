"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getWhatsAppLink } from "@/server/actions/whatsapp-receipt";
import { WhatsAppPhoneDialog } from "./whatsapp-phone-dialog";

interface SendWhatsAppButtonProps {
  transactionId: string;
  customerPhone?: string | null;
  variant?: "default" | "outline" | "ghost" | "sm";
  className?: string;
}

export function SendWhatsAppButton({
  transactionId,
  customerPhone,
  variant,
  className,
}: SendWhatsAppButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function sendReceipt(phone: string) {
    setLoading(true);
    try {
      const result = await getWhatsAppLink(phone, transactionId);
      if (result.error || !result.data) {
        toast.error(result.error || "Gagal membuat link WhatsApp");
        return;
      }
      window.open(result.data, "_blank", "noopener,noreferrer");
      setDialogOpen(false);
      toast.success("Membuka WhatsApp...");
    } catch {
      toast.error("Terjadi kesalahan saat membuat struk");
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (customerPhone) {
      sendReceipt(customerPhone);
    } else {
      setDialogOpen(true);
    }
  }

  const isSmall = variant === "sm";

  return (
    <>
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        size={isSmall ? "sm" : "default"}
        className={
          className ??
          "bg-green-600 hover:bg-green-700 text-white"
        }
      >
        {loading ? (
          <>
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {isSmall ? "..." : "Mengirim..."}
          </>
        ) : (
          <>
            <MessageCircle className="mr-2 h-4 w-4" />
            {isSmall ? "WhatsApp" : "Kirim via WhatsApp"}
          </>
        )}
      </Button>

      <WhatsAppPhoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={sendReceipt}
        loading={loading}
      />
    </>
  );
}
