"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import {
    getWeekSchedule,
    getMonthSchedule,
    getScheduleStats,
    createSchedule,
    deleteSchedule,
    copyWeekSchedule,
    getUsers,
} from "@/server/actions/employee-schedules";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { ScheduleDialog } from "./schedule-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ActionConfirmDialog,
} from "@/components/ui/action-confirm-dialog";
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    CalendarDays,
    Plus,
    Copy,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    Palmtree,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { ProButton } from "@/components/ui/pro-gate";

type WeekData = Awaited<ReturnType<typeof getWeekSchedule>>;
type MonthData = Awaited<ReturnType<typeof getMonthSchedule>>;
type StatsData = Awaited<ReturnType<typeof getScheduleStats>>;
type UserOption = Awaited<ReturnType<typeof getUsers>>[number];

type ScheduleSlot = WeekData["rows"][number]["slots"][number];

const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Pagi: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    Siang: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    Malam: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

const STATUS_COLORS: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-600",
    CONFIRMED: "bg-green-100 text-green-700",
    ABSENT: "bg-red-100 text-red-700",
    LEAVE: "bg-yellow-100 text-yellow-700",
};

const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: "Terjadwal",
    CONFIRMED: "Dikonfirmasi",
    ABSENT: "Tidak Hadir",
    LEAVE: "Cuti",
};

function getShiftColor(label: string | null) {
    return SHIFT_COLORS[label || ""] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
}

function getMondayOfWeek(date: Date): Date {
    return startOfWeek(date, { weekStartsOn: 1 });
}

