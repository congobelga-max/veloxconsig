// ===============================
// IMPORTAÇÕES DE CLIENTES (sidebar > Importações)
// Depende de api.js e de app.js (escaparHtml, somenteNumeros...).
// ===============================

let importacoes = [];
let tabelaImportacoes = null;
let tabelaImportacoesIniciada = false;
let arquivoImportacao = null;
let analiseImportacao = null;


// ===============================
// ÚLTIMA IMPORTAÇÃO
// O POST não devolve quais clientes foram criados, e a listagem da rota pode
// nem existir (404/405): quem entrou é descoberto aqui, comparando a base
// antes e depois do envio. A comparação é por CPF de propósito — é exata e
// não depende de o relógio do servidor bater com o do navegador.
//
// O resultado fica no localStorage porque quem usa é o Painel: é ele que
// mostra o lote recém-importado, e a marca precisa sobreviver a um F5.
// Cada envio substitui o anterior — "a última importação", não um histórico.
//
// São DUAS chaves, com vidas diferentes:
//
// - `ultima_importacao` é só o último lote: alimenta o chip "Importados agora",
//   o selo "novo" e o resumo do envio. É substituída a cada importação.
// - `leads_importados` acumula todo CPF que já entrou por planilha, com a data.
//   É a que alimenta a coluna "Origem" do Painel, e por isso não pode ser
//   substituída: trocá-la faria toda a leva anterior passar a se dizer da base,
//   apagando o histórico de como cada cliente chegou ali.
// ===============================

const CHAVE_ULTIMA_IMPORTACAO = "ultima_importacao";
const CHAVE_LEADS_IMPORTADOS = "leads_importados";

// Folga do relógio para o caminho de exceção (identificação pela data de
// criação): o carimbo é do servidor e o corte é do navegador, e os dois
// raramente batem no segundo.
const FOLGA_RELOGIO_MS = 5 * 60 * 1000;

let ultimaImportacao = lerUltimaImportacao();

// { "<cpf>": "<ISO da importação>" } — acumulado, nunca substituído.
let leadsImportados = lerLeadsImportados();


function lerLeadsImportados(){

    try{

        const bruto = localStorage.getItem(CHAVE_LEADS_IMPORTADOS);
        const dados = bruto ? JSON.parse(bruto) : null;

        return dados && typeof dados === "object" && !Array.isArray(dados) ? dados : {};

    }catch(erro){

        console.warn("Registro de leads importados ilegível:", erro.message);

        return {};

    }

}


// Marca a procedência de cada CPF recém-criado: é daqui que a coluna "Origem"
// do Painel tira o selo "Planilha" e a data da importação.
function registrarLeadsImportados(novos, quando){

    novos.forEach(registro=>{

        const cpf = normalizarCpf((registro && registro.cpf) || "");

        // Reimportado: vale a data mais recente, é a que explica por que ele
        // está no Painel.
        if(cpf) leadsImportados[cpf] = quando;

    });

    try{

        localStorage.setItem(CHAVE_LEADS_IMPORTADOS, JSON.stringify(leadsImportados));

    }catch(erro){

        // Cota estourada: a marca vale nesta sessão e se perde no F5.
        console.warn("Não foi possível guardar os leads importados:", erro.message);

    }

}


// Usado pela coluna "Origem" do Painel (painel.js). O CPF já vem normalizado
// de lá — é a mesma chave local usada no localStorage do operador.
function ehLeadImportado(cpf){

    return !!cpf && Object.prototype.hasOwnProperty.call(leadsImportados, cpf);

}


function dataDeImportacao(cpf){

    return ehLeadImportado(cpf) ? leadsImportados[cpf] : "";

}


function lerUltimaImportacao(){

    try{

        const bruto = localStorage.getItem(CHAVE_ULTIMA_IMPORTACAO);
        const dados = bruto ? JSON.parse(bruto) : null;

        // Sem a lista de CPFs não há o que marcar no Painel.
        return dados && Array.isArray(dados.ids) ? dados : null;

    }catch(erro){

        // JSON corrompido: ficar sem a marcação é melhor que travar a tela.
        console.warn("Resumo da última importação ilegível:", erro.message);

        return null;

    }

}


function gravarUltimaImportacao(dados){

    ultimaImportacao = dados;

    try{

        localStorage.setItem(CHAVE_ULTIMA_IMPORTACAO, JSON.stringify(dados));

    }catch(erro){

        // Cota estourada: o Painel ainda marca o lote nesta sessão.
        console.warn("Não foi possível guardar o resumo da importação:", erro.message);

    }

}


