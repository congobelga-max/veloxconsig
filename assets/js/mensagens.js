// ===============================
// MENSAGENS DE PRIMEIRO CONTATO
// Cinquenta redações para a mesma abordagem. O rodízio evita que a operação
// dispare o mesmo texto para leads seguidos — mensagens idênticas em massa
// são o que faz o WhatsApp marcar o número como spam.
//
// {nome} é trocado pelo primeiro nome do cliente.
//
// TOM: incisivo. As três partes são fixas e nenhuma redação pode perder uma
// delas — é isso que separa esta lista da versão anterior, que pedia licença
// ("posso te enviar?", "se tiver interesse") e morria sem resposta:
//   1. quem fala — Carol, da Velox Consig;
//   2. o motivo — o lead pediu uma simulação de consignado CLT e a margem
//      está liberada. O lead veio de um formulário de simulação, então a
//      retomada é um fato, não uma suposição;
//   3. o fechamento — assume a continuidade ("vamos dar continuidade?",
//      "confirma para eu seguir?"), nunca pergunta se pode começar.
// ===============================

const MENSAGENS_INICIAIS = [

    "Oi, {nome}!\n\nMe chamo Carol e trabalho na Velox Consig.\n\nVi que você solicitou uma simulação para empréstimo consignado CLT. Sua margem está liberada para contratação.\n\nVamos dar continuidade à solicitação?",

    "Olá, {nome}!\n\nAqui é a Carol, da Velox Consig.\n\nSua solicitação de simulação de consignado CLT chegou até mim e a margem já está liberada no seu CPF.\n\nPodemos seguir com a contratação?",

    "{nome}, tudo bem?\n\nCarol falando, da Velox Consig.\n\nRecebi seu pedido de simulação para crédito consignado CLT. A margem está aprovada e disponível para uso.\n\nVamos dar andamento?",

    "Oi, {nome}!\n\nSou a Carol, da Velox Consig.\n\nVocê pediu uma simulação de consignado CLT e ela já saiu: sua margem está liberada para contratação.\n\nMe confirma que eu sigo com o processo.",

    "Olá, {nome}!\n\nCarol aqui, da Velox Consig.\n\nSua simulação de empréstimo consignado CLT foi processada e a margem está livre para contratar.\n\nVamos concluir a sua solicitação?",

    "{nome}, oi!\n\nMe chamo Carol e sou consultora da Velox Consig.\n\nVi sua solicitação de simulação para consignado CLT. A margem está liberada e o valor pode ser contratado ainda hoje.\n\nSeguimos?",

    "Oi, {nome}!\n\nAqui é a Carol, da Velox Consig.\n\nSua consulta de margem para consignado CLT foi feita e o resultado é positivo: liberada para contratação.\n\nVamos dar continuidade agora?",

    "Olá, {nome}!\n\nCarol, da Velox Consig.\n\nEstou com a sua solicitação de simulação de consignado CLT em mãos. A margem está liberada.\n\nConfirma para eu já preparar a proposta?",

    "{nome}, tudo certo?\n\nMe chamo Carol e trabalho na Velox Consig.\n\nVocê solicitou uma simulação de empréstimo consignado CLT e sua margem está aprovada para contratação.\n\nVamos seguir com a solicitação?",

    "Oi, {nome}!\n\nSou a Carol, da Velox Consig.\n\nSeu pedido de simulação para consignado CLT foi analisado e a margem está liberada no seu nome.\n\nMe responde aqui que eu dou continuidade.",

    "Olá, {nome}!\n\nAqui quem fala é a Carol, da Velox Consig.\n\nA simulação que você solicitou para consignado CLT está pronta e a margem está liberada para contratação.\n\nVamos fechar?",

    "{nome}, oi!\n\nCarol, da Velox Consig.\n\nRecebi sua solicitação de crédito consignado CLT. A margem já está disponível e o dinheiro pode cair na conta em pouco tempo.\n\nVamos dar continuidade?",

    "Oi, {nome}!\n\nMe chamo Carol e falo pela Velox Consig.\n\nVi que você pediu uma simulação de consignado CLT. Sua margem está liberada para contratação neste momento.\n\nPosso seguir com o seu processo?",

    "Olá, {nome}!\n\nCarol aqui, consultora da Velox Consig.\n\nSua solicitação de simulação de empréstimo consignado CLT foi aprovada em margem.\n\nVamos dar continuidade à contratação?",

    "{nome}, tudo bem?\n\nSou a Carol, da Velox Consig.\n\nVocê solicitou a simulação do consignado CLT e ela voltou liberada: margem disponível para contratar.\n\nMe confirma e eu sigo daqui.",

    "Oi, {nome}!\n\nAqui é a Carol, da Velox Consig.\n\nSua simulação de consignado CLT está concluída e a margem está liberada.\n\nVamos dar continuidade à solicitação hoje?",

    "Olá, {nome}!\n\nCarol falando, da Velox Consig.\n\nSeu pedido de simulação para empréstimo consignado CLT chegou e a margem está liberada para contratação.\n\nSeguimos com o processo?",

    "{nome}, oi!\n\nMe chamo Carol e trabalho na Velox Consig.\n\nA consulta que você solicitou saiu: margem liberada para consignado CLT.\n\nVamos concluir a contratação?",

    "Oi, {nome}!\n\nSou a Carol, da Velox Consig.\n\nVi sua solicitação de simulação para consignado CLT. Sua margem está livre e pronta para uso.\n\nMe responde para eu dar sequência.",

    "Olá, {nome}!\n\nCarol, da Velox Consig.\n\nSua solicitação de consignado CLT está com a margem liberada para contratação.\n\nVamos dar continuidade agora?",

    "{nome}, tudo certo?\n\nAqui é a Carol, da Velox Consig.\n\nRecebi seu pedido de simulação de empréstimo consignado CLT e a margem está aprovada.\n\nConfirma que eu sigo com a proposta?",

    "Oi, {nome}!\n\nMe chamo Carol e sou da Velox Consig.\n\nA simulação de consignado CLT que você solicitou está pronta, com margem liberada para contratação.\n\nVamos dar continuidade?",

    "Olá, {nome}!\n\nCarol aqui, da Velox Consig.\n\nVi que você pediu a simulação do consignado CLT. A margem está liberada e o valor já pode ser contratado.\n\nSeguimos com a sua solicitação?",

    "{nome}, oi!\n\nSou a Carol, da Velox Consig.\n\nSua solicitação de simulação para consignado CLT foi processada: margem liberada.\n\nMe confirma aqui que eu dou andamento.",

    "Oi, {nome}!\n\nAqui é a Carol, da Velox Consig.\n\nVocê solicitou uma simulação de crédito consignado CLT e a sua margem está liberada para contratação.\n\nVamos concluir?",

    "Olá, {nome}!\n\nCarol, consultora da Velox Consig.\n\nSeu pedido de simulação de consignado CLT foi analisado e sua margem está disponível.\n\nVamos dar continuidade à solicitação?",

    "{nome}, tudo bem?\n\nMe chamo Carol e trabalho na Velox Consig.\n\nSua simulação de empréstimo consignado CLT está pronta e a margem, liberada.\n\nPosso seguir com a contratação?",

    "Oi, {nome}!\n\nSou a Carol, da Velox Consig.\n\nRecebi sua solicitação de consignado CLT. A margem está liberada para contratação imediata.\n\nVamos dar continuidade?",

    "Olá, {nome}!\n\nCarol falando, da Velox Consig.\n\nA sua solicitação de simulação de consignado CLT voltou com margem liberada.\n\nMe responde para eu já montar a proposta.",

    "{nome}, oi!\n\nAqui é a Carol, da Velox Consig.\n\nVi seu pedido de simulação para empréstimo consignado CLT. Margem liberada para contratação.\n\nVamos seguir com o processo?",

    "Oi, {nome}!\n\nMe chamo Carol e falo pela Velox Consig.\n\nSua solicitação de consignado CLT está aprovada em margem e pronta para contratação.\n\nVamos dar continuidade hoje?",

    "Olá, {nome}!\n\nCarol aqui, da Velox Consig.\n\nVocê solicitou uma simulação de consignado CLT e o resultado já saiu: margem liberada.\n\nConfirma para eu seguir com a sua contratação?",

    "{nome}, tudo certo?\n\nSou a Carol, da Velox Consig.\n\nSua simulação de empréstimo consignado CLT foi concluída e a margem está disponível para uso.\n\nVamos dar continuidade à solicitação?",

    "Oi, {nome}!\n\nAqui é a Carol, da Velox Consig.\n\nSeu pedido de simulação para consignado CLT chegou até mim. A margem está liberada para contratação.\n\nSeguimos agora?",

    "Olá, {nome}!\n\nCarol, da Velox Consig.\n\nA consulta de margem que você solicitou para o consignado CLT está positiva e liberada.\n\nMe confirma que eu dou continuidade.",

    "{nome}, oi!\n\nMe chamo Carol e sou da Velox Consig.\n\nSua solicitação de simulação de consignado CLT está com a margem aprovada para contratação.\n\nVamos fechar o processo?",

    "Oi, {nome}!\n\nSou a Carol, da Velox Consig.\n\nVi que você solicitou a simulação do empréstimo consignado CLT. Margem liberada no seu CPF.\n\nVamos dar continuidade à solicitação?",

    "Olá, {nome}!\n\nCarol aqui, consultora da Velox Consig.\n\nSua simulação de consignado CLT foi processada e a margem está liberada.\n\nPosso seguir com a contratação?",

    "{nome}, tudo bem?\n\nAqui é a Carol, da Velox Consig.\n\nRecebi sua solicitação de simulação para consignado CLT e sua margem está livre para contratar.\n\nVamos dar andamento?",

    "Oi, {nome}!\n\nMe chamo Carol e trabalho na Velox Consig.\n\nSua solicitação de crédito consignado CLT está com margem liberada para contratação.\n\nMe responde aqui que eu sigo com a proposta.",

    "Olá, {nome}!\n\nCarol falando, da Velox Consig.\n\nVocê pediu uma simulação de consignado CLT e ela já está pronta: margem liberada.\n\nVamos dar continuidade?",

    "{nome}, oi!\n\nSou a Carol, da Velox Consig.\n\nSua solicitação de simulação para empréstimo consignado CLT foi aprovada em margem.\n\nSeguimos com a contratação?",

    "Oi, {nome}!\n\nAqui é a Carol, da Velox Consig.\n\nA simulação que você solicitou está concluída e a sua margem de consignado CLT está liberada.\n\nVamos concluir a solicitação?",

    "Olá, {nome}!\n\nCarol, da Velox Consig.\n\nSeu pedido de simulação de consignado CLT retornou com margem disponível para contratação.\n\nMe confirma e eu dou continuidade agora.",

    "{nome}, tudo certo?\n\nMe chamo Carol e falo pela Velox Consig.\n\nVi sua solicitação de consignado CLT. A margem está liberada e a contratação pode ser feita por aqui mesmo.\n\nVamos seguir?",

    "Oi, {nome}!\n\nSou a Carol, da Velox Consig.\n\nSua simulação de empréstimo consignado CLT foi finalizada com margem liberada.\n\nVamos dar continuidade à sua solicitação?",

    "Olá, {nome}!\n\nCarol aqui, da Velox Consig.\n\nRecebi seu pedido de simulação para consignado CLT e a margem está aprovada para contratação.\n\nConfirma para eu seguir?",

    "{nome}, oi!\n\nAqui é a Carol, da Velox Consig.\n\nVocê solicitou a simulação do consignado CLT e o retorno veio positivo: margem liberada.\n\nVamos dar continuidade ao processo?",

    "Oi, {nome}!\n\nMe chamo Carol e sou consultora da Velox Consig.\n\nSua solicitação de simulação de consignado CLT está com a margem liberada para contratação.\n\nSeguimos com a proposta?",

    "Olá, {nome}!\n\nCarol, da Velox Consig.\n\nSua simulação de empréstimo consignado CLT saiu e a margem está liberada no seu nome.\n\nVamos dar continuidade à solicitação?"

];


