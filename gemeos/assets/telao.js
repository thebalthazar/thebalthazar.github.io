/* Gêmeos: telão e modo apresentador */
(function () {
  "use strict";

  var CFG = window.GEMEOS_CONFIG || {};
  var API = (CFG.api || "").replace(/\/+$/, "");
  var SITE = CFG.site || location.href.replace(/telao\.html.*$/, "");
  var SITE_CURTO = SITE.replace(/^https?:\/\//, "").replace(/\/$/, "");

  var tela = document.getElementById("tela");
  var controle = document.getElementById("controle");
  var seletor = document.getElementById("seletor");
  var statusEl = document.getElementById("controle-status");
  var resumo = document.getElementById("controle-resumo");
  var dChave = document.getElementById("dialogo-chave");
  var fChave = document.getElementById("form-chave");
  var dConfirmar = document.getElementById("dialogo-confirmar");
  var dCego = document.getElementById("dialogo-cego");
  var fCego = document.getElementById("form-cego");

  var chave = lerLocal("gemeos.chave");
  var painel = null;
  var estado = null;
  var prazo = 0;
  var assinaturaTela = "";
  var abaCego = "cego1";
  var timerPainel = null;
  var modoControle = false;

  function lerLocal(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function gravarLocal(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* sem armazenamento */ } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function letra(i) { return String.fromCharCode(65 + i); }

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

  /* ---------------- modo e controles ---------------- */
  function aplicarModo() {
    modoControle = location.hash === "#controle";
    document.body.classList.toggle("modo-controle", modoControle);
    var link = document.getElementById("link-modo");
    link.textContent = modoControle ? "Ver como telão" : "Controle pelo celular";
    link.setAttribute("href", modoControle ? "#" : "#controle");
    if (modoControle) controle.hidden = false;
    medirControle();
    assinaturaTela = "";
    renderTela();
  }
  window.addEventListener("hashchange", aplicarModo);

  function medirControle() {
    var h = controle.hidden || modoControle ? 0 : controle.offsetHeight;
    document.documentElement.style.setProperty("--altura-controle", h + "px");
  }
  window.addEventListener("resize", medirControle);

  document.addEventListener("keydown", function (ev) {
    if (ev.target.matches && ev.target.matches("input, textarea, select")) return;
    if (ev.key === "c" || ev.key === "C") { controle.hidden = !controle.hidden; medirControle(); }
  });
  document.getElementById("esconder").addEventListener("click", function () { controle.hidden = true; medirControle(); });
  tela.addEventListener("click", function (ev) {
    if (ev.target.closest(".marca")) { controle.hidden = !controle.hidden; medirControle(); }
  });

  /* ---------------- servidor ---------------- */
  function admin(metodo, caminho, corpo) {
    return fetch(API + caminho, {
      method: metodo,
      cache: "no-store",
      headers: { "content-type": "application/json", "x-admin-key": chave },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) { var e = new Error(d.erro || "Erro no servidor."); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  function pedirChave(msg) {
    var p = fChave.querySelector(".mensagem-erro");
    p.textContent = msg || "";
    p.hidden = !msg;
    if (!dChave.open) dChave.showModal();
    setTimeout(function () { fChave.chave.focus(); }, 50);
  }

  fChave.addEventListener("submit", function (ev) {
    ev.preventDefault();
    chave = fChave.chave.value.trim();
    admin("GET", "/api/admin/painel").then(function (d) {
      gravarLocal("gemeos.chave", chave);
      painel = d;
      dChave.close();
      renderControle();
      cicloPainel();
    }).catch(function (e) {
      chave = "";
      pedirChave(e.status === 401 ? "A chave não confere. Copie de novo a variável ADMIN_KEY no Railway." : "Sem conexão com o servidor do jogo.");
    });
  });

  function cicloEstado() {
    fetch(API + "/api/estado", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      estado = d;
      if (d.tela === "aberta" && typeof d.restante === "number") {
        var novo = Date.now() + d.restante * 1000;
        if (!prazo || Math.abs(novo - prazo) > 1500) prazo = novo;
      } else {
        prazo = 0;
      }
      renderTela();
      renderStatus();
    }).catch(function () {
      statusEl.textContent = "Sem conexão com o servidor do jogo. Tentando de novo.";
    }).then(function () { setTimeout(cicloEstado, 1000); });
  }

  function cicloPainel() {
    clearTimeout(timerPainel);
    if (!chave) return;
    admin("GET", "/api/admin/painel").then(function (d) {
      painel = d;
      renderControle();
    }).catch(function (e) {
      if (e.status === 401) { chave = ""; gravarLocal("gemeos.chave", ""); pedirChave("A chave não confere."); return; }
    }).then(function () { if (chave) timerPainel = setTimeout(cicloPainel, 3000); });
  }

  /* ---------------- telão ---------------- */
  function perguntaInfo(id) {
    if (!painel) return null;
    return painel.perguntas.filter(function (p) { return p.id === id; })[0] || null;
  }

  function topoTela(titulo, comTempo) {
    return '<div class="tela-topo"><span class="marca">Gêmeos</span><span class="tela-titulo">' + esc(titulo) + "</span>" +
      (comTempo ? '<span class="tela-tempo" data-tempo></span>' : "") + '</div><div class="fio-duplo" aria-hidden="true"></div>';
  }

  function rodapeTela(texto) {
    return '<div class="tela-rodape"><span data-rodape>' + esc(texto) + '</span><span class="qr-pequeno">' + qrSvg(linkEntrada()) + "</span></div>";
  }

  function telaEspera() {
    var sala = painel ? painel.sala : "";
    return '<div class="tela-espera"><div><h1 class="marca">Gêmeos</h1><div class="fio-duplo" aria-hidden="true"></div><dl>' +
      "<dt>Entre no jogo</dt><dd>" + esc(SITE_CURTO) + "</dd>" +
      (sala ? "<dt>Código da sala</dt><dd>" + esc(sala) + "</dd>" : "") +
      '<dt>Participantes</dt><dd data-jogadores>' + fmt(estado.jogadores) + "</dd></dl></div>" +
      '<div class="qr">' + qrSvg(linkEntrada()) + "</div></div>";
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

  function respostasTexto() {
    return fmt(estado.respostas || 0) + " de " + fmt(estado.jogadores) + " responderam";
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
    if (p.tipo === "decisao" && r.notas && r.notas.length) {
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
      tres.map(function (l, i) {
        return '<section class="' + (i === 0 ? "primeiro" : "") + '"><div class="pos">' + l.posicao + 'º</div><div class="nome">' + esc(l.nome) +
          '</div><div class="pts">' + fmt(l.pontos) + " pontos</div></section>";
      }).join("") + "</div></div>";
  }

  function renderTela() {
    if (!estado || modoControle) return;
    var e = estado;
    var assinatura = [e.tela, e.pergunta ? e.pergunta.id : "", e.pergunta && e.pergunta.textos ? e.pergunta.textos.join("¦").length : "",
      e.resultado ? JSON.stringify(e.resultado) : "", e.placar ? JSON.stringify(e.placar) : "",
      e.tela === "espera" ? e.jogadores : "", painel ? painel.sala : ""].join("|");
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
    var jog = tela.querySelector("[data-jogadores]");
    if (jog) jog.textContent = fmt(e.jogadores);
    marcarTempo();
  }

  setInterval(marcarTempo, 250);
  function marcarTempo() {
    var t = tela.querySelector("[data-tempo]");
    if (!t) return;
    t.textContent = prazo ? Math.ceil(Math.max(0, (prazo - Date.now()) / 1000)) + " s" : "";
  }

  /* ---------------- controles ---------------- */
  function renderStatus() {
    if (!estado) return;
    var nomes = { espera: "Tela de entrada", aberta: "Pergunta aberta", resultado: "Resultado", placar: "Placar", podio: "Pódio" };
    var p = estado.pergunta;
    var partes = [];
    if (painel) partes.push("Sala " + painel.sala);
    partes.push(fmt(estado.jogadores) + " participantes");
    partes.push("Tela: " + nomes[estado.tela].toLowerCase() + (p && (estado.tela === "aberta" || estado.tela === "resultado") ? " (" + p.titulo + ")" : ""));
    if (estado.tela === "aberta") partes.push(respostasTexto());
    statusEl.textContent = partes.join(". ") + ".";
    resumo.innerHTML = "<h1>" + esc(p && (estado.tela === "aberta" || estado.tela === "resultado") ? p.titulo : nomes[estado.tela]) + "</h1><p>" +
      esc(statusEl.textContent) + (prazo ? " Faltam " + Math.ceil(Math.max(0, (prazo - Date.now()) / 1000)) + " s." : "") + "</p>";
    var botao = document.getElementById("botao-recomendacao");
    botao.textContent = estado.recomendacao ? "Bloquear recomendação" : "Liberar recomendação";
  }

  function renderControle() {
    if (!painel) return;
    var atual = seletor.value;
    var sugerida = proximaPergunta();
    seletor.innerHTML = painel.perguntas.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.titulo) + " (" + p.respostas + " respostas)</option>";
    }).join("");
    seletor.value = atual && perguntaInfo(atual) ? atual : sugerida;
    renderStatus();
    medirControle();
  }

  function proximaPergunta() {
    if (!painel) return "";
    var lista = painel.perguntas;
    var atualId = painel.estado && painel.estado.perguntaId;
    var idx = lista.findIndex(function (p) { return p.id === atualId; });
    if (idx >= 0 && painel.estado.tela === "resultado" && idx + 1 < lista.length) return lista[idx + 1].id;
    if (idx >= 0) return lista[idx].id;
    return lista[0].id;
  }

  function executar(promessa, rotulo) {
    statusEl.textContent = rotulo + "…";
    return promessa.then(function (d) {
      return admin("GET", "/api/admin/painel").then(function (p) { painel = p; renderControle(); return d; });
    }).catch(function (e) {
      statusEl.textContent = e.message || "Não foi possível concluir.";
    });
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
    var id = seletor.value;
    var info = perguntaInfo(id);
    if (acao === "abrir") executar(admin("POST", "/api/admin/tela", { tela: "aberta", pergunta: id }), "Abrindo " + (info ? info.titulo : "pergunta"));
    else if (acao === "resultado") executar(admin("POST", "/api/admin/tela", { tela: "resultado", pergunta: estado && estado.pergunta ? estado.pergunta.id : id }), "Encerrando");
    else if (acao === "revelar") {
      var alvo = estado && estado.pergunta && estado.pergunta.tipo === "cego" ? estado.pergunta.id : id;
      var infoAlvo = perguntaInfo(alvo);
      if (!infoAlvo || infoAlvo.tipo !== "cego") { statusEl.textContent = "Escolha um teste cego para revelar os autores."; return; }
      executar(admin("POST", "/api/admin/tela", { tela: "resultado", pergunta: alvo }).then(function () {
        return admin("POST", "/api/admin/revelar", { pergunta: alvo });
      }), "Revelando os autores");
    }
    else if (acao === "placar" || acao === "podio" || acao === "espera") executar(admin("POST", "/api/admin/tela", { tela: acao }), "Mudando a tela");
    else if (acao === "recomendacao") executar(admin("POST", "/api/admin/recomendacao", { liberar: !(estado && estado.recomendacao) }), "Atualizando a recomendação");
    else if (acao === "editar-cego") abrirEditorCego();
    else if (acao === "zerar") {
      confirmar("Zerar todas as respostas e pontos? Os participantes continuam cadastrados. Use antes da apresentação, depois do ensaio.").then(function (ok) {
        if (ok) executar(admin("POST", "/api/admin/zerar", { tudo: false }), "Zerando as respostas");
      });
    }
    else if (acao === "apagar") {
      confirmar("Apagar todos os participantes, respostas e pontos? Não dá para desfazer. Use depois da aula para apagar os dados da turma.").then(function (ok) {
        if (ok) executar(admin("POST", "/api/admin/zerar", { tudo: true }), "Apagando os dados");
      });
    }
    else if (acao === "sair") { chave = ""; gravarLocal("gemeos.chave", ""); clearTimeout(timerPainel); pedirChave(""); }
  });

  /* ---------------- editor do teste cego ---------------- */
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
      return admin("GET", "/api/admin/painel");
    }).then(function (p) {
      painel = p;
      msg.textContent = "Respostas salvas.";
    }).catch(function (e) { msg.textContent = e.message || "Não foi possível salvar."; });
  });

  /* ---------------- início ---------------- */
  aplicarModo();
  if (!API) {
    tela.innerHTML = '<p style="padding:3rem">Configure o endereço da API em assets/config.js.</p>';
    return;
  }
  cicloEstado();
  if (chave) cicloPainel(); else pedirChave("");
})();
