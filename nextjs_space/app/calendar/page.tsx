"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, Check, X, Loader2, Clock, User, ChevronRight, LayoutList, CalendarDays } from "lucide-react";
import { toast } from "react-hot-toast";
import { format, isAfter, isBefore, isSameDay, startOfDay, differenceInDays } from "date-fns";
import { AbsenceTable } from "@/components/calendar/AbsenceTable";
import { AbsenceFilters } from "@/components/calendar/AbsenceFilters";

interface Absence {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  status: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    name?: string;
    department?: string | null;
  };
  createdAt: string;
}

type AbsenceCounts = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pendingAbsences, setPendingAbsences] = useState<Absence[]>([]);
  const [approvedAbsences, setApprovedAbsences] = useState<Absence[]>([]);
  const [rejectedAbsences, setRejectedAbsences] = useState<Absence[]>([]);
  const [calendarAbsences, setCalendarAbsences] = useState<Absence[]>([]);
  const [counts, setCounts] = useState<AbsenceCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingManagement, setIsLoadingManagement] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingTake, setPendingTake] = useState(500);
  const [approvedTake, setApprovedTake] = useState(25);
  const [rejectedTake, setRejectedTake] = useState(25);

  // New State for Admin Features
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [newAbsence, setNewAbsence] = useState({
    type: "vacation",
    startDate: "",
    endDate: "",
    isFullDay: true,
    startTime: "",
    endTime: "",
    reason: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetchAbsences();
  }, []);

  useEffect(() => {
    void fetchCalendarAbsences(visibleMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMonth]);

  const fetchCounts = async () => {
    try {
      const response = await fetch("/api/absences?includeCounts=true&take=0");
      if (response.status === 401) {
        router.replace("/auth/login");
        return;
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // ignore
      }

      if (!response.ok) {
        const msg = String(data?.error || "Failed to load absences");
        setLoadError(msg);
        toast.error(msg);
        return;
      }

      const c = data?.counts;
      if (c && typeof c === "object") {
        setCounts({
          pending: Number(c.pending || 0),
          approved: Number(c.approved || 0),
          rejected: Number(c.rejected || 0),
          total: Number(c.total || 0),
        });
      }
      setLoadError(null);
    } catch (error) {
      setLoadError("Failed to load absences");
      toast.error("Failed to load absences");
    }
  };

  const fetchManagementLists = async (opts?: { pendingTake?: number; approvedTake?: number; rejectedTake?: number }) => {
    const nextPendingTake = typeof opts?.pendingTake === "number" ? opts.pendingTake : pendingTake;
    const nextApprovedTake = typeof opts?.approvedTake === "number" ? opts.approvedTake : approvedTake;
    const nextRejectedTake = typeof opts?.rejectedTake === "number" ? opts.rejectedTake : rejectedTake;
    try {
      setIsLoadingManagement(true);
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch(`/api/absences?status=pending&take=${nextPendingTake}`),
        fetch(`/api/absences?status=approved&take=${nextApprovedTake}`),
        fetch(`/api/absences?status=rejected&take=${nextRejectedTake}`),
      ]);

      const [pendingData, approvedData, rejectedData] = await Promise.all([
        pendingRes.json().catch(() => ({})),
        approvedRes.json().catch(() => ({})),
        rejectedRes.json().catch(() => ({})),
      ]);

      if (!pendingRes.ok) throw new Error(pendingData?.error || "Failed to load pending");
      if (!approvedRes.ok) throw new Error(approvedData?.error || "Failed to load approved");
      if (!rejectedRes.ok) throw new Error(rejectedData?.error || "Failed to load rejected");

      setPendingAbsences(Array.isArray(pendingData?.absences) ? pendingData.absences : []);
      setApprovedAbsences(Array.isArray(approvedData?.absences) ? approvedData.absences : []);
      setRejectedAbsences(Array.isArray(rejectedData?.absences) ? rejectedData.absences : []);
      setLoadError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load absences";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingManagement(false);
    }
  };

  const fetchCalendarAbsences = async (month: Date) => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    const qs = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      take: "2000",
    });
    try {
      const res = await fetch(`/api/absences?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load calendar absences");
      setCalendarAbsences(Array.isArray(data?.absences) ? data.absences : []);
    } catch {
      setCalendarAbsences([]);
    }
  };

  const fetchAbsences = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchCounts(), fetchManagementLists(), fetchCalendarAbsences(visibleMonth)]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (absence: Absence) => {
    setEditingAbsence(absence);
    setNewAbsence({
      type: absence.type,
      startDate: new Date(absence.startDate).toISOString().split("T")[0],
      endDate: new Date(absence.endDate).toISOString().split("T")[0],
      isFullDay: absence.isFullDay,
      startTime: absence.startTime || "",
      endTime: absence.endTime || "",
      reason: absence.reason || "",
    });
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingAbsence(null);
      setNewAbsence({
        type: "vacation",
        startDate: "",
        endDate: "",
        isFullDay: true,
        startTime: "",
        endTime: "",
        reason: "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAbsence.startDate || !newAbsence.endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    try {
      const url = editingAbsence ? `/api/absences/${editingAbsence.id}` : "/api/absences";
      const method = editingAbsence ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAbsence),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingAbsence ? "Absence updated successfully" : "Absence request submitted");
        handleDialogChange(false);
        fetchAbsences();
      } else {
        throw new Error(data.error || "Failed to submit");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit absence request");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/absences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      if (response.ok) {
        toast.success("Absence approved");
        fetchAbsences();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast.error("Failed to approve absence");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/absences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });

      if (response.ok) {
        toast.success("Absence rejected");
        fetchAbsences();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast.error("Failed to reject absence");
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names?.map(n => n?.[0] || "").join("").toUpperCase().slice(0, 2) || "U";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: "Vacation",
      sick_leave: "Sick Leave",
      personal: "Personal"
    };
    return labels[type] || type;
  };

  const userRole = ((session?.user as any)?.role || "member").toLowerCase();
  const userDepartment = (session?.user as any)?.department || null;
  const isManagerOrAdmin = userRole === "admin" || userRole === "manager";
  const isAdmin = userRole === "admin";

  const canApproveAbsence = (absence: Absence) => {
    if (userRole === "admin") return true;
    if (userRole === "manager" && userDepartment && absence.user.department === userDepartment) return true;
    return false;
  };

  const approvedVisible = approvedAbsences;
  const rejectedVisible = rejectedAbsences;

  const toDayKey = (d: Date) => format(d, "yyyy-MM-dd");
  const isBetweenInclusive = (day: Date, start: Date, end: Date) => {
    const a = startOfDay(day);
    const s = startOfDay(start);
    const e = startOfDay(end);
    return isSameDay(a, s) || isSameDay(a, e) || (isAfter(a, s) && isBefore(a, e));
  };

  const approvedDayKeys = new Set<string>();
  const pendingDayKeys = new Set<string>();
  const rejectedDayKeys = new Set<string>();
  for (const absence of calendarAbsences) {
    const start = new Date(absence.startDate);
    const end = new Date(absence.endDate);
    for (let d = startOfDay(start); !isAfter(d, startOfDay(end)); d = new Date(d.getTime() + 86400000)) {
      const key = toDayKey(d);
      if (absence.status === "approved") approvedDayKeys.add(key);
      if (absence.status === "pending") pendingDayKeys.add(key);
      if (absence.status === "rejected") rejectedDayKeys.add(key);
    }
  }

  const absencesForSelectedDay = selectedDay
    ? calendarAbsences.filter((a) => isBetweenInclusive(selectedDay, new Date(a.startDate), new Date(a.endDate)))
    : [];

  // Filter logic for Table View
  const filteredAbsences = calendarAbsences.filter(a => {
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesType = typeFilter === 'all' || a.type === typeFilter;
    const searchLower = searchQuery.toLowerCase();
    const userName = a.user.name || `${a.user.firstName} ${a.user.lastName}`;
    const matchesSearch = !searchQuery ||
      userName.toLowerCase().includes(searchLower) ||
      a.user.email.toLowerCase().includes(searchLower);

    return matchesStatus && matchesType && matchesSearch;
  });

  const sickDaysCount = filteredAbsences
    .filter(a => a.type === 'sick_leave' && a.status === 'approved')
    .reduce((acc, curr) => {
      const start = new Date(curr.startDate);
      const end = new Date(curr.endDate);
      return acc + (differenceInDays(end, start) + 1);
    }, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-secondary">
      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loadError ? (
          <Card className="border-l-4 border-l-destructive mb-6">
            <CardHeader>
              <CardTitle>Calendar temporarily unavailable</CardTitle>
              <CardDescription>{loadError}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" onClick={() => fetchAbsences()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-1">Absence Management</h2>
            <p className="text-muted-foreground">Review and manage team absence requests</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="bg-white p-1 rounded-lg border shadow-sm flex items-center w-fit">
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                title="Calendar View"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Request Absence
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingAbsence ? "Edit Absence" : "Request Absence"}</DialogTitle>
                    <DialogDescription>
                      {editingAbsence ? `Modify absence request for ${editingAbsence.user.firstName}` : "Submit a new absence request for approval"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={newAbsence.type}
                        onValueChange={(value) => setNewAbsence({ ...newAbsence, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation">Vacation</SelectItem>
                          <SelectItem value="sick_leave">Sick Leave</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={newAbsence.startDate}
                        onChange={(e) => setNewAbsence({ ...newAbsence, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={newAbsence.endDate}
                        onChange={(e) => setNewAbsence({ ...newAbsence, endDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <Label htmlFor="isFullDay" className="cursor-pointer">Tutto il giorno</Label>
                      <Switch
                        id="isFullDay"
                        checked={newAbsence.isFullDay}
                        onCheckedChange={(checked) => setNewAbsence({ ...newAbsence, isFullDay: checked })}
                      />
                    </div>

                    {!newAbsence.isFullDay && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="startTime">Ora Inizio</Label>
                          <Input
                            id="startTime"
                            type="time"
                            value={newAbsence.startTime}
                            onChange={(e) => setNewAbsence({ ...newAbsence, startTime: e.target.value })}
                            required={!newAbsence.isFullDay}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="endTime">Ora Fine</Label>
                          <Input
                            id="endTime"
                            type="time"
                            value={newAbsence.endTime}
                            onChange={(e) => setNewAbsence({ ...newAbsence, endTime: e.target.value })}
                            required={!newAbsence.isFullDay}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="reason">Note / Dettagli (Opzionale)</Label>
                      <Textarea
                        id="reason"
                        value={newAbsence.reason}
                        onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })}
                        placeholder="Dettagli aggiuntivi..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90">
                      {editingAbsence ? "Update Request" : "Submit Request"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white border-l-4 border-l-warning shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Team Pending
                  </p>
                  <p className="text-4xl font-bold text-foreground mt-1">{counts.pending}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-7 w-7 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-l-success shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Team Approved
                  </p>
                  <p className="text-4xl font-bold text-foreground mt-1">{counts.approved}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-7 w-7 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-l-destructive shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Team Rejected
                  </p>
                  <p className="text-4xl font-bold text-foreground mt-1">{counts.rejected}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-7 w-7 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar and Details View */}
        {viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
            {/* Calendar Card */}
            <Card className="lg:col-span-8 shadow-md border-none overflow-hidden">
              <CardHeader className="bg-muted/50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Team Calendar</CardTitle>
                    <CardDescription>
                      Overview of all absence requests
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-success shadow-sm shadow-success/20" />
                      <span className="text-muted-foreground">Approved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-warning shadow-sm shadow-warning/20" />
                      <span className="text-muted-foreground">Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-destructive shadow-sm shadow-destructive/20" />
                      <span className="text-muted-foreground">Rejected</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-8">
                <Calendar
                  mode="single"
                  month={visibleMonth}
                  onMonthChange={(m) => setVisibleMonth(m)}
                  selected={selectedDay}
                  onSelect={(d) => setSelectedDay(d)}
                  className="w-full border rounded-md p-4 shadow-sm"
                  classNames={{
                    months: "w-full flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center",
                    month: "w-full space-y-6",
                    table: "w-full border-collapse",
                    head_row: "flex w-full justify-between mb-2",
                    head_cell: "text-muted-foreground rounded-md w-full font-semibold text-[0.85rem] flex-1 text-center py-2",
                    row: "flex w-full mt-1 justify-between",
                    cell: "relative h-16 w-full text-center text-sm p-0 focus-within:relative focus-within:z-20 flex-1 flex justify-center items-center rounded-xl transition-all duration-200",
                    day: "h-14 w-14 p-0 font-medium aria-selected:opacity-100 flex items-center justify-center rounded-2xl hover:bg-secondary/50 transition-all text-base",
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground border-2 border-primary/20",
                  }}
                  modifiers={{
                    approved: (date) => approvedDayKeys.has(toDayKey(date)),
                    pending: (date) => pendingDayKeys.has(toDayKey(date)),
                    rejected: (date) => rejectedDayKeys.has(toDayKey(date)),
                  }}
                  modifiersClassNames={{
                    approved: "bg-success/20 text-success font-bold hover:bg-success/30",
                    pending: "bg-warning/20 text-warning font-bold hover:bg-warning/30",
                    rejected: "bg-destructive/20 text-destructive font-bold hover:bg-destructive/30",
                  }}
                />
              </CardContent>
            </Card>

            {/* Details Card */}
            <Card className="lg:col-span-4 shadow-md border-none flex flex-col">
              <CardHeader className="bg-muted/50 border-b">
                <CardTitle className="text-xl">
                  {selectedDay ? format(selectedDay, "MMMM d, yyyy") : "Details"}
                </CardTitle>
                <CardDescription>
                  {selectedDay ? `${absencesForSelectedDay.length} requests on this day` : "Select a day to view details"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-1 overflow-auto max-h-[500px] space-y-4">
                {selectedDay && absencesForSelectedDay.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8 opacity-60">
                    <CalendarIcon className="h-12 w-14 mb-4 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground italic">No absences scheduled for this date.</p>
                  </div>
                ) : null}

                {selectedDay
                  ? absencesForSelectedDay.map((a) => (
                    <div key={a.id} className="group relative rounded-xl border p-4 hover:border-primary/30 transition-colors bg-secondary/5 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {getInitials(a.user.name || `${a.user.firstName} ${a.user.lastName}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate max-w-[140px]">
                              {a.user.name || `${a.user.firstName} ${a.user.lastName}`}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-tight">
                              {getTypeLabel(a.type)}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className="capitalize text-[10px] px-2 py-0 h-5"
                          variant={
                            a.status === "approved"
                              ? "success"
                              : a.status === "pending"
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {a.status}
                        </Badge>
                      </div>
                      <div className="pl-12 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(a.startDate)}</span>
                        <ChevronRight className="h-2 w-2" />
                        <span>{formatDate(a.endDate)}</span>
                      </div>
                      {a.reason && (
                        <p className="pl-12 mt-2 text-xs text-muted-foreground italic bg-secondary/30 p-2 rounded-lg">
                          &quot;{a.reason}&quot;
                        </p>
                      )}
                    </div>
                  ))
                  : null}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4 mb-12">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Attendance Report</CardTitle>
                    <CardDescription>Detailed view of absences for {format(visibleMonth, "MMMM yyyy")}</CardDescription>
                  </div>
                  {sickDaysCount > 0 && (
                    <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5">
                      Total Sick Days: {sickDaysCount}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <AbsenceFilters
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onClear={() => {
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setSearchQuery("");
                  }}
                />
                <AbsenceTable
                  absences={filteredAbsences}
                  isLoading={isLoading}
                  viewerRole={userRole}
                  viewerDepartment={userDepartment}
                  onEdit={handleEditClick}
                  onDelete={(id) => {
                    // TODO: Add delete confirmation? For now just handleReject or implement delete logic
                    // The original code uses buttons, here table uses actions.
                    // Let's reuse handleReject for now or verify if we need strict delete.
                    // The API has specific DELETE endpoint.
                    // Let's implement delete logic briefly here or use handleReject if appropriate?
                    // Actually let's use a simple delete fetch.
                    if (confirm("Are you sure you want to delete this absence?")) {
                      fetch(`/api/absences/${id}`, { method: "DELETE" })
                        .then(res => {
                          if (res.ok) {
                            toast.success("Absence deleted");
                            fetchAbsences();
                          } else {
                            toast.error("Failed to delete");
                          }
                        });
                    }
                  }}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Requests Management Grid */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-foreground">Requests Management</h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pending Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-warning shadow-sm shadow-warning/20"></div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Pending</h3>
                </div>
                <span className="text-xs font-bold bg-warning/10 text-warning px-2 py-0.5 rounded-full">{counts.pending}</span>
              </div>
              <div className="space-y-4">
                {pendingAbsences.length === 0 ? (
                  <Card className="bg-secondary/20 border-dashed border-2 shadow-none">
                    <CardContent className="p-6 sm:p-10 text-center text-muted-foreground text-xs font-medium">
                      No pending requests to review.
                    </CardContent>
                  </Card>
                ) : (
                  pendingAbsences.map((absence) => (
                    <Card key={absence.id} className="bg-white hover:shadow-lg transition-all duration-300 border-none shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-secondary">
                              <AvatarFallback className="bg-warning/10 text-warning text-xs font-bold">
                                {getInitials(absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-bold text-foreground leading-tight">
                                {absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{absence.user.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-warning/5 text-warning border-warning/30 font-bold px-2">
                            {getTypeLabel(absence.type)}
                          </Badge>
                        </div>

                        <div className="space-y-3 mb-5 pl-1">
                          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                            <CalendarIcon className="h-4 w-4 text-warning/60" />
                            <span>{formatDate(absence.startDate)}</span>
                            <ChevronRight className="h-3 w-3 opacity-40" />
                            <span>{formatDate(absence.endDate)}</span>
                          </div>
                          {absence.reason && (
                            <p className="text-xs text-muted-foreground italic bg-secondary/30 p-2.5 rounded-lg border-l-2 border-warning/20">
                              &quot;{absence.reason}&quot;
                            </p>
                          )}
                        </div>

                        {isManagerOrAdmin && canApproveAbsence(absence) && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-success hover:bg-success/90 text-white shadow-sm shadow-success/20 font-bold"
                              onClick={() => handleApprove(absence.id)}
                            >
                              <Check className="h-4 w-4 mr-1.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive hover:text-white font-bold"
                              onClick={() => handleReject(absence.id)}
                            >
                              <X className="h-4 w-4 mr-1.5" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}

                {pendingAbsences.length > 0 && pendingAbsences.length < counts.pending ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isLoadingManagement}
                    onClick={() => {
                      const next = pendingTake + 200;
                      setPendingTake(next);
                      void fetchManagementLists({ pendingTake: next });
                    }}
                  >
                    Carica altre ({counts.pending - pendingAbsences.length})
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Approved Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-success shadow-sm shadow-success/20"></div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Approved</h3>
                </div>
                <span className="text-xs font-bold bg-success/10 text-success px-2 py-0.5 rounded-full">{counts.approved}</span>
              </div>
              <div className="space-y-4 opacity-90">
                {approvedAbsences.length === 0 ? (
                  <Card className="bg-secondary/20 border-dashed border-2 shadow-none">
                    <CardContent className="p-6 sm:p-10 text-center text-muted-foreground text-xs font-medium">
                      No approved requests.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {approvedVisible.map((absence) => (
                      <Card key={absence.id} className="bg-white hover:shadow-md transition-all border-none shadow-sm group">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-success/10 text-success text-xs font-bold">
                                  {getInitials(absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  {absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{absence.user.email}</p>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-success/5 text-success border-success/30 font-bold px-2"
                            >
                              {getTypeLabel(absence.type)}
                            </Badge>
                          </div>

                          <div className="pl-1">
                            <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                              <CalendarIcon className="h-4 w-4 text-success/60" />
                              <span>{formatDate(absence.startDate)}</span>
                              <ChevronRight className="h-3 w-3 opacity-40" />
                              <span>{formatDate(absence.endDate)}</span>
                            </div>
                            {absence.reason && (
                              <p className="text-xs text-muted-foreground italic bg-secondary/30 p-2.5 rounded-lg border-l-2 border-success/20 mt-3">
                                &quot;{absence.reason}&quot;
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {approvedAbsences.length < counts.approved ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={isLoadingManagement}
                        onClick={() => {
                          const next = approvedTake + 25;
                          setApprovedTake(next);
                          void fetchManagementLists({ approvedTake: next });
                        }}
                      >
                        Carica altre ({counts.approved - approvedAbsences.length})
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {/* Rejected Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive shadow-sm shadow-destructive/20"></div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Rejected</h3>
                </div>
                <span className="text-xs font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{counts.rejected}</span>
              </div>
              <div className="space-y-4 opacity-80">
                {rejectedAbsences.length === 0 ? (
                  <Card className="bg-secondary/20 border-dashed border-2 shadow-none">
                    <CardContent className="p-6 sm:p-10 text-center text-muted-foreground text-xs font-medium">
                      No rejected requests.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {rejectedVisible.map((absence) => (
                      <Card key={absence.id} className="bg-white hover:shadow-md transition-all border-none shadow-sm">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-destructive/10 text-destructive text-xs font-bold">
                                  {getInitials(absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  {absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{absence.user.email}</p>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-destructive/5 text-destructive border-destructive/30 font-bold px-2"
                            >
                              {getTypeLabel(absence.type)}
                            </Badge>
                          </div>

                          <div className="pl-1">
                            <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                              <CalendarIcon className="h-4 w-4 text-destructive/60" />
                              <span>{formatDate(absence.startDate)}</span>
                              <ChevronRight className="h-3 w-3 opacity-40" />
                              <span>{formatDate(absence.endDate)}</span>
                            </div>
                            {absence.reason && (
                              <p className="text-xs text-muted-foreground italic bg-secondary/30 p-2.5 rounded-lg border-l-2 border-destructive/20 mt-3">
                                &quot;{absence.reason}&quot;
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {rejectedAbsences.length < counts.rejected ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={isLoadingManagement}
                        onClick={() => {
                          const next = rejectedTake + 25;
                          setRejectedTake(next);
                          void fetchManagementLists({ rejectedTake: next });
                        }}
                      >
                        Carica altre ({counts.rejected - rejectedAbsences.length})
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
