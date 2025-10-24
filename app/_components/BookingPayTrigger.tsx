"use client";
import { useState } from "react";
import BookingPayModal from "./BookingPayModal";

export default function BookingPayTrigger({
  onConfirm,
  disabled,
  className,
  children
}:{ onConfirm: ()=>Promise<void>|void; disabled?: boolean; className?: string; children?: React.ReactNode }){
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={()=>setOpen(true)} disabled={disabled} className={className}>
        {children || "Confirm booking"}
      </button>
      <BookingPayModal
        open={open}
        onClose={()=>setOpen(false)}
        onPaid={onConfirm}
      />
    </>
  );
}
