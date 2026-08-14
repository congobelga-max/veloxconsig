let clientes = [];

let filtroAtual = "todos";

let pesquisaAtual = "";

// O Painel virou tabela (painel.js): os cards, os tiles e o seletor de planilha
// não existem mais no index.php. As funções abaixo continuam aqui porque o
// tratador de proposta e o WhatsApp dependem delas — as que mexem no DOM antigo
// checam o elemento antes de usá-lo e simplesmente não fazem nada.
const arquivo = document.getElementById("arquivo");

if(arquivo){
    arquivo.addEventListener("change", importarPlanilha);
}

// =========================
// IMPORTAR PLANILHA
// =========================


async function importarPlanilha(e){

    const file = e.target.files[0];

    if(!file) return;

    let workbook;

    try{

        workbook = ehArquivoCsv(file)
            ? await lerWorkbookCsv(file)
            : await lerWorkbookBinario(file);

    }catch(erro){

        notificar("Não foi possível ler esta planilha.", "erro");
        console.error(erro);
        e.target.value = "";
        return;

    }

    processarPlanilha(workbook, e.target);

}


// CSV precisa de tratamento próprio: o SheetJS assume vírgula como separador
// e UTF-8 como codificação, e o Excel brasileiro usa ";" e windows-1252.
// raw:true mantém tudo como texto — é o que preserva o zero à esquerda do CPF.
async function lerWorkbookCsv(arquivo){

    const texto = await lerArquivoComoTexto(arquivo);

    return XLSX.read(texto,{
        type:"string",
        FS: detectarSeparadorCsv(texto),
        raw:true
    });

}


// Botão Importar: tenta primeiro a pasta de leads publicada e, se ela não
// estiver acessível, abre o seletor de arquivos de sempre. Assim o operador
// nunca fica sem caminho para importar, com ou sem o Alias configurado.
async function importarLeads(){

    const botao = document.getElementById("btnImportar");

    if(botao) botao.disabled = true;

    try{

        const arquivo = await baixarArquivoLeads();

        const workbook = XLSX.read(arquivo.texto,{
            type:"string",
            FS: detectarSeparadorCsv(arquivo.texto),
            raw:true
        });

        processarPlanilha(workbook, null);

        notificar(
            clientes.length + " leads carregados de " + arquivo.nome + ".",
            "sucesso"
        );

    }catch(erro){

        // Pasta não publicada, arquivo ausente ou ilegível: o operador escolhe.
        console.warn("Pasta de leads indisponível, abrindo o seletor:", erro.message);

        const seletor = document.getElementById("arquivo");

        if(seletor) seletor.click();

    }finally{

        if(botao) botao.disabled = false;

    }

}


function lerWorkbookBinario(arquivo){

    return new Promise((resolver, rejeitar)=>{

        const leitor = new FileReader();

        leitor.onload = function(evt){

            try{

                resolver(
                    typeof evt.target.result === "string"
                        ? XLSX.read(evt.target.result,{type:"binary"})
                        : XLSX.read(new Uint8Array(evt.target.result),{type:"array"})
                );

            }catch(erro){

                rejeitar(erro);

            }

        };

        leitor.onerror = () => rejeitar(leitor.error);

        if(leitor.readAsBinaryString){
            leitor.readAsBinaryString(arquivo);
        }else{
            leitor.readAsArrayBuffer(arquivo);
        }

    });

}


