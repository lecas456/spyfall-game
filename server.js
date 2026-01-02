const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const supabase = require('./config/supabase'); // Usar o Supabase

// Cache de imagens para evitar muitas consultas
const imageCache = new Map();

// ADICIONAR ESTAS LINHAS para acessar io globalmente:
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

global.io = io;
// Função para buscar imagem no Supabase
// Função para buscar imagem no Supabase
async function getImageFromSupabase(searchTerm, tipo) {
  const cacheKey = `${searchTerm}_${tipo}`;
  
  console.log(`🔍 Buscando imagem: "${searchTerm}" tipo: "${tipo}"`);
  
  // Verificar cache primeiro
  if (imageCache.has(cacheKey)) {
    console.log(`✅ Imagem encontrada no cache: ${searchTerm}`);
    return imageCache.get(cacheKey);
  }

  try {
    console.log(`📡 Consultando Supabase para: "${searchTerm}" (${tipo})`);
    
    const { data, error } = await supabase
      .from('de_para_imagens')
      .select('link_img')
      .eq('pesquisa', searchTerm)
      .eq('tipo', tipo)
      .single();

    console.log(`📋 Resultado da consulta:`, { data, error });

    if (error) {
      console.log(`❌ Erro na consulta: ${error.message}`);
      return null;
    }

    if (data && data.link_img) {
      console.log(`✅ Imagem encontrada: ${data.link_img}`);
      imageCache.set(cacheKey, data.link_img);
      return data.link_img;
    } else {
      console.log(`❌ Nenhuma imagem encontrada para: ${searchTerm}`);
    }

  } catch (error) {
    console.error(`🚨 Erro ao buscar imagem para ${searchTerm}:`, error.message);
  }

  return null;
}

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

// Armazena salas ativas em memória
const activeRooms = new Map();

