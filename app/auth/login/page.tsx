"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams?.get("error");
    const message = searchParams?.get("message");
    
    if (error === "AccessDenied") {
      setErrorMessage(message || "Accesso negato. Solo account del workspace autorizzati.");
    } else if (error) {
      setErrorMessage("Si è verificato un errore durante l'accesso. Riprova.");
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      // NextAuth will handle the redirect after successful authentication
      await signIn("google", {
        callbackUrl: "/dashboard",
        redirect: true,
      });
    } catch (error) {
      console.error("Google sign-in error:", error);
      setErrorMessage("Errore durante l'accesso con Google. Riprova.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECECEC] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 mb-4 shadow-lg">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Wine2Digital PM</h1>
          <p className="text-gray-600 mt-2">Project Management Workspace</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Accesso Workspace</CardTitle>
            <CardDescription>
              Accedi con il tuo account Google Workspace
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-sm text-red-700">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}
            
            <Alert className="border-orange-200 bg-orange-50">
              <Shield className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-gray-700">
                <strong>Accesso riservato:</strong> Solo account <span className="font-mono text-orange-600">@mammajumboshrimp.com</span>
              </AlertDescription>
            </Alert>

            <div className="pt-2">
              <Button 
                type="button" 
                className="w-full h-12 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 shadow-sm" 
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Connessione in corso...
                  </>
                ) : (
                  <>
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    <span className="font-medium">Accedi con Google Workspace</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-2">
            <div className="text-xs text-center text-gray-500 space-y-1">
              <p>Usa il tuo account aziendale:</p>
              <p className="font-mono text-orange-600">nome@mammajumboshrimp.com</p>
            </div>
          </CardFooter>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Problemi di accesso? Contatta l&apos;amministratore del workspace
          </p>
        </div>
      </div>
    </div>
  );
}
