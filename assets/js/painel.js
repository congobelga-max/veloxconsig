// ===============================
// PAINEL — FILA DE TRABALHO
// Tabela sobre /clientes: entram todos os registros com celular discável e CPF,
// com oferta ou sem. A contagem de ofertas é informação da linha, não filtro.
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

// Quarta dimensão: só quem já tem oferta do banco. Isto já foi regra de entrada
// do Painel — agora é filtro, que é a diferença entre o operador escolher ver a
// fila pronta para vender e o app decidir por ele que o resto não existe.
let somenteComOferta = false;

// AAAA-MM-DD, no formato que o <input type="date"> devolve.
let dataEscolhidaPainel = "";

// tabela | cards
let visaoPainel = "tabela";

// O que a última carga trouxe e o que ficou de fora da regra de entrada.
// Preenchido por carregarPainel() e lido pelo resumo — é o que explica uma
// lista menor que a tela de Clientes.
let resumoCargaPainel = {recebidos:0, semCelular:0, semCpf:0};


// ===============================
// OFERTAS
// O nome do campo ainda não foi confirmado no retorno de /clientes, então as
// grafias prováveis são aceitas. Sem nenhuma delas o cliente conta zero oferta
// e aparece como "sem oferta ainda" — nada é derivado da margem, que é outra
// coisa. Isso não decide mais quem entra no Painel: hoje é só exibição.
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

        // Derivados de `contatoStatus` por atualizarContatosPainel(): o clique
        // no WhatsApp muda o status com a lista já na tela.
        contatado: false,
        contatoNivel: 0,

        // Preenchido por atualizarImportadosPainel(), pelo mesmo motivo: uma
        // importação troca a lista com o Painel já montado.
        importado: false,

        // Registro como veio da API. Guardado para o PUT de reserva do
        // contatoStatus poder devolver o cadastro inteiro em vez de um corpo
        // pela metade, que apagaria os campos omitidos.
        bruto: registro,

        // Status de contato do servidor, lido por atualizarContatosPainel().
        contatoStatus: registro.contatoStatus,

        // Quando o contato foi registrado, em UTC. É o que a coluna mostra no
        // lugar da antiga data guardada no localStorage.
        contatadoEm: registro.contatadoEmUtc || "",

        // Valor cru do campo de origem do servidor, quando ele vem.
        origemApi: origemDaApi(registro),

        // Resolvidos por atualizarOrigensPainel() (servidor primeiro, registro
        // local depois). Já nascem preenchidos porque a coluna lê o campo
        // direto: desenhar antes da primeira atualização deixaria a célula vazia.
        origem: ORIGEM_BASE,
        origemFonte: "local",
        origemData: ""

    };

}


