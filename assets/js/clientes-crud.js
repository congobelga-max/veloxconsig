// ===============================
// CRUD DE CLIENTES (sidebar > Clientes)
// Depende de api.js (transporte) e de app.js (formatarCPF, escaparHtml...).
// ===============================

let clientesApi = [];
let tabelaClientes = null;
let tabelaIniciada = false;


// A API expõe dois identificadores: o inteiro `id` e o GUID `key`.
// As rotas usam o `id`; se o backend esperar o GUID, devolva cliente.key aqui.
function identificadorUrl(cliente){

    return cliente.idApi;

}


// ===============================
// MAPEAMENTO API <-> TELA
// Campos conforme o retorno real de /clientes.
// ===============================

function mapearClienteDaApi(registro){

    registro = registro || {};

    const cpf = registro.cpf || "";
    const idLocal = normalizarCpf(cpf);

    return {

        idApi: registro.id,
        key: registro.key || "",

        // Chave local: indexa todo o histórico do operador no localStorage.
        id: idLocal,

        nome: String(registro.nome || "").trim(),
        cpf: formatarCPF(cpf),
        celular: formatarTelefone(registro.celular),
        email: String(registro.email || "").trim(),

        margemDisponivel: Number(registro.margemDisponivel) || 0,
        margemBruta: Number(registro.margemBruta) || 0,

        atualizadoEm: registro.updatedAtUtc || registro.createdAtUtc || "",

        // Registro cru, para uma atualização parcial poder devolver o cadastro
        // inteiro se a rota substituir o recurso.
        bruto: registro,

        // Contato: status (1 não contatado, 2 enviado, 3 contatado) e carimbo.
        contatoStatus: registro.contatoStatus,
        contatadoEm: registro.contatadoEmUtc || "",

        // A API não tem status de margem: esse é local, gravado por CPF.
        status: localStorage.getItem("status_" + idLocal) || "nao"

    };

}


function mapearClienteParaApi(cliente){

    const dados = {
        cpf: normalizarCpf(cliente.cpf),
        nome: cliente.nome,
        celular: somenteNumeros(cliente.celular),
        email: cliente.email
    };

    // Vão junto quando o registro já traz: o PUT substitui o recurso, e
    // omiti-los devolveria o cliente para "não contatado" a cada edição de
    // cadastro — apagando um trabalho que não tem nada a ver com este
    // formulário. Os campos não são editáveis aqui, só preservados.
    if(cliente.contatoStatus !== undefined && cliente.contatoStatus !== null){
        dados.contatoStatus = cliente.contatoStatus;
    }

    if(cliente.contatadoEm){
        dados.contatadoEmUtc = cliente.contatadoEm;
    }

    return dados;

}


function rotuloStatus(status){

    if(status === "com") return "Com margem";
    if(status === "sem") return "Sem margem";

    return "Não consultado";

}


// ===============================
// FORMATAÇÃO
// ===============================

function formatarMoeda(valor){

    return Number(valor || 0).toLocaleString("pt-BR",{
        style:"currency",
        currency:"BRL"
    });

}


function formatarDataHora(iso){

    if(!iso) return "";

    const data = new Date(iso);

    if(isNaN(data.getTime())) return "";

    // O retorno vem em UTC; toLocale converte para o fuso do operador.
    return data.toLocaleDateString("pt-BR") + " " +
        data.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});

}


// ===============================
// VALIDAÇÃO
// ===============================

// Dígitos verificadores do CPF: evita cadastrar registro que nunca
// vai casar com o retorno das consultas bancárias.
function cpfValido(cpf){

    const numeros = somenteNumeros(cpf);

    if(numeros.length !== 11) return false;

    // Sequências repetidas (000..., 111...) passam no cálculo, mas não existem.
    if(/^(\d)\1{10}$/.test(numeros)) return false;

    let soma = 0;

    for(let i = 0; i < 9; i++){
        soma += Number(numeros[i]) * (10 - i);
    }

    let primeiro = (soma * 10) % 11;
    if(primeiro === 10) primeiro = 0;

    if(primeiro !== Number(numeros[9])) return false;

    soma = 0;

    for(let i = 0; i < 10; i++){
        soma += Number(numeros[i]) * (11 - i);
    }

    let segundo = (soma * 10) % 11;
    if(segundo === 10) segundo = 0;

    return segundo === Number(numeros[10]);

}