function chavesDeClientes(registros){

    const chaves = new Set();

    registros.forEach(registro=>{

        const cpf = normalizarCpf((registro && registro.cpf) || "");

        if(cpf) chaves.add(cpf);

    });

    return chaves;

}


// Caminho de exceção, usado só quando a base não pôde ser lida antes do envio.
function novosPorDataDeCriacao(registros, momento){

    const corte = momento - FOLGA_RELOGIO_MS;

    return registros.filter(registro=>{

        if(!normalizarCpf((registro && registro.cpf) || "")) return false;

        const data = new Date((registro && (registro.createdAtUtc || registro.criadoEm)) || "");

        return !isNaN(data.getTime()) && data.getTime() >= corte;

    });

}


// Quantos dos novos passam pela regra do Painel. A regra não exige oferta de
// ninguém, então o único jeito de ficar de fora é vir sem celular discável — e
// é esse número que explica a tela.
function quantosEntramNoPainel(novos){

    if(typeof mapearClientePainel !== "function") return null;

    return novos.filter(registro => clienteDoPainel(mapearClientePainel(registro))).length;

}


function registrarImportacao(novos, arquivo, porData){

    const quando = new Date().toISOString();

    // O acumulado primeiro: é a procedência destes CPFs, e o Painel já pode
    // ser redesenhado a qualquer momento depois daqui.
    registrarLeadsImportados(novos, quando);

    gravarUltimaImportacao({

        quando: quando,
        arquivo: arquivo || "",

        // Marca que a identificação foi pela data, não pela comparação de CPFs.
        porData: !!porData,

        // Chave local do Painel: o CPF já normalizado (com os zeros à esquerda).
        ids: novos
            .map(registro => normalizarCpf((registro && registro.cpf) || ""))
            .filter(Boolean),

        total: novos.length,
        noPainel: quantosEntramNoPainel(novos),

        // Só o CSV é lido aqui; .xlsx não é inspecionado no navegador.
        linhas: analiseImportacao ? analiseImportacao.linhas : null

    });

}


function textoUltimaImportacao(){

    if(!ultimaImportacao) return "";

    const quando = formatarDataHora(ultimaImportacao.quando);
    const arquivo = ultimaImportacao.arquivo ? ultimaImportacao.arquivo + " · " : "";
    const total = ultimaImportacao.total || 0;

    if(!total){

        return arquivo + "nenhum lead novo entrou na base neste envio (" + quando + "). " +
            "Se o arquivo só trazia clientes que já existiam, é o resultado esperado.";

    }

    const partes = [
        arquivo + total + (total === 1 ? " lead novo" : " leads novos") + " em " + quando
    ];

    if(ultimaImportacao.linhas){
        partes.push("arquivo com " + ultimaImportacao.linhas + " linhas");
    }

    if(ultimaImportacao.noPainel != null){

        // Lead importado entra no Painel mesmo sem oferta: quem fica de fora
        // é só quem veio sem um celular discável.
        const fora = total - ultimaImportacao.noPainel;

        partes.push(ultimaImportacao.noPainel + " no Painel");

        if(fora > 0){
            partes.push(fora + (fora === 1
                ? " ficou de fora por não ter celular"
                : " ficaram de fora por não ter celular"));
        }

    }

    if(ultimaImportacao.porData){
        partes.push("identificados pela data de criação — a base anterior não pôde ser lida");
    }

    return partes.join(" · ") + ".";

}


// ===============================
// MAPEAMENTO
// Só o POST desta rota foi documentado; o formato do registro listado
// ainda não. Os nomes prováveis são aceitos e o que faltar fica em branco.
// Ao confirmar o contrato, reduzir ao caminho real.
// ===============================

function numeroOuNulo(valor){

    if(valor === null || valor === undefined || valor === "") return null;

    const numero = Number(valor);

    return isNaN(numero) ? null : numero;

}


