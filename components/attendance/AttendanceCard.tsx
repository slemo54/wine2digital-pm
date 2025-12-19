"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Timer, LogOut, Coffee } from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

interface TimeEntry {
    id: string;
    clockIn?: string;
    clockOut?: string;
    totalMinutes: number;
    isLate: boolean;
    isEarlyExit: boolean;
    status: string;
}

interface AttendanceCardProps {
    initialEntry?: TimeEntry;
}

export function AttendanceCard({ initialEntry }: AttendanceCardProps) {
    const [entry, setEntry] = useState<TimeEntry | undefined>(initialEntry);
    const [loading, setLoading] = useState(false);

    const handleClockAction = async (action: "clock-in" | "clock-out") => {
        setLoading(true);
        try {
            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Action failed");

            setEntry(data.entry);
            toast.success(action === "clock-in" ? "Clocked in successfully" : "Clocked out successfully");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isClockedIn = !!entry?.clockIn && !entry?.clockOut;
    const isClockedOut = !!entry?.clockOut;

    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Today's Attendance</span>
                    {entry?.status && <Badge variant="outline">{entry.status}</Badge>}
                </CardTitle>
                <CardDescription>{format(new Date(), "EEEE, MMMM do, yyyy")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 items-center justify-center p-6 bg-secondary/20 rounded-lg border-2 border-dashed">
                    <div className="text-5xl font-mono font-bold tracking-widest text-primary">
                        {format(new Date(), "HH:mm")}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Current Time</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-secondary/50 rounded-md">
                        <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                        <p className="font-mono font-bold text-lg">
                            {entry?.clockIn ? format(new Date(entry.clockIn), "HH:mm") : "--:--"}
                        </p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-md">
                        <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                        <p className="font-mono font-bold text-lg">
                            {entry?.clockOut ? format(new Date(entry.clockOut), "HH:mm") : "--:--"}
                        </p>
                    </div>
                </div>

                {entry?.isLate && (
                    <div className="bg-destructive/10 text-destructive text-xs p-2 rounded text-center font-medium">
                        Marked as Late Arrival
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {!isClockedIn && !isClockedOut && (
                        <Button
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90 text-lg h-14"
                            onClick={() => handleClockAction("clock-in")}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Timer className="mr-2 h-5 w-5" />}
                            Clock In
                        </Button>
                    )}

                    {isClockedIn && (
                        <Button
                            size="lg"
                            variant="destructive"
                            className="w-full text-lg h-14"
                            onClick={() => handleClockAction("clock-out")}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />}
                            Clock Out
                        </Button>
                    )}

                    {isClockedOut && (
                        <div className="text-center p-4 bg-success/10 text-success rounded-md font-medium">
                            Shift Completed. Total: {(entry?.totalMinutes || 0) / 60} hrs.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