export function EmployeeSchedulesContent() {
    const [view, setView] = useState<"week" | "month">("week");
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

    const [weekData, setWeekData] = useState<WeekData | null>(null);
    const [monthData, setMonthData] = useState<MonthData | null>(null);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, startTransition] = useTransition();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogDate, setDialogDate] = useState<string>("");
    const [dialogUserId, setDialogUserId] = useState<string>("");
    const [dialogExisting, setDialogExisting] = useState<ScheduleSlot>(null);

    const [copyDialogOpen, setCopyDialogOpen] = useState(false);
    const [fabOpen, setFabOpen] = useState(false);

    const { canAction } = useMenuActionAccess("employee-schedules");
    const { canAction: canPlanAction } = usePlanAccess();
    const canCreate = canAction("create") && canPlanAction("employee-schedules", "create");
    const canUpdate = canAction("update") && canPlanAction("employee-schedules", "update");
    const canDelete = canAction("delete") && canPlanAction("employee-schedules", "delete");
    const canEdit = canCreate || canUpdate;

    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    const fetchWeek = useCallback(() => {
        startTransition(async () => {
            const branchFilter = selectedBranchId || undefined;
            const weekStr = currentWeekStart.toISOString().slice(0, 10);
            const [wData, sData, uData] = await Promise.all([
                getWeekSchedule(weekStr, branchFilter),
                getScheduleStats(weekStr, branchFilter),
                getUsers(branchFilter),
            ]);
            setWeekData(wData);
            setStats(sData);
            setUsers(uData);
        });
    }, [currentWeekStart, selectedBranchId]);

    const fetchMonth = useCallback(() => {
        startTransition(async () => {
            const branchFilter = selectedBranchId || undefined;
            const [mData, uData] = await Promise.all([
                getMonthSchedule(currentYear, currentMonth, branchFilter),
                getUsers(branchFilter),
            ]);
            setMonthData(mData);
            setUsers(uData);
        });
    }, [currentYear, currentMonth, selectedBranchId]);

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
        }
        if (view === "week") fetchWeek();
        else fetchMonth();
    }, [branchReady, view, fetchWeek, fetchMonth, selectedBranchId]);

    // Navigation
    function goToPrevWeek() { setCurrentWeekStart((d) => subWeeks(d, 1)); }
    function goToNextWeek() { setCurrentWeekStart((d) => addWeeks(d, 1)); }
    function goToToday() { setCurrentWeekStart(getMondayOfWeek(new Date())); }

    function goToPrevMonth() {
        if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12); }
        else setCurrentMonth((m) => m - 1);
    }
    function goToNextMonth() {
        if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1); }
        else setCurrentMonth((m) => m + 1);
    }

    // Cell click handlers
    function handleCellClick(userId: string, dateStr: string, slot: ScheduleSlot) {
        if (slot) {
            setDialogExisting(slot);
            setDialogUserId(userId);
            setDialogDate(dateStr);
        } else {
            setDialogExisting(null);
            setDialogUserId(userId);
            setDialogDate(dateStr);
        }
        setDialogOpen(true);
    }

    function handleAddNew() {
        setDialogExisting(null);
        setDialogUserId("");
        setDialogDate("");
        setDialogOpen(true);
    }

    async function handleSave(data: {
        userId: string;
        date: string;
        shiftStart: string;
        shiftEnd: string;
        shiftLabel?: string | undefined;
        branchId?: string | undefined;
        notes?: string | undefined;
        status?: string | undefined;
    }) {
        const result = await createSchedule(data);
        if (result.error) {
            toast.error(result.error);
            throw new Error(result.error);
        }
        toast.success("Jadwal berhasil disimpan");
        if (view === "week") fetchWeek();
        else fetchMonth();
    }

    async function handleDelete(id: string) {
        const result = await deleteSchedule(id);
        if (result.error) {
            toast.error(result.error);
            throw new Error(result.error);
        }
        toast.success("Jadwal berhasil dihapus");
        if (view === "week") fetchWeek();
        else fetchMonth();
    }

    async function handleCopyWeek() {
        const fromStr = currentWeekStart.toISOString().slice(0, 10);
        const toDate = addWeeks(currentWeekStart, 1);
        const toStr = toDate.toISOString().slice(0, 10);
        const result = await copyWeekSchedule(fromStr, toStr, selectedBranchId || undefined);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success(`${result.count} jadwal berhasil disalin ke minggu depan`);
            setCopyDialogOpen(false);
        }
    }

    // Week day headers
    const weekDays = weekData?.weekDays || [];
    const dayHeaders = weekDays.map((d) => {
        const date = new Date(d + "T00:00:00");
        return {
            dateStr: d,
            dayName: format(date, "EEE", { locale: idLocale }),
            dayNum: format(date, "d"),
            monthName: format(date, "MMM", { locale: idLocale }),
            isToday: d === new Date().toISOString().slice(0, 10),
        };
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
                        <CalendarDays className="h-4 w-4 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Jadwal Karyawan</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Kelola jadwal shift karyawan</p>
                    </div>
                </div>
                {/* Desktop: kept empty for layout */}
                <div className="sm:hidden" />
            </div>

            {/* View Toggle + Navigation + Actions */}
            <div className="flex items-center justify-between gap-2">
                {/* Left: View Toggle (+ Navigation on desktop) */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="inline-flex rounded-lg border bg-white p-0.5 shrink-0">
                        <button
                            onClick={() => setView("week")}
                            className={cn(
                                "rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors",
                                view === "week" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900",
                            )}
                        >
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 inline mr-1" />
                            <span className="hidden sm:inline">Mingguan</span>
                            <span className="sm:hidden">Mgg</span>
                        </button>
                        <button
                            onClick={() => setView("month")}
                            className={cn(
                                "rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors",
                                view === "month" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900",
                            )}
                        >
                            <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 inline mr-1" />
                            <span className="hidden sm:inline">Bulanan</span>
                            <span className="sm:hidden">Bln</span>
                        </button>
                    </div>

                    {/* Navigation - desktop only (inline with toggle) */}
                    <div className="hidden sm:flex items-center gap-2">
                        {view === "week" ? (
                            <>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevWeek}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8 px-3">
                                    Hari Ini
                                </Button>
                                <span className="text-sm font-medium text-center whitespace-nowrap">
                                    {format(currentWeekStart, "d MMM", { locale: idLocale })} - {format(addDays(currentWeekStart, 6), "d MMM", { locale: idLocale })}
                                </span>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium text-center whitespace-nowrap">
                                    {format(new Date(currentYear, currentMonth - 1, 1), "MMMM yyyy", { locale: idLocale })}
                                </span>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Right: Navigation on mobile, Action buttons on desktop */}
                <div className="sm:hidden flex items-center gap-1">
                    {view === "week" ? (
                        <>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToPrevWeek}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] font-medium text-center whitespace-nowrap">
                                {format(currentWeekStart, "d MMM", { locale: idLocale })} - {format(addDays(currentWeekStart, 6), "d MMM", { locale: idLocale })}
                            </span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToNextWeek}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToPrevMonth}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] font-medium text-center whitespace-nowrap">
                                {format(new Date(currentYear, currentMonth - 1, 1), "MMM yyyy", { locale: idLocale })}
                            </span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    )}
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    {view === "week" && (
                        <DisabledActionTooltip disabled={!canCreate} message="Anda tidak memiliki akses" menuKey="employee-schedules" actionKey="create">
                            <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(true)} disabled={!canCreate} className="gap-1.5 h-9 px-3 text-sm rounded-xl">
                                <Copy className="h-4 w-4" />
                                Salin Minggu
                            </Button>
                        </DisabledActionTooltip>
                    )}
                    <ExportMenu module="employee-schedules" branchId={selectedBranchId || undefined} />
                    <DisabledActionTooltip disabled={!canCreate} message="Anda tidak memiliki akses" menuKey="employee-schedules" actionKey="create">
                        <Button size="sm" onClick={handleAddNew} disabled={!canCreate} className="gap-1.5 h-9 px-3 text-sm rounded-xl shadow-md shadow-primary/20">
                            <Plus className="h-4 w-4" />
                            Tambah Jadwal
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            {/* Stats Bar */}
            {view === "week" && stats && (
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0 sm:flex-wrap">
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-100 shrink-0">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[11px] sm:text-xs font-medium font-mono tabular-nums">{stats.totalEntries}</span>
                        <span className="text-[11px] sm:text-xs">Jadwal</span>
                    </div>
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-100 shrink-0">
                        <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[11px] sm:text-xs font-medium font-mono tabular-nums">{stats.confirmed}</span>
                        <span className="text-[11px] sm:text-xs hidden sm:inline">Dikonfirmasi</span>
                    </div>
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-100 shrink-0">
                        <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[11px] sm:text-xs font-medium font-mono tabular-nums">{stats.absent}</span>
                        <span className="text-[11px] sm:text-xs hidden sm:inline">Tidak Hadir</span>
                    </div>
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100 shrink-0">
                        <Palmtree className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[11px] sm:text-xs font-medium font-mono tabular-nums">{stats.leave}</span>
                        <span className="text-[11px] sm:text-xs">Cuti</span>
                    </div>
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-200 shrink-0">
                        <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[11px] sm:text-xs font-medium font-mono tabular-nums">{stats.unscheduledUsers}</span>
                        <span className="text-[11px] sm:text-xs hidden sm:inline">Belum Dijadwal</span>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading && !weekData && !monthData ? (
                <ScheduleSkeleton />
            ) : view === "week" ? (
                <WeeklyGrid
                    data={weekData}
                    dayHeaders={dayHeaders}
                    onCellClick={handleCellClick}
                    canEdit={canEdit}
                    loading={loading}
                />
            ) : (
                <MonthlyCalendar
                    data={monthData}
                    year={currentYear}
                    month={currentMonth}
                    onDayClick={(dateStr) => {
                        setDialogExisting(null);
                        setDialogUserId("");
                        setDialogDate(dateStr);
                        setDialogOpen(true);
                    }}
                />
            )}

            {/* Schedule Dialog */}
            <ScheduleDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleSave}
                onDelete={canDelete ? handleDelete : undefined}
                users={users}
                initialDate={dialogDate}
                initialUserId={dialogUserId}
                existing={dialogExisting}
                branchId={selectedBranchId || undefined}
            />

            <ActionConfirmDialog
                open={copyDialogOpen}
                onOpenChange={setCopyDialogOpen}
                kind="submit"
                title="Salin Jadwal Minggu Ini?"
                description={`Semua jadwal dari minggu ${format(currentWeekStart, "d MMM", { locale: idLocale })} - ${format(addDays(currentWeekStart, 6), "d MMM", { locale: idLocale })} akan disalin ke minggu ${format(addWeeks(currentWeekStart, 1), "d MMM", { locale: idLocale })} - ${format(addDays(addWeeks(currentWeekStart, 1), 6), "d MMM", { locale: idLocale })}. Jadwal pada minggu tujuan akan ditimpa.`}
                confirmLabel="Salin Jadwal"
                confirmDisabled={!canCreate}
                onConfirm={handleCopyWeek}
                size="sm"
            />

            {/* Mobile: Expandable FAB */}
            <div className="sm:hidden fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
                {/* Expanded options */}
                {fabOpen && (
                    <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black/20 -z-10" onClick={() => setFabOpen(false)} />
                        {view === "week" && (
                            <Button
                                variant="outline"
                                onClick={() => { setFabOpen(false); setCopyDialogOpen(true); }}
                                className="rounded-full shadow-lg bg-white gap-1.5 h-10 px-4 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Salin Minggu
                            </Button>
                        )}
                        <Button
                            onClick={() => { setFabOpen(false); handleAddNew(); }}
                            className="rounded-full shadow-lg gap-1.5 h-10 px-4 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Tambah Jadwal
                        </Button>
                    </>
                )}
                {/* Main FAB */}
                <ProButton
                    menuKey="employee-schedules"
                    actionKey="create"
                    onClick={() => setFabOpen(!fabOpen)}
                    className={cn(
                        "h-12 w-12 rounded-full shadow-xl shadow-primary/30 bg-gradient-to-br from-primary to-primary/80 transition-transform duration-200 inline-flex items-center justify-center text-white",
                        fabOpen && "rotate-45"
                    )}
                >
                    <Plus className="w-5 h-5" />
                </ProButton>
            </div>
        </div>
    );
}

