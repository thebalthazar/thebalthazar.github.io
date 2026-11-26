/* Gêmeos: telão e área do apresentador */
(function () {
  "use strict";

  var CFG = window.GEMEOS_CONFIG || {};
  var G = window.GEMEOS || { capitulos: [] };
  var API = (CFG.api || "").replace(/\/+$/, "");
  var SITE = CFG.site || location.href.replace(/telao\.html.*$/, "");
  var SITE_CURTO = SITE.replace(/^https?:\/\//, "").replace(/\/$/, "");
  var porId = {};
  (G.capitulos || []).forEach(function (c) { porId[c.id] = c; });
  var MARCA = '<span aria-hidden="true">g<span class="gemeo">ê</span>m<span class="gemeo">e</span>os</span><span class="oculto-leitor">gêmeos</span>';
  var CREDITOS = (G.projeto && G.projeto.creditosCurtos) || "";

  var tela = document.getElementById("tela");
  var telaCaso = document.getElementById("tela-caso");
  var frame = document.getElementById("frame-caso");
  var controle = document.getElementById("controle");
  var acesso = document.getElementById("acesso");
  var fChave = document.getElementById("form-chave");
  var seletor = document.getElementById("seletor-etapa");
  var agoraEl = document.getElementById("roteiro-agora");
  var detalheEl = document.getElementById("roteiro-detalhe");
  var proximoEl = document.getElementById("roteiro-proximo");
  var avisoEl = document.getElementById("roteiro-aviso");
  var bAvancar = controle.querySelector('[data-acao="avancar"]');
  var bVoltar = controle.querySelector('[data-acao="voltar"]');
  var dConfirmar = document.getElementById("dialogo-confirmar");
  var dCego = document.getElementById("dialogo-cego");
  var fCego = document.getElementById("form-cego");

  var chave = lerLocal("gemeos.chave");
  var painel = null;
  var estado = null;
  var conectado = true;
  var prazo = 0;
  var assinaturaTela = "";
  var abaCego = "cego1";
  var timerPainel = null;
  var modoControle = false;
  var controlesOcultos = false;
  var ocupado = false;
  var ultimoPasso = -1;
  var seletorTocado = false;
  var capituloFrame = "";
  var emCaso = false;
  var aviso = "";
  var timerAviso = null;

  /* ---------------- roteiro da apresentação ---------------- */
  function pesquisa(id) {
    return { tela: "caso", capitulo: id, rotulo: "Pesquisa: " + (porId[id] ? porId[id].consulta : id) };
  }
  function abrir(id, nome) { return { tela: "aberta", pergunta: id, rotulo: "Abrir " + nome }; }
  function resultado(id, nome, revelar) {
    var et = { tela: "resultado", pergunta: id, rotulo: "Resultado " + nome };
    if (typeof revelar === "boolean") et.revelar = revelar;
    return et;
  }

  var ROTEIRO = [
    { tela: "espera", rotulo: "Tela de entrada com o QR code" },
    abrir("aquecimento", "o aquecimento"), resultado("aquecimento", "do aquecimento"),
    abrir("cego1", "o teste cego 1"), resultado("cego1", "do teste cego 1", false),
    abrir("cego2", "o teste cego 2"), resultado("cego2", "do teste cego 2", false),
    pesquisa("largada"), abrir("q1", "a pergunta-relâmpago 1"), resultado("q1", "da pergunta-relâmpago 1"),
    pesquisa("marca"), abrir("q2", "a pergunta-relâmpago 2"), resultado("q2", "da pergunta-relâmpago 2"),
    pesquisa("busca"), abrir("q3", "a pergunta-relâmpago 3"), resultado("q3", "da pergunta-relâmpago 3"),
    pesquisa("infraestrutura"),
    pesquisa("talentos"), abrir("q4", "a pergunta-relâmpago 4"), resultado("q4", "da pergunta-relâmpago 4"),
    abrir("q5", "a pergunta-relâmpago 5"), resultado("q5", "da pergunta-relâmpago 5"),
    { tela: "placar", rotulo: "Placar parcial" },
    pesquisa("base"),
    pesquisa("dilema"),
    abrir("decisao", "a decisão"), resultado("decisao", "da decisão"),
    { tela: "resultado", pergunta: "cego1", revelar: true, rotulo: "Revelar os autores do teste cego 1" },
    { tela: "resultado", pergunta: "cego2", revelar: true, rotulo: "Revelar os autores do teste cego 2" },
    { tela: "podio", rotulo: "Pódio" },
    { tela: "caso", capitulo: "recomendacao", liberar: true, rotulo: "Liberar a recomendação do Grupo 7 e mostrar no telão" },
  ];

  function chaveEtapa(et) {
    return et.tela + ":" + (et.pergunta || et.capitulo || "") + (et.revelar ? ":rev" : "");
  }
  function chaveEstado(e) {
    if (!e) return "";
    var id = "";
    if ((e.tela === "aberta" || e.tela === "resultado") && e.pergunta) id = e.pergunta.id;
    if (e.tela === "caso") id = e.capitulo || "";
    var rev = e.tela === "resultado" && e.pergunta && e.pergunta.tipo === "cego" && e.resultado && e.resultado.autores ? ":rev" : "";
    return e.tela + ":" + id + rev;
  }
  function passoAtual() {
    var k = chaveEstado(estado);
    for (var i = 0; i < ROTEIRO.length; i++) {
      if (chaveEtapa(ROTEIRO[i]) === k) { ultimoPasso = i; return i; }
    }
    return ultimoPasso;
  }

  /* ---------------- utilidades ---------------- */
  function lerLocal(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function gravarLocal(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function letra(i) { return String.fromCharCode(65 + i); }
  function segundosRestantes() { return prazo ? Math.ceil(Math.max(0, (prazo - Date.now()) / 1000)) : 0; }

  function qrSvg(texto) {
    if (typeof window.qrcode !== "function") return "";
    var q = window.qrcode(0, "M");
    q.addData(texto);
    q.make();
    return q.createSvgTag({ cellSize: 8, margin: 0, scalable: true, title: "QR code para entrar no jogo" });
  }
  function linkEntrada() {
    return SITE + "#/entrar" + (painel && painel.sala ? "?sala=" + encodeURIComponent(painel.sala) : "");
  }

  /* ---------------- modo, acesso e visibilidade ---------------- */
  function aplicarModo() {
    modoControle = location.hash === "#controle";
    document.body.classList.toggle("modo-controle", modoControle);
    var link = document.getElementById("link-modo");
    link.textContent = modoControle ? "Ver como telão" : "Controle pelo celular";
    link.setAttribute("href", modoControle ? "#" : "#controle");
    assinaturaTela = "";
    emCaso = false;
    atualizarVisibilidade();
    renderTela();
  }
  window.addEventListener("hashchange", aplicarModo);

  function atualizarVisibilidade() {
    var dentro = !!chave && acesso.hidden;
    controle.hidden = !dentro || (controlesOcultos && !modoControle);
    medirControle();
  }

  function medirControle() {
    var h = controle.hidden || modoControle ? 0 : controle.offsetHeight;
    document.documentElement.style.setProperty("--altura-controle", h + "px");
  }
  window.addEventListener("resize", medirControle);

  function alternarControles() {
    if (modoControle || !acesso.hidden || !chave) return;
    controlesOcultos = !controlesOcultos;
    atualizarVisibilidade();
  }

  function mostrarAcesso(msg) {
    acesso.hidden = false;
    var p = fChave.querySelector(".mensagem-erro");
    p.textContent = msg || "";
    p.hidden = !msg;
    atualizarVisibilidade();
    setTimeout(function () { try { fChave.chave.focus(); } catch (e) { /* sem foco */ } }, 60);
  }
  function esconderAcesso() {
    acesso.hidden = true;
    atualizarVisibilidade();
  }

  /* ---------------- servidor ---------------- */
  function admin(metodo, caminho, corpo) {
    return fetch(API + caminho, {
      method: metodo,
      cache: "no-store",
      headers: { "content-type": "application/json", "x-admin-key": chave },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { var e = new Error(d.erro || "Erro no servidor do jogo."); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  fChave.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var tentativa = fChave.chave.value.trim();
    if (!tentativa) return;
    var botao = fChave.querySelector("[type=submit]");
    botao.disabled = true;
    chave = tentativa;
    admin("GET", "/api/admin/painel").then(function (d) {
      gravarLocal("gemeos.chave", chave);
      painel = d;
      fChave.reset();
      esconderAcesso();
      renderControle();
      cicloPainel();
    }).catch(function (e) {
      chave = "";
      mostrarAcesso(e.status === 401 ? "A chave não confere. Confira com o Grupo 7 e digite de novo." : "Sem conexão com o servidor do jogo. Tente de novo em instantes.");
    }).then(function () { botao.disabled = false; });
  });

  function buscarEstado() {
    return fetch(API + "/api/estado", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      estado = d;
      conectado = true;
      if (d.tela === "aberta" && typeof d.restante === "number") {
        var novo = Date.now() + d.restante * 1000;
        if (!prazo || Math.abs(novo - prazo) > 1500) prazo = novo;
      } else {
        prazo = 0;
      }
      renderTela();
      renderControle();
    }).catch(function () {
      conectado = false;
      renderControle();
    });
  }

  function cicloEstado() {
    buscarEstado().then(function () { setTimeout(cicloEstado, 1000); });
  }

  function recarregarPainel() {
    return admin("GET", "/api/admin/painel").then(function (p) { painel = p; });
  }

  function cicloPainel() {
    clearTimeout(timerPainel);
    if (!chave) return;
    recarregarPainel().then(function () {
      renderControle();
    }).catch(function (e) {
      if (e.status === 401) {
        chave = "";
        painel = null;
        gravarLocal("gemeos.chave", "");
        mostrarAcesso("A chave mudou ou não confere. Digite a chave do apresentador de novo.");
      }
    }).then(function () { if (chave) timerPainel = setTimeout(cicloPainel, 3000); });
  }

  /* ---------------- telas do telão ---------------- */
  function topoTela(titulo, comTempo) {
    return '<div class="tela-topo"><span class="marca">' + MARCA + '</span><span class="tela-titulo">' + esc(titulo) + "</span>" +
      (comTempo ? '<span class="tela-tempo" data-tempo></span>' : "") + '</div><div class="fio-duplo" aria-hidden="true"></div>';
  }

  function rodapeTela(texto) {
    return '<div class="tela-rodape"><span data-rodape>' + esc(texto) + '</span><span class="qr-pequeno">' + qrSvg(linkEntrada()) + "</span></div>";
  }

  function telaEspera() {
    var sala = painel ? painel.sala : "";
    var recentes = (estado && estado.recentes) || [];
    return '<div class="tela-espera"><div class="espera-texto"><h1 class="marca">' + MARCA + '</h1><div class="fio-duplo" aria-hidden="true"></div><dl>' +
      "<dt>Entre no jogo pelo celular</dt><dd>" + esc(SITE_CURTO) + "</dd>" +
      (sala ? "<dt>Código da sala</dt><dd>" + esc(sala) + "</dd>" : "") +
      "<dt>Participantes</dt><dd>" + fmt(estado.jogadores) + "</dd></dl>" +
      (recentes.length ? '<div class="recentes"><p>Acabaram de entrar</p><ul>' +
        recentes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>" : "") +
      (CREDITOS ? '<p class="espera-creditos">' + esc(CREDITOS) + "</p>" : "") +
      "</div>" + '<div class="qr">' + qrSvg(linkEntrada()) + "</div></div>";
  }

  function respostasTexto() {
    return fmt(estado.respostas || 0) + " de " + fmt(estado.jogadores) + " responderam";
  }

  function telaAberta(p) {
    var html = topoTela(p.titulo, true) + '<div class="tela-corpo">';
    if (p.tipo === "cego") {
      html += '<h1 class="tela-enunciado menor">' + esc(p.enunciado) + '</h1><div class="tela-cego">' +
        (p.textos || []).map(function (t, i) {
          return "<section><h3>Resposta " + letra(i) + "</h3><p>" + esc(t || "Resposta ainda não carregada.") + "</p></section>";
        }).join("") + "</div>";
    } else {
      html += '<h1 class="tela-enunciado">' + esc(p.enunciado) + '</h1><ol class="tela-opcoes">' + p.opcoes.map(function (o, i) {
        return '<li><span class="letra">' + letra(i) + "</span><span>" + esc(o.replace(/^[A-D]\.\s*/, "")) + "</span></li>";
      }).join("") + "</ol>";
    }
    return html + "</div>" + rodapeTela(respostasTexto());
  }

  function telaResultado(p, r) {
    var total = r.total || 0;
    var dividida = p.tipo === "decisao" && r.notas && r.notas.length;
    var html = topoTela(p.titulo + ": resultado", false) + '<div class="tela-corpo' + (dividida ? " tela-dividida" : "") + '"><div>' +
      '<h1 class="tela-enunciado menor">' + esc(p.enunciado) + '</h1><ul class="tela-barras">' +
      r.contagem.map(function (n, i) {
        var pct = total ? Math.round((n / total) * 100) : 0;
        var nome = p.tipo === "cego" ? "Resposta " + letra(i) + (r.autores && r.autores[i] ? ": " + r.autores[i] : "") : p.opcoes[i];
        var certa = p.tipo === "quiz" && r.correta === i;
        return '<li class="' + (certa ? "certa" : "") + '"><div class="barra-rotulo"><span>' + esc(nome) + "</span><b>" + n + " (" + pct + "%)</b></div>" +
          '<div class="barra"><span style="width:' + pct + '%"></span></div></li>';
      }).join("") + "</ul></div>";
    if (p.tipo === "quiz") {
      html += '<p class="tela-explicacao">A resposta certa era ' + esc(p.opcoes[r.correta]) + ". " + esc(r.explicacao || "") + "</p>";
    }
    if (dividida) {
      var grupos = p.opcoes.map(function (o, i) {
        var notas = r.notas.filter(function (n) { return n.escolha === i; }).slice(0, 2);
        if (!notas.length) return "";
        return "<section><h3>" + esc(o) + "</h3>" + notas.map(function (n) {
          return "<p>" + esc(n.nota) + " <span>(" + esc(n.nome) + ")</span></p>";
        }).join("") + "</section>";
      }).join("");
      html += '<div class="tela-notas">' + grupos + "</div>";
    }
    return html + "</div>" + rodapeTela(fmt(total) + " respostas");
  }

  function telaPlacar(lista) {
    return topoTela("Placar", false) + '<div class="tela-corpo"><ol class="tela-placar">' +
      (lista.length ? lista.map(function (l) {
        return '<li><span class="pos">' + l.posicao + "º</span><span>" + esc(l.nome) + "</span><b>" + fmt(l.pontos) + "</b></li>";
      }).join("") : "<li><span></span><span>Ainda não há pontos.</span><b></b></li>") +
      "</ol></div>" + rodapeTela(fmt(estado.jogadores) + " participantes");
  }

  function telaPodio(lista) {
    var tres = lista.slice(0, 3);
    return topoTela("Pódio", false) + '<div class="tela-corpo"><div class="tela-podio">' +
      (tres.length ? tres.map(function (l, i) {
        return '<section class="' + (i === 0 ? "primeiro" : "") + '"><div class="pos">' + l.posicao + 'º</div><div class="nome">' + esc(l.nome) +
          '</div><div class="pts">' + fmt(l.pontos) + " pontos</div></section>";
      }).join("") : "<p>Ainda não há pontos.</p>") + "</div></div>";
  }

  /* O caso no telão: a mesma página do buscador, ampliada para o projetor */
  function mostrarCaso(id) {
    tela.hidden = true;
    telaCaso.hidden = false;
    var entrando = !emCaso;
    emCaso = true;
    if (!entrando && capituloFrame === id) return;
    capituloFrame = id;
    var alvo = "#/caso/" + encodeURIComponent(id);
    var w = null;
    var carregado = false;
    try {
      w = frame.contentWindow;
      carregado = !!(w && w.location && /modo=telao/.test(w.location.search));
    } catch (e) { carregado = false; }
    if (carregado) {
      if (w.location.hash !== alvo) w.location.hash = alvo;
    } else {
      frame.src = "index.html?modo=telao" + alvo;
    }
  }

  function renderTela() {
    if (!estado || modoControle) return;
    var e = estado;
    if (e.tela === "caso" && e.capitulo) { mostrarCaso(e.capitulo); return; }
    emCaso = false;
    telaCaso.hidden = true;
    tela.hidden = false;
    var assinatura = [e.tela, e.pergunta ? e.pergunta.id : "", e.pergunta && e.pergunta.textos ? e.pergunta.textos.join("¦").length : "",
      e.resultado ? JSON.stringify(e.resultado) : "", e.placar ? JSON.stringify(e.placar) : "",
      e.tela === "espera" ? e.jogadores + ":" + (e.recentes || []).join(",") : "", painel ? painel.sala : ""].join("|");
    if (assinatura !== assinaturaTela) {
      assinaturaTela = assinatura;
      if (e.tela === "aberta" && e.pergunta) tela.innerHTML = telaAberta(e.pergunta);
      else if (e.tela === "resultado" && e.pergunta && e.resultado) tela.innerHTML = telaResultado(e.pergunta, e.resultado);
      else if (e.tela === "placar") tela.innerHTML = telaPlacar(e.placar || []);
      else if (e.tela === "podio") tela.innerHTML = telaPodio(e.placar || []);
      else tela.innerHTML = telaEspera();
    }
    var rod = tela.querySelector("[data-rodape]");
    if (rod && e.tela === "aberta") rod.textContent = respostasTexto();
    marcarTempo();
  }

  setInterval(marcarTempo, 250);
  function marcarTempo() {
    var t = tela.querySelector("[data-tempo]");
    if (t) t.textContent = prazo ? segundosRestantes() + " s" : "";
    if (estado && estado.tela === "aberta") detalheEl.textContent = descricaoEstado();
  }

  /* ---------------- controles ---------------- */
  function montarSeletor() {
    seletor.innerHTML = ROTEIRO.map(function (et, i) {
      return '<option value="' + i + '">' + (i + 1) + ". " + esc(et.rotulo) + "</option>";
    }).join("");
  }
  seletor.addEventListener("change", function () { seletorTocado = true; });

  function descricaoEstado() {
    if (!estado) return conectado ? "Conectando ao servidor do jogo…" : "Sem conexão com o servidor do jogo. Tentando de novo.";
    if (!conectado) return "Sem conexão com o servidor do jogo. Tentando de novo.";
    var e = estado, p = e.pergunta;
    if (e.tela === "espera") {
      return fmt(e.jogadores) + (e.jogadores === 1 ? " participante" : " participantes") + " na sala" + (painel ? " " + painel.sala : "") + ".";
    }
    if (e.tela === "aberta" && p) {
      var s = segundosRestantes();
      return respostasTexto() + ". " + (s > 0 ? "Faltam " + s + " s." : "Tempo esgotado.");
    }
    if (e.tela === "resultado" && p) {
      var autores = p.tipo === "cego" ? (e.resultado && e.resultado.autores ? " Autores revelados." : " Autores ainda ocultos.") : "";
      return fmt((e.resultado && e.resultado.total) || 0) + " respostas." + autores;
    }
    if (e.tela === "placar" || e.tela === "podio") return fmt(e.jogadores) + " participantes.";
    if (e.tela === "caso") return "O telão mostra a pesquisa do caso. Role a página com o mouse, se precisar.";
    return "";
  }

  function avisoAtual(prox) {
    if (aviso) return aviso;
    if (prox && prox.tela === "aberta" && (prox.pergunta === "cego1" || prox.pergunta === "cego2") && painel) {
      var c = painel.conteudo && painel.conteudo[prox.pergunta];
      var completo = c && ["A", "B", "C"].every(function (k) { return c[k] && c[k].texto; });
      if (!completo) return "Antes de avançar, carregue as três respostas deste teste cego em Editar teste cego.";
    }
    return "";
  }

  function mostrarAviso(msg) {
    aviso = msg;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { aviso = ""; renderControle(); }, 7000);
    renderControle();
  }

  function renderControle() {
    if (!seletor.options.length) montarSeletor();
    var i = passoAtual();
    var atual = ROTEIRO[i];
    var prox = ROTEIRO[i + 1];
    agoraEl.textContent = atual ? atual.rotulo : "Fora do roteiro";
    detalheEl.textContent = descricaoEstado();
    proximoEl.textContent = prox ? prox.rotulo : "Fim do roteiro";
    bAvancar.disabled = ocupado || !prox || !painel;
    bVoltar.disabled = ocupado || i <= 0 || !painel;
    Array.prototype.forEach.call(seletor.options, function (o, k) {
      var texto = (k + 1) + ". " + ROTEIRO[k].rotulo + (k === i ? " (agora)" : "");
      if (o.textContent !== texto) o.textContent = texto;
    });
    if (document.activeElement !== seletor && !seletorTocado) seletor.value = String(Math.min(Math.max(i + 1, 0), ROTEIRO.length - 1));
    var msg = avisoAtual(prox);
    avisoEl.textContent = msg;
    avisoEl.hidden = !msg;
    var rec = document.getElementById("botao-recomendacao");
    if (estado) rec.textContent = estado.recomendacao ? "Bloquear recomendação" : "Liberar recomendação";
    medirControle();
  }

  function executar(promessa) {
    ocupado = true;
    renderControle();
    return promessa.then(function () {
      return Promise.all([recarregarPainel(), buscarEstado()]);
    }).catch(function (e) {
      mostrarAviso(e && e.message ? e.message : "Não foi possível concluir. Tente de novo.");
    }).then(function () {
      ocupado = false;
      renderControle();
    });
  }

  function executarEtapa(i) {
    var et = ROTEIRO[i];
    if (!et || ocupado || !painel) return;
    var cadeia = Promise.resolve();
    if (et.liberar) cadeia = cadeia.then(function () { return admin("POST", "/api/admin/recomendacao", { liberar: true }); });
    if (typeof et.revelar === "boolean") {
      cadeia = cadeia.then(function () { return admin("POST", "/api/admin/revelar", { pergunta: et.pergunta, revelar: et.revelar }); });
    }
    cadeia = cadeia.then(function () {
      var corpo = { tela: et.tela };
      if (et.pergunta) corpo.pergunta = et.pergunta;
      if (et.capitulo) corpo.capitulo = et.capitulo;
      return admin("POST", "/api/admin/tela", corpo);
    }).then(function () { ultimoPasso = i; });
    executar(cadeia);
  }

  function avancar() {
    if (ocupado || !painel) return;
    var i = passoAtual();
    if (i + 1 < ROTEIRO.length) executarEtapa(i + 1);
  }
  function voltar() {
    if (ocupado || !painel) return;
    var i = passoAtual();
    if (i > 0) executarEtapa(i - 1);
  }

  function confirmar(texto) {
    return new Promise(function (resolve) {
      document.getElementById("texto-confirmar").textContent = texto;
      var sim = document.getElementById("confirmar-sim");
      var nao = document.getElementById("confirmar-nao");
      function fim(v) { sim.onclick = null; nao.onclick = null; dConfirmar.close(); resolve(v); }
      sim.onclick = function () { fim(true); };
      nao.onclick = function () { fim(false); };
      dConfirmar.showModal();
    });
  }

  controle.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-acao]");
    if (!b) return;
    var acao = b.getAttribute("data-acao");
    if (acao === "avancar") avancar();
    else if (acao === "voltar") voltar();
    else if (acao === "ir") { seletorTocado = false; executarEtapa(Number(seletor.value)); }
    else if (acao === "recomendacao") executar(admin("POST", "/api/admin/recomendacao", { liberar: !(estado && estado.recomendacao) }));
    else if (acao === "editar-cego") abrirEditorCego();
    else if (acao === "zerar") {
      confirmar("Zerar todas as respostas e pontos e voltar à tela de entrada? Os participantes continuam cadastrados. Use depois do ensaio, antes da apresentação.").then(function (ok) {
        if (ok) { ultimoPasso = -1; executar(admin("POST", "/api/admin/zerar", { tudo: false })); }
      });
    }
    else if (acao === "apagar") {
      confirmar("Apagar todos os participantes, respostas e pontos? Não dá para desfazer. Use depois da aula para apagar os dados da turma.").then(function (ok) {
        if (ok) { ultimoPasso = -1; executar(admin("POST", "/api/admin/zerar", { tudo: true })); }
      });
    }
    else if (acao === "sair") {
      chave = "";
      painel = null;
      gravarLocal("gemeos.chave", "");
      clearTimeout(timerPainel);
      mostrarAcesso("");
    }
  });
  document.getElementById("esconder").addEventListener("click", alternarControles);
  tela.addEventListener("click", function (ev) {
    if (ev.target.closest(".marca")) alternarControles();
  });

  /* Teclado e passador de slides: setas e Page Up/Down avançam e voltam */
  function podeUsarAtalho() {
    return !!chave && acesso.hidden && !document.querySelector("dialog[open]");
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.target.matches && ev.target.matches("input, textarea, select")) return;
    if (!podeUsarAtalho()) return;
    if (ev.key === "c" || ev.key === "C") alternarControles();
    else if (ev.key === "ArrowRight" || ev.key === "PageDown") { ev.preventDefault(); avancar(); }
    else if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); voltar(); }
  });
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || !ev.data || !ev.data.gemeos || !podeUsarAtalho()) return;
    if (ev.data.gemeos === "alternar-controles") alternarControles();
    else if (ev.data.gemeos === "avancar") avancar();
    else if (ev.data.gemeos === "voltar") voltar();
  });

  /* ---------------- editor do teste cego ---------------- */
  function perguntaInfo(id) {
    if (!painel) return null;
    return painel.perguntas.filter(function (p) { return p.id === id; })[0] || null;
  }

  function abrirEditorCego() {
    if (!painel) return;
    abaCego = "cego1";
    montarEditor();
    document.getElementById("msg-cego").textContent = "";
    dCego.showModal();
  }

  function montarEditor() {
    Array.prototype.forEach.call(dCego.querySelectorAll("[data-aba]"), function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-aba") === abaCego ? "true" : "false");
    });
    var info = perguntaInfo(abaCego);
    document.getElementById("enunciado-cego").textContent = info ? info.enunciado : "";
    var valor = (painel.conteudo && painel.conteudo[abaCego]) || {};
    document.getElementById("campos-cego").innerHTML = ["A", "B", "C"].map(function (k) {
      var item = valor[k] || {};
      return '<div class="linha-ia"><label class="campo"><span>Resposta ' + k + '</span><textarea name="texto' + k + '" maxlength="2500">' + esc(item.texto || "") + "</textarea></label>" +
        '<label class="campo"><span>Quem escreveu</span><input name="ia' + k + '" maxlength="40" placeholder="Gemini, ChatGPT ou Claude" value="' + esc(item.ia || "") + '"></label></div>';
    }).join("");
  }

  dCego.addEventListener("click", function (ev) {
    var aba = ev.target.closest("[data-aba]");
    if (aba) { abaCego = aba.getAttribute("data-aba"); montarEditor(); document.getElementById("msg-cego").textContent = ""; return; }
    if (ev.target.closest("[data-fechar-cego]")) dCego.close();
  });

  fCego.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var valor = {};
    ["A", "B", "C"].forEach(function (k) {
      valor[k] = { texto: fCego["texto" + k].value, ia: fCego["ia" + k].value };
    });
    var msg = document.getElementById("msg-cego");
    msg.textContent = "Salvando…";
    admin("POST", "/api/admin/conteudo", { chave: abaCego, valor: valor }).then(function () {
      return recarregarPainel();
    }).then(function () {
      msg.textContent = "Respostas salvas.";
      renderControle();
    }).catch(function (e) { msg.textContent = e.message || "Não foi possível salvar."; });
  });

  /* ---------------- início ---------------- */
  montarSeletor();
  aplicarModo();
  if (!API) {
    tela.innerHTML = '<p style="padding:3rem">Configure o endereço da API em assets/config.js.</p>';
    return;
  }
  cicloEstado();
  if (chave) { esconderAcesso(); cicloPainel(); } else { mostrarAcesso(""); }
})();
