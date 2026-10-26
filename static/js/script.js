document.addEventListener("DOMContentLoaded", () => {
    // Pesquisa nas tabelas
    function configurarPesquisa(idCampo, idTabela) {
        const campo = document.getElementById(idCampo);
        const tabela = document.getElementById(idTabela);

        if (!campo || !tabela) return;

        campo.addEventListener("input", () => {
            const termo = campo.value.trim().toLowerCase();

            tabela.querySelectorAll("tr").forEach((linha) => {
                linha.style.display = linha.textContent
                    .toLowerCase()
                    .includes(termo) ? "" : "none";
            });
        });
    }

    configurarPesquisa("pesquisaProduto", "tabelaProdutos");
    configurarPesquisa("pesquisaMovimentacao", "tabelaMovimentacoes");

    // Notificações
    document.querySelectorAll(".close-notification").forEach((botao) => {
        botao.addEventListener("click", () => {
            botao.closest(".notification")?.remove();
        });
    });

    document.querySelectorAll(".notification").forEach((notificacao) => {
        setTimeout(() => notificacao.remove(), 5000);
    });

    // Seletores personalizados
    const seletores = [];

    function fecharTodos(exceto = null) {
        seletores.forEach((item) => {
            if (item !== exceto) item.fechar();
        });
    }

    // "Ballena — estoque: 5"  ->  { nome: "Ballena", estoque: 5 }
    function lerOpcao(option) {
        const texto = option.textContent.trim();
        let estoque = option.dataset.estoque !== undefined
            ? parseInt(option.dataset.estoque, 10)
            : NaN;
        let nome = texto;

        const m = texto.match(/^(.*?)\s+[—–]\s+estoque:\s*(\d+)\s*$/i);
        if (m) {
            nome = m[1];
            if (Number.isNaN(estoque)) estoque = parseInt(m[2], 10);
        }

        return { nome, estoque: Number.isNaN(estoque) ? null : estoque };
    }

    function criarBadge(estoque, baixo, medio) {
        if (estoque === null) return null;

        const badge = document.createElement("span");
        const nivel = estoque <= baixo ? "low" : estoque <= medio ? "mid" : "high";
        badge.className = "stock-badge " + nivel;
        badge.textContent = estoque + " un.";
        return badge;
    }

    function criarSeletor(select) {
        const wrapper = select.closest(".select-wrap");
        if (!wrapper) return;

        const pesquisavel = select.dataset.search !== "false";
        const placeholder =
            select.dataset.placeholder || "Selecione uma opção";
        const searchPlaceholder =
            select.dataset.searchPlaceholder || "Pesquisar opção...";
        const limiteBaixo = parseInt(select.dataset.low || "5", 10);
        const limiteMedio = parseInt(select.dataset.mid || "15", 10);

        const custom = document.createElement("div");
        custom.className = "modern-select";

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "modern-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const selectedText = document.createElement("span");
        selectedText.className = "modern-select-value";

        const arrow = document.createElement("span");
        arrow.className = "modern-select-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "⌄";

        trigger.append(selectedText, arrow);

        const menu = document.createElement("div");
        menu.className = "modern-select-menu";
        menu.hidden = true;

        let searchInput = null;

        if (pesquisavel) {
            const searchBox = document.createElement("div");
            searchBox.className = "modern-select-search";

            searchInput = document.createElement("input");
            searchInput.type = "search";
            searchInput.placeholder = searchPlaceholder;
            searchInput.autocomplete = "off";
            searchInput.setAttribute("aria-label", searchPlaceholder);

            searchBox.appendChild(searchInput);
            menu.appendChild(searchBox);
        }

        const optionsBox = document.createElement("div");
        optionsBox.className = "modern-select-options";
        optionsBox.setAttribute("role", "listbox");

        menu.appendChild(optionsBox);
        custom.append(trigger, menu);
        wrapper.appendChild(custom);

        // O select original continua sendo o campo enviado ao Flask.
        // Guardamos o "required" para validar manualmente no submit.
        const obrigatorio = select.required;
        select.classList.add("native-select-enhanced");
        select.removeAttribute("required");

        let aberto = false;

        function obterOpcoes() {
            return Array.from(select.options).filter((option) => {
                return !option.disabled && option.value !== "";
            });
        }

        function atualizarValor() {
            const option = select.options[select.selectedIndex];

            selectedText.replaceChildren();

            if (option && option.value !== "") {
                const { nome, estoque } = lerOpcao(option);

                const spanNome = document.createElement("span");
                spanNome.className = "opt-name";
                spanNome.textContent = nome;
                selectedText.appendChild(spanNome);

                const badge = criarBadge(estoque, limiteBaixo, limiteMedio);
                if (badge) selectedText.appendChild(badge);

                selectedText.classList.remove("is-placeholder");
                trigger.classList.remove("is-invalid");
                trigger.title = option.textContent.trim();
            } else {
                selectedText.textContent = placeholder;
                selectedText.classList.add("is-placeholder");
                trigger.title = placeholder;
            }

            optionsBox.querySelectorAll(".modern-select-option").forEach((botao) => {
                const ativo = botao.dataset.value === select.value;
                botao.classList.toggle("selected", ativo);
                botao.setAttribute("aria-selected", String(ativo));
            });
        }

        function renderizarOpcoes() {
            const termo = searchInput
                ? searchInput.value.trim().toLocaleLowerCase("pt-BR")
                : "";

            optionsBox.replaceChildren();

            const opcoes = obterOpcoes().filter((option) => {
                return lerOpcao(option).nome
                    .toLocaleLowerCase("pt-BR")
                    .includes(termo);
            });

            if (opcoes.length === 0) {
                const vazio = document.createElement("div");
                vazio.className = "modern-select-empty";
                vazio.textContent = "Nenhum resultado encontrado";
                optionsBox.appendChild(vazio);
                return;
            }

            opcoes.forEach((option) => {
                const { nome, estoque } = lerOpcao(option);

                const botao = document.createElement("button");
                botao.type = "button";
                botao.className = "modern-select-option";
                botao.dataset.value = option.value;
                botao.setAttribute("role", "option");
                botao.setAttribute(
                    "aria-selected",
                    String(option.value === select.value)
                );

                const spanNome = document.createElement("span");
                spanNome.className = "opt-name";
                spanNome.textContent = nome;
                botao.appendChild(spanNome);

                const badge = criarBadge(estoque, limiteBaixo, limiteMedio);
                if (badge) botao.appendChild(badge);

                if (option.value === select.value) {
                    botao.classList.add("selected");
                }

                botao.addEventListener("click", () => {
                    select.value = option.value;
                    select.dispatchEvent(
                        new Event("change", { bubbles: true })
                    );

                    atualizarValor();
                    fechar();
                    trigger.focus();
                });

                optionsBox.appendChild(botao);
            });
        }

        function abrir() {
            fecharTodos(item);
            aberto = true;
            menu.hidden = false;
            custom.classList.add("open");
            trigger.setAttribute("aria-expanded", "true");
            trigger.classList.remove("is-invalid");

            if (searchInput) {
                searchInput.value = "";
                renderizarOpcoes();
                requestAnimationFrame(() => searchInput.focus());
            } else {
                renderizarOpcoes();
            }
        }

        function fechar() {
            aberto = false;
            menu.hidden = true;
            custom.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
        }

        trigger.addEventListener("click", () => {
            if (aberto) {
                fechar();
            } else {
                abrir();
            }
        });

        trigger.addEventListener("keydown", (event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" ||
                event.key === " ") {
                event.preventDefault();
                abrir();
            }

            if (event.key === "Escape") {
                fechar();
            }
        });

        if (searchInput) {
            searchInput.addEventListener("input", renderizarOpcoes);

            searchInput.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    fechar();
                    trigger.focus();
                }

                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    optionsBox.querySelector(".modern-select-option")?.focus();
                }
            });
        }

        optionsBox.addEventListener("keydown", (event) => {
            const botoes = Array.from(
                optionsBox.querySelectorAll(".modern-select-option")
            );
            const indice = botoes.indexOf(document.activeElement);

            if (event.key === "ArrowDown") {
                event.preventDefault();
                botoes[Math.min(indice + 1, botoes.length - 1)]?.focus();
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();

                if (indice <= 0) {
                    searchInput ? searchInput.focus() : trigger.focus();
                } else {
                    botoes[indice - 1]?.focus();
                }
            }

            if (event.key === "Escape") {
                fechar();
                trigger.focus();
            }
        });

        select.addEventListener("change", () => {
            atualizarValor();
            renderizarOpcoes();
        });

        const item = {
            select,
            trigger,
            obrigatorio,
            abrir,
            fechar,
            atualizarValor,
            renderizarOpcoes
        };

        seletores.push(item);

        atualizarValor();
        renderizarOpcoes();
    }

    // Aplica o visual novo em TODOS os selects da página.
    // Para manter um select nativo, use: <select data-native>
    document.querySelectorAll("select").forEach((select) => {
        if (select.hasAttribute("data-native")) return;

        if (!select.closest(".select-wrap")) {
            const wrap = document.createElement("div");
            wrap.className = "select-wrap";
            select.parentNode.insertBefore(wrap, select);
            wrap.appendChild(select);
        }

        criarSeletor(select);
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".modern-select")) {
            fecharTodos();
        }
    });

    // Atualiza as opções de motivo conforme a operação escolhida.
    const tipo = document.getElementById("tipo");
    const motivo = document.getElementById("motivo");

    if (tipo && motivo) {
        function atualizarMotivos() {
            const permitidos = tipo.value === "ENTRADA"
                ? ["ENCOMENDA"]
                : ["VENDA", "PERDA", "AVARIA"];

            Array.from(motivo.options).forEach((option) => {
                if (!option.value) return;
                option.disabled = !permitidos.includes(option.value);
                option.hidden = option.disabled;
            });

            if (!permitidos.includes(motivo.value)) {
                motivo.value = permitidos[0];
            }

            motivo.dispatchEvent(new Event("change", { bubbles: true }));
        }

        tipo.addEventListener("change", atualizarMotivos);
        atualizarMotivos();
    }

    // Validação visual dos seletores obrigatórios.
    const form = document.getElementById("formMovimentacao");

    if (form) {
        form.addEventListener("submit", (event) => {
            const primeiroInvalido = seletores.find((item) => {
                return form.contains(item.select) &&
                    item.obrigatorio &&
                    !item.select.value;
            });

            if (primeiroInvalido) {
                event.preventDefault();
                primeiroInvalido.trigger.classList.add("is-invalid");
                primeiroInvalido.abrir();
                return;
            }

            const quantidade = document.getElementById("quantidade");

            if (quantidade && (!quantidade.value ||
                Number(quantidade.value) < 1 ||
                !Number.isInteger(Number(quantidade.value)))) {
                event.preventDefault();
                quantidade.focus();
                quantidade.reportValidity();
            }
        });
    }
});