import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Training, TrainingStatus } from '../types';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, MapPin, Trash2, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function TrainingList() {
  const { profile } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Training Form State
  const [newTraining, setNewTraining] = useState({
    title: '',
    date: '',
    instructor: '',
    team: '',
    description: '',
    location: '',
    status: 'scheduled' as TrainingStatus
  });

  useEffect(() => {
    const q = query(collection(db, 'trainings'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Training));
      setTrainings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trainings');
    });
    return () => unsubscribe();
  }, []);

  const handleAddTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'trainings'), {
        ...newTraining,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewTraining({ title: '', date: '', instructor: '', team: '', description: '', location: '', status: 'scheduled' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trainings');
    }
  };

  const toggleStatus = async (training: Training) => {
    if (!training.id) return;
    const nextStatus: Record<TrainingStatus, TrainingStatus> = {
      'scheduled': 'completed',
      'completed': 'cancelled',
      'cancelled': 'scheduled'
    };
    try {
      await updateDoc(doc(db, 'trainings', training.id), {
        status: nextStatus[training.status],
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trainings/${training.id}`);
    }
  };

  const deleteTraining = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este treinamento?')) return;
    try {
      await deleteDoc(doc(db, 'trainings', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trainings/${id}`);
    }
  };

  const getStatusInfo = (status: TrainingStatus) => {
    switch (status) {
      case 'completed': return { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 border-emerald-100', label: 'Concluído' };
      case 'cancelled': return { icon: XCircle, color: 'text-neutral-400 bg-neutral-50 border-neutral-100', label: 'Cancelado' };
      default: return { icon: Clock, color: 'text-amber-500 bg-amber-50 border-amber-100', label: 'Agendado' };
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agenda de Treinamentos</h2>
          <p className="text-neutral-500">Acompanhe e gerencie as próximas sessões da equipe.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl hover:bg-neutral-800 transition-all font-medium shadow-lg shadow-black/10"
        >
          <Plus size={20} />
          Novo Treinamento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {trainings.length === 0 ? (
            <div className="col-span-full py-20 bg-white border border-dashed border-neutral-200 rounded-[3rem] text-center space-y-4">
              <div className="bg-neutral-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-neutral-300">
                <Calendar size={32} />
              </div>
              <div>
                <p className="text-xl font-bold text-neutral-900">Nenhum treinamento agendado</p>
                <p className="text-neutral-500">Comece criando sua primeira sessão clicando no botão acima.</p>
              </div>
            </div>
          ) : (
            trainings.map((t, index) => {
              const StatusIcon = getStatusInfo(t.status).icon;
              const statusStyle = getStatusInfo(t.status).color;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  key={t.id}
                  className="group relative bg-white border border-neutral-100 rounded-[2.5rem] p-8 hover:shadow-2xl hover:shadow-neutral-200/40 transition-all duration-300 flex flex-col h-full shadow-sm"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={cn("inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider", statusStyle)}>
                      <StatusIcon size={12} />
                      {getStatusInfo(t.status).label}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleStatus(t)} className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-black transition-colors" title="Mudar Status">
                        <Clock size={16} />
                      </button>
                      {(profile?.role === 'admin' || t.createdBy === auth.currentUser?.uid) && (
                        <button onClick={() => deleteTraining(t.id!)} className="p-2 hover:bg-red-50 rounded-xl text-neutral-400 hover:text-red-500 transition-colors" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold leading-tight mb-4 group-hover:text-black transition-colors line-clamp-2">{t.title}</h3>
                  <p className="text-neutral-500 text-sm mb-6 line-clamp-3">{t.description || 'Sem descrição detalhada para este treinamento.'}</p>
                  
                  <div className="space-y-3 mb-8 flex-grow">
                    <div className="flex items-center gap-3 text-neutral-900 font-medium text-sm p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Calendar size={16} className="text-neutral-500" />
                      </div>
                      <span className="truncate">{t.date ? format(new Date(t.date), "dd 'de' MMMM, HH:mm", { locale: ptBR }) : 'Data não definida'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-900 font-medium text-sm p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <MapPin size={16} className="text-neutral-500" />
                      </div>
                      <span className="truncate">{t.location || 'Local não informado'}</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-neutral-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-black/10">
                        {t.instructor?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Instrutor</p>
                        <p className="font-bold text-neutral-900 leading-tight">{t.instructor}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-neutral-100 rounded-lg text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      {t.team}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h3 className="text-xl font-bold">Novo Treinamento</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddTraining} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Título</label>
                <input
                  required
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                  placeholder="Ex: Workshop de React Advanced"
                  value={newTraining.title}
                  onChange={e => setNewTraining({...newTraining, title: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Data e Hora</label>
                  <input
                    required
                    type="datetime-local"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                    value={newTraining.date}
                    onChange={e => setNewTraining({...newTraining, date: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Instrutor</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                    placeholder="Nome do Instrutor"
                    value={newTraining.instructor}
                    onChange={e => setNewTraining({...newTraining, instructor: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Time</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                    placeholder="Ex: Frontend"
                    value={newTraining.team}
                    onChange={e => setNewTraining({...newTraining, team: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Local/Link</label>
                  <input
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                    placeholder="Sala 01 ou Link Meet"
                    value={newTraining.location}
                    onChange={e => setNewTraining({...newTraining, location: e.target.value})}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-neutral-800 transition-colors shadow-lg shadow-black/10 mt-2"
              >
                Criar Treinamento
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
