import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        index2: resolve(__dirname, 'index2.html'),
        "html_adm/agenda-dia-adm": resolve(__dirname, 'html_adm/agenda-dia-adm.html'),
        "html_adm/agenda-mensal-adm": resolve(__dirname, 'html_adm/agenda-mensal-adm.html'),
        "html_adm/apuracao": resolve(__dirname, 'html_adm/apuracao.html'),
        "html_adm/cadastro-treinamento": resolve(__dirname, 'html_adm/cadastro-treinamento.html'),
        "html_adm/rps-adm": resolve(__dirname, 'html_adm/rps-adm.html'),
        "html_adm/treinos-resumo-adm": resolve(__dirname, 'html_adm/treinos-resumo-adm.html'),
        "html_menus/menu": resolve(__dirname, 'html_menus/menu.html'),
        "html_menus/menuadm": resolve(__dirname, 'html_menus/menuadm.html'),
        "html_usuarios/agenda": resolve(__dirname, 'html_usuarios/agenda.html'),
        "html_usuarios/biblioteca-treinamentos": resolve(__dirname, 'html_usuarios/biblioteca-treinamentos.html'),
        "html_usuarios/criar-agenda": resolve(__dirname, 'html_usuarios/criar-agenda.html'),
        "html_usuarios/resultados": resolve(__dirname, 'html_usuarios/resultados.html'),
        "html_usuarios/treinamentos": resolve(__dirname, 'html_usuarios/treinamentos.html'),
      },
    },
  },
});
