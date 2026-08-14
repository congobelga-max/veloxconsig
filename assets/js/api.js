// ===============================
// TRANSPORTE HTTP + CRUD DE CLIENTES
// Carregado antes do app.js.
// ===============================


// Erro com o status HTTP preservado, para a UI decidir a mensagem.
// status 0 = falha de rede / CORS (a requisição não chegou a ser respondida).
function ErroApi(mensagem, status, corpo){

    const erro = new Error(mensagem);

    erro.nome = "ErroApi";
    erro.status = status || 0;
    erro.corpo = corpo || null;

    return erro;

}


function cabecalhosApi(){

    const cabecalhos = {
        "Accept":"application/json",
        "x-api-key": AUTH_CONFIG.API_KEY
    };

    const token = obterToken();

    if(token){
        cabecalhos["Authorization"] = "Bearer " + token;
    }

    return cabecalhos;

}


// Mensagem de erro da API, nos formatos mais comuns.
function mensagemDaApi(corpo){

    if(!corpo || typeof corpo !== "object") return "";

    if(typeof corpo.message === "string") return corpo.message;
    if(typeof corpo.mensagem === "string") return corpo.mensagem;
    if(typeof corpo.error === "string") return corpo.error;
    if(typeof corpo.erro === "string") return corpo.erro;

    const erros = corpo.errors || corpo.erros;

    if(erros && typeof erros === "object"){

        const primeira = Object.values(erros)[0];

        if(Array.isArray(primeira) && primeira.length) return String(primeira[0]);
        if(typeof primeira === "string") return primeira;

    }

    return "";

}


async function requisitarApi(url, opcoes){

    opcoes = opcoes || {};

    const cabecalhos = cabecalhosApi();

    let corpoEnvio;

    if(opcoes.formulario !== undefined){

        // multipart/form-data: o Content-Type NÃO pode ser definido aqui.
        // Só o navegador conhece o boundary que separa as partes; informar
        // o header à mão gera um corpo sem boundary e o servidor rejeita.
        corpoEnvio = opcoes.formulario;

    }else if(opcoes.corpo !== undefined){

        cabecalhos["Content-Type"] = "application/json";
        corpoEnvio = JSON.stringify(opcoes.corpo);

    }

    let resposta;

    try{

        resposta = await fetch(url,{
            method: opcoes.metodo || "GET",
            headers: cabecalhos,
            body: corpoEnvio
        });

    }catch(erro){

        // Lembrete: x-api-key é header customizado, então há preflight OPTIONS.
        // Sem CORS liberado na API, cai sempre aqui.
        throw ErroApi(
            "Não foi possível falar com o servidor. Verifique a conexão — " +
            "se persistir, pode ser bloqueio de CORS na API.",
            0
        );

    }

    // 204 e afins não têm corpo.
    let corpo = null;

    if(resposta.status !== 204){

        try{
            corpo = await resposta.json();
        }catch(erro){
            // Resposta sem JSON válido.
        }

    }

    if(resposta.status === 401){

        // Sessão caiu ou token expirou no servidor: volta para o login.
        limparSessao();
        window.location.replace(AUTH_CONFIG.PAGINA_LOGIN);

        throw ErroApi("Sessão expirada.", 401, corpo);

    }

    if(!resposta.ok){

        throw ErroApi(
            mensagemDaApi(corpo) || ("Erro " + resposta.status + " na requisição."),
            resposta.status,
            corpo
        );

    }

    return corpo;

}


// A lista pode vir crua ([...]) ou embrulhada ({data:[...]}, {clientes:[...]}).
function extrairLista(corpo){

    if(Array.isArray(corpo)) return corpo;

    if(!corpo || typeof corpo !== "object") return [];

    const candidatos = [
        corpo.data,
        corpo.dados,
        corpo.clientes,
        corpo.items,
        corpo.results
    ];

    for(const c of candidatos){

        if(Array.isArray(c)) return c;

        // Paginação aninhada: {data:{data:[...]}}
        if(c && typeof c === "object" && Array.isArray(c.data)) return c.data;

    }

    return [];

}