function processarPlanilha(workbook, entrada){

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const json = XLSX.utils.sheet_to_json(sheet,{
            defval:""
        });


        // ==========================================
        // GUARDA O HISTÓRICO DA LISTA ATUAL
        // ==========================================

        const historico = {};

        clientes.forEach(cliente=>{

            const id = somenteNumeros(cliente.cpf);

            if(id){

                historico[id] = {
                    status: cliente.status || "nao",
                    data: cliente.data || "",
                    hora: cliente.hora || ""
                };

            }

        });


        // ==========================================
        // MONTA A NOVA LISTA
        // ==========================================

        const novosClientes = [];

        json.forEach(linha=>{

            const nome =
                linha.NOME ||
                linha.Nome ||
                linha.nome ||
                linha.CLIENTE ||
                linha.Cliente ||
                "";

            if(String(nome).trim() === "") return;


            const cpf =
                linha.CPF ||
                linha.cpf ||
                "";


            const telefone =
                linha.TELEFONE ||
                linha.Telefone ||
                linha.telefone ||
                linha.CELULAR ||
                linha.Celular ||
                linha.celular ||
                "";


            const id = normalizarCpf(cpf);

            if(!id) return;

            // Chave usada antes de os zeros passarem a ser repostos.
            migrarHistoricoCpf(somenteNumeros(cpf), id);


            // ==========================================
            // VERIFICA SE O CPF JÁ EXISTIA
            // ==========================================

            const clienteAnterior = historico[id] || null;


            // ==========================================
            // STATUS DA PLANILHA
            // ==========================================

            const statusBruto = String(
                linha.Status ||
                linha.STATUS ||
                ""
            ).trim();

            const statusPlanilha = statusBruto.toUpperCase();

            let statusFinal;


            // Se a planilha possui um status válido,
            // ela tem prioridade.

            if(statusPlanilha === "COM"){

                statusFinal = "com";

            }else if(statusPlanilha === "SEM"){

                statusFinal = "sem";

            }else if(
                statusPlanilha === "NÃO CONSULTADO" ||
                statusPlanilha === "NAO CONSULTADO" ||
                statusPlanilha === "NÃO" ||
                statusPlanilha === "NAO"
            ){

                statusFinal = "nao";

            }else if(clienteAnterior){

                // CPF já existia na lista atual
                statusFinal = clienteAnterior.status;

            }else{

                // Procura histórico salvo neste navegador
                statusFinal =
                    localStorage.getItem("status_" + id) ||
                    "nao";

            }


            // ==========================================
            // DATA
            // ==========================================

            let dataFinal = "";

            if(linha.Data || linha.DATA){

                dataFinal =
                    linha.Data ||
                    linha.DATA;

            }else if(clienteAnterior){

                dataFinal =
                    clienteAnterior.data ||
                    "";

            }else{

                dataFinal =
                    localStorage.getItem("data_" + id) ||
                    "";

            }


            // ==========================================
            // HORA
            // ==========================================

            let horaFinal = "";

            if(linha.Hora || linha.HORA){

                horaFinal =
                    linha.Hora ||
                    linha.HORA;

            }else if(clienteAnterior){

                horaFinal =
                    clienteAnterior.hora ||
                    "";

            }else{

                horaFinal =
                    localStorage.getItem("hora_" + id) ||
                    "";

            }


            // ==========================================
            // NÃO CONSULTADO NÃO DEVE TER DATA/HORA
            // ==========================================

            if(statusFinal === "nao"){

                dataFinal = "";
                horaFinal = "";

            }


            // ==========================================
            // ADICIONA À NOVA LISTA
            // ==========================================

            novosClientes.push({

                id: id,

                nome: String(nome).trim(),

                cpf: formatarCPF(cpf),

                telefone: formatarTelefone(telefone),

                status: statusFinal,

                data: dataFinal,

                hora: horaFinal

            });


            // ==========================================
            // ATUALIZA O LOCALSTORAGE
            // ==========================================

            localStorage.setItem(
                "status_" + id,
                statusFinal
            );

            if(statusFinal !== "nao"){

                if(dataFinal){

                    localStorage.setItem(
                        "data_" + id,
                        dataFinal
                    );

                }

                if(horaFinal){

                    localStorage.setItem(
                        "hora_" + id,
                        horaFinal
                    );

                }

            }else{

                localStorage.removeItem(
                    "data_" + id
                );

                localStorage.removeItem(
                    "hora_" + id
                );

            }

        });


        // ==========================================
        // SUBSTITUI PELA NOVA LISTA
        // ==========================================

        clientes = novosClientes;


        clientes.sort((a,b)=>
            a.nome.localeCompare(b.nome)
        );


        // Volta para TODOS ao importar nova lista

        filtroAtual = "todos";

        document
            .querySelectorAll(".cardDash")
            .forEach(card=>
                card.classList.remove("ativo")
            );

        const dashTodos =
            document.getElementById("dashTodos");

        if(dashTodos){

            dashTodos.classList.add("ativo");

        }


        renderizarCards();

        atualizarDashboard();

        if(entrada) entrada.value = "";

}

// ==========================================
// ATUALIZAR DASHBOARD
// ==========================================

function atualizarDashboard(){

    let total=clientes.length;

    let consultados=0;

    let com=0;

    let sem=0;

    let aguardando=0;

    clientes.forEach(c=>{

        if(c.status!="nao")
            consultados++;

        if(c.status=="com")
            com++;

        if(c.status=="sem")
            sem++;

        if(aguardandoResposta(c))
            aguardando++;

    });

    escreverContador("total",total);

    escreverContador("consultados",consultados);

    escreverContador("comMargem",com);

    escreverContador("semMargem",sem);

    escreverContador("aguardandoResposta",aguardando);

}


// Os tiles saíram do Painel: sem o elemento, o contador é ignorado.
function escreverContador(id, valor){

    const elemento = document.getElementById(id);

    if(elemento) elemento.textContent = valor;

}

// ==========================================
// RENDERIZAR CARD
// ==========================================