// Regra de entrada no Painel: celular discável e CPF. Nada mais.
//
// A oferta NÃO é exigida — nem de quem veio da API. O Painel é a lista de
// trabalho do operador, e cliente sem oferta é exatamente quem ainda precisa
// ser consultado; escondê-lo tirava da tela a fila que existe para ser
// trabalhada. (Antes, só o lead importado por planilha tinha essa isenção.)
//
// O que continua obrigatório:
// - celular discável, porque WhatsApp, Telegram e proposta são tudo o que a
//   linha oferece, e sem número nenhum deles funciona;
// - CPF, porque é a chave local de todo o histórico do operador
//   (status_, contato_, classificacao_) e sem ela não há onde gravar.
function clienteDoPainel(cliente){

    const digitos = somenteNumeros(cliente.celular);

    return digitos.length >= 10 && !!cliente.id;

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
// Fonte única: `contatoStatus` do servidor (1 Não contatado, 2 Enviado,
// 3 Contatado). O app grava o 3 ao abrir a conversa —
// sincronizarContatoNaApi(), em app.js —, atualizando o registro em memória na
// hora, e é isso que a linha lê no desenho seguinte.
//
// Não há mais cópia no localStorage. Ela existia para a marca sobreviver ao F5,
// e o preço era este: o mesmo cliente aparecia contatado numa máquina e não
// contatado na outra, porque localStorage é por origem — foi o que se viu entre
// o teste local e a produção.
// ===============================

function atualizarContatosPainel(){

    painelClientes.forEach(cliente=>{

        cliente.contatoNivel = numeroContatoStatus(cliente.contatoStatus);

        // Uma dimensão só para o chip e para o filtro: abordado ou não.
        cliente.contatado = cliente.contatoNivel >= CONTATO_STATUS.ENVIADO;

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
// A fonte da verdade é o campo que /clientes devolve — ele vale para qualquer
// navegador e para leads importados por outra pessoa.
//
// Quando o registro chega sem ele, sobra o `leads_importados` (importacoes.js),
// que acumula localmente todo CPF que já entrou por planilha, com a data. Essa
// reserva é do navegador: lead importado em outra máquina, ou antes de a
// marcação existir, cai em "Base". O title do selo diz de onde veio a resposta,
// para a coluna não afirmar como servidor o que é palpite local.
//
// Como o registro local muda com o Painel na tela, a origem é resolvida antes
// de cada desenho, e não uma vez só no mapeamento.
//
// O campo é `origem` e os valores são o enum do servidor — Importacao, Webhook
// e Api. Um valor fora dessa lista é exibido cru, de propósito: engolir o
// desconhecido em "Base" esconderia justamente a origem que alguém acabou de
// criar. Se a API serializar o enum como número (0/1/2), é isso que vai
// aparecer na coluna — a ordem dos membros não é adivinhada aqui, porque um
// palpite errado rotularia o cliente com a origem de outro.
// ===============================

const ORIGEM_PLANILHA = "Planilha";
const ORIGEM_BASE = "Base";

// Chave sem acento, minúscula e sem separadores -> rótulo pt-BR e estilo.
const ORIGENS_API = {
    importacao:{
        rotulo:"Importação",
        classe:"origemImportacao",
        icone:"bi-file-earmark-spreadsheet",
        descricao:"Criado por uma importação de planilha"
    },
    webhook:{
        rotulo:"Webhook",
        classe:"origemWebhook",
        icone:"bi-lightning-charge",
        descricao:"Recebido pelo callback POST /webhooks/leads"
    },
    api:{
        rotulo:"API",
        classe:"origemApi",
        icone:"bi-code-slash",
        descricao:"Cadastro direto pela API (POST /api/clientes)"
    }
};


function origemDaApi(registro){

    const valor = registro.origem;

    return valor === undefined || valor === null ? "" : String(valor).trim();

}


// Nada de sensível à caixa: o enum chega em PascalCase ("Importacao") e uma
// mudança de serialização não pode apagar a coluna.
function definicaoOrigem(valor){

    return ORIGENS_API[semAcento(valor).replace(/[\s_-]+/g,"")] || null;

}


function rotuloOrigem(valor){

    const definicao = definicaoOrigem(valor);

    return definicao ? definicao.rotulo : valor;

}


function atualizarOrigensPainel(){

    // Sem importacoes.js carregado, a reserva local some e sobra o campo da
    // API — degradar assim é melhor que quebrar o desenho da tabela.
    const temRegistro = typeof ehLeadImportado === "function";

    painelClientes.forEach(cliente=>{

        if(cliente.origemApi){

            cliente.origem = rotuloOrigem(cliente.origemApi);
            cliente.origemFonte = "api";

            // A data local ainda serve de detalhe quando o CPF também consta
            // como importado aqui.
            cliente.origemData = temRegistro && typeof dataDeImportacao === "function"
                ? dataDeImportacao(cliente.id)
                : "";

            return;

        }

        const daPlanilha = temRegistro && ehLeadImportado(cliente.id);

        cliente.origem = daPlanilha ? ORIGEM_PLANILHA : ORIGEM_BASE;
        cliente.origemFonte = "local";

        cliente.origemData = daPlanilha && typeof dataDeImportacao === "function"
            ? dataDeImportacao(cliente.id)
            : "";

    });

}


function tituloOrigem(cliente){

    const quando = formatarDataHora(cliente.origemData);

    if(cliente.origemFonte === "api"){

        const definicao = definicaoOrigem(cliente.origemApi);

        // O valor cru vai junto: o rótulo é tradução nossa, e é o valor do
        // servidor que se discute quando algo parece errado.
        return (definicao
                ? definicao.descricao
                : "Origem não reconhecida por este app") +
            ' — origem="' + cliente.origemApi + '" no /clientes' +
            (quando ? " · importado neste navegador em " + quando : "");

    }

    if(cliente.origem === ORIGEM_PLANILHA){

        return "Importado por planilha em " + (quando || "data não registrada") +
            " — registro deste navegador, o servidor não informou origem";

    }

    return "O servidor não informou origem e não há importação deste CPF " +
        "registrada neste navegador";

}


function seloOrigem(cliente){

    const definicao = cliente.origemFonte === "api"
        ? definicaoOrigem(cliente.origemApi)
        : null;

    // Sem definição, o selo fica neutro: a origem local (Planilha) reaproveita
    // o estilo de importação, que é o que ela significa.
    const classe = definicao
        ? definicao.classe
        : (cliente.origem === ORIGEM_PLANILHA ? "origemImportacao" : "origemBase");

    const icone = definicao
        ? definicao.icone
        : (cliente.origem === ORIGEM_PLANILHA
            ? "bi-file-earmark-spreadsheet"
            : "bi-database");

    return '<span class="seloOrigem ' + classe +
        '" title="' + escaparHtml(tituloOrigem(cliente)) + '">' +
        '<i class="bi ' + icone + '"></i> ' +
        escaparHtml(cliente.origem) + "</span>";

}


// "Contatado" ganha selo próprio para não se perder no meio dos "Enviado" —
// que é o estado gravado por fora do app, já que o clique aqui vai direto a 3.
function classeContato(cliente){

    if(!cliente.contatado) return "contatoPendente";

    return cliente.contatoNivel >= CONTATO_STATUS.CONTATADO
        ? "contatoRespondido"
        : "contatoFeito";

}


// Três estados, todos vindos do servidor. A data sai de `contatadoEmUtc` e é
// formatada como a antiga dupla de chaves locais mostrava: 14/08/2026 15:32.
// Registro antigo, gravado antes do campo existir, fica sem data — e aí o selo
// diz só "Contatado" em vez de exibir um horário inventado.
function textoContatoPainel(cliente){

    if(!cliente.contatado) return "Não contatado";

    const rotulo = cliente.contatoNivel >= CONTATO_STATUS.CONTATADO
        ? "Contatado"
        : "Enviado";

    const quando = formatarDataHora(cliente.contatadoEm);

    return quando ? rotulo + " em " + quando : rotulo;

}


function clientesFiltradosPainel(){

    const alvo = diaAlvoPainel();

    return painelClientes.filter(cliente=>{

        if(alvo && diaDoCliente(cliente) !== alvo) return false;

        if(somenteNaoContatados && cliente.contatado) return false;

        if(somenteImportados && !cliente.importado) return false;

        if(somenteComOferta && !(cliente.ofertas > 0)) return false;

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
                        ? '<span class="seloContato ' + classeContato(cliente) + '">' +
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

        <span class="seloContato ${classeContato(cliente)}">
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

    // A contagem é sobre a lista carregada, então acompanha cada desenho.
    marcarChipOferta();

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
    marcarChipOferta();

}


// Diferente do chip de importados, este nunca some: ele conta sobre a lista
// inteira, e um contador em zero é a resposta ("nenhuma consulta voltou ainda"),
// não um motivo para esconder o controle.
function marcarChipOferta(){

    const chip = document.getElementById("filtroComOferta");

    if(!chip) return;

    const total = painelClientes.filter(cliente => cliente.ofertas > 0).length;

    const rotulo = chip.querySelector(".rotuloChip");

    if(rotulo){
        rotulo.textContent = "Com oferta (" + total + ")";
    }

    chip.classList.toggle("ativo", somenteComOferta);

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


function alternarComOferta(){

    somenteComOferta = !somenteComOferta;

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

    // Lead recém-importado nasce sem oferta: com este filtro ligado, a tela
    // abriria vazia justamente no lote que acabou de entrar.
    somenteComOferta = false;

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

        const mapeados = registros.map(mapearClientePainel);

        painelClientes = mapeados.filter(clienteDoPainel);

        // Quem a API devolveu e o Painel não mostra. Descartar em silêncio é o
        // que faz uma importação inteira "sumir": o operador vê os leads na tela
        // de Clientes, não vê aqui, e nada na tela diz por quê.
        resumoCargaPainel = {
            recebidos: mapeados.length,
            semCelular: mapeados.filter(
                cliente => somenteNumeros(cliente.celular).length < 10
            ).length,
            semCpf: mapeados.filter(cliente => !cliente.id).length
        };

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


// Clientes que a API devolveu e a regra de entrada barrou. Sem isto, a única
// pista de que existem mais clientes na base é abrir a tela de Clientes e
// contar as linhas — foi assim que uma importação inteira pareceu ter sumido.
function textoDescartadosPainel(){

    const fora = resumoCargaPainel.recebidos - painelClientes.length;

    if(fora <= 0) return "";

    const motivos = [];

    if(resumoCargaPainel.semCelular){
        motivos.push(resumoCargaPainel.semCelular + " sem celular");
    }

    if(resumoCargaPainel.semCpf){
        motivos.push(resumoCargaPainel.semCpf + " sem CPF");
    }

    return fora + (fora === 1 ? " cliente da base não entra aqui" :
        " clientes da base não entram aqui") +
        (motivos.length ? " (" + motivos.join(", ") + ")" : "") + ".";

}


// Um registro sem data de criação não casa com dia nenhum e só aparece em
// "Todos" — dito na tela, porque o filtro padrão é "Hoje" e sozinho ele faz
// esses leads parecerem inexistentes.
function textoSemDataPainel(){

    if(!diaAlvoPainel()) return "";

    const semData = painelClientes.filter(cliente => !diaDoCliente(cliente)).length;

    if(!semData) return "";

    return semData + (semData === 1
        ? " lead veio sem data de criação e só aparece em \"Todos\"."
        : " leads vieram sem data de criação e só aparecem em \"Todos\".");

}


function atualizarResumoPainel(){

    const total = painelClientes.length;
    const exibidos = clientesFiltradosPainel().length;
    const rotulo = rotuloFiltroPainel();

    const descartados = textoDescartadosPainel();

    if(!total){

        // A oferta não é mais exigida: se a lista está vazia, ou a base está
        // vazia ou nenhum cliente tem celular discável.
        mostrarAvisoPainel(
            "Nenhum cliente com celular cadastrado — entram aqui todos os " +
            "clientes da base com celular, com oferta ou sem. " + descartados,
            "info"
        );

        return;

    }

    const recorte = rotulo +
        (somenteNaoContatados ? " · só não contatados" : "") +
        (somenteImportados ? " · só da última importação" : "") +
        (somenteComOferta ? " · só com oferta" : "");

    if(!exibidos){

        // Só há um motivo para um lead do lote não estar aqui: falta de celular.
        if(somenteImportados){

            mostrarAvisoPainel(
                "Nenhum lead da última importação veio com celular discável, " +
                "então não há quem contatar. " +
                'Toque em "Importados agora" para voltar à lista completa. ' +
                descartados,
                "info"
            );

            return;

        }

        // Com o filtro de oferta ligado, mandar tocar em "Todos" (que é o de
        // data) não resolveria nada — o controle que esvaziou a lista é outro.
        if(somenteComOferta){

            mostrarAvisoPainel(
                "Nenhum cliente em " + recorte + " — as consultas bancárias " +
                "ainda não devolveram oferta para este recorte. " +
                'Toque em "Com oferta" para ver a lista inteira. ' + descartados,
                "info"
            );

            return;

        }

        mostrarAvisoPainel(
            "Nenhum lead em " + recorte + ". " +
            'Toque em "Todos" para ver os ' + total + " da lista. " +
            textoSemDataPainel() + " " + descartados,
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
            (contatados === 1 ? "" : "s")) +
        (descartados ? ". " + descartados : "") +
        (textoSemDataPainel() ? " " + textoSemDataPainel() : ""),
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
