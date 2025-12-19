"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AttendanceCard } from "@/components/attendance/AttendanceCard";
import { DailyGrid } from "@/components/attendance/DailyGrid";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AttendancePage() {
    const { data: session } = useSession();
    const [myEntry, setMyEntry] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch my entry
                const myRes = await fetch("/api/attendance");
                const myData = await myRes.json();
                setMyEntry(myData.entry);

                // Fetch team data if manager (Mock for now, needs real API)
                // const teamRes = await fetch("/api/attendance/team"); ...
                setTeamMembers([
                    { userId: "1", name: "Mario Rossi", clockIn: new Date().toISOString(), status: "present" },
                    { userId: "2", name: "Luigi Verdi", status: "absent" },
                ] as any);

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const isManagerOrAdmin = (session?.user as any)?.role === "admin" || (session?.user as any)?.role === "manager";

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Attendance Dashboard</h1>
                    <p className="text-muted-foreground">Track your work hours and manage team presence.</p>
                </div>
                {isManagerOrAdmin && (
                    <Button variant="outline" onClick={() => window.open("/api/reports/attendance/export", "_blank")}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <AttendanceCard initialEntry={myEntry || undefined} />
                </div>

                {/* Only show Team Grid for Managers/Admin - Mock Check */}
                <div className="md:col-span-2">
                    <DailyGrid members={teamMembers} />
                </div>
            </div>
        </div>
    );
}