function renderizarCards(){

    const lista = document.getElementById("clientes");

    // A lista de cards não existe mais no Painel.
    if(!lista) return;

    lista.innerHTML = "";

    clientes.forEach(cliente=>{
		
		if(filtroAtual=="pendentes" && cliente.status!="nao")
		return;

		if(filtroAtual=="com" && cliente.status!="com")
		return;

		if(filtroAtual=="sem" && cliente.status!="sem")
		return;

		if(filtroAtual=="aguardando" && !aguardandoResposta(cliente))
		return;

		if(pesquisaAtual){

			const termo = pesquisaAtual.toLowerCase();

			const nome = String(cliente.nome || "").toLowerCase();

			const cpf = somenteNumeros(cliente.cpf);

			const telefone = somenteNumeros(cliente.telefone);

			const termoNumerico = somenteNumeros(pesquisaAtual);

			const encontrouNome =
				nome.includes(termo);

			const encontrouCPF =
				termoNumerico &&
				cpf.includes(termoNumerico);

			const encontrouTelefone =
				termoNumerico &&
				telefone.includes(termoNumerico);

			if(
				!encontrouNome &&
				!encontrouCPF &&
				!encontrouTelefone
			){
        return;
    }

}

        let corStatus="nao";

        if(cliente.status=="com") corStatus="com";

        if(cliente.status=="sem") corStatus="sem";

        lista.innerHTML += `

<div class="cliente">

    <div class="topo">

        <div class="nome">
            ${escaparHtml(cliente.nome)}
        </div>

        <div class="status ${corStatus}"></div>

    </div>

    <div class="rotulo">
        CPF
    </div>

    <div class="valor valorCopiavel"
         onclick="copiarTexto('${escaparArgumento(cliente.cpf)}', 'CPF')"
         title="Clique para copiar o CPF">
        ${escaparHtml(cliente.cpf)}
    </div>

    <div class="rotulo">
        Telefone
    </div>

    <div class="valor valorCopiavel"
         onclick="copiarTexto('${escaparArgumento(cliente.telefone)}', 'Telefone')"
         title="Clique para copiar o telefone">
        ${escaparHtml(cliente.telefone)}
    </div>

    ${aguardandoResposta(cliente)
        ? `<div class="aguardandoRespostaCard">📲 Aguardando resposta</div>`
        : ""}

    <div class="acoes">

	<button
		class="btnZap"
		onclick="abrirWhatsapp('${somenteNumeros(cliente.telefone)}', '${escaparArgumento(cliente.nome)}', '${cliente.id}')">

		<i class="bi bi-whatsapp"></i>

		WhatsApp

	</button>
    <button class="btnProposta" onclick="abrirModalProposta('${cliente.id}')">✨ Montar proposta</button>
    <div class="dropdown">

            <button
                class="menu"
                data-bs-toggle="dropdown">

                <i class="bi bi-three-dots-vertical"></i>

            </button>

            <ul class="dropdown-menu dropdown-menu-end">

				<li>

					<a
						class="dropdown-item"
						href="#"
						onclick="alterarStatus('${cliente.id}','com')">

						🟢 Com margem

					</a>

				</li>

				<li>

				 <a
						class="dropdown-item"
						href="#"
						onclick="alterarStatus('${cliente.id}','sem')">

						🟡 Sem margem

				</a>

				</li>

				<li>

					<a
						class="dropdown-item"
						href="#"
						onclick="alterarStatus('${cliente.id}','nao')">

						⚪ Não Consultado

					</a>

				</li>            
			</ul>

        </div>

    </div>

</div>

`;

    });

}

// =========================
// PRIMEIRO CONTATO
// =========================

// Enum do servidor no campo `contatoStatus`.
//
// Abrir a conversa pelo botão do WhatsApp (ou do Telegram) grava CONTATADO.
// ENVIADO fica para quem gravar de fora do app; aqui ele só é lido, e conta
// como já abordado igual ao 3. A sincronização nunca rebaixa: só sobe.
const CONTATO_STATUS = {
    NAO_CONTATADO: 1,
    ENVIADO: 2,
    CONTATADO: 3
};

const NOMES_CONTATO_STATUS = {
    naocontatado: CONTATO_STATUS.NAO_CONTATADO,
    enviado: CONTATO_STATUS.ENVIADO,
    contatado: CONTATO_STATUS.CONTATADO
};


// Aceita número e texto: o mesmo enum pode chegar como 2 ou como "Enviado",
// conforme a serialização. Desconhecido vale 0, que é menor que tudo e faz o
// app tratar o registro como ainda não abordado.
function numeroContatoStatus(valor){

    if(valor === undefined || valor === null || valor === "") return 0;

    const numero = Number(valor);

    if(!isNaN(numero)) return numero;

    const chave = String(valor).normalize("NFD")
        .replace(/[̀-ͯ]/g,"")
        .toLowerCase()
        .replace(/[\s_-]+/g,"");

    return NOMES_CONTATO_STATUS[chave] || 0;

}


// Já abordado: ENVIADO e CONTATADO contam igual. O chip "Não contatados" existe
// para achar quem ninguém procurou ainda, e não para separar os dois.
function foiAbordado(valor){

    return numeroContatoStatus(valor) >= CONTATO_STATUS.ENVIADO;

}


// Procura o registro carregado da API. O Painel alimenta `clientes`; a tela de
// Clientes, `clientesApi`.
function clientePorId(id){

    const listas = [
        typeof clientes !== "undefined" && Array.isArray(clientes) ? clientes : [],
        typeof clientesApi !== "undefined" && Array.isArray(clientesApi) ? clientesApi : []
    ];

    for(const lista of listas){

        const achado = lista.find(cliente => cliente && cliente.id === id);

        if(achado) return achado;

    }

    return null;

}