// Locais possíveis do jogo
// Locais com suas respectivas profissões/roles
const locationsWithProfessions = {
  'Aeroporto': ['Piloto', 'Comissário de Bordo', 'Controlador de Tráfego', 'Mecânico de Aeronaves', 'Segurança', 'Despachante', 'Bagageiro', 'Funcionário da Imigração', 'Passageiro', 'Limpeza'],
  
  'Banco': ['Gerente', 'Caixa', 'Segurança', 'Contador', 'Consultor Financeiro', 'Atendente', 'Diretor', 'Cliente', 'Tesoureiro', 'Limpeza'],
  
  'Praia': ['Salva-vidas', 'Vendedor Ambulante', 'Instrutor de Surf', 'Barqueiro', 'Mergulhador', 'Turista', 'Massagista', 'Garçom', 'Fotógrafo', 'Segurança'],
  
  'Cassino': ['Crupiê', 'Segurança', 'Garçom', 'Gerente', 'Caixa', 'Bartender', 'Jogador', 'Valet', 'Atendente VIP', 'Contador'],
  
  'Cinema': ['Operador de Projeção', 'Bilheteiro', 'Pipoqueiro', 'Faxineiro', 'Gerente', 'Segurança', 'Espectador', 'Técnico de Som', 'Porteiro', 'Vendedor'],
  
  'Circo': ['Palhaço', 'Mágico', 'Domador', 'Acrobata', 'Trapezista', 'Vendedor de Pipoca', 'Bilheteiro', 'Espectador', 'Apresentador', 'Técnico'],
  
  'Escola': ['Professor', 'Diretor', 'Coordenador', 'Aluno', 'Zelador', 'Merendeira', 'Bibliotecário', 'Porteiro', 'Psicólogo', 'Enfermeiro'],
  
  'Embaixada': ['Embaixador', 'Cônsul', 'Tradutor', 'Segurança', 'Recepcionista', 'Visitante', 'Secretário', 'Motorista', 'Advogado', 'Assessor'],
  
  'Hospital': ['Médico', 'Enfermeiro', 'Cirurgião', 'Anestesista', 'Recepcionista', 'Paciente', 'Farmacêutico', 'Limpeza', 'Segurança', 'Nutricionista'],
  
  'Hotel': ['Recepcionista', 'Camareira', 'Porteiro', 'Gerente', 'Garçom', 'Chef', 'Hóspede', 'Valet', 'Concierge', 'Limpeza'],
  
  'Restaurante': ['Chef', 'Garçom', 'Gerente', 'Cozinheiro', 'Bartender', 'Cliente', 'Limpeza', 'Caixa', 'Sommelier', 'Ajudante de Cozinha'],
  
  'Navio': ['Capitão', 'Marinheiro', 'Cozinheiro', 'Mecânico', 'Médico de Bordo', 'Passageiro', 'Limpeza', 'Segurança', 'Navegador', 'Engenheiro'],
  
  'Estação Espacial': ['Astronauta', 'Engenheiro', 'Cientista', 'Médico', 'Piloto', 'Técnico', 'Comunicador', 'Pesquisador', 'Comandante', 'Especialista'],
  
  'Submarino': ['Comandante', 'Sonar', 'Engenheiro', 'Torpedeiro', 'Navegador', 'Cozinheiro', 'Médico', 'Comunicador', 'Mecânico', 'Mergulhador'],
  
  'Teatro': ['Ator', 'Diretor', 'Cenógrafo', 'Músico', 'Bilheteiro', 'Espectador', 'Limpeza', 'Técnico de Som', 'Iluminador', 'Produtor'],
  
  'Universidade': ['Professor', 'Reitor', 'Estudante', 'Pesquisador', 'Bibliotecário', 'Secretário', 'Zelador', 'Segurança', 'Coordenador', 'Técnico'],
  
  'Base Militar': ['Soldado', 'Oficial', 'General', 'Piloto Militar', 'Mecânico', 'Médico Militar', 'Comunicador', 'Segurança', 'Instrutor', 'Analista'],
  
  'Parque': ['Guarda-Parque', 'Jardineiro', 'Segurança', 'Guia Turístico', 'Visitante', 'Limpeza', 'Veterinário', 'Fotógrafo', 'Monitor', 'Administrador'],
  
  'Shopping': ['Vendedor', 'Segurança', 'Gerente de Loja', 'Limpeza', 'Garçom', 'Cliente', 'Promotor', 'Manobrista', 'Atendente', 'Administrador'],
  
  'Biblioteca': ['Bibliotecário', 'Atendente', 'Segurança', 'Limpeza', 'Catalogador', 'Visitante', 'Arquivista', 'Técnico em Informática', 'Coordenador', 'Estagiário'],
  
  'Prisão': ['Guarda', 'Diretor', 'Psicólogo', 'Médico', 'Advogado', 'Detento', 'Limpeza', 'Capelão', 'Assistente Social', 'Segurança'],
  
  'Spa': ['Massagista', 'Esteticista', 'Recepcionista', 'Terapeuta', 'Instrutor de Yoga', 'Cliente', 'Limpeza', 'Gerente', 'Atendente', 'Segurança'],
  
  'Trem': ['Maquinista', 'Condutor', 'Revisor', 'Limpeza', 'Segurança', 'Passageiro', 'Mecânico', 'Controlador', 'Operador', 'Chefe de Trem'],
  
  'Museu': ['Curador', 'Guia', 'Segurança', 'Restaurador', 'Recepcionista', 'Visitante', 'Limpeza', 'Arquivista', 'Educador', 'Diretor'],
  
  'Supermercado': ['Caixa', 'Repositor', 'Açougueiro', 'Padeiro', 'Segurança', 'Cliente', 'Limpeza', 'Atendente', 'Fiscal', 'Empacotador'],
  
  'Cachoeira': ['Guia Turístico', 'Fotógrafo', 'Turista', 'Vendedor Ambulante', 'Salva-vidas', 'Biólogo', 'Mergulhador', 'Escalador', 'Ambientalista', 'Segurança'],
  
  'Trilha da Montanha': ['Guia de Trilha', 'Montanhista', 'Turista', 'Fotógrafo', 'Biólogo', 'Guarda-Parque', 'Vendedor', 'Socorrista', 'Pesquisador', 'Aventureiro'],
  
  'Cabana na Serra': ['Proprietário', 'Hóspede', 'Caseiro', 'Guia Local', 'Cozinheiro', 'Turista', 'Fotógrafo', 'Escritor', 'Artista', 'Limpeza'],
  
  'Mirante': ['Guia Turístico', 'Fotógrafo', 'Turista', 'Vendedor', 'Segurança', 'Casal', 'Artista', 'Blogueiro', 'Observador de Aves', 'Mantenedor'],
  
  'Campo de Lavanda': ['Agricultor', 'Turista', 'Fotógrafo', 'Vendedor', 'Guia', 'Aromaterapeuta', 'Colhedor', 'Proprietário', 'Visitante', 'Pesquisador'],
  
  'Pousada Rural': ['Proprietário', 'Hóspede', 'Cozinheiro', 'Camareira', 'Recepcionista', 'Turista', 'Guia Local', 'Jardineiro', 'Caseiro', 'Garçom'],
  
  'Feira da Serra': ['Feirante', 'Cliente', 'Organizador', 'Agricultor', 'Artesão', 'Turista', 'Segurança', 'Limpeza', 'Músico', 'Fotógrafo'],
  
  'Igreja do Pico': ['Padre', 'Fiel', 'Turista', 'Organista', 'Zelador', 'Guia', 'Fotógrafo', 'Segurança', 'Coordenador', 'Voluntário'],
  
  'Plantação de Café': ['Fazendeiro', 'Colhedor', 'Turista', 'Agrônomo', 'Trabalhador Rural', 'Degustador', 'Guia', 'Comprador', 'Pesquisador', 'Motorista'],
  
  'Chalé': ['Proprietário', 'Hóspede', 'Caseiro', 'Turista', 'Cozinheiro', 'Limpeza', 'Guia Local', 'Fotógrafo', 'Casal', 'Artista'],
  
  'Posto de Gasolina': ['Frentista', 'Gerente', 'Cliente', 'Mecânico', 'Caixa', 'Limpeza', 'Segurança', 'Entregador', 'Caminhoneiro', 'Lojista'],
  
  'Farmácia': ['Farmacêutico', 'Balconista', 'Cliente', 'Gerente', 'Entregador', 'Segurança', 'Limpeza', 'Estagiário', 'Representante', 'Caixa'],
  
  'Padaria': ['Padeiro', 'Atendente', 'Cliente', 'Confeiteiro', 'Caixa', 'Ajudante', 'Limpeza', 'Entregador', 'Gerente', 'Fornecedor'],
  
  'Açougue': ['Açougueiro', 'Atendente', 'Cliente', 'Caixa', 'Ajudante', 'Limpeza', 'Gerente', 'Entregador', 'Fornecedor', 'Fiscal'],
  
  'Floricultura': ['Florista', 'Cliente', 'Atendente', 'Jardineiro', 'Entregador', 'Caixa', 'Decorador', 'Fornecedor', 'Limpeza', 'Gerente'],
  
  'Pet Shop': ['Vendedor', 'Veterinário', 'Cliente', 'Tosador', 'Caixa', 'Atendente', 'Limpeza', 'Gerente', 'Entregador', 'Adestrador'],
  
  'Lavanderia': ['Atendente', 'Cliente', 'Operador', 'Gerente', 'Entregador', 'Limpeza', 'Passadeira', 'Caixa', 'Técnico', 'Motorista'],
  
  'Barbearia': ['Barbeiro', 'Cliente', 'Atendente', 'Caixa', 'Limpeza', 'Gerente', 'Manicure', 'Estagiário', 'Fornecedor', 'Segurança'],
  
  'Salão de Beleza': ['Cabeleireiro', 'Cliente', 'Manicure', 'Esteticista', 'Recepcionista', 'Limpeza', 'Gerente', 'Massagista', 'Atendente', 'Fornecedor'],
  
  'Ótica': ['Vendedor', 'Cliente', 'Optometrista', 'Atendente', 'Gerente', 'Técnico', 'Caixa', 'Limpeza', 'Representante', 'Estagiário'],
  
  'Loja de Roupas': ['Vendedor', 'Cliente', 'Gerente', 'Provador', 'Caixa', 'Atendente', 'Estilista', 'Limpeza', 'Segurança', 'Vitrinista'],
  
  'Livraria': ['Vendedor', 'Cliente', 'Gerente', 'Atendente', 'Caixa', 'Organizador', 'Limpeza', 'Autor', 'Leitor', 'Estagiário'],
  
  'Papelaria': ['Vendedor', 'Cliente', 'Atendente', 'Caixa', 'Gerente', 'Estudante', 'Professor', 'Limpeza', 'Organizador', 'Fornecedor'],
  
  'Loja de Eletrônicos': ['Vendedor', 'Cliente', 'Técnico', 'Gerente', 'Caixa', 'Atendente', 'Segurança', 'Demonstrador', 'Limpeza', 'Representante'],
  
  'Joalheria': ['Joalheiro', 'Cliente', 'Vendedor', 'Gerente', 'Segurança', 'Avaliador', 'Caixa', 'Limpeza', 'Ourives', 'Atendente'],
  
  'Consultório Médico': ['Médico', 'Paciente', 'Enfermeiro', 'Recepcionista', 'Secretária', 'Limpeza', 'Segurança', 'Atendente', 'Estagiário', 'Acompanhante'],
  
  'Dentista': ['Dentista', 'Paciente', 'Assistente', 'Recepcionista', 'Técnico', 'Limpeza', 'Secretária', 'Acompanhante', 'Estagiário', 'Atendente'],
  
  'Laboratório': ['Técnico', 'Médico', 'Paciente', 'Recepcionista', 'Bioquímico', 'Limpeza', 'Segurança', 'Atendente', 'Estagiário', 'Entregador'],
  
  'Clínica Veterinária': ['Veterinário', 'Cliente', 'Assistente', 'Recepcionista', 'Técnico', 'Limpeza', 'Atendente', 'Estagiário', 'Pet', 'Tosador'],
  
  'Academia': ['Instrutor', 'Aluno', 'Recepcionista', 'Personal Trainer', 'Limpeza', 'Gerente', 'Nutricionista', 'Fisioterapeuta', 'Atendente', 'Segurança'],
  
  'Piscina': ['Salva-vidas', 'Nadador', 'Instrutor', 'Limpeza', 'Atendente', 'Gerente', 'Criança', 'Pai/Mãe', 'Segurança', 'Técnico'],
  
  'Quadra de Tênis': ['Jogador', 'Instrutor', 'Árbitro', 'Espectador', 'Limpeza', 'Gerente', 'Atendente', 'Segurança', 'Técnico', 'Treinador'],
  
  'Campo de Futebol': ['Jogador', 'Técnico', 'Árbitro', 'Torcedor', 'Segurança', 'Jornalista', 'Fotógrafo', 'Limpeza', 'Gandula', 'Médico'],
  
  'Ginásio Esportivo': ['Atleta', 'Técnico', 'Árbitro', 'Espectador', 'Segurança', 'Limpeza', 'Comentarista', 'Jornalista', 'Médico', 'Atendente'],
  
  'Pista de Skate': ['Skatista', 'Instrutor', 'Espectador', 'Segurança', 'Limpeza', 'Fotógrafo', 'Amigo', 'Vendedor', 'Juiz', 'Técnico'],
  
  'Delegacia': ['Policial', 'Delegado', 'Detido', 'Advogado', 'Vítima', 'Escrivão', 'Segurança', 'Limpeza', 'Investigador', 'Atendente'],
  
  'Corpo de Bombeiros': ['Bombeiro', 'Comandante', 'Vítima', 'Paramédico', 'Motorista', 'Operador', 'Técnico', 'Instrutor', 'Segurança', 'Voluntário'],
  'Prefeitura': ['Prefeito', 'Secretário', 'Atendente', 'Cidadão', 'Funcionário', 'Segurança', 'Limpeza', 'Assessor', 'Contador', 'Recepcionista'],
  'Cartório': ['Escrivão', 'Cliente', 'Tabelião', 'Atendente', 'Advogado', 'Contador', 'Segurança', 'Limpeza', 'Estagiário', 'Recepcionista'],
  'Correios': ['Carteiro', 'Cliente', 'Atendente', 'Gerente', 'Operador', 'Segurança', 'Limpeza', 'Motorista', 'Separador', 'Caixa'],
  'Rodoviária': ['Motorista', 'Passageiro', 'Cobrador', 'Atendente', 'Segurança', 'Limpeza', 'Vendedor', 'Bagageiro', 'Fiscal', 'Anunciante'],
  'Metro': ['Maquinista', 'Passageiro', 'Segurança', 'Limpeza', 'Operador', 'Fiscal', 'Atendente', 'Técnico', 'Vendedor', 'Supervisor'],
  'Porto': ['Estivador', 'Marinheiro', 'Operador', 'Segurança', 'Fiscal', 'Piloto', 'Técnico', 'Supervisor', 'Limpeza', 'Passageiro'],
  'Marina': ['Marinheiro', 'Proprietário de Barco', 'Mecânico Naval', 'Segurança', 'Atendente', 'Turista', 'Pescador', 'Instrutor', 'Limpeza', 'Gerente'],
  'Heliporto': ['Piloto', 'Passageiro', 'Mecânico', 'Controlador', 'Segurança', 'Atendente', 'Técnico', 'Operador', 'Limpeza', 'Supervisor'],
  'Fazenda': ['Fazendeiro', 'Peão', 'Veterinário', 'Agrônomo', 'Visitante', 'Trabalhador', 'Motorista', 'Cozinheiro', 'Caseiro', 'Turista'],
  'Sítio': ['Sitiante', 'Visitante', 'Caseiro', 'Trabalhador', 'Turista', 'Veterinário', 'Hóspede', 'Cozinheiro', 'Jardineiro', 'Guia'],
  'Estábulo': ['Tratador', 'Veterinário', 'Cavaleiro', 'Proprietário', 'Visitante', 'Instrutor', 'Ferrador', 'Limpeza', 'Turista', 'Jóquei'],
  'Celeiro': ['Fazendeiro', 'Trabalhador Rural', 'Visitante', 'Veterinário', 'Turista', 'Caseiro', 'Motorista', 'Armazenador', 'Inspetor', 'Limpeza'],
  'Apiário': ['Apicultor', 'Ajudante', 'Visitante', 'Comprador', 'Veterinário', 'Pesquisador', 'Turista', 'Fotógrafo', 'Estudante', 'Inspetor'],
  'Vineyard': ['Viticultor', 'Colhedor', 'Sommelier', 'Turista', 'Degustador', 'Guia', 'Trabalhador', 'Comprador', 'Enólogo', 'Fotógrafo'],
  'Destilaria': ['Destilador', 'Operário', 'Degustador', 'Turista', 'Guia', 'Comprador', 'Técnico', 'Supervisor', 'Vendedor', 'Inspetor'],
  'Cervejaria': ['Cervejeiro', 'Degustador', 'Turista', 'Operário', 'Guia', 'Vendedor', 'Técnico', 'Supervisor', 'Cliente', 'Sommelier'],
  'Padaria Artesanal': ['Padeiro Artesão', 'Cliente', 'Ajudante', 'Atendente', 'Degustador', 'Fornecedor', 'Caixa', 'Limpeza', 'Turista', 'Chef'],
  'Queijaria': ['Queijeiro', 'Degustador', 'Turista', 'Operário', 'Comprador', 'Guia', 'Vendedor', 'Técnico', 'Inspetor', 'Cliente'],
  'Boate': ['DJ', 'Cliente', 'Barman', 'Segurança', 'Garçom', 'Dançarino', 'Gerente', 'Limpeza', 'Caixa', 'Promoter'],
  'Bar': ['Barman', 'Cliente', 'Garçom', 'Segurança', 'Gerente', 'Músico', 'Limpeza', 'Caixa', 'Cozinheiro', 'Atendente'],
  'Pub': ['Barman', 'Cliente', 'Garçom', 'Gerente', 'Segurança', 'Cozinheiro', 'Limpeza', 'Músico', 'Caixa', 'Atendente'],
  'Karaokê': ['DJ', 'Cliente', 'Cantor', 'Garçom', 'Atendente', 'Segurança', 'Barman', 'Limpeza', 'Técnico de Som', 'Gerente'],
  'Boliche': ['Jogador', 'Atendente', 'Técnico', 'Garçom', 'Gerente', 'Limpeza', 'Segurança', 'Caixa', 'Instrutor', 'Espectador'],
  'Parque de Diversões': ['Operador', 'Visitante', 'Segurança', 'Vendedor', 'Limpeza', 'Técnico', 'Gerente', 'Criança', 'Pai/Mãe', 'Atendente'],
  'Zoológico': ['Tratador', 'Visitante', 'Veterinário', 'Guia', 'Segurança', 'Biólogo', 'Limpeza', 'Fotógrafo', 'Criança', 'Educador'],
  'Aquário': ['Biólogo Marinho', 'Visitante', 'Guia', 'Mergulhador', 'Técnico', 'Veterinário', 'Limpeza', 'Educador', 'Fotógrafo', 'Criança'],
  'Planetário': ['Astrônomo', 'Visitante', 'Guia', 'Técnico', 'Operador', 'Educador', 'Professor', 'Estudante', 'Limpeza', 'Segurança'],
  'Observatório': ['Astrônomo', 'Pesquisador', 'Visitante', 'Técnico', 'Guia', 'Estudante', 'Fotógrafo', 'Operador', 'Professor', 'Cientista'],
  'Casa de Shows': ['Artista', 'Espectador', 'Técnico de Som', 'Segurança', 'Produtor', 'Vendedor', 'Limpeza', 'Barman', 'Roadie', 'Gerente'],
  'Estúdio de Gravação': ['Músico', 'Produtor', 'Técnico de Som', 'Engenheiro', 'Cantor', 'Instrumentista', 'Assistente', 'Diretor', 'Visitante', 'Estagiário'],
  'Galeria de Arte': ['Curador', 'Artista', 'Visitante', 'Colecionador', 'Crítico', 'Segurança', 'Guia', 'Vendedor', 'Limpeza', 'Fotógrafo'],
  'Ateliê': ['Artista', 'Estudante', 'Modelo', 'Visitante', 'Professor', 'Colecionador', 'Crítico', 'Assistente', 'Fornecedor', 'Limpeza'],
  'Escola de Dança': ['Professor de Dança', 'Aluno', 'Coreógrafo', 'Músico', 'Recepcionista', 'Pai/Mãe', 'Visitante', 'Limpeza', 'Diretor', 'Assistente'],
  'Dojo': ['Sensei', 'Aluno', 'Faixa Preta', 'Iniciante', 'Árbitro', 'Pai/Mãe', 'Visitante', 'Limpeza', 'Assistente', 'Mestre'],
  'Escola de Música': ['Professor', 'Aluno', 'Músico', 'Diretor', 'Recepcionista', 'Pai/Mãe', 'Visitante', 'Técnico', 'Limpeza', 'Afinador'],
  'Escola de Idiomas': ['Professor', 'Aluno', 'Coordenador', 'Recepcionista', 'Nativo', 'Diretor', 'Visitante', 'Estagiário', 'Limpeza', 'Atendente'],
  'Autoescola': ['Instrutor', 'Aluno', 'Diretor', 'Recepcionista', 'Examinador', 'Atendente', 'Mecânico', 'Limpeza', 'Segurança', 'Despachante'],
  'Creche': ['Professora', 'Criança', 'Cuidador', 'Diretora', 'Pai/Mãe', 'Cozinheiro', 'Limpeza', 'Segurança', 'Enfermeiro', 'Estagiário'],
  'Cemitério': ['Coveiro', 'Visitante', 'Padre', 'Segurança', 'Enlutado', 'Jardineiro', 'Administrador', 'Limpeza', 'Florista', 'Agente Funerário'],
  'Capela': ['Padre', 'Fiel', 'Noivo/Noiva', 'Convidado', 'Organista', 'Zelador', 'Fotógrafo', 'Florista', 'Coordenador', 'Visitante'],
  'Mosteiro': ['Monge', 'Abade', 'Visitante', 'Peregrino', 'Jardineiro', 'Cozinheiro', 'Bibliotecário', 'Guia', 'Zelador', 'Turista'],
  'Sinagoga': ['Rabino', 'Fiel', 'Cantor', 'Visitante', 'Estudante', 'Zelador', 'Segurança', 'Professor', 'Criança', 'Turista'],
  'Mesquita': ['Imam', 'Fiel', 'Visitante', 'Estudante', 'Zelador', 'Guia', 'Segurança', 'Professor', 'Turista', 'Muezim'],
  'Templo': ['Sacerdote', 'Fiel', 'Monge', 'Visitante', 'Turista', 'Guia', 'Zelador', 'Estudante', 'Peregrino', 'Segurança'],
  'Casa de Repouso': ['Enfermeiro', 'Idoso', 'Médico', 'Visitante', 'Cuidador', 'Fisioterapeuta', 'Limpeza', 'Cozinheiro', 'Recepcionista', 'Diretor'],
  
  'Orfanato': ['Cuidador', 'Criança', 'Diretor', 'Visitante', 'Professor', 'Psicólogo', 'Voluntário', 'Cozinheiro', 'Limpeza', 'Enfermeiro'],
  
  'Abrigo': ['Coordenador', 'Morador', 'Voluntário', 'Assistente Social', 'Doador', 'Cozinheiro', 'Segurança', 'Limpeza', 'Psicólogo', 'Visitante'],
  
  'Centro Comunitário': ['Coordenador', 'Usuário', 'Voluntário', 'Professor', 'Atendente', 'Segurança', 'Limpeza', 'Organizador', 'Palestrante', 'Visitante'],
  
  'Mercado Municipal': ['Feirante', 'Cliente', 'Administrador', 'Segurança', 'Limpeza', 'Fiscal', 'Carregador', 'Vendedor', 'Comprador', 'Turista'],
  
  'Feira Livre': ['Feirante', 'Cliente', 'Fiscal', 'Carregador', 'Organizador', 'Vendedor', 'Comprador', 'Limpeza', 'Segurança', 'Turista'],
  
  'Sacolão': ['Vendedor', 'Cliente', 'Caixa', 'Gerente', 'Repositor', 'Limpeza', 'Segurança', 'Entregador', 'Fornecedor', 'Fiscal'],
  
  'Armazém': ['Operador', 'Supervisor', 'Motorista', 'Carregador', 'Segurança', 'Administrador', 'Conferente', 'Limpeza', 'Técnico', 'Visitante'],
  
  'Depósito': ['Almoxarife', 'Carregador', 'Motorista', 'Supervisor', 'Conferente', 'Segurança', 'Operador', 'Limpeza', 'Administrador', 'Fornecedor'],
  
  'Galpão': ['Operário', 'Supervisor', 'Segurança', 'Motorista', 'Técnico', 'Administrador', 'Carregador', 'Soldador', 'Limpeza', 'Inspetor'],
  
  'Fábrica': ['Operário', 'Supervisor', 'Engenheiro', 'Técnico', 'Gerente', 'Segurança', 'Limpeza', 'Controlador', 'Inspetor', 'Manutenção'],
  
  'Usina': ['Operador', 'Engenheiro', 'Técnico', 'Supervisor', 'Segurança', 'Manutenção', 'Inspetor', 'Administrador', 'Soldador', 'Eletricista'],
  
  'Refinaria': ['Operador', 'Engenheiro', 'Técnico', 'Supervisor', 'Segurança', 'Inspetor', 'Soldador', 'Manutenção', 'Químico', 'Administrador'],
  
  'Construção Civil': ['Pedreiro', 'Engenheiro', 'Arquiteto', 'Operário', 'Mestre de Obras', 'Eletricista', 'Encanador', 'Soldador', 'Segurança', 'Servente'],
  
  'Escritório': ['Executivo', 'Secretário', 'Gerente', 'Analista', 'Estagiário', 'Diretor', 'Contador', 'Vendedor', 'Limpeza', 'Segurança'],
  
  'Coworking': ['Freelancer', 'Empreendedor', 'Designer', 'Programador', 'Consultor', 'Recepcionista', 'Limpeza', 'Segurança', 'Gerente', 'Cliente'],
  
  'Call Center': ['Operador', 'Supervisor', 'Gerente', 'Técnico', 'Atendente', 'Vendedor', 'Limpeza', 'Segurança', 'Treinador', 'Analista'],
  
  'Agência de Viagens': ['Agente', 'Cliente', 'Gerente', 'Consultor', 'Atendente', 'Vendedor', 'Segurança', 'Limpeza', 'Guia', 'Representante'],
  
  'Imobiliária': ['Corretor', 'Cliente', 'Gerente', 'Avaliador', 'Secretário', 'Vendedor', 'Atendente', 'Limpeza', 'Segurança', 'Fotógrafo'],
  
  'Laboratório de Informática': ['Técnico', 'Usuário', 'Professor', 'Aluno', 'Administrador', 'Suporte', 'Limpeza', 'Segurança', 'Estagiário', 'Supervisor'],
  
  'Lan House': ['Atendente', 'Gamer', 'Técnico', 'Cliente', 'Gerente', 'Segurança', 'Limpeza', 'Caixa', 'Jovem', 'Supervisor'],
  
  'Cyber Café': ['Atendente', 'Cliente', 'Técnico', 'Gerente', 'Usuário', 'Estudante', 'Gamer', 'Limpeza', 'Segurança', 'Caixa'],
  
  'Gráfica': ['Operador', 'Designer', 'Cliente', 'Técnico', 'Gerente', 'Vendedor', 'Atendente', 'Limpeza', 'Entregador', 'Supervisor'],
  
  'Editora': ['Editor', 'Escritor', 'Designer', 'Revisor', 'Gerente', 'Atendente', 'Vendedor', 'Limpeza', 'Estagiário', 'Diretor'],
  
  'Emissora de TV': ['Apresentador', 'Jornalista', 'Cinegrafista', 'Diretor', 'Produtor', 'Técnico', 'Segurança', 'Maquiador', 'Ator', 'Visitante'],
  
  'Rádio': ['Locutor', 'Produtor', 'Técnico de Som', 'Jornalista', 'DJ', 'Operador', 'Gerente', 'Visitante', 'Publicitário', 'Estagiário'],
  
  'Jornal': ['Jornalista', 'Editor', 'Fotógrafo', 'Diagramador', 'Revisor', 'Diretor', 'Vendedor', 'Entregador', 'Colunista', 'Estagiário'],
  
  'Agência de Publicidade': ['Publicitário', 'Designer', 'Diretor de Arte', 'Cliente', 'Account', 'Redator', 'Produtor', 'Atendente', 'Estagiário', 'Gerente'],
  
  'Estúdio Fotográfico': ['Fotógrafo', 'Cliente', 'Assistente', 'Modelo', 'Editor', 'Produtor', 'Iluminador', 'Maquiador', 'Diretor de Arte', 'Estagiário'],
  
  'Castelo': ['Rei/Rainha', 'Nobre', 'Guarda', 'Servo', 'Turista', 'Guia', 'Cozinheiro', 'Jardineiro', 'Cavaleiro', 'Historiador'],
  
  'Palácio': ['Governante', 'Ministro', 'Guarda', 'Servo', 'Diplomata', 'Turista', 'Guia', 'Segurança', 'Cozinheiro', 'Jardineiro'],
  
  'Ruínas': ['Arqueólogo', 'Turista', 'Guia', 'Historiador', 'Fotógrafo', 'Estudante', 'Pesquisador', 'Professor', 'Segurança', 'Explorador'],
  
  'Sítio Arqueológico': ['Arqueólogo', 'Pesquisador', 'Turista', 'Guia', 'Estudante', 'Professor', 'Fotógrafo', 'Historiador', 'Segurança', 'Escavador'],
  
  'Catedral': ['Bispo', 'Padre', 'Fiel', 'Turista', 'Guia', 'Organista', 'Coral', 'Zelador', 'Segurança', 'Fotógrafo'],
  
  'Torre': ['Guarda', 'Turista', 'Guia', 'Segurança', 'Fotógrafo', 'Observador', 'Técnico', 'Mantenedor', 'Visitante', 'Historiador'],
  
  'Farol': ['Faroleiro', 'Marinheiro', 'Turista', 'Guia', 'Técnico', 'Navegador', 'Pescador', 'Fotógrafo', 'Mantenedor', 'Visitante'],
  
  'Ponte': ['Engenheiro', 'Pedestre', 'Motorista', 'Turista', 'Fotógrafo', 'Inspetor', 'Segurança', 'Mantenedor', 'Ciclista', 'Corredor'],
  
  'Túnel': ['Operário', 'Motorista', 'Engenheiro', 'Segurança', 'Técnico', 'Inspetor', 'Pedestre', 'Mantenedor', 'Supervisor', 'Eletricista'],
  
  'Viaduto': ['Engenheiro', 'Motorista', 'Pedestre', 'Inspetor', 'Segurança', 'Mantenedor', 'Técnico', 'Fotógrafo', 'Turista', 'Supervisor'],
  
  'Ilha': ['Morador', 'Turista', 'Pescador', 'Guia', 'Barqueiro', 'Mergulhador', 'Biólogo', 'Fotógrafo', 'Náufrago', 'Pesquisador'],
  
  'Caverna': ['Espeleólogo', 'Turista', 'Guia', 'Geólogo', 'Fotógrafo', 'Explorador', 'Pesquisador', 'Aventureiro', 'Biólogo', 'Segurança'],
  
  'Deserto': ['Beduíno', 'Turista', 'Guia', 'Caravaneiro', 'Explorador', 'Fotógrafo', 'Pesquisador', 'Nômade', 'Aventureiro', 'Camelo'],
  
  'Vulcão': ['Vulcanólogo', 'Turista', 'Guia', 'Pesquisador', 'Fotógrafo', 'Geólogo', 'Explorador', 'Cientista', 'Aventureiro', 'Segurança'],
  
  'Geleira': ['Glaciólogo', 'Explorador', 'Turista', 'Guia', 'Pesquisador', 'Fotógrafo', 'Cientista', 'Aventureiro', 'Esquiador', 'Climatologista'],
  
  'Floresta': ['Guarda Florestal', 'Turista', 'Biólogo', 'Caçador', 'Guia', 'Pesquisador', 'Fotógrafo', 'Aventureiro', 'Acampante', 'Lenhador'],
  
  'Savana': ['Guia de Safari', 'Turista', 'Fotógrafo', 'Biólogo', 'Caçador', 'Pesquisador', 'Veterinário', 'Ranger', 'Explorador', 'Motorista'],
  
  'Pântano': ['Biólogo', 'Pescador', 'Turista', 'Guia', 'Pesquisador', 'Fotógrafo', 'Caçador', 'Explorador', 'Barqueiro', 'Cientista'],
  
  'Oásis': ['Beduíno', 'Turista', 'Guia', 'Caravaneiro', 'Fotógrafo', 'Explorador', 'Comerciante', 'Nômade', 'Viajante', 'Camelo'],
  
  'Canyon': ['Escalador', 'Turista', 'Guia', 'Fotógrafo', 'Geólogo', 'Aventureiro', 'Explorador', 'Rafting', 'Pesquisador', 'Segurança'],
  
  'Acampamento': ['Escoteiro', 'Líder', 'Acampante', 'Cozinheiro', 'Guia', 'Monitor', 'Criança', 'Pai/Mãe', 'Instrutor', 'Segurança'],
  
  'Resort': ['Hóspede', 'Recepcionista', 'Garçom', 'Chef', 'Animador', 'Segurança', 'Camareira', 'Gerente', 'Salva-vidas', 'Massagista'],
  
  'Hostel': ['Mochileiro', 'Recepcionista', 'Hóspede', 'Limpeza', 'Gerente', 'Turista', 'Viajante', 'Cozinheiro', 'Segurança', 'Guia'],
  
  'Motel': ['Recepcionista', 'Hóspede', 'Camareira', 'Segurança', 'Gerente', 'Limpeza', 'Casal', 'Atendente', 'Porteiro', 'Manobrista'],
  
  'Pousada': ['Proprietário', 'Hóspede', 'Recepcionista', 'Camareira', 'Cozinheiro', 'Turista', 'Guia Local', 'Limpeza', 'Garçom', 'Caseiro'],
  
  'Cruzeiro': ['Capitão', 'Passageiro', 'Comissário', 'Chef', 'Animador', 'Médico', 'Garçom', 'Segurança', 'Técnico', 'Limpeza'],
  
  'Iate': ['Capitão', 'Proprietário', 'Convidado', 'Marinheiro', 'Chef', 'Comissário', 'Segurança', 'Mecânico', 'Turista', 'Pescador'],
  
  'Balsa': ['Operador', 'Passageiro', 'Motorista', 'Cobrador', 'Marinheiro', 'Segurança', 'Turista', 'Comerciante', 'Mecânico', 'Fiscal'],
  
  'Teleférico': ['Operador', 'Passageiro', 'Técnico', 'Turista', 'Segurança', 'Guia', 'Fotógrafo', 'Mantenedor', 'Supervisor', 'Atendente'],
  
  'Funicular': ['Operador', 'Passageiro', 'Técnico', 'Turista', 'Segurança', 'Guia', 'Mantenedor', 'Supervisor', 'Fotógrafo', 'Condutor'],
  
  'Circo de Soleil': ['Artista', 'Acrobata', 'Músico', 'Espectador', 'Diretor', 'Técnico', 'Segurança', 'Vendedor', 'Produtor', 'Maquiador'],
  
  'Parque Aquático': ['Salva-vidas', 'Visitante', 'Operador', 'Segurança', 'Limpeza', 'Gerente', 'Criança', 'Pai/Mãe', 'Instrutor', 'Atendente'],
  
  'Termas': ['Terapeuta', 'Cliente', 'Atendente', 'Massagista', 'Recepcionista', 'Limpeza', 'Segurança', 'Gerente', 'Médico', 'Instrutor'],
  
  'Casa de Jogos': ['Crupiê', 'Jogador', 'Segurança', 'Gerente', 'Garçom', 'Caixa', 'Cliente', 'Observador', 'Limpeza', 'Bartender'],
  
  'Escape Room': ['Monitor', 'Jogador', 'Ator', 'Técnico', 'Gerente', 'Atendente', 'Designer', 'Segurança', 'Limpeza', 'Organizador'],
  
  'Simulador': ['Operador', 'Usuário', 'Técnico', 'Instrutor', 'Cliente', 'Atendente', 'Programador', 'Segurança', 'Gerente', 'Testador'],
  
  'Realidade Virtual': ['Operador', 'Usuário', 'Técnico', 'Desenvolvedor', 'Cliente', 'Instrutor', 'Atendente', 'Testador', 'Designer', 'Gerente'],
  
  'Kart': ['Piloto', 'Mecânico', 'Espectador', 'Instrutor', 'Operador', 'Segurança', 'Cronometrista', 'Atendente', 'Técnico', 'Gerente'],
  
  'Paintball': ['Jogador', 'Instrutor', 'Operador', 'Segurança', 'Árbitro', 'Espectador', 'Técnico', 'Atendente', 'Limpeza', 'Gerente'],
  
  'Laser Tag': ['Jogador', 'Operador', 'Instrutor', 'Técnico', 'Atendente', 'Segurança', 'Árbitro', 'Espectador', 'Gerente', 'Programador'],
  
  'Loja de Antiguidades': ['Antiquário', 'Cliente', 'Colecionador', 'Avaliador', 'Restaurador', 'Vendedor', 'Atendente', 'Especialista', 'Limpeza', 'Segurança'],
  
  'Brechó': ['Vendedor', 'Cliente', 'Organizador', 'Avaliador', 'Atendente', 'Caixa', 'Doador', 'Comprador', 'Limpeza', 'Gerente'],
  
  'Casa de Leilões': ['Leiloeiro', 'Comprador', 'Avaliador', 'Vendedor', 'Segurança', 'Atendente', 'Especialista', 'Colecionador', 'Observador', 'Gerente'],
  
  'Penhora': ['Oficial de Justiça', 'Devedor', 'Comprador', 'Avaliador', 'Segurança', 'Advogado', 'Leiloeiro', 'Atendente', 'Observador', 'Interessado'],
  
  'Casa de Câmbio': ['Operador', 'Cliente', 'Gerente', 'Caixa', 'Atendente', 'Turista', 'Empresário', 'Segurança', 'Contador', 'Supervisor'],
  
  'Lotérica': ['Atendente', 'Cliente', 'Apostador', 'Gerente', 'Caixa', 'Segurança', 'Entregador', 'Ganhador', 'Idoso', 'Limpeza'],
  
  'Tabacaria': ['Vendedor', 'Cliente', 'Fumante', 'Colecionador', 'Gerente', 'Atendente', 'Especialista', 'Fornecedor', 'Segurança', 'Limpeza'],
  
  'Conveniência': ['Atendente', 'Cliente', 'Gerente', 'Caixa', 'Repositor', 'Limpeza', 'Segurança', 'Entregador', 'Fornecedor', 'Viajante'],
  
  'Drive-Thru': ['Atendente', 'Cliente', 'Cozinheiro', 'Motorista', 'Gerente', 'Caixa', 'Entregador', 'Supervisor', 'Limpeza', 'Segurança'],
  
  'Food Truck': ['Chef', 'Cliente', 'Ajudante', 'Atendente', 'Caixa', 'Entregador', 'Proprietário', 'Turista', 'Trabalhador', 'Passante']
};