// Um registro pode vir cru ou dentro de {data:{...}}.
function extrairRegistro(corpo){

    if(!corpo || typeof corpo !== "object") return null;

    const interno = corpo.data || corpo.dados || corpo.cliente;

    if(interno && typeof interno === "object" && !Array.isArray(interno)){
        return interno;
    }

    return corpo;

}


// ===============================
// CRUD
// ===============================

// `parametros` é um objeto de query ({cpf:"..."}). Se a API ignorar o filtro,
// quem chamou ainda peneira o resultado — o parâmetro é otimização, não
// garantia, porque este contrato nunca foi confirmado.
async function apiListarClientes(parametros){

    let url = AUTH_CONFIG.API_CLIENTES;

    const query = Object.keys(parametros || {})
        .filter(chave => parametros[chave] !== "" && parametros[chave] != null)
        .map(chave => encodeURIComponent(chave) + "=" + encodeURIComponent(parametros[chave]))
        .join("&");

    if(query) url += (url.indexOf("?") >= 0 ? "&" : "?") + query;

    const corpo = await requisitarApi(url);

    return extrairLista(corpo);

}


async function apiCriarCliente(dados){

    const corpo = await requisitarApi(AUTH_CONFIG.API_CLIENTES,{
        metodo:"POST",
        corpo: dados
    });

    return extrairRegistro(corpo);

}


async function apiAtualizarCliente(idApi, dados){

    const corpo = await requisitarApi(
        AUTH_CONFIG.API_CLIENTES + "/" + encodeURIComponent(idApi),
        {
            metodo:"PUT",
            corpo: dados
        }
    );

    return extrairRegistro(corpo);

}


// Atualiza só o status de contato do cliente (contatoStatus 1 -> 2).
//
// PATCH é o verbo do envio parcial: se esta rota substituir o recurso inteiro,
// um PUT levando apenas este campo apagaria nome, celular e e-mail do cadastro.
// Só quando a API responde que não conhece PATCH (404/405/501) o envio é
// refeito como PUT — e aí devolvendo o registro completo que ela mesma mandou,
// nunca um corpo pela metade.
async function apiAtualizarContatoStatus(idApi, status, registroBruto){

    const url = AUTH_CONFIG.API_CLIENTES + "/" + encodeURIComponent(idApi);

    try{

        return await requisitarApi(url,{
            metodo:"PATCH",
            corpo:{contatoStatus: status}
        });

    }catch(erro){

        const semPatch = erro.status === 404 ||
            erro.status === 405 ||
            erro.status === 501;

        // Sem o registro cru não há o que devolver: melhor propagar o erro do
        // que arriscar um PUT incompleto.
        if(!semPatch || !registroBruto) throw erro;

        return await requisitarApi(url,{
            metodo:"PUT",
            corpo: Object.assign({}, registroBruto, {contatoStatus: status})
        });

    }

}


async function apiExcluirCliente(idApi){

    await requisitarApi(
        AUTH_CONFIG.API_CLIENTES + "/" + encodeURIComponent(idApi),
        {
            metodo:"DELETE"
        }
    );

    return true;

}


// ===============================
// IMPORTAÇÕES DE CLIENTES
// ===============================

async function apiListarImportacoes(){

    const corpo = await requisitarApi(AUTH_CONFIG.API_IMPORTACOES);

    return extrairLista(corpo);

}


// O campo do arquivo se chama "arquivo", conforme o contrato da rota.
async function apiEnviarImportacao(arquivo){

    const formulario = new FormData();

    formulario.append("arquivo", arquivo, arquivo.name);

    const corpo = await requisitarApi(AUTH_CONFIG.API_IMPORTACOES,{
        metodo:"POST",
        formulario: formulario
    });

    return extrairRegistro(corpo);

}


async function apiExcluirImportacao(idApi){

    await requisitarApi(
        AUTH_CONFIG.API_IMPORTACOES + "/" + encodeURIComponent(idApi),
        {
            metodo:"DELETE"
        }
    );

    return true;

}