// Avisa o servidor que o cliente foi abordado: contatoStatus -> Contatado (3).
//
// NÃO é esperado com await de propósito. O window.open da conversa precisa
// acontecer dentro do gesto de clique, e segurar a mão do operador esperando a
// rede faria o bloqueador de pop-up comer a janela do WhatsApp.
//
// O registro em memória é atualizado antes da resposta para a linha reagir na
// hora, e volta ao valor anterior se o servidor recusar: sem cópia local, o
// que a tela mostra tem de ser o que o servidor aceitou.
function sincronizarContatoNaApi(id){

    if(!id) return;

    const cliente = clientePorId(id);

    if(!cliente || cliente.idApi == null){

        console.warn(
            "contatoStatus não enviado: cliente " + id +
            " não está em memória com id da API."
        );

        return;

    }

    const anterior = cliente.contatoStatus;

    // Só sobe: quem já está em CONTATADO não tem o que reenviar.
    if(numeroContatoStatus(anterior) >= CONTATO_STATUS.CONTATADO) return;

    cliente.contatoStatus = CONTATO_STATUS.CONTATADO;

    apiAtualizarContatoStatus(
        typeof identificadorUrl === "function" ? identificadorUrl(cliente) : cliente.idApi,
        CONTATO_STATUS.CONTATADO,
        cliente.bruto
    )
        .catch(erro=>{

            cliente.contatoStatus = anterior;

            // O operador precisa saber que a marca não pegou — a tela vai
            // voltar a mostrar "Não contatado" no próximo desenho.
            notificar(
                "Conversa aberta, mas o servidor não registrou o contato: " +
                erro.message,
                "erro"
            );

            console.error("Falha ao atualizar contatoStatus:", erro);

            if(typeof desenharPainel === "function") desenharPainel();

        });

}


// Monta o texto da abordagem e registra o contato. Fica separado da abertura
// porque WhatsApp e Telegram mandam a mesma mensagem e marcam o mesmo
// histórico — só o canal muda.
//
// Quem já foi abordado recebe o texto de retorno, e quem é abordado agora
// recebe uma das 50 aberturas. Essa decisão vem do `contatoStatus` do servidor:
// sem cópia local, ela passa a valer em qualquer navegador — e a leitura tem de
// acontecer ANTES da sincronização, que já sobe o status para CONTATADO.
function textoDeContato(nome, id){

    const primeiroNome = String(nome || "").trim().split(/\s+/)[0];

    const cliente = clientePorId(id);
    const jaAbordado = cliente ? foiAbordado(cliente.contatoStatus) : false;

    sincronizarContatoNaApi(id);

    if(jaAbordado){

        return "Oi, " + primeiroNome + "! Passando para dar continuidade ao nosso " +
            "contato sobre as condições de crédito disponíveis para você. 😊\n\n" +
            "Caso tenha interesse, posso verificar as opções atualizadas e te enviar por aqui.";

    }

    // Uma das 50 redações de mensagens.js: leads seguidos não recebem o
    // mesmo texto, e o cliente que já foi abordado sempre recebe o dele.
    // O rodízio continua no localStorage — é preferência de redação desta
    // máquina, não estado do cliente, e não existe campo para ele na API.
    return mensagemInicial(primeiroNome, id);

}


function abrirWhatsapp(numero, nome, id){

    return abrirWhatsappComTexto(numero, textoDeContato(nome, id));

}


function abrirTelegram(numero, nome, id){

    return abrirTelegramComTexto(numero, textoDeContato(nome, id));

}

// =========================
// COPIAR CPF
// =========================

function copiarTexto(texto, tipo){

    let textoLimpo = String(texto || "").replace(/\D/g,'');

    // CPF deve sempre ser copiado com 11 dígitos.
    // Se o zero à esquerda foi perdido na planilha, ele é reposto somente na cópia.
    if(String(tipo || "").toLowerCase().includes("cpf")){
        textoLimpo = textoLimpo.padStart(11, "0");
    }

    const input = document.createElement("input");
    input.value = textoLimpo;
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand("copy");
    document.body.removeChild(input);

    notificar(tipo + " copiado!", "sucesso");

}

// =========================
// ALTERAR STATUS
// =========================

function alterarStatus(id,status){

    clientes.forEach(cliente=>{

        if(cliente.id==id){

            cliente.status=status;

            if(status==="nao"){

                cliente.data="";
                cliente.hora="";

                localStorage.setItem("status_"+id,"nao");
                localStorage.removeItem("data_"+id);
                localStorage.removeItem("hora_"+id);

            }else{

                const agora=new Date();

                cliente.data=agora.toLocaleDateString("pt-BR");

                cliente.hora=agora.toLocaleTimeString("pt-BR",{
                    hour:"2-digit",
                    minute:"2-digit"
                });

                localStorage.setItem("status_"+id,status);
                localStorage.setItem("data_"+id,cliente.data);
                localStorage.setItem("hora_"+id,cliente.hora);

            }

        }

    });

    renderizarCards();
    atualizarDashboard();

    if(status!=="nao" && filtroAtual=="todos"){

        setTimeout(function(){

            irParaProximoCliente(id);

        },150);

    }

}

// =========================
// ir Para Proximo Cliente
// =========================

