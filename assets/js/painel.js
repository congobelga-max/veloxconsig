// ===============================
// PAINEL — CLIENTES COM OFERTA
// Tabela sobre /clientes: entram apenas os registros com oferta e com celular.
// Depende de api.js (transporte) e de app.js (helpers, WhatsApp, proposta).
// ===============================

let painelClientes = [];

let tabelaPainel = null;
let tabelaPainelIniciada = false;

// hoje | ontem | data | todos
let filtroDataPainel = "hoje";

// Filtro independente do de data: esconde quem já recebeu o primeiro contato.
let somenteNaoContatados = false;

// Terceira dimensão, também independente: só os leads que entraram na última
// importação (importacoes.js grava a lista de CPFs).
let somenteImportados = false;

// AAAA-MM-DD, no formato que o <input type="date"> devolve.
let dataEscolhidaPainel = "";

// tabela | cards
let visaoPainel = "tabela";


// ===============================
// OFERTAS
// O nome do campo ainda não foi confirmado no retorno de /clientes, então as
// grafias prováveis são aceitas. Sem nenhuma delas o cliente conta zero oferta
// e fica de fora — é exatamente o filtro pedido, e não um palpite pela margem.
// Ao confirmar o contrato, reduzir a lista ao nome real.
// ===============================

const CAMPOS_OFERTAS = [
    "ofertas",
    "qtdOfertas",
    "quantidadeOfertas",
    "totalOfertas",
    "ofertasDisponiveis",
    "offers"
];


function quantidadeOfertas(registro){

    for(const campo of CAMPOS_OFERTAS){

        const valor = registro[campo];

        if(valor === undefined || valor === null || valor === "") continue;

        // O campo pode vir como contagem ou como a própria lista de ofertas.
        if(Array.isArray(valor)) return valor.length;

        const numero = Number(valor);

        if(!isNaN(numero)) return numero;

    }

    return 0;

}


// ===============================
// MAPEAMENTO API -> PAINEL
// ===============================

function mapearClientePainel(registro){

    registro = registro || {};

    const idLocal = normalizarCpf(registro.cpf || "");
    const celular = formatarTelefone(registro.celular);

    return {

        idApi: registro.id,

        // Chave local: indexa o histórico do operador no localStorage.
        id: idLocal,

        nome: String(registro.nome || "").trim(),
        cpf: formatarCPF(registro.cpf || ""),
        celular: celular,

        // O modal de proposta e o WhatsApp leem `telefone` (modelo do Painel).
        telefone: celular,

        ofertas: quantidadeOfertas(registro),

        criadoEm: registro.createdAtUtc || registro.criadoEm || "",

        // Preenchido por atualizarContatosPainel(): o primeiro contato é local
        // e muda enquanto a lista está na tela.
        contatado: false,
        contatoData: "",
        contatoHora: "",

        // Preenchido por atualizarImportadosPainel(), pelo mesmo motivo: uma
        // importação troca a lista com o Painel já montado.
        importado: false,

        // Preenchido por atualizarOrigensPainel(), idem. Já nasce com valor
        // porque a coluna lê o campo direto e desenhar antes da primeira
        // atualização deixaria a célula vazia.
        origem: ORIGEM_BASE,
        origemData: ""

    };

}


// Regra de entrada no Painel: celular discável, CPF (sem ele não há chave local
// para o histórico do operador) e — para quem veio da API — oferta disponível.
//
// Lead importado por planilha entra sem oferta de propósito: ele nasce com zero
// oferta porque as consultas bancárias ainda não rodaram, e é justamente a fila
// que o operador precisa trabalhar. Quem já estava na base segue na regra
// antiga, senão o Painel viraria a lista inteira de clientes.
//
// O celular continua obrigatório nos dois casos: sem número não há WhatsApp
// nem Telegram, que é tudo o que o card oferece.
function clienteDoPainel(cliente){

    const digitos = somenteNumeros(cliente.celular);

    if(digitos.length < 10 || !cliente.id) return false;

    if(cliente.ofertas > 0) return true;

    // typeof: sem importacoes.js carregado, a regra volta a ser só a oferta em
    // vez de derrubar o Painel inteiro.
    return typeof ehLeadImportado === "function" && ehLeadImportado(cliente.id);

}


