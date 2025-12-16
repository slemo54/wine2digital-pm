"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Calendar as CalendarIcon, Plus, Check, X, Loader2, Clock, User, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";

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
  };
  createdAt: string;
}

export default function CalendarPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAbsences();
    }
  }, [status]);

  const fetchAbsences = async () => {
    try {
      const response = await fetch("/api/absences");
      const data = await response.json();
      if (response.ok) {
        setAbsences(data.absences || []);
      }
    } catch (error) {
      toast.error("Failed to load absences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newAbsence.startDate || !newAbsence.endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    try {
      const response = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAbsence),
      });

      if (response.ok) {
        toast.success("Absence request submitted");
        setIsDialogOpen(false);
        setNewAbsence({
          type: "vacation",
          startDate: "",
          endDate: "",
          isFullDay: true,
          startTime: "",
          endTime: "",
          reason: "",
        });
        fetchAbsences();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast.error("Failed to submit absence request");
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

  const userRole = (session?.user as any)?.role || "member";
  const isManagerOrAdmin = userRole === "admin" || userRole === "manager";

  const pendingAbsences = absences.filter(a => a.status === "pending");
  const approvedAbsences = absences.filter(a => a.status === "approved");
  const rejectedAbsences = absences.filter(a => a.status === "rejected");

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-1">Absence Management</h2>
            <p className="text-muted-foreground">Review and manage team absence requests</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Request Absence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Request Absence</DialogTitle>
                  <DialogDescription>
                    Submit a new absence request for approval
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
                  <div className="grid gap-2">
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Textarea
                      id="reason"
                      value={newAbsence.reason}
                      onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })}
                      placeholder="Provide a reason for your absence..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    Submit Request
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{pendingAbsences.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-l-success">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Approved</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{approvedAbsences.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-l-destructive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{rejectedAbsences.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Absence Requests Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-warning"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Pending</h3>
              <span className="text-sm text-muted-foreground">({pendingAbsences.length})</span>
            </div>
            <div className="space-y-3">
              {pendingAbsences.length === 0 ? (
                <Card className="bg-white border-dashed">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No pending requests
                  </CardContent>
                </Card>
              ) : (
                pendingAbsences.map((absence) => (
                  <Card key={absence.id} className="bg-white hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-accent text-foreground text-xs">
                              {getInitials(absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{absence.user.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning">
                          {getTypeLabel(absence.type)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{formatDate(absence.startDate)}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{formatDate(absence.endDate)}</span>
                        </div>
                        {absence.reason && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {absence.reason}
                          </p>
                        )}
                      </div>

                      {isManagerOrAdmin && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-success border-success hover:bg-success hover:text-white"
                            onClick={() => handleApprove(absence.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() => handleReject(absence.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Approved Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-success"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Approved</h3>
              <span className="text-sm text-muted-foreground">({approvedAbsences.length})</span>
            </div>
            <div className="space-y-3">
              {approvedAbsences.length === 0 ? (
                <Card className="bg-white border-dashed">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No approved requests
                  </CardContent>
                </Card>
              ) : (
                approvedAbsences.map((absence) => (
                  <Card key={absence.id} className="bg-white hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-accent text-foreground text-xs">
                              {getInitials(absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{absence.user.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success">
                          {getTypeLabel(absence.type)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{formatDate(absence.startDate)}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{formatDate(absence.endDate)}</span>
                        </div>
                        {absence.reason && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {absence.reason}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Rejected Column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-destructive"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Rejected</h3>
              <span className="text-sm text-muted-foreground">({rejectedAbsences.length})</span>
            </div>
            <div className="space-y-3">
              {rejectedAbsences.length === 0 ? (
                <Card className="bg-white border-dashed">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No rejected requests
                  </CardContent>
                </Card>
              ) : (
                rejectedAbsences.map((absence) => (
                  <Card key={absence.id} className="bg-white hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-accent text-foreground text-xs">
                              {getInitials(absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {absence.user.name || `${absence.user.firstName} ${absence.user.lastName}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{absence.user.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive">
                          {getTypeLabel(absence.type)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{formatDate(absence.startDate)}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{formatDate(absence.endDate)}</span>
                        </div>
                        {absence.reason && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {absence.reason}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
