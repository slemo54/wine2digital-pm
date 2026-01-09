"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { toast } from "react-hot-toast";

export default function JoinInvitePage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  
  const [invite, setInvite] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=" + encodeURIComponent(`/invites/join?token=${token}`));
    }
  }, [status, router, token]);

  useEffect(() => {
    if (status === "authenticated" && token) {
      fetchInvite();
    }
  }, [status, token]);

  const fetchInvite = async () => {
    try {
      const response = await fetch(`/api/invites?token=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setInvite(data.invite);
      } else {
        toast.error(data.error || "Invalid invite");
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    } catch (error) {
      toast.error("Failed to load invite");
      setTimeout(() => router.push("/dashboard"), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      const response = await fetch("/api/invites/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Successfully joined project!");
        router.push(`/project/${data.projectId}`);
      } else {
        toast.error(data.error || "Failed to join project");
      }
    } catch (error) {
      toast.error("Failed to join project");
    } finally {
      setIsJoining(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-background dark:via-background dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-background dark:via-background dark:to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Project Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {invite.project?.name}
            </h3>
            {invite.project?.description && (
              <p className="text-gray-600 text-sm">
                {invite.project.description}
              </p>
            )}
          </div>
          
          <div className="bg-blue-50 dark:bg-info/10 p-4 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-foreground">
              <strong>Role:</strong> {invite.role}
            </p>
            {invite.expiresAt && (
              <p className="text-sm text-gray-700 dark:text-foreground mt-1">
                <strong>Expires:</strong> {new Date(invite.expiresAt).toLocaleString()}
              </p>
            )}
          </div>

          <Button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full"
            size="lg"
          >
            {isJoining ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Check className="mr-2 h-5 w-5" />
            )}
            Join Project
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