// Classe para gerenciar uma sala
class Room {
  constructor(code, owner) {
    this.code = code;
    this.owner = owner;
    this.players = new Map();
    this.gameState = 'waiting';
    this.location = null;
    this.spy = null;
    this.currentPlayer = null;
    this.playerOrder = [];
    this.timer = null;
    this.timeLimit = 300; // MUDANÇA 4: Voltar para 300
    this.timeRemaining = 0;
    this.votes = new Map();
    this.scores = new Map();
    this.locationsCount = 50;
    this.availableLocations = [];
    this.deleteTimeout = null;
    this.inactivityTimeout = null;
    this.playerProfessions = new Map();
    this.playerProfessionImages = new Map(); // ADICIONAR ESTA LINHA
    this.locationImage = null; // ADICIONAR ESTA LINHA
    this.hasProfessions = true; // ADICIONAR ESTA LINHA
    this.votingConfirmation = new Map(); // ADICIONAR - para confirmação de votação
    this.votingConfirmationTimer = null; // ADICIONAR
  }

  addPlayer(playerId, name, socketId) {
    // Limpar nome
    const cleanName = name.trim();
    
    // Verificar se já existe alguém com este nome na sala (mas não é o mesmo jogador)
    const existingPlayerWithName = Array.from(this.players.values()).find(
      player => player.name.toLowerCase() === cleanName.toLowerCase() && player.id !== playerId
    );
    
    if (existingPlayerWithName) {
      console.log(`Nome ${cleanName} já existe na sala (pertence a ${existingPlayerWithName.id})`);
      return { error: 'Nome já existe na sala' };
    }
    
    const playerCode = uuidv4().substring(0, 8);
    const playerData = {
      id: playerId,
      name: cleanName,
      socketId,
      code: playerCode,
      isOwner: playerId === this.owner,
      score: 0
    };
    
    this.players.set(playerId, playerData);
    console.log(`Jogador ${cleanName} adicionado à sala ${this.code} com sucesso`);
    console.log('Jogadores na sala agora:', Array.from(this.players.values()).map(p => p.name));
    return { success: true, playerCode };
  }

