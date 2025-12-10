import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight, CheckCircle, Users, BarChart3, Zap } from "lucide-react";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#ECECEC]">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Wine2Digital PM</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button className="bg-orange-500 hover:bg-orange-600">Accedi al Workspace</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-700 text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          <span>Workspace Aziendale</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Gestisci i Tuoi Progetti
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
            Con Efficienza
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Ottimizza i flussi di lavoro, collabora in modo fluido e consegna i progetti in tempo con la nostra piattaforma di project management.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/auth/login">
            <Button size="lg" className="text-lg px-8 bg-orange-500 hover:bg-orange-600">
              Accedi con Google Workspace <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          Accesso riservato agli account <span className="font-mono text-orange-600">@mammajumboshrimp.com</span>
        </p>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Tutto Ciò di Cui Hai Bisogno per il Successo
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Kanban Board</h3>
            <p className="text-gray-600">
              Visualizza il tuo workflow con board Kanban drag-and-drop. Sposta i task da "Da Fare" a "Completato" in modo semplice.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Collaborazione Team</h3>
            <p className="text-gray-600">
              Invita i membri del team, assegna task e collabora in tempo reale. Mantieni tutti sulla stessa pagina.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Tracking Progetti</h3>
            <p className="text-gray-600">
              Monitora il progresso dei progetti, imposta scadenze e prioritizza i task. Rimani organizzato e raggiungi i tuoi obiettivi.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-4xl font-bold mb-4">Pronto per Iniziare?</h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Accedi con il tuo account Google Workspace per iniziare a gestire i tuoi progetti.
          </p>
          <Link href="/auth/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Accedi al Workspace <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-600">
          <p>© 2025 Wine2Digital PM. Tutti i diritti riservati.</p>
        </div>
      </footer>
    </div>
  );
}
