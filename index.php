<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Velox Consig">
<meta name="theme-color" content="#000000">

<title>VeloxConsig CRM Mobile</title>

<link rel="icon" type="image/jpeg" href="https://i.ibb.co/bM4HXvHD/Logo-VC.jpg">
<link rel="apple-touch-icon" href="https://i.ibb.co/bM4HXvHD/Logo-VC.jpg">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

<link rel="stylesheet" href="https://cdn.datatables.net/2.1.8/css/dataTables.bootstrap5.min.css">
<link rel="stylesheet" href="https://cdn.datatables.net/responsive/3.0.3/css/responsive.bootstrap5.min.css">

<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<!-- ?v= é a versão do deploy. O site fica atrás do Cloudflare, que guarda
     CSS e JS por 4 horas (Cache-Control: max-age=14400): sem trocar a URL,
     uma publicação nova serve HTML atual com script velho. Suba este valor
     a cada deploy que mexa em arquivos de assets/. -->
<link rel="stylesheet" href="assets/css/style.css?v=20260813a">
<link rel="stylesheet" href="assets/css/crm.css?v=20260813a">

<!-- Trava de acesso: precisa rodar antes de qualquer renderização.
     Para desativar o login, basta remover estas duas tags. -->
<script src="assets/js/auth.js?v=20260813a"></script>
<script>exigirAutenticacao();</script>
</head>

<body>


<!-- =========================
     SIDEBAR
     offcanvas-lg: gaveta no celular, fixa a partir de 992px
========================= -->

<nav class="offcanvas-lg offcanvas-start barraLateral" tabindex="-1" id="barraLateral">

    <div class="topoLateral">

        <span class="marcaLateral">VeloxConsig</span>

        <button
            type="button"
            class="btn-close btn-close-white d-lg-none"
            data-bs-dismiss="offcanvas"
            data-bs-target="#barraLateral"
            aria-label="Fechar menu"></button>

    </div>

    <ul class="menuLateral">

        <li>
            <a href="#" id="menuPainel" class="itemMenu ativo" onclick="mostrarSecao('Painel'); return false;">
                <i class="bi bi-speedometer2"></i>
                <span>Painel</span>
            </a>
        </li>

        <li>
            <a href="#" id="menuClientes" class="itemMenu" onclick="mostrarSecao('Clientes'); return false;">
                <i class="bi bi-people"></i>
                <span>Clientes</span>
            </a>
        </li>

        <li>
            <a href="#" id="menuImportacoes" class="itemMenu" onclick="mostrarSecao('Importacoes'); return false;">
                <i class="bi bi-cloud-arrow-up"></i>
                <span>Importações</span>
            </a>
        </li>

    </ul>

    <div class="rodapeLateral">

        <div id="usuarioLogado" class="usuarioLogado"></div>

        <button type="button" class="btnSairLateral" onclick="sair()">
            <i class="bi bi-box-arrow-right"></i>
            Sair
        </button>

    </div>

</nav>


<!-- =========================
     CONTEÚDO
========================= -->