function emailValido(email){

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}


// ===============================
// TABELA
// ===============================

function iniciarTabelaClientes(){

    if(tabelaIniciada) return;

    tabelaClientes = new DataTable("#tabelaClientes",{

        data: clientesApi,

        columns:[
            {
                title:"Nome",
                data:"nome",
                responsivePriority:1,
                render: valor => escaparHtml(valor)
            },
            {
                title:"CPF",
                data:"cpf",
                responsivePriority:3,
                render: valor => escaparHtml(valor)
            },
            {
                title:"Celular",
                data:"celular",
                responsivePriority:4,
                render: valor => escaparHtml(valor)
            },
            {
                title:"E-mail",
                data:"email",
                responsivePriority:7,
                render: valor => escaparHtml(valor)
            },
            {
                title:"Margem disponível",
                data:"margemDisponivel",
                className:"colunaValor",
                responsivePriority:5,
                // O valor cru é devolvido para ordenação/filtro continuarem numéricos.
                render: (valor, tipo) =>
                    tipo === "display" ? formatarMoeda(valor) : valor
            },
            {
                title:"Margem bruta",
                data:"margemBruta",
                className:"colunaValor",
                responsivePriority:8,
                render: (valor, tipo) =>
                    tipo === "display" ? formatarMoeda(valor) : valor
            },
            {
                title:"Status",
                data:"status",
                responsivePriority:6,
                render: (valor, tipo) =>
                    tipo === "display"
                        ? '<span class="selo selo-' + escaparHtml(valor) + '">' +
                          escaparHtml(rotuloStatus(valor)) + "</span>"
                        : valor
            },
            {
                title:"Atualizado em",
                data:"atualizadoEm",
                responsivePriority:9,
                render: (valor, tipo) =>
                    tipo === "display" ? escaparHtml(formatarDataHora(valor)) : (valor || "")
            },
            {
                title:"Ações",
                data:null,
                orderable:false,
                searchable:false,
                className:"colunaAcoes",
                responsivePriority:2,
                render: (linha, tipo, cliente) =>
                    '<button type="button" class="btnTabela btnEditar" title="Editar" ' +
                    "onclick=\"abrirModalCliente('" + escaparArgumento(cliente.idApi) + "')\">" +
                    '<i class="bi bi-pencil"></i></button>' +
                    '<button type="button" class="btnTabela btnExcluir" title="Excluir" ' +
                    "onclick=\"confirmarExclusaoCliente('" + escaparArgumento(cliente.idApi) + "')\">" +
                    '<i class="bi bi-trash"></i></button>'
            }
        ],

        responsive:true,
        pageLength:10,
        lengthMenu:[10,25,50,100],
        order:[[0,"asc"]],

        // Traduzido aqui em vez de baixar o JSON de idioma da CDN:
        // menos uma requisição externa para falhar.
        language:{
            emptyTable:"Nenhum cliente cadastrado.",
            info:"Mostrando _START_ a _END_ de _TOTAL_ clientes",
            infoEmpty:"Nenhum cliente",
            infoFiltered:"(filtrado de _MAX_ no total)",
            lengthMenu:"Exibir _MENU_ por página",
            loadingRecords:"Carregando...",
            processing:"Processando...",
            search:"Buscar:",
            zeroRecords:"Nenhum cliente encontrado para esta busca.",
            paginate:{
                first:"Primeira",
                last:"Última",
                next:"Próxima",
                previous:"Anterior"
            }
        }

    });

    tabelaIniciada = true;

}


