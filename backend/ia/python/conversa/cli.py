"""Loop interativo no terminal."""

from .indice_vetorial import construir_vetor_store
from .orquestrador import responder_mensagem


def main() -> None:
    vetor_store = construir_vetor_store()
    historico_cli: list[dict[str, str]] = []

    print("chat_tumacore iniciado. Digite sua pergunta (ou 'sair' para encerrar).")
    while True:
        pergunta = input("\nVocê: ").strip()
        if not pergunta:
            continue
        if pergunta.lower() in {"sair", "exit", "quit"}:
            print("Encerrando chat.")
            break

        resultado = responder_mensagem(vetor_store, pergunta, history=historico_cli)
        historico_cli.append({"role": "user", "content": pergunta})
        historico_cli.append({"role": "assistant", "content": resultado["result"]})
        historico_cli = historico_cli[-24:]

        print("\nIA:")
        print(resultado["result"])

        if resultado["source_documents"]:
            print("\nFontes usadas (arquivos de contexto):")
            for doc in resultado["source_documents"]:
                print("-", doc.metadata.get("source", "desconhecido"))