<div class="areaConteudo">

    <header class="barraTopo">

        <button
            class="btnMenu d-lg-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#barraLateral"
            aria-label="Abrir menu">
            <i class="bi bi-list"></i>
        </button>

        <h1 id="tituloSecao">Painel</h1>

    </header>


    <!-- ============ PAINEL ============ -->

    <section id="secaoPainel" class="secaoConteudo ativa">

        <div class="container-fluid">

            <div class="cabecalhoCrud">

                <div>
                    <h2>Fila de atendimento</h2>
                    <p>Clientes da API com oferta disponível, mais os leads importados por planilha — estes entram mesmo antes de ter oferta. Todos com celular cadastrado.</p>
                </div>

                <div class="acoesCrud">

                    <button type="button" class="btnSecundario" onclick="carregarPainel()">
                        <i class="bi bi-arrow-clockwise"></i>
                        Atualizar
                    </button>

                </div>

            </div>

            <!-- Filtro pela data de criação do cliente. -->
            <div class="filtrosPainel">

                <button type="button" id="filtroHoje" class="chipFiltro" onclick="filtrarPainelPor('hoje')">
                    Hoje
                </button>

                <button type="button" id="filtroOntem" class="chipFiltro" onclick="filtrarPainelPor('ontem')">
                    Ontem
                </button>

                <button type="button" id="filtroTodos" class="chipFiltro" onclick="filtrarPainelPor('todos')">
                    Todos
                </button>

                <label id="campoDataPainel" class="campoDataPainel" for="dataPainel">
                    <i class="bi bi-calendar-event"></i>
                    <input
                        type="date"
                        id="dataPainel"
                        aria-label="Selecionar data"
                        onchange="filtrarPainelPorData(this.value)">
                </label>

                <!-- Vale junto com o filtro de data, não no lugar dele. -->
                <button type="button" id="filtroNaoContatado" class="chipFiltro chipContato" onclick="alternarNaoContatados()">
                    <i class="bi bi-person-dash"></i>
                    Não contatados
                </button>

                <!-- Leads da última importação. Fica oculto até existir uma;
                     o rótulo e a contagem vêm de marcarChipImportados(). -->
                <button type="button" id="filtroImportados" class="chipFiltro chipImportados" style="display:none" onclick="alternarImportados()">
                    <i class="bi bi-box-arrow-in-down"></i>
                    <span class="rotuloChip">Importados agora</span>
                </button>

                <!-- Mesmos dados, duas apresentações. -->
                <div class="visoesPainel">

                    <button type="button" id="visaoTabela" class="chipVisao ativo" onclick="alternarVisaoPainel('tabela')" title="Ver em tabela">
                        <i class="bi bi-table"></i>
                        Tabela
                    </button>

                    <button type="button" id="visaoCards" class="chipVisao" onclick="alternarVisaoPainel('cards')" title="Ver em cards">
                        <i class="bi bi-grid-3x3-gap"></i>
                        Cards
                    </button>

                </div>

            </div>

            <div id="avisoPainel" class="avisoClientes"></div>

            <div id="caixaPainel" class="caixaTabela">

                <table id="tabelaPainel" class="table table-striped nowrap" style="width:100%"></table>

                <!-- Movido para dentro do layout do DataTables ao iniciar a tabela. -->
                <div id="cardsPainel" class="cardsPainel"></div>

            </div>

        </div>

    </section>


    <!-- ============ CLIENTES (CRUD) ============ -->

    <section id="secaoClientes" class="secaoConteudo">

        <div class="container-fluid">

            <div class="cabecalhoCrud">

                <div>
                    <h2>Cadastro de clientes</h2>
                    <p>Registros sincronizados com a API.</p>
                </div>

                <div class="acoesCrud">

                    <button type="button" class="btnSecundario" onclick="carregarClientes()" title="Trazer todos os clientes (pode demorar)">
                        <i class="bi bi-list-ul"></i>
                        Carregar todos
                    </button>

                    <button type="button" class="btnSecundario" onclick="sincronizarPainel()" title="Levar estes clientes para o Painel">
                        <i class="bi bi-arrow-left-right"></i>
                        Sincronizar com o Painel
                    </button>

                    <button type="button" class="btnPrimario" onclick="abrirModalCliente()">
                        <i class="bi bi-plus-lg"></i>
                        Novo cliente
                    </button>

                </div>

            </div>

            <!-- A tela não carrega nada sozinha: a busca é o caminho normal. -->
            <div class="buscaCrud">

                <input
                    type="search"
                    id="buscaCliente"
                    placeholder="CPF ou nome do cliente"
                    autocomplete="off"
                    onkeydown="if(event.key === 'Enter'){ event.preventDefault(); consultarClientes(); }">

                <button type="button" class="btnPrimario" onclick="consultarClientes()">
                    <i class="bi bi-search"></i>
                    Consultar
                </button>

            </div>

            <div id="avisoClientes" class="avisoClientes"></div>

            <div class="caixaTabela">
                <table id="tabelaClientes" class="table table-striped nowrap" style="width:100%"></table>
            </div>

        </div>

    </section>


    <!-- ============ IMPORTAÇÕES (CRUD) ============ -->

    <section id="secaoImportacoes" class="secaoConteudo">

        <div class="container-fluid">

            <div class="cabecalhoCrud">

                <div>
                    <h2>Importações de clientes</h2>
                    <p>Envie a planilha para a API processar e gerar os clientes.</p>
                </div>

                <div class="acoesCrud">

                    <button type="button" class="btnSecundario" onclick="carregarImportacoes()">
                        <i class="bi bi-arrow-clockwise"></i>
                        Atualizar
                    </button>

                    <button type="button" class="btnPrimario" onclick="abrirModalImportacao()">
                        <i class="bi bi-cloud-arrow-up"></i>
                        Nova importação
                    </button>

                </div>

            </div>

            <div id="avisoImportacoes" class="avisoClientes"></div>

            <div class="caixaTabela">
                <table id="tabelaImportacoes" class="table table-striped nowrap" style="width:100%"></table>
            </div>

        </div>

    </section>

</div>


<!-- =========================
     MODAL CLIENTE
========================= -->

