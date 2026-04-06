"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

const REVALIDATE_PATH = "/employee-schedules";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function getWeekSchedule(
  weekStart: string,
  branchId?: string,
) {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 7);

  const where: Record<string, unknown> = {
    date: { gte: start, lt: end },
  };
  if (branchId) where.branchId = branchId;

  const schedules = await prisma.employeeSchedule.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { date: "asc" }],
  });

  // Get all active users for schedule grid
  const userWhere: Record<string, unknown> = { isActive: true };
  if (branchId) userWhere.branchId = branchId;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  // Group schedules by userId then by date
  const scheduleMap: Record<string, Record<string, typeof schedules[number]>> = {};
  for (const s of schedules) {
    if (!scheduleMap[s.userId]) scheduleMap[s.userId] = {};
    const dateKey = s.date.toISOString().slice(0, 10);
    scheduleMap[s.userId]![dateKey] = s;
  }

  // Build week days array
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(start, i).toISOString().slice(0, 10));
  }

  const rows = users.map((user) => ({
    user,
    slots: weekDays.map((day) => scheduleMap[user.id]?.[day] ?? null),
  }));

  return { rows, weekDays, weekStart: start.toISOString() };
}

export async function getMonthSchedule(
  year: number,
  month: number,
  branchId?: string,
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const where: Record<string, unknown> = {
    date: { gte: start, lt: end },
  };
  if (branchId) where.branchId = branchId;

  const schedules = await prisma.employeeSchedule.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: "asc" },
  });

  // Group by date
  const byDate: Record<string, typeof schedules> = {};
  for (const s of schedules) {
    const dateKey = s.date.toISOString().slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey]!.push(s);
  }

  return { byDate, year, month };
}

export async function createSchedule(data: {
  userId: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  shiftLabel?: string | undefined;
  branchId?: string | undefined;
  notes?: string | undefined;
  status?: string | undefined;
}) {
  await assertMenuActionAccess("employee-schedules", "create");
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak terautentikasi" };

  try {
    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);

    const result = await prisma.employeeSchedule.upsert({
      where: {
        userId_date: {
          userId: data.userId,
          date: dateObj,
        },
      },
      update: {
        shiftStart: data.shiftStart,
        shiftEnd: data.shiftEnd,
        shiftLabel: data.shiftLabel || null,
        branchId: data.branchId || null,
        notes: data.notes || null,
        status: data.status || "SCHEDULED",
      },
      create: {
        userId: data.userId,
        date: dateObj,
        shiftStart: data.shiftStart,
        shiftEnd: data.shiftEnd,
        shiftLabel: data.shiftLabel || null,
        branchId: data.branchId || null,
        notes: data.notes || null,
        status: data.status || "SCHEDULED",
        createdBy: session.user.id,
      },
    });

    createAuditLog({
      action: "CREATE",
      entity: "EmployeeSchedule",
      entityId: result.id,
      details: { userId: data.userId, date: data.date, shift: `${data.shiftStart}-${data.shiftEnd}` },
    }).catch(() => {});

    revalidatePath(REVALIDATE_PATH);
    return { success: true, schedule: result };
  } catch (e) {
    console.error("createSchedule error:", e);
    return { error: "Gagal menyimpan jadwal" };
  }
}

export async function bulkCreateSchedule(
  entries: {
    userId: string;
    date: string;
    shiftStart: string;
    shiftEnd: string;
    shiftLabel?: string;
    branchId?: string;
    notes?: string;
  }[],
) {
  await assertMenuActionAccess("employee-schedules", "create");
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak terautentikasi" };

  try {
    let created = 0;
    for (const entry of entries) {
      const dateObj = new Date(entry.date);
      dateObj.setHours(0, 0, 0, 0);

      await prisma.employeeSchedule.upsert({
        where: {
          userId_date: {
            userId: entry.userId,
            date: dateObj,
          },
        },
        update: {
          shiftStart: entry.shiftStart,
          shiftEnd: entry.shiftEnd,
          shiftLabel: entry.shiftLabel || null,
          branchId: entry.branchId || null,
          notes: entry.notes || null,
        },
        create: {
          userId: entry.userId,
          date: dateObj,
          shiftStart: entry.shiftStart,
          shiftEnd: entry.shiftEnd,
          shiftLabel: entry.shiftLabel || null,
          branchId: entry.branchId || null,
          notes: entry.notes || null,
          status: "SCHEDULED",
          createdBy: session.user.id,
        },
      });
      created++;
    }

    createAuditLog({
      action: "BULK_CREATE",
      entity: "EmployeeSchedule",
      details: { count: created },
    }).catch(() => {});

    revalidatePath(REVALIDATE_PATH);
    return { success: true, count: created };
  } catch (e) {
    console.error("bulkCreateSchedule error:", e);
    return { error: "Gagal menyimpan jadwal massal" };
  }
}