  reconnectPlayer(playerId, playerCode, socketId) {
    const player = this.players.get(playerId);
    
    if (player && player.code === playerCode) {
        // Jogador válido, reconectar
        player.socketId = socketId;
        console.log(`🔗 Jogador ${player.name} reconectou à sala ${this.code}`);
        return { success: true, player };
    }
    
    return { error: 'Jogador não encontrado ou código inválido' };
}

// markPlayerDisconnected(playerId) {
//     const player = this.players.get(playerId);
//     if (player) {
//         player.connected = false;
//         player.disconnectedAt = Date.now();
//         player.socketId = null;
//         console.log(`📱 Jogador ${player.name} desconectado (mantido na sala)`);
//         return true;
//     }
//     return false;
// }

// cleanupDisconnectedPlayers() {
//     const now = Date.now();
//     const timeoutMs = 10 * 60 * 1000; // 10 minutos
    
//     for (const [playerId, player] of this.players.entries()) {
//         if (!player.connected && player.disconnectedAt && (now - player.disconnectedAt) > timeoutMs) {
//             console.log(`🧹 Removendo jogador ${player.name} após 10 minutos desconectado`);
//             this.players.delete(playerId);
//             this.playerProfessions.delete(playerId);
//         }
//     }
// }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.playerProfessions.delete(playerId); // MUDANÇA 1: Adicionar esta linha
  }

  async startGame() {
    if (this.players.size < 3) return false;
    
    this.cancelInactivityDelete();
    this.gameState = 'playing';
    
    // Usar locais com suas respectivas profissões
    const availableLocationKeys = Object.keys(locationsWithProfessions).slice(0, this.locationsCount);
    this.availableLocations = availableLocationKeys;
    this.location = availableLocationKeys[Math.floor(Math.random() * availableLocationKeys.length)];
    
    const playerIds = Array.from(this.players.keys());
    this.spy = playerIds[Math.floor(Math.random() * playerIds.length)];
    
    // CORREÇÃO: SORTEAR PROFISSÕES APENAS SE hasProfessions = true
    if (this.hasProfessions) {
        console.log(`🎭 Sorteando profissões para o local: ${this.location}`);
        const locationProfessions = locationsWithProfessions[this.location];
        playerIds.forEach(playerId => {
            if (playerId !== this.spy) {
                const randomProfession = locationProfessions[Math.floor(Math.random() * locationProfessions.length)];
                this.playerProfessions.set(playerId, randomProfession);
                console.log(`👔 ${this.players.get(playerId).name} -> ${randomProfession}`);
            }
        });
    } else {
        console.log(`📍 Modo apenas local, sem profissões`);
    }
    
    this.playerOrder = [...playerIds].sort(() => Math.random() - 0.5);
    
    // Definir quem faz a primeira pergunta (100% aleatório - pode ser o espião)
    this.firstQuestionPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];
    this.currentPlayer = this.firstQuestionPlayer;
    
    console.log(`🎯 Primeira pergunta será feita por: ${this.players.get(this.firstQuestionPlayer).name}`);
    
    this.timeRemaining = this.timeLimit;
    this.startTimer();
    
    // CORREÇÃO: SEMPRE chamar loadImagesFromSupabase para carregar pelo menos o local
    console.log(`🖼️ Carregando imagens (hasProfessions: ${this.hasProfessions})`);
    this.loadImagesFromSupabase();
    
    return true;
}

