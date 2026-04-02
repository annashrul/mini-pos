import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { posSessionSetupSchema } from "../schemas";
import type { PosSessionSetupValues } from "../types";

export function usePosSessionSetupForm() {
  return useForm<PosSessionSetupValues>({
    resolver: zodResolver(posSessionSetupSchema),
    defaultValues: {
      branchId: "",
      register: "",
      openingCash: "0",
    },
  });
}