function irParaProximoCliente(idAtual){

    const indiceAtual = clientes.findIndex(c => c.id == idAtual);

    if(indiceAtual == -1) return;

    const cards = document.querySelectorAll(".cliente");

    for(let i = indiceAtual + 1; i < clientes.length; i++){

        if(clientes[i].status == "nao"){

            if(cards[i]){

                cards[i].scrollIntoView({

                    behavior:"smooth",

                    block:"center"

                });
				
				if(navigator.vibrate){

					navigator.vibrate(80);

				}

                setTimeout(()=>{

                    cards[i].classList.add("destacado");

                    setTimeout(()=>{

                        cards[i].classList.remove("destacado");

                    },1200);

                },400);

            }

            return;

        }

    }

}
// ===============================
// APLICAR fILTRO
// ===============================

const TILES_FILTRO = {
    todos:"dashTodos",
    pendentes:"dashPendentes",
    com:"dashCom",
    sem:"dashSem",
    aguardando:"dashAguardando"
};


function aplicarFiltro(filtro){

    filtroAtual = filtro;

    document
        .querySelectorAll(".cardDash")
        .forEach(c=>c.classList.remove("ativo"));

    const tile = document.getElementById(TILES_FILTRO[filtro] || "");

    if(tile) tile.classList.add("ativo");

    renderizarCards();
}
// ===============================
// EXPORTAR PLANILHA
// ===============================

	
function exportarPlanilha(){

    const agora = new Date();

    const dia = String(agora.getDate()).padStart(2,"0");
    const mes = String(agora.getMonth()+1).padStart(2,"0");
    const ano = agora.getFullYear();

    const hora = String(agora.getHours()).padStart(2,"0");
    const minuto = String(agora.getMinutes()).padStart(2,"0");

    const nomeArquivo =
        `Clientes_${dia}-${mes}-${ano}_${hora}-${minuto}.xlsx`;

    const dados = clientes.map(cliente => ({

        Nome: cliente.nome,

        CPF: cliente.cpf,

        Telefone: cliente.telefone,

        Status:
            cliente.status === "com"
                ? "COM"
                : cliente.status === "sem"
                    ? "SEM"
                    : "NÃO CONSULTADO",

        Data: cliente.data,

        Hora: cliente.hora

    }));

    const ws = XLSX.utils.json_to_sheet(dados);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Clientes");

    XLSX.writeFile(wb, nomeArquivo);

}
// ===============================
// FUNÇÕES AUXILIARES
// ===============================

function somenteNumeros(texto){
    return String(texto || "").replace(/\D/g,"");
}

// Cliente que já recebeu o primeiro contato mas ainda não foi consultado.
// Mesma regra usada pelo contador do dashboard e pelo filtro "aguardando".
// O contato vem do servidor (`contatoStatus`); só a consulta de margem
// continua local, porque a API não tem esse campo.
function aguardandoResposta(cliente){

    return cliente.status === "nao" && foiAbordado(cliente.contatoStatus);

}

// Os cards são montados como texto HTML, então todo valor vindo da planilha
// precisa ser escapado — um nome como "D'Ávila" quebrava a marcação.
function escaparHtml(texto){

    return String(texto == null ? "" : texto)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;");

}

// Valor que vai dentro de uma string JS entre aspas simples,
// dentro de um atributo onclick: escapa para o JS e depois para o HTML.
function escaparArgumento(texto){

    return escaparHtml(
        String(texto == null ? "" : texto)
            .replace(/\\/g,"\\\\")
            .replace(/'/g,"\\'")
    );

}

function formatarTelefone(numero){

    numero = somenteNumeros(numero);

    if(numero.length==11){

        return "("+
            numero.substring(0,2)+") "+
            numero.substring(2,7)+"-"+
            numero.substring(7);

    }

    if(numero.length==10){

        return "("+
            numero.substring(0,2)+") "+
            numero.substring(2,6)+"-"+
            numero.substring(6);

    }

    return numero;

}

// O Excel guarda CPF como número e come os zeros à esquerda: 06590088403 sai
// da planilha como 6590088403. Sem repor, a chave local fica com 10 dígitos e
// nunca casa com o CPF de 11 do servidor nem com o histórico do operador.
function normalizarCpf(valor){

    const digitos = somenteNumeros(valor);

    return digitos && digitos.length < 11
        ? digitos.padStart(11,"0")
        : digitos;

}


// Importações anteriores gravaram o histórico sob o CPF truncado.
// Repor os zeros sem migrar faria o trabalho já registrado desaparecer.
function migrarHistoricoCpf(idAntigo, idNovo){

    if(!idAntigo || idAntigo === idNovo) return;

    const prefixos = [
        "status_", "data_", "hora_",
        // O contato saiu do localStorage e vive no `contatoStatus` do servidor;
        // estes prefixos ficam só para mover o que máquinas antigas gravaram.
        "contato_inicial_", "contato_data_", "contato_hora_",
        "classificacao_", "classificacao_texto_",
        // Sem migrar, o cliente receberia uma segunda mensagem de abertura
        // diferente da primeira depois de o CPF ganhar os zeros à esquerda.
        "mensagem_inicial_"
    ];

    prefixos.forEach(prefixo=>{

        const valor = localStorage.getItem(prefixo + idAntigo);

        if(valor === null) return;

        // O registro sob a chave nova tem precedência: é o mais recente.
        if(localStorage.getItem(prefixo + idNovo) === null){
            localStorage.setItem(prefixo + idNovo, valor);
        }

        localStorage.removeItem(prefixo + idAntigo);

    });

}


function formatarCPF(cpf){

    cpf = normalizarCpf(cpf);

    if(cpf.length!=11)
        return cpf;

    return cpf.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );

}