// Nova função para carregar imagens do Supabase
async loadImagesFromSupabase() {
    console.log(`🖼️ Iniciando carregamento de imagens para sala ${this.code}`);
    console.log(`📍 Local: ${this.location}`);
    console.log(`👔 Profissões: ${Array.from(this.playerProfessions.values()).join(', ')}`);
    
    try {
      // Buscar imagem do local SEMPRE
      console.log(`🔍 Buscando imagem do local: ${this.location}`);
      this.locationImage = await getImageFromSupabase(this.location, 'local');
      console.log(`📸 Imagem do local resultado: ${this.locationImage}`);
      
      // Buscar imagens das profissões APENAS se tem profissões
      if (this.hasProfessions) {
          for (const [playerId, profession] of this.playerProfessions.entries()) {
            console.log(`🔍 Buscando imagem da profissão: ${profession} para jogador ${playerId}`);
            const professionImage = await getImageFromSupabase(profession, 'profissao');
            console.log(`📸 Imagem da profissão resultado: ${professionImage}`);
            this.playerProfessionImages.set(playerId, professionImage);
          }
      }
      
      console.log(`✅ Todas as imagens processadas para sala ${this.code}`);
      
      // Enviar update para todos os jogadores
      this.players.forEach((player) => {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket && player.id !== this.spy) {
          console.log(`📤 Enviando imagens para jogador: ${player.name}`);
          playerSocket.emit('images-loaded', {
            locationImage: this.locationImage,
            professionImage: this.hasProfessions ? this.playerProfessionImages.get(player.id) : null
          });
        }
      });
      
    } catch (error) {
      console.error('🚨 Erro ao carregar imagens:', error);
    }
}

  scheduleDelete() {
    // Cancelar timeout anterior se existir
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }
    
    // Agendar deleção em 30 segundos
    this.deleteTimeout = setTimeout(() => {
      console.log(`Sala ${this.code} será deletada - vazia por 30 segundos`);
      activeRooms.delete(this.code);
      console.log('Salas ativas restantes:', activeRooms.size);
    }, 30000); // 30 segundos
    
    console.log(`Sala ${this.code} agendada para deleção em 30 segundos`);
  }
  
  cancelDelete() {
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
      console.log(`Deleção da sala ${this.code} cancelada - jogador reconectou`);
    }
  }

  scheduleInactivityDelete() {
    // Agendar deleção em 2 minutos se jogo não for iniciado
    this.inactivityTimeout = setTimeout(() => {
      console.log(`Sala ${this.code} deletada por inatividade - não foi iniciada em 2 minutos`);
      activeRooms.delete(this.code);
      console.log('Salas ativas restantes:', activeRooms.size);
      
      // Notificar jogadores na sala
      this.players.forEach((player) => {
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.emit('room-deleted', {
            message: 'Sala foi fechada por inatividade (2 minutos sem iniciar)'
          });
        }
      });
    }, 120000); // 2 minutos = 120000ms
    
    console.log(`Sala ${this.code} será deletada em 2 minutos se não for iniciada`);
  }
  
  cancelInactivityDelete() {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
      console.log(`Timeout de inatividade da sala ${this.code} cancelado - jogo iniciado`);
    }
  }
  
  startTimer() {
    this.timer = setInterval(() => {
      this.timeRemaining--;
      
      if (this.timeRemaining <= 0) {
        console.log(`⏰ Tempo esgotado na sala ${this.code}`);
        // NÃO chamar startVoting aqui, será tratado no timerInterval do start-game
      }
    }, 1000);
   }

  startVoting() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.gameState = 'voting';
    this.votes.clear();
    
    console.log(`🗳️ Votação iniciada na sala ${this.code}`);
    return true; // ADICIONAR RETORNO
  }

  vote(playerId, votedFor) {
    this.votes.set(playerId, votedFor);
    
    if (this.votes.size === this.players.size) {
      this.endGame();
    }
  }

  startVotingConfirmation(initiatorId) {
    if (this.gameState !== 'playing') return false;
    
    this.gameState = 'voting_confirmation';
    this.votingConfirmation.clear();
    
    const initiator = this.players.get(initiatorId);
    console.log(`🗳️ ${initiator.name} iniciou votação, aguardando confirmação dos outros jogadores`);
    
    // CORREÇÃO: Timer de 10 segundos com callback adequado
    this.votingConfirmationTimer = setTimeout(() => {
        console.log('⏰ Timer de votação expirou, processando resultado');
        const result = this.processVotingConfirmation();
        
        // ENVIAR resultado para todos os clientes
        const io = global.io;
        if (io) {
            io.to(this.code).emit('voting-confirmation-result', {
                approved: result.result === 'approved',
                yesVotes: result.yesVotes,
                noVotes: result.noVotes
            });
            
            if (result.result === 'approved') {
                console.log('🗳️ Timer expirou, mas votação foi aprovada - enviando voting-started');
                io.to(this.code).emit('voting-started', {
                    players: Array.from(this.players.values()).map(p => ({
                        id: p.id,
                        name: p.name
                    }))
                });
           } else {
                console.log('❌ Timer expirou e votação rejeitada - continuando jogo');
                setTimeout(() => {
                    io.to(this.code).emit('timer-update', {
                        timeRemaining: this.timeRemaining
                    });
                }, 100);
            }
        }
    }, 10000);
    
    return { initiator: initiator.name };
}
  
 processVotingConfirmation() {
    // Limpar o timer se ainda estiver rodando
    if (this.votingConfirmationTimer) {
        clearTimeout(this.votingConfirmationTimer);
        this.votingConfirmationTimer = null;
    }

    const totalPlayers = this.players.size;
    const yesVotes = Array.from(this.votingConfirmation.values()).filter(vote => vote === 'yes').length;
    
    // CORREÇÃO: Votos não dados contam como "não"
    const noVotes = totalPlayers - yesVotes;
    
    console.log(`Votação finalizada: ${yesVotes} Sim, ${noVotes} Não (total: ${totalPlayers})`);
    
    if (yesVotes > totalPlayers / 2) {
        // Maioria disse sim - iniciar votação
        console.log('✅ Votação aprovada, iniciando votação real');
        this.startVoting();
        return { result: 'approved', yesVotes, noVotes };
    } else {
        // Maioria disse não ou não respondeu - voltar ao jogo
        console.log('❌ Votação rejeitada, voltando ao jogo');
        this.gameState = 'playing';
        
        // NÃO reiniciar timer aqui - o timer principal já cuida disso
        console.log(`🔄 Voltando ao estado 'playing' - ${this.timeRemaining}s restantes`);
        
        return { result: 'rejected', yesVotes, noVotes };
    }
}
  
  voteConfirmation(playerId, vote) {
    if (this.gameState !== 'voting_confirmation') return false;
    
    this.votingConfirmation.set(playerId, vote);
    
    // Se todos votaram, processar imediatamente
    if (this.votingConfirmation.size === this.players.size) {
        if (this.votingConfirmationTimer) {
            clearTimeout(this.votingConfirmationTimer);
            this.votingConfirmationTimer = null;
        }
        return this.processVotingConfirmation();
    }
    
    return { waiting: true, voted: this.votingConfirmation.size, total: this.players.size };
}
  
  spyGuessLocation(guess) {
    if (guess.toLowerCase() === this.location.toLowerCase()) {
      this.endGame('spy_wins');
      return true;
    }
    return false;
  }

  endGame(result = null) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    let gameResult = result;
    
    if (!gameResult) {
      const voteCounts = new Map();
      this.votes.forEach(vote => {
        voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
      });
      
      const mostVoted = Array.from(voteCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      
      if (mostVoted && mostVoted[0] === this.spy) {
        gameResult = 'town_wins';
      } else {
        gameResult = 'spy_wins';
      }
    }

    this.players.forEach(player => {
      if (gameResult === 'spy_wins') {
        if (player.id === this.spy) {
          player.score += result === 'spy_wins' ? 3 : 2;
        }
      } else {
        if (player.id !== this.spy) {
          player.score += 1;
        }
      }
    });

    this.gameState = 'ended';
    this.lastResult = gameResult;
    return { result: gameResult, spy: this.spy, location: this.location };
  }

  resetGame() {
    // Resetar estado do jogo mantendo os jogadores e pontuações
    this.gameState = 'waiting';
    this.location = null;
    this.spy = null;
    this.currentPlayer = null;
    this.playerOrder = [];
    this.timeRemaining = 0;
    this.votes.clear();
    this.lastResult = null;
    this.playerProfessions.clear();
    this.availableLocations = []; // MUDANÇA 3: Adicionar esta linha
    this.playerProfessionImages.clear(); // ADICIONAR
    this.locationImage = null; // ADICIONAR
    
    // Parar timer se estiver rodando
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    console.log(`Sala ${this.code} resetada para novo jogo`);
    return true;
  }
}