// ===============================
// FILTRO POR DIA
// A comparação é feita por dia no fuso do operador: createdAtUtc vem em UTC
// e o <input type="date"> devolve o dia local — converter os dois para a mesma
// chave AAAA-MM-DD é o que impede o registro da madrugada de cair no dia errado.
// ===============================

function chaveDoDia(data){

    return data.getFullYear() + "-" +
        String(data.getMonth() + 1).padStart(2,"0") + "-" +
        String(data.getDate()).padStart(2,"0");

}


function diaDoCliente(cliente){

    if(!cliente.criadoEm) return "";

    const data = new Date(cliente.criadoEm);

    return isNaN(data.getTime()) ? "" : chaveDoDia(data);

}


function diaAlvoPainel(){

    if(filtroDataPainel === "hoje"){
        return chaveDoDia(new Date());
    }

    if(filtroDataPainel === "ontem"){

        const ontem = new Date();

        ontem.setDate(ontem.getDate() - 1);

        return chaveDoDia(ontem);

    }

    if(filtroDataPainel === "data"){
        return dataEscolhidaPainel;
    }

    // "todos": sem dia alvo.
    return "";

}


// ===============================
// PRIMEIRO CONTATO
// `contato_inicial_<cpf>` é gravado por abrirWhatsapp() e é local: a lista
// precisa relê-lo antes de cada desenho, senão o lead que acabou de ser
// abordado continua aparecendo como não contatado.
// ===============================

function atualizarContatosPainel(){

    painelClientes.forEach(cliente=>{

        cliente.contatado =
            localStorage.getItem("contato_inicial_" + cliente.id) === "sim";

        cliente.contatoData = cliente.contatado
            ? (localStorage.getItem("contato_data_" + cliente.id) || "")
            : "";

        cliente.contatoHora = cliente.contatado
            ? (localStorage.getItem("contato_hora_" + cliente.id) || "")
            : "";

    });

}


// ===============================
// LEADS DA ÚLTIMA IMPORTAÇÃO
// `ultimaImportacao` (importacoes.js, carregado antes deste arquivo) guarda os
// CPFs criados no último envio. Como o contato, a marca é relida antes de cada
// desenho: importar com o Painel na tela troca o lote sem recarregar a página.
// ===============================

function idsDaUltimaImportacao(){

    const dados = ultimaImportacao;

    return new Set(dados && Array.isArray(dados.ids) ? dados.ids : []);

}


function atualizarImportadosPainel(){

    const ids = idsDaUltimaImportacao();

    painelClientes.forEach(cliente=>{

        cliente.importado = ids.has(cliente.id);

    });

}


// Selo ao lado do nome. A data de criação é o que identifica o lote — ela já
// tem coluna própria, e aqui vai no title para o selo não competir com o nome.
function marcaImportado(cliente){

    if(!cliente.importado) return "";

    return ' <span class="seloImportado" title="Importado em ' +
        escaparHtml(formatarDataHora(cliente.criadoEm) || "data não informada") +
        '">novo</span>';

}


// ===============================
// ORIGEM DO LEAD
// `leads_importados` (importacoes.js) acumula todo CPF que já entrou por
// planilha, com a data. É a mesma fonte que a regra de entrada consulta, então
// a coluna diz exatamente por que aquele lead está aqui: veio de um arquivo ou
// já estava na base com oferta.
//
// Como o contato e a marca do último lote, esse registro é local e muda com o
// Painel na tela — a origem é relida antes de cada desenho em vez de ser
// resolvida uma vez no mapeamento.
//
// O registro é do navegador: lead importado em outra máquina, ou antes de a
// marcação existir, aparece como "Base". O title do selo diz isso, para a
// coluna não ser lida como uma afirmação do servidor.
// ===============================

const ORIGEM_PLANILHA = "Planilha";
const ORIGEM_BASE = "Base";