// Chave do rodízio: guarda a próxima posição da lista a ser usada.
const CHAVE_RODIZIO_MENSAGEM = "rodizio_mensagem_inicial";


// Cada cliente fica com a mensagem que já recebeu — reabrir a conversa não
// troca o texto. Um cliente novo pega a próxima da fila, então a lista inteira
// é percorrida antes de qualquer repetição.
function indiceMensagemInicial(id){

    const chaveCliente = "mensagem_inicial_" + id;

    const guardado = Number(localStorage.getItem(chaveCliente));

    if(
        localStorage.getItem(chaveCliente) !== null &&
        guardado >= 0 &&
        guardado < MENSAGENS_INICIAIS.length
    ){
        return guardado;
    }

    const atual = Number(localStorage.getItem(CHAVE_RODIZIO_MENSAGEM) || 0) %
        MENSAGENS_INICIAIS.length;

    localStorage.setItem(
        CHAVE_RODIZIO_MENSAGEM,
        String((atual + 1) % MENSAGENS_INICIAIS.length)
    );

    localStorage.setItem(chaveCliente, String(atual));

    return atual;

}


function mensagemInicial(primeiroNome, id){

    const modelo = MENSAGENS_INICIAIS[indiceMensagemInicial(id)];

    return modelo.replace(/\{nome\}/g, primeiroNome);

}
