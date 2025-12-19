"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface TeamMemberStatus {
    userId: string;
    name: string;
    clockIn?: string;
    clockOut?: string;
    status: string; // present, absent, late, etc.
}

export function DailyGrid({ members }: { members: TeamMemberStatus[] }) {
    const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Team Status - {format(new Date(), "MMM do")}</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                        {members.map((member) => (
                            <div key={member.userId} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-sm">{member.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {member.clockIn ? `In: ${format(new Date(member.clockIn), "HH:mm")}` : "Not checked in"}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <Badge variant={member.status === 'present' ? 'default' : member.status === 'late' ? 'destructive' : 'secondary'}>
                                        {member.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                        {members.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No active members found.</p>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
