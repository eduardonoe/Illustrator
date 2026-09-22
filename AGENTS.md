# Agent Instructions

Estas instrucoes valem para qualquer agente trabalhando neste repositorio,
incluindo Codex.

## Objetivo

Manter projetos Illustrator, especialmente paineis CEP, organizados,
versionados e faceis de continuar em diferentes ferramentas.

## Antes de editar

1. Leia `README.md` e `VERSIONING.md`.
2. Identifique qual painel, script ou pacote sera alterado.
3. Leia `CSXS/manifest.xml` e o arquivo principal do host.
4. Preserve o estilo existente do projeto (ExtendScript ES3).

## Ao editar

- Mantenha o escopo pequeno e diretamente ligado ao pedido.
- Nao misture projetos diferentes no mesmo commit.
- Nao reformatar arquivos inteiros sem necessidade.
- Atualize a versao quando a mudanca afetar comportamento, estabilidade ou
  pacote final, e mantenha `manifest.xml` e `var VERSION` em sintonia.
- Espelhe `PC/` em `MAC/` sempre.

## Cuidados com Illustrator / ExtendScript

- O host e ES3: sem `let`, `const`, arrow function, `JSON`, `Array.map`.
- `app.executeMenuCommand` com id invalido **nao lanca erro**. Um id invalido
  falha com o erro `'BKey'` quando chamado num contexto que o rejeita; ids
  desconhecidos simplesmente nao fazem nada. Sempre verifique o efeito.
- **Medir depois de salvar.** Envelopes e efeitos ao vivo podem aparecer
  corretos em memoria e reverter no `saveAs`. Validar apenas o estado em
  memoria produz falso positivo.
- Existem dois tipos de "envelope": efeito Warp (escala e persiste bem) e
  Envelope Distort com malha (`PluginItem`, so persiste apos `Expand3`).
- `duplicate()` entre documentos **desloca** o item; nunca assuma que o clone
  esta na mesma posicao do original.
- Nunca modificar o documento de origem. Trabalhar sempre sobre a copia
  descartavel no documento de destino.
- Evitar rodar comandos de menu em laco item a item num documento grande:
  selecionar tudo e rodar o comando uma vez e mais rapido e nao derruba a
  ponte de scripting.

## Testes

Illustrator pode ser controlado via COM no Windows, o que permite testar sem
depender do usuario:

```powershell
$ai = [Runtime.InteropServices.Marshal]::GetActiveObject("Illustrator.Application")
$ai.DoJavaScript($codigoExtendScript)
```

Use um documento de teste proprio (`app.documents.add`) e feche com
`SaveOptions.DONOTSAVECHANGES`. Nunca testar direto em arquivo de producao.

## Versionamento

Siga `VERSIONING.md`.

## Commits

Use mensagens claras em portugues, com prefixo quando fizer sentido:

- `fix:` para correcao
- `feat:` para recurso novo
- `docs:` para documentacao
- `chore:` para organizacao
- `release:` para preparacao de versao

Antes de commitar, confirme o escopo com o usuario quando houver risco de
alterar mais do que foi pedido.
