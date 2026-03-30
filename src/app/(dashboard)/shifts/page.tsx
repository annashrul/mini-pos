import { shiftsService } from "@/features/shifts";
import { ShiftsContent } from "@/features/shifts";

export default async function ShiftsPage() {
  const [data, activeShift] = await Promise.all([shiftsService.getShifts(), shiftsService.getActiveShift()]);
  return <ShiftsContent initialData={data} activeShift={activeShift} />;
}