function atualizarOrigensPainel(){

    // Sem importacoes.js carregado, todos contam como base — mesma degradação
    // da regra de entrada, em vez de quebrar o desenho.
    const temRegistro = typeof ehLeadImportado === "function";

    painelClientes.forEach(cliente=>{

        const daPlanilha = temRegistro && ehLeadImportado(cliente.id);

        cliente.origem = daPlanilha ? ORIGEM_PLANILHA : ORIGEM_BASE;

        cliente.origemData = daPlanilha && typeof dataDeImportacao === "function"
            ? dataDeImportacao(cliente.id)
            : "";

    });

}


function tituloOrigem(cliente){

    if(cliente.origem === ORIGEM_PLANILHA){

        return "Importado por planilha em " +
            (formatarDataHora(cliente.origemData) || "data não registrada");

    }

    return "Já estava na base — nenhuma importação deste CPF registrada neste navegador";

}


function seloOrigem(cliente){

    const daPlanilha = cliente.origem === ORIGEM_PLANILHA;

    return '<span class="seloOrigem ' +
        (daPlanilha ? "origemPlanilha" : "origemBase") +
        '" title="' + escaparHtml(tituloOrigem(cliente)) + '">' +
        '<i class="bi ' +
        (daPlanilha ? "bi-file-earmark-spreadsheet" : "bi-database") + '"></i> ' +
        escaparHtml(cliente.origem) + "</span>";

}


function textoContatoPainel(cliente){

    if(!cliente.contatado) return "Não contatado";

    const quando = [cliente.contatoData, cliente.contatoHora]
        .filter(Boolean)
        .join(" ");

    return quando ? "Contatado em " + quando : "Contatado";

}


function clientesFiltradosPainel(){

    const alvo = diaAlvoPainel();

    return painelClientes.filter(cliente=>{

        if(alvo && diaDoCliente(cliente) !== alvo) return false;

        if(somenteNaoContatados && cliente.contatado) return false;

        if(somenteImportados && !cliente.importado) return false;

        return true;

    });

}


// new Date("2026-07-30") seria lido como UTC e poderia voltar o dia anterior:
// a chave é formatada a partir do próprio texto.
function formatarDiaBR(chave){

    const partes = String(chave || "").split("-");

    return partes.length === 3
        ? partes[2] + "/" + partes[1] + "/" + partes[0]
        : "";

}


function rotuloFiltroPainel(){

    if(filtroDataPainel === "hoje") return "Hoje";
    if(filtroDataPainel === "ontem") return "Ontem";
    if(filtroDataPainel === "data") return formatarDiaBR(dataEscolhidaPainel);

    return "Todos";

}


// ===============================
// TABELA
// Nome, contato, origem e data de criação ficam visíveis; celular, CPF, ofertas e ações
// vão para o detalhe da linha via className "none" — o Responsive nunca sobe
// uma coluna dessas para a grade, em nenhuma largura de tela.
// ===============================

// ===============================
// PEDAÇOS COMPARTILHADOS
// A tabela e os cards mostram os mesmos dados: os trechos abaixo são montados
// uma vez só para as duas visões não descolarem uma da outra.
// ===============================

// O valor e o botão de copiar ficam nas pontas opostas da linha (.linhaCampo),
// tanto no detalhe da tabela quanto no card.
// `rotulo` é literal ("CPF"/"Telefone") e vira o texto do aviso de copiarTexto(),
// que é quem repõe o zero à esquerda do CPF na cópia.
function valorComCopia(valor, rotulo){

    return '<span class="linhaCampo">' +
        '<span class="valorCopiavelPainel">' + escaparHtml(valor) + "</span>" +
        '<button type="button" class="btnCopiar" title="Copiar ' + rotulo.toLowerCase() + '" ' +
        "onclick=\"copiarTexto('" + escaparArgumento(valor) + "','" + rotulo + "')\">" +
        '<i class="bi bi-clipboard"></i></button>' +
        "</span>";

}