// Rotas
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/room/:code', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

app.post('/create-room', (req, res) => {
  const { playerName, timeLimit, locationsCount, hasProfessions } = req.body; // ADICIONAR hasProfessions
  
  // Validar nome
  if (!playerName || playerName.trim().length === 0) {
    return res.json({ success: false, message: 'Nome é obrigatório' });
  }
  
  if (playerName.trim().length > 20) {
    return res.json({ success: false, message: 'Nome muito longo (máximo 20 caracteres)' });
  }
  
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const playerId = uuidv4();
  
  const room = new Room(roomCode, playerId);
  room.timeLimit = timeLimit || 300;
  room.locationsCount = locationsCount || 50;
  room.hasProfessions = hasProfessions !== false; // ADICIONAR (padrão true)
  
  const result = room.addPlayer(playerId, playerName.trim(), null);
  
  if (result.error) {
    return res.json({ success: false, message: result.error });
  }
  
  activeRooms.set(roomCode, room);
  room.scheduleInactivityDelete();
  
  res.json({ 
    roomCode, 
    playerId, 
    playerCode: result.playerCode,
    success: true 
  });
});

// Configurações do Socket.io para detectar desconexões mais rapidamente
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err.req, err.code, err.message, err.context);
});

// Configurar timeout de ping
io.engine.pingTimeout = 5000000; // 5 segundos
io.engine.pingInterval = 3000000; // 3 segundos