<div class="modal fade" id="modalCliente" tabindex="-1" aria-hidden="true">
 <div class="modal-dialog modal-dialog-centered">
  <div class="modal-content modalClienteConteudo">

   <div class="modal-header">
    <h5 class="modal-title" id="tituloModalCliente">Novo cliente</h5>
    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
   </div>

   <div class="modal-body">

    <input type="hidden" id="clienteIdApi">

    <label class="form-label fw-bold" for="clienteNome">Nome</label>
    <input type="text" id="clienteNome" class="form-control campoCliente" placeholder="Nome completo" autocomplete="off">

    <label class="form-label fw-bold mt-3" for="clienteCpf">CPF</label>
    <input type="text" id="clienteCpf" class="form-control campoCliente" placeholder="000.000.000-00" inputmode="numeric" autocomplete="off">

    <label class="form-label fw-bold mt-3" for="clienteCelular">Celular</label>
    <input type="text" id="clienteCelular" class="form-control campoCliente" placeholder="(11) 91234-5678" inputmode="tel" autocomplete="off">

    <label class="form-label fw-bold mt-3" for="clienteEmail">E-mail</label>
    <input type="email" id="clienteEmail" class="form-control campoCliente" placeholder="cliente@email.com" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">

    <!-- Margens vêm das consultas bancárias, não do operador: exibidas, não editáveis. -->
    <div id="margensCliente" class="margensCliente"></div>

    <div id="erroCliente" class="erroCliente" role="alert"></div>

   </div>

   <div class="modal-footer">
    <button type="button" class="btnSecundario" data-bs-dismiss="modal">Cancelar</button>
    <button type="button" id="btnSalvarCliente" class="btnPrimario" onclick="salvarCliente()">Salvar</button>
   </div>

  </div>
 </div>
</div>


<!-- =========================
     MODAL IMPORTAÇÃO
========================= -->

<div class="modal fade" id="modalImportacao" tabindex="-1" aria-hidden="true">
 <div class="modal-dialog modal-dialog-centered">
  <div class="modal-content modalClienteConteudo">

   <div class="modal-header">
    <h5 class="modal-title">Nova importação</h5>
    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
   </div>

   <div class="modal-body">

    <p class="ajudaImportacao">
     Envie a planilha de clientes (.xlsx, .xls ou .csv). O processamento é feito pela API.
    </p>

    <pre class="modeloCsv">nome;telefone;cpf
JOSE DA SILVA;11912345678;50181123878</pre>

    <label for="arquivoImportacao" class="areaUpload">
     <i class="bi bi-cloud-arrow-up"></i>
     <strong>Escolher arquivo</strong>
     <span id="nomeArquivoEscolhido">Nenhum arquivo selecionado</span>
    </label>

    <input
     type="file"
     id="arquivoImportacao"
     class="entradaArquivo"
     accept=".xlsx,.xls,.csv"
     onchange="selecionarArquivoImportacao(event)">

    <div id="erroImportacao" class="erroCliente" role="alert"></div>

   </div>

   <div class="modal-footer">
    <button type="button" class="btnSecundario" data-bs-dismiss="modal">Cancelar</button>
    <button type="button" id="btnEnviarImportacao" class="btnPrimario" onclick="enviarImportacao()">Enviar</button>
   </div>

  </div>
 </div>
</div>


<!-- =========================
     MODAL PROPOSTA
========================= -->

<div class="modal fade" id="modalProposta" tabindex="-1" aria-hidden="true">
 <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
  <div class="modal-content modalPropostaConteudo">
   <div class="modal-header"><h5 class="modal-title">✨ Montar proposta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
   <div class="modal-body">
    <div id="clienteProposta" class="clienteProposta"></div>
    <div class="cabecalhoTelegram">
    <label class="form-label fw-bold mb-0">Resposta do Telegram</label>
    <button type="button" class="btnLimparProposta" onclick="limparTratador()">Limpar</button>
</div>
    <textarea id="textoTelegram" class="form-control campoProposta" rows="9" placeholder="Toque aqui para colar a resposta do Telegram..." onclick="colarTelegramAutomaticamente()" onfocus="colarTelegramAutomaticamente()"></textarea>
    <button class="btnGerarProposta" onclick="gerarProposta()">✨ Gerar proposta</button>
    <div id="avisoProposta" class="avisoProposta"></div>
    <label class="form-label fw-bold mt-3">Mensagem para o cliente</label>
    <textarea id="mensagemProposta" class="form-control campoProposta" rows="9"></textarea>
   </div>
   <div class="modal-footer modalPropostaAcoes">
    <button class="btnCopiarProposta" onclick="copiarProposta()">Copiar</button>
    <button class="btnEnviarProposta" onclick="enviarPropostaWhatsApp()"><i class="bi bi-whatsapp"></i> WhatsApp</button>
    <button class="btnEnviarTelegram" onclick="enviarPropostaTelegram()"><i class="bi bi-telegram"></i> Telegram</button>
   </div>
  </div>
 </div>