function atualizarTabelaClientes(){

    if(!tabelaClientes) return;

    // O status é local e pode ter mudado no Painel desde a última carga.
    clientesApi.forEach(cliente=>{
        cliente.status = localStorage.getItem("status_" + cliente.id) || "nao";
    });

    tabelaClientes.clear();
    tabelaClientes.rows.add(clientesApi);
    tabelaClientes.draw(false);

}


// ===============================
// CARGA
// ===============================

function semAcento(texto){

    return String(texto || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

}


// Filtro local por CPF ou nome. Vale mesmo quando a API aceita o parâmetro:
// se ela ignorar e devolver tudo, o operador ainda vê só o que procurou.
function filtrarClientes(registros, termo){

    if(!termo) return registros;

    const digitos = somenteNumeros(termo);
    const texto = semAcento(termo);

    return registros.filter(cliente=>{

        if(digitos.length >= 3 && somenteNumeros(cliente.cpf).indexOf(digitos) >= 0){
            return true;
        }

        return semAcento(cliente.nome).indexOf(texto) >= 0;

    });

}


function consultarClientes(){

    const campo = document.getElementById("buscaCliente");

    return carregarClientes(campo ? campo.value.trim() : "");

}


// Sem `termo` traz a lista inteira. A tela não chama isto sozinha: a carga é
// demorada e atrapalha quem entrou só para cadastrar um cliente novo.
async function carregarClientes(termo){

    const aviso = document.getElementById("avisoClientes");

    mostrarAvisoClientes(
        termo ? 'Procurando "' + termo + '"...' : "Carregando todos os clientes...",
        "info"
    );

    try{

        // CPF completo vai como parâmetro; se a API filtrar, a resposta chega
        // menor e mais rápida.
        const cpf = somenteNumeros(termo);

        const registros = await apiListarClientes(
            cpf.length === 11 ? {cpf: cpf} : null
        );

        clientesApi = filtrarClientes(
            registros
                .map(mapearClienteDaApi)
                .filter(cliente => cliente.nome || cliente.cpf),
            termo
        );

        iniciarTabelaClientes();
        atualizarTabelaClientes();

        if(!clientesApi.length && termo){

            mostrarAvisoClientes(
                'Nenhum cliente encontrado para "' + termo + '".',
                "info"
            );

            return;

        }

        if(aviso) aviso.style.display = "none";

    }catch(erro){

        // Sem dados na tela, o operador precisa saber por quê.
        iniciarTabelaClientes();

        mostrarAvisoClientes(erro.message + " ", "erro", true);

        console.error("Falha ao listar clientes:", erro);

    }

}


function mostrarAvisoClientes(texto, tipo, comBotao){

    const aviso = document.getElementById("avisoClientes");

    if(!aviso) return;

    aviso.className = "avisoClientes aviso-" + (tipo || "info");
    aviso.textContent = texto;
    aviso.style.display = "block";

    if(comBotao){

        const botao = document.createElement("button");

        botao.type = "button";
        botao.className = "btnTentarNovamente";
        botao.textContent = "Tentar novamente";
        botao.onclick = carregarClientes;

        aviso.appendChild(botao);

    }

}


// ===============================
// MODAL
// ===============================

function abrirModalCliente(idApi){

    const cliente = idApi
        ? clientesApi.find(c => String(c.idApi) === String(idApi))
        : null;

    document.getElementById("clienteIdApi").value = cliente ? cliente.idApi : "";
    document.getElementById("clienteNome").value = cliente ? cliente.nome : "";
    document.getElementById("clienteCpf").value = cliente ? cliente.cpf : "";
    document.getElementById("clienteCelular").value = cliente ? cliente.celular : "";
    document.getElementById("clienteEmail").value = cliente ? cliente.email : "";

    document.getElementById("tituloModalCliente").textContent =
        cliente ? "Editar cliente" : "Novo cliente";

    // O CPF é a chave do histórico local; alterá-lo desligaria o cliente
    // do trabalho já registrado, então só é editável no cadastro.
    document.getElementById("clienteCpf").readOnly = !!cliente;

    // As margens vêm das consultas bancárias, não do operador.
    const resumo = document.getElementById("margensCliente");

    if(cliente){

        resumo.textContent =
            "Margem disponível: " + formatarMoeda(cliente.margemDisponivel) +
            "  ·  Margem bruta: " + formatarMoeda(cliente.margemBruta);

        resumo.style.display = "block";

    }else{

        resumo.textContent = "";
        resumo.style.display = "none";

    }

    limparErroCliente();

    bootstrap.Modal
        .getOrCreateInstance(document.getElementById("modalCliente"))
        .show();

}


function fecharModalCliente(){

    bootstrap.Modal
        .getOrCreateInstance(document.getElementById("modalCliente"))
        .hide();

}


function mostrarErroCliente(mensagem){

    const caixa = document.getElementById("erroCliente");

    caixa.textContent = mensagem;
    caixa.style.display = "block";

}


function limparErroCliente(){

    const caixa = document.getElementById("erroCliente");

    caixa.textContent = "";
    caixa.style.display = "none";

}


function salvandoCliente(ativo){

    const botao = document.getElementById("btnSalvarCliente");

    botao.disabled = ativo;
    botao.textContent = ativo ? "Salvando..." : "Salvar";

}


async function salvarCliente(){

    limparErroCliente();

    const idApi = document.getElementById("clienteIdApi").value;

    const dados = {
        nome: document.getElementById("clienteNome").value.trim(),
        cpf: document.getElementById("clienteCpf").value.trim(),
        celular: document.getElementById("clienteCelular").value.trim(),
        email: document.getElementById("clienteEmail").value.trim()
    };

    if(!dados.nome){
        mostrarErroCliente("Informe o nome do cliente.");
        return;
    }

    if(!cpfValido(dados.cpf)){
        mostrarErroCliente("CPF inválido. Confira os 11 dígitos.");
        return;
    }

    const celularNumeros = somenteNumeros(dados.celular);

    if(celularNumeros.length !== 10 && celularNumeros.length !== 11){
        mostrarErroCliente("Celular inválido. Use DDD + número.");
        return;
    }

    if(dados.email && !emailValido(dados.email)){
        mostrarErroCliente("E-mail inválido.");
        return;
    }

    // CPF duplicado é rejeitado aqui para não depender da API ter a restrição.
    const duplicado = clientesApi.find(c =>
        c.id === normalizarCpf(dados.cpf) &&
        String(c.idApi) !== String(idApi)
    );

    if(duplicado){
        mostrarErroCliente("Já existe um cliente cadastrado com este CPF.");
        return;
    }

    salvandoCliente(true);

    try{

        const enviado = mapearClienteParaApi(dados);
        const anterior = clientesApi.find(c => String(c.idApi) === String(idApi));

        // As margens não são editadas aqui, mas voltam no PUT: se a rota
        // substituir o recurso inteiro, não enviá-las as zeraria.
        if(anterior){
            enviado.margemDisponivel = anterior.margemDisponivel;
            enviado.margemBruta = anterior.margemBruta;
        }

        const retorno = idApi
            ? await apiAtualizarCliente(identificadorUrl(anterior || {idApi:idApi}), enviado)
            : await apiCriarCliente(enviado);

        // A API pode devolver o registro completo, apenas o id, ou nada.
        // Os dados enviados formam a base e o retorno completa/sobrescreve:
        // sem isso, uma resposta parcial apagaria a linha na tabela.
        const salvo = mapearClienteDaApi(
            Object.assign({}, enviado, retorno || {})
        );

        if(salvo.idApi == null || salvo.idApi === "") salvo.idApi = idApi;

        fecharModalCliente();

        if(salvo.idApi == null || salvo.idApi === ""){

            // Cadastro aceito, mas sem id conhecido: recarrega para obtê-lo,
            // senão editar e excluir ficariam sem alvo.
            await carregarClientes();
            return;

        }

        const indice = clientesApi.findIndex(c => String(c.idApi) === String(salvo.idApi));

        if(indice >= 0){
            clientesApi[indice] = salvo;
        }else{
            clientesApi.push(salvo);
        }

        atualizarTabelaClientes();

    }catch(erro){

        mostrarErroCliente(erro.message);
        console.error("Falha ao salvar cliente:", erro);

    }finally{

        salvandoCliente(false);

    }

}


async function confirmarExclusaoCliente(idApi){

    const cliente = clientesApi.find(c => String(c.idApi) === String(idApi));

    if(!cliente) return;

    if(!confirm('Excluir "' + cliente.nome + '"?\n\nEsta ação não pode ser desfeita.')){
        return;
    }

    try{

        await apiExcluirCliente(identificadorUrl(cliente));

        clientesApi = clientesApi.filter(c => String(c.idApi) !== String(idApi));

        atualizarTabelaClientes();

    }catch(erro){

        notificar("Não foi possível excluir: " + erro.message, "erro");
        console.error("Falha ao excluir cliente:", erro);

    }

}


// ===============================
// SINCRONIZAÇÃO COM O PAINEL
// O Painel lê a própria API (painel.js), então sincronizar é recarregá-lo e
// levar o operador até lá. Vai sempre a lista completa — não o recorte que
// estiver na tabela de Clientes —, e o Painel aplica o critério dele: entra
// quem tem celular discável e CPF.
// ===============================

function sincronizarPainel(){

    // Sem isto o Painel abriria no filtro "Hoje" e pareceria vazio: quem foi
    // cadastrado em outro dia sumiria logo depois de sincronizar. Os recortes
    // da última importação e de oferta saem pelo mesmo motivo — sincronizar
    // deve mostrar o que veio, não o que sobrou de um filtro anterior.
    filtroDataPainel = "todos";
    dataEscolhidaPainel = "";
    somenteImportados = false;
    somenteComOferta = false;

    const entrada = document.getElementById("dataPainel");

    if(entrada) entrada.value = "";

    marcarFiltroAtivo();

    carregarPainel();

    mostrarSecao("Painel");

}


// ===============================
// NAVEGAÇÃO DA SIDEBAR
// ===============================

const TITULOS_SECAO = {
    Painel:"Painel",
    Clientes:"Clientes",
    Importacoes:"Importações"
};


function mostrarSecao(secao){

    document
        .querySelectorAll(".secaoConteudo")
        .forEach(s => s.classList.remove("ativa"));

    document
        .querySelectorAll(".itemMenu")
        .forEach(i => i.classList.remove("ativo"));

    const alvo = document.getElementById("secao" + secao);
    const item = document.getElementById("menu" + secao);

    if(alvo) alvo.classList.add("ativa");
    if(item) item.classList.add("ativo");

    document.getElementById("tituloSecao").textContent =
        TITULOS_SECAO[secao] || "Painel";

    if(secao === "Painel"){

        if(!tabelaPainelIniciada){

            carregarPainel();

        }else{

            // A tabela pode ter sido montada oculta: as colunas são remedidas.
            tabelaPainel.columns.adjust().responsive.recalc();

        }

    }

    if(secao === "Clientes"){

        if(!tabelaIniciada){

            // Tabela vazia, sem buscar nada: a lista completa é lenta e quem
            // entra aqui em geral quer cadastrar ou consultar um cliente só.
            iniciarTabelaClientes();

            mostrarAvisoClientes(
                "Consulte pelo CPF ou nome, ou carregue a lista completa.",
                "info"
            );

        }else{

            // A tabela foi montada oculta: as colunas precisam ser remedidas.
            atualizarTabelaClientes();
            tabelaClientes.columns.adjust().responsive.recalc();

        }

    }

    if(secao === "Importacoes"){

        if(!tabelaImportacoesIniciada){

            carregarImportacoes();

        }else{

            tabelaImportacoes.columns.adjust().responsive.recalc();

        }

    }

    // Em telas pequenas a sidebar é um offcanvas e precisa fechar após o clique.
    const lateral = document.getElementById("barraLateral");
    const instancia = bootstrap.Offcanvas.getInstance(lateral);

    if(instancia) instancia.hide();

}