function mapearImportacaoDaApi(registro){

    registro = registro || {};

    return {

        idApi: registro.id != null ? registro.id : (registro.key || ""),
        key: registro.key || "",

        arquivo:
            registro.nomeArquivo ||
            registro.arquivo ||
            registro.fileName ||
            registro.nome ||
            "",

        situacao: String(
            registro.status ||
            registro.situacao ||
            ""
        ).trim(),

        total: numeroOuNulo(
            registro.totalRegistros != null ? registro.totalRegistros :
            registro.total != null ? registro.total :
            registro.quantidade != null ? registro.quantidade :
            registro.linhas
        ),

        importados: numeroOuNulo(
            registro.importados != null ? registro.importados :
            registro.processados != null ? registro.processados :
            registro.sucesso
        ),

        erros: numeroOuNulo(
            registro.erros != null ? registro.erros :
            registro.falhas != null ? registro.falhas :
            registro.invalidos
        ),

        criadoEm:
            registro.createdAtUtc ||
            registro.criadoEm ||
            registro.dataUpload ||
            ""

    };

}


function classeSituacao(situacao){

    const texto = String(situacao || "").toLowerCase();

    if(/conclu|sucesso|finaliz|process(ado|ada)/.test(texto)) return "com";
    if(/erro|falh|recus|invalid/.test(texto)) return "erro";

    return "nao";

}


// ===============================
// TABELA
// ===============================

function iniciarTabelaImportacoes(){

    if(tabelaImportacoesIniciada) return;

    const numero = valor => valor === null ? "—" : String(valor);

    tabelaImportacoes = new DataTable("#tabelaImportacoes",{

        data: importacoes,

        columns:[
            {
                title:"Arquivo",
                data:"arquivo",
                responsivePriority:1,
                render: valor => escaparHtml(valor || "—")
            },
            {
                title:"Situação",
                data:"situacao",
                responsivePriority:3,
                render: (valor, tipo) =>
                    tipo === "display"
                        ? '<span class="selo selo-' + classeSituacao(valor) + '">' +
                          escaparHtml(valor || "—") + "</span>"
                        : valor
            },
            {
                title:"Registros",
                data:"total",
                className:"colunaValor",
                responsivePriority:5,
                render: (valor, tipo) => tipo === "display" ? numero(valor) : (valor || 0)
            },
            {
                title:"Importados",
                data:"importados",
                className:"colunaValor",
                responsivePriority:6,
                render: (valor, tipo) => tipo === "display" ? numero(valor) : (valor || 0)
            },
            {
                title:"Erros",
                data:"erros",
                className:"colunaValor",
                responsivePriority:7,
                render: (valor, tipo) => tipo === "display" ? numero(valor) : (valor || 0)
            },
            {
                title:"Enviado em",
                data:"criadoEm",
                responsivePriority:4,
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
                render: (linha, tipo, importacao) =>
                    '<button type="button" class="btnTabela btnExcluir" title="Excluir" ' +
                    "onclick=\"confirmarExclusaoImportacao('" + escaparArgumento(importacao.idApi) + "')\">" +
                    '<i class="bi bi-trash"></i></button>'
            }
        ],

        responsive:true,
        pageLength:10,
        lengthMenu:[10,25,50],
        order:[[5,"desc"]],

        language:{
            emptyTable:"Nenhuma importação enviada.",
            info:"Mostrando _START_ a _END_ de _TOTAL_ importações",
            infoEmpty:"Nenhuma importação",
            infoFiltered:"(filtrado de _MAX_ no total)",
            lengthMenu:"Exibir _MENU_ por página",
            loadingRecords:"Carregando...",
            processing:"Processando...",
            search:"Buscar:",
            zeroRecords:"Nenhuma importação encontrada para esta busca.",
            paginate:{
                first:"Primeira",
                last:"Última",
                next:"Próxima",
                previous:"Anterior"
            }
        }

    });

    tabelaImportacoesIniciada = true;

}


function atualizarTabelaImportacoes(){

    if(!tabelaImportacoes) return;

    tabelaImportacoes.clear();
    tabelaImportacoes.rows.add(importacoes);
    tabelaImportacoes.draw(false);

}


// ===============================
// CARGA
// ===============================

async function carregarImportacoes(){

    const aviso = document.getElementById("avisoImportacoes");

    mostrarAvisoImportacoes("Carregando importações...", "info");

    try{

        const registros = await apiListarImportacoes();

        importacoes = registros.map(mapearImportacaoDaApi);

        iniciarTabelaImportacoes();
        atualizarTabelaImportacoes();

        // O resumo do último envio vale mais que uma faixa vazia: é onde o
        // operador confere quantos leads entraram e se estão no Painel.
        if(ultimaImportacao){

            mostrarAvisoImportacoes(textoUltimaImportacao(), "info");

        }else if(aviso){

            aviso.style.display = "none";

        }

    }catch(erro){

        iniciarTabelaImportacoes();

        // Só o POST foi confirmado: a rota pode não ter listagem.
        if(erro.status === 404 || erro.status === 405){

            mostrarAvisoImportacoes(
                (ultimaImportacao ? textoUltimaImportacao() + " " : "") +
                "Esta API não expõe listagem de importações — o envio de arquivo continua funcionando.",
                "info"
            );

        }else{

            mostrarAvisoImportacoes(erro.message + " ", "erro", true);

        }

        console.error("Falha ao listar importações:", erro);

    }

}