</div>

<!-- =========================
     MODAL PROPOSTAS DO CLIENTE
     Consulta direta do card ou da tabela do Painel.
========================= -->

<div class="modal fade" id="modalPropostas" tabindex="-1" aria-hidden="true">
 <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
  <div class="modal-content modalClienteConteudo">

   <div class="modal-header">
    <h5 class="modal-title">🔎 Propostas do cliente</h5>
    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
   </div>

   <div class="modal-body">
    <div id="clientePropostas" class="clienteProposta"></div>
    <div id="listaPropostasCliente"></div>
   </div>

   <div class="modal-footer">
    <button type="button" class="btnSecundario" data-bs-dismiss="modal">Fechar</button>
   </div>

  </div>
 </div>
</div>


<!-- =========================
     MODAL GERAR CONTRATO (4 etapas)
========================= -->

<div class="modal fade" id="modalContrato" tabindex="-1" aria-hidden="true">
 <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
  <div class="modal-content modalClienteConteudo">

   <div class="modal-header">
    <h5 class="modal-title">📄 Gerar contrato</h5>
    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
   </div>

   <!-- Nenhuma etapa avança sem estar validada. -->
   <div class="passosContrato">
    <div class="passoContrato ativo" id="passoContrato1"><span>1</span> Oferta</div>
    <div class="passoContrato" id="passoContrato2"><span>2</span> Cadastro</div>
    <div class="passoContrato" id="passoContrato3"><span>3</span> Banco</div>
    <div class="passoContrato" id="passoContrato4"><span>4</span> Contrato</div>
   </div>

   <div class="modal-body">

    <div id="clienteContrato" class="clienteProposta"></div>

    <!-- Parcela escolhida na etapa 1: segue visível nas etapas seguintes. -->
    <div id="resumoSelecaoContrato" class="resumoContrato"></div>

    <div id="avisoContrato" class="avisoContrato" role="alert"></div>

    <div id="etapaContrato1" class="etapaContrato"></div>
    <div id="etapaContrato2" class="etapaContrato"></div>
    <div id="etapaContrato3" class="etapaContrato"></div>
    <div id="etapaContrato4" class="etapaContrato"></div>

   </div>

   <div class="modal-footer">

    <!-- Copiar/enviar o texto da etapa atual: ofertas na 1, pedido de dados na
         2, dados bancários na 3, resumo e link na 4. Visíveis sempre. -->
    <div id="acoesOfertaContrato" class="acoesOfertaContrato">

     <button type="button" class="btnLinha btnLinhaCopiar" onclick="copiarTextoContrato()">
      <i class="bi bi-clipboard"></i>
      Copiar
     </button>

     <button type="button" class="btnLinha btnLinhaZap" onclick="enviarTextoContratoWhatsApp()">
      <i class="bi bi-whatsapp"></i>
      WhatsApp
     </button>

     <button type="button" class="btnLinha btnLinhaTelegram" onclick="enviarTextoContratoTelegram()">
      <i class="bi bi-telegram"></i>
      Telegram
     </button>

    </div>

    <button type="button" id="btnVoltarContrato" class="btnSecundario" onclick="voltarEtapaContrato()">Voltar</button>
    <button type="button" id="btnAvancarContrato" class="btnPrimario" onclick="avancarEtapaContrato()">Avançar</button>

   </div>

  </div>
 </div>
</div>

<footer class="rodape">
    VeloxConsig CRM Mobile
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/2.1.8/js/dataTables.min.js"></script>
<script src="https://cdn.datatables.net/2.1.8/js/dataTables.bootstrap5.min.js"></script>
<script src="https://cdn.datatables.net/responsive/3.0.3/js/dataTables.responsive.min.js"></script>
<script src="https://cdn.datatables.net/responsive/3.0.3/js/responsive.bootstrap5.min.js"></script>

<script src="assets/js/toast.js?v=20260813a"></script>
<script src="assets/js/api.js?v=20260813a"></script>
<script src="assets/js/csv.js?v=20260813a"></script>
<script src="assets/js/mensagens.js?v=20260813a"></script>
<script src="assets/js/app.js?v=20260813a"></script>
<script src="assets/js/clientes-crud.js?v=20260813a"></script>
<script src="assets/js/importacoes.js?v=20260813a"></script>
<script src="assets/js/simulacao.js?v=20260813a"></script>
<script src="assets/js/contrato.js?v=20260813a"></script>
<script src="assets/js/painel.js?v=20260813a"></script>

</body>
</html>