/* ========== Weekly Grid ========== */
function WeeklyGrid({
    data,
    dayHeaders,
    onCellClick,
    canEdit,
    loading,
}: {
    data: WeekData | null;
    dayHeaders: { dateStr: string; dayName: string; dayNum: string; monthName: string; isToday: boolean }[];
    onCellClick: (userId: string, dateStr: string, slot: ScheduleSlot) => void;
    canEdit: boolean;
    loading: boolean;
}) {
    if (!data) return <ScheduleSkeleton />;

    return (
        <Card className={cn("overflow-hidden border shadow-sm rounded-xl sm:rounded-2xl", loading && "opacity-60 pointer-events-none")}>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <div
                        className="grid min-w-[600px] sm:min-w-[800px]"
                        style={{ gridTemplateColumns: "140px repeat(7, 1fr)" }}
                    >
                        {/* Header row */}
                        <div className="sticky left-0 z-10 bg-gray-50 border-b border-r px-2 sm:px-4 py-2 sm:py-3 flex items-center">
                            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Karyawan
                            </span>
                        </div>
                        {dayHeaders.map((day) => (
                            <div
                                key={day.dateStr}
                                className={cn(
                                    "border-b px-1 sm:px-2 py-1.5 sm:py-3 text-center",
                                    day.isToday ? "bg-indigo-50" : "bg-gray-50",
                                )}
                            >
                                <div className={cn(
                                    "text-[10px] sm:text-xs font-medium uppercase",
                                    day.isToday ? "text-indigo-600" : "text-gray-500",
                                )}>
                                    {day.dayName}
                                </div>
                                <div className={cn(
                                    "text-sm sm:text-lg font-bold",
                                    day.isToday ? "text-indigo-700" : "text-gray-900",
                                )}>
                                    {day.dayNum}
                                </div>
                                <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase">{day.monthName}</div>
                            </div>
                        ))}

                        {/* Data rows */}
                        {data.rows.length === 0 ? (
                            <div className="col-span-8 py-10 sm:py-16 text-center text-muted-foreground">
                                <Users className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 text-gray-300" />
                                <p className="text-xs sm:text-sm font-medium">Belum ada karyawan</p>
                                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Tambahkan karyawan untuk mulai membuat jadwal</p>
                            </div>
                        ) : (
                            data.rows.map((row) => (
                                <EmployeeRow
                                    key={row.user.id}
                                    user={row.user}
                                    slots={row.slots}
                                    weekDays={data.weekDays}
                                    dayHeaders={dayHeaders}
                                    onCellClick={onCellClick}
                                    canEdit={canEdit}
                                />
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EmployeeRow({
    user,
    slots,
    weekDays,
    dayHeaders,
    onCellClick,
    canEdit,
}: {
    user: { id: string; name: string | null; email: string; role: string };
    slots: ScheduleSlot[];
    weekDays: string[];
    dayHeaders: { dateStr: string; isToday: boolean }[];
    onCellClick: (userId: string, dateStr: string, slot: ScheduleSlot) => void;
    canEdit: boolean;
}) {
    return (
        <>
            {/* Employee name cell */}
            <div className="sticky left-0 z-10 bg-white border-b border-r px-2 sm:px-4 py-1.5 sm:py-2.5 flex items-center gap-2 sm:gap-3">
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-[10px] sm:text-xs font-bold text-gray-600">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] sm:text-sm font-medium text-gray-900 truncate">
                        {user.name || user.email}
                    </div>
                    <div className="text-[9px] sm:text-[11px] text-gray-400">{user.role}</div>
                </div>
            </div>

            {/* Schedule cells */}
            {slots.map((slot, idx) => {
                const dateStr = weekDays[idx] ?? "";
                const isToday = dayHeaders[idx]?.isToday;

                return (
                    <div
                        key={dateStr || idx}
                        className={cn(
                            "border-b px-0.5 sm:px-1.5 py-1 sm:py-1.5 min-h-[48px] sm:min-h-[64px] flex items-center justify-center transition-colors",
                            isToday ? "bg-indigo-50/40" : "bg-white",
                            (canEdit) && "cursor-pointer hover:bg-gray-50",
                        )}
                        onClick={() => dateStr && (canEdit) && onCellClick(user.id, dateStr, slot)}
                    >
                        {slot ? (
                            <ScheduleCell slot={slot} />
                        ) : canEdit ? (
                            <div className="flex items-center justify-center w-full h-full opacity-0 hover:opacity-100 transition-opacity">
                                <div className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-md sm:rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                                    <Plus className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </>
    );
}

function ScheduleCell({ slot }: { slot: NonNullable<ScheduleSlot> }) {
    const colors = getShiftColor(slot.shiftLabel);
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "w-full rounded-md sm:rounded-lg border px-1 sm:px-2 py-1 sm:py-1.5 text-center transition-shadow hover:shadow-md",
                            colors.bg,
                            colors.border,
                        )}
                    >
                        <div className={cn("text-[9px] sm:text-[11px] font-bold leading-tight", colors.text)}>
                            {slot.shiftLabel || "Shift"}
                        </div>
                        <div className={cn("text-[8px] sm:text-[10px] font-medium leading-tight", colors.text, "opacity-75")}>
                            {slot.shiftStart}-{slot.shiftEnd}
                        </div>
                        {slot.status !== "SCHEDULED" && (
                            <div className={cn("mt-0.5 inline-block rounded-full px-1 sm:px-1.5 py-0 sm:py-0.5 text-[7px] sm:text-[9px] font-semibold", STATUS_COLORS[slot.status])}>
                                {STATUS_LABELS[slot.status] || slot.status}
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    <p className="font-medium">{slot.shiftLabel || "Shift"}: {slot.shiftStart} - {slot.shiftEnd}</p>
                    <p>Status: {STATUS_LABELS[slot.status] || slot.status}</p>
                    {slot.notes && <p className="text-muted-foreground mt-1">{slot.notes}</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ========== Monthly Calendar ========== */
function MonthlyCalendar({
    data,
    year,
    month,
    onDayClick,
}: {
    data: MonthData | null;
    year: number;
    month: number;
    onDayClick: (dateStr: string) => void;
}) {
    if (!data) return <ScheduleSkeleton />;

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday=0
    const totalDays = lastDay.getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    const dayNames = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

    const cells: { day: number | null; dateStr: string }[] = [];
    // Padding before
    for (let i = 0; i < startDayOfWeek; i++) cells.push({ day: null, dateStr: "" });
    // Actual days
    for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        cells.push({ day: d, dateStr });
    }

    return (
        <Card className="overflow-hidden border shadow-sm rounded-xl sm:rounded-2xl">
            <CardContent className="p-1.5 sm:p-4">
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {/* Day name headers */}
                    {dayNames.map((name) => (
                        <div key={name} className="text-center text-[10px] sm:text-xs font-semibold text-gray-500 uppercase py-1 sm:py-2">
                            {name}
                        </div>
                    ))}

                    {/* Calendar cells */}
                    {cells.map((cell, idx) => {
                        if (cell.day === null) {
                            return <div key={`empty-${idx}`} className="h-14 sm:h-20" />;
                        }

                        const entries = data.byDate[cell.dateStr] || [];
                        const isToday = cell.dateStr === todayStr;
                        const hasSchedules = entries.length > 0;

                        return (
                            <button
                                key={cell.dateStr}
                                onClick={() => onDayClick(cell.dateStr)}
                                className={cn(
                                    "h-14 sm:h-20 rounded-lg sm:rounded-xl border p-1 sm:p-1.5 text-left transition-all hover:shadow-md hover:border-indigo-300",
                                    isToday ? "border-indigo-400 bg-indigo-50/50" : "border-gray-100 bg-white",
                                    hasSchedules && "ring-1 ring-indigo-100",
                                )}
                            >
                                <div className={cn(
                                    "text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1",
                                    isToday ? "text-indigo-700" : "text-gray-700",
                                )}>
                                    {cell.day}
                                </div>
                                {hasSchedules && (
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[10px] font-medium text-indigo-600">
                                            <Users className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                            {entries.length}
                                        </div>
                                        <div className="flex gap-0.5 flex-wrap">
                                            {entries.slice(0, 3).map((e) => {
                                                const c = getShiftColor(e.shiftLabel);
                                                return (
                                                    <div
                                                        key={e.id}
                                                        className={cn("h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full", c.bg === "bg-blue-50" ? "bg-blue-400" : c.bg === "bg-amber-50" ? "bg-amber-400" : c.bg === "bg-purple-50" ? "bg-purple-400" : "bg-gray-400")}
                                                    />
                                                );
                                            })}
                                            {entries.length > 3 && (
                                                <span className="text-[7px] sm:text-[9px] text-gray-400">+{entries.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

/* ========== Skeleton ========== */
function ScheduleSkeleton() {
    return (
        <Card className="overflow-hidden rounded-xl sm:rounded-2xl">
            <CardContent className="p-0">
                <div className="grid" style={{ gridTemplateColumns: "140px repeat(7, 1fr)" }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={`h-${i}`} className="bg-gray-50 border-b px-2 sm:px-4 py-2 sm:py-4">
                            <div className="h-3 sm:h-4 w-10 sm:w-16 bg-gray-200 rounded animate-pulse mx-auto" />
                        </div>
                    ))}
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={`c-${i}`} className="border-b px-1 sm:px-2 py-1.5 sm:py-3 min-h-[48px] sm:min-h-[64px]">
                            {i % 8 === 0 ? (
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gray-200 animate-pulse" />
                                    <div className="h-2.5 sm:h-3 w-16 sm:w-20 bg-gray-200 rounded animate-pulse" />
                                </div>
                            ) : Math.random() > 0.5 ? (
                                <div className="h-8 sm:h-10 w-full bg-gray-100 rounded-md sm:rounded-lg animate-pulse" />
                            ) : null}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
