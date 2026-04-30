# Training Hub: Agenda & Biblioteca

Plataforma de gestão de treinamentos para equipes técnicas, integrada com Firebase.

## 🚀 Funcionalidades

- **Dashboard de Visão Geral:** Estatísticas em tempo real sobre treinamentos e recursos.
- **Agenda de Treinamentos:** Controle completo de sessões (agendadas, concluídas ou canceladas).
- **Biblioteca Técnica:** Repositório organizado para links, vídeos e documentos.
- **Autenticação Segura:** Login via Google com controle de perfil (Admin/Membro).
- **Interface Moderna:** Design responsivo, clean e focado na usabilidade utilizando Tailwind CSS.

## 🛠️ Tecnologias

- **Frontend:** React 19 + TypeScript + Vite.
- **Estilização:** Tailwind CSS + Lucide Icons + Motion (animações).
- **Backend/Database:** Firebase Firestore & Authentication.
- **Estado Global:** Context API do React.

## 🛠️ Como Iniciar

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Configure o Firebase:**
   As configurações já estão vinculadas ao arquivo `firebase-applet-config.json` gerado pelo AI Studio.
3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

## 🔒 Segurança

As regras do Firestore estão configuradas para garantir que:
- Apenas usuários autenticados e com e-mail verificado possam ler os dados.
- Somente o criador do item ou um administrador possa editar ou excluir registros.
- Perfis de usuário sejam criados automaticamente no primeiro acesso.