// ===============================
// AJUSTA DADOS IMPORTADOS
// ===============================

	



// ===============================
// MENSAGEM CASO NÃO TENHA DADOS
// ===============================

const listaCards = document.getElementById("clientes");

if(clientes.length===0 && listaCards){

    listaCards.innerHTML=`

        <div class="alert alert-warning text-center">

            Nenhum cliente encontrado na planilha.

        </div>

    `;

}



// ===============================
// PESQUISA DE CLIENTES
// ===============================

const campoPesquisa = document.getElementById("campoPesquisa");

if(campoPesquisa){

    campoPesquisa.addEventListener("input", function(){

        pesquisaAtual = this.value.trim();

        const botaoLimpar =
            document.getElementById("limparPesquisa");

        if(botaoLimpar){

            botaoLimpar.style.display =
                pesquisaAtual ? "block" : "none";

        }

        renderizarCards();

    });

}

function limparPesquisa(){

    pesquisaAtual = "";

    const campo =
        document.getElementById("campoPesquisa");

    const botao =
        document.getElementById("limparPesquisa");

    if(campo){

        campo.value = "";
        campo.focus();

    }

    if(botao){

        botao.style.display = "none";

    }

    renderizarCards();

}


let clientePropostaAtual=null;
function abrirModalProposta(id){
 clientePropostaAtual=clientes.find(c=>String(c.id)===String(id));
 if(!clientePropostaAtual)return notificar("Cliente não encontrado.", "erro");
 document.getElementById("clienteProposta").textContent="Cliente: "+clientePropostaAtual.nome;
 document.getElementById("textoTelegram").value=""; document.getElementById("mensagemProposta").value="";
 const av=document.getElementById("avisoProposta"); av.style.display="none"; av.textContent="";
 bootstrap.Modal.getOrCreateInstance(document.getElementById("modalProposta")).show();
}

function normalizarRetornoTelegram(texto){
    return String(texto || "")
        .replace(/\r\n?/g, "\n")
        .replace(/\u00A0/g, " ")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[‐‑‒–—]/g, "—")
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .trim();
}

function ofertasPaypro(t){
 const ls=normalizarRetornoTelegram(t).split("\n"); let on=false,o=[];
 for(const x0 of ls){const x=x0.trim();
  if(/paypro/i.test(x)&&/ofertas disponíveis/i.test(x)){on=true;continue}
  if(on&&/digite o número da oferta|voltar aos bancos|bancos disponíveis/i.test(x))break;
  if(!on)continue;
  const m=x.match(/^\d+[\.\s—-]+\s*(\d+)\s*x\s+de\s+R\$\s*([\d.]+,\d{2})\s*(?:→|>|—|-)+\s*libera\s+R\$\s*([\d.]+,\d{2})/i);
  if(m)o.push({prazo:+m[1],parcela:m[2],liberado:m[3]});
 } return o;
}
function resumoBancos(t){
 const o=[]; for(const x0 of normalizarRetornoTelegram(t).split("\n")){const x=x0.trim();
  const m=x.match(/^\d+\s*[—-]\s*(.+?)\s*[—-]\s*(\d+)\s*x\s+R\$\s*([\d.]+,\d{2})\s*(?:→|>|—|-)+\s*R\$\s*([\d.]+,\d{2})/i);
  if(m)o.push({banco:m[1].trim(),prazo:+m[2],parcela:m[3],liberado:m[4]});
 } return o;
}
function valorBR(v){return Number(String(v).replace(/\./g,"").replace(",","."))}

// Texto que chega ao cliente quando há oferta. Usado pelo retorno do Telegram
// e pela simulação da API (simulacao.js): a mensagem é a mesma nos dois
// caminhos, e o modelo mora num lugar só.
//
// Recebe blocos — [{ofertas:[{prazo, parcela, liberado}]}] —, um por banco.
// Cada bloco vira uma "Opção N", que é como o cliente distingue as propostas
// sem que o nome do banco apareça. As ofertas já vêm ordenadas por prazo e
// com parcela/liberado formatados em pt-BR.
function montarMensagemOfertas(opcoes){

    const blocos = opcoes.filter(bloco =>
        bloco && bloco.ofertas && bloco.ofertas.length
    );

    const todas = blocos.reduce(
        (lista, bloco) => lista.concat(bloco.ofertas),
        []
    );

    const maior = todas.reduce(
        (m,x) => valorBR(x.liberado) > valorBR(m.liberado) ? x : m,
        todas[0]
    );

    let msg = "Consegui algumas condições disponíveis para você 😊\n\n" +
        "💰 Você pode liberar até R$ " + maior.liberado + ".\n\n" +
        "Veja as opções:\n";

    blocos.forEach((bloco, indice)=>{

        // Com um bloco só o cabeçalho não separa nada — apenas polui.
        msg += "\n" + (blocos.length > 1 ? "Opção " + (indice + 1) + "\n" : "");

        bloco.ofertas.forEach(x=>{
            msg += "• " + x.prazo + "x de R$ " + x.parcela +
                " → recebe R$ " + x.liberado + "\n";
        });

    });

    return msg + "\nQual dessas opções fica melhor para você?";

}