export async function updateScheduleStatus(
  id: string,
  status: string,
  notes?: string,
) {
  await assertMenuActionAccess("employee-schedules", "update");

  try {
    const updated = await prisma.employeeSchedule.update({
      where: { id },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    createAuditLog({
      action: "UPDATE_STATUS",
      entity: "EmployeeSchedule",
      entityId: id,
      details: { status, notes },
    }).catch(() => {});

    revalidatePath(REVALIDATE_PATH);
    return { success: true, schedule: updated };
  } catch (e) {
    console.error("updateScheduleStatus error:", e);
    return { error: "Gagal memperbarui status" };
  }
}

export async function deleteSchedule(id: string) {
  await assertMenuActionAccess("employee-schedules", "delete");

  try {
    await prisma.employeeSchedule.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entity: "EmployeeSchedule",
      entityId: id,
    }).catch(() => {});

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (e) {
    console.error("deleteSchedule error:", e);
    return { error: "Gagal menghapus jadwal" };
  }
}

export async function copyWeekSchedule(
  fromWeekStart: string,
  toWeekStart: string,
  branchId?: string,
) {
  await assertMenuActionAccess("employee-schedules", "create");
  const session = await auth();
  if (!session?.user?.id) return { error: "Tidak terautentikasi" };

  try {
    const fromStart = new Date(fromWeekStart);
    fromStart.setHours(0, 0, 0, 0);
    const fromEnd = addDays(fromStart, 7);

    const toStart = new Date(toWeekStart);
    toStart.setHours(0, 0, 0, 0);

    const dayDiff = Math.round(
      (toStart.getTime() - fromStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const where: Record<string, unknown> = {
      date: { gte: fromStart, lt: fromEnd },
    };
    if (branchId) where.branchId = branchId;

    const source = await prisma.employeeSchedule.findMany({ where });

    let copied = 0;
    for (const s of source) {
      const newDate = addDays(s.date, dayDiff);
      newDate.setHours(0, 0, 0, 0);

      await prisma.employeeSchedule.upsert({
        where: {
          userId_date: {
            userId: s.userId,
            date: newDate,
          },
        },
        update: {
          shiftStart: s.shiftStart,
          shiftEnd: s.shiftEnd,
          shiftLabel: s.shiftLabel,
          branchId: s.branchId,
          notes: s.notes,
        },
        create: {
          userId: s.userId,
          date: newDate,
          shiftStart: s.shiftStart,
          shiftEnd: s.shiftEnd,
          shiftLabel: s.shiftLabel,
          branchId: s.branchId,
          notes: s.notes,
          status: "SCHEDULED",
          createdBy: session.user.id,
        },
      });
      copied++;
    }

    createAuditLog({
      action: "COPY_WEEK",
      entity: "EmployeeSchedule",
      details: { from: fromWeekStart, to: toWeekStart, count: copied },
    }).catch(() => {});

    revalidatePath(REVALIDATE_PATH);
    return { success: true, count: copied };
  } catch (e) {
    console.error("copyWeekSchedule error:", e);
    return { error: "Gagal menyalin jadwal minggu" };
  }
}

export async function getScheduleStats(
  weekStart: string,
  branchId?: string,
) {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 7);

  const where: Record<string, unknown> = {
    date: { gte: start, lt: end },
  };
  if (branchId) where.branchId = branchId;

  const schedules = await prisma.employeeSchedule.findMany({
    where,
    select: { status: true, userId: true },
  });

  const userWhere: Record<string, unknown> = { isActive: true };
  if (branchId) userWhere.branchId = branchId;
  const totalUsers = await prisma.user.count({ where: userWhere });

  const scheduledUserIds = new Set(schedules.map((s) => s.userId));

  return {
    totalScheduled: schedules.filter((s) => s.status === "SCHEDULED").length,
    confirmed: schedules.filter((s) => s.status === "CONFIRMED").length,
    absent: schedules.filter((s) => s.status === "ABSENT").length,
    leave: schedules.filter((s) => s.status === "LEAVE").length,
    totalEntries: schedules.length,
    totalUsers,
    unscheduledUsers: totalUsers - scheduledUserIds.size,
  };
}

export async function getUsers(branchId?: string) {
  const where: Record<string, unknown> = { isActive: true };
  if (branchId) where.branchId = branchId;

  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}
