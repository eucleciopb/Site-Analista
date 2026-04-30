import React, { useState, useEffect } from 'react';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Training, LibraryItem } from '../types';
import { Calendar, BookOpen, Clock, Users, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardViewProps {
  onNavigate: (view: 'dashboard' | 'agenda' | 'library') => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const [stats, setStats] = useState({
    totalTrainings: 0,
    totalResources: 0,
    upcomingCount: 0
  });
  const [recentTrainings, setRecentTrainings] = useState<Training[]>([]);

  useEffect(() => {
    // Basic stats
    const unsubTrainings = onSnapshot(collection(db, 'trainings'), (snap) => {
      const trainings = snap.docs.map(doc => doc.data() as Training);
      const upcoming = trainings.filter(t => t.status === 'scheduled').length;
      setStats(prev => ({ ...prev, totalTrainings: snap.size, upcomingCount: upcoming }));
    });

    const unsubLibrary = onSnapshot(collection(db, 'library'), (snap) => {
      setStats(prev => ({ ...prev, totalResources: snap.size }));
    });

    const qRecent = query(collection(db, 'trainings'), orderBy('date', 'desc'), limit(3));
    const unsubRecent = onSnapshot(qRecent, (snap) => {
      setRecentTrainings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Training)));
    });

    return () => {
      unsubTrainings();
      unsubLibrary();
      unsubRecent();
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-4xl font-black tracking-tight text-neutral-900">Dashboard</h2>
        <p className="text-neutral-500 text-lg">Bem-vindo ao centro de treinamento do seu time.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Treinamentos', value: stats.totalTrainings, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', view: 'agenda' as const },
          { label: 'Recursos na Bio', value: stats.totalResources, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50', view: 'library' as const },
          { label: 'Agendados', value: stats.upcomingCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', view: 'agenda' as const },
        ].map((stat, i) => (
          <motion.button
            key={stat.label}
            whileHover={{ y: -4 }}
            onClick={() => onNavigate(stat.view)}
            className="p-6 bg-white border border-neutral-200 rounded-[2.5rem] flex items-center justify-between group shadow-sm hover:shadow-xl transition-all"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-4xl font-black text-neutral-900 tracking-tight">{stat.value}</p>
            </div>
            <div className={`p-4 rounded-3xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon size={28} />
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight">Atividades Recentes</h3>
            <button 
              onClick={() => onNavigate('agenda')}
              className="text-sm font-bold flex items-center gap-2 hover:underline"
            >
              Ver todos <ArrowRight size={16} />
            </button>
          </div>
          
          <div className="space-y-4">
            {recentTrainings.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-neutral-200 rounded-[2rem] text-center text-neutral-400">
                <Zap className="mx-auto mb-2 opacity-20" size={48} />
                <p>Nenhum treinamento recente encontrado.</p>
              </div>
            ) : (
              recentTrainings.map((t) => (
                <div key={t.id} className="p-5 bg-white border border-neutral-100 rounded-[2rem] flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold">
                      {t.title.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900">{t.title}</h4>
                      <p className="text-xs text-neutral-500">
                        {t.instructor} • {t.date ? format(new Date(t.date), "dd/MM HH:mm", { locale: ptBR }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-400'
                  }`}>
                    {t.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Tips / Info Box */}
        <div className="bg-black rounded-[3rem] p-8 text-white relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm">
              <BookOpen size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Biblioteca do Time</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Acesse a documentação técnica, vídeos de treinamento e diretrizes de projeto em um só lugar.
              </p>
            </div>
            <button 
              onClick={() => onNavigate('library')}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-neutral-100 transition-colors"
            >
              Explorar Biblioteca
            </button>
          </div>
          
          {/* Abstract Decorations */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-[0.03] rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white opacity-[0.02] rounded-full translate-x-1/2 translate-y-1/2" />
        </div>

        {/* GitHub / Real Data Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-neutral-900 text-white rounded-2xl">
                <ExternalLink size={20} />
              </div>
              <h3 className="text-xl font-bold">Importação</h3>
            </div>
            <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
              Você pode trazer seus dados existentes do GitHub e Firebase original configurando as chaves de acesso no painel de segredos.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-bold text-neutral-400 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                FIREBASE: CONECTADO (NOVO)
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-neutral-400 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                GITHUB: AGUARDANDO CONFIG
              </div>
            </div>
            <button 
              className="w-full mt-6 py-3 border border-neutral-200 text-neutral-900 font-bold rounded-xl hover:bg-neutral-50 transition-colors text-sm"
              onClick={() => alert('Para conectar seu GitHub real, você pode importar o repositório diretamente no menu do AI Studio ou compartilhar os componentes específicos aqui!')}
            >
              Saiba Mais
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
