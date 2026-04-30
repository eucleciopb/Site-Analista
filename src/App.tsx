import React, { useState } from 'react';
import { LogOut, Layout, BookOpen, Calendar, Plus, Search, User as UserIcon, Menu, X, ChevronRight, ExternalLink } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { signInWithGoogle, logOut } from './lib/firebase';
import TrainingList from './components/TrainingList';
import LibraryList from './components/LibraryList';
import DashboardView from './components/DashboardView';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

type View = 'dashboard' | 'agenda' | 'library';

export default function App() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F3] p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-black text-white rounded-2xl mb-4">
              <Layout size={32} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Training Hub</h1>
            <p className="text-neutral-500 text-lg">
              Gerencie a agenda de treinamentos e acesse a biblioteca da equipe.
            </p>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-neutral-200 rounded-2xl font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  const NavItem = ({ view, icon: Icon, label }: { view: View, icon: any, label: string }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => {
          setCurrentView(view);
          setIsMobileMenuOpen(false);
        }}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200",
          isActive 
            ? "bg-black text-white shadow-lg shadow-black/10" 
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        )}
      >
        <Icon size={20} />
        <span className="font-medium text-sm">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 font-sans">
      {/* Sidebar / Top Nav for Desktop */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-neutral-200 z-50 px-4 flex items-center justify-between lg:px-8">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white p-1.5 rounded-lg">
              <Layout size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">Training Hub</span>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <NavItem view="dashboard" icon={Layout} label="Início" />
            <NavItem view="agenda" icon={Calendar} label="Agenda" />
            <NavItem view="library" icon={BookOpen} label="Biblioteca" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-neutral-200">
            <div className="text-right">
              <p className="text-xs font-semibold text-neutral-900 leading-tight">{profile?.displayName}</p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{profile?.role}</p>
            </div>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full border border-neutral-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                <UserIcon size={16} className="text-neutral-400" />
              </div>
            )}
          </div>
          <button
            onClick={logOut}
            className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
          
          <button 
            className="lg:hidden p-2 text-neutral-600"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-0 right-0 bg-white border-b border-neutral-200 z-40 p-4 lg:hidden"
          >
            <div className="flex flex-col gap-2">
              <NavItem view="agenda" icon={Calendar} label="Agenda" />
              <NavItem view="library" icon={BookOpen} label="Biblioteca" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-24 pb-12 px-4 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentView === 'dashboard' ? <DashboardView onNavigate={setCurrentView} /> : 
           currentView === 'agenda' ? <TrainingList /> : 
           <LibraryList />}
        </motion.div>
      </main>
    </div>
  );
}