// Socket.io eventos - ÚNICO BLOCO
io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);
  
  // Configurar timeout específico para este socket
  socket.conn.on('close', (reason) => {
    console.log('Socket closed:', socket.id, 'Reason:', reason);
  });

  socket.on('join-room', async (data) => {
    const { roomCode, playerName, playerId, playerCode } = data;
    const room = activeRooms.get(roomCode);
    
    if (!room) {
      socket.emit('error', { message: 'Sala não encontrada' });
      return;
    }

    let currentPlayerId = playerId;
    let currentPlayerCode = playerCode;

    // Verificar se é reconexão NESTA SALA ESPECÍFICA
    // Verificar se é reconexão NESTA SALA ESPECÍFICA
if (playerId && playerCode) {
    const reconnectResult = room.reconnectPlayer(playerId, playerCode, socket.id);
    
    if (reconnectResult.success) {
        // Jogador reconectado com sucesso
        socket.join(roomCode);
        socket.playerId = playerId;
        socket.roomCode = roomCode;
        currentPlayerId = playerId;
        currentPlayerCode = playerCode;
        console.log(`🔗 Reconexão automática: ${playerName} na sala ${roomCode}`);
        
        // Limpar timeout de cleanup se existir
        room.cancelDelete();
    } else {
        // Código/ID inválido, criar novo jogador
        console.log(`❌ Dados inválidos para ${playerName}, criando novo jogador`);
        
        const newPlayerId = uuidv4();
        const result = room.addPlayer(newPlayerId, playerName, socket.id);
        
        if (result.error) {
          socket.emit('error', { message: result.error });
          return;
        }
        
        currentPlayerId = newPlayerId;
        currentPlayerCode = result.playerCode;
        socket.join(roomCode);
        socket.playerId = currentPlayerId;
        socket.roomCode = roomCode;
        console.log(`Novo jogador ${playerName} criado na sala ${roomCode}`);
    }
    } else {
      // Nova entrada sem dados salvos
      currentPlayerId = uuidv4();
      const result = room.addPlayer(currentPlayerId, playerName, socket.id);
      
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      
      currentPlayerCode = result.playerCode;
      socket.join(roomCode);
      socket.playerId = currentPlayerId;
      socket.roomCode = roomCode;
      console.log(`Novo jogador $${playerName} criado na sala $${roomCode}`);
    }
    
    // Cancelar deleção se estava agendada
    room.cancelDelete();
    
    socket.emit('joined-room', {
      roomCode,
      playerId: currentPlayerId,
      playerCode: currentPlayerCode,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isOwner: p.isOwner,
        score: p.score
      })),
      gameState: room.gameState,
      timeRemaining: room.timeRemaining,
      currentPlayer: room.currentPlayer,
      playerOrder: room.playerOrder
    });
    
    // Enviar informações específicas do jogo se estiver em andamento
    // Enviar informações específicas do jogo se estiver em andamento
    if (room.gameState === 'playing') {
      const player = room.players.get(currentPlayerId);
      
      if (player.id === room.spy) {
        console.log(`🕵️ Enviando dados completos do espião para ${player.name} na reconexão`);
        socket.emit('game-started', {
            isSpy: true,
            locations: Object.keys(locationsWithProfessions).slice(0, room.locationsCount),
            currentPlayer: room.currentPlayer,
            firstQuestionPlayer: room.firstQuestionPlayer,
            playerOrder: room.playerOrder,
            timeRemaining: room.timeRemaining,
            hasProfessions: room.hasProfessions,
            location: undefined, // Espião não deve saber o local
            profession: undefined // Espião não tem profissão
        });
      } else {
        console.log(`👤 Enviando dados completos para ${player.name} na reconexão:`);
        console.log(`   - Local: ${room.location}`);
        console.log(`   - Profissão: ${room.hasProfessions ? room.playerProfessions.get(player.id) : 'Nenhuma'}`);
        console.log(`   - hasProfessions: ${room.hasProfessions}`);
        console.log(`   - locationImage: ${room.locationImage}`);
        console.log(`   - professionImage: ${room.playerProfessionImages.get(player.id)}`);
        
        socket.emit('game-started', {
            isSpy: false,
            location: room.location,
            profession: room.hasProfessions ? room.playerProfessions.get(player.id) : null,
            locationImage: room.locationImage, // CORREÇÃO: Enviar imagem se já carregada
            professionImage: room.hasProfessions ? room.playerProfessionImages.get(player.id) : null, // CORREÇÃO
            locations: Object.keys(locationsWithProfessions).slice(0, room.locationsCount),
            currentPlayer: room.currentPlayer,
            firstQuestionPlayer: room.firstQuestionPlayer,
            playerOrder: room.playerOrder,
            timeRemaining: room.timeRemaining,
            hasProfessions: room.hasProfessions
        });
      }
    }
    } else if (room.gameState === 'voting') {
      // Se estiver em votação, mostrar modal de votação
      socket.emit('voting-started', {
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name
        }))
      });
    } else if (room.gameState === 'ended') {
      // Se jogo terminou, mostrar resultado
      socket.emit('game-ended', {
        result: room.lastResult || 'spy_wins',
        spy: room.spy,
        location: room.location
      });
    }

    socket.to(roomCode).emit('player-joined', {
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        isOwner: p.isOwner,
        score: p.score
      }))
    });
  });

  socket.on('start-game', async () => {
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    
    // NOVA LÓGICA: Qualquer jogador pode iniciar se não há owner, OU se é o owner
    const player = room?.players.get(socket.playerId);
    const canStartGame = room && player && (player.isOwner || room.owner === null);
    
    if (!canStartGame) {
        console.log(`Jogador ${player?.name} tentou iniciar jogo sem permissão`);
        return;
    }

    try {
        const gameStarted = await room.startGame();
        if (gameStarted) {
            room.players.forEach((player) => {
                const playerSocket = io.sockets.sockets.get(player.socketId);
                if (playerSocket) {
                    playerSocket.playerId = player.id;
                    playerSocket.roomCode = roomCode;
                    
                    if (player.id === room.spy) {
                       playerSocket.emit('game-started', { // ← Usar socket
                            isSpy: true,
                            locations: Object.keys(locationsWithProfessions).slice(0, room.locationsCount),
                            currentPlayer: room.currentPlayer,
                            firstQuestionPlayer: room.firstQuestionPlayer, // NOVA PROPRIEDADE
                            playerOrder: room.playerOrder,
                            timeRemaining: room.timeRemaining
                        });
                    } else {
                        console.log(`📤 Enviando dados para ${player.name} (não-espião):`);
                        console.log(`   - Local: ${room.location}`);
                        console.log(`   - Profissão: ${room.hasProfessions ? room.playerProfessions.get(player.id) : 'Nenhuma'}`);
                        console.log(`   - hasProfessions: ${room.hasProfessions}`);
                        
                       playerSocket.emit('game-started', { 
                            isSpy: false,
                            location: room.location,
                            profession: room.hasProfessions ? room.playerProfessions.get(player.id) : null,
                            locationImage: null, // Será carregado depois
                            professionImage: null, // Será carregado depois
                            locations: Object.keys(locationsWithProfessions).slice(0, room.locationsCount),
                            currentPlayer: room.currentPlayer,
                            firstQuestionPlayer: room.firstQuestionPlayer,
                            playerOrder: room.playerOrder,
                            timeRemaining: room.timeRemaining,
                            hasProfessions: room.hasProfessions
                        });
                    }
                }
            });

            // Timer code continua igual...
            const timerInterval = setInterval(() => {
                // MUDANÇA: Permitir que continue rodando mesmo em voting_confirmation
                if (room.gameState !== 'playing' && room.gameState !== 'voting_confirmation') {
                    clearInterval(timerInterval);
                    return;
                }
            
                // Só emitir timer-update se estiver jogando (não durante confirmação)
                if (room.gameState === 'playing') {
                    io.to(roomCode).emit('timer-update', {
                        timeRemaining: room.timeRemaining
                    });
                }
                
                if (room.timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    console.log(`⏰ Tempo esgotado na sala ${roomCode}, iniciando votação`);
                    if (room.startVoting()) {
                        io.to(roomCode).emit('voting-started', {
                            players: Array.from(room.players.values()).map(p => ({
                                id: p.id,
                                name: p.name
                            }))
                        });
                    }
                }
            }, 1000);
        }
    } catch (error) {
        console.error('Erro ao iniciar jogo:', error);
        socket.emit('error', { message: 'Erro ao iniciar jogo' });
    }
});

  socket.on('start-voting', () => {
    console.log('Recebido start-voting de:', socket.playerId);
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    const player = room?.players.get(socket.playerId);
    
    if (!room || !player || room.gameState !== 'playing') {
        console.log('Bloqueado: sala não encontrada ou estado inválido');
        return;
    }

    // Verificar se não é espião
    if (player.id !== room.spy) {
        console.log(`Jogador ${player.name} (não-espião) iniciou confirmação de votação`);
        const result = room.startVotingConfirmation(socket.playerId);
        
        if (result) {
            io.to(roomCode).emit('voting-confirmation-started', {
                initiator: result.initiator,
                timeLimit: 10
            });
        }
    } else {
        console.log(`Jogador ${player.name} é espião - não pode iniciar votação`);
    }
});

  socket.on('vote-confirmation', (data) => {
    console.log('Recebido vote-confirmation:', data, 'de:', socket.playerId);
    const { vote } = data; // 'yes' ou 'no'
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    
    if (!room || room.gameState !== 'voting_confirmation') {
        return;
    }

    const result = room.voteConfirmation(socket.playerId, vote);
    
    if (result.waiting) {
        // Ainda esperando mais votos
        io.to(roomCode).emit('voting-confirmation-update', {
            voted: result.voted,
            total: result.total
        });
    } else {
        // Processamento completo
        io.to(roomCode).emit('voting-confirmation-result', {
            approved: result.result === 'approved',
            yesVotes: result.yesVotes,
            noVotes: result.noVotes
        });
        
        if (result.result === 'approved') {
            console.log('🗳️ Enviando evento voting-started');
            // Iniciar votação real
            io.to(roomCode).emit('voting-started', {
                players: Array.from(room.players.values()).map(p => ({
                    id: p.id,
                    name: p.name
                }))
            });
        } else {
            // CORREÇÃO: Quando votação é rejeitada, mandar timer update imediato
            console.log('❌ Votação rejeitada, continuando jogo normal');
            setTimeout(() => {
                io.to(roomCode).emit('timer-update', {
                    timeRemaining: room.timeRemaining
                });
            }, 100); // Pequeno delay para garantir que o modal feche primeiro
        }
    }
});
  
  socket.on('spy-guess', (data) => {
    console.log('Recebido spy-guess:', data, 'de:', socket.playerId);
    const { guess } = data;
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    const player = room?.players.get(socket.playerId);
    
    if (!room || !player || player.id !== room.spy) {
      return;
    }

    // Notificar todos que o espião está chutando
    io.to(roomCode).emit('spy-guessing', { guess });

    if (room.spyGuessLocation(guess)) {
      // Espião acertou - ganha o jogo
      const result = room.endGame('spy_wins');
      io.to(roomCode).emit('game-ended', result);
    } else {
      // Espião errou - perde o jogo imediatamente
      console.log('Espião errou o local, cidade vence');
      const result = room.endGame('town_wins');
      io.to(roomCode).emit('game-ended', result);
    }
  });

  socket.on('vote', (data) => {
    console.log('Recebido vote:', data, 'de:', socket.playerId);
    const { votedFor } = data;
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    
    if (!room || room.gameState !== 'voting') {
      return;
    }

    room.vote(socket.playerId, votedFor);
    
    // Verificar se todos votaram
    if (room.votes.size === room.players.size) {
      const result = room.endGame();
      io.to(roomCode).emit('game-ended', result);
    } else {
      io.to(roomCode).emit('vote-cast', {
        votesCount: room.votes.size,
        totalPlayers: room.players.size
      });
    }
  });

  socket.on('reset-game', () => {
    console.log('Recebido reset-game de:', socket.playerId);
    const roomCode = socket.roomCode;
    const room = activeRooms.get(roomCode);
    const player = room?.players.get(socket.playerId);
    
    if (!room || !player) {
      return;
    }

    // Qualquer jogador pode resetar (ou apenas owner se preferir)
    if (room.resetGame()) {
      // Enviar estado resetado para todos na sala
      room.players.forEach((p) => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.emit('game-reset', {
            roomCode,
            players: Array.from(room.players.values()).map(player => ({
              id: player.id,
              name: player.name,
              isOwner: player.isOwner,
              score: player.score
            })),
            gameState: room.gameState
          });
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('📱 Socket desconectado:', socket.id);
    
    // const roomCode = socket.roomCode;
    // const playerId = socket.playerId;
    
    // if (roomCode && playerId) {
    //     const room = activeRooms.get(roomCode);
        
    //     if (room && room.players.has(playerId)) {
    //         const player = room.players.get(playerId);
    //         const wasOwner = player.isOwner;
            
    //         // NÃO remover o jogador, apenas marcar como desconectado
    //         room.markPlayerDisconnected(playerId);
            
    //         // Fazer limpeza de jogadores muito antigos
    //         room.cleanupDisconnectedPlayers();
            
    //         console.log(`📱 ${player.name} desconectado mas mantido na sala ${roomCode}`);
            
    //         // Se ainda tem jogadores conectados
    //         const connectedPlayers = Array.from(room.players.values()).filter(p => p.connected);
            
    //         if (connectedPlayers.length > 0) {
    //             // Cancelar deleção da sala
    //             room.cancelDelete();
                
    //             // Se era owner e saiu, remover ownership
    //             if (wasOwner) {
    //                 room.players.forEach(p => {
    //                     p.isOwner = false;
    //                 });
    //                 room.owner = null;
    //                 console.log(`👑 Owner desconectou, qualquer um pode iniciar agora`);
                    
    //                 // Notificar jogadores conectados
    //                 io.to(roomCode).emit('player-disconnected', {
    //                     playerId: playerId,
    //                     playerName: player.name,
    //                     ownerLeft: true,
    //                     connectedPlayers: connectedPlayers.map(p => ({
    //                         id: p.id,
    //                         name: p.name,
    //                         isOwner: p.isOwner,
    //                         score: p.score,
    //                         connected: p.connected
    //                     }))
    //                 });
    //             } else {
    //                 // Jogador normal desconectou
    //                 io.to(roomCode).emit('player-disconnected', {
    //                     playerId: playerId,
    //                     playerName: player.name,
    //                     ownerLeft: false,
    //                     connectedPlayers: connectedPlayers.map(p => ({
    //                         id: p.id,
    //                         name: p.name,
    //                         isOwner: p.isOwner,
    //                         score: p.score,
    //                         connected: p.connected
    //                     }))
    //                 });
    //             }
                
    //             // Se estava jogando e ficaram poucos jogadores conectados
    //             if (room.gameState === 'playing' && connectedPlayers.length < 3) {
    //                 room.resetGame();
    //                 io.to(roomCode).emit('game-cancelled', {
    //                     message: 'Jogo cancelado - poucos jogadores conectados',
    //                     players: connectedPlayers.map(p => ({
    //                         id: p.id,
    //                         name: p.name,
    //                         isOwner: p.isOwner,
    //                         score: p.score
    //                     })),
    //                     gameState: 'waiting'
    //                 });
    //             }
    //         } else {
    //             // Nenhum jogador conectado - agendar deleção da sala
    //             console.log(`Sala ${roomCode} sem jogadores conectados, agendando limpeza`);
    //             room.scheduleDelete();
    //         }
    //     }
    // }
});

}); // <-- ESTA chave fecha o io.on('connection')

const PORT = process.env.PORT || 7842;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});





















