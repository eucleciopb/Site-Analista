import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { LibraryItem } from '../types';
import { BookOpen, Plus, ExternalLink, Trash2, Search, Filter, Tag, FileText, PlayCircle, Link as LinkIcon, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function LibraryList() {
  const { profile } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: 'Geral',
    url: '',
    thumbnail: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'library'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LibraryItem));
      setItems(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'library');
    });
    return () => unsubscribe();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'library'), {
        ...newItem,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewItem({ title: '', description: '', category: 'Geral', url: '', thumbnail: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'library');
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm('Excluir este recurso da biblioteca?')) return;
    try {
      await deleteDoc(doc(db, 'library', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `library/${id}`);
    }
  };

  const categories = ['Todos', ...Array.from(new Set(items.map(i => i.category)))];
  
  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Biblioteca Técnica</h2>
          <p className="text-neutral-500">Documentação, vídeos e materiais de referência.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl hover:bg-neutral-800 transition-all font-medium shadow-lg shadow-black/10"
        >
          <Plus size={20} />
          Adicionar Recurso
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text"
            placeholder="Pesquisar na biblioteca..."
            className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Filter size={18} className="text-neutral-400 ml-2" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                selectedCategory === cat 
                ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/10" 
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-20 bg-white border border-dashed border-neutral-200 rounded-[3rem] text-center space-y-4">
              <div className="bg-neutral-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-neutral-300">
                <Search size={32} />
              </div>
              <div>
                <p className="text-xl font-bold text-neutral-900">Nenhum recurso encontrado</p>
                <p className="text-neutral-500">Tente ajustar sua busca ou filtros.</p>
              </div>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                key={item.id}
                className="group bg-white border border-neutral-100 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-neutral-200/40 transition-all duration-300 flex flex-col shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden m-4 rounded-[2rem]">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300 bg-neutral-50">
                      <BookOpen size={48} strokeWidth={1} />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md border border-white/50 text-[10px] font-black uppercase tracking-widest text-neutral-900 rounded-xl shadow-sm">
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="px-8 pb-8 flex-grow flex flex-col">
                  <h3 className="font-bold text-xl mb-3 line-clamp-1 group-hover:text-black transition-colors">{item.title}</h3>
                  <p className="text-neutral-500 text-sm line-clamp-2 mb-8 flex-grow leading-relaxed">{item.description || 'Nenhuma descrição fornecida.'}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-neutral-50">
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors shadow-lg shadow-black/5"
                    >
                      Acessar
                      <ExternalLink size={14} />
                    </a>
                    
                    {(profile?.role === 'admin' || item.createdBy === auth.currentUser?.uid) && (
                      <button 
                        onClick={() => deleteItem(item.id!)}
                        className="p-2 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-xl transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
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
              <h3 className="text-xl font-bold">Novo Recurso</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Título</label>
                <input
                  required
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                  placeholder="Ex: Guia de Estilo CSS"
                  value={newItem.title}
                  onChange={e => setNewItem({...newItem, title: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Descrição</label>
                <textarea
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all h-24 resize-none"
                  placeholder="Explique brevemente o que é este recurso..."
                  value={newItem.description}
                  onChange={e => setNewItem({...newItem, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Categoria</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                    placeholder="Ex: Frontend"
                    value={newItem.category}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">URL / Link</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                    placeholder="https://..."
                    value={newItem.url}
                    onChange={e => setNewItem({...newItem, url: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Capa (URL da Imagem - Opcional)</label>
                <input
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                  placeholder="https://images.unsplash.com/..."
                  value={newItem.thumbnail}
                  onChange={e => setNewItem({...newItem, thumbnail: e.target.value})}
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-black text-white font-bold rounded-2xl hover:bg-neutral-800 transition-colors shadow-lg shadow-black/10 mt-2"
              >
                Adicionar à Biblioteca
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