function mostrarAvisoImportacoes(texto, tipo, comBotao){

    const aviso = document.getElementById("avisoImportacoes");

    if(!aviso) return;

    aviso.className = "avisoClientes aviso-" + (tipo || "info");
    aviso.textContent = texto;
    aviso.style.display = "block";

    if(comBotao){

        const botao = document.createElement("button");

        botao.type = "button";
        botao.className = "btnTentarNovamente";
        botao.textContent = "Tentar novamente";
        botao.onclick = carregarImportacoes;

        aviso.appendChild(botao);

    }

}


// ===============================
// ENVIO DE ARQUIVO
// ===============================

function abrirModalImportacao(){

    arquivoImportacao = null;
    analiseImportacao = null;

    document.getElementById("arquivoImportacao").value = "";
    document.getElementById("nomeArquivoEscolhido").textContent = "Nenhum arquivo selecionado";

    limparErroImportacao();

    bootstrap.Modal
        .getOrCreateInstance(document.getElementById("modalImportacao"))
        .show();

    // Sem await: o modal abre na hora e o arquivo da pasta é anexado se vier.
    tentarArquivoDoServidor();

}


async function selecionarArquivoImportacao(evento){

    arquivoImportacao = evento.target.files[0] || null;
    analiseImportacao = null;

    const rotulo = document.getElementById("nomeArquivoEscolhido");

    limparErroImportacao();

    if(!arquivoImportacao){
        rotulo.textContent = "Nenhum arquivo selecionado";
        return;
    }

    rotulo.textContent = arquivoImportacao.name;

    // Só o CSV é conferido aqui: o layout de .xlsx é validado pela API.
    if(!ehArquivoCsv(arquivoImportacao)) return;

    try{

        const texto = await lerArquivoComoTexto(arquivoImportacao);

        analiseImportacao = analisarCabecalhoCsv(texto);

        if(analiseImportacao.faltando.length){

            // Barrar aqui evita uma subida que já se sabe que vai falhar.
            mostrarErroImportacao(
                "O CSV precisa das colunas " + COLUNAS_OBRIGATORIAS.join("; ") + ". " +
                "Não encontrei: " + analiseImportacao.faltando.join(", ") + "."
            );

            return;

        }

        if(!analiseImportacao.linhas){

            mostrarErroImportacao("O arquivo tem cabeçalho, mas nenhuma linha de cliente.");
            return;

        }

        rotulo.textContent =
            arquivoImportacao.name + " · " +
            analiseImportacao.linhas + " linha" + (analiseImportacao.linhas === 1 ? "" : "s") +
            ' · separador "' + analiseImportacao.separador + '"';

    }catch(erro){

        mostrarErroImportacao("Não foi possível ler este arquivo.");
        console.error("Falha ao analisar o CSV:", erro);

    }

}


// Ao abrir o modal, tenta trazer o CSV da pasta publicada e já o deixa pronto
// para envio, como se o operador o tivesse escolhido no seletor. Se a pasta não
// estiver acessível, o modal segue normal e ele escolhe o arquivo à mão.
async function tentarArquivoDoServidor(){

    const rotulo = document.getElementById("nomeArquivoEscolhido");

    try{

        const baixado = await baixarArquivoLeads();

        // O operador pode ter escolhido um arquivo enquanto a busca corria.
        if(arquivoImportacao) return;

        arquivoImportacao = new File([baixado.buffer], baixado.nome,{
            type:"text/csv"
        });

        analiseImportacao = analisarCabecalhoCsv(baixado.texto);

        if(analiseImportacao.faltando.length){

            mostrarErroImportacao(
                "O CSV do servidor não tem as colunas " +
                analiseImportacao.faltando.join(", ") + "."
            );

            rotulo.textContent = baixado.nome;
            return;

        }

        rotulo.textContent =
            baixado.nome + " · " +
            analiseImportacao.linhas + " linha" + (analiseImportacao.linhas === 1 ? "" : "s") +
            ' · separador "' + analiseImportacao.separador + '"';

    }catch(erro){

        // Pasta não publicada: nada a avisar, o seletor continua disponível.
        console.warn("Pasta de leads indisponível:", erro.message);

    }

}