// Mesma resposta para "consultei e não veio nada", venha de onde vier.
const MENSAGEM_SEM_OFERTA =
    "Fiz a consulta das condições disponíveis no momento e, por enquanto, " +
    "não conseguimos uma proposta liberada para contratação.\n\n" +
    "As condições podem sofrer atualizações. Vou deixar seu contato em " +
    "acompanhamento e, assim que surgir uma opção disponível, entro em contato. 😊";

let colagemTelegramEmAndamento = false;

async function colarTelegramAutomaticamente(){

    const campo = document.getElementById("textoTelegram");

    if(!campo || campo.value.trim() || colagemTelegramEmAndamento){
        return;
    }

    if(!navigator.clipboard || !navigator.clipboard.readText){
        return;
    }

    colagemTelegramEmAndamento = true;

    try{

        const texto = await navigator.clipboard.readText();

        if(texto && !campo.value.trim()){
            campo.value = texto;
            campo.dispatchEvent(new Event("input", {bubbles:true}));

            // Após colar a resposta do Telegram, gera a proposta automaticamente
            // — mas só se a simulação da API não tiver escrito nada, senão um
            // toque no campo apagaria a mensagem que já estava pronta.
            if(!document.getElementById("mensagemProposta").value.trim()){
                gerarProposta();
            }
        }

    }catch(erro){
        // Safari/iOS pode exigir autorização do sistema para colar.
    }finally{
        colagemTelegramEmAndamento = false;
    }

}

function limparTratador(){

    const telegram = document.getElementById("textoTelegram");
    const mensagem = document.getElementById("mensagemProposta");
    const aviso = document.getElementById("avisoProposta");

    if(telegram) telegram.value = "";
    if(mensagem) mensagem.value = "";

    if(aviso){
        aviso.textContent = "";
        aviso.style.display = "none";
    }

    if(telegram){
        telegram.focus();
    }

}

function gerarProposta(){
 if(!clientePropostaAtual)return;

 const t=normalizarRetornoTelegram(document.getElementById("textoTelegram").value);
 if(!t)return notificar("Cole primeiro a resposta do Telegram.", "erro");

 const av=document.getElementById("avisoProposta");
 const campo=document.getElementById("mensagemProposta");
 av.style.display="none"; av.textContent="";

 const id=clientePropostaAtual.id;
 const margemMatch=t.match(/Margem disponível:\s*R\$\s*([\d.]+,\d{2})/i);
 const margem=margemMatch ? valorBR(margemMatch[1]) : null;

 // Oferta: Paypro primeiro; se não houver, melhor oferta encontrada.
 let o=ofertasPaypro(t), pay=true;
 if(!o.length){
   const r=resumoBancos(t), p=r.filter(x=>/paypro/i.test(x.banco));
   if(p.length)o=p;
   else if(r.length){
     r.sort((x,y)=>valorBR(y.liberado)-valorBR(x.liberado));
     o=[r[0]]; pay=false;
   }
 }

 if(o.length){
   o.sort((x,y)=>x.prazo-y.prazo);
   // O retorno do Telegram é de um banco só: um bloco, sem cabeçalho "Opção".
   campo.value=montarMensagemOfertas([{ofertas:o}]);
   localStorage.setItem("classificacao_"+id,"oferta_disponivel");
   localStorage.setItem("classificacao_texto_"+id,"Oferta disponível");
   av.textContent=pay ? "✓ Oferta disponível — Paypro priorizada." : "✓ Oferta disponível.";
   av.style.display="block";
   return;
 }

 // Timeout tem prioridade sobre "nenhum banco", pois ainda cabe nova tentativa.
 const pendente=/banco não respondeu a tempo|banco nao respondeu a tempo|tente novamente em alguns minutos|\btimeout\b/i.test(t);
 if(pendente){
   campo.value="A consulta ainda está em processamento em uma das instituições. Vou realizar uma nova tentativa e, assim que tiver o retorno, te aviso por aqui. 😊";
   localStorage.setItem("classificacao_"+id,"consulta_pendente");
   localStorage.setItem("classificacao_texto_"+id,"Consulta pendente — Banco sem resposta");
   av.textContent="🟡 CONSULTA PENDENTE — Banco sem resposta. Realizar nova consulta.";
   av.style.display="block";
   return;
 }

 const naoElegivel=/perfil não elegível|perfil nao elegivel|margem disponível R\$\s*0[,.]00 abaixo do mínimo|margem disponivel R\$\s*0[,.]00 abaixo do minimo/i.test(t) || margem===0;
 if(naoElegivel){
   campo.value="Verifiquei as condições disponíveis e, neste momento, não foi possível liberar uma proposta para contratação.\n\nCaso haja alguma atualização nas condições disponíveis, podemos realizar uma nova consulta. 😊";
   localStorage.setItem("classificacao_"+id,"sem_margem");
   localStorage.setItem("classificacao_texto_"+id,"Sem margem — Não elegível");
   av.textContent="🔴 SEM MARGEM — NÃO ELEGÍVEL" + (margem!==null ? " | Margem: R$ "+margem.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "");
   av.style.display="block";
   return;
 }

 const semOferta=/nenhum banco disponível no momento|nenhum banco disponivel no momento|sem oferta disponível no momento|sem oferta disponivel no momento|cliente não aprovado pelo motor de crédito|cliente nao aprovado pelo motor de credito|\bdenied\b/i.test(t);
 if(semOferta){
   campo.value=MENSAGEM_SEM_OFERTA;
   const comMargem=margem!==null && margem>0;
   localStorage.setItem("classificacao_"+id,comMargem ? "com_margem_sem_oferta" : "sem_oferta");
   localStorage.setItem("classificacao_texto_"+id,comMargem ? "Com margem — Sem oferta bancária" : "Sem oferta bancária");
   av.textContent=(comMargem ? "🟠 COM MARGEM — SEM OFERTA BANCÁRIA" : "🟠 SEM OFERTA BANCÁRIA") +
      (margem!==null ? " | Margem: R$ "+margem.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "");
   av.style.display="block";
   return;
 }

 campo.value="";
 av.textContent="⚠️ Não consegui identificar o resultado da consulta. Verifique se todo o retorno do bot foi copiado.";
 av.style.display="block";
}

