/* Gêmeos: buscador do caso e cliente do jogo */
(function () {
  "use strict";

  var G = window.GEMEOS;
  var API = ((window.GEMEOS_CONFIG && window.GEMEOS_CONFIG.api) || "").replace(/\/+$/, "");
  var app = document.getElementById("app");
  var porId = {};
  G.capitulos.forEach(function (c) { porId[c.id] = c; });

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

  /* ---------------- busca ---------------- */
  function buscar(q) {
    var nq = normalizar(q);
    if (!nq) return [];
    var termos = nq.split(" ").filter(function (t) { return (t.length > 2 || /\d/.test(t)) && PARADAS.indexOf(t) < 0; });
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
      .sort(function (a, b) { return b.pts - a.pts; })
      .map(function (x) { return x.c; });
  }

  /* ---------------- partes da página ---------------- */
  function formBusca(valor, id) {
    return '<form class="busca-form" role="search" data-busca>' +
      '<label class="oculto-leitor" for="' + id + '">Pesquisar no caso</label>' +
      '<input id="' + id + '" name="q" type="search" autocomplete="off" value="' + esc(valor || "") + '" placeholder="Pesquise o caso">' +
      '<button type="submit">Pesquisar</button></form>';
  }

  function topo(valor) {
    return '<header class="topo">' +
      '<a class="marca marca-pequena" href="#/" aria-label="Gêmeos, página inicial">Gêmeos</a>' +
      formBusca(valor, "busca-topo") +
      '<div class="topo-acao" data-ficha></div></header>';
  }

  function rodape() {
    return '<footer class="rodape"><p>' + esc(G.grupo) + '.</p><p>' + esc(G.disciplina) + '.</p></footer>';
  }

  /* ---------------- páginas ---------------- */
  function paginaInicio() {
    document.title = "Gêmeos: um caso sobre o Google e a corrida da IA";
    var sug = G.sugestoes.map(function (id) {
      return '<li><a href="' + linkCap(id) + '">' + esc(porId[id].consulta) + "</a></li>";
    }).join("");
    app.innerHTML = '<div class="inicio">' +
      '<header class="topo"><div class="topo-acao" data-ficha></div></header>' +
      '<section class="inicio-centro">' +
      '<h1 class="marca marca-grande">Gêmeos</h1><div class="fio-duplo" aria-hidden="true"></div>' +
      '<p class="inicio-sub">Gemini quer dizer gêmeos. Este é um caso sobre os dois Googles: o da busca e da publicidade, e o da inteligência artificial.</p>' +
      formBusca("", "busca-inicio") +
      '<ul class="sugestoes" aria-label="Pesquisas sugeridas">' + sug + "</ul>" +
      '<div class="inicio-acoes"><a class="botao" href="' + linkCap("dilema") + '">Me surpreenda</a>' +
      '<a class="botao-texto" href="' + linkCap("fontes") + '">Fontes do caso</a></div>' +
      "</section>" + rodape() + "</div>";
    animarDica(el("#busca-inicio"));
  }

  function paginaResultados(q) {
    var lista = buscar(q);
    document.title = q + ": Gêmeos";
    var html = topo(q) + '<main class="pagina" id="conteudo">';
    if (!lista.length) {
      html += '<div class="vazio"><p>Nenhum resultado para "' + esc(q) + '".</p><p>Tente uma destas pesquisas:</p></div>' +
        '<ul class="sugestoes">' + G.sugestoes.map(function (id) {
          return '<li><a href="' + linkCap(id) + '">' + esc(porId[id].consulta) + "</a></li>";
        }).join("") + "</ul>";
    } else {
      html += '<p class="contagem-resultados">' + (lista.length === 1 ? "1 resultado" : "Cerca de " + lista.length + " resultados") + "</p>";
      lista.forEach(function (c) {
        html += '<article class="resultado"><p class="resultado-endereco">gemeos › ' + esc(c.id) + "</p>" +
          '<h2><a href="' + linkCap(c.id) + '">' + esc(c.titulo) + "</a></h2><p>" + esc(c.trecho) + "</p></article>";
      });
    }
    app.innerHTML = html + "</main>" + rodape();
  }

  function fatoHtml(f) {
    var fonte = G.fontes[f.fonte];
    var extra = f.fonteExtra ? G.fontes[f.fonteExtra] : null;
    var linhaFonte = '<a href="' + esc(fonte.url) + '" target="_blank" rel="noopener">' + esc(fonte.nome) + "</a>, " + esc(fonte.data);
    if (extra) linhaFonte += ' e <a href="' + esc(extra.url) + '" target="_blank" rel="noopener">' + esc(extra.nome) + "</a>, " + esc(extra.data);
    return '<li class="fato"><p class="fato-fonte">' + linhaFonte + "</p><h3>" + esc(f.titulo) + "</h3><p>" + esc(f.texto) + "</p></li>";
  }

  function relacionadasHtml(c) {
    if (!c.relacionadas || !c.relacionadas.length) return "";
    return '<nav class="relacionadas" aria-label="Pesquisas relacionadas"><p class="rotulo">Pesquisas relacionadas</p><ul>' +
      c.relacionadas.map(function (id) { return '<li><a href="' + linkCap(id) + '">' + esc(porId[id].consulta) + "</a></li>"; }).join("") +
      "</ul></nav>";
  }

  function paginaCapitulo(id) {
    var c = porId[id];
    if (!c) { paginaInicio(); return; }
    document.title = c.titulo + ": Gêmeos";
    var html = topo(c.consulta) + '<main class="pagina capitulo" id="conteudo"><h1 class="capitulo-titulo">' + esc(c.titulo) + "</h1>";

    if (c.id === "fontes") {
      html += '<ul class="fontes-lista">' + Object.keys(G.fontes).map(function (k) {
        var f = G.fontes[k];
        return '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.titulo) + "</a><span>" + esc(f.nome) + ", " + esc(f.data) + "</span></li>";
      }).join("") + "</ul>" +
        '<div class="metodo"><p>' + esc(G.metodo) + "</p><p>" + esc(G.grupo) + ". " + esc(G.disciplina) + ".</p></div>";
    } else if (c.bloqueado) {
      html += '<div class="recomendacao" data-recomendacao><p class="status-apoio">Carregando a recomendação…</p></div>';
    } else {
      html += '<p class="rotulo">Resposta curta</p><p class="resposta-curta">' + esc(c.resposta) + "</p>" +
        '<div class="fio-duplo" aria-hidden="true"></div>';
      if (c.id === "dilema") {
        html += '<p class="papel">' + esc(c.papel) + "</p>" +
          '<p class="rotulo">As alternativas</p><ol class="alternativas">' + c.alternativas.map(function (a) {
            return '<li class="alternativa"><span class="alternativa-letra" aria-hidden="true">' + esc(a.letra) + "</span><div>" +
              "<h3>" + esc(a.letra) + ". " + esc(a.nome) + "</h3><p>" + esc(a.texto) + "</p>" +
              '<dl class="troca"><div><dt>O que ganha</dt><dd>' + esc(a.ganha) + "</dd></div>" +
              "<div><dt>O que sacrifica</dt><dd>" + esc(a.sacrifica) + "</dd></div></dl></div></li>";
          }).join("") + "</ol>" +
          '<div class="fio-duplo" aria-hidden="true"></div><p class="rotulo">Perguntas para a turma</p><ol class="perguntas">' +
          c.perguntas.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>" +
          '<div class="aviso-quiz"><p>A votação da decisão abre no fim da apresentação. Entre no jogo para votar e justificar a sua escolha.</p></div>';
      } else {
        html += '<p class="rotulo">Os fatos, com as fontes</p><ol class="fatos">' + c.fatos.map(fatoHtml).join("") + "</ol>";
        if (c.quiz) {
          html += '<div class="aviso-quiz"><p>Este capítulo tem pergunta-relâmpago. Quando o apresentador abrir, ela aparece na sua tela. Quem responde certo e rápido pontua mais.</p></div>';
        }
      }
    }
    html += relacionadasHtml(c) + "</main>" + rodape();
    app.innerHTML = html;
    if (c.bloqueado) carregarRecomendacao();
  }

  function carregarRecomendacao() {
    var alvo = el("[data-recomendacao]");
    if (!alvo) return;
    if (!API) { alvo.innerHTML = '<div class="bloqueado"><p>A recomendação do Grupo 7 será liberada no fim da discussão.</p></div>'; return; }
    fetch(API + "/api/recomendacao").then(function (r) {
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

  /* Dica animada na caixa de busca da página inicial: o único movimento da página */
  var dicaTimer = null;
  function animarDica(input) {
    clearTimeout(dicaTimer);
    if (!input) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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

  /* ---------------- roteamento ---------------- */
  function rota() {
    var h = location.hash.replace(/^#/, "") || "/";
    var partes = h.split("?");
    var caminho = partes[0];
    var params = new URLSearchParams(partes[1] || "");
    if (caminho.indexOf("/caso/") === 0) paginaCapitulo(caminho.slice(6));
    else if (caminho === "/busca") paginaResultados(params.get("q") || "");
    else paginaInicio();
    if (caminho === "/entrar") abrirEntrada(params.get("sala") || "");
    renderFicha();
    if (J.estado || !J.conectado) renderBarra();
    window.scrollTo(0, 0);
  }

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form.hasAttribute("data-busca")) return;
    ev.preventDefault();
    var q = form.q.value.trim();
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
    recomendacao: null,
  };

  function lerLocal(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function gravarLocal(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* armazenamento indisponível */ } }

  var painel = el("#painel");
  var painelCorpo = el("#painel-corpo");
  var barra = el("#jogo-barra");
  var barraTexto = el("#jogo-barra-texto");
  var barraAcao = el("#jogo-barra-acao");
  var dialogo = el("#dialogo-entrar");
  var formEntrar = el("#form-entrar");

  function renderFicha() {
    var slots = document.querySelectorAll("[data-ficha]");
    var html;
    if (!API) html = "";
    else if (J.token && J.estado && J.estado.eu) {
      html = '<span class="ficha"><span class="ficha-nome">' + esc(J.estado.eu.nome) + '</span><span class="ficha-pontos">' + fmt(J.estado.eu.pontos) + " pts</span></span>";
    } else if (J.token) {
      html = '<span class="ficha"><span class="ficha-nome">' + esc(J.nome) + "</span></span>";
    } else {
      html = "";
    }
    Array.prototype.forEach.call(slots, function (s) { s.innerHTML = html; });
  }

  document.addEventListener("click", function (ev) {
    var alvo = ev.target.closest("[data-entrar]");
    if (alvo) { ev.preventDefault(); abrirEntrada(""); return; }
    var fechar = ev.target.closest("[data-fechar]");
    if (fechar && dialogo.open) { dialogo.close(); return; }
    var dispensar = ev.target.closest("[data-dispensar]");
    if (dispensar) { J.dispensada = chaveTela(); fecharPainel(); renderBarra(); return; }
    var voltar = ev.target.closest("[data-voltar-pergunta]");
    if (voltar) { J.dispensada = ""; J.assinatura = ""; renderJogo(); return; }
    var opcao = ev.target.closest("[data-opcao]");
    if (opcao) { escolher(Number(opcao.getAttribute("data-opcao"))); return; }
    var enviar = ev.target.closest("[data-enviar-decisao]");
    if (enviar) { enviarDecisao(); return; }
  });

  function abrirEntrada(sala) {
    if (!API || !dialogo) return;
    formEntrar.reset();
    if (sala) formEntrar.sala.value = sala.toUpperCase();
    mostrarErroEntrada("");
    if (!dialogo.open) dialogo.showModal();
    setTimeout(function () { formEntrar.nome.focus(); }, 50);
  }

  function mostrarErroEntrada(msg) {
    var p = formEntrar.querySelector(".mensagem-erro");
    p.textContent = msg;
    p.hidden = !msg;
  }

  formEntrar && formEntrar.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var botao = formEntrar.querySelector("[type=submit]");
    botao.disabled = true;
    mostrarErroEntrada("");
    fetch(API + "/api/entrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: formEntrar.nome.value, email: formEntrar.email.value, sala: formEntrar.sala.value }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        botao.disabled = false;
        if (!x.ok) { mostrarErroEntrada(x.d.erro || "Não foi possível entrar. Tente de novo."); return; }
        J.token = x.d.token; J.nome = x.d.nome;
        gravarLocal("gemeos.token", J.token); gravarLocal("gemeos.nome", J.nome);
        dialogo.close();
        if (location.hash.indexOf("#/entrar") === 0) location.hash = "#/";
        J.assinatura = ""; J.dispensada = "";
        atualizar(true);
      })
      .catch(function () { botao.disabled = false; mostrarErroEntrada("Sem conexão com o jogo. Confira a internet e tente de novo."); });
  });

  /* ---------- sincronização ---------- */
  var proxima = null;
  function atualizar(agora) {
    clearTimeout(proxima);
    if (!API) return;
    var url = API + "/api/estado" + (J.token ? "?token=" + encodeURIComponent(J.token) : "");
    fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      J.conectado = true;
      if (d.sessao === "invalida") { J.token = ""; J.nome = ""; gravarLocal("gemeos.token", ""); gravarLocal("gemeos.nome", ""); }
      var recAntes = J.estado ? J.estado.recomendacao : null;
      J.estado = d;
      if (d.tela === "aberta" && typeof d.restante === "number") {
        var novoPrazo = Date.now() + d.restante * 1000;
        if (!J.prazo || Math.abs(novoPrazo - J.prazo) > 1500) J.prazo = novoPrazo;
      } else {
        J.prazo = 0;
      }
      if (recAntes !== null && recAntes !== d.recomendacao && el("[data-recomendacao]")) carregarRecomendacao();
      renderFicha();
      renderJogo();
    }).catch(function () {
      J.conectado = false;
      renderBarra();
    }).then(function () {
      proxima = setTimeout(atualizar, document.hidden ? 8000 : (J.conectado ? 2000 : 4000));
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) atualizar(true); });

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

  function renderBarra() {
    if (!API) { barra.hidden = true; document.body.classList.remove("com-barra"); return; }
    var e = J.estado;
    var texto = "", acao = "";
    if (!J.conectado) {
      texto = "Sem conexão com o jogo. Tentando de novo.";
    } else if (!painel.hidden) {
      barra.hidden = true; document.body.classList.remove("com-barra"); return;
    } else if (e && precisaPainel(e) && J.dispensada === chaveTela()) {
      texto = e.tela === "aberta" ? "Há uma pergunta aberta." : "O resultado está disponível.";
      acao = '<button class="botao botao-principal" type="button" data-voltar-pergunta>' + (e.tela === "aberta" ? "Responder" : "Ver") + "</button>";
    } else if (!J.token) {
      texto = "Entre no jogo para responder às perguntas da apresentação.";
      acao = '<button class="botao botao-principal" type="button" data-entrar>Entrar no jogo</button>';
    } else if (e && e.recomendacao && location.hash !== linkCap("recomendacao")) {
      texto = "A recomendação do Grupo 7 foi liberada.";
      acao = '<a class="botao" href="' + linkCap("recomendacao") + '">Ler</a>';
    } else {
      texto = "Você está no jogo. A próxima pergunta aparece aqui quando o apresentador abrir.";
    }
    barraTexto.textContent = texto;
    barraAcao.innerHTML = acao;
    barra.hidden = false;
    document.body.classList.add("com-barra");
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
      return html + '<p class="status-apoio">Entre no jogo para responder.</p><button class="botao botao-principal" type="button" data-entrar>Entrar no jogo</button>';
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
      html += '<p class="rotulo" style="margin-top:1.6rem">Algumas justificativas</p><ul class="fatos">' + r.notas.map(function (n) {
        return '<li class="fato"><p class="fato-fonte">' + esc(n.nome) + ", " + esc(p.opcoes[n.escolha]) + "</p><p>" + esc(n.nota) + "</p></li>";
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
        if (x.status === 401) { J.token = ""; gravarLocal("gemeos.token", ""); J.erro = ""; abrirEntrada(""); }
        else if (!x.ok) J.erro = x.d.erro || "Não foi possível enviar. Tente de novo.";
        else { J.erro = ""; J.estado.minha = { escolha: escolha }; }
        J.assinatura = "";
        renderJogo();
        atualizar(true);
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
  if (API) atualizar(true);
})();