function mostrarErroImportacao(mensagem){

    const caixa = document.getElementById("erroImportacao");

    caixa.textContent = mensagem;
    caixa.style.display = "block";

}


function limparErroImportacao(){

    const caixa = document.getElementById("erroImportacao");

    caixa.textContent = "";
    caixa.style.display = "none";

}


function enviandoImportacao(ativo, texto){

    const botao = document.getElementById("btnEnviarImportacao");

    botao.disabled = ativo;
    botao.textContent = ativo ? (texto || "Enviando...") : "Enviar";

}


async function enviarImportacao(){

    limparErroImportacao();

    if(!arquivoImportacao){
        mostrarErroImportacao("Escolha um arquivo para enviar.");
        return;
    }

    if(analiseImportacao && analiseImportacao.faltando.length){

        mostrarErroImportacao(
            "Corrija o cabeçalho do CSV antes de enviar. Faltam: " +
            analiseImportacao.faltando.join(", ") + "."
        );

        return;

    }

    enviandoImportacao(true, "Conferindo a base...");

    // Retrato da base antes do envio: o que aparecer depois e não estiver aqui
    // foi criado por este arquivo. Falhar aqui não impede o envio — a
    // identificação apenas cai para a data de criação.
    let antes = null;

    try{

        antes = chavesDeClientes(await apiListarClientes());

    }catch(erro){

        console.warn("Base anterior não pôde ser lida:", erro.message);

    }

    const momentoEnvio = Date.now();

    try{

        enviandoImportacao(true, "Enviando...");

        await apiEnviarImportacao(arquivoImportacao);

        enviandoImportacao(true, "Conferindo os leads...");

        // A importação cria clientes no servidor: a lista local fica velha no
        // mesmo instante. Esta leitura serve às duas coisas — descobrir quem
        // entrou e alimentar o Painel, que lê a mesma rota.
        const registros = await apiListarClientes();

        const novos = antes
            ? registros.filter(registro=>{

                  const cpf = normalizarCpf((registro && registro.cpf) || "");

                  // Sem CPF não há chave para comparar nem para marcar depois:
                  // sem isto, o mesmo registro sem CPF contaria como novo em
                  // todo envio.
                  return cpf && !antes.has(cpf);

              })
            : novosPorDataDeCriacao(registros, momentoEnvio);

        registrarImportacao(novos, arquivoImportacao.name, !antes);

        bootstrap.Modal
            .getOrCreateInstance(document.getElementById("modalImportacao"))
            .hide();

        await carregarImportacoes();

        // A tela de Clientes não carrega nada ao entrar: só vale recarregá-la
        // se o operador já tinha aberto a lista — senão é uma leitura completa
        // jogada fora.
        if(typeof tabelaIniciada !== "undefined" && tabelaIniciada){
            await carregarClientes();
        }

        // O resumo do envio fica na faixa da tela de Importações: quem escreve
        // é carregarImportacoes(), logo acima — sobrescrevê-lo aqui apagaria
        // um erro de listagem que o operador precisa ver.

        // Reaproveita a lista já lida e leva o operador aos leads que entraram.
        await carregarPainel(registros);

        if(novos.length){

            irParaLeadsImportados();

            notificar(textoUltimaImportacao(), "sucesso");

        }else{

            notificar(textoUltimaImportacao(), "info");

        }

    }catch(erro){

        mostrarErroImportacao(erro.message);
        console.error("Falha ao enviar importação:", erro);

    }finally{

        enviandoImportacao(false);

    }

}


async function confirmarExclusaoImportacao(idApi){

    const importacao = importacoes.find(i => String(i.idApi) === String(idApi));

    if(!importacao) return;

    if(!confirm(
        'Excluir a importação "' + (importacao.arquivo || idApi) + '"?\n\n' +
        "Esta ação não pode ser desfeita."
    )){
        return;
    }

    try{

        await apiExcluirImportacao(idApi);

        importacoes = importacoes.filter(i => String(i.idApi) !== String(idApi));

        atualizarTabelaImportacoes();

    }catch(erro){

        notificar("Não foi possível excluir: " + erro.message, "erro");
        console.error("Falha ao excluir importação:", erro);

    }

}