// cliente.id é somenteNumeros(cpf) e só entra na lista com valor: pode ir cru.
// Nome e celular passam pelos escapes.
function botoesAcao(cliente){

    return '<button type="button" class="btnLinha btnLinhaZap" ' +
        "onclick=\"contatarPainel('" + somenteNumeros(cliente.celular) + "','" +
        escaparArgumento(cliente.nome) + "','" + cliente.id + "','whatsapp')\">" +
        '<i class="bi bi-whatsapp"></i> WhatsApp</button>' +
        '<button type="button" class="btnLinha btnLinhaTelegram" ' +
        "onclick=\"contatarPainel('" + somenteNumeros(cliente.celular) + "','" +
        escaparArgumento(cliente.nome) + "','" + cliente.id + "','telegram')\">" +
        '<i class="bi bi-telegram"></i> Telegram</button>' +
        '<button type="button" class="btnLinha btnLinhaProposta" ' +
        "onclick=\"montarProposta('" + cliente.id + "')\">" +
        "✨ Montar proposta</button>" +
        '<button type="button" class="btnLinha btnLinhaContrato" ' +
        "onclick=\"abrirModalContrato('" + cliente.id + "')\">" +
        "📄 Gerar contrato</button>" +
        '<button type="button" class="btnLinha btnLinhaCopiar" ' +
        "onclick=\"abrirPropostasCliente('" + cliente.id + "')\">" +
        '<i class="bi bi-search"></i> Consultar proposta</button>';

}


