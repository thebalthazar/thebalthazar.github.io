/* Gêmeos: buscador do caso e área do jogo */
(function () {
  "use strict";

  var G = window.GEMEOS;
  var API = ((window.GEMEOS_CONFIG && window.GEMEOS_CONFIG.api) || "").replace(/\/+$/, "");
  var MODO_TELAO = /(?:^|[?&])modo=telao(?:&|$)/.test(location.search);
  if (MODO_TELAO) document.documentElement.classList.add("modo-telao");

  var app = document.getElementById("app");
  var porId = {};
  G.capitulos.forEach(function (c) { porId[c.id] = c; });
  var ultimaBusca = "#/";
  var rotaAtual = "";
  var primeiraRota = true;

  var LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var PARADAS = ["que", "por", "para", "com", "dos", "das", "uma", "uns", "nos", "nas", "sao", "como", "qual", "quem",
    "onde", "ele", "ela", "isso", "esse", "essa", "mais", "sobre", "google", "vai", "the", "and", "tem", "ter", "foi", "seu", "sua"];

  /* ---------------- utilidades ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function normalizar(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function fmt(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function linkCap(id) { return "#/caso/" + id; }
  function el(sel) { return document.querySelector(sel); }
  function primeiroNome(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  function inicial(n) { return (String(n || "").trim().charAt(0) || "?").toUpperCase(); }
  function juntar(lista) {
    if (lista.length <= 1) return lista.join("");
    return lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1];
  }
  function reduzMovimento() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function dominio(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }
  function trilha(url) {
    try {
      var u = new URL(url);
      var partes = u.pathname.split("/").filter(Boolean).slice(0, 2).map(function (p) {
        try { p = decodeURIComponent(p); } catch (e) { /* mantém o trecho original */ }
        p = p.replace(/\.html?$/, "");
        return p.length > 26 ? p.slice(0, 25) + "…" : p;
      });
      return [u.hostname.replace(/^www\./, "")].concat(partes).join(" › ");
    } catch (e) {
      return url;
    }
  }

  /* Em que capítulos cada fonte é usada */
  var usoFonte = {};
  G.capitulos.forEach(function (c) {
    (c.fatos || []).forEach(function (f) {
      [f.fonte, f.fonteExtra].forEach(function (k) {
        if (!k) return;
        usoFonte[k] = usoFonte[k] || [];
        if (usoFonte[k].indexOf(c.id) < 0) usoFonte[k].push(c.id);
      });
    });
  });
  function fontesDoCapitulo(c) {
    var lista = [];
    (c.fatos || []).forEach(function (f) {
      [f.fonte, f.fonteExtra].forEach(function (k) { if (k && lista.indexOf(k) < 0) lista.push(k); });
    });
    return lista;
  }

  /* ---------------- busca ---------------- */
  function termosDe(q) {
    return normalizar(q).split(" ").filter(function (t) { return (t.length > 2 || /\d/.test(t)) && PARADAS.indexOf(t) < 0; });
  }

  function buscar(q) {
    var nq = normalizar(q);
    if (!nq) return [];
    var termos = termosDe(q);
    return G.capitulos.map(function (c) {
      var palavras = (c.palavras || []).map(normalizar);
      var corpo = normalizar([c.consulta, c.titulo, c.trecho, c.resposta || "",
        (c.fatos || []).map(function (f) { return f.titulo + " " + f.texto; }).join(" ")].join(" "));
      var pts = normalizar(c.consulta) === nq ? 100 : 0;
      termos.forEach(function (t) {
        if (palavras.some(function (p) { return p.indexOf(t) >= 0 || t.indexOf(p) >= 0; })) pts += 6;
        if (normalizar(c.titulo).indexOf(t) >= 0) pts += 4;
        if (corpo.indexOf(t) >= 0) pts += 1;
      });
      return { c: c, pts: pts };
    }).filter(function (x) { return x.pts > 0; })
      .sort(function (a, b) { return b.pts - a.pts; });
  }

  function buscarFatos(q) {
    var termos = termosDe(q);
    if (!termos.length) return [];
    var lista = [];
    G.capitulos.forEach(function (c) {
      (c.fatos || []).forEach(function (f) {
        var fonte = G.fontes[f.fonte];
        var titulo = normalizar(f.titulo);
        var texto = normalizar(f.titulo + " " + f.texto + " " + fonte.nome + " " + fonte.titulo);
        var pts = 0;
        termos.forEach(function (t) { if (texto.indexOf(t) >= 0) pts += titulo.indexOf(t) >= 0 ? 3 : 1; });
        if (pts) lista.push({ f: f, c: c, pts: pts });
      });
    });
    return lista.sort(function (a, b) { return b.pts - a.pts; });
  }

  /* Sugestões da caixa de pesquisa */
  function sugerir(valor) {
    var nv = normalizar(valor);
    if (!nv) return G.sugestoes.map(function (id) { return { id: id, texto: porId[id].consulta }; });
    var termos = nv.split(" ").filter(Boolean);
    var achados = [];
    G.sugestoes.concat(["recomendacao", "fontes"]).forEach(function (id) {
      var c = porId[id];
      var nc = normalizar(c.consulta);
      var pts = 0;
      if (nc.indexOf(nv) === 0) pts = 3;
      else if (nc.indexOf(nv) >= 0) pts = 2;
      else {
        var palavras = (c.palavras || []).map(normalizar).concat(nc.split(" "));
        var todos = termos.every(function (t, i) {
          return palavras.some(function (p) { return i === termos.length - 1 ? p.indexOf(t) === 0 : p === t || p.indexOf(t) === 0; });
        });
        if (todos) pts = 1;
      }
      if (pts) achados.push({ id: id, texto: c.consulta, pts: pts });
    });
    return achados.sort(function (a, b) { return b.pts - a.pts; }).slice(0, 6);
  }

  function destacar(texto, valor) {
    var v = String(valor || "");
    if (v && texto.toLowerCase().indexOf(v.toLowerCase()) === 0) {
      return esc(texto.slice(0, v.length)) + "<b>" + esc(texto.slice(v.length)) + "</b>";
    }
    return esc(texto);
  }

  /* ---------------- partes da página ---------------- */
  function caixaBusca(valor, id, variante) {
    return '<form class="busca busca-' + variante + '" id="' + id + '-form" role="search" data-busca>' +
      '<div class="busca-caixa">' +
      '<span class="busca-icone">' + LUPA + "</span>" +
      '<label class="oculto-leitor" for="' + id + '">Pesquisar no caso</label>' +
      '<input id="' + id + '" name="q" type="text" autocomplete="off" spellcheck="false" enterkeyhint="search" value="' + esc(valor || "") +
      '" placeholder="Pesquise o caso" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + id + '-lista">' +
      '<button class="busca-limpar" type="button" data-limpar aria-label="Limpar a pesquisa"' + (valor ? "" : " hidden") + ">×</button>" +
      (variante === "topo" ? '<button class="busca-enviar" type="submit" aria-label="Pesquisar">' + LUPA + "</button>" : "") +
      "</div>" +
      '<ul class="busca-lista" id="' + id + '-lista" role="listbox" aria-label="Sugestões de pesquisa" hidden></ul>' +
      "</form>";
  }

  function cabecalho(valor, aba) {
    var tudo = aba === "tudo" ? (location.hash || "#/") : ultimaBusca;
    function link(nome, href, chave, extra) {
      return '<a href="' + href + '"' + (aba === chave ? ' aria-current="page"' : "") + (extra || "") + ">" + nome + "</a>";
    }
    return '<header class="topo">' +
      '<a class="marca marca-topo" href="#/" aria-label="Gêmeos, página inicial">Gêmeos</a>' +
      caixaBusca(valor, "busca-topo", "topo") +
      '<div class="conta" data-conta></div></header>' +
      '<nav class="abas-busca" aria-label="Seções do buscador">' +
      link("Tudo", tudo, "tudo") + link("Fontes", "#/caso/fontes", "fontes") + link("Jogo", "#/jogo", "jogo", " data-so-jogo") +
      "</nav>";
  }

  function rodape() {
    return '<footer class="rodape"><p>Caso de ensino do Grupo 7, Gestão Estratégica de Pessoas, MBA Executivo Insper.</p>' +
      '<nav aria-label="Rodapé"><a href="#/sobre">Sobre o caso</a><a href="#/caso/fontes">Fontes</a>' +
      '<a href="telao.html">Área do apresentador</a></nav></footer>';
  }

  function siteHtml(fonte) {
    return '<div class="resultado-site"><span class="resultado-icone" aria-hidden="true">' + esc(inicial(fonte.nome)) + "</span>" +
      '<span class="resultado-origem"><span class="resultado-nome">' + esc(fonte.nome) + "</span>" +
      '<span class="resultado-url">' + esc(trilha(fonte.url)) + "</span></span></div>";
  }

  function resultadoFato(f) {
    var fonte = G.fontes[f.fonte];
    var extra = f.fonteExtra ? G.fontes[f.fonteExtra] : null;
    return '<li class="resultado">' + siteHtml(fonte) +
      '<h3><a href="' + esc(fonte.url) + '" target="_blank" rel="noopener" title="' + esc(fonte.titulo) + '">' + esc(f.titulo) + "</a></h3>" +
      '<p class="resultado-trecho"><span class="resultado-data">' + esc(fonte.data) + "</span>" + esc(f.texto) + "</p>" +
      (extra ? '<p class="resultado-extra">Veja também: <a href="' + esc(extra.url) + '" target="_blank" rel="noopener">' +
        esc(extra.nome) + ", " + esc(extra.data) + "</a></p>" : "") +
      "</li>";
  }

  function resultadoInterno(c) {
    return '<li class="resultado">' +
      '<div class="resultado-site"><span class="resultado-icone resultado-icone-casa" aria-hidden="true"><span class="marca-mini"></span></span>' +
      '<span class="resultado-origem"><span class="resultado-nome">Gêmeos</span><span class="resultado-url">gemeos › caso › ' + esc(c.id) + "</span></span></div>" +
      '<h3><a href="' + linkCap(c.id) + '">' + esc(c.titulo) + "</a></h3>" +
      '<p class="resultado-trecho">' + esc(c.trecho) + "</p></li>";
  }

  function resumoHtml(c, nivel, comLink) {
    var h = "h" + (nivel || 1);
    var fontes = fontesDoCapitulo(c);
    var linhaFontes = fontes.length ? '<p class="resumo-fontes">Com base em ' + fontes.length + (fontes.length === 1 ? " fonte: " : " fontes: ") +
      juntar(fontes.map(function (k) {
        var f = G.fontes[k];
        return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.nome) + "</a>";
      })) + ".</p>" : "";
    return '<section class="resumo">' +
      '<p class="resumo-rotulo"><span class="marca-mini" aria-hidden="true"></span>Resumo do caso</p>' +
      "<" + h + ' class="resumo-titulo">' + esc(c.titulo) + "</" + h + ">" +
      '<p class="resumo-texto">' + esc(c.resposta) + "</p>" + linhaFontes +
      (comLink ? '<p class="resumo-mais"><a href="' + linkCap(c.id) + '">Ver o tema completo</a></p>' : "") +
      "</section>";
  }

  function avisoJogo(texto) {
    if (MODO_TELAO || !API) return "";
    var resto = J.token ? " Ela aparece na sua tela quando o apresentador abrir." : ' <a href="#/entrar">Entre no jogo</a> para responder.';
    return '<p class="aviso-jogo">' + esc(texto) + resto + "</p>";
  }

  function relacionadasHtml(c) {
    var ids = (c.relacionadas || []).filter(function (id) { return porId[id] && id !== "fontes" && id !== c.id; });
    G.sugestoes.forEach(function (id) { if (ids.length < 4 && id !== c.id && ids.indexOf(id) < 0) ids.push(id); });
    return '<section class="relacionadas"><h2>Outras perguntas sobre o caso</h2>' + ids.slice(0, 4).map(function (id) {
      var r = porId[id];
      return "<details><summary>" + esc(r.consulta) + "</summary><p>" + esc(r.trecho) + '</p><a href="' + linkCap(id) + '">Ver os resultados</a></details>';
    }).join("") + "</section>";
  }

  /* ---------------- páginas ---------------- */
  function paginaInicio() {
    document.title = "Gêmeos: um caso sobre o Google e a corrida da IA";
    app.innerHTML = '<div class="inicio">' +
      '<header class="inicio-topo"><a class="link-topo" href="#/sobre">Sobre o caso</a><a class="link-topo" href="#/caso/fontes">Fontes</a>' +
      '<div class="conta" data-conta></div></header>' +
      '<main class="inicio-centro" id="conteudo">' +
      '<h1 class="marca marca-grande">Gêmeos</h1><div class="fio-duplo" aria-hidden="true"></div>' +
      caixaBusca("", "busca-inicio", "inicio") +
      '<div class="inicio-botoes"><button class="botao-busca" type="submit" form="busca-inicio-form">Pesquisar no caso</button>' +
      '<button class="botao-busca" type="button" data-surpresa>Me surpreenda</button></div>' +
      '<p class="inicio-sub">Gemini quer dizer gêmeos. Este é um caso sobre os dois Googles: o da busca e da publicidade, e o da inteligência artificial.</p>' +
      "</main>" + rodape() + "</div>";
    animarDica(el("#busca-inicio"));
  }

  function paginaResultados(q) {
    var caps = buscar(q);
    var fatos = buscarFatos(q).slice(0, 8);
    ultimaBusca = location.hash;
    document.title = q + ": Gêmeos";
    var html = cabecalho(q, "tudo") + '<main class="serp" id="conteudo"><h1 class="oculto-leitor">Resultados para ' + esc(q) + "</h1>";
    var total = Math.min(caps.length, 4) + fatos.length;
    if (!total) {
      html += '<div class="vazio"><p>Nenhum resultado para <b>' + esc(q) + "</b>.</p><p>Sugestões:</p><ul>" +
        "<li>Confira a ortografia.</li><li>Use outras palavras, como Gemini, DeepMind, TPU ou desligamento.</li>" +
        "<li>Ou comece por uma das perguntas do caso:</li></ul></div>" +
        '<ul class="lista-perguntas">' + G.sugestoes.map(function (id) {
          return '<li><a href="' + linkCap(id) + '">' + esc(porId[id].consulta) + "</a></li>";
        }).join("") + "</ul>";
    } else {
      html += '<p class="serp-contagem">' + (total === 1 ? "1 resultado" : total + " resultados") + "</p>";
      var topo = caps[0];
      if (topo && topo.pts >= 6 && topo.c.resposta) html += resumoHtml(topo.c, 2, true);
      html += '<ol class="resultados">' + caps.slice(0, 4).map(function (x) { return resultadoInterno(x.c); }).join("") +
        fatos.map(function (x) { return resultadoFato(x.f); }).join("") + "</ol>";
    }
    app.innerHTML = html + "</main>" + rodape();
  }

  function paginaCapitulo(id) {
    var c = porId[id];
    if (!c) { paginaInicio(); return; }
    if (id === "fontes") { paginaFontes(); return; }
    ultimaBusca = linkCap(id);
    document.title = c.consulta + ": Gêmeos";
    var html = cabecalho(c.consulta, "tudo") + '<main class="serp' + (id === "dilema" ? " serp-larga" : "") + '" id="conteudo">';
    if (c.bloqueado) {
      html += '<section class="resumo"><p class="resumo-rotulo"><span class="marca-mini" aria-hidden="true"></span>Resposta do Grupo 7</p>' +
        '<h1 class="resumo-titulo">' + esc(c.titulo) + "</h1>" +
        '<div class="recomendacao" data-recomendacao><p class="status-apoio">Carregando a recomendação…</p></div></section>';
    } else if (id === "dilema") {
      html += resumoHtml(c, 1, false) +
        '<p class="papel">' + esc(c.papel) + "</p>" +
        '<h2 class="serp-secao">As alternativas</h2><ol class="alternativas">' + c.alternativas.map(function (a) {
          return '<li class="alternativa"><h3><span class="alternativa-letra" aria-hidden="true">' + esc(a.letra) + "</span>" +
            '<span><span class="oculto-leitor">' + esc(a.letra) + ". </span>" + esc(a.nome) + "</span></h3>" +
            "<p>" + esc(a.texto) + "</p>" +
            '<dl class="troca"><div><dt>O que ganha</dt><dd>' + esc(a.ganha) + "</dd></div>" +
            "<div><dt>O que sacrifica</dt><dd>" + esc(a.sacrifica) + "</dd></div></dl></li>";
        }).join("") + "</ol>" +
        '<h2 class="serp-secao">Perguntas para a turma</h2><ol class="perguntas">' +
        c.perguntas.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>" +
        avisoJogo("A votação da decisão abre no fim da apresentação.");
    } else {
      html += '<p class="serp-contagem">' + c.fatos.length + " resultados de fontes públicas</p>" +
        resumoHtml(c, 1, false) +
        (c.quiz ? avisoJogo("Este tema tem pergunta-relâmpago no jogo.") : "") +
        '<h2 class="oculto-leitor">Resultados</h2><ol class="resultados">' + c.fatos.map(resultadoFato).join("") + "</ol>";
    }
    html += relacionadasHtml(c) + "</main>" + rodape();
    app.innerHTML = html;
    if (c.bloqueado) carregarRecomendacao();
    if (MODO_TELAO) digitarConsulta(c.consulta);
  }

  function paginaFontes() {
    ultimaBusca = ultimaBusca || "#/";
    document.title = "Fontes do caso: Gêmeos";
    var chaves = Object.keys(G.fontes);
    app.innerHTML = cabecalho("fontes do caso", "fontes") + '<main class="serp" id="conteudo"><h1 class="oculto-leitor">Fontes do caso</h1>' +
      '<p class="serp-contagem">' + chaves.length + " fontes públicas, com link para a origem de cada número</p>" +
      '<ol class="resultados">' + chaves.map(function (k) {
        var f = G.fontes[k];
        var usos = (usoFonte[k] || []).map(function (id) { return '<a href="' + linkCap(id) + '">' + esc(porId[id].titulo) + "</a>"; });
        return '<li class="resultado">' + siteHtml(f) +
          '<h3><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.titulo) + "</a></h3>" +
          '<p class="resultado-trecho"><span class="resultado-data">' + esc(f.data) + "</span>" +
          (usos.length ? "Usada em: " + juntar(usos) + "." : "") + "</p></li>";
      }).join("") + "</ol>" +
      '<div class="metodo"><p>' + esc(G.metodo) + "</p><p>" + esc(G.grupo) + ". " + esc(G.disciplina) + ".</p></div>" +
      "</main>" + rodape();
  }

  function paginaSobre() {
    document.title = "Sobre o caso: Gêmeos";
    app.innerHTML = cabecalho("", null) + '<main class="serp" id="conteudo"><article class="sobre">' +
      "<h1>Sobre o caso</h1>" +
      "<p>Gêmeos é um caso de ensino sobre o Google, a corrida da inteligência artificial e as pessoas que fazem a IA. Gemini quer dizer gêmeos, e o caso trata dos dois Googles: o da busca e da publicidade, e o da inteligência artificial.</p>" +
      "<p>" + esc(G.grupo) + ". " + esc(G.disciplina) + ".</p>" +
      "<h2>Como funciona</h2>" +
      "<p>Cada pesquisa abre um tema do caso, com um resumo e os resultados das fontes. Durante a apresentação, a turma participa pelo celular: um teste cego entre assistentes de IA, perguntas-relâmpago com placar e a votação da decisão final.</p>" +
      "<h2>Privacidade</h2>" +
      "<p>O jogo pede nome e e-mail do Insper só para montar o placar desta aula. O placar mostra o primeiro nome e a inicial do sobrenome. Neste aparelho, o site guarda apenas o seu nome e o código da sua sessão no jogo. Os dados da turma são apagados depois da apresentação.</p>" +
      "<h2>Método</h2><p>" + esc(G.metodo) + "</p>" +
      '<h2>Área do apresentador</h2><p>O telão e os controles da apresentação ficam na <a href="telao.html">área do apresentador</a>, que pede a chave do Grupo 7.</p>' +
      "</article></main>" + rodape();
  }

  /* ---------------- jogo: páginas ---------------- */
  function formEntrarHtml(sala) {
    return '<form id="form-entrar" class="conta-form" novalidate>' +
      '<label class="campo"><span>Nome e sobrenome</span><input name="nome" autocomplete="name" maxlength="60" required></label>' +
      '<label class="campo"><span>E-mail do Insper</span><input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="voce@al.insper.edu.br" required></label>' +
      '<label class="campo"><span>Código da sala</span><input name="sala" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" required value="' + esc(String(sala || "").toUpperCase()) + '">' +
      "<small>O código aparece no telão.</small></label>" +
      '<button class="botao botao-principal botao-largo" type="submit">Entrar no jogo</button>' +
      '<p class="mensagem mensagem-erro" role="alert" hidden></p></form>' +
      '<p class="consentimento">Usamos seu nome e e-mail só para o placar desta aula. O placar mostra o primeiro nome e a inicial do sobrenome, e os dados são apagados depois da apresentação.</p>';
  }

  function paginaEntrar(sala) {
    document.title = "Entrar no jogo: Gêmeos";
    app.innerHTML = cabecalho("", "jogo") + '<main class="conta-pagina" id="conteudo">' +
      "<h1>Entrar no jogo</h1>" +
      '<p class="conta-intro">Durante a apresentação, as perguntas aparecem aqui na sua tela. Nas perguntas-relâmpago, quem acerta mais rápido ganha mais pontos.</p>' +
      (API ? formEntrarHtml(sala) : '<p class="status-apoio">O jogo não está disponível neste endereço.</p>') +
      "</main>" + rodape();
    var f = el("#form-entrar");
    if (f) {
      f.addEventListener("submit", enviarEntrada);
      if (sala) setTimeout(function () { if (f.nome && document.body.contains(f)) f.nome.focus({ preventScroll: true }); }, 60);
    }
  }

  function numerosHtml() {
    var e = J.estado;
    var eu = e && e.eu;
    return "<div><dt>Pontos</dt><dd>" + (eu ? fmt(eu.pontos) : "0") + "</dd></div>" +
      "<div><dt>Posição</dt><dd>" + (eu ? eu.posicao + "º <small>de " + fmt(eu.de) + "</small>" : "…") + "</dd></div>" +
      "<div><dt>Participantes</dt><dd>" + (e ? fmt(e.jogadores) : "…") + "</dd></div>";
  }

  function agoraHtml() {
    var e = J.estado;
    if (!J.conectado) return '<p class="agora-texto">Sem conexão com o jogo. Tentando de novo.</p>';
    if (!e) return '<p class="agora-texto">Conectando ao jogo…</p>';
    var p = e.pergunta;
    if (e.tela === "aberta" && p) {
      if (e.minha) {
        return '<p class="agora-texto">Resposta enviada: ' + esc(p.titulo) + '.</p><p class="status-apoio">O resultado aparece quando o apresentador encerrar a pergunta.</p>';
      }
      return '<p class="agora-texto"><b>Pergunta aberta: ' + esc(p.titulo) + '.</b></p><button class="botao botao-principal" type="button" data-voltar-pergunta>Responder agora</button>';
    }
    if (e.tela === "resultado" && p) {
      return '<p class="agora-texto">Saiu o resultado: ' + esc(p.titulo) + '.</p><button class="botao" type="button" data-voltar-pergunta>Ver o resultado</button>';
    }
    if (e.tela === "placar" || e.tela === "podio") {
      return '<p class="agora-texto">' + (e.tela === "podio" ? "O pódio" : "O placar") + ' está no telão.</p><button class="botao" type="button" data-voltar-pergunta>Ver aqui</button>';
    }
    if (e.tela === "caso" && e.capitulo && porId[e.capitulo]) {
      return '<p class="agora-texto">No telão: ' + esc(porId[e.capitulo].consulta) + '</p><a class="botao" href="' + linkCap(e.capitulo) + '">Acompanhar no celular</a>';
    }
    if (e.tela === "espera") {
      return '<p class="agora-texto">Aguardando o início.</p><p class="status-apoio">Os nomes de quem entra aparecem no telão. Deixe esta página aberta: a primeira pergunta aparece sozinha.</p>';
    }
    return '<p class="agora-texto">Aguardando a próxima pergunta.</p>';
  }

  function paginaJogo() {
    if (!J.token) { paginaEntrar(""); return; }
    document.title = "Sua área no jogo: Gêmeos";
    app.innerHTML = cabecalho("", "jogo") + '<main class="conta-pagina" id="conteudo">' +
      (J.recemEntrou ? '<p class="conta-confirmacao" role="status">Pronto. Você está no jogo.</p>' : "") +
      "<h1>Olá, " + esc(primeiroNome(J.nome)) + ".</h1>" +
      '<dl class="conta-numeros" data-numeros>' + numerosHtml() + "</dl>" +
      '<section class="conta-agora" aria-live="polite"><h2>Agora</h2><div data-agora>' + agoraHtml() + "</div></section>" +
      '<section class="conta-como"><h2>Como funciona</h2><ol>' +
      "<li>Deixe esta página aberta. Quando o apresentador abre uma pergunta, ela aparece sozinha na sua tela.</li>" +
      "<li>Nas perguntas-relâmpago, quem acerta mais rápido ganha mais pontos. O voto de aquecimento e o teste cego também pontuam.</li>" +
      "<li>Na decisão final, escolha uma alternativa e justifique em uma linha. Com justificativa, a decisão vale o dobro.</li>" +
      "</ol></section>" +
      '<p class="conta-sair"><button class="botao-texto" type="button" data-sair>Sair do jogo neste aparelho</button></p>' +
      "</main>" + rodape();
    J.recemEntrou = false;
    ultimoAgora = "";
  }

  var ultimoAgora = "";
  function atualizarAreaJogo() {
    if (rotaAtual !== "/jogo" || !J.token) return;
    var n = el("[data-numeros]");
    if (n) n.innerHTML = numerosHtml();
    var a = el("[data-agora]");
    if (a) {
      var h = agoraHtml();
      if (h !== ultimoAgora) { a.innerHTML = h; ultimoAgora = h; }
    }
  }

  function carregarRecomendacao() {
    var alvo = el("[data-recomendacao]");
    if (!alvo) return;
    if (!API) { alvo.innerHTML = '<div class="bloqueado"><p>A recomendação do Grupo 7 será liberada no fim da discussão.</p></div>'; return; }
    fetch(API + "/api/recomendacao", { cache: "no-store" }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (x) {
      var alvoAtual = el("[data-recomendacao]");
      if (!alvoAtual) return;
      if (x.ok && x.d.html) {
        alvoAtual.innerHTML = x.d.html;
      } else {
        alvoAtual.innerHTML = '<div class="bloqueado"><p>' + esc(x.d.erro || "A recomendação do Grupo 7 será liberada no fim da discussão.") +
          "</p><p>Enquanto isso, discuta o dilema com a turma.</p></div>";
      }
    }).catch(function () {
      var alvoAtual = el("[data-recomendacao]");
      if (alvoAtual) alvoAtual.innerHTML = '<div class="bloqueado"><p>Não foi possível carregar a recomendação agora. Tente de novo em instantes.</p></div>';
    });
  }

  /* ---------------- movimento ---------------- */
  /* Dica animada na caixa de pesquisa da página inicial */
  var dicaTimer = null;
  function animarDica(input) {
    clearTimeout(dicaTimer);
    if (!input || reduzMovimento()) return;
    var frases = G.sugestoes.map(function (id) { return porId[id].consulta; });
    var i = 0, pos = 0, apagando = false, parado = false;
    function passo() {
      if (parado || !document.body.contains(input)) return;
      var frase = frases[i % frases.length];
      if (!apagando) {
        pos++;
        input.placeholder = frase.slice(0, pos);
        if (pos >= frase.length) { apagando = true; dicaTimer = setTimeout(passo, 1800); return; }
        dicaTimer = setTimeout(passo, 55);
      } else {
        pos--;
        input.placeholder = frase.slice(0, pos) || "Pesquise o caso";
        if (pos <= 0) { apagando = false; i++; dicaTimer = setTimeout(passo, 500); return; }
        dicaTimer = setTimeout(passo, 25);
      }
    }
    input.addEventListener("focus", function () { parado = true; clearTimeout(dicaTimer); input.placeholder = "Pesquise o caso"; });
    dicaTimer = setTimeout(passo, 900);
  }

  /* No telão: a pesquisa é digitada na caixa e os resultados aparecem em seguida */
  var digitarTimer = null;
  function digitarConsulta(texto) {
    var input = el("#busca-topo");
    var main = el("#conteudo");
    clearTimeout(digitarTimer);
    if (!input || !main || reduzMovimento()) return;
    main.classList.add("revelando");
    input.value = "";
    var i = 0;
    (function passo() {
      if (!document.body.contains(input)) return;
      i++;
      input.value = texto.slice(0, i);
      if (i < texto.length) digitarTimer = setTimeout(passo, 38);
      else digitarTimer = setTimeout(function () { main.classList.remove("revelando"); }, 320);
    })();
  }

  /* ---------------- sugestões da caixa de pesquisa ---------------- */
  var sug = { input: null, lista: null, itens: [], ativo: -1 };

  function abrirSugestoes(input) {
    var form = input.closest("form");
    var lista = form && form.querySelector(".busca-lista");
    if (!lista) return;
    if (sug.lista && sug.lista !== lista) fecharSugestoes();
    var itens = sugerir(input.value);
    sug.input = input; sug.lista = lista; sug.itens = itens; sug.ativo = -1;
    if (!itens.length) { fecharSugestoes(); return; }
    var vazio = !input.value.trim();
    lista.innerHTML = (vazio ? '<li class="lista-rotulo" role="presentation">Perguntas do caso</li>' : "") + itens.map(function (it, i) {
      return '<li role="option" id="' + lista.id + "-" + i + '" data-i="' + i + '" aria-selected="false">' +
        '<span class="lista-icone">' + LUPA + "</span><span>" + destacar(it.texto, input.value) + "</span></li>";
    }).join("");
    lista.hidden = false;
    form.classList.add("aberta");
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  }

  function fecharSugestoes() {
    if (sug.lista) {
      sug.lista.hidden = true;
      sug.lista.innerHTML = "";
      var form = sug.lista.closest("form");
      if (form) form.classList.remove("aberta");
    }
    if (sug.input) {
      sug.input.setAttribute("aria-expanded", "false");
      sug.input.removeAttribute("aria-activedescendant");
    }
    sug.input = null; sug.lista = null; sug.itens = []; sug.ativo = -1;
  }

  function marcarAtivo(i) {
    var opcoes = sug.lista.querySelectorAll('[role="option"]');
    sug.ativo = i;
    Array.prototype.forEach.call(opcoes, function (o, k) {
      o.classList.toggle("ativo", k === i);
      o.setAttribute("aria-selected", k === i ? "true" : "false");
    });
    if (i >= 0 && opcoes[i]) sug.input.setAttribute("aria-activedescendant", opcoes[i].id);
  }

  function escolherSugestao(i) {
    var it = sug.itens[i];
    if (!it) return;
    if (sug.input) sug.input.value = it.texto;
    fecharSugestoes();
    location.hash = linkCap(it.id);
  }

  function ehCaixa(alvo) { return alvo && alvo.matches && alvo.matches('[role="combobox"]'); }

  document.addEventListener("focusin", function (ev) { if (ehCaixa(ev.target)) abrirSugestoes(ev.target); });
  document.addEventListener("input", function (ev) {
    if (!ehCaixa(ev.target)) return;
    var limpar = ev.target.closest("form").querySelector("[data-limpar]");
    if (limpar) limpar.hidden = !ev.target.value;
    abrirSugestoes(ev.target);
  });
  document.addEventListener("focusout", function (ev) {
    if (!ehCaixa(ev.target)) return;
    setTimeout(function () {
      if (sug.input && document.activeElement !== sug.input) fecharSugestoes();
    }, 150);
  });
  document.addEventListener("keydown", function (ev) {
    if (!sug.input || ev.target !== sug.input) return;
    var n = sug.itens.length;
    if (ev.key === "ArrowDown" && n) { ev.preventDefault(); marcarAtivo((sug.ativo + 1) % n); }
    else if (ev.key === "ArrowUp" && n) { ev.preventDefault(); marcarAtivo(sug.ativo <= 0 ? n - 1 : sug.ativo - 1); }
    else if (ev.key === "Escape") { fecharSugestoes(); }
    else if (ev.key === "Enter" && sug.ativo >= 0) { ev.preventDefault(); escolherSugestao(sug.ativo); }
  });
  document.addEventListener("mousedown", function (ev) {
    var op = ev.target.closest && ev.target.closest('.busca-lista [role="option"]');
    if (op) { ev.preventDefault(); escolherSugestao(Number(op.getAttribute("data-i"))); return; }
    if (sug.lista && !(ev.target.closest && ev.target.closest(".busca"))) fecharSugestoes();
  });

  /* Teclas no telão: o apresentador avança e volta mesmo com o caso em foco */
  if (MODO_TELAO) {
    document.addEventListener("keydown", function (ev) {
      if (ev.target.matches && ev.target.matches("input, textarea, select")) return;
      var msg = null;
      if (ev.key === "c" || ev.key === "C") msg = "alternar-controles";
      else if (ev.key === "ArrowRight" || ev.key === "PageDown") msg = "avancar";
      else if (ev.key === "ArrowLeft" || ev.key === "PageUp") msg = "voltar";
      if (!msg) return;
      ev.preventDefault();
      try { window.parent.postMessage({ gemeos: msg }, location.origin); } catch (e) { /* fora do telão */ }
    });
  }

  /* ---------------- roteamento ---------------- */
  function rota() {
    var h = location.hash.replace(/^#/, "") || "/";
    var partes = h.split("?");
    var caminho = partes[0];
    var params = new URLSearchParams(partes[1] || "");
    fecharSugestoes();
    if (caminho === "/entrar" && J.token) { location.replace("#/jogo"); return; }
    rotaAtual = caminho;
    if (caminho.indexOf("/caso/") === 0) paginaCapitulo(decodeURIComponent(caminho.slice(6)));
    else if (caminho === "/busca") paginaResultados(params.get("q") || "");
    else if (caminho === "/entrar") paginaEntrar(params.get("sala") || "");
    else if (caminho === "/jogo") paginaJogo();
    else if (caminho === "/sobre") paginaSobre();
    else { rotaAtual = "/"; paginaInicio(); }
    renderConta();
    renderBarra();
    window.scrollTo(0, 0);
    if (!primeiraRota && rotaAtual !== "/") {
      var titulo = el("#conteudo h1");
      if (titulo) { titulo.setAttribute("tabindex", "-1"); titulo.focus({ preventScroll: true }); }
    }
    primeiraRota = false;
  }

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form.hasAttribute("data-busca")) return;
    ev.preventDefault();
    var q = form.q.value.trim();
    fecharSugestoes();
    if (!q) return;
    var exato = G.capitulos.filter(function (c) { return normalizar(c.consulta) === normalizar(q); })[0];
    location.hash = exato ? linkCap(exato.id) : "#/busca?q=" + encodeURIComponent(q);
  });

  window.addEventListener("hashchange", rota);

  /* ================================================================ */
  /* Jogo                                                               */
  /* ================================================================ */
  var J = {
    token: lerLocal("gemeos.token"),
    nome: lerLocal("gemeos.nome"),
    estado: null,
    assinatura: "",
    dispensada: "",
    prazo: 0,
    selecao: null,
    erro: "",
    conectado: true,
    recemEntrou: false,
  };

  function lerLocal(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function gravarLocal(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* armazenamento indisponível */ } }

  var painel = el("#painel");
  var painelCorpo = el("#painel-corpo");
  var barra = el("#jogo-barra");
  var barraTexto = el("#jogo-barra-texto");
  var barraAcao = el("#jogo-barra-acao");

  function sairDoJogo() {
    J.token = ""; J.nome = ""; J.estado = J.estado ? Object.assign({}, J.estado, { eu: null, minha: null }) : null;
    gravarLocal("gemeos.token", ""); gravarLocal("gemeos.nome", "");
    fecharPainel();
  }

  function renderConta() {
    var slots = document.querySelectorAll("[data-conta]");
    var html = "";
    if (API && !MODO_TELAO) {
      if (!J.token) {
        html = '<a class="botao-entrar" href="#/entrar">Entrar no jogo</a>';
      } else {
        var eu = J.estado && J.estado.eu;
        var nome = (eu && eu.nome) || J.nome;
        html = '<a class="conta-link" href="#/jogo" aria-label="Sua área no jogo: ' + esc(nome) + (eu ? ", " + fmt(eu.pontos) + " pontos" : "") + '">' +
          (eu ? '<span class="conta-pontos">' + fmt(eu.pontos) + " pts</span>" : "") +
          '<span class="avatar" aria-hidden="true">' + esc(inicial(nome)) + "</span></a>";
      }
    }
    Array.prototype.forEach.call(slots, function (s) {
      if (s.__html !== html) { s.innerHTML = html; s.__html = html; }
    });
  }

  document.addEventListener("click", function (ev) {
    var alvo = ev.target;
    if (alvo.closest("[data-limpar]")) {
      var form = alvo.closest("form");
      var input = form.querySelector('[role="combobox"]');
      input.value = "";
      alvo.closest("[data-limpar]").hidden = true;
      input.focus();
      abrirSugestoes(input);
      return;
    }
    if (alvo.closest("[data-surpresa]")) {
      var ids = G.sugestoes;
      location.hash = linkCap(ids[Math.floor(Math.random() * ids.length)]);
      return;
    }
    if (alvo.closest("[data-ir-entrar]")) { J.dispensada = chaveTela(); fecharPainel(); return; }
    if (alvo.closest("[data-sair]")) { sairDoJogo(); location.hash = "#/entrar"; return; }
    if (alvo.closest("[data-dispensar]")) { J.dispensada = chaveTela(); fecharPainel(); renderBarra(); return; }
    if (alvo.closest("[data-voltar-pergunta]")) { J.dispensada = ""; J.assinatura = ""; renderJogo(); return; }
    var opcao = alvo.closest("[data-opcao]");
    if (opcao) { escolher(Number(opcao.getAttribute("data-opcao"))); return; }
    if (alvo.closest("[data-enviar-decisao]")) { enviarDecisao(); return; }
  });

  function enviarEntrada(ev) {
    ev.preventDefault();
    var f = ev.target;
    var botao = f.querySelector("[type=submit]");
    var msg = f.querySelector(".mensagem-erro");
    function avisar(t) { msg.textContent = t; msg.hidden = !t; }
    avisar("");
    botao.disabled = true;
    botao.textContent = "Entrando…";
    fetch(API + "/api/entrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: f.nome.value, email: f.email.value, sala: f.sala.value }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        botao.disabled = false;
        botao.textContent = "Entrar no jogo";
        if (!x.ok) { avisar(x.d.erro || "Não foi possível entrar. Tente de novo."); return; }
        J.token = x.d.token; J.nome = x.d.nome;
        gravarLocal("gemeos.token", J.token); gravarLocal("gemeos.nome", J.nome);
        J.recemEntrou = true; J.assinatura = ""; J.dispensada = "";
        location.hash = "#/jogo";
        atualizar(true);
      })
      .catch(function () {
        botao.disabled = false;
        botao.textContent = "Entrar no jogo";
        avisar("Sem conexão com o jogo. Confira a internet e tente de novo.");
      });
  }

  /* ---------- sincronização ---------- */
  var proxima = null;
  function atualizar() {
    clearTimeout(proxima);
    if (!API || MODO_TELAO) return;
    var url = API + "/api/estado" + (J.token ? "?token=" + encodeURIComponent(J.token) : "");
    fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      J.conectado = true;
      if (d.sessao === "invalida") {
        sairDoJogo();
        if (rotaAtual === "/jogo") rota();
      }
      var recAntes = J.estado ? J.estado.recomendacao : null;
      J.estado = d;
      if (d.tela === "aberta" && typeof d.restante === "number") {
        var novoPrazo = Date.now() + d.restante * 1000;
        if (!J.prazo || Math.abs(novoPrazo - J.prazo) > 1500) J.prazo = novoPrazo;
      } else {
        J.prazo = 0;
      }
      if (recAntes !== null && recAntes !== d.recomendacao && el("[data-recomendacao]")) carregarRecomendacao();
      renderConta();
      renderJogo();
      atualizarAreaJogo();
    }).catch(function () {
      J.conectado = false;
      renderBarra();
      atualizarAreaJogo();
    }).then(function () {
      proxima = setTimeout(atualizar, document.hidden ? 8000 : (J.conectado ? 2000 : 4000));
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) atualizar(); });

  function chaveTela() {
    var e = J.estado;
    if (!e) return "";
    return e.tela + ":" + (e.pergunta ? e.pergunta.id : "");
  }

  function precisaPainel(e) {
    return e && (e.tela === "aberta" || e.tela === "resultado" || e.tela === "placar" || e.tela === "podio") &&
      (e.tela === "placar" || e.tela === "podio" || e.pergunta);
  }

  function renderJogo() {
    var e = J.estado;
    if (!e) return;
    var chave = chaveTela();
    if (!precisaPainel(e) || J.dispensada === chave) {
      fecharPainel();
      renderBarra();
      return;
    }
    if (J.dispensada && J.dispensada !== chave) J.dispensada = "";
    // Durante a pergunta aberta, só redesenha quando algo do próprio participante muda,
    // para não apagar a justificativa que ele está digitando.
    var partes = [chave, J.token ? "t" : "", e.minha ? JSON.stringify(e.minha) : "", J.erro];
    if (e.tela !== "aberta") {
      partes.push(e.resultado ? JSON.stringify(e.resultado) : "", e.placar ? JSON.stringify(e.placar) : "",
        e.eu ? e.eu.posicao + "/" + e.eu.pontos : "");
    }
    var assinatura = partes.join("|");
    if (assinatura !== J.assinatura) {
      if (chave !== (J.assinatura.split("|")[0] || "")) { J.selecao = null; J.erro = ""; }
      var nota = el("#nota-decisao");
      var notaSalva = nota ? nota.value : "";
      J.assinatura = assinatura;
      painelCorpo.innerHTML = conteudoPainel(e);
      var notaNova = el("#nota-decisao");
      if (notaNova && notaSalva) notaNova.value = notaSalva;
      abrirPainel();
    }
    renderBarra();
    marcarTempo();
  }

  function abrirPainel() {
    if (!painel.hidden) return;
    fecharSugestoes();
    painel.hidden = false;
    document.body.style.overflow = "hidden";
    var foco = painel.querySelector("h2");
    if (foco) { foco.setAttribute("tabindex", "-1"); foco.focus({ preventScroll: true }); }
  }
  function fecharPainel() {
    if (painel.hidden) return;
    painel.hidden = true;
    document.body.style.overflow = "";
    J.assinatura = "";
  }

  function mostrarBarra(texto, acao) {
    barraTexto.textContent = texto;
    barraAcao.innerHTML = acao || "";
    barra.hidden = false;
    document.body.classList.add("com-barra");
  }
  function esconderBarra() {
    barra.hidden = true;
    document.body.classList.remove("com-barra");
  }

  function renderBarra() {
    if (!API || MODO_TELAO || !painel.hidden) { esconderBarra(); return; }
    var e = J.estado;
    if (J.token && !J.conectado) { mostrarBarra("Sem conexão com o jogo. Tentando de novo."); return; }
    if (e && precisaPainel(e) && J.dispensada === chaveTela() && (J.token || e.tela === "aberta")) {
      if (!J.token) { mostrarBarra("Há uma pergunta aberta. Entre no jogo para responder.", '<a class="botao botao-principal" href="#/entrar">Entrar no jogo</a>'); return; }
      mostrarBarra(e.tela === "aberta" ? "Há uma pergunta aberta." : "O resultado está disponível.",
        '<button class="botao botao-principal" type="button" data-voltar-pergunta>' + (e.tela === "aberta" ? "Responder" : "Ver") + "</button>");
      return;
    }
    if (!J.token) {
      if (e && e.tela === "aberta" && rotaAtual !== "/entrar") {
        mostrarBarra("Há uma pergunta aberta. Entre no jogo para responder.", '<a class="botao botao-principal" href="#/entrar">Entrar no jogo</a>');
      } else {
        esconderBarra();
      }
      return;
    }
    if (rotaAtual === "/jogo") { esconderBarra(); return; }
    if (e && e.tela === "caso" && e.capitulo && porId[e.capitulo] && location.hash !== linkCap(e.capitulo)) {
      mostrarBarra("No telão: " + porId[e.capitulo].consulta, '<a class="botao" href="' + linkCap(e.capitulo) + '">Acompanhar</a>');
      return;
    }
    if (e && e.recomendacao && location.hash !== linkCap("recomendacao")) {
      mostrarBarra("A recomendação do Grupo 7 foi liberada.", '<a class="botao" href="' + linkCap("recomendacao") + '">Ler</a>');
      return;
    }
    mostrarBarra("Você está no jogo. As perguntas aparecem aqui quando o apresentador abrir.", '<a class="botao" href="#/jogo">Sua área</a>');
  }

  setInterval(marcarTempo, 250);
  function marcarTempo() {
    var seg = el("#painel .pergunta-segundos");
    var linha = el("#painel .tempo span");
    if (!seg || !J.prazo || !J.estado || !J.estado.pergunta) return;
    var total = J.estado.pergunta.segundos;
    var resta = Math.max(0, (J.prazo - Date.now()) / 1000);
    seg.textContent = Math.ceil(resta) + " s";
    if (linha) linha.style.width = Math.max(0, Math.min(100, (resta / total) * 100)) + "%";
  }

  /* ---------- conteúdo do painel ---------- */
  function topoPergunta(p, mostrarTempo) {
    return (mostrarTempo ? '<div class="tempo" aria-hidden="true"><span style="width:100%"></span></div>' : "") +
      '<p class="pergunta-titulo"><span>' + esc(p.titulo) + "</span>" +
      (mostrarTempo ? '<span class="pergunta-segundos" aria-live="off"></span>' : "") + "</p>" +
      '<h2 class="pergunta-enunciado">' + esc(p.enunciado) + "</h2>";
  }

  function letra(i) { return String.fromCharCode(65 + i); }

  function conteudoPainel(e) {
    var p = e.pergunta;
    if (e.tela === "placar" || e.tela === "podio") return conteudoPlacar(e);
    if (e.tela === "resultado") return conteudoResultado(e);

    var html = topoPergunta(p, true);
    if (!J.token) {
      return html + '<p class="status-apoio">Entre no jogo para responder. Leva menos de um minuto.</p>' +
        '<a class="botao botao-principal" href="#/entrar" data-ir-entrar>Entrar no jogo</a>';
    }
    if (e.minha) {
      var escolhida = p.tipo === "cego" ? "Resposta " + letra(e.minha.escolha) : p.opcoes[e.minha.escolha];
      return html + '<p class="status-grande">Resposta enviada.</p><p class="status-apoio">Você escolheu: ' + esc(escolhida) +
        ". O resultado aparece quando o apresentador encerrar a pergunta.</p>";
    }
    if (p.tipo === "cego") {
      if (!p.textos || !p.textos.some(function (t) { return t; })) {
        return html + '<p class="status-apoio">As respostas ainda não foram carregadas pelo apresentador.</p>';
      }
      html += p.textos.map(function (t, i) {
        return '<section class="cego-texto"><h3>Resposta ' + letra(i) + "</h3><p>" + esc(t) + "</p>" +
          '<button class="botao" type="button" data-opcao="' + i + '">Escolher a resposta ' + letra(i) + "</button></section>";
      }).join("");
      return html + erroHtml();
    }
    html += '<ul class="opcoes">' + p.opcoes.map(function (o, i) {
      var marcado = p.tipo === "decisao" && J.selecao === i;
      return '<li><button class="opcao" type="button" data-opcao="' + i + '" aria-pressed="' + (marcado ? "true" : "false") + '">' +
        '<span class="opcao-letra" aria-hidden="true">' + letra(i) + "</span><span>" + esc(o.replace(/^[A-D]\.\s*/, "")) + "</span></button></li>";
    }).join("") + "</ul>";
    if (p.tipo === "decisao") {
      html += '<label class="campo" style="margin-top:1.4rem"><span>Justifique em uma linha, ou proponha outra estratégia</span>' +
        '<textarea id="nota-decisao" maxlength="280"></textarea><small>Justificativas com pelo menos 15 caracteres valem o dobro de pontos.</small></label>' +
        '<button class="botao botao-principal" type="button" data-enviar-decisao' + (J.selecao === null ? " disabled" : "") + ">Enviar decisão</button>";
    }
    return html + erroHtml();
  }

  function erroHtml() { return J.erro ? '<p class="mensagem mensagem-erro" role="alert">' + esc(J.erro) + "</p>" : ""; }

  function barrasHtml(p, r, minha) {
    var total = r.total || 0;
    return '<ul class="barras">' + r.contagem.map(function (n, i) {
      var pct = total ? Math.round((n / total) * 100) : 0;
      var nome = p.tipo === "cego" ? "Resposta " + letra(i) + (r.autores && r.autores[i] ? ": " + r.autores[i] : "") : p.opcoes[i];
      var classes = [];
      if (p.tipo === "quiz" && r.correta === i) classes.push("certa");
      if (minha && minha.escolha === i) classes.push("minha");
      var marcador = minha && minha.escolha === i ? " <small>(sua resposta)</small>" : "";
      return '<li class="' + classes.join(" ") + '"><div class="barra-rotulo"><span>' + esc(nome) + marcador + "</span><b>" + n + " (" + pct + "%)</b></div>" +
        '<div class="barra"><span style="width:' + pct + '%"></span></div></li>';
    }).join("") + "</ul>";
  }

  function conteudoResultado(e) {
    var p = e.pergunta, r = e.resultado || { contagem: [], total: 0 }, m = e.minha;
    var html = '<p class="pergunta-titulo"><span>' + esc(p.titulo) + ": resultado</span></p>";
    if (p.tipo === "quiz") {
      if (m && m.correta) html += '<h2 class="status-grande acerto">Você acertou. Mais ' + fmt(m.pontos) + " pontos.</h2>";
      else if (m) html += '<h2 class="status-grande">Não foi dessa vez.</h2>';
      else html += '<h2 class="status-grande">Você não respondeu a esta pergunta.</h2>';
      html += '<p class="status-apoio">A resposta certa era: ' + esc(p.opcoes[r.correta]) + ". " + esc(r.explicacao || "") + "</p>";
    } else {
      html += '<h2 class="status-grande">' + esc(p.enunciado) + "</h2>";
      if (p.tipo === "cego") {
        html += '<p class="status-apoio">' + (r.autores ? "Os autores foram revelados." : "Os autores de cada resposta são revelados no fim da apresentação.") + "</p>";
      }
    }
    html += barrasHtml(p, r, m);
    if (p.tipo === "decisao" && r.notas && r.notas.length) {
      html += '<p class="rotulo" style="margin-top:1.6rem">Algumas justificativas</p><ul class="notas">' + r.notas.map(function (n) {
        return '<li><p class="nota-autor">' + esc(n.nome) + ", " + esc(p.opcoes[n.escolha]) + "</p><p>" + esc(n.nota) + "</p></li>";
      }).join("") + "</ul>";
    }
    if (e.eu) html += '<p class="status-apoio" style="margin-top:1.4rem">Você soma ' + fmt(e.eu.pontos) + " pontos e está em " + e.eu.posicao + "º lugar entre " + e.eu.de + ".</p>";
    return html;
  }

  function conteudoPlacar(e) {
    var podio = e.tela === "podio";
    var lista = (e.placar || []).slice(0, podio ? 3 : 10);
    var html = '<p class="pergunta-titulo"><span>' + (podio ? "Fim do jogo" : "Placar") + "</span></p>" +
      '<h2 class="status-grande">' + (podio ? "Pódio" : "Os 10 primeiros") + "</h2>";
    if (e.eu) html += '<p class="status-apoio">Você está em ' + e.eu.posicao + "º lugar entre " + e.eu.de + ", com " + fmt(e.eu.pontos) + " pontos.</p>";
    if (!lista.length) return html + '<p class="status-apoio">Ainda não há pontos.</p>';
    return html + '<ol class="placar">' + lista.map(function (l) {
      return '<li><span class="placar-pos">' + l.posicao + "º</span><span>" + esc(l.nome) + "</span><b>" + fmt(l.pontos) + "</b></li>";
    }).join("") + "</ol>";
  }

  /* ---------- respostas ---------- */
  function escolher(i) {
    var e = J.estado;
    if (!e || !e.pergunta || e.tela !== "aberta" || e.minha) return;
    if (e.pergunta.tipo === "decisao") {
      J.selecao = i;
      Array.prototype.forEach.call(painel.querySelectorAll("[data-opcao]"), function (b) {
        b.setAttribute("aria-pressed", Number(b.getAttribute("data-opcao")) === i ? "true" : "false");
      });
      var enviar = painel.querySelector("[data-enviar-decisao]");
      if (enviar) enviar.disabled = false;
      return;
    }
    enviarResposta(i, "");
  }

  function enviarDecisao() {
    if (J.selecao === null) return;
    var nota = (el("#nota-decisao") || { value: "" }).value;
    enviarResposta(J.selecao, nota);
  }

  var enviando = false;
  function enviarResposta(escolha, nota) {
    if (enviando) return;
    enviando = true;
    Array.prototype.forEach.call(painelCorpo.querySelectorAll("button"), function (b) { b.disabled = true; });
    var e = J.estado;
    fetch(API + "/api/responder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: J.token, pergunta: e.pergunta.id, escolha: escolha, nota: nota }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (x) {
        enviando = false;
        if (x.status === 401) {
          sairDoJogo();
          J.erro = "";
          location.hash = "#/entrar";
          return;
        }
        if (!x.ok) J.erro = x.d.erro || "Não foi possível enviar. Tente de novo.";
        else { J.erro = ""; J.estado.minha = { escolha: escolha }; }
        J.assinatura = "";
        renderJogo();
        atualizarAreaJogo();
        atualizar();
      })
      .catch(function () {
        enviando = false;
        J.erro = "Sem conexão. Toque de novo na sua resposta.";
        J.assinatura = "";
        renderJogo();
      });
  }

  /* ---------------- início ---------------- */
  rota();
  if (API && !MODO_TELAO) atualizar();
})();
