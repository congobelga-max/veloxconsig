<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Velox Consig">
<meta name="theme-color" content="#000000">

<title>Entrar | VeloxConsig CRM</title>

<link rel="icon" type="image/jpeg" href="https://i.ibb.co/bM4HXvHD/Logo-VC.jpg">
<link rel="apple-touch-icon" href="https://i.ibb.co/bM4HXvHD/Logo-VC.jpg">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

<link rel="stylesheet" href="assets/css/login.css?v=20260814h">

<script src="assets/js/auth.js?v=20260814h"></script>
<script>
    // Quem já tem sessão ativa não precisa ver o formulário.
    if(sessaoValida()) window.location.replace(AUTH_CONFIG.PAGINA_APP);
</script>
</head>

<body class="telaLogin">

<main class="cartaoLogin">

    <div class="logoLogin">
        <img
            src="https://i.ibb.co/bM4HXvHD/Logo-VC.jpg"
            alt="VeloxConsig"
            loading="eager">
    </div>

    <h1 class="tituloLogin">Acesso ao CRM</h1>
    <p class="subtituloLogin">Entre com suas credenciais para continuar</p>

    <form id="formLogin" novalidate>

        <label class="rotuloCampo" for="email">E-mail</label>

        <div class="campoLogin">
            <i class="bi bi-envelope"></i>
            <input
                type="email"
                id="email"
                name="email"
                inputmode="email"
                autocomplete="username"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                placeholder="seu@email.com.br"
                required>
        </div>

        <label class="rotuloCampo" for="senha">Senha</label>

        <div class="campoLogin">
            <i class="bi bi-lock"></i>
            <input
                type="password"
                id="senha"
                name="senha"
                autocomplete="current-password"
                placeholder="Sua senha"
                required>
            <button
                type="button"
                id="alternarSenha"
                class="btnOlho"
                aria-label="Mostrar senha">
                <i class="bi bi-eye"></i>
            </button>
        </div>

        <label class="lembrarEmail">
            <input type="checkbox" id="lembrarEmail">
            <span>Lembrar meu e-mail</span>
        </label>

        <div id="erroLogin" class="erroLogin" role="alert"></div>

        <button type="submit" id="btnEntrar" class="btnEntrar">
            <span class="textoBtnEntrar">Entrar</span>
            <span class="spinner-border spinner-border-sm carregandoBtn"></span>
        </button>

    </form>

</main>

<footer class="rodapeLogin">
    VeloxConsig CRM Mobile
</footer>

<script src="assets/js/login.js?v=20260814h"></script>

</body>
</html>
