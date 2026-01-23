"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Edit2, Trash2, Check, X, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

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
    createdAt: string;
    user: {
        firstName: string;
        lastName: string;
        email: string;
        name?: string;
        department?: string | null;
    };
}

interface AbsenceTableProps {
    absences: Absence[];
    isLoading: boolean;
    viewerRole?: string;
    viewerDepartment?: string | null;
    onEdit: (absence: Absence) => void;
    onDelete: (id: string) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}

export function AbsenceTable({
    absences,
    isLoading,
    viewerRole = "member",
    viewerDepartment = null,
    onEdit,
    onDelete,
    onApprove,
    onReject,
}: AbsenceTableProps) {
    const isAdmin = viewerRole.toLowerCase() === "admin";
    const isManager = viewerRole.toLowerCase() === "manager";

    const canApproveAbsence = (absence: Absence) => {
        if (isAdmin) return true;
        if (isManager && viewerDepartment && absence.user.department === viewerDepartment) return true;
        return false;
    };

    const canDeleteAbsence = (absence: Absence) => {
        if (isAdmin) return true;
        // Owners can usually delete their own, but the table onDelete logic is tied to isAdmin prop currently.
        // We'll stick to requested logic for approvals.
        return isAdmin;
    };

    const getInitials = (name?: string) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved":
                return "success";
            case "rejected":
                return "destructive";
            default:
                return "warning";
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            vacation: "Vacation",
            sick_leave: "Sick Leave",
            personal: "Personal",
        };
        return labels[type] || type;
    };

    if (isLoading) {
        return <div className="p-4 text-center">Loading absences...</div>;
    }

    if (absences.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                No absences found matching your filters.
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-secondary/30">
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {absences.map((absence) => {
                        const start = new Date(absence.startDate);
                        const end = new Date(absence.endDate);
                        const days = differenceInDays(end, start) + 1;
                        const userName =
                            absence.user.name ||
                            `${absence.user.firstName} ${absence.user.lastName}`;

                        return (
                            <TableRow key={absence.id} className="group hover:bg-secondary/10">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-primary/5 text-xs">
                                                {getInitials(userName)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{userName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {absence.user.email}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        {getTypeLabel(absence.type)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col text-sm">
                                        <span className="font-medium">
                                            {format(start, "MMM d, yyyy")}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            to {format(end, "MMM d, yyyy")}
                                        </span>
                                        {absence.reason && (
                                            <span className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2 max-w-[200px]">
                                                &quot;{absence.reason}&quot;
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {days} day{days !== 1 ? "s" : ""}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={getStatusColor(absence.status) as any}
                                        className="capitalize"
                                    >
                                        {absence.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(isAdmin || isManager) && (
                                            <>
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => onEdit(absence)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {absence.status === "pending" && canApproveAbsence(absence) && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-success hover:text-success/90"
                                                            onClick={() => onApprove(absence.id)}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive/90"
                                                            onClick={() => onReject(absence.id)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => onDelete(absence.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