// Copiar e enviar valem para a proposta e para o assistente de contrato:
// a implementação fica aqui, e as duas telas chamam a mesma.

async function copiarParaAreaDeTransferencia(texto){

    if(!texto) return false;

    try{

        if(navigator.clipboard && window.isSecureContext){
            await navigator.clipboard.writeText(texto);
            return true;
        }

    }catch(erro){
        // Sem permissão ou fora de contexto seguro: cai no modo antigo.
    }

    // execCommand copia o que está selecionado, então precisa de um campo real
    // na página — fora da tela para não piscar nada para o operador.
    const campo = document.createElement("textarea");

    campo.value = texto;
    campo.style.position = "fixed";
    campo.style.left = "-9999px";

    document.body.appendChild(campo);
    campo.select();

    let copiou = false;

    try{
        copiou = document.execCommand("copy");
    }catch(erro){
        copiou = false;
    }

    document.body.removeChild(campo);

    return copiou;

}


function numeroInternacional(telefone){

    const numero = somenteNumeros(telefone);

    return (numero.length === 10 || numero.length === 11)
        ? "55" + numero
        : numero;

}


// Devolve a janela aberta (ou null): quem chama fora de um clique direto
// precisa saber quando o bloqueador de pop-up barrou a abertura.
function abrirWhatsappComTexto(telefone, texto){

    return window.open(
        "https://wa.me/" + numeroInternacional(telefone) +
        "?text=" + encodeURIComponent(texto),
        "_blank"
    );

}


// O Telegram não tem equivalente ao ?text= do wa.me. `t.me/+<numero>` abre a
// conversa certa mas não aceita corpo; `t.me/share` aceita texto mas não o
// destinatário. Como o destinatário é o que importa aqui, abre-se a conversa
// e a mensagem vai para a área de transferência — o operador cola.
async function abrirTelegramComTexto(telefone, texto){

    const copiou = await copiarParaAreaDeTransferencia(texto);

    const janela = window.open(
        "https://t.me/+" + numeroInternacional(telefone),
        "_blank"
    );

    notificar(
        copiou
            ? "Telegram aberto — a mensagem está copiada, é só colar."
            : "Telegram aberto. Não consegui copiar a mensagem automaticamente.",
        copiou ? "info" : "erro"
    );

    return janela;

}


async function copiarProposta(){

    const mensagem = document.getElementById("mensagemProposta").value.trim();

    if(!mensagem) return notificar("Gere a proposta primeiro.", "erro");

    await copiarParaAreaDeTransferencia(mensagem);

    notificar("Proposta copiada!", "sucesso");

}


function enviarPropostaWhatsApp(){

    if(!clientePropostaAtual) return;

    const mensagem = document.getElementById("mensagemProposta").value.trim();

    if(!mensagem) return notificar("Gere a proposta primeiro.", "erro");

    abrirWhatsappComTexto(clientePropostaAtual.telefone, mensagem);

}


function enviarPropostaTelegram(){

    if(!clientePropostaAtual) return;

    const mensagem = document.getElementById("mensagemProposta").value.trim();

    if(!mensagem) return notificar("Gere a proposta primeiro.", "erro");

    abrirTelegramComTexto(clientePropostaAtual.telefone, mensagem);

}

// ===============================
// IDENTIFICAÇÃO DO OPERADOR
// ===============================

const rotuloUsuario = document.getElementById("usuarioLogado");

if(rotuloUsuario && typeof obterUsuario === "function"){

    // textContent: o nome vem da API e não pode virar marcação.
    rotuloUsuario.textContent = obterUsuario();

}


// ===============================
// GARANTE ATUALIZAÇÃO DO DASHBOARD
// ===============================

atualizarDashboard();



// ===============================
// GARANTE RENDERIZAÇÃO
// ===============================

renderizarCards();
