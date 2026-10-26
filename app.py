
from flask import Flask, render_template, request, redirect, url_for, flash
import mysql.connector
from decimal import Decimal, InvalidOperation

app = Flask(__name__)
app.secret_key = "estoque_inteligente_local"

CONFIG = {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "",
    "database": "estoque_inteligente"
}


def conectar():
    return mysql.connector.connect(**CONFIG)


def obter_resumo(cursor):
    cursor.execute("SELECT COUNT(*) AS total FROM produtos")
    total_produtos = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COALESCE(SUM(quantidade), 0) AS total
        FROM produtos
    """)
    total_unidades = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COALESCE(SUM(preco * quantidade), 0) AS valor
        FROM produtos
    """)
    valor_estoque = cursor.fetchone()["valor"]

    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM produtos
        WHERE quantidade <= estoque_minimo
    """)
    total_alertas = cursor.fetchone()["total"]

    return {
        "total_produtos": total_produtos,
        "total_unidades": total_unidades,
        "valor_estoque": valor_estoque,
        "total_alertas": total_alertas
    }


def obter_produtos(cursor):
    cursor.execute("""
        SELECT id_produto, nome, descricao, preco,
               quantidade, estoque_minimo
        FROM produtos
        ORDER BY nome
    """)
    return cursor.fetchall()


def obter_movimentacoes(cursor):
    cursor.execute("""
        SELECT m.id_movimentacao, p.nome, m.tipo,
               m.quantidade, m.motivo, m.data_movimentacao
        FROM movimentacoes m
        JOIN produtos p ON p.id_produto = m.id_produto
        ORDER BY m.data_movimentacao DESC,
                 m.id_movimentacao DESC
    """)
    return cursor.fetchall()


@app.route("/")
def inicio():
    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:
        resumo = obter_resumo(cursor)
        produtos = obter_produtos(cursor)
        movimentacoes = obter_movimentacoes(cursor)[:8]

        return render_template(
            "index.html",
            pagina="dashboard",
            **resumo,
            produtos=produtos,
            movimentacoes=movimentacoes
        )
    finally:
        cursor.close()
        conexao.close()


@app.route("/produtos")
def pagina_produtos():
    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:
        resumo = obter_resumo(cursor)
        produtos = obter_produtos(cursor)

        return render_template(
            "produtos.html",
            pagina="produtos",
            **resumo,
            produtos=produtos
        )
    finally:
        cursor.close()
        conexao.close()


@app.route("/movimentacoes")
def pagina_movimentacoes():
    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:
        resumo = obter_resumo(cursor)
        produtos = obter_produtos(cursor)
        movimentacoes = obter_movimentacoes(cursor)

        return render_template(
            "movimentacoes.html",
            pagina="movimentacoes",
            **resumo,
            produtos=produtos,
            movimentacoes=movimentacoes
        )
    finally:
        cursor.close()
        conexao.close()


@app.route("/alertas")
def alertas():
    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:
        resumo = obter_resumo(cursor)

        cursor.execute("""
            SELECT id_produto, nome, descricao, preco,
                   quantidade, estoque_minimo
            FROM produtos
            WHERE quantidade <= estoque_minimo
            ORDER BY quantidade ASC, nome ASC
        """)
        produtos = cursor.fetchall()

        return render_template(
            "alertas.html",
            pagina="alertas",
            **resumo,
            produtos=produtos
        )
    finally:
        cursor.close()
        conexao.close()


@app.route("/produtos/cadastrar", methods=["POST"])
def cadastrar_produto():
    conexao = None
    cursor = None

    try:
        nome = request.form.get("nome", "").strip()
        descricao = request.form.get("descricao", "").strip()
        preco_texto = request.form.get("preco", "0").replace(",", ".")
        quantidade = int(request.form.get("quantidade", "0"))
        estoque_minimo = int(request.form.get("estoque_minimo", "5"))
        preco = Decimal(preco_texto)

        if not nome:
            raise ValueError

        if not preco.is_finite() or preco < 0:
            raise ValueError

        if quantidade < 0 or estoque_minimo < 0:
            raise ValueError

        conexao = conectar()
        cursor = conexao.cursor()

        cursor.execute("""
            INSERT INTO produtos
                (nome, descricao, preco, quantidade, estoque_minimo)
            VALUES (%s, %s, %s, %s, %s)
        """, (nome, descricao, preco, quantidade, estoque_minimo))

        conexao.commit()
        flash("Produto cadastrado com sucesso!", "sucesso")

    except (ValueError, InvalidOperation):
        if conexao:
            conexao.rollback()
        flash(
            "Confira o nome, o preço e as quantidades informadas.",
            "erro"
        )

    except mysql.connector.Error:
        if conexao:
            conexao.rollback()
        flash(
            "Não foi possível cadastrar o produto. Confira o banco de dados.",
            "erro"
        )

    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()

    return redirect(url_for("pagina_produtos"))


@app.route("/produtos/excluir/<int:id_produto>", methods=["POST"])
def excluir_produto(id_produto):
    conexao = None
    cursor = None

    try:
        conexao = conectar()
        cursor = conexao.cursor()

        cursor.execute("""
            SELECT COUNT(*)
            FROM movimentacoes
            WHERE id_produto = %s
        """, (id_produto,))

        if cursor.fetchone()[0] > 0:
            flash(
                "Não é possível excluir: este produto possui movimentações.",
                "erro"
            )
        else:
            cursor.execute("""
                DELETE FROM produtos
                WHERE id_produto = %s
            """, (id_produto,))

            conexao.commit()

            if cursor.rowcount:
                flash("Produto excluído com sucesso!", "sucesso")
            else:
                flash("Produto não encontrado.", "erro")

    except mysql.connector.Error:
        if conexao:
            conexao.rollback()
        flash("Erro ao excluir o produto.", "erro")

    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()

    return redirect(url_for("pagina_produtos"))


@app.route("/movimentacoes/registrar", methods=["POST"])
def movimentar_estoque():
    conexao = None
    cursor = None

    try:
        id_produto = int(request.form.get("id_produto", "0"))
        quantidade = int(request.form.get("quantidade", "0"))
        tipo = request.form.get("tipo", "").upper()
        motivo = request.form.get("motivo", "").upper()

        motivos_validos = {
            "ENTRADA": {"ENCOMENDA"},
            "SAIDA": {"VENDA", "PERDA", "AVARIA"}
        }

        if id_produto <= 0 or quantidade <= 0:
            raise ValueError

        if tipo not in motivos_validos:
            raise ValueError

        if motivo not in motivos_validos[tipo]:
            raise ValueError

        conexao = conectar()
        conexao.start_transaction()
        cursor = conexao.cursor()

        cursor.execute("""
            SELECT nome, quantidade
            FROM produtos
            WHERE id_produto = %s
            FOR UPDATE
        """, (id_produto,))

        produto = cursor.fetchone()

        if produto is None:
            conexao.rollback()
            flash("Produto não encontrado.", "erro")

        elif tipo == "SAIDA" and quantidade > produto[1]:
            conexao.rollback()
            flash("Estoque insuficiente para essa saída.", "erro")

        else:
            estoque_atual = produto[1]

            novo_estoque = (
                estoque_atual + quantidade
                if tipo == "ENTRADA"
                else estoque_atual - quantidade
            )

            cursor.execute("""
                UPDATE produtos
                SET quantidade = %s
                WHERE id_produto = %s
            """, (novo_estoque, id_produto))

            cursor.execute("""
                INSERT INTO movimentacoes
                    (id_produto, tipo, quantidade, motivo)
                VALUES (%s, %s, %s, %s)
            """, (id_produto, tipo, quantidade, motivo))

            conexao.commit()

            flash(
                f"{tipo.capitalize()} registrada! "
                f"Motivo: {motivo.capitalize()}. "
                f"Estoque atual de {produto[0]}: {novo_estoque}.",
                "sucesso"
            )

    except (ValueError, TypeError):
        if conexao:
            conexao.rollback()

        flash(
            "Confira o produto, a quantidade, o tipo e o motivo.",
            "erro"
        )

    except mysql.connector.Error:
        if conexao:
            conexao.rollback()

        flash("Erro ao registrar a movimentação.", "erro")

    finally:
        if cursor:
            cursor.close()
        if conexao:
            conexao.close()

    return redirect(url_for("pagina_movimentacoes"))


if __name__ == "__main__":
    app.run(debug=True)