function iniciarTabelaPainel(){

    if(tabelaPainelIniciada) return;

    tabelaPainel = new DataTable("#tabelaPainel",{

        data: clientesFiltradosPainel(),

        columns:[
            {
                title:"",
                data:null,
                orderable:false,
                searchable:false,
                className:"dtr-control",
                defaultContent:""
            },
            {
                title:"Nome",
                data:"nome",
                responsivePriority:1,
                render: (valor, tipo, cliente) =>
                    tipo === "display"
                        ? escaparHtml(valor) + marcaImportado(cliente)
                        : valor
            },
            {
                title:"Contato",
                data:"contatado",
                responsivePriority:2,
                render: (valor, tipo, cliente) =>
                    tipo === "display"
                        ? '<span class="seloContato ' +
                          (valor ? "contatoFeito" : "contatoPendente") + '">' +
                          escaparHtml(textoContatoPainel(cliente)) + "</span>"
                        : valor
            },
            {
                // O valor cru é o próprio rótulo ("Planilha"/"Base"), então a
                // busca da tabela filtra por origem sem coluna auxiliar.
                title:"Origem",
                data:"origem",
                responsivePriority:4,
                render: (valor, tipo, cliente) =>
                    tipo === "display" ? seloOrigem(cliente) : valor
            },
            {
                title:"Data de criação",
                data:"criadoEm",
                responsivePriority:3,
                // O valor cru é devolvido para a ordenação continuar cronológica.
                render: (valor, tipo) =>
                    tipo === "display"
                        ? escaparHtml(formatarDataHora(valor))
                        : (valor || "")
            },
            {
                title:"Celular",
                data:"celular",
                className:"none",
                render: (valor, tipo) =>
                    tipo === "display"
                        ? valorComCopia(valor, "Telefone")
                        : valor
            },
            {
                title:"CPF",
                data:"cpf",
                className:"none",
                render: (valor, tipo) =>
                    tipo === "display"
                        ? valorComCopia(valor, "CPF")
                        : valor
            },
            {
                title:"Ofertas",
                data:"ofertas",
                className:"none",
                render: (valor, tipo) =>
                    tipo === "display" ? escaparHtml(String(valor)) : valor
            },
            {
                title:"Ações",
                data:null,
                orderable:false,
                searchable:false,
                className:"none colunaAcoesPainel",
                render: (linha, tipo, cliente) =>
                    tipo === "display" ? botoesAcao(cliente) : ""
            }
        ],

        // Coluna de controle explícita: o detalhe abre pelo ⊕ da primeira coluna.
        responsive:{
            details:{
                type:"column",
                target:0
            }
        },

        pageLength:10,
        lengthMenu:[10,25,50,100],

        // Mais recentes primeiro: é a fila de trabalho do operador.
        // Índice 4 = "Data de criação" (0 é o controle, 2 é "Contato" e 3 é
        // "Origem") — este número muda toda vez que uma coluna visível entra.
        order:[[4,"desc"]],

        language:{
            emptyTable:"Nenhum lead neste período.",
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

    // O container dos cards nasce fora do layout do DataTables; movê-lo para
    // junto da tabela mantém a busca e o paginador em cima e embaixo dele nas
    // duas visões — os controles continuam valendo no modo card.
    const tabela = document.getElementById("tabelaPainel");
    const cards = document.getElementById("cardsPainel");

    if(tabela && cards && tabela.parentNode){
        tabela.parentNode.insertBefore(cards, tabela.nextSibling);
    }

    // Busca, ordenação, paginação e filtro de data passam todos por aqui.
    tabelaPainel.on("draw", renderizarCardsPainel);

    tabelaPainelIniciada = true;

}


// ===============================
// VISÃO EM CARDS
// Mesma origem da tabela: os cards refletem a página exibida, com a busca e a
// ordenação já aplicadas, então as duas visões nunca mostram coisas diferentes.
// ===============================

function renderizarCardsPainel(){

    const container = document.getElementById("cardsPainel");

    if(!container || !tabelaPainel) return;

    // Na visão de tabela os cards estão ocultos: não há o que remontar.
    if(visaoPainel !== "cards") return;

    const linhas = tabelaPainel
        .rows({page:"current", search:"applied", order:"applied"})
        .data()
        .toArray();

    if(!linhas.length){

        container.innerHTML =
            '<div class="cardPainelVazio">Nenhum cliente para exibir.</div>';

        return;

    }

    container.innerHTML = linhas.map(cartaoPainel).join("");

}


function cartaoPainel(cliente){

    // O lead importado chega aqui antes de ter oferta: dizer isso é melhor que
    // um "0 ofertas", que se lê como defeito.
    const ofertas = cliente.ofertas > 0
        ? (cliente.ofertas === 1 ? "1 oferta" : cliente.ofertas + " ofertas")
        : "sem oferta ainda";

    const classeOfertas = "seloOfertas" + (cliente.ofertas > 0 ? "" : " semOferta");

    return `
<article class="cardPainel">

    <header class="cardPainelTopo">
        <h3>${escaparHtml(cliente.nome)}${marcaImportado(cliente)}</h3>
        <span class="${classeOfertas}">${escaparHtml(ofertas)}</span>
    </header>

    <p class="cardPainelData">
        <i class="bi bi-calendar-event"></i>
        ${escaparHtml(formatarDataHora(cliente.criadoEm)) || "sem data de criação"}
    </p>

    <div class="cardPainelSelos">

        <span class="seloContato ${cliente.contatado ? "contatoFeito" : "contatoPendente"}">
            ${escaparHtml(textoContatoPainel(cliente))}
        </span>

        ${seloOrigem(cliente)}

    </div>

    <div class="cardPainelCampo">
        <span class="rotuloCampo">Celular</span>
        ${valorComCopia(cliente.celular, "Telefone")}
    </div>

    <div class="cardPainelCampo">
        <span class="rotuloCampo">CPF</span>
        ${valorComCopia(cliente.cpf, "CPF")}
    </div>

    <div class="cardPainelAcoes">${botoesAcao(cliente)}</div>

</article>`;

}


function alternarVisaoPainel(visao){

    visaoPainel = visao;

    const caixa = document.getElementById("caixaPainel");

    if(caixa) caixa.classList.toggle("emCards", visao === "cards");

    const botaoTabela = document.getElementById("visaoTabela");
    const botaoCards = document.getElementById("visaoCards");

    if(botaoTabela) botaoTabela.classList.toggle("ativo", visao !== "cards");
    if(botaoCards) botaoCards.classList.toggle("ativo", visao === "cards");

    if(visao === "cards"){

        renderizarCardsPainel();

    }else if(tabelaPainel){

        // A tabela estava escondida: as colunas precisam ser remedidas.
        tabelaPainel.columns.adjust().responsive.recalc();

    }

}


function desenharPainel(){

    if(!tabelaPainel) return;

    atualizarContatosPainel();
    atualizarImportadosPainel();
    atualizarOrigensPainel();

    // Antes de filtrar: um envio que não trouxe ninguém esconde o chip e, com
    // ele, desliga o recorte — que senão esvaziaria a lista sem explicação.
    marcarChipImportados();

    tabelaPainel.clear();
    tabelaPainel.rows.add(clientesFiltradosPainel());
    tabelaPainel.draw();

    atualizarResumoPainel();

}


// Abre o canal escolhido e redesenha: os dois marcam o primeiro contato no
// localStorage, e a linha precisa refletir isso na hora.
function contatarPainel(numero, nome, id, canal){

    if(canal === "telegram"){
        abrirTelegram(numero, nome, id);
    }else{
        abrirWhatsapp(numero, nome, id);
    }

    atualizarContatosPainel();

    // Com o filtro de não contatados ligado, a linha sai da lista — aí não
    // basta reler as linhas, a seleção inteira muda.
    if(somenteNaoContatados){

        desenharPainel();

    }else if(tabelaPainel){

        tabelaPainel.rows().invalidate().draw(false);
        atualizarResumoPainel();

    }

}


// ===============================
// FILTROS DE DATA
// ===============================

function marcarFiltroAtivo(){

    const chips = {
        hoje:"filtroHoje",
        ontem:"filtroOntem",
        todos:"filtroTodos"
    };

    Object.keys(chips).forEach(tipo=>{

        const chip = document.getElementById(chips[tipo]);

        if(chip) chip.classList.toggle("ativo", filtroDataPainel === tipo);

    });

    const campo = document.getElementById("campoDataPainel");

    if(campo) campo.classList.toggle("ativo", filtroDataPainel === "data");

    const contato = document.getElementById("filtroNaoContatado");

    if(contato) contato.classList.toggle("ativo", somenteNaoContatados);

    marcarChipImportados();

}


// Sem importação registrada não há lote para recortar: o chip nem aparece.
function marcarChipImportados(){

    const chip = document.getElementById("filtroImportados");

    if(!chip) return;

    const dados = ultimaImportacao;
    const total = dados && Array.isArray(dados.ids) ? dados.ids.length : 0;

    chip.style.display = total ? "" : "none";

    if(!total){

        // Um filtro ligado sobre um chip escondido esvaziaria a lista sem
        // nada na tela explicando por quê.
        somenteImportados = false;

        return;

    }

    const rotulo = chip.querySelector(".rotuloChip");

    if(rotulo){
        rotulo.textContent = "Importados agora (" + total + ")";
    }

    chip.title = "Leads criados na importação de " + formatarDataHora(dados.quando);

    chip.classList.toggle("ativo", somenteImportados);

}


// Independente do filtro de data: os dois valem ao mesmo tempo.
function alternarNaoContatados(){

    somenteNaoContatados = !somenteNaoContatados;

    marcarFiltroAtivo();
    desenharPainel();

}


function alternarImportados(){

    somenteImportados = !somenteImportados;

    marcarFiltroAtivo();
    desenharPainel();

}


// Chamado logo depois de um envio: abre o Painel já recortado nos leads que
// acabaram de entrar. O filtro de data vai para "Todos" de propósito — a marca
// da importação é o recorte exato, e um dia divergente (arquivo processado
// depois da virada, relógio do servidor adiantado) deixaria a tela vazia
// justamente quando ela deveria mostrar o resultado do envio. A coluna
// "Data de criação" continua mostrando o dia de cada lead.
function irParaLeadsImportados(){

    somenteImportados = true;
    somenteNaoContatados = false;
    filtroDataPainel = "todos";
    dataEscolhidaPainel = "";

    const entrada = document.getElementById("dataPainel");

    if(entrada) entrada.value = "";

    mostrarSecao("Painel");

    marcarFiltroAtivo();
    desenharPainel();

}


function filtrarPainelPor(tipo){

    filtroDataPainel = tipo;

    if(tipo !== "data"){

        dataEscolhidaPainel = "";

        const entrada = document.getElementById("dataPainel");

        if(entrada) entrada.value = "";

    }

    marcarFiltroAtivo();
    desenharPainel();

}


function filtrarPainelPorData(valor){

    // Limpar o campo de data volta para a lista inteira.
    if(!valor){
        filtrarPainelPor("todos");
        return;
    }

    dataEscolhidaPainel = valor;
    filtroDataPainel = "data";

    marcarFiltroAtivo();
    desenharPainel();

}


// ===============================
// CARGA
// ===============================

// `registrosPreCarregados` evita uma segunda leitura da lista completa quando
// quem chama acabou de buscá-la — é o caso do envio de importação, que precisa
// da lista para descobrir quais leads entraram. Sem o argumento, busca sozinho.
async function carregarPainel(registrosPreCarregados){

    mostrarAvisoPainel("Carregando clientes...", "info");

    try{

        const registros = Array.isArray(registrosPreCarregados)
            ? registrosPreCarregados
            : await apiListarClientes();

        painelClientes = registros
            .map(mapearClientePainel)
            .filter(clienteDoPainel);

        // O modal de proposta e o WhatsApp leem a lista global do Painel.
        clientes = painelClientes;

        iniciarTabelaPainel();
        desenharPainel();

    }catch(erro){

        // Sem dados na tela, o operador precisa saber por quê.
        iniciarTabelaPainel();

        mostrarAvisoPainel(erro.message + " ", "erro", true);

        console.error("Falha ao carregar o painel:", erro);

    }

}


function atualizarResumoPainel(){

    const total = painelClientes.length;
    const exibidos = clientesFiltradosPainel().length;
    const rotulo = rotuloFiltroPainel();

    if(!total){

        mostrarAvisoPainel(
            "Nenhum lead com celular cadastrado — entram aqui os clientes com " +
            "oferta e os leads importados por planilha.",
            "info"
        );

        return;

    }

    const recorte = rotulo +
        (somenteNaoContatados ? " · só não contatados" : "") +
        (somenteImportados ? " · só da última importação" : "");

    if(!exibidos){

        // O lote importado só fica de fora daqui por falta de celular: a oferta
        // deixou de ser exigida para quem veio de planilha.
        if(somenteImportados){

            mostrarAvisoPainel(
                "Nenhum lead da última importação veio com celular discável, " +
                "então não há quem contatar. " +
                'Toque em "Importados agora" para voltar à lista completa.',
                "info"
            );

            return;

        }

        mostrarAvisoPainel(
            "Nenhum lead em " + recorte + ". " +
            'Toque em "Todos" para ver os ' + total + " da lista.",
            "info"
        );

        return;

    }

    const visiveis = clientesFiltradosPainel();

    const contatados = visiveis.filter(cliente => cliente.contatado).length;
    const semOferta = visiveis.filter(cliente => !(cliente.ofertas > 0)).length;

    mostrarAvisoPainel(
        exibidos + (exibidos === 1 ? " lead" : " leads") +
        " · " + recorte +
        (semOferta ? " · " + semOferta + " ainda sem oferta" : "") +
        (somenteNaoContatados ? "" : " · " + contatados + " já contatado" +
            (contatados === 1 ? "" : "s")),
        "info"
    );

}


function mostrarAvisoPainel(texto, tipo, comBotao){

    const aviso = document.getElementById("avisoPainel");

    if(!aviso) return;

    aviso.className = "avisoClientes aviso-" + (tipo || "info");
    aviso.textContent = texto;
    aviso.style.display = "block";

    if(comBotao){

        const botao = document.createElement("button");

        botao.type = "button";
        botao.className = "btnTentarNovamente";
        botao.textContent = "Tentar novamente";
        botao.onclick = carregarPainel;

        aviso.appendChild(botao);

    }

}


// O Painel é a seção aberta ao entrar: carrega junto com a página.
if(document.getElementById("tabelaPainel")){

    marcarFiltroAtivo();
    carregarPainel();

}
